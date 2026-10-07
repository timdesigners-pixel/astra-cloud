/* Tablo bloğunun saf hesapları: sayı okuma, hücre biçimi, sütun toplamı, sıralama. */
export type Sutun = { ad: string; bicim?: string };
export type Tablo = { sutunlar: Sutun[]; satirlar: string[][]; basSatir?: boolean; basSutun?: boolean; toplam?: boolean; sira?: { c: number; yon: 1 | -1 } };

export const BICIM: Record<string, string> = { metin: 'Metin', sayi: 'Sayı', para: 'Para ₺', yuzde: 'Yüzde', tarih: 'Tarih' };
export const sayisal = (b?: string) => b === 'sayi' || b === 'para' || b === 'yuzde';

/* "1.234,50", "1,234.50", "%12", "₺99" gibi yazımları sayıya çevirir; okunamazsa NaN. */
export function sayiOku(v: unknown): number {
  let s = String(v ?? '').replace(/[\s₺%]|TL|TRY/gi, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}
export function hucreYaz(v: unknown, bicim?: string): string {
  if (v === null || v === undefined || v === '') return '';
  if (sayisal(bicim)) {
    const n = sayiOku(v); if (!Number.isFinite(n)) return String(v);
    if (bicim === 'para') return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
    if (bicim === 'yuzde') return '%' + n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 4 });
  }
  if (bicim === 'tarih') { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('tr-TR'); }
  return String(v);
}
export const sutunToplam = (b: Pick<Tablo, 'satirlar'>, c: number) => (b.satirlar || []).reduce((a, r) => { const n = sayiOku(r[c]); return Number.isFinite(n) ? a + n : a; }, 0);

/* Aynı sütuna yeniden basılınca yön tersine döner; boş hücreler hep sonda kalır. */
export function tabloSirala(b: Tablo, c: number) {
  const yon: 1 | -1 = b.sira && b.sira.c === c && b.sira.yon === 1 ? -1 : 1;
  const bc = (b.sutunlar[c] || {}).bicim;
  const deger = (v: unknown): number | string => (sayisal(bc) ? sayiOku(v) : bc === 'tarih' ? new Date(String(v)).getTime() : String(v ?? ''));
  b.satirlar.sort((x, y) => {
    const a = deger(x[c]), z = deger(y[c]);
    const bosA = a === '' || Number.isNaN(a), bosZ = z === '' || Number.isNaN(z);
    if (bosA || bosZ) return bosA === bosZ ? 0 : bosA ? 1 : -1;
    return (typeof a === 'number' && typeof z === 'number' ? a - z : String(a).localeCompare(String(z), 'tr', { numeric: true })) * yon;
  });
  b.sira = { c, yon };
}
