import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';

/* Faiz / getiri hesapları (saf) ve banka oranları radarı. */
export type Bilesik = 'basit' | 'gunluk';
export type Getiri = { brut: number; stopaj: number; net: number; son: number; netYillik: number };

/* Basit: anapara × oran × gün/365. Günlük bileşik: her gün oranın 1/365'i eklenir. Stopaj brüt getiriden kesilir. */
export function getiriHesapla(anapara: number, yillikOran: number, gun: number, bilesik: Bilesik, stopajYuzde: number): Getiri {
  const a = Math.max(0, anapara), r = Math.max(0, yillikOran) / 100, g = Math.max(0, gun);
  const brut = bilesik === 'gunluk' ? a * (Math.pow(1 + r / 365, g) - 1) : a * r * g / 365;
  const stopaj = brut * Math.min(100, Math.max(0, stopajYuzde)) / 100, net = brut - stopaj;
  return { brut, stopaj, net, son: a + net, netYillik: g > 0 ? net * 365 / g : 0 };
}

export type BankaOrani = { banka: string; oran: number };
const ANAHTAR = 'banka_faiz_oranlari';
export async function bankaOranlariniGetir(): Promise<BankaOrani[]> {
  const a = await ayarOku<{ liste?: BankaOrani[] }>(ANAHTAR);
  return (a?.deger?.liste ?? []).filter(x => x && typeof x.banka === 'string' && Number.isFinite(Number(x.oran))).map(x => ({ banka: x.banka, oran: Number(x.oran) }));
}
export async function bankaOranlariniYaz(liste: BankaOrani[]): Promise<void> {
  try { await ayarYaz(ANAHTAR, { liste }); } catch (e) { if (e instanceof CakismaHatasi) await ayarYaz(ANAHTAR, { liste }); else throw e; }
}

/* ——— Getiri motoru: anaparanın faizi anaparaya ya da gelire nasıl akar ——— */
export type Motor = {
  amount: number; rate: number; stopaj: number; months: number; mode: 'gunluk' | 'haftalik' | 'aylik'; perWeek: number;
  reinvest: number; reinvMode: 'pct' | 'tl'; reinvestTL: number; core: number; buffer: number;
};
export const VARSAYILAN_MOTOR: Motor = { amount: 0, rate: 44, stopaj: 15, months: 12, mode: 'haftalik', perWeek: 2, reinvest: 100, reinvMode: 'pct', reinvestTL: 0, core: 0, buffer: 0 };
export type MotorSatiri = { m: number; gross: number; net: number; add: number; inc: number; P: number };
export type MotorSonuc = { rows: MotorSatiri[]; P: number; income: number; P0: number; gain: number; effPct: number; firstAdd: number };
const kurus = (v: number) => Math.round(v * 100) / 100;

export function motorSim(E: Motor): MotorSonuc {
  const P0 = E.amount, yillik = E.rate / 100, stp = E.stopaj / 100;
  const tlMod = E.reinvMode === 'tl', reinv = Math.min(100, Math.max(0, E.reinvest)) / 100, tlTavan = Math.max(0, E.reinvestTL);
  const aylar = Math.max(1, Math.min(120, Math.round(E.months) || 12)), haftada = Math.max(1, Math.min(7, E.perWeek || 1));
  let P = P0, income = 0, totalAdd = 0, totalNet = 0, birik = 0, mG = 0, mN = 0, mA = 0, mI = 0;
  const rows: MotorSatiri[] = [];
  if (E.mode === 'aylik') {
    for (let m = 1; m <= aylar; m++) {
      const gross = kurus(P * yillik * 30 / 365), net = kurus(gross - kurus(gross * stp));
      const add = kurus(tlMod ? Math.min(net, tlTavan) : net * reinv), inc = kurus(net - add);
      P = kurus(P + add); income = kurus(income + inc); totalAdd = kurus(totalAdd + add); totalNet = kurus(totalNet + net);
      rows.push({ m, gross, net, add, inc, P });
    }
  } else {
    for (let gun = 1; gun <= aylar * 30; gun++) {
      const gross = kurus(P * yillik / 365), net = kurus(gross - kurus(gross * stp));
      let ekle = true;
      if (E.mode === 'haftalik') { birik += haftada / 7; if (birik >= 1 - 1e-9) { birik -= 1; ekle = true; } else ekle = false; }
      const add = ekle ? net : 0, inc = kurus(net - add);
      P = kurus(P + add); income = kurus(income + inc); totalAdd = kurus(totalAdd + add); totalNet = kurus(totalNet + net);
      mG = kurus(mG + gross); mN = kurus(mN + net); mA = kurus(mA + add); mI = kurus(mI + inc);
      if (gun % 30 === 0) { rows.push({ m: gun / 30, gross: mG, net: mN, add: mA, inc: mI, P }); mG = mN = mA = mI = 0; }
    }
  }
  return { rows, P, income, P0, gain: kurus(P - P0 + income), effPct: totalNet > 0 ? totalAdd / totalNet * 100 : 0, firstAdd: rows[0]?.add ?? 0 };
}

export async function motorGetir(): Promise<Motor> {
  const a = await ayarOku<Partial<Motor>>('getiri_motoru');
  return { ...VARSAYILAN_MOTOR, ...(a?.deger ?? {}) };
}
export async function motorYaz(m: Motor): Promise<void> {
  try { await ayarYaz('getiri_motoru', m); } catch (e) { if (e instanceof CakismaHatasi) await ayarYaz('getiri_motoru', m); else throw e; }
}
