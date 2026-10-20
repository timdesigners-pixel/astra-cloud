/* Rapor yazma: YALNIZ `cikti.ts` (tek çıktı kapısı) üzerinden. Bu dosyada konsol/dosya/akış çağrısı yoktur. */
import { raporDosyasiYaz, raporYazdir } from '../cikti.ts';
import type { Rapor } from './rapor-sema.ts';

export type RaporYazSecenegi = { json?: boolean; dosya?: string };

/* Raporu doğrulayıp ekrana (ve isteğe bağlı `--rapor <yol>` JSON dosyasına) yazar. Şemaya uymayan rapor yazılmaz (RaporHatasi). */
export function raporYaz(rapor: Rapor, secenek: RaporYazSecenegi = {}): void {
  raporYazdir(rapor, secenek.json === true);
  if (secenek.dosya !== undefined) raporDosyasiYaz(secenek.dosya, rapor);
}
