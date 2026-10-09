import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';

export type AcilKisi = { id: string; ad: string; rol: string; tel: string; adres: string };
const ANAHTAR = 'acil_kisiler';

export async function acilKisileriGetir(): Promise<AcilKisi[]> {
  const a = await ayarOku<{ liste?: AcilKisi[] }>(ANAHTAR);
  return (a?.deger?.liste ?? []).filter(x => x && typeof x.ad === 'string');
}

export async function acilKisileriYaz(liste: AcilKisi[]): Promise<void> {
  try { await ayarYaz(ANAHTAR, { liste }); }
  catch (e) { if (e instanceof CakismaHatasi) await ayarYaz(ANAHTAR, { liste }); else throw e; }
}
