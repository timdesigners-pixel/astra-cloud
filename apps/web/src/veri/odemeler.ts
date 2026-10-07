import { istemciAl } from './istemci';
import { kayitGuncelle, kayitlariGetir, type Kayit } from './kayit';

export type Odeme = {
  id: string; surum: number; borc_id: string; hesap_id: string | null; vade_tarihi: string; tutar: number;
  durum: 'bekliyor' | 'odendi' | 'iptal'; odeme_tarihi: string | null; notlar: string | null;
};
export type OdemeBorcu = {
  id: string; tur: string; ad: string; yon: string; durum: string; guncel_borc: number; alacakli_id: string | null; hesap_id: string | null;
};

const ODEME_SUTUN = ['borc_id', 'hesap_id', 'vade_tarihi', 'tutar', 'durum', 'odeme_tarihi', 'notlar'];
const BORC_SUTUN = ['tur', 'ad', 'yon', 'durum', 'guncel_borc', 'alacakli_id', 'hesap_id'];

export const odemeSutunlari = ODEME_SUTUN;

export const odemeleriGetir = async () => (await kayitlariGetir('odemeler', ODEME_SUTUN, {}, 'vade_tarihi')) as unknown as Odeme[];
export const odemeBorclariniGetir = async () => (await kayitlariGetir('borclar', BORC_SUTUN, {}, 'ad')) as unknown as OdemeBorcu[];

export async function odemeleriEkle(satirlar: { borc_id: string; hesap_id: string | null; vade_tarihi: string; tutar: number; notlar: string | null }[]): Promise<Odeme[]> {
  const { data, error } = await istemciAl().from('odemeler').insert(satirlar).select(['id', 'surum', ...ODEME_SUTUN].join(','));
  if (error) throw error;
  return (data ?? []) as unknown as Odeme[];
}

export const odemeGuncelle = (id: string, surum: number, g: Record<string, unknown>) =>
  kayitGuncelle('odemeler', ODEME_SUTUN, id, surum, g) as Promise<Kayit> as unknown as Promise<Odeme>;

export async function odemeIsaretle(id: string, hesapId: string, tarih: string) {
  const { error } = await istemciAl().rpc('odeme_isaretle', { p_odeme_id: id, p_hesap_id: hesapId, p_tarih: tarih });
  if (error) throw error;
}

export async function odemeGeriAl(id: string) {
  const { error } = await istemciAl().rpc('odeme_geri_al', { p_odeme_id: id });
  if (error) throw error;
}

export async function alinacakAlindi(id: string, hesapId: string, tutar: number, tarih: string) {
  const { error } = await istemciAl().rpc('alinacak_alindi', { p_id: id, p_hesap_id: hesapId, p_tutar: tutar, p_tarih: tarih });
  if (error) throw error;
}

export async function alinacakGeriAl(id: string) {
  const { error } = await istemciAl().rpc('alinacak_geri_al', { p_id: id });
  if (error) throw error;
}
