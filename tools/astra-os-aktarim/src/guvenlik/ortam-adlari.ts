/* Kimlik bilgisi ortam değişkenlerinin ADLARI (değerleri değil). Değerler yalnız `ayar.ts` içinde okunur. */
export const ORTAM_SUPABASE_URL = 'ASTRA_SUPABASE_URL';
export const ORTAM_SUPABASE_ANON = 'ASTRA_SUPABASE_ANON';
export const ORTAM_PIN = 'ASTRA_PIN';
export const ORTAM_SERVIS_ANAHTARI = 'ASTRA_SERVIS_ANAHTARI';

export const ORTAM_ADLARI = [ORTAM_SUPABASE_URL, ORTAM_SUPABASE_ANON, ORTAM_PIN, ORTAM_SERVIS_ANAHTARI] as const;
export type OrtamAdi = (typeof ORTAM_ADLARI)[number];
