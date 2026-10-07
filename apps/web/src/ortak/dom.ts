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
