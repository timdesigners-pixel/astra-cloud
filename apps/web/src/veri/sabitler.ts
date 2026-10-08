import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';
import { VARSAYILAN_IMZA, type DenetimSuresi, type Imza, type Yukumluluk } from './sureler';

/* Sabit tarihli yükümlülükler, karakol imzası ve denetim süresi: küçük, kullanıcıya özel kayıtlar olduğu için ayarlar tablosunda tutulur. */
const SABIT = 'sabit_yukumlulukler', IMZA = 'imza', DENETIM = 'denetim_suresi';

async function yaz<T extends object>(anahtar: string, deger: T): Promise<void> {
  try { await ayarYaz(anahtar, deger); }
  catch (e) { if (e instanceof CakismaHatasi) await ayarYaz(anahtar, deger); else throw e; }
}

export async function sabitleriGetir(): Promise<Yukumluluk[]> {
  const a = await ayarOku<{ liste?: Yukumluluk[] }>(SABIT);
  return (a?.deger?.liste ?? []).filter(x => x && typeof x.ad === 'string' && Number.isFinite(x.gun));
}
export const sabitleriYaz = (liste: Yukumluluk[]) => yaz(SABIT, { liste });

export async function imzaGetir(): Promise<Imza> {
  const a = await ayarOku<Partial<Imza>>(IMZA);
  return { ...VARSAYILAN_IMZA, ...(a?.deger ?? {}), log: { ...(a?.deger?.log ?? {}) } };
}
export const imzaYaz = (i: Imza) => yaz(IMZA, i);

export async function denetimGetir(): Promise<DenetimSuresi | null> {
  const a = await ayarOku<Partial<DenetimSuresi>>(DENETIM);
  return a?.deger?.bas ? { bas: a.deger.bas, yil: Number(a.deger.yil ?? 0), not: a.deger.not ?? '' } : null;
}
export const denetimYaz = (d: DenetimSuresi) => yaz(DENETIM, d);
