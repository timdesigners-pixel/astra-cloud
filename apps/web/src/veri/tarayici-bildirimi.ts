import { bugunAnahtari } from '../ortak/zaman';
import type { Bildirim } from './bildirim';

/* Tarayıcı bildirimi yalnız bu cihazın bir tercihidir; veri değildir. Aynı uyarı günde en fazla bir kez gönderilir. */
const GONDERILEN = 'astra.bildirim.gonderilen';

export const destekleniyor = () => typeof window !== 'undefined' && 'Notification' in window;
export const izinDurumu = (): NotificationPermission | 'unsupported' => (destekleniyor() ? Notification.permission : 'unsupported');

export async function izinIste(): Promise<NotificationPermission | 'unsupported'> {
  if (!destekleniyor()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

function goster(baslik: string, govde: string, etiket: string) {
  try { new Notification(baslik, { body: govde, tag: etiket, icon: '/logo-isaret.png' }); return true; } catch { return false; }
}

export const testGonder = () => goster('ASTRA FİNANS OS', 'Bildirimler bu cihazda çalışıyor.', 'astra-test');

function gonderilenleriOku(): { gun: string; anahtarlar: string[] } {
  try {
    const v = JSON.parse(localStorage.getItem(GONDERILEN) ?? 'null') as { gun?: string; anahtarlar?: string[] } | null;
    if (v && v.gun === bugunAnahtari() && Array.isArray(v.anahtarlar)) return { gun: v.gun, anahtarlar: v.anahtarlar };
  } catch { /* bozuk kayıt yok sayılır */ }
  return { gun: bugunAnahtari(), anahtarlar: [] };
}

/* Yalnız acil olan ve henüz bildirilmemiş uyarılar. En çok üç bildirim: telefon bildirim çekmecesi dolmasın. */
export function acilleriGonder(liste: Bildirim[]) {
  if (izinDurumu() !== 'granted') return 0;
  const durum = gonderilenleriOku();
  const yeni = liste.filter(b => b.acil && !durum.anahtarlar.includes(b.anahtar)).slice(0, 3);
  yeni.forEach(b => {
    if (goster(`${b.ikon} ${b.baslik}`, `${b.rozet}${b.tutar ? ' · ' + b.tutar.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }) : ''}`, b.anahtar)) durum.anahtarlar.push(b.anahtar);
  });
  try { localStorage.setItem(GONDERILEN, JSON.stringify(durum)); } catch { /* yazılamazsa tekrar gönderilebilir */ }
  return yeni.length;
}
