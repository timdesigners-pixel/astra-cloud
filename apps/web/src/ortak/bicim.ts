const para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const tarih = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const tl = (n: number | null | undefined) => (n === null || n === undefined ? '—' : para.format(n));

/* "2026-09-27" biçimindeki tarihi yerel saat kaymasına uğratmadan gösterir. */
export function gun(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return tarih.format(new Date(y!, m! - 1, d!));
}

/* Doğrulama tarihinden bugüne geçen gün sayısı. */
export function gunFarki(s: string | null | undefined, simdi = new Date()): number | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const a = Date.UTC(y!, m! - 1, d!);
  const b = Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  return Math.round((b - a) / 86400000);
}
