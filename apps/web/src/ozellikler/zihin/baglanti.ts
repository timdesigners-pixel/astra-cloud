/* Bağlantı türü (YouTube, mağaza ürünü, genel sayfa), önizleme üst verisi ve görsel/dosya okuma. */
import { istemciAl } from '../../veri/istemci';

export const MAGAZA: Record<string, { ad: string; re: RegExp }> = {
  trendyol: { ad: 'Trendyol', re: /(^|\.)trendyol\.com$|(^|\.)ty\.gl$/ },
  hepsiburada: { ad: 'Hepsiburada', re: /(^|\.)hepsiburada\.com$|(^|\.)hb\.com\.tr$/ },
  n11: { ad: 'n11', re: /(^|\.)n11\.com$/ },
  pttavm: { ad: 'PTT AVM', re: /(^|\.)pttavm\.com$/ },
  gittigidiyor: { ad: 'GittiGidiyor', re: /(^|\.)gittigidiyor\.com$/ },
  amazon: { ad: 'Amazon', re: /(^|\.)amazon\.com\.tr$/ },
};
const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
export function magazaOf(url: string): string {
  const h = hostOf(url);
  for (const k in MAGAZA) if (MAGAZA[k]!.re.test(h)) return k;
  return '';
}
export function youtubeId(url: string): string {
  let u: URL; try { u = new URL(url); } catch { return ''; }
  const h = u.hostname.replace(/^(www|m|music)\./, '');
  let id = '';
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? '';
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/) || [])[1] || '';
  return /^[\w-]{11}$/.test(id) ? id : '';
}
export function bagTuru(url: string): 'youtube' | 'urun' | 'baglanti' {
  if (youtubeId(url)) return 'youtube';
  if (magazaOf(url)) return 'urun';
  return 'baglanti';
}
export const siteAdi = (url: string) => hostOf(url).replace(/^www\./, '');

export type Onizleme = {
  baslik?: string; aciklama?: string; gorsel?: string; site?: string; simge?: string;
  urun?: { fiyat?: number | null; para?: string; yorum?: number | null; puan?: number | null; marka?: string; magaza?: string };
};

/* Sunucu ucundan önizleme; ulaşılamazsa null (kart elle doldurulabilir). Uç, yalnız giriş yapmış kullanıcıya yanıt verir. */
export async function onizlemeGetir(url: string): Promise<Onizleme | null> {
  try {
    const { data } = await istemciAl().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return null;
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    const r = await fetch('/api/onizleme?url=' + encodeURIComponent(url), { headers: { Accept: 'application/json', Authorization: 'Bearer ' + jeton }, signal: ac.signal });
    clearTimeout(t);
    if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) return null;
    return await r.json() as Onizleme;
  } catch { return null; }
}

export const AZAMI_DOSYA = 10 * 1024 * 1024;
export const boyutYaz = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

/* Görseller en uzun kenarı 1600 px WebP/JPEG'e küçültülür (GIF ve diğerleri olduğu gibi). */
export async function gorselSikistir(f: File, azami = 1600, kalite = 0.82): Promise<Blob | File> {
  if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(f.type)) return f;
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const o = Math.min(1, azami / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * o); c.height = Math.round(img.naturalHeight * o);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const dene = (tur: string) => new Promise<Blob | null>(res => c.toBlob(res, tur, kalite));
    const w = await dene('image/webp');
    const sonuc = w && w.type === 'image/webp' ? w : await dene('image/jpeg');
    return sonuc && sonuc.size < f.size ? sonuc : f;
  } finally { URL.revokeObjectURL(url); }
}

/* Tarayıcıda doğrudan açılabilen türler; geri kalanı indirilir (etkin içerik uygulamanın kaynağında çalışmaz). */
export const GUVENLI_TUR = /^(image\/(png|jpe?g|webp|gif)|application\/pdf|text\/plain|text\/csv)$/;
