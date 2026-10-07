import type { Kayit } from '../../veri/kayit';

const sayi = (v: unknown) => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? 0 : Number(v));

export const ayAnahtari = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const ayKaydir = (ay: string, n: number) => { const [y, m] = ay.split('-').map(Number); return ayAnahtari(new Date(y!, m! - 1 + n, 1)); };
export const ayAdi = (ay: string) => { const [y, m] = ay.split('-').map(Number); return new Date(y!, m! - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); };
export const sonAylar = (ay: string, adet: number) => Array.from({ length: adet }, (_, i) => ayKaydir(ay, i - adet + 1));

const ayBasi = (ay: string) => `${ay}-01`;
const aySonu = (ay: string) => `${ay}-31`;
const aydami = (t: unknown, ay: string) => typeof t === 'string' && t.slice(0, 7) === ay;

/* Süresi bu aya denk gelen kayıt mı (başlangıç ve bitiş tarihleri boş olabilir). */
const gecerli = (k: Kayit, ay: string, bas: string, bit: string) =>
  k.aktif !== false && (!k[bas] || String(k[bas]) <= aySonu(ay)) && (!k[bit] || String(k[bit]) >= ayBasi(ay));

const aylikTutar = (k: Kayit) => {
  const t = sayi(k.tutar);
  return k.periyot === 'yillik' ? t / 12 : k.periyot === 'uc_aylik' ? t / 3 : k.periyot === 'tek_sefer' ? 0 : t;
};

export type GelirAy = { sabit: Map<string, number>; ekstra: Map<string, number>; alinanBorc: number; sabitToplam: number; ekstraToplam: number; toplam: number };

export function gelirAyi(gelirler: Kayit[], ay: string): GelirAy {
  const sabit = new Map<string, number>(), ekstra = new Map<string, number>();
  let alinanBorc = 0;
  for (const k of gelirler) {
    const tur = String(k.tur);
    if (k.sabit === true) {
      if (!gecerli(k, ay, 'baslangic', 'bitis')) continue;
      sabit.set(tur, (sabit.get(tur) ?? 0) + aylikTutar(k));
    } else if (aydami(k.baslangic, ay)) {
      if (tur === 'alinan_borc') alinanBorc += sayi(k.tutar);
      else ekstra.set(tur, (ekstra.get(tur) ?? 0) + sayi(k.tutar));
    }
  }
  const topla = (m: Map<string, number>) => [...m.values()].reduce((t, v) => t + v, 0);
  const sabitToplam = topla(sabit), ekstraToplam = topla(ekstra);
  return { sabit, ekstra, alinanBorc, sabitToplam, ekstraToplam, toplam: sabitToplam + ekstraToplam };
}

export type GiderAy = { sabit: Map<string, number>; sabitToplam: number; market: number; borcOdemesi: number; alinanlar: number; toplam: number; dovizli: number };

export function giderAyi(giderler: Kayit[], fisler: Kayit[], hareketler: Kayit[], ay: string): GiderAy {
  const sabit = new Map<string, number>();
  let dovizli = 0;
  for (const k of giderler) {
    if ((k.para_birimi ?? 'TRY') !== 'TRY') { if (k.aktif !== false && (k.periyot !== 'tek_sefer' || aydami(k.baslangic, ay))) dovizli++; continue; }
    if (k.periyot === 'tek_sefer') { if (k.aktif !== false && aydami(k.baslangic, ay)) sabit.set('tek_sefer', (sabit.get('tek_sefer') ?? 0) + sayi(k.tutar)); continue; }
    if (!gecerli(k, ay, 'baslangic', 'bitis')) continue;
    const tur = String(k.tur);
    sabit.set(tur, (sabit.get(tur) ?? 0) + aylikTutar(k));
  }
  const sabitToplam = [...sabit.values()].reduce((t, v) => t + v, 0);
  const market = fisler.filter(f => aydami(f.tarih, ay)).reduce((t, f) => t + sayi(f.toplam), 0);
  const cikis = (tur: string) => hareketler.filter(h => h.yon === 'cikis' && h.tur === tur && aydami(h.tarih, ay)).reduce((t, h) => t + sayi(h.tutar), 0);
  const borcOdemesi = cikis('odeme'), alinanlar = cikis('gider');
  return { sabit, sabitToplam, market, borcOdemesi, alinanlar, toplam: sabitToplam + market + borcOdemesi + alinanlar, dovizli };
}
