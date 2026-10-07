import { istemciAl } from './istemci';
import { durumHesapla, type Durum } from './tahlil-katalog';
import { gorselSikistir } from '../ozellikler/zihin/baglanti';

/* Tahlil raporları (dosya + tarih) ve içindeki değerler. Dosyalar özel "saglik" kovasında, kullanıcı kimliği klasörü altında durur. */
export type Rapor = {
  id: string; surum: number; tarih: string; ad: string; kurum: string | null; notlar: string | null;
  dosya_yol: string | null; dosya_ad: string | null; mime: string | null; boyut: number | null;
};
export type Deger = {
  id: string; surum: number; rapor_id: string; tarih: string; test: string; ad: string; deger: number | null; metin: string | null;
  birim: string | null; ref_alt: number | null; ref_ust: number | null;
};
export type DegerGirdisi = Pick<Deger, 'test' | 'ad' | 'deger' | 'metin' | 'birim' | 'ref_alt' | 'ref_ust'>;

export const AZAMI_DOSYA = 25 * 1024 * 1024;
const KOVA = 'saglik';
const RAPOR_SUTUN = 'id,surum,tarih,ad,kurum,notlar,dosya_yol,dosya_ad,mime,boyut';
const DEGER_SUTUN = 'id,surum,rapor_id,tarih,test,ad,deger,metin,birim,ref_alt,ref_ust';
const SAYFA = 1000;

const sayiOlsun = <T extends Record<string, unknown>>(s: T, alanlar: string[]) => { const k: Record<string, unknown> = { ...s }; alanlar.forEach(a => { if (k[a] !== null && k[a] !== undefined) k[a] = Number(k[a]); }); return k; };

export async function raporlariGetir(): Promise<Rapor[]> {
  const { data, error } = await istemciAl().from('tahlil_raporlari').select(RAPOR_SUTUN).is('silindi_at', null).order('tarih', { ascending: false }).limit(2000);
  if (error) throw error;
  return (data ?? []).map(r => sayiOlsun(r, ['boyut'])) as unknown as Rapor[];
}
export async function degerleriGetir(): Promise<Deger[]> {
  const hepsi: Deger[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await istemciAl().from('tahlil_degerleri').select(DEGER_SUTUN).is('silindi_at', null).order('tarih').range(bas, bas + SAYFA - 1);
    if (error) throw error;
    const k = (data ?? []).map(d => sayiOlsun(d, ['deger', 'ref_alt', 'ref_ust'])) as unknown as Deger[];
    hepsi.push(...k);
    if (k.length < SAYFA) return hepsi;
  }
}

const guvenliAd = (ad: string) => {
  const nokta = ad.lastIndexOf('.');
  const uzanti = nokta > 0 ? ad.slice(nokta + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const govde = (nokta > 0 ? ad.slice(0, nokta) : ad).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tahlil';
  return uzanti ? `${govde}.${uzanti}` : govde;
};
async function sahipId(): Promise<string> {
  const { data } = await istemciAl().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('oturum yok');
  return id;
}
export async function dosyaYukle(f: File): Promise<{ yol: string; ad: string; mime: string; boyut: number }> {
  if (f.size > AZAMI_DOSYA) throw new Error('boyut:' + f.name);
  const mime = (f.type || 'application/octet-stream').slice(0, 120);
  const yol = `${await sahipId()}/${crypto.randomUUID()}-${guvenliAd(f.name)}`;
  const { error } = await istemciAl().storage.from(KOVA).upload(yol, f, { contentType: mime, upsert: false });
  if (error) throw error;
  return { yol, ad: f.name.slice(0, 200), mime, boyut: f.size };
}
export async function imzaliAdres(yol: string, indirAdi?: string, sureSn = 300): Promise<string> {
  const { data, error } = await istemciAl().storage.from(KOVA).createSignedUrl(yol, sureSn, indirAdi ? { download: indirAdi } : undefined);
  if (error || !data) throw error ?? new Error('adres alınamadı');
  return data.signedUrl;
}

export type RaporGirdisi = { tarih: string; ad: string; kurum: string | null; notlar: string | null };
export async function raporEkle(g: RaporGirdisi, dosya: Awaited<ReturnType<typeof dosyaYukle>> | null): Promise<Rapor> {
  const { data, error } = await istemciAl().from('tahlil_raporlari').insert({
    ...g, dosya_yol: dosya?.yol ?? null, dosya_ad: dosya?.ad ?? null, mime: dosya?.mime ?? null, boyut: dosya?.boyut ?? null,
  }).select(RAPOR_SUTUN).single();
  if (error) {
    if (dosya) await istemciAl().storage.from(KOVA).remove([dosya.yol]);
    throw error;
  }
  return sayiOlsun(data as Record<string, unknown>, ['boyut']) as unknown as Rapor;
}
export async function raporGuncelle(r: Rapor, g: RaporGirdisi): Promise<void> {
  const { data, error } = await istemciAl().from('tahlil_raporlari').update(g).eq('id', r.id).eq('surum', r.surum).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Rapor başka yerde değişmiş; sayfayı yenile.');
}

/** Raporun değerlerini verilen listeyle eşitler: yenileri ekler, değişenleri günceller, listede olmayanları siler. */
export async function degerleriKaydet(rapor: Pick<Rapor, 'id' | 'tarih'>, mevcut: Deger[], yeni: (DegerGirdisi & { id?: string })[]): Promise<void> {
  const db = istemciAl();
  const kalan = new Set(yeni.filter(d => d.id).map(d => d.id!));
  const silinecek = mevcut.filter(d => !kalan.has(d.id)).map(d => d.id);
  if (silinecek.length) {
    const { error } = await db.from('tahlil_degerleri').update({ silindi_at: new Date().toISOString() }).in('id', silinecek);
    if (error) throw error;
  }
  const ekle = yeni.filter(d => !d.id).map(d => ({ rapor_id: rapor.id, tarih: rapor.tarih, test: d.test, ad: d.ad, deger: d.deger, metin: d.metin, birim: d.birim, ref_alt: d.ref_alt, ref_ust: d.ref_ust }));
  for (let i = 0; i < ekle.length; i += 200) {
    const { error } = await db.from('tahlil_degerleri').insert(ekle.slice(i, i + 200));
    if (error) throw error;
  }
  for (const d of yeni.filter(x => x.id)) {
    const eski = mevcut.find(m => m.id === d.id);
    if (!eski || (eski.test === d.test && eski.ad === d.ad && eski.deger === d.deger && eski.metin === d.metin && eski.birim === d.birim && eski.ref_alt === d.ref_alt && eski.ref_ust === d.ref_ust && eski.tarih === rapor.tarih)) continue;
    const { error } = await db.from('tahlil_degerleri').update({ tarih: rapor.tarih, test: d.test, ad: d.ad, deger: d.deger, metin: d.metin, birim: d.birim, ref_alt: d.ref_alt, ref_ust: d.ref_ust }).eq('id', d.id!);
    if (error) throw error;
  }
}
/** Raporu, değerlerini ve dosyasını kalıcı olarak siler. */
export async function raporuSil(r: Rapor): Promise<void> {
  const db = istemciAl();
  const simdi = new Date().toISOString();
  const a = await db.from('tahlil_raporlari').update({ silindi_at: simdi }).eq('id', r.id);
  if (a.error) throw a.error;
  const b = await db.from('tahlil_degerleri').update({ silindi_at: simdi }).eq('rapor_id', r.id);
  if (b.error) throw b.error;
  if (r.dosya_yol) { const s = await db.storage.from(KOVA).remove([r.dosya_yol]); if (s.error) throw s.error; }
  const c = await db.from('tahlil_degerleri').delete().eq('rapor_id', r.id).not('silindi_at', 'is', null);
  if (c.error) throw c.error;
  const d = await db.from('tahlil_raporlari').delete().eq('id', r.id).not('silindi_at', 'is', null);
  if (d.error) throw d.error;
}

export type TestOzeti = { test: string; ad: string; birim: string | null; seri: Deger[]; son: Deger; onceki: Deger | null; durum: Durum };
export const degerDurumu = (d: Pick<Deger, 'deger' | 'ref_alt' | 'ref_ust'>) => durumHesapla(d.deger, d.ref_alt, d.ref_ust);

/** Değerleri teste göre toplar; her testin zaman sırasıyla serisini, son değerini ve durumunu verir. */
export function testlereAyir(degerler: Deger[]): TestOzeti[] {
  const m = new Map<string, Deger[]>();
  degerler.forEach(d => { const l = m.get(d.test) ?? []; l.push(d); m.set(d.test, l); });
  return [...m.entries()].map(([test, seri]) => {
    seri.sort((a, b) => a.tarih.localeCompare(b.tarih) || a.id.localeCompare(b.id));
    const son = seri[seri.length - 1]!;
    return { test, ad: son.ad, birim: son.birim, seri, son, onceki: seri[seri.length - 2] ?? null, durum: degerDurumu(son) };
  }).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}

/* ——— Yapay zekâyla okuma (sunucu ucu: /api/tahlil) ——— */
export type OkunanRapor = { tarih: string | null; kurum: string | null; ad: string | null; degerler: Omit<DegerGirdisi, 'test'>[] };
/* Sunucusuz fonksiyonlar en fazla ~4,5 MB istek gövdesi alır; base64 büyüttüğü için dosya ~3 MB'ı geçmemeli (fotoğraflar küçültülür). */
const AZAMI_OKUMA = 3 * 1024 * 1024;
export async function yapayZekaylaOku(dosya: File): Promise<OkunanRapor> {
  const f = await gorselSikistir(dosya, 2000, 0.85);
  if (f.size > AZAMI_OKUMA) throw new Error(`Yapay zekâyla okumak için dosya en fazla ${Math.round(AZAMI_OKUMA / 1048576)} MB olabilir; daha küçük bir kopya yükle ya da metni yapıştır.`);
  const tur = f.type || (dosya.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
  const buf = new Uint8Array(await f.arrayBuffer());
  let ikili = '';
  for (let i = 0; i < buf.length; i += 0x8000) ikili += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const { data } = await istemciAl().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('oturum yok');
  const r = await fetch('/api/tahlil', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` }, body: JSON.stringify({ base64: btoa(ikili), mimeType: tur }) });
  const v = await r.json().catch(() => ({})) as { error?: string; anahtarYok?: boolean; sonuc?: OkunanRapor };
  if (!r.ok || !v.sonuc) throw new Error(v.anahtarYok ? 'Sunucuda GEMINI_API_KEY tanımlı değil; değerleri elle girebilir ya da metni yapıştırabilirsin.' : v.error || `Okuma başarısız (${r.status})`);
  return v.sonuc;
}
