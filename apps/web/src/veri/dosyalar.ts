import { istemciAl } from './istemci';

/* Dosya Yöneticisi verisi: klasör ağacı dosya_kayitlari tablosunda, içerik özel "belgeler" kovasında (kullanıcı kimliği klasörü altında). */
export type BagTuru = 'dava' | 'icra';
export type DosyaKaydi = {
  id: string; surum: number; tur: 'klasor' | 'dosya'; ad: string; ust_id: string | null; yol: string | null; mime: string | null;
  boyut: number | null; yildiz: boolean; bag_tur: BagTuru | null; bag_id: string | null; olusturma: string; silindi_at: string | null;
};

export const AZAMI_DOSYA = 25 * 1024 * 1024;
const KOVA = 'belgeler';
const SUTUNLAR = 'id,surum,tur,ad,ust_id,yol,mime,boyut,yildiz,bag_tur,bag_id,olusturma,silindi_at';
const SAYFA = 1000;
const TOPLU = 100;

async function hepsi(silinmis: boolean): Promise<DosyaKaydi[]> {
  const sonuc: DosyaKaydi[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    let s = istemciAl().from('dosya_kayitlari').select(SUTUNLAR);
    s = silinmis ? s.not('silindi_at', 'is', null) : s.is('silindi_at', null);
    const { data, error } = await s.order('olusturma').range(bas, bas + SAYFA - 1);
    if (error) throw error;
    const k = (data ?? []) as unknown as DosyaKaydi[];
    sonuc.push(...k);
    if (k.length < SAYFA) return sonuc;
  }
}
export const agacGetir = () => hepsi(false);
export const copuGetir = () => hepsi(true);

export function altlar(liste: DosyaKaydi[], kokId: string): DosyaKaydi[] {
  const cocuklar = new Map<string, DosyaKaydi[]>();
  liste.forEach(k => { if (k.ust_id) { const d = cocuklar.get(k.ust_id) ?? []; d.push(k); cocuklar.set(k.ust_id, d); } });
  const cikti: DosyaKaydi[] = [];
  const yigin = [kokId];
  while (yigin.length) {
    for (const c of cocuklar.get(yigin.pop()!) ?? []) { cikti.push(c); if (c.tur === 'klasor') yigin.push(c.id); }
  }
  return cikti;
}

async function sahipId(): Promise<string> {
  const { data } = await istemciAl().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('oturum yok');
  return id;
}

const guvenliAd = (ad: string) => {
  const nokta = ad.lastIndexOf('.');
  const uzanti = nokta > 0 ? ad.slice(nokta + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  const govde = (nokta > 0 ? ad.slice(0, nokta) : ad).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dosya';
  return uzanti ? `${govde}.${uzanti}` : govde;
};

export async function klasorOlustur(ad: string, ustId: string | null, bag?: { tur: BagTuru; id: string }): Promise<DosyaKaydi> {
  const { data, error } = await istemciAl().from('dosya_kayitlari')
    .insert({ tur: 'klasor', ad: ad.trim().slice(0, 200), ust_id: ustId, bag_tur: bag?.tur ?? null, bag_id: bag?.id ?? null })
    .select(SUTUNLAR).single();
  if (error) throw error;
  return data as unknown as DosyaKaydi;
}

/** Dosyayı yükler; kayıt eklenemezse yüklenen içerik geri silinir. Sınır aşılırsa Error('boyut:…') atar. */
export async function dosyaYukle(f: File, ustId: string | null): Promise<DosyaKaydi> {
  if (f.size > AZAMI_DOSYA) throw new Error('boyut:' + f.name);
  const mime = (f.type || 'application/octet-stream').slice(0, 120);
  const yol = `${await sahipId()}/${crypto.randomUUID()}-${guvenliAd(f.name)}`;
  const y = await istemciAl().storage.from(KOVA).upload(yol, f, { contentType: mime, upsert: false });
  if (y.error) throw y.error;
  const { data, error } = await istemciAl().from('dosya_kayitlari')
    .insert({ tur: 'dosya', ad: f.name.slice(0, 200), ust_id: ustId, yol, mime, boyut: f.size })
    .select(SUTUNLAR).single();
  if (error) { await istemciAl().storage.from(KOVA).remove([yol]); throw error; }
  return data as unknown as DosyaKaydi;
}

async function guncelle(id: string, g: Record<string, unknown>): Promise<DosyaKaydi> {
  const { data, error } = await istemciAl().from('dosya_kayitlari').update(g).eq('id', id).select(SUTUNLAR).single();
  if (error) throw error;
  return data as unknown as DosyaKaydi;
}
export const adDegistir = (id: string, ad: string) => guncelle(id, { ad: ad.trim().slice(0, 200) });
export const tasi = (id: string, ustId: string | null) => guncelle(id, { ust_id: ustId });
export const yildizla = (id: string, yildiz: boolean) => guncelle(id, { yildiz });

async function topluGuncelle(idler: string[], g: Record<string, unknown>) {
  for (let i = 0; i < idler.length; i += TOPLU) {
    const { error } = await istemciAl().from('dosya_kayitlari').update(g).in('id', idler.slice(i, i + TOPLU));
    if (error) throw error;
  }
}

/** Seçilenleri (klasörse içindekilerle birlikte) çöp kutusuna taşır. Döner: etkilenen kimlikler. */
export async function copeAt(secilen: DosyaKaydi[], liste: DosyaKaydi[]): Promise<string[]> {
  const idler = new Set<string>();
  secilen.forEach(k => { idler.add(k.id); if (k.tur === 'klasor') altlar(liste, k.id).forEach(a => idler.add(a.id)); });
  const hepsiId = [...idler];
  await topluGuncelle(hepsiId, { silindi_at: new Date().toISOString() });
  return hepsiId;
}

/** Çöp kutusundan geri getirir (klasörse içindekilerle); üst klasörü hâlâ silinmişse kök klasöre alınır. */
export async function geriGetir(secilen: DosyaKaydi[], cop: DosyaKaydi[], canli: DosyaKaydi[]): Promise<void> {
  const idler = new Set<string>();
  secilen.forEach(k => { idler.add(k.id); if (k.tur === 'klasor') altlar(cop, k.id).forEach(a => idler.add(a.id)); });
  const canliKlasor = new Set(canli.filter(k => k.tur === 'klasor').map(k => k.id));
  const yetim = secilen.filter(k => k.ust_id && !canliKlasor.has(k.ust_id) && !idler.has(k.ust_id));
  if (yetim.length) await topluGuncelle(yetim.map(k => k.id), { ust_id: null });
  // Önce klasörler (derinlik sırasıyla), sonra dosyalar: üst kayıt canlanmadan alt kayıt canlanmasın.
  const kayit = new Map(cop.map(k => [k.id, k]));
  const derinlik = (k: DosyaKaydi) => { let d = 0; for (let x: DosyaKaydi | undefined = k; x?.ust_id && idler.has(x.ust_id); x = kayit.get(x.ust_id)) d++; return d; };
  const sirali = [...idler].map(i => kayit.get(i)).filter((k): k is DosyaKaydi => !!k).sort((a, b) => derinlik(a) - derinlik(b));
  await topluGuncelle(sirali.map(k => k.id), { silindi_at: null });
}

/** Çöpteki kayıtları ve içeriklerini kalıcı olarak siler. */
export async function kaliciSil(secilen: DosyaKaydi[], cop: DosyaKaydi[]): Promise<void> {
  const hedef = new Map<string, DosyaKaydi>();
  secilen.forEach(k => { hedef.set(k.id, k); if (k.tur === 'klasor') altlar(cop, k.id).forEach(a => hedef.set(a.id, a)); });
  const hepsiKayit = [...hedef.values()];
  const yollar = hepsiKayit.filter(k => k.yol).map(k => k.yol!);
  for (let i = 0; i < yollar.length; i += TOPLU) {
    const { error } = await istemciAl().storage.from(KOVA).remove(yollar.slice(i, i + TOPLU));
    if (error) throw error;
  }
  const derinlik = (k: DosyaKaydi) => { let d = 0; for (let x: DosyaKaydi | undefined = k; x?.ust_id; x = hedef.get(x.ust_id)) d++; return d; };
  const sirali = hepsiKayit.sort((a, b) => derinlik(b) - derinlik(a));
  for (let i = 0; i < sirali.length; i += TOPLU) {
    const { error } = await istemciAl().from('dosya_kayitlari').delete().in('id', sirali.slice(i, i + TOPLU).map(k => k.id));
    if (error) throw error;
  }
}

export async function imzaliAdres(yol: string, indirAdi?: string, sureSn = 300): Promise<string> {
  const { data, error } = await istemciAl().storage.from(KOVA).createSignedUrl(yol, sureSn, indirAdi ? { download: indirAdi } : undefined);
  if (error || !data) throw error ?? new Error('adres alınamadı');
  return data.signedUrl;
}

/** Bir dava ya da icra dosyasına bağlı klasörü bulur; yoksa oluşturur. Klasör adı kayıttan canlı gösterildiği için yer tutucudur. */
export async function bagliKlasor(tur: BagTuru, id: string): Promise<DosyaKaydi> {
  const mevcut = await istemciAl().from('dosya_kayitlari').select(SUTUNLAR).eq('bag_tur', tur).eq('bag_id', id).is('silindi_at', null).limit(1);
  if (mevcut.error) throw mevcut.error;
  if (mevcut.data?.length) return mevcut.data[0] as unknown as DosyaKaydi;
  try { return await klasorOlustur(tur === 'dava' ? 'Dava belgeleri' : 'İcra belgeleri', null, { tur, id }); }
  catch (e) {
    if ((e as { code?: string }).code !== '23505') throw e;
    const yine = await istemciAl().from('dosya_kayitlari').select(SUTUNLAR).eq('bag_tur', tur).eq('bag_id', id).is('silindi_at', null).limit(1);
    if (yine.error || !yine.data?.length) throw yine.error ?? e;
    return yine.data[0] as unknown as DosyaKaydi;
  }
}
