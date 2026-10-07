import { CakismaHatasi } from './hata';
import { ayarOku, ayarYaz } from './karsilama';
import { bugunAnahtari } from '../ortak/zaman';
import type { Bildirim } from './bildirim';

/* Okundu ve kaldırıldı işaretleri "ayarlar" tablosunda tek satırda durur: cihazlar arasında ortaktır.
   Anahtar vadeyi de içerir; aylık tekrarlayan bir uyarıyı bu ay kaldırmak gelecek ayınkini susturmaz. */
type Durum = { okundu: Record<string, string>; gizli: Record<string, string> };
const ANAHTAR = 'bildirim_durum';
let durum: Durum = { okundu: {}, gizli: {} };
let yuklu: Promise<Durum> | null = null;
let yazma: Promise<void> = Promise.resolve();

export function durumYukle(zorla = false): Promise<Durum> {
  if (yuklu && !zorla) return yuklu;
  const p = ayarOku<Partial<Durum>>(ANAHTAR).then(a => {
    durum = { okundu: { ...(a?.deger?.okundu ?? {}) }, gizli: { ...(a?.deger?.gizli ?? {}) } };
    return durum;
  });
  yuklu = p;
  p.catch(() => { if (yuklu === p) yuklu = null; });
  return p;
}

function kaydet(): Promise<void> {
  yazma = yazma.then(async () => {
    for (let n = 0; n < 2; n++) {
      try { await ayarYaz(ANAHTAR, durum); return; }
      catch (e) {
        if (!(e instanceof CakismaHatasi)) throw e;
        /* Başka cihaz yazmış: onun değişikliklerini alıp bizimkini üstüne koy. */
        const eski = durum;
        const son = await ayarOku<Partial<Durum>>(ANAHTAR);
        durum = { okundu: { ...(son?.deger?.okundu ?? {}), ...eski.okundu }, gizli: { ...(son?.deger?.gizli ?? {}), ...eski.gizli } };
      }
    }
  }).catch(() => { /* ağ yoksa işaret bu oturumda geçerli kalır */ });
  return yazma;
}

export const okunduMu = (b: Bildirim) => !!durum.okundu[b.anahtar];
export const gizliMi = (b: Bildirim) => !!durum.gizli[b.anahtar];
export const gorunenler = (l: Bildirim[]) => l.filter(b => !gizliMi(b));
export const okunmamislar = (l: Bildirim[]) => gorunenler(l).filter(b => !okunduMu(b));
export const gizliSayisi = (l: Bildirim[]) => l.filter(gizliMi).length;

export function okunduYaz(b: Bildirim, okundu: boolean) {
  if (okundu) durum.okundu[b.anahtar] = bugunAnahtari(); else delete durum.okundu[b.anahtar];
  return kaydet();
}
export function tumunuOkunduYap(l: Bildirim[]) {
  gorunenler(l).forEach(b => { durum.okundu[b.anahtar] = bugunAnahtari(); });
  return kaydet();
}
export function okunanlariSifirla() { durum.okundu = {}; return kaydet(); }

/* Artık üretilmeyen uyarıların işaretleri birikmesin diye her kaldırmada liste güncel uyarılarla budanır. */
export function gizle(b: Bildirim, hepsi: Bildirim[]) {
  const canli = new Set(hepsi.map(x => x.anahtar));
  durum.gizli = Object.fromEntries(Object.entries(durum.gizli).filter(([k]) => canli.has(k)));
  durum.gizli[b.anahtar] = bugunAnahtari();
  return kaydet();
}
export function gizlenenleriGeriGetir() { durum.gizli = {}; return kaydet(); }
