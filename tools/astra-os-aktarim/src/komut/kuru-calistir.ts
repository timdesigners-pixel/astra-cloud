/* VARSAYILAN komut: yalnız girdi → plan → rapor. Ağ ve kimlik gerekmez (yazıcı HİÇ kurulmaz); onay kodu rapora yazılır.
   Hedef proje yalnız onay koduna girer (yanlış projeye yazmayı önler); URL kimlik bilgisi değildir. */
import type { Plan } from '../plan/plan.ts';
import type { Dalga } from '../plan/plan-tipleri.ts';
import { raporYaz } from '../rapor/rapor-yaz.ts';
import { planKur, type PlanKaynagi } from './plan-kur.ts';

export type KuruCalistirGirdisi = {
  girdi: string;
  dalga: Dalga;
  ilgi?: string;
  rapor?: string;
  json: boolean;
  hedef: { anaMakine: string; kisa: string };
  aracSurumu: string;
  kaynak?: PlanKaynagi;
};

export function kuruCalistir(g: KuruCalistirGirdisi): Plan {
  const plan = planKur({ girdi: g.girdi, ilgi: g.ilgi, dalga: g.dalga, anaMakine: g.hedef.anaMakine, aracSurumu: g.aracSurumu, kaynak: g.kaynak });
  raporYaz({ ...plan.ozet, hedef_proje_kisa: g.hedef.kisa }, { json: g.json, dosya: g.rapor });
  return plan;
}
