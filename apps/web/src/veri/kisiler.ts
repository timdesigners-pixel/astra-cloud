import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';

export type KisiTuru = 'kisi' | 'kurum' | 'firma';
export type AltTur = 'banka' | 'vergi_dairesi' | 'sgk' | 'icra_dairesi' | 'avukat' | 'mahkeme' | 'diger';

export type Kisi = {
  id: string;
  surum: number;
  ad: string;
  tur: KisiTuru;
  alt_tur: AltTur | null;
  takma_adlar: string[];
  telefon: string | null;
  notlar: string | null;
};
export type KisiGirdisi = Omit<Kisi, 'id' | 'surum'>;

const KOLON = 'id,surum,ad,tur,alt_tur,takma_adlar,telefon,notlar';

export async function kisileriGetir(): Promise<Kisi[]> {
  const { data, error } = await istemciAl().from('kisiler').select(KOLON).is('silindi_at', null).order('ad');
  if (error) throw error;
  return (data ?? []) as Kisi[];
}

export async function kisiEkle(g: KisiGirdisi): Promise<Kisi> {
  const { data, error } = await istemciAl().from('kisiler').insert(g).select(KOLON).single();
  if (error) throw error;
  return data as Kisi;
}

/* İyimser kilit: yalnız görülen sürüm hâlâ güncelse yazılır. */
export async function kisiGuncelle(id: string, surum: number, g: Partial<KisiGirdisi & { silindi_at: string | null }>): Promise<Kisi> {
  const { data, error } = await istemciAl().from('kisiler').update(g).eq('id', id).eq('surum', surum).select(KOLON);
  if (error) throw error;
  if (!data || data.length === 0) throw new CakismaHatasi();
  return data[0] as Kisi;
}

/* Silme yumuşaktır: kayıt kalır, silindi_at dolar; geri alınabilir. */
export const kisiSil = (id: string, surum: number) => kisiGuncelle(id, surum, { silindi_at: new Date().toISOString() });
export const kisiGeriAl = (id: string, surum: number) => kisiGuncelle(id, surum, { silindi_at: null });
