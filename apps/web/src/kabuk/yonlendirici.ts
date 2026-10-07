import { SEKMELER, sekmeCoz } from './sekmeler';

type Dinleyici = (k: string) => void;
const dinleyiciler = new Set<Dinleyici>();
const VARSAYILAN = 'genel';

function adrestenOku(): string {
  const ham = new URLSearchParams(location.search).get('tab') ?? '';
  return sekmeCoz(ham) ?? VARSAYILAN;
}

let aktif = adrestenOku();

export const aktifSekme = () => aktif;

export function git(ham: string, adresYaz = true) {
  const k = sekmeCoz(ham);
  if (!k) return;
  aktif = k;
  if (adresYaz) {
    const u = new URL(location.href);
    u.searchParams.set('tab', k);
    history.pushState({ tab: k }, '', u);
  }
  dinleyiciler.forEach(f => f(k));
  if (scrollY > 4) scrollTo({ top: 0, behavior: 'smooth' });
}

export function yonlendiriciDinle(f: Dinleyici) {
  dinleyiciler.add(f);
}

export function yonlendiriciBaslat() {
  addEventListener('popstate', () => {
    aktif = adrestenOku();
    dinleyiciler.forEach(f => f(aktif));
  });
}

export const kisayolHedefi = (n: number) => SEKMELER[n - 1]?.anahtar;
