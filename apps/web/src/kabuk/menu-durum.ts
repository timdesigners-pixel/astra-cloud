import { HUBLAR, hubBul } from './sekmeler';

/* Menü görünümü cihazın bir tercihidir, finansal veri değildir. */
const ANAHTAR = 'astra.menu';
type Kayit = { duz: boolean; acik: Record<string, boolean> };

function oku(): Kayit {
  try {
    const k = JSON.parse(localStorage.getItem(ANAHTAR) ?? 'null') as Kayit | null;
    if (k && typeof k.duz === 'boolean' && k.acik) return k;
  } catch { /* erişim yoksa varsayılan */ }
  return { duz: false, acik: Object.fromEntries(HUBLAR.map(h => [h.id, h.id === 'dash' || h.id === 'fin'])) };
}

const durum = oku();
const yaz = () => { try { localStorage.setItem(ANAHTAR, JSON.stringify(durum)); } catch { /* yok say */ } };

export const duzMenu = () => durum.duz;
export function duzMenuYaz(v: boolean) { durum.duz = v; yaz(); }
export const hubAcik = (id: string) => !!durum.acik[id];
export function hubCevir(id: string) { durum.acik[id] = !durum.acik[id]; yaz(); }
export function hepsiniAyarla(v: boolean) { HUBLAR.forEach(h => (durum.acik[h.id] = v)); yaz(); }

/* Bir sayfaya gidilince merkezi kendiliğinden açılır. */
export function sekmeMerkeziniAc(sekme: string) {
  const h = hubBul(sekme);
  if (h && !durum.acik[h.id]) { durum.acik[h.id] = true; yaz(); }
}
