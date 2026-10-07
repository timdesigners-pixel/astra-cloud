// Cihaz ve uygulamalardan gelen sağlık verisini günlük ölçüm satırlarına çevirir. Ağ ve Deno'ya bağımlı değildir (Node'da da çalışır).
//   1. Basit biçim:   { tarih, adim, nabiz, uyku_saat, kilo, tansiyon: "118/78", ... }  ya da bunların dizisi / { gunler: [...] }
//   2. Satır biçimi:  { olcumler: [{ gun, tur, deger, en_az, en_cok, ornek }] }
//   3. Health Auto Export (iPhone) JSON'u: { data: { metrics: [{ name, units, data: [...] }] } }

export const TURLER = ['adim', 'mesafe_m', 'kalori_aktif', 'egzersiz_dk', 'nabiz', 'dinlenme_nabzi', 'hrv', 'uyku_dk', 'su_ml',
  'kilo', 'yag_orani', 'spo2', 'tansiyon_sis', 'tansiyon_dia', 'glukoz', 'ates'] as const;
export type Tur = (typeof TURLER)[number];
export type Satir = { gun: string; tur: Tur; deger: number; en_az?: number; en_cok?: number; ornek?: number };

const SINIR: Record<Tur, [number, number]> = {
  adim: [0, 200000], mesafe_m: [0, 300000], kalori_aktif: [0, 20000], egzersiz_dk: [0, 1440], nabiz: [20, 250], dinlenme_nabzi: [20, 200],
  hrv: [0, 500], uyku_dk: [0, 1440], su_ml: [0, 20000], kilo: [20, 400], yag_orani: [1, 80], spo2: [50, 100], tansiyon_sis: [50, 260],
  tansiyon_dia: [30, 160], glukoz: [20, 800], ates: [30, 45],
};
const TOPLAM = new Set<Tur>(['adim', 'mesafe_m', 'kalori_aktif', 'egzersiz_dk', 'uyku_dk', 'su_ml']);
const SON = new Set<Tur>(['kilo', 'yag_orani']);
const AZAMI_SATIR = 10000;

const yalin = (s: string) => s.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]/g, '');
const sayi = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v.trim().replace(',', '.')); return Number.isFinite(n) ? n : null; }
  return null;
};

/** Yerel gün: "2026-10-07", "2026-10-07 08:00:00 +0300", ISO, "07.10.2026" ya da epoch (İstanbul günü). */
export function gunCoz(v: unknown): string | null {
  let g: string | null = null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v > 1e11 ? v : v * 1000;
    g = new Date(ms + 3 * 3600000).toISOString().slice(0, 10);
  } else if (typeof v === 'string') {
    const s = v.trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const tr = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (iso) g = `${iso[1]}-${iso[2]}-${iso[3]}`;
    else if (tr) g = `${tr[3]}-${tr[2]!.padStart(2, '0')}-${tr[1]!.padStart(2, '0')}`;
  }
  if (!g || Number.isNaN(Date.parse(g))) return null;
  const t = Date.parse(g);
  if (t < Date.parse('2000-01-01') || t > Date.now() + 2 * 86400000) return null;
  return g;
}

type Birikim = { tur: Tur; gun: string; toplam: number; n: number; en_az?: number; en_cok?: number; son?: number; sonSira: string };
class Toplayici {
  private m = new Map<string, Birikim>();
  ekle(gun: string, tur: Tur, deger: number, o: { en_az?: number; en_cok?: number; n?: number; sira?: string } = {}) {
    const [alt, ust] = SINIR[tur];
    if (!Number.isFinite(deger) || deger < alt || deger > ust) return;
    const k = gun + '|' + tur;
    const b = this.m.get(k) ?? { tur, gun, toplam: 0, n: 0, sonSira: '' };
    const n = o.n ?? 1;
    if (TOPLAM.has(tur)) b.toplam += deger; else b.toplam += deger * n;
    b.n += n;
    const kucuk = o.en_az ?? deger, buyuk = o.en_cok ?? deger;
    b.en_az = Math.min(b.en_az ?? kucuk, kucuk); b.en_cok = Math.max(b.en_cok ?? buyuk, buyuk);
    const sira = o.sira ?? '';
    if (sira >= b.sonSira) { b.son = deger; b.sonSira = sira; }
    this.m.set(k, b);
  }
  satirlar(): Satir[] {
    const s: Satir[] = [];
    for (const b of this.m.values()) {
      const deger = TOPLAM.has(b.tur) ? b.toplam : SON.has(b.tur) ? b.son! : b.toplam / b.n;
      const yuvarla = (x: number) => Math.round(x * 100) / 100;
      const r: Satir = { gun: b.gun, tur: b.tur, deger: yuvarla(deger), ornek: b.n };
      if (!TOPLAM.has(b.tur) && !SON.has(b.tur) && b.en_az !== b.en_cok) { r.en_az = yuvarla(b.en_az!); r.en_cok = yuvarla(b.en_cok!); }
      s.push(r);
    }
    return s.sort((a, b) => a.gun.localeCompare(b.gun) || a.tur.localeCompare(b.tur));
  }
}

/* ——— Basit biçim ——— */
const ANAHTAR: Record<string, { tur: Tur; carpan?: number }> = {};
const kaydet = (tur: Tur, adlar: string[], carpan?: number) => adlar.forEach(a => { ANAHTAR[yalin(a)] = { tur, carpan }; });
kaydet('adim', ['adim', 'adim_sayisi', 'step', 'steps', 'step_count', 'stepcount']);
kaydet('mesafe_m', ['mesafe_m', 'distance_m', 'mesafem']);
kaydet('mesafe_m', ['mesafe_km', 'mesafe', 'distance_km', 'distance', 'km'], 1000);
kaydet('kalori_aktif', ['kalori_aktif', 'kalori', 'aktif_kalori', 'calories', 'active_calories', 'active_energy', 'activeenergyburned']);
kaydet('egzersiz_dk', ['egzersiz_dk', 'egzersiz', 'exercise_minutes', 'exercise_time', 'exercise']);
kaydet('nabiz', ['nabiz', 'ort_nabiz', 'kalp_atisi', 'heart_rate', 'heartrate', 'hr', 'pulse', 'bpm']);
kaydet('dinlenme_nabzi', ['dinlenme_nabzi', 'resting_heart_rate', 'resting_hr', 'rhr']);
kaydet('hrv', ['hrv', 'kalp_hizi_degiskenligi', 'heart_rate_variability']);
kaydet('uyku_dk', ['uyku_dk', 'sleep_minutes', 'sleep_min']);
kaydet('uyku_dk', ['uyku_saat', 'uyku', 'sleep', 'sleep_hours', 'sleep_duration'], 60);
kaydet('su_ml', ['su_ml', 'water_ml', 'water']);
kaydet('su_ml', ['su_l', 'water_l'], 1000);
kaydet('kilo', ['kilo', 'agirlik', 'weight', 'body_mass', 'weight_kg']);
kaydet('yag_orani', ['yag_orani', 'vucut_yagi', 'body_fat', 'body_fat_percentage']);
kaydet('spo2', ['spo2', 'oksijen', 'oxygen', 'blood_oxygen', 'oxygen_saturation']);
kaydet('tansiyon_sis', ['tansiyon_sis', 'sistolik', 'systolic']);
kaydet('tansiyon_dia', ['tansiyon_dia', 'diyastolik', 'diastolic']);
kaydet('glukoz', ['glukoz', 'seker', 'kan_sekeri', 'glucose', 'blood_glucose']);
kaydet('ates', ['ates', 'temperature', 'body_temperature']);
const TARIH_ANAHTAR = new Set(['tarih', 'date', 'gun', 'day', 'zaman', 'timestamp'].map(yalin));

function basitGun(o: Record<string, unknown>, t: Toplayici, varsayilanGun: string) {
  let gun: string | null = null;
  for (const [k, v] of Object.entries(o)) if (TARIH_ANAHTAR.has(yalin(k))) { gun = gunCoz(v); if (gun) break; }
  gun ??= varsayilanGun;
  for (const [k, v] of Object.entries(o)) {
    const nk = yalin(k);
    if (nk === 'tansiyon' || nk === 'bloodpressure') {
      const m = typeof v === 'string' ? v.match(/(\d{2,3})\s*[/\\-]\s*(\d{2,3})/) : null;
      if (m) { t.ekle(gun, 'tansiyon_sis', Number(m[1])); t.ekle(gun, 'tansiyon_dia', Number(m[2])); }
      continue;
    }
    const a = ANAHTAR[nk];
    if (!a) continue;
    const n = sayi(v);
    if (n !== null) t.ekle(gun, a.tur, n * (a.carpan ?? 1));
  }
}

/* ——— Health Auto Export ——— */
type Birim = (v: number, birim: string) => number;
const KM_MI: Birim = (v, b) => (/^mi/.test(b) ? v * 1609.344 : /^km|kilomet/.test(b) ? v * 1000 : v);
const KCAL: Birim = (v, b) => (/kj/.test(b) ? v / 4.184 : v);
const YUZDE: Birim = v => (v > 0 && v <= 1 ? v * 100 : v);
const KILO: Birim = (v, b) => (/^lb/.test(b) ? v * 0.45359237 : /^st/.test(b) ? v * 6.35029 : v);
const GLUKOZ: Birim = (v, b) => (/mmol/.test(b) ? v * 18.016 : v);
const ATES: Birim = (v, b) => (/f/.test(b) ? (v - 32) / 1.8 : v);
const SU: Birim = (v, b) => (/^l|litre/.test(b) && !/fl/.test(b) ? v * 1000 : /fl|oz/.test(b) ? v * 29.5735 : v);
const SAAT_DK: Birim = (v, b) => (/min|dk/.test(b) ? v : v * 60);
const HIC: Birim = v => v;

const METRIKLER: Record<string, { tur: Tur; birim: Birim }> = {
  step_count: { tur: 'adim', birim: HIC },
  walking_running_distance: { tur: 'mesafe_m', birim: KM_MI }, distance_walking_running: { tur: 'mesafe_m', birim: KM_MI },
  active_energy: { tur: 'kalori_aktif', birim: KCAL }, active_energy_burned: { tur: 'kalori_aktif', birim: KCAL },
  apple_exercise_time: { tur: 'egzersiz_dk', birim: HIC },
  heart_rate: { tur: 'nabiz', birim: HIC }, resting_heart_rate: { tur: 'dinlenme_nabzi', birim: HIC },
  heart_rate_variability: { tur: 'hrv', birim: HIC }, heart_rate_variability_sdnn: { tur: 'hrv', birim: HIC },
  blood_oxygen_saturation: { tur: 'spo2', birim: YUZDE }, oxygen_saturation: { tur: 'spo2', birim: YUZDE },
  body_mass: { tur: 'kilo', birim: KILO }, weight_body_mass: { tur: 'kilo', birim: KILO },
  body_fat_percentage: { tur: 'yag_orani', birim: YUZDE },
  blood_pressure_systolic: { tur: 'tansiyon_sis', birim: HIC }, blood_pressure_diastolic: { tur: 'tansiyon_dia', birim: HIC },
  blood_glucose: { tur: 'glukoz', birim: GLUKOZ }, body_temperature: { tur: 'ates', birim: ATES },
  dietary_water: { tur: 'su_ml', birim: SU },
};

function metrikIsle(m: Record<string, unknown>, t: Toplayici) {
  const ad = yalin(String(m.name ?? '')).replace(/_/g, '');
  const birimMetni = String(m.units ?? '').toLowerCase();
  const kayitlar = Array.isArray(m.data) ? (m.data as Record<string, unknown>[]) : [];
  const anahtar = Object.keys(METRIKLER).find(k => yalin(k) === ad);
  for (const e of kayitlar) {
    if (!e || typeof e !== 'object') continue;
    const gun = gunCoz(e.date);
    if (!gun) continue;
    const sira = String(e.date);
    if (ad === 'bloodpressure') {
      const s = sayi(e.systolic), d = sayi(e.diastolic);
      if (s !== null) t.ekle(gun, 'tansiyon_sis', s, { sira });
      if (d !== null) t.ekle(gun, 'tansiyon_dia', d, { sira });
      continue;
    }
    if (ad === 'sleepanalysis') {
      const saat = sayi(e.totalSleep) ?? sayi(e.asleep) ?? ((sayi(e.core) ?? 0) + (sayi(e.deep) ?? 0) + (sayi(e.rem) ?? 0) || null) ?? sayi(e.qty);
      if (saat !== null) t.ekle(gun, 'uyku_dk', SAAT_DK(saat, birimMetni || 'hr'), { sira });
      continue;
    }
    if (!anahtar) continue;
    const { tur, birim } = METRIKLER[anahtar]!;
    if (tur === 'nabiz') {
      const ort = sayi(e.Avg) ?? sayi(e.qty);
      if (ort !== null) t.ekle(gun, tur, ort, { en_az: sayi(e.Min) ?? undefined, en_cok: sayi(e.Max) ?? undefined, sira });
      continue;
    }
    const v = sayi(e.qty) ?? sayi(e.Avg) ?? sayi(e.value);
    if (v !== null) t.ekle(gun, tur, birim(v, birimMetni), { sira });
  }
}

/** Gelen gövdeyi ölçüm satırlarına çevirir. bugun: tarih verilmeyen basit kayıtlar için gün (YYYY-AA-GG). */
export function cevir(govde: unknown, bugun: string): { satirlar: Satir[]; sorun?: string } {
  const t = new Toplayici();
  const kok = govde as Record<string, unknown> | unknown[] | null;
  if (!kok || typeof kok !== 'object') return { satirlar: [], sorun: 'Gövde JSON nesnesi ya da dizisi olmalı' };

  const metrikler = !Array.isArray(kok) ? ((kok.data as Record<string, unknown> | undefined)?.metrics ?? kok.metrics) : undefined;
  if (Array.isArray(metrikler)) {
    for (const m of metrikler) if (m && typeof m === 'object') metrikIsle(m as Record<string, unknown>, t);
  } else if (!Array.isArray(kok) && Array.isArray(kok.olcumler)) {
    for (const o of kok.olcumler as Record<string, unknown>[]) {
      const gun = gunCoz(o?.gun ?? o?.tarih), tur = String(o?.tur ?? '') as Tur, deger = sayi(o?.deger);
      if (gun && (TURLER as readonly string[]).includes(tur) && deger !== null) t.ekle(gun, tur, deger, { en_az: sayi(o.en_az) ?? undefined, en_cok: sayi(o.en_cok) ?? undefined, n: 1 });
    }
  } else {
    const liste = Array.isArray(kok) ? kok : Array.isArray(kok.gunler) ? kok.gunler : Array.isArray(kok.days) ? kok.days : [kok];
    for (const o of liste as unknown[]) if (o && typeof o === 'object') basitGun(o as Record<string, unknown>, t, bugun);
  }
  const satirlar = t.satirlar();
  if (!satirlar.length) return { satirlar, sorun: 'Tanınan bir ölçüm bulunamadı' };
  if (satirlar.length > AZAMI_SATIR) return { satirlar: [], sorun: `Bir istekte en fazla ${AZAMI_SATIR} ölçüm gönderilebilir` };
  return { satirlar };
}
