/* girdi → plan hattı (kuru-calistir, yaz, dogrula ortak adımı). Dosya okuma burada, saf plan `plan/` içinde. `yaz` planı bu hattan YENİDEN üretir ve
   onay koduyla karşılaştırır; böylece kod, kuru çalıştırmadaki girdi/hedef/sürümle birebir aynı olmak zorundadır. */
import { girdiMetniOku, girdiYukle } from '../girdi/dosya-oku.ts';
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import type { SemaSonucu } from '../girdi/sema-ayristirici-hesap.ts';
import type { Plan } from '../plan/plan.ts';
import { planOlustur } from '../plan/plan-olustur-hesap.ts';
import type { Dalga } from '../plan/plan-tipleri.ts';

/* Dosya erişimi enjekte edilebilir (testler gerçek dosya yazmadan çalışır). */
export type PlanKaynagi = {
  girdiYukle: (yol: string) => SemaSonucu;
  ilgiOku: (yol: string) => unknown;
};

/* `--ilgi` dosyası: ürün listesi JSON'u. Ayrıştırıcı hata metni girdiden parça içerebilir; yalnız kod taşınır. */
function ilgiDosyasiOku(yol: string): unknown {
  const metin = girdiMetniOku(yol);
  try {
    return JSON.parse(metin);
  } catch {
    throw new GirdiHatasi('BOZUK_JSON', 'ilgi');
  }
}

export const GERCEK_PLAN_KAYNAGI: PlanKaynagi = { girdiYukle, ilgiOku: ilgiDosyasiOku };

export type PlanKurGirdisi = {
  girdi: string;
  ilgi?: string;
  dalga: Dalga;
  anaMakine: string;
  aracSurumu: string;
  kaynak?: PlanKaynagi;
};

export function planKur(g: PlanKurGirdisi): Plan {
  const kaynak = g.kaynak ?? GERCEK_PLAN_KAYNAGI;
  const sema = kaynak.girdiYukle(g.girdi);
  const ilgiHam = g.ilgi !== undefined ? kaynak.ilgiOku(g.ilgi) : undefined;
  return planOlustur({ dalga: g.dalga, sema, ilgiHam, hedefAnaMakine: g.anaMakine, aracSurumu: g.aracSurumu });
}
