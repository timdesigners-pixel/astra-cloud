/* Strateji kural motoru: her borcu tek kuralla bir gruba atar.
   Kural 0: banka borcu her zaman önce · 1: hukuki risk (tahliye, ilamlı, haciz) faizden bağımsız hemen · 2: faiz ≥ mevduat neti → tutmak zarar
   3: büyük dosya (≥300.000 TL) → iskonto pazarlığı · 4: ucuz taksitli borç → tut, para faizde kalsın · 5: kalan küçük/faizsiz borçlar → temizle. */
export type Grup = 'banka' | 'hemen' | 'pazarlik' | 'taksit';
export const GRUP_ADI: Record<Grup, [string, string]> = {
  banka: ['Banka borçları', 'Kural 0: banka borcu her zaman önce kapatılır.'],
  hemen: ['Hemen kapat', 'Hukuki risk taşıyan, faizi mevduat netini aşan ya da küçük ve faizsiz kalan borçlar.'],
  pazarlik: ['Pazarlık et', 'Büyük dosyalarda iskonto pazarlığı yapılır; peşin kapatma ancak indirimle mantıklıdır.'],
  taksit: ['Taksiti tut', 'Faizi mevduat netinin altında ve taksitli: borcu taşı, parayı faizde bırak.'],
};
export type StratejiBorc = { id: string; ad: string; tur: string; tutar: number; faiz: number; taksit: number; riskli: boolean; neden: string; grup: Grup };
type Satir = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export function stratejiGrupla(borclar: Satir[], odemeler: Satir[], riskliAdlar: string[], esik: number): StratejiBorc[] {
  const bekleyen = odemeler.filter(o => o.durum === 'bekliyor');
  return borclar.filter(b => b.yon !== 'alacakli' && b.durum !== 'kapandi' && n(b.guncel_borc) > 0).map(b => {
    const ad = String(b.ad), o = bekleyen.filter(x => x.borc_id === b.id);
    const taksit = o.length ? o.reduce((t, x) => t + n(x.tutar), 0) / o.length : 0;
    const tutar = n(b.guncel_borc), faiz = n(b.faiz_orani), metin = ad.toLocaleLowerCase('tr');
    const riskli = /tahliye|ilaml|haciz/.test(metin) || riskliAdlar.some(a => a && ad.includes(a));
    let grup: Grup, neden: string;
    if (b.tur === 'banka') { grup = 'banka'; neden = 'banka borcu'; }
    else if (riskli) { grup = 'hemen'; neden = 'hukuki risk (ilamlı, tahliye ya da haciz)'; }
    else if (faiz >= esik && faiz > 0) { grup = 'hemen'; neden = `faiz %${faiz} ≥ mevduat neti %${esik.toFixed(1)}`; }
    else if (tutar >= 300000) { grup = 'pazarlik'; neden = 'büyük dosya: iskonto pazarlığı'; }
    else if (taksit > 0 && faiz < esik) { grup = 'taksit'; neden = 'ucuz taksit: tut, para faizde kalsın'; }
    else { grup = 'hemen'; neden = 'küçük ya da faizsiz: temizle'; }
    return { id: String(b.id), ad, tur: String(b.tur ?? ''), tutar, faiz, taksit, riskli, neden, grup };
  }).sort((a, b) => b.faiz - a.faiz || b.tutar - a.tutar);
}
