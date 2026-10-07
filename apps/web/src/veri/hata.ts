export class CakismaHatasi extends Error {
  constructor() { super('kayıt başka yerde değişmiş'); }
}

/* Kullanıcıya gösterilecek Türkçe hata metni. */
export function hataMetni(e: unknown): string {
  if (e instanceof CakismaHatasi) return 'Bu kayıt başka bir yerde değişmiş. Liste yenilendi, tekrar dene.';
  const k = (e ?? {}) as { code?: string; message?: string };
  if (k.code === '23505') return 'Bu kayıt zaten var.';
  if (k.code === '23503') return 'Bağlı kayıt bulunamadı.';
  if (k.code === '22023') return k.message ?? 'Girilen değer geçersiz.';
  if (k.code === '23514') return 'Girilen değer izin verilen sınırların dışında.';
  if (k.code === '42501' || k.code === 'PGRST301' || /jwt/i.test(k.message ?? '')) return 'Oturum süresi doldu. Sayfayı yenileyip PIN\'i yeniden gir.';
  if (e instanceof TypeError || /fetch|network/i.test(k.message ?? '')) return 'Bağlantı yok. Kayıt yazılamadı.';
  return 'İşlem yapılamadı.';
}
