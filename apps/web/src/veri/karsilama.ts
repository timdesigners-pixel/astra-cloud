import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';

export type Profil = { ad: string; sehir: { etiket: string; lat: number; lon: number } };
export type Hedefler = { su: number; adim: number };
export type Saglik = { id: string; surum: number; gun: string; adim: number | null; kalori: number | null; su_ml: number | null; uyku: string | null; tansiyon: string | null; nabiz: number | null };
export type Not = { id: string; surum: number; metin: string; olusturma: string };

export const VARSAYILAN_PROFIL: Profil = { ad: '', sehir: { etiket: 'İstanbul', lat: 41.0082, lon: 28.9784 } };
export const VARSAYILAN_HEDEF: Hedefler = { su: 2500, adim: 8000 };

/* ---- ayarlar: anahtar başına tek satır ---- */
async function ayarOku<T>(anahtar: string): Promise<{ id: string; surum: number; deger: T } | null> {
  const { data, error } = await istemciAl().from('ayarlar').select('id,surum,deger').eq('anahtar', anahtar).is('silindi_at', null).maybeSingle();
  if (error) throw error;
  return data as { id: string; surum: number; deger: T } | null;
}

async function ayarYaz<T extends object>(anahtar: string, deger: T): Promise<void> {
  const db = istemciAl();
  const mevcut = await ayarOku<T>(anahtar);
  if (!mevcut) {
    const { error } = await db.from('ayarlar').insert({ anahtar, deger });
    if (error && error.code !== '23505') throw error;
    if (!error) return;
    return ayarYaz(anahtar, deger);
  }
  const { data, error } = await db.from('ayarlar').update({ deger }).eq('id', mevcut.id).eq('surum', mevcut.surum).select('id');
  if (error) throw error;
  if (!data?.length) throw new CakismaHatasi();
}

export async function profilGetir(): Promise<Profil> {
  const a = await ayarOku<Partial<Profil>>('profil');
  return { ...VARSAYILAN_PROFIL, ...(a?.deger ?? {}), sehir: { ...VARSAYILAN_PROFIL.sehir, ...(a?.deger?.sehir ?? {}) } };
}
export const profilYaz = (p: Profil) => ayarYaz('profil', p);

export async function hedefGetir(): Promise<Hedefler> {
  const a = await ayarOku<Partial<Hedefler>>('saglik_hedef');
  return { ...VARSAYILAN_HEDEF, ...(a?.deger ?? {}) };
}
export const hedefYaz = (h: Hedefler) => ayarYaz('saglik_hedef', h);

/* ---- günlük sağlık: gün başına tek satır ---- */
const SAGLIK_KOLON = 'id,surum,gun,adim,kalori,su_ml,uyku,tansiyon,nabiz';

export async function saglikGetir(gun: string): Promise<Saglik | null> {
  const { data, error } = await istemciAl().from('saglik_gunluk').select(SAGLIK_KOLON).eq('gun', gun).is('silindi_at', null).maybeSingle();
  if (error) throw error;
  return data as Saglik | null;
}

export async function saglikYaz(gun: string, alanlar: Partial<Omit<Saglik, 'id' | 'surum' | 'gun'>>): Promise<Saglik> {
  const db = istemciAl();
  const mevcut = await saglikGetir(gun);
  if (!mevcut) {
    const { data, error } = await db.from('saglik_gunluk').insert({ gun, ...alanlar }).select(SAGLIK_KOLON).single();
    if (error?.code === '23505') return saglikYaz(gun, alanlar);
    if (error) throw error;
    return data as Saglik;
  }
  const { data, error } = await db.from('saglik_gunluk').update(alanlar).eq('id', mevcut.id).eq('surum', mevcut.surum).select(SAGLIK_KOLON);
  if (error) throw error;
  if (!data?.length) throw new CakismaHatasi();
  return data[0] as Saglik;
}

/* ---- hızlı notlar ---- */
export async function notlariGetir(): Promise<Not[]> {
  const { data, error } = await istemciAl().from('hizli_notlar').select('id,surum,metin,olusturma').is('silindi_at', null).order('olusturma', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as Not[];
}
export async function notEkle(metin: string): Promise<Not> {
  const { data, error } = await istemciAl().from('hizli_notlar').insert({ metin }).select('id,surum,metin,olusturma').single();
  if (error) throw error;
  return data as Not;
}
export async function notDegistir(id: string, surum: number, alan: { silindi_at: string | null }): Promise<Not> {
  const { data, error } = await istemciAl().from('hizli_notlar').update(alan).eq('id', id).eq('surum', surum).select('id,surum,metin,olusturma');
  if (error) throw error;
  if (!data?.length) throw new CakismaHatasi();
  return data[0] as Not;
}
