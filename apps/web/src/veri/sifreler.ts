import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';
import { kayitGuncelle } from './kayit';

export type SifreHesabi = {
  id: string; surum: number; hizmet: string; kategori: string | null; adres: string | null;
  kullanici: string | null; notlar: string | null; sifre_var: boolean;
};
export type SifreGirdisi = {
  hizmet: string; kategori: string; adres: string; kullanici: string; sifre: string; notlar: string;
};

export async function sifreleriGetir(): Promise<SifreHesabi[]> {
  const { data, error } = await istemciAl().rpc('sifre_listele');
  if (error) throw error;
  return (data ?? []) as SifreHesabi[];
}

/* Şifre yalnız istenince çözülür; listede hiç taşınmaz. */
export async function sifreGoster(id: string): Promise<string> {
  const { data, error } = await istemciAl().rpc('sifre_goster', { p_id: id });
  if (error) throw error;
  return (data ?? '') as string;
}

/* id boşsa ekler; doluysa görülen sürümle günceller. Güncellemede şifre boşsa eski şifre kalır. */
export async function sifreKaydet(g: SifreGirdisi, mevcut?: { id: string; surum: number }): Promise<SifreHesabi> {
  const { data, error } = await istemciAl().rpc('sifre_kaydet', {
    p_id: mevcut?.id ?? null, p_surum: mevcut?.surum ?? null, p_hizmet: g.hizmet, p_kategori: g.kategori, p_adres: g.adres,
    p_kullanici: g.kullanici, p_sifre: g.sifre, p_not: g.notlar,
  });
  if (error) { if (error.code === '40001') throw new CakismaHatasi(); throw error; }
  return data as SifreHesabi;
}

export const sifreSil = (id: string, surum: number) => kayitGuncelle('sifre_hesaplari', [], id, surum, { silindi_at: new Date().toISOString() });
export const sifreGeriAl = (id: string, surum: number) => kayitGuncelle('sifre_hesaplari', [], id, surum, { silindi_at: null });
