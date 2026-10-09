import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';

/* Rutinler: günlük ve haftalık listeler kendiliğinden sıfırlanır, fırsat/tek seferlik olanlar tamamlanınca silinir. */
export type RutinMadde = { id: string; t: string; d: boolean };
export type Rutinler = { gun: string; hafta: string; gunluk: RutinMadde[]; haftalik: RutinMadde[]; firsat: RutinMadde[] };
export type RutinTuru = 'gunluk' | 'haftalik' | 'firsat';
export const RUTIN_TURLERI: [RutinTuru, string, string][] = [
  ['gunluk', 'Günlük rutinler', 'her sabah sıfırlanır'], ['haftalik', 'Haftalık rutinler', 'hafta başında (pazartesi) sıfırlanır'], ['firsat', 'Fırsat / tek seferlik', 'tamamlanınca sil'],
];

/* Haftanın pazartesisi (YYYY-AA-GG): hafta anahtarı. */
export function haftaAnahtari(gun: string): string {
  const [y, m, d] = gun.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d!)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}
export const BOS_RUTIN: Rutinler = { gun: '', hafta: '', gunluk: [], haftalik: [], firsat: [] };

/* Gün ya da hafta değiştiyse ilgili listelerin işaretleri kalkar. */
export function rutinleriYenile(r: Rutinler, bugun: string): { r: Rutinler; degisti: boolean } {
  const hafta = haftaAnahtari(bugun);
  let degisti = false;
  const c: Rutinler = { ...r, gunluk: r.gunluk.map(x => ({ ...x })), haftalik: r.haftalik.map(x => ({ ...x })), firsat: r.firsat.map(x => ({ ...x })) };
  if (c.gun !== bugun) { c.gunluk.forEach(x => { x.d = false; }); c.gun = bugun; degisti = true; }
  if (c.hafta !== hafta) { c.haftalik.forEach(x => { x.d = false; }); c.hafta = hafta; degisti = true; }
  return { r: c, degisti };
}
export async function rutinleriGetir(): Promise<Rutinler> {
  const a = await ayarOku<Partial<Rutinler>>('rutinler');
  const d = a?.deger ?? {};
  return { ...BOS_RUTIN, ...d, gunluk: d.gunluk ?? [], haftalik: d.haftalik ?? [], firsat: d.firsat ?? [] };
}
export async function rutinleriYaz(r: Rutinler): Promise<void> {
  try { await ayarYaz('rutinler', r); } catch (e) { if (e instanceof CakismaHatasi) await ayarYaz('rutinler', r); else throw e; }
}
