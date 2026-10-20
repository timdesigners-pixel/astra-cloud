/* `yaz --onay ONAY-...`: planı yeniden üretir (çağıran), kodu `onayDogrula` ile karşılaştırır. Yanlış/boş/başka dalga kodu → HİÇBİR yazma yok:
   yazıcı fabrikası bile çağrılmaz (oturum açılmaz, PIN deneme hakkı yakılmaz).
   Sıra (plan §4.2): eşleşme oku → sahiplen → yaz → eşleşme yaz. Küçük yığın, sıralı. Hedefteki MEVCUT satır asla güncellenmez (yalnız insert ve eşleşme).
   İlk hatada durur ve o ana kadarki sayıları raporlar. */
import { ilerlemeYazdir, olayYazdir } from '../cikti.ts';
import { hataGuvenli, type GuvenliHata } from '../guvenlik/sir-koruma.ts';
import type { Plan } from '../plan/plan.ts';
import { onayDogrula } from '../plan/onay-kodu-hesap.ts';
import type { BegeniPlanKaydi, HedefTablo, PlanKaydi } from '../plan/plan-tipleri.ts';
import { eslesmeDiziniYukle, eslesmeKaydet, type EslesmeKaydi } from '../yazici/eslesme.ts';
import { hedefDurumuKur, sahiplenmeKarariVer, type SahiplenmeKarari } from '../yazici/sahiplenme-hesap.ts';
import type { EslesmeDurumu, EslesmeGirdisi, Yazici, YaziciFabrikasi } from '../yazici/yazici-arayuzu.ts';
import { KomutHatasi } from './komut-hata.ts';

/* PostgREST yığınları ve çökme penceresi (R-3) için küçük tutulur. */
export const VARSAYILAN_YIGIN = 50;

export type YazGirdisi = {
  plan: Plan;
  /* Kullanıcının verdiği kod; tür doğrulanmadan karşılaştırılır (undefined/boş → uyuşmaz). */
  onay: unknown;
  yaziciKur: YaziciFabrikasi;
  aktarimId: string;
  yiginBoyutu?: number;
};

export type YazSonucu = {
  aktarim_id: string;
  dalga: string;
  yazilan: { tablo: HedefTablo; sayi: number }[];
  sahiplenilen: number;
  atlanan_eslesme: number;
  belirsiz: number;
  eslesme_yazilan: number;
  /* Hedef satırı yazıldı ama eşleşmesi yazılamadı olabilecek satır sayısı (R-3): `yetim-tara` ile incelenmeli. */
  yetim_olabilir: number;
  hata: GuvenliHata | null;
};

function eslesmeGirdisiKur(k: PlanKaydi, karar: Extract<SahiplenmeKarari, { karar: 'YAZ' | 'SAHIPLEN' }>, durum: EslesmeDurumu, hedefId: string | null, g: YazGirdisi): EslesmeGirdisi {
  return {
    koleksiyon: k.koleksiyon,
    kaynak_id: k.kaynak_id,
    hedef_tablo: k.tablo,
    hedef_id: karar.karar === 'SAHIPLEN' ? karar.hedef_id : hedefId,
    hedef_ref: k.tablo === 'uygulama_durumu' ? k.kaynak_id : null,
    aktarim_id: g.aktarimId,
    dalga: g.plan.dalga,
    ekstra: { durum },
  };
}

/* Yazıcı hatası tabloyu kendisi bilir (YaziciHatasi.tablo); yoksa son işlenen tablo kullanılır. */
function hataTablosu(e: unknown): string | undefined {
  const t = typeof e === 'object' && e !== null ? (e as { tablo?: unknown }).tablo : undefined;
  return typeof t === 'string' ? t : undefined;
}

export async function yaz(g: YazGirdisi): Promise<YazSonucu> {
  /* 1) KAPI: onay uyuşmuyorsa yazıcı hiç kurulmaz. */
  if (!onayDogrula(g.plan, g.onay)) throw new KomutHatasi('ONAY_UYUSMADI');
  /* 2) Dalga b/c yazıcı yöntemleri henüz yok (T8/T10): yazıcı kurmadan dur. */
  if (g.plan.dalga !== 'a') throw new KomutHatasi('DALGA_YAZICI_YOK', { dalga: g.plan.dalga });

  const yigin = g.yiginBoyutu ?? VARSAYILAN_YIGIN;
  const kayitlar = g.plan.kayitlar();
  const yazilanSayilari = new Map<HedefTablo, number>();
  const sonuc: YazSonucu = {
    aktarim_id: g.aktarimId, dalga: g.plan.dalga, yazilan: [], sahiplenilen: 0, atlanan_eslesme: 0, belirsiz: 0, eslesme_yazilan: 0, yetim_olabilir: 0, hata: null,
  };
  /* Hedef satırı yazılmış ama eşleşmesi henüz yazılmamış satır sayısı (R-3 çökme penceresi). */
  let yazilmisEslesmesiz = 0;
  const bitir = (): YazSonucu => {
    sonuc.yetim_olabilir = yazilmisEslesmesiz;
    sonuc.yazilan = [...yazilanSayilari.entries()].map(([tablo, sayi]) => ({ tablo, sayi })).sort((a, b) => (a.tablo < b.tablo ? -1 : 1));
    return sonuc;
  };

  const yazici: Yazici = await g.yaziciKur();
  let sonTablo: string | undefined;
  try {
    const dizin = await eslesmeDiziniYukle(yazici);
    const uygulamalar = [...new Set(kayitlar.flatMap((k) => (k.tablo === 'uygulama_durumu' ? [k.uygulama] : [])))].sort();
    const mevcutAnahtarlar: Record<string, string[]> = {};
    for (const u of uygulamalar) mevcutAnahtarlar[u] = await yazici.uygulamaAnahtarlariOku(u);
    const begeniVar = kayitlar.some((k) => k.tablo === 'begeniler');
    const begeniler = begeniVar ? await yazici.begeniKodlariOku() : [];
    const hedef = hedefDurumuKur(mevcutAnahtarlar, begeniler);

    const bekleyenEslesme: (EslesmeKaydi & { yazildi: boolean })[] = [];
    const bekleyenBegeni: { kayit: BegeniPlanKaydi; karar: Extract<SahiplenmeKarari, { karar: 'YAZ' }> }[] = [];
    let islenen = 0;
    let sonIlerleme = 0;

    const sayArtir = (tablo: HedefTablo): void => void yazilanSayilari.set(tablo, (yazilanSayilari.get(tablo) ?? 0) + 1);

    const eslesmeBosalt = async (): Promise<void> => {
      if (bekleyenEslesme.length === 0) return;
      const grup = bekleyenEslesme.splice(0);
      sonTablo = 'aktarim_eslesme';
      await eslesmeKaydet(yazici, grup);
      sonuc.eslesme_yazilan += grup.length;
      yazilmisEslesmesiz -= grup.filter((x) => x.yazildi).length;
      /* İlerleme seyrek yazılır (çıktı gürültüsünü önler): her ~10 kayıtta bir ve bitişte. */
      if (islenen - sonIlerleme >= 10 || islenen === kayitlar.length) {
        sonIlerleme = islenen;
        ilerlemeYazdir({ asama: 'yazma', tamamlanan: islenen, toplam: kayitlar.length });
      }
    };

    const begeniBosalt = async (): Promise<void> => {
      if (bekleyenBegeni.length === 0) return;
      const grup = bekleyenBegeni.splice(0);
      sonTablo = 'begeniler';
      const eklenen = await yazici.satirEkle('begeniler', grup.map((x) => ({ ...x.kayit.satir })));
      /* Kimlikler `kod` ile eşlenir (yanıt sırası varsayılmaz). */
      const kimlikler = new Map(eklenen.map((e) => [e.kod, e.id]));
      yazilmisEslesmesiz += grup.length;
      for (const x of grup) {
        sayArtir('begeniler');
        const id = kimlikler.get(x.kayit.satir.kod) ?? null;
        bekleyenEslesme.push({
          mevcut: dizin.bul(x.kayit.koleksiyon, x.kayit.kaynak_id),
          girdi: eslesmeGirdisiKur(x.kayit, x.karar, 'yazildi', id, g),
          yazildi: true,
        });
      }
      await eslesmeBosalt();
    };

    for (const k of kayitlar) {
      islenen += 1;
      const karar = sahiplenmeKarariVer(k, dizin.aktifMi(k.koleksiyon, k.kaynak_id), hedef);
      if (karar.karar === 'ATLA') {
        sonuc.atlanan_eslesme += 1;
        continue;
      }
      if (karar.karar === 'BELIRSIZ') {
        /* Birden çok aday: otomatik birleştirme YOK. */
        sonuc.belirsiz += 1;
        continue;
      }
      if (karar.karar === 'SAHIPLEN') {
        sonuc.sahiplenilen += 1;
        bekleyenEslesme.push({ mevcut: dizin.bul(k.koleksiyon, k.kaynak_id), girdi: eslesmeGirdisiKur(k, karar, 'sahiplenildi', null, g), yazildi: false });
        if (bekleyenEslesme.length >= yigin) await eslesmeBosalt();
        continue;
      }
      /* YAZ */
      if (k.tablo === 'uygulama_durumu') {
        sonTablo = 'uygulama_durumu';
        /* Değer olduğu gibi (yeniden serileştirme yok, bayt sadakati). Eşleşme hemen ardından yazılır (çökme penceresi). */
        await yazici.uygulamaDurumuYaz(k.uygulama, k.anahtar, k.deger);
        sayArtir('uygulama_durumu');
        yazilmisEslesmesiz += 1;
        bekleyenEslesme.push({ mevcut: dizin.bul(k.koleksiyon, k.kaynak_id), girdi: eslesmeGirdisiKur(k, karar, 'yazildi', null, g), yazildi: true });
        await eslesmeBosalt();
      } else {
        bekleyenBegeni.push({ kayit: k, karar });
        if (bekleyenBegeni.length >= yigin) await begeniBosalt();
      }
    }
    await begeniBosalt();
    await eslesmeBosalt();
    return bitir();
  } catch (e) {
    /* İlk hatada dur: süzülmüş hata (kod/durum/tablo) + o ana kadarki sayılar. */
    sonuc.hata = hataGuvenli(e, hataTablosu(e) ?? sonTablo);
    return bitir();
  } finally {
    await yazici.kapat();
  }
}

/* Sonucu `cikti.ts` kapısından yazar: yalnız sayı ve kısa kodlar. */
export function yazSonucuYazdir(s: YazSonucu): void {
  olayYazdir({ tur: 'SONUC', kod: s.hata === null ? 'YAZ_TAMAM' : 'YAZ_YARIM', alanlar: { aktarim_id: s.aktarim_id, dalga: s.dalga } });
  for (const y of s.yazilan) olayYazdir({ tur: 'SONUC', kod: 'YAZILAN', alanlar: { tablo: y.tablo, sayi: y.sayi } });
  olayYazdir({
    tur: 'SONUC',
    kod: 'OZET',
    alanlar: { sahiplenilen: s.sahiplenilen, atlanan_eslesme: s.atlanan_eslesme, belirsiz: s.belirsiz, eslesme_yazilan: s.eslesme_yazilan, yetim_olabilir: s.yetim_olabilir },
  });
  if (s.hata !== null) olayYazdir({ tur: 'HATA', kod: 'YAZMA_DURDU', alanlar: { neden: s.hata.kod, durum: s.hata.durum ?? 0, tablo: s.hata.tablo ?? 'yok' } });
}
