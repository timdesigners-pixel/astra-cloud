import { istemciAl } from './istemci';

export type UygulamaKaydi = Record<string, string>;

export async function uygulamaDurumuOku(uygulama: string): Promise<UygulamaKaydi> {
  const { data, error } = await istemciAl().rpc('uygulama_durumu_oku', { p_uygulama: uygulama });
  if (error) throw error;
  return (data ?? {}) as UygulamaKaydi;
}

export async function uygulamaDurumuYaz(uygulama: string, anahtar: string, deger: string) {
  const { error } = await istemciAl().rpc('uygulama_durumu_yaz', { p_uygulama: uygulama, p_anahtar: anahtar, p_deger: deger });
  if (error) throw error;
}

/* anahtar boşsa uygulamanın tüm kayıtları silinir */
export async function uygulamaDurumuSil(uygulama: string, anahtar: string | null) {
  const { error } = await istemciAl().rpc('uygulama_durumu_sil', { p_uygulama: uygulama, p_anahtar: anahtar });
  if (error) throw error;
}
