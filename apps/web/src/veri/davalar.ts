import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';
import { kayitGuncelle } from './kayit';

export type DavaTuru = 'ceza' | 'hukuk' | 'cbs';
export type Dava = {
  id: string; surum: number; tur: DavaTuru; dosya_no: string; mahkeme: string | null; konu: string | null; asama: string | null;
  durum: 'acik' | 'kapandi'; dava_degeri: number | null; sonraki_durusma: string | null; avukat_id: string | null;
  karsi_taraf: string | null; icra_id: string | null; acilis_tarihi: string | null; notlar: string | null;
};
export type DavaGirdisi = Omit<Dava, 'id' | 'surum' | 'tur' | 'dosya_no'>;

export async function davalariGetir(tur: DavaTuru): Promise<Dava[]> {
  const { data, error } = await istemciAl().rpc('davalar_listele', { p_tur: tur });
  if (error) throw error;
  return (data ?? []) as Dava[];
}

/* id boşsa ekler; doluysa görülen sürümle günceller (çakışırsa CakismaHatasi). */
export async function davaKaydet(tur: DavaTuru, dosyaNo: string, g: DavaGirdisi, mevcut?: { id: string; surum: number }): Promise<Dava> {
  const { data, error } = await istemciAl().rpc('dava_kaydet', {
    p_id: mevcut?.id ?? null, p_surum: mevcut?.surum ?? null, p_tur: tur, p_dosya_no: dosyaNo, p_alanlar: g,
  });
  if (error) { if (error.code === '40001') throw new CakismaHatasi(); throw error; }
  return data as Dava;
}

const SILME_SUTUN = ['tur'];
export const davaSil = (id: string, surum: number) => kayitGuncelle('davalar', SILME_SUTUN, id, surum, { silindi_at: new Date().toISOString() });
export const davaGeriAl = (id: string, surum: number) => kayitGuncelle('davalar', SILME_SUTUN, id, surum, { silindi_at: null });
