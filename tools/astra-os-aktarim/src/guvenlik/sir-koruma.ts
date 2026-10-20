/* Hata süzgeci. PostgREST/Supabase hata nesneleri `message`, `details`, `hint` içinde kayıt değeri taşıyabilir
   (örn. "Key (...)=(...) already exists"). Bu üç alan HİÇ okunmaz; yalnız kısa kod, HTTP durumu ve çağıranın verdiği tablo adı döner. */

export type GuvenliHata = { kod: string; durum: number | null; tablo: string | null };

const KOD_DESENI = /^[A-Za-z0-9_.-]{1,40}$/;
const TABLO_DESENI = /^[a-z_]{2,40}$/;

function alanOku(hata: unknown, ad: string): unknown {
  if (typeof hata !== 'object' || hata === null) return undefined;
  try {
    return (hata as Record<string, unknown>)[ad];
  } catch {
    /* Özel erişimci (getter) hata fırlatabilir: yok sayılır. */
    return undefined;
  }
}

function durumBul(hata: unknown): number | null {
  for (const ad of ['durum', 'status', 'statusCode']) {
    const d = alanOku(hata, ad);
    if (typeof d === 'number' && Number.isInteger(d) && d >= 100 && d <= 599) return d;
  }
  return null;
}

/* Hata nesnesini süzer. `tablo` çağıranın bildiği hedef tablodur (hata nesnesinden okunmaz). */
export function hataGuvenli(hata: unknown, tablo?: string): GuvenliHata {
  const ham = alanOku(hata, 'kod') ?? alanOku(hata, 'code');
  const kod = typeof ham === 'string' && KOD_DESENI.test(ham) ? ham : 'BILINMEYEN_HATA';
  return {
    kod,
    durum: durumBul(hata),
    tablo: tablo !== undefined && TABLO_DESENI.test(tablo) ? tablo : null,
  };
}
