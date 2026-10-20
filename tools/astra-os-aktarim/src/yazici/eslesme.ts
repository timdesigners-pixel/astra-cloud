/* `aktarim_eslesme` yardımcıları. İzin verilen hedef tablo listesi BURADA (uygulama katmanında) denetlenir; migration 0027 yalnız biçim denetler
   (yeni hedef tablo için yeni migration gerekmesin diye). Eşleşme kayıt DEĞERİ taşımaz: yalnız opak kimlikler ve kodlar. */
import { HEDEF_TABLOLARI } from '../plan/plan-tipleri.ts';
import type { EslesmeGirdisi, EslesmeSatiri, EslesmeSorgusu, Yazici } from './yazici-arayuzu.ts';

export type EslesmeHataKodu = 'HEDEF_TABLO_IZINSIZ' | 'KOLEKSIYON_GECERSIZ' | 'KAYNAK_ID_GECERSIZ' | 'HEDEF_YOK' | 'DALGA_GECERSIZ' | 'AKTARIM_ID_GECERSIZ';

/* Hata yalnız kod taşır; girdi değeri (kaynak_id, ref) mesaja girmez. */
export class EslesmeHatasi extends Error {
  kod: EslesmeHataKodu;

  constructor(kod: EslesmeHataKodu) {
    super(`ESLESME_HATASI ${kod}`);
    this.name = 'EslesmeHatasi';
    this.kod = kod;
  }
}

const KOLEKSIYON_DESENI = /^[a-z_]{2,40}$/;
const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function hedefTabloIzinliMi(tablo: string): boolean {
  return (HEDEF_TABLOLARI as readonly string[]).includes(tablo);
}

/* Yazmadan önce çağrılır: migration CHECK'lerinin uygulama tarafı aynası + izin listesi. */
export function eslesmeGirdisiDogrula(g: EslesmeGirdisi): void {
  if (!hedefTabloIzinliMi(g.hedef_tablo)) throw new EslesmeHatasi('HEDEF_TABLO_IZINSIZ');
  if (!KOLEKSIYON_DESENI.test(g.koleksiyon)) throw new EslesmeHatasi('KOLEKSIYON_GECERSIZ');
  if (typeof g.kaynak_id !== 'string' || g.kaynak_id.length < 1 || g.kaynak_id.length > 200) throw new EslesmeHatasi('KAYNAK_ID_GECERSIZ');
  if (g.hedef_id === null && (g.hedef_ref === null || g.hedef_ref.length > 260)) throw new EslesmeHatasi('HEDEF_YOK');
  if (g.hedef_id !== null && !UUID_DESENI.test(g.hedef_id)) throw new EslesmeHatasi('HEDEF_YOK');
  if (g.dalga !== 'a' && g.dalga !== 'b' && g.dalga !== 'c') throw new EslesmeHatasi('DALGA_GECERSIZ');
  if (!UUID_DESENI.test(g.aktarim_id)) throw new EslesmeHatasi('AKTARIM_ID_GECERSIZ');
}

export function eslesmeAnahtari(koleksiyon: string, kaynak_id: string): string {
  return `${koleksiyon}\u0000${kaynak_id}`;
}

/* (koleksiyon, kaynak_id) → eşleşme. Silinmiş (geri alınmış) eşleşmeler de dizindedir; `aktifMi` ile ayrılır. */
export type EslesmeDizini = {
  bul(koleksiyon: string, kaynak_id: string): EslesmeSatiri | undefined;
  aktifMi(koleksiyon: string, kaynak_id: string): boolean;
  hepsi(): readonly EslesmeSatiri[];
};

export function eslesmeDiziniKur(satirlar: readonly EslesmeSatiri[]): EslesmeDizini {
  const harita = new Map<string, EslesmeSatiri>();
  for (const s of satirlar) harita.set(eslesmeAnahtari(s.koleksiyon, s.kaynak_id), s);
  return {
    bul: (k, id) => harita.get(eslesmeAnahtari(k, id)),
    aktifMi: (k, id) => {
      const s = harita.get(eslesmeAnahtari(k, id));
      return s !== undefined && s.silindi_at === null;
    },
    hepsi: () => satirlar,
  };
}

export async function eslesmeDiziniYukle(yazici: Yazici, sorgu?: EslesmeSorgusu): Promise<EslesmeDizini> {
  return eslesmeDiziniKur(await yazici.eslesmeOku(sorgu));
}

export type EslesmeKaydi = { mevcut: EslesmeSatiri | undefined; girdi: EslesmeGirdisi };

/* Eşleşme yazar: yeni (kaynak,koleksiyon,kaynak_id) → tek toplu insert; geri alınmış eşleşme varsa AYNI satır güncellenip canlandırılır
   (tekil indeks kısmi değildir, plan §3.5). Hedefteki kayıt satırına dokunmaz. */
export async function eslesmeKaydet(yazici: Yazici, kayitlar: readonly EslesmeKaydi[]): Promise<void> {
  for (const k of kayitlar) eslesmeGirdisiDogrula(k.girdi);
  const yeniler = kayitlar.filter((k) => k.mevcut === undefined).map((k) => k.girdi);
  if (yeniler.length > 0) await yazici.eslesmeEkle(yeniler);
  for (const k of kayitlar) {
    if (k.mevcut === undefined) continue;
    await yazici.eslesmeGuncelle(k.mevcut.id, {
      hedef_id: k.girdi.hedef_id,
      hedef_ref: k.girdi.hedef_ref,
      aktarim_id: k.girdi.aktarim_id,
      dalga: k.girdi.dalga,
      silindi_at: null,
      ekstra: k.girdi.ekstra,
    });
  }
}
