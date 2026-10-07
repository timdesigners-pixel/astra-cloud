import { istemciAl, sunucuAdresi } from './istemci';
import { bugunAnahtari } from '../ortak/zaman';

/* Sağlık ölçümleri: gün + tür + kaynak başına tek satır. Cihaz verisi sunucudaki alıcıdan, dosya içe aktarımı ve elle giriş buradan yazılır. */
export type OlcumTuru = 'adim' | 'mesafe_m' | 'kalori_aktif' | 'egzersiz_dk' | 'nabiz' | 'dinlenme_nabzi' | 'hrv' | 'uyku_dk' | 'su_ml'
  | 'kilo' | 'yag_orani' | 'spo2' | 'tansiyon_sis' | 'tansiyon_dia' | 'glukoz' | 'ates';
export type Kaynak = 'elle' | 'saat' | 'telefon' | 'dosya';
export type Olcum = { id?: string; gun: string; tur: OlcumTuru; kaynak: Kaynak; deger: number; en_az?: number | null; en_cok?: number | null; ornek?: number | null };
export type Birlesik = { gun: string; tur: OlcumTuru; deger: number; en_az: number | null; en_cok: number | null; kaynak: Kaynak | 'gunluk'; id?: string };

export type TurBilgi = {
  etiket: string; birim: string; simge: string; ondalik: number;
  /** günlük toplam mı (adım), gün ortalaması mı (nabız) yoksa o günün son ölçümü mü (kilo) */
  tur: 'toplam' | 'ortalama' | 'son';
  /** sağlıklı aralık; dışına çıkan değer renkle işaretlenir */
  aralik?: [number, number];
  nokta?: boolean;
};
export const TUR_BILGI: Record<OlcumTuru, TurBilgi> = {
  adim: { etiket: 'Adım', birim: 'adım', simge: '👣', ondalik: 0, tur: 'toplam' },
  mesafe_m: { etiket: 'Mesafe', birim: 'm', simge: '📏', ondalik: 0, tur: 'toplam' },
  kalori_aktif: { etiket: 'Aktif kalori', birim: 'kcal', simge: '🔥', ondalik: 0, tur: 'toplam' },
  egzersiz_dk: { etiket: 'Egzersiz', birim: 'dk', simge: '🏃', ondalik: 0, tur: 'toplam' },
  nabiz: { etiket: 'Nabız', birim: 'atım/dk', simge: '❤️', ondalik: 0, tur: 'ortalama', aralik: [50, 100] },
  dinlenme_nabzi: { etiket: 'Dinlenme nabzı', birim: 'atım/dk', simge: '💓', ondalik: 0, tur: 'ortalama', aralik: [40, 80] },
  hrv: { etiket: 'Kalp hızı değişkenliği', birim: 'ms', simge: '〰️', ondalik: 0, tur: 'ortalama' },
  uyku_dk: { etiket: 'Uyku', birim: 'saat', simge: '😴', ondalik: 1, tur: 'toplam', aralik: [420, 540] },
  su_ml: { etiket: 'Su', birim: 'ml', simge: '💧', ondalik: 0, tur: 'toplam' },
  kilo: { etiket: 'Kilo', birim: 'kg', simge: '⚖️', ondalik: 1, tur: 'son', nokta: true },
  yag_orani: { etiket: 'Yağ oranı', birim: '%', simge: '📉', ondalik: 1, tur: 'son', nokta: true },
  spo2: { etiket: 'Oksijen (SpO₂)', birim: '%', simge: '🫁', ondalik: 0, tur: 'ortalama', aralik: [95, 100] },
  tansiyon_sis: { etiket: 'Büyük tansiyon', birim: 'mmHg', simge: '🩺', ondalik: 0, tur: 'ortalama', aralik: [90, 129], nokta: true },
  tansiyon_dia: { etiket: 'Küçük tansiyon', birim: 'mmHg', simge: '🩺', ondalik: 0, tur: 'ortalama', aralik: [60, 84], nokta: true },
  glukoz: { etiket: 'Kan şekeri', birim: 'mg/dL', simge: '🩸', ondalik: 0, tur: 'ortalama', aralik: [70, 125], nokta: true },
  ates: { etiket: 'Vücut ısısı', birim: '°C', simge: '🌡️', ondalik: 1, tur: 'ortalama', aralik: [35.5, 37.5], nokta: true },
};
export const TURLER = Object.keys(TUR_BILGI) as OlcumTuru[];
export const KAYNAK_ADI: Record<string, string> = { elle: 'elle', saat: 'akıllı saat', telefon: 'telefon', dosya: 'dosya', gunluk: 'günlük kayıt' };

/** Gösterim değeri: uyku dakikadan saate çevrilir. */
export const gosterimDegeri = (tur: OlcumTuru, d: number) => (tur === 'uyku_dk' ? d / 60 : d);
export function degerYaz(tur: OlcumTuru, d: number | null | undefined, birimle = true): string {
  if (d === null || d === undefined) return '—';
  const b = TUR_BILGI[tur];
  const g = gosterimDegeri(tur, d);
  const metin = g.toLocaleString('tr-TR', { minimumFractionDigits: b.ondalik, maximumFractionDigits: b.ondalik });
  return birimle ? `${metin} ${b.birim}` : metin;
}
export const uykuMetni = (dk: number) => `${Math.floor(dk / 60)}s ${String(Math.round(dk % 60)).padStart(2, '0')}dk`;

const SUTUN = 'id,gun,tur,kaynak,deger,en_az,en_cok,ornek';
const SAYFA = 1000;
const gunOnce = (n: number) => new Date(Date.parse(bugunAnahtari()) - n * 86400000).toISOString().slice(0, 10);

export async function olcumleriGetir(gunSayisi: number): Promise<Olcum[]> {
  const baslangic = gunOnce(gunSayisi);
  const hepsi: Olcum[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await istemciAl().from('saglik_olcumleri').select(SUTUN).gte('gun', baslangic).order('gun').range(bas, bas + SAYFA - 1);
    if (error) throw error;
    const k = (data ?? []).map(s => ({ ...s, deger: Number(s.deger), en_az: s.en_az === null ? null : Number(s.en_az), en_cok: s.en_cok === null ? null : Number(s.en_cok) })) as Olcum[];
    hepsi.push(...k);
    if (k.length < SAYFA) return hepsi;
  }
}

/** Elle girilen ve dosyadan okunan ölçümleri yazar; aynı gün-tür-kaynak varsa üzerine yazar. */
export async function olcumleriKaydet(satirlar: Olcum[]): Promise<void> {
  for (let i = 0; i < satirlar.length; i += 500) {
    const parca = satirlar.slice(i, i + 500).map(s => ({ gun: s.gun, tur: s.tur, kaynak: s.kaynak, deger: s.deger, en_az: s.en_az ?? null, en_cok: s.en_cok ?? null, ornek: s.ornek ?? null }));
    const { error } = await istemciAl().from('saglik_olcumleri').upsert(parca, { onConflict: 'sahip_id,gun,tur,kaynak' });
    if (error) throw error;
  }
}
export async function olcumSil(id: string): Promise<void> {
  const { error } = await istemciAl().from('saglik_olcumleri').delete().eq('id', id);
  if (error) throw error;
}

type Gunluk = { gun: string; adim: number | null; su_ml: number | null; uyku: string | null; tansiyon: string | null; nabiz: number | null };
async function gunlukleriGetir(gunSayisi: number): Promise<Gunluk[]> {
  const { data, error } = await istemciAl().from('saglik_gunluk').select('gun,adim,su_ml,uyku,tansiyon,nabiz').is('silindi_at', null).gte('gun', gunOnce(gunSayisi)).order('gun').limit(2000);
  if (error) throw error;
  return (data ?? []) as Gunluk[];
}

/** Günlük kayıttaki ("7s 11dk", "118/78") değerleri ölçüm biçimine çevirir. */
export function gunluktenOlcum(g: Gunluk): Birlesik[] {
  const c: Birlesik[] = [];
  const ekle = (tur: OlcumTuru, deger: number | null | undefined) => { if (deger !== null && deger !== undefined && Number.isFinite(deger) && deger > 0) c.push({ gun: g.gun, tur, deger, en_az: null, en_cok: null, kaynak: 'gunluk' }); };
  ekle('adim', g.adim); ekle('su_ml', g.su_ml); ekle('nabiz', g.nabiz);
  const u = g.uyku?.match(/(\d+)\s*s(?:\s*(\d+)\s*dk)?/i) ?? g.uyku?.match(/^(\d+)[.,]?(\d*)\s*(?:saat)?$/i);
  if (u && g.uyku) ekle('uyku_dk', g.uyku.includes('s') ? Number(u[1]) * 60 + Number(u[2] ?? 0) : Number(`${u[1]}.${u[2] || 0}`) * 60);
  const t = g.tansiyon?.match(/(\d{2,3})\s*[/\\-]\s*(\d{2,3})/);
  if (t) { ekle('tansiyon_sis', Number(t[1])); ekle('tansiyon_dia', Number(t[2])); }
  return c;
}

const ONCELIK: Kaynak[] = ['saat', 'telefon', 'dosya', 'elle'];
const ANLIK_ONCELIK: Kaynak[] = ['elle', 'saat', 'telefon', 'dosya'];
const ANLIK = new Set<OlcumTuru>(['kilo', 'yag_orani', 'tansiyon_sis', 'tansiyon_dia', 'glukoz', 'ates', 'spo2']);

/** Aynı gün ve tür için birden çok kaynak varsa tek değer seçilir: cihaz verisi tam gün toplamı verdiği için öne geçer, anlık ölçümlerde elle girilen. */
export function birlestir(olcumler: Olcum[], gunlukler: Gunluk[]): Birlesik[] {
  const secilen = new Map<string, Birlesik & { sira: number }>();
  const dene = (b: Birlesik, sira: number) => {
    const k = b.gun + '|' + b.tur;
    const m = secilen.get(k);
    if (!m || sira < m.sira) secilen.set(k, { ...b, sira });
  };
  for (const o of olcumler) {
    const liste = ANLIK.has(o.tur) ? ANLIK_ONCELIK : ONCELIK;
    dene({ gun: o.gun, tur: o.tur, deger: o.deger, en_az: o.en_az ?? null, en_cok: o.en_cok ?? null, kaynak: o.kaynak, id: o.id }, liste.indexOf(o.kaynak));
  }
  gunlukler.flatMap(gunluktenOlcum).forEach(b => dene(b, 10));
  return [...secilen.values()].map(({ sira: _s, ...b }) => b).sort((a, b) => a.gun.localeCompare(b.gun));
}

export async function sagligiGetir(gunSayisi: number): Promise<Birlesik[]> {
  const [o, g] = await Promise.all([olcumleriGetir(gunSayisi), gunlukleriGetir(gunSayisi)]);
  return birlestir(o, g);
}

/* ——— Senkron anahtarları ——— */
export type Anahtar = { id: string; ad: string; olusturma: string; son_kullanim: string | null; son_sonuc: string | null; kullanim_sayisi: number; iptal_at: string | null };
export const ANAHTAR_SUTUN = 'id,ad,olusturma,son_kullanim,son_sonuc,kullanim_sayisi,iptal_at';
export const esitlemeAdresi = () => `${sunucuAdresi()}/functions/v1/saglik-esitle`;

export async function anahtarlariGetir(): Promise<Anahtar[]> {
  const { data, error } = await istemciAl().from('saglik_anahtarlari').select(ANAHTAR_SUTUN).order('olusturma', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Anahtar[];
}
const ozetle = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
/** Yeni anahtar üretir; anahtarın kendisi yalnız bu çağrıda döner, sunucuda yalnız özeti saklanır. */
export async function anahtarUret(ad: string): Promise<{ kayit: Anahtar; belirtec: string }> {
  const ham = crypto.getRandomValues(new Uint8Array(24));
  const belirtec = 'astra_sag_' + btoa(String.fromCharCode(...ham)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const { data, error } = await istemciAl().from('saglik_anahtarlari').insert({ ad: ad.trim().slice(0, 80), belirtec_ozeti: await ozetle(belirtec) }).select(ANAHTAR_SUTUN).single();
  if (error) throw error;
  return { kayit: data as Anahtar, belirtec };
}
export async function anahtarIptal(id: string): Promise<void> {
  const { error } = await istemciAl().from('saglik_anahtarlari').update({ iptal_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

