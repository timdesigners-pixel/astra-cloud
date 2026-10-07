export function el<K extends keyof HTMLElementTagNameMap>(
  etiket: K, sinif?: string, metin?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin !== undefined) e.textContent = metin;
  return e;
}

/* Türkçe duyarsız arama: İ/ı/I farkını kaldırır. */
export const katla = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i');

type Ozellik = { sinif?: string; id?: string; baslik?: string; tip?: string; stil?: string; tikla?: (e: MouseEvent) => void };

/* Kısa öğe üretici: metinler textContent olarak eklenir, HTML olarak yorumlanmaz. */
export function h<K extends keyof HTMLElementTagNameMap>(
  etiket: K, oz?: Ozellik, ...cocuklar: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiket);
  if (oz?.sinif) e.className = oz.sinif;
  if (oz?.id) e.id = oz.id;
  if (oz?.baslik) e.title = oz.baslik;
  if (oz?.stil) e.setAttribute('style', oz.stil);
  if (oz?.tip && e instanceof HTMLButtonElement) e.type = oz.tip as 'button';
  if (oz?.tikla) e.addEventListener('click', oz.tikla as EventListener);
  cocuklar.forEach(c => { if (c) e.append(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
