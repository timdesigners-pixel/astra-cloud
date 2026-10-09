import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';

/* Araç: kiralık araç paketi (km/dakika bakiyesi) ve senetle araç alım planlayıcı. */
export type Surus = { id: string; d: string; km: number; dk: number; nt: string };
export type Paket = { ad: string; aylik: number; kalan: number; bakiye: number; kmUcret: number; yukleme: number; gunlukDk: number; log: Surus[] };
export type Alim = { ad: string; senetFiyat: number; pesinatPct: number; vade: number; aylikFaiz: number; nakitFiyat: number; mod: 'dahil' | 'ekle' };
export type Maliyet = { yilKm: number; yakitTuketim: number; yakitFiyat: number; kasko: number; trafik: number; mtv: number; bakim: number; lastik: number; lastikOmur: number; muayene: number; muayeneYil: number; otopark: number; beklenmeyen: number };
export type Kira = { aylik: number; kmLimit: number; asimUcret: number; depozito: number };
export type Arac = { paket: Paket; alim: Alim; maliyet: Maliyet; kira: Kira; enflasyon: number };

export const VARSAYILAN_ARAC: Arac = {
  paket: { ad: 'Kiralık araç paketi', aylik: 0, kalan: 0, bakiye: 0, kmUcret: 0, yukleme: 0, gunlukDk: 0, log: [] },
  alim: { ad: 'Araç', senetFiyat: 0, pesinatPct: 20, vade: 36, aylikFaiz: 3.2, nakitFiyat: 0, mod: 'ekle' },
  maliyet: { yilKm: 15000, yakitTuketim: 5.2, yakitFiyat: 52, kasko: 38000, trafik: 9500, mtv: 8200, bakim: 14000, lastik: 18000, lastikOmur: 3, muayene: 2400, muayeneYil: 2, otopark: 0, beklenmeyen: 12000 },
  kira: { aylik: 42000, kmLimit: 1250, asimUcret: 6.5, depozito: 60000 },
  enflasyon: 35,
};

export async function aracGetir(): Promise<Arac> {
  const a = await ayarOku<Partial<Arac>>('arac');
  const d = a?.deger ?? {};
  return { paket: { ...VARSAYILAN_ARAC.paket, ...(d.paket ?? {}) }, alim: { ...VARSAYILAN_ARAC.alim, ...(d.alim ?? {}) }, maliyet: { ...VARSAYILAN_ARAC.maliyet, ...(d.maliyet ?? {}) },
    kira: { ...VARSAYILAN_ARAC.kira, ...(d.kira ?? {}) }, enflasyon: d.enflasyon ?? VARSAYILAN_ARAC.enflasyon };
}
export async function aracYaz(v: Arac): Promise<void> {
  try { await ayarYaz('arac', v); } catch (e) { if (e instanceof CakismaHatasi) await ayarYaz('arac', v); else throw e; }
}

/* Anapara, taksit ve ay sayısından aylık ima edilen faiz (%), ikiye bölme ile. */
export function imaFaiz(anapara: number, taksit: number, ay: number): number {
  if (!(anapara > 0 && taksit > 0 && ay > 0) || taksit * ay <= anapara) return 0;
  let lo = 0, hi = 1;
  for (let k = 0; k < 80; k++) {
    const i = (lo + hi) / 2;
    const t = i > 0 ? anapara * i * Math.pow(1 + i, ay) / (Math.pow(1 + i, ay) - 1) : anapara / ay;
    if (t > taksit) hi = i; else lo = i;
  }
  return (lo + hi) / 2 * 100;
}

export type AlimHesabi = {
  dahil: boolean; fiyat: number; pesinat: number; anapara: number; taksit: number; ay: number; toplamOdeme: number; toplamFaiz: number;
  nakit: number; gercekMaliyet: number; yillikEtkin: number; faiz: number; ilanFaiz: number;
};
export function alimHesapla(a: Alim): AlimHesabi {
  const fiyat = a.senetFiyat, pesinat = fiyat * a.pesinatPct / 100, anapara = fiyat - pesinat, ay = Math.max(1, Math.round(a.vade)), nakit = a.nakitFiyat;
  const dahil = a.mod === 'dahil';
  let taksit: number, toplamOdeme: number, faiz: number;
  if (dahil) { taksit = anapara / ay; toplamOdeme = fiyat; faiz = nakit > 0 ? imaFaiz(Math.max(0, nakit - pesinat), taksit, ay) : 0; }
  else {
    const i = a.aylikFaiz / 100;
    taksit = i > 0 ? anapara * i * Math.pow(1 + i, ay) / (Math.pow(1 + i, ay) - 1) : anapara / ay;
    toplamOdeme = pesinat + taksit * ay; faiz = a.aylikFaiz;
  }
  const gercekMaliyet = nakit > 0 ? toplamOdeme - nakit : 0;
  return {
    dahil, fiyat, pesinat, anapara, taksit, ay, toplamOdeme, toplamFaiz: nakit > 0 ? gercekMaliyet : dahil ? 0 : toplamOdeme - fiyat,
    nakit, gercekMaliyet, yillikEtkin: faiz > 0 ? (Math.pow(1 + faiz / 100, 12) - 1) * 100 : 0, faiz, ilanFaiz: a.aylikFaiz,
  };
}

/* Toplam sahip olma maliyeti: yakıt km'ye bağlı, geri kalanı yıllık sabit. */
export function sahipOlmaMaliyeti(t: Maliyet) {
  const yakit = t.yilKm / 100 * t.yakitTuketim * t.yakitFiyat;
  const kalem: [string, number][] = ([
    ['Yakıt', yakit], ['Kasko', t.kasko], ['Zorunlu trafik', t.trafik], ['MTV', t.mtv], ['Periyodik bakım', t.bakim],
    ['Lastik (yıllığa bölünmüş)', t.lastik / Math.max(1, t.lastikOmur)], ['Muayene (yıllığa bölünmüş)', t.muayene / Math.max(1, t.muayeneYil)],
    ['Otopark', t.otopark * 12], ['Beklenmeyen (arıza, cam, muafiyet)', t.beklenmeyen],
  ] as [string, number][]).filter(x => x[1] > 0);
  const yillik = kalem.reduce((a, x) => a + x[1], 0);
  return { kalem, yillik, aylik: yillik / 12, kmBasi: t.yilKm ? yillik / t.yilKm : 0, yakit };
}
/* Uzun dönem kiralama: km limiti aşımı ek ücret; yakıt kiracıya ait, diğer giderler kiraya dahil. */
export function kiralamaMaliyeti(k: Kira, t: Maliyet) {
  const limitYil = k.kmLimit * 12, asimKm = Math.max(0, t.yilKm - limitYil), asim = asimKm * k.asimUcret;
  const yakit = t.yilKm / 100 * t.yakitTuketim * t.yakitFiyat, yillikToplam = k.aylik * 12 + asim + yakit;
  return { limitYil, asimKm, asim, yakit, yillikToplam };
}
/* Aracın değer kaybı ilk yıl ağır, sonra yavaşlar (1. yıl %22, sonrası %12 bileşik). */
export function degerEgrisi(taban: number, enflasyon: number, yil: number) {
  const satir: { yil: number; reel: number; nominal: number; kayip: number; kayipPct: number }[] = [];
  let deger = taban;
  for (let y = 1; y <= yil; y++) {
    deger *= 1 - (y === 1 ? 22 : 12) / 100;
    satir.push({ yil: y, reel: Math.round(deger), nominal: Math.round(deger * Math.pow(1 + enflasyon / 100, y)), kayip: Math.round(taban - deger), kayipPct: taban ? Math.round((1 - deger / taban) * 100) : 0 });
  }
  return satir;
}
/* Y. yılın sonunda aracı elden çıkarırsan net maliyet: ödenen taksitler + kalan senet borcu + sahip olma gideri − elde kalan değer; kiralamayla karşılaştırılır. */
export function sahipOlmaKarsiKira(v: Arac, yil = 5) {
  const h = alimHesapla(v.alim), T = sahipOlmaMaliyeti(v.maliyet), K = kiralamaMaliyeti(v.kira, v.maliyet);
  const egri = degerEgrisi(v.alim.nakitFiyat || v.alim.senetFiyat, v.enflasyon, yil);
  return egri.map(x => {
    const ay = x.yil * 12, odenenAy = Math.min(ay, v.alim.vade), kalanBorc = h.taksit * Math.max(0, v.alim.vade - odenenAy);
    const sahipNet = Math.round(h.pesinat + h.taksit * odenenAy + kalanBorc + T.yillik * x.yil - x.reel), kiraNet = Math.round(K.yillikToplam * x.yil);
    return { ...x, kalanBorc: Math.round(kalanBorc), sahipNet, kiraNet, fark: sahipNet - kiraNet };
  });
}
