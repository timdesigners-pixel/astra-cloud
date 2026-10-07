import { istemciAl } from './istemci';
import { kayitGuncelle } from './kayit';

export type Iban = {
  id: string; surum: number; sahip_turu: 'kendim' | 'kisi'; kisi_id: string | null;
  etiket: string | null; banka: string | null; iban: string;
};

export async function ibanlariGetir(): Promise<Iban[]> {
  const { data, error } = await istemciAl().rpc('iban_listele');
  if (error) throw error;
  return (data ?? []) as Iban[];
}

export async function ibanEkle(sahipTuru: 'kendim' | 'kisi', kisiId: string | null, etiket: string, banka: string, iban: string): Promise<string> {
  const { data, error } = await istemciAl().rpc('iban_ekle', {
    p_sahip_turu: sahipTuru, p_kisi_id: kisiId, p_etiket: etiket, p_banka: banka, p_iban: iban,
  });
  if (error) throw error;
  return data as string;
}

/* IBAN numarasının kendisi değişmez; etiket ve banka güncellenir. */
export const ibanGuncelle = (id: string, surum: number, g: { etiket: string | null; banka: string | null }) =>
  kayitGuncelle('ibanlar', [], id, surum, g);
export const ibanSil = (id: string, surum: number) => kayitGuncelle('ibanlar', [], id, surum, { silindi_at: new Date().toISOString() });
export const ibanGeriAl = (id: string, surum: number) => kayitGuncelle('ibanlar', [], id, surum, { silindi_at: null });
