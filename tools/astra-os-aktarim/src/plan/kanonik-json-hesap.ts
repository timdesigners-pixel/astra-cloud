/* Kanonik (anahtar sıralı) JSON serileştirmesi. SAF. Parça parça `yaz` çağrısı yapar: onay özeti büyük planı tek metne çevirmeden besler. */

export function kanonikYaz(deger: unknown, yaz: (parca: string) => void): void {
  if (deger === null || deger === undefined) {
    yaz('null');
    return;
  }
  switch (typeof deger) {
    case 'string':
      yaz(JSON.stringify(deger));
      return;
    case 'boolean':
      yaz(deger ? 'true' : 'false');
      return;
    case 'number':
      if (!Number.isFinite(deger)) throw new Error('KANONIK_SAYI_GECERSIZ');
      yaz(Object.is(deger, -0) ? '0' : String(deger));
      return;
    case 'object':
      break;
    default:
      throw new Error('KANONIK_TUR_GECERSIZ');
  }
  if (Array.isArray(deger)) {
    yaz('[');
    deger.forEach((oge, i) => {
      if (i > 0) yaz(',');
      kanonikYaz(oge, yaz);
    });
    yaz(']');
    return;
  }
  const nesne = deger as Record<string, unknown>;
  const anahtarlar = Object.keys(nesne)
    .filter((a) => nesne[a] !== undefined)
    .sort();
  yaz('{');
  anahtarlar.forEach((a, i) => {
    if (i > 0) yaz(',');
    yaz(JSON.stringify(a));
    yaz(':');
    kanonikYaz(nesne[a], yaz);
  });
  yaz('}');
}
