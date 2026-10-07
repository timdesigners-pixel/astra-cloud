import { istemciAl } from './istemci';
import { kayitlariGetir, type Kayit } from './kayit';

export type Fis = { id: string; surum: number; market: string; tarih: string; toplam: number; hesap_id: string | null; notlar: string | null };
export type FisKalemi = { id: string; fis_id: string; urun_id: string; miktar: number; birim_fiyat: number; tutar: number };
export type Urun = { id: string; surum: number; ad: string; birim: string; kategori: string | null; stok_miktari: number; asgari_stok: number; son_kullanma: string | null };
export type YeniKalem = { ad: string; miktar: number; birim_fiyat: number; birim: string; urun_id?: string };

export const fisleriGetir = async () => (await kayitlariGetir('fisler', ['market', 'tarih', 'toplam', 'hesap_id', 'notlar'], {}, 'tarih')) as unknown as Fis[];
export const kalemleriGetir = async () => (await kayitlariGetir('fis_kalemleri', ['fis_id', 'urun_id', 'miktar', 'birim_fiyat', 'tutar'], {}, 'olusturma')) as unknown as FisKalemi[];
export const urunleriGetir = async () => (await kayitlariGetir('urunler', ['ad', 'birim', 'kategori', 'stok_miktari', 'asgari_stok', 'son_kullanma'], {}, 'ad')) as unknown as Urun[];
export type { Kayit };

export async function fisKaydet(market: string, tarih: string, hesapId: string | null, notlar: string | null, kalemler: YeniKalem[]): Promise<string> {
  const { data, error } = await istemciAl().rpc('fis_kaydet', { p_market: market, p_tarih: tarih, p_hesap_id: hesapId, p_notlar: notlar, p_kalemler: kalemler });
  if (error) throw error;
  return data as string;
}

export async function fisSil(id: string) {
  const { error } = await istemciAl().rpc('fis_sil', { p_fis_id: id });
  if (error) throw error;
}
