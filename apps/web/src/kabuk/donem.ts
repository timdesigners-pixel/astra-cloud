/* Seçili dönem (ay). Anahtar biçimi: "2026-10". Veri katmanı gelince dönem kapanış bilgisi buraya bağlanır. */
type Dinleyici = () => void;
const dinleyiciler = new Set<Dinleyici>();

const anahtar = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const buAy = () => anahtar(new Date());

let secili = buAy();

export const donem = () => secili;
export const donemEtiketi = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    .replace(/^./, c => c.toLocaleUpperCase('tr'));
};
export const donemDurumu = (k: string) => (k === buAy() ? 'bugun' : k > buAy() ? 'gelecek' : 'gecmis');

export function donemKaydir(fark: number) {
  const [y, m] = secili.split('-').map(Number);
  donemeGit(anahtar(new Date(y!, m! - 1 + fark, 1)));
}
export function donemeGit(k: string) {
  if (k === secili) return;
  secili = k;
  dinleyiciler.forEach(f => f());
}
export function donemDinle(f: Dinleyici) {
  dinleyiciler.add(f);
}
