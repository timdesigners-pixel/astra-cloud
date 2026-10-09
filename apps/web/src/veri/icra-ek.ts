import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from './kayit';

/* İcra dosyasına bağlı hacizler ve anlaşılan ödeme planı (taksit takibi). */
export const HACIZ_TURLERI: [string, string, string][] = [
  ['maas', 'Maaş / ücret', 'İİK 83 — kural olarak 1/4'],
  ['banka', 'Banka hesabı', 'İİK 89 — hesap bakiyesi'],
  ['kira', 'Kira alacağı', 'İİK 89 — kiracıya ihbarname'],
  ['arac', 'Araç', 'trafik siciline şerh'],
  ['tasinmaz', 'Taşınmaz', 'tapuya şerh'],
  ['ucuncu', 'Üçüncü kişideki alacak', 'İİK 89'],
  ['menkul', 'Menkul / ev eşyası', 'haczedilmezlik itirazı mümkün'],
];
export const hacizAdi = (t: string) => HACIZ_TURLERI.find(x => x[0] === t)?.[1] ?? t;

export type Haciz = { id: string; surum: number; icra_id: string; tur: string; hedef: string | null; tutar: number; tarih: string; durum: 'aktif' | 'kalkti'; notlar: string | null };
export type PlanOdeme = { id: string; tarih: string; tutar: number };
export type Plan = { id: string; surum: number; icra_id: string; taksit: number; adet: number; baslangic: string; odemeler: PlanOdeme[] };

const HACIZ_SUTUN = ['icra_id', 'tur', 'hedef', 'tutar', 'tarih', 'durum', 'notlar'];
const PLAN_SUTUN = ['icra_id', 'taksit', 'adet', 'baslangic', 'odemeler'];
const sayi = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const haciz = (k: Kayit): Haciz => ({ ...(k as unknown as Haciz), tutar: sayi(k.tutar) });
const plan = (k: Kayit): Plan => ({ ...(k as unknown as Plan), taksit: sayi(k.taksit), adet: sayi(k.adet), odemeler: Array.isArray(k.odemeler) ? (k.odemeler as PlanOdeme[]).map(o => ({ ...o, tutar: sayi(o.tutar) })) : [] });

export const hacizlariGetir = async () => (await kayitlariGetir('icra_hacizler', HACIZ_SUTUN, {}, 'tarih')).map(haciz);
export const hacizEkle = async (g: Omit<Haciz, 'id' | 'surum'>) => haciz(await kayitEkle('icra_hacizler', HACIZ_SUTUN, g));
export const hacizGuncelle = async (h: Pick<Haciz, 'id' | 'surum'>, g: Partial<Omit<Haciz, 'id' | 'surum' | 'icra_id'>> & { silindi_at?: string | null }) =>
  haciz(await kayitGuncelle('icra_hacizler', HACIZ_SUTUN, h.id, h.surum, g));

export const planlariGetir = async () => (await kayitlariGetir('icra_planlari', PLAN_SUTUN, {}, 'baslangic')).map(plan);
export const planEkle = async (g: Omit<Plan, 'id' | 'surum'>) => plan(await kayitEkle('icra_planlari', PLAN_SUTUN, g));
export const planGuncelle = async (p: Pick<Plan, 'id' | 'surum'>, g: Partial<Omit<Plan, 'id' | 'surum' | 'icra_id'>> & { silindi_at?: string | null }) =>
  plan(await kayitGuncelle('icra_planlari', PLAN_SUTUN, p.id, p.surum, g));

/* Taksit durumu: başlangıç ayından bugüne kadar beklenen taksit adedi ile yapılan ödemeler karşılaştırılır. */
export type PlanDurumu = { odenen: number; toplam: number; kalan: number; beklenenAdet: number; beklenen: number; gecikme: number; odenenAdet: number; durum: 'geride' | 'guncel' | 'bitti' };
export function planDurumu(p: Pick<Plan, 'taksit' | 'adet' | 'baslangic' | 'odemeler'>, bugun: string): PlanDurumu {
  const odenen = p.odemeler.reduce((t, o) => t + o.tutar, 0);
  const toplam = p.taksit * p.adet;
  const [by, bm] = p.baslangic.split('-').map(Number), [ty, tm] = bugun.split('-').map(Number);
  const ay = (ty! - by!) * 12 + (tm! - bm!) + 1;
  const beklenenAdet = Math.max(0, Math.min(p.adet, ay));
  const beklenen = beklenenAdet * p.taksit, gecikme = beklenen - odenen;
  return {
    odenen, toplam, kalan: Math.max(0, toplam - odenen), beklenenAdet, beklenen, gecikme,
    odenenAdet: Math.floor(odenen / Math.max(1, p.taksit)),
    durum: gecikme > 0.5 ? 'geride' : odenen >= toplam - 0.5 ? 'bitti' : 'guncel',
  };
}
