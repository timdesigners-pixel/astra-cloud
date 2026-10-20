/* Onay kodu: ONAY-<dalga>-<12 hex>. Girdi: araç sürümü + dalga + hedef ref + tüm plan (özet + kayıtlar + atlananlar + uyarılar) kanonik biçimde.
   Kod 48-bit kesik tek yönlü özettir; kayıt değeri dışarı çıkmaz. Aynı girdi aynı kodu verir; bir alan/dalga/hedef/sürüm değişince kod değişir. */
import { ozetOlustur, sabitSureliEsitMi } from '../guvenlik/ozet.ts';
import { kanonikYaz } from './kanonik-json-hesap.ts';
import type { Plan } from './plan.ts';
import type { Dalga, PlanOzetiTaslagi, PlanVerisi } from './plan-tipleri.ts';

export const ONAY_KODU_DESENI = /^ONAY-[abc]-[0-9a-f]{12}$/;

export function onayKoduHesapla(dalga: Dalga, taslak: PlanOzetiTaslagi, veri: PlanVerisi): string {
  const ozet = ozetOlustur();
  kanonikYaz(
    { arac_surumu: taslak.arac_surumu, dalga, hedef_ref: taslak.hedef_ref, ozet: taslak, kayitlar: veri.kayitlar, atlananlar: veri.atlananlar, uyarilar: veri.uyarilar },
    ozet.guncelle,
  );
  return `ONAY-${dalga}-${ozet.hex().slice(0, 12)}`;
}

/* Verilen kod bu planın kodu mu. Biçim bozuk ya da farklı dalga/plan → false (çağıran ONAY_UYUSMADI ile durur). */
export function onayDogrula(plan: Plan, kod: unknown): boolean {
  return typeof kod === 'string' && ONAY_KODU_DESENI.test(kod) && sabitSureliEsitMi(plan.onay_kodu, kod);
}
