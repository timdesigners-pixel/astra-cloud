/* Görsel ve belgeler Supabase Storage'daki özel "zihin" deposunda, kullanıcı kimliği klasörü altında tutulur. */
import { istemciAl } from '../../veri/istemci';
import { AZAMI_DOSYA, GUVENLI_TUR, boyutYaz, gorselSikistir } from './baglanti';

export type Yuklenen = { yol: string; ad: string; tur: string; boyut: number };
const SKT = 55 * 60;
const onbellek = new Map<string, { url: string; bitis: number }>();

const guvenliAd = (ad: string) => {
  const nokta = ad.lastIndexOf('.');
  const uzanti = nokta > 0 ? ad.slice(nokta + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const govde = (nokta > 0 ? ad.slice(0, nokta) : ad).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dosya';
  return uzanti ? `${govde}.${uzanti}` : govde;
};

async function sahipId(): Promise<string> {
  const { data } = await istemciAl().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('oturum yok');
  return id;
}

/** Dosyayı yükler; görseller yüklemeden önce küçültülür. Sınır aşılırsa Error('boyut:…') atar. */
export async function dosyaYukle(f: File, gorsel = false): Promise<Yuklenen> {
  const veri = gorsel ? await gorselSikistir(f) : f;
  if (veri.size > AZAMI_DOSYA) throw new Error(`boyut:${f.name} ${boyutYaz(veri.size)} — en fazla ${boyutYaz(AZAMI_DOSYA)}`);
  const tur = (veri.type || f.type || 'application/octet-stream').slice(0, 100);
  const yol = `${await sahipId()}/${crypto.randomUUID()}-${guvenliAd(f.name)}`;
  const { error } = await istemciAl().storage.from('zihin').upload(yol, veri, { contentType: tur, upsert: false });
  if (error) throw error;
  return { yol, ad: f.name.slice(0, 160), tur, boyut: veri.size };
}

/** Süreli, imzalı adres (önbellekli). */
export async function imzaliUrl(yol: string): Promise<string> {
  const o = onbellek.get(yol);
  if (o && o.bitis > Date.now()) return o.url;
  const { data, error } = await istemciAl().storage.from('zihin').createSignedUrl(yol, SKT);
  if (error || !data) throw error ?? new Error('adres alınamadı');
  onbellek.set(yol, { url: data.signedUrl, bitis: Date.now() + (SKT - 60) * 1000 });
  return data.signedUrl;
}

/** [data-yol] işaretli görselleri imzalı adresle doldurur. */
export function kaynaklariCoz(kok: ParentNode) {
  kok.querySelectorAll<HTMLImageElement>('img[data-yol]').forEach(i => {
    if (i.getAttribute('src')) return;
    imzaliUrl(i.dataset.yol!).then(u => { i.src = u; }).catch(() => { i.alt = 'Görsel yüklenemedi'; });
  });
}

/** Tarayıcıda açılabilen türler yeni sekmede açılır, geri kalanı indirilir. */
export async function dosyaAc(d: { yol: string; ad?: string; tur?: string }, indir = false) {
  const guvenli = GUVENLI_TUR.test(d.tur || '');
  const { data, error } = await istemciAl().storage.from('zihin').createSignedUrl(d.yol, 120, indir || !guvenli ? { download: d.ad || true } : undefined);
  if (error || !data) throw error ?? new Error('adres alınamadı');
  if (indir || !guvenli) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = d.ad || 'belge'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  else window.open(data.signedUrl, '_blank', 'noopener');
}
