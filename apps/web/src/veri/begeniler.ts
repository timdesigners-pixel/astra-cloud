import { kayitEkle, kayitGuncelle, kayitlariGetir } from './kayit';

export type Oncelik = 'high' | 'medium' | 'low';
export type Begeni = {
  id: string; surum: number; kod: string | null; kategori: string; ad: string; resim: string | null;
  rozet: { cls?: string; text?: string } | null; fiyat: number | null; fiyat_etiketi: string | null;
  ozellikler: [string, string][]; notlar: string | null; baglantilar: { url: string; label: string }[];
  oncelik: Oncelik; favori: boolean; puan: number | null; hedef_fiyat: number | null;
  fiyat_gecmisi: { date: string; price: number }[]; ilk_fiyat: number | null; olusturma: string;
};
export type BegeniGirdisi = Omit<Begeni, 'id' | 'surum' | 'kod' | 'olusturma' | 'rozet'> & { baglanti: string | null };

const SUTUN = ['kod', 'kategori', 'ad', 'resim', 'rozet', 'fiyat', 'fiyat_etiketi', 'ozellikler', 'notlar', 'baglantilar', 'oncelik', 'favori', 'puan', 'hedef_fiyat', 'fiyat_gecmisi', 'ilk_fiyat', 'olusturma'];

const sayiya = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const duzelt = (k: Record<string, unknown>): Begeni => ({
  ...(k as unknown as Begeni), fiyat: sayiya(k.fiyat), hedef_fiyat: sayiya(k.hedef_fiyat), ilk_fiyat: sayiya(k.ilk_fiyat),
  ozellikler: (k.ozellikler as [string, string][]) ?? [], baglantilar: (k.baglantilar as Begeni['baglantilar']) ?? [],
  fiyat_gecmisi: ((k.fiyat_gecmisi as Begeni['fiyat_gecmisi']) ?? []).map(x => ({ date: x.date, price: Number(x.price) })),
});

export async function begenileriGetir(): Promise<Begeni[]> {
  return (await kayitlariGetir('begeniler', SUTUN, {}, 'olusturma')).map(duzelt);
}
export async function begeniEkle(g: BegeniGirdisi): Promise<Begeni> { return duzelt(await kayitEkle('begeniler', SUTUN, g)); }
export async function begeniGuncelle(id: string, surum: number, g: Partial<BegeniGirdisi>): Promise<Begeni> {
  return duzelt(await kayitGuncelle('begeniler', SUTUN, id, surum, g));
}
export const begeniSil = (id: string, surum: number) => kayitGuncelle('begeniler', [], id, surum, { silindi_at: new Date().toISOString() });
export const begeniGeriAl = (id: string, surum: number) => kayitGuncelle('begeniler', [], id, surum, { silindi_at: null });
