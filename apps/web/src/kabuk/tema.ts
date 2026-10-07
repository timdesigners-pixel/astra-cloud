const TEMALAR = ['sistem', 'acik', 'koyu'] as const;
export type Tema = (typeof TEMALAR)[number];
const ANAHTAR = 'astra.tema';

/* Tema cihazın bir tercihidir, veri değildir; yalnız sessionStorage'da, yoksa koyu. */
function oku(): Tema {
  try {
    const v = sessionStorage.getItem(ANAHTAR) as Tema | null;
    if (v && TEMALAR.includes(v)) return v;
  } catch { /* erişim yoksa varsayılan */ }
  return 'koyu';
}

let simdiki: Tema = oku();

const koyuMu = () =>
  simdiki === 'koyu' || (simdiki === 'sistem' && !matchMedia('(prefers-color-scheme: light)').matches);

export function temaUygula() {
  const k = document.documentElement;
  if (simdiki === 'sistem') k.removeAttribute('data-tema');
  else k.setAttribute('data-tema', simdiki);
  k.classList.toggle('dark', koyuMu());
  document.body.classList.toggle('dark', koyuMu());
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', koyuMu() ? '#0b0e11' : '#ffffff');
}

export function temaAyarla(v: Tema) {
  simdiki = v;
  try { sessionStorage.setItem(ANAHTAR, simdiki); } catch { /* yok say */ }
  temaUygula();
}

export function temaCevir() {
  temaAyarla(TEMALAR[(TEMALAR.indexOf(simdiki) + 1) % TEMALAR.length]!);
}

export const temaSimge = () => ({ sistem: '◐', acik: '☀', koyu: '☾' })[simdiki];
export const temaAd = () => ({ sistem: 'Tema: sistem', acik: 'Tema: açık', koyu: 'Tema: koyu' })[simdiki];
