/* R-3 yetim tarama: hedefte satır var ama eşleşmesi yok (yazma ile eşleşme arasında çökme). Yalnız `begeniler` taranır; `uygulama_durumu` anahtarlarının
   kullanıcı verisinden ayırt edilebilir izi olmadığı için taranamaz (bu yüzden o tarafta "yaz" zaten okuma-yaz-yoksa çalışır).
   `--baslangic` verilirse yalnız o andan sonra oluşturulan satırlar adaydır (kullanıcının eski kayıtları yetim sayılmaz).
   `--yetim-temizle` ONAYLIDIR (ONAY-yetim-...) ve `--baslangic` ister; yalnız soft delete yapar, ardından `yaz` satırı yeniden oluşturur. */
import { olayYazdir } from '../cikti.ts';
import { hataGuvenli, type GuvenliHata } from '../guvenlik/sir-koruma.ts';
import type { YaziciFabrikasi } from '../yazici/yazici-arayuzu.ts';
import { onayEsitMi, YETIM_ONAY_DESENI, yetimOnayKodu } from './geri-al-hesap.ts';
import { KomutHatasi } from './komut-hata.ts';

export type YetimTaraGirdisi = {
  baslangic?: string;
  temizle: boolean;
  onay?: string;
  hedefRef: string;
  yaziciKur: YaziciFabrikasi;
};

export type YetimTaraSonucu = { taranan: number; yetim: number; onay_kodu: string; temizlenen: number; hata: GuvenliHata | null };

export async function yetimTara(g: YetimTaraGirdisi): Promise<YetimTaraSonucu> {
  const yazici = await g.yaziciKur();
  const sonuc: YetimTaraSonucu = { taranan: 0, yetim: 0, onay_kodu: '', temizlenen: 0, hata: null };
  try {
    const esik = g.baslangic !== undefined ? Date.parse(g.baslangic) : null;
    const eslesmeler = await yazici.eslesmeOku();
    /* Silinmiş eşleşmenin hedefi de "eşleşmiş" sayılır. */
    const eslesmisler = new Set(eslesmeler.flatMap((e) => (e.hedef_id !== null ? [e.hedef_id] : [])));
    const begeniler = await yazici.begeniKodlariOku();
    const adaylar = begeniler.filter((b) => esik === null || (b.olusturma !== null && Date.parse(b.olusturma) >= esik));
    sonuc.taranan = adaylar.length;
    const yetimler = adaylar.filter((b) => !eslesmisler.has(b.id));
    sonuc.yetim = yetimler.length;
    sonuc.onay_kodu = yetimOnayKodu({ hedefRef: g.hedefRef, idler: yetimler.map((y) => y.id), baslangic: g.baslangic ?? '' });
    if (!g.temizle || yetimler.length === 0) return sonuc;
    if (!onayEsitMi(sonuc.onay_kodu, YETIM_ONAY_DESENI, g.onay)) throw new KomutHatasi('ONAY_UYUSMADI');
    await yazici.satirGizle('begeniler', yetimler.map((y) => y.id));
    sonuc.temizlenen = yetimler.length;
    return sonuc;
  } catch (e) {
    if (e instanceof KomutHatasi) throw e;
    const t = typeof e === 'object' && e !== null ? (e as { tablo?: unknown }).tablo : undefined;
    sonuc.hata = hataGuvenli(e, typeof t === 'string' ? t : undefined);
    return sonuc;
  } finally {
    await yazici.kapat();
  }
}

export function yetimTaraSonucuYazdir(s: YetimTaraSonucu, temizle: boolean): void {
  olayYazdir({ tur: 'SONUC', kod: 'YETIM_TARAMA', alanlar: { taranan: s.taranan, yetim: s.yetim } });
  if (s.yetim > 0 && !temizle) olayYazdir({ tur: 'BILGI', kod: 'YETIM_ONAY_KODU', alanlar: { onay_kodu: s.onay_kodu } });
  if (temizle) olayYazdir({ tur: 'SONUC', kod: 'YETIM_TEMIZLENDI', alanlar: { temizlenen: s.temizlenen } });
  if (s.hata !== null) olayYazdir({ tur: 'HATA', kod: 'YETIM_TARA_DURDU', alanlar: { neden: s.hata.kod, durum: s.hata.durum ?? 0, tablo: s.hata.tablo ?? 'yok' } });
}
