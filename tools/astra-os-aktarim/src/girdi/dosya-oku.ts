import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
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

export type RaporYoluSonucu = 'TAMAM' | 'CAKISIYOR' | 'SEMBOLIK_BAGLANTI';

/* Sembolik bağlantılar çözülmüş gerçek yol; dosya henüz yoksa üst dizinin gerçek yolu + dosya adı. */
function gercekYol(yol: string): string {
  try {
    return realpathSync(yol);
  } catch {
    /* Yok: üst dizini çözmeyi dene (best-effort); o da yoksa salt mutlak yol. */
    try {
      return join(realpathSync(dirname(resolve(yol))), basename(yol));
    } catch {
      return resolve(yol);
    }
  }
}

/* `--rapor` hedefi, korunan girdi yollarından (--girdi, --ilgi, --kaynak) biriyle aynı dosya (sembolik/sert bağlantı dahil) ya da
   --kaynak dizininin içindeyse CAKISIYOR; hedef bir sembolik bağlantıysa SEMBOLIK_BAGLANTI (bağlantının hedefini ezmemek için). Hiçbir şey yazmaz/silmez. */
export function raporYoluDenetle(rapor: string, korunan: readonly (string | undefined)[]): RaporYoluSonucu {
  try {
    if (lstatSync(rapor).isSymbolicLink()) return 'SEMBOLIK_BAGLANTI';
  } catch {
    /* Yok: yeni dosya olacak. */
  }
  const hedef = gercekYol(rapor);
  let hedefDurum: ReturnType<typeof statSync> | null = null;
  try {
    hedefDurum = statSync(rapor);
  } catch {
    /* Yok. */
  }
  for (const k of korunan) {
    if (k === undefined || k.trim() === '') continue;
    const g = gercekYol(k);
    if (g === hedef || hedef.startsWith(g + sep)) return 'CAKISIYOR';
    if (hedefDurum !== null) {
      try {
        const d = statSync(k);
        /* Sert bağlantı: farklı yol, aynı dosya. */
        if (d.ino === hedefDurum.ino && d.dev === hedefDurum.dev) return 'CAKISIYOR';
      } catch {
        /* Korunan yol okunamıyor: yol karşılaştırması yeterli. */
      }
    }
  }
  return 'TAMAM';
}
