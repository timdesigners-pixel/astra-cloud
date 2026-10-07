/* Tekrarlayan gelir ve giderin hangi aya düştüğü. Başlangıç tarihi, 3 aylık ve yıllık kalemler için çapa, tek seferlik kalem için tarihin kendisidir. */
export type Tekrarli = { [alan: string]: unknown };

const ayNo = (ay: string) => { const [y, m] = ay.split('-').map(Number); return y! * 12 + (m! - 1); };
const ayiOku = (t: unknown) => (typeof t === 'string' && /^\d{4}-\d{2}/.test(t) ? t.slice(0, 7) : null);

/** "YYYY-MM" ayında bu kalem için bir ödeme/gelir var mı? */
export function ayaDenk(k: Tekrarli, ay: string): boolean {
  const bas = ayiOku(k.baslangic), bit = ayiOku(k.bitis);
  if (bas && ay < bas) return false;
  if (bit && ay > bit) return false;
  switch (k.periyot) {
    case 'aylik': return true;
    case 'uc_aylik': return !!bas && (ayNo(ay) - ayNo(bas)) % 3 === 0;
    case 'yillik': return !!bas && (ayNo(ay) - ayNo(bas)) % 12 === 0;
    case 'tek_sefer': return !!bas && bas === ay;
    default: return false;
  }
}

/** Ayın kaçıncı günü: önce "gün" alanı, yoksa başlangıç tarihinin günü; ikisi de yoksa null. */
export function ayGunu(k: Tekrarli): number | null {
  const g = Number(k.gun);
  if (Number.isFinite(g) && g >= 1 && g <= 31) return g;
  const b = typeof k.baslangic === 'string' && /^\d{4}-\d{2}-(\d{2})/.exec(k.baslangic);
  return b ? Number(b[1]) : null;
}
