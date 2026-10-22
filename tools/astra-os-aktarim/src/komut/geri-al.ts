/* `geri-al --aktarim <uuid>` (ya da `--dalga a`): eşleşmeleri ve araç tarafından YAZILAN satırları `silindi_at` ile gizler (fiziksel silme yok).
   - SAHİPLENİLEN satırlara dokunulmaz (hedefte zaten vardı, aracın değil): yalnız eşleşmesi gizlenir.
   - `uygulama_durumu` anahtarları bayraksız silinmez (R-4): yalnız `--uygulama-durumlarini-sil` ile ve yalnız aracın yazdığı ('yazildi') anahtarlar.
     Bayrak yoksa uygulama_durumu eşleşmeleri de aktif kalır (veri duruyor; tekrar `yaz` onları atlar).
   - Onay kodu yoksa KURU çalışır (yalnız sayım + kod); yanlış kodda hiçbir yazma yapılmaz. */
import { olayYazdir } from '../cikti.ts';
import { hataGuvenli, type GuvenliHata } from '../guvenlik/sir-koruma.ts';
import type { Dalga } from '../plan/plan-tipleri.ts';
import type { EslesmeSatiri, EklemeTablosu, YaziciFabrikasi } from '../yazici/yazici-arayuzu.ts';
import { GERI_ONAY_DESENI, geriAlOnayKodu, onayEsitMi, type GeriAlSayimi } from './geri-al-hesap.ts';
import { KomutHatasi } from './komut-hata.ts';

export type GeriAlGirdisi = {
  aktarim?: string;
  dalga?: Dalga;
  uygulamaDurumlariniSil: boolean;
  /* undefined/boş → kuru çalışma */
  onay?: string;
  hedefRef: string;
  yaziciKur: YaziciFabrikasi;
  simdi: () => Date;
};

export type GeriAlSonucu = {
  kuru: boolean;
  secilen: number;
  sayimlar: GeriAlSayimi[];
  onay_kodu: string;
  gizlenen_satir: number;
  silinen_anahtar: number;
  gizlenen_eslesme: number;
  korunan_uygulama_durumu: number;
  hata: GuvenliHata | null;
};

const SATIR_TABLOLARI: readonly string[] = ['begeniler'];

function sayimlariKur(satirlar: readonly EslesmeSatiri[]): GeriAlSayimi[] {
  const harita = new Map<string, GeriAlSayimi>();
  for (const e of satirlar) {
    let s = harita.get(e.hedef_tablo);
    if (!s) harita.set(e.hedef_tablo, (s = { hedef_tablo: e.hedef_tablo, yazildi: 0, sahiplenildi: 0 }));
    /* İzin listesi: yalnız açıkça 'yazildi' olanlar aracın yazdığı sayılır; bilinmeyen/eksik durum korunur (sahiplenildi gibi). */
    if (e.ekstra.durum === 'yazildi') s.yazildi += 1;
    else s.sahiplenildi += 1;
  }
  return [...harita.values()];
}

export async function geriAl(g: GeriAlGirdisi): Promise<GeriAlSonucu> {
  const yazici = await g.yaziciKur();
  const sonuc: GeriAlSonucu = {
    kuru: true, secilen: 0, sayimlar: [], onay_kodu: '', gizlenen_satir: 0, silinen_anahtar: 0, gizlenen_eslesme: 0, korunan_uygulama_durumu: 0, hata: null,
  };
  let sonTablo: string | undefined;
  try {
    const tumu = await yazici.eslesmeOku({ aktarim_id: g.aktarim, dalga: g.dalga });
    const aktifler = tumu.filter((e) => e.silindi_at === null);
    sonuc.secilen = aktifler.length;
    sonuc.sayimlar = sayimlariKur(aktifler);
    sonuc.onay_kodu = geriAlOnayKodu({
      aktarim: g.aktarim ?? null,
      dalga: g.dalga ?? null,
      hedefRef: g.hedefRef,
      uygulamaDurumlariniSil: g.uygulamaDurumlariniSil,
      sayimlar: sonuc.sayimlar,
    });
    const kuru = g.onay === undefined || g.onay === '';
    sonuc.kuru = kuru;
    if (kuru) return sonuc;
    /* Yanlış kod → hiçbir yazma yok. */
    if (!onayEsitMi(sonuc.onay_kodu, GERI_ONAY_DESENI, g.onay)) throw new KomutHatasi('ONAY_UYUSMADI');

    /* Yazmadan önce: desteklenmeyen hedef tablo varsa HİÇ başlama. */
    for (const s of sonuc.sayimlar) {
      if (s.hedef_tablo !== 'uygulama_durumu' && !SATIR_TABLOLARI.includes(s.hedef_tablo)) throw new KomutHatasi('DESTEKLENMEYEN_TABLO', { tablo: s.hedef_tablo });
    }

    /* 1) Hedef satırlar (yalnız aracın yazdıkları). */
    sonTablo = 'begeniler';
    const gizlenecek = aktifler.filter((e) => e.hedef_tablo === 'begeniler' && e.ekstra.durum === 'yazildi' && e.hedef_id !== null).map((e) => e.hedef_id as string);
    if (gizlenecek.length > 0) await yazici.satirGizle('begeniler' satisfies EklemeTablosu, gizlenecek);
    sonuc.gizlenen_satir = gizlenecek.length;

    /* 2) uygulama_durumu anahtarları: yalnız bayrakla ve yalnız 'yazildi'. */
    const uygulamaEslesmeleri = aktifler.filter((e) => e.hedef_tablo === 'uygulama_durumu');
    const silinecekEslesme: EslesmeSatiri[] = [];
    if (g.uygulamaDurumlariniSil) {
      sonTablo = 'uygulama_durumu';
      for (const e of uygulamaEslesmeleri) {
        if (e.ekstra.durum === 'yazildi' && e.hedef_ref !== null) {
          const ayrac = e.hedef_ref.indexOf('/');
          if (ayrac > 0) {
            await yazici.uygulamaDurumuSil(e.hedef_ref.slice(0, ayrac), e.hedef_ref.slice(ayrac + 1));
            sonuc.silinen_anahtar += 1;
          }
        }
        silinecekEslesme.push(e);
      }
    } else {
      sonuc.korunan_uygulama_durumu = uygulamaEslesmeleri.length;
    }

    /* 3) Eşleşmeleri gizle (en son: yarıda kesilirse yeniden çalıştırma güvenlidir; satirGizle yalnız silinmemişlere dokunur). */
    sonTablo = 'aktarim_eslesme';
    const damga = g.simdi().toISOString();
    for (const e of [...aktifler.filter((x) => x.hedef_tablo !== 'uygulama_durumu'), ...silinecekEslesme]) {
      await yazici.eslesmeGuncelle(e.id, { silindi_at: damga });
      sonuc.gizlenen_eslesme += 1;
    }
    return sonuc;
  } catch (e) {
    if (e instanceof KomutHatasi) throw e;
    const t = typeof e === 'object' && e !== null ? (e as { tablo?: unknown }).tablo : undefined;
    sonuc.hata = hataGuvenli(e, typeof t === 'string' ? t : sonTablo);
    return sonuc;
  } finally {
    await yazici.kapat();
  }
}

export function geriAlSonucuYazdir(s: GeriAlSonucu): void {
  for (const x of s.sayimlar) olayYazdir({ tur: 'BILGI', kod: 'GERI_AL_SAYIM', alanlar: { tablo: x.hedef_tablo, yazildi: x.yazildi, sahiplenildi: x.sahiplenildi } });
  if (s.kuru) {
    olayYazdir({ tur: 'SONUC', kod: 'GERI_AL_KURU', alanlar: { secilen: s.secilen, onay_kodu: s.onay_kodu } });
    return;
  }
  olayYazdir({
    tur: 'SONUC',
    kod: s.hata === null ? 'GERI_AL_TAMAM' : 'GERI_AL_YARIM',
    alanlar: { gizlenen_satir: s.gizlenen_satir, silinen_anahtar: s.silinen_anahtar, gizlenen_eslesme: s.gizlenen_eslesme, korunan_uygulama_durumu: s.korunan_uygulama_durumu },
  });
  if (s.hata !== null) olayYazdir({ tur: 'HATA', kod: 'GERI_AL_DURDU', alanlar: { neden: s.hata.kod, durum: s.hata.durum ?? 0, tablo: s.hata.tablo ?? 'yok' } });
}
