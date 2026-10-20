import { readFileSync, statSync } from 'node:fs';
import { GirdiHatasi } from './girdi-hata.ts';
import { girdiCoz } from './okuyucu.ts';
import type { SemaSonucu } from './sema-ayristirici-hesap.ts';

/* V8 dize sınırının altında güvenli üst sınır (256 MiB). */
export const AZAMI_GIRDI_BAYT = 256 * 1024 * 1024;

/* Yol → metin. Yol YALNIZ parametreden gelir (komut satırı argümanı); ortam/stdin okunmaz. Dosyayı silmez, kopyalamaz. */
export function girdiMetniOku(yol: string): string {
  if (typeof yol !== 'string' || yol.trim() === '') throw new GirdiHatasi('GIRDI_YOLU_YOK');
  try {
    const durum = statSync(yol);
    if (!durum.isFile()) throw new GirdiHatasi('DOSYA_OKUNAMADI');
    if (durum.size > AZAMI_GIRDI_BAYT) throw new GirdiHatasi('GIRDI_COK_BUYUK');
    return readFileSync(yol, 'utf8');
  } catch (e) {
    if (e instanceof GirdiHatasi) throw e;
    /* Sistem hata metni yol içerir; yalnız kod taşınır. */
    throw new GirdiHatasi('DOSYA_OKUNAMADI');
  }
}

/* Yol → S: dosyayı okur, çözer ve doğrular. */
export function girdiYukle(yol: string): SemaSonucu {
  return girdiCoz(girdiMetniOku(yol));
}
