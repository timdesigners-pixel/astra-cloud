/* Anahtarsız genel servisler: hava (open-meteo), kur (open.er-api), altın (gold-api).
   Sonuçlar yalnız bellekte önbelleğe alınır; hiçbiri cihaza yazılmaz. */

export const WMO: Record<number, [string, string]> = {
  0: ['Açık', '☀️'], 1: ['Az bulutlu', '🌤️'], 2: ['Parçalı bulutlu', '⛅'], 3: ['Kapalı', '☁️'],
  45: ['Sisli', '🌫️'], 48: ['Kırağılı sis', '🌫️'],
  51: ['Hafif çisenti', '🌦️'], 53: ['Çisenti', '🌦️'], 55: ['Yoğun çisenti', '🌦️'],
  56: ['Donan çisenti', '🌧️'], 57: ['Yoğun donan çisenti', '🌧️'],
  61: ['Hafif yağmur', '🌧️'], 63: ['Yağmurlu', '🌧️'], 65: ['Şiddetli yağmur', '🌧️'],
  66: ['Donan yağmur', '🌧️'], 67: ['Şiddetli donan yağmur', '🌧️'],
  71: ['Hafif kar', '🌨️'], 73: ['Kar yağışlı', '🌨️'], 75: ['Yoğun kar', '🌨️'], 77: ['Kar taneleri', '🌨️'],
  80: ['Sağanak', '🌦️'], 81: ['Kuvvetli sağanak', '🌧️'], 82: ['Şiddetli sağanak', '⛈️'],
  85: ['Kar sağanağı', '🌨️'], 86: ['Yoğun kar sağanağı', '🌨️'],
  95: ['Gök gürültülü fırtına', '⛈️'], 96: ['Dolulu fırtına', '⛈️'], 99: ['Şiddetli dolulu fırtına', '⛈️'],
};

export type Hava = {
  temp: number; hissedilen: number; nem: number; ruzgar: number; yuksek: number | null; dusuk: number | null;
  dogus: string; batis: string; aciklama: string; simge: string; zaman: number;
};
export type Kur = { usd: number; eur: number | null; gbp: number | null; gramAltin: number | null; zaman: number };

const SURE = 30 * 60 * 1000;
const onbellek = new Map<string, { zaman: number; veri: unknown }>();

async function getir<T>(anahtar: string, url: string, isle: (j: any) => T, zorla: boolean): Promise<T> {
  const k = onbellek.get(anahtar);
  if (!zorla && k && Date.now() - k.zaman < SURE) return k.veri as T;
  const kontrol = new AbortController();
  const zamanAsimi = setTimeout(() => kontrol.abort(), 8000);
  try {
    const r = await fetch(url, { signal: kontrol.signal });
    if (!r.ok) throw new Error(String(r.status));
    const veri = isle(await r.json());
    onbellek.set(anahtar, { zaman: Date.now(), veri });
    return veri;
  } finally { clearTimeout(zamanAsimi); }
}

export const havaGetir = (lat: number, lon: number, zorla = false) =>
  getir<Hava>(`hava:${lat},${lon}`,
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code'
    + '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=1',
    j => {
      const c = j.current ?? {}, d = j.daily ?? {};
      if (typeof c.temperature_2m !== 'number') throw new Error('veri yok');
      const m = WMO[c.weather_code] ?? ['Bilinmiyor', '🌡️'];
      return {
        temp: Math.round(c.temperature_2m), hissedilen: Math.round(c.apparent_temperature), nem: Math.round(c.relative_humidity_2m),
        ruzgar: Math.round(c.wind_speed_10m), yuksek: d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : null,
        dusuk: d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : null,
        dogus: d.sunrise ? String(d.sunrise[0]).slice(11, 16) : '', batis: d.sunset ? String(d.sunset[0]).slice(11, 16) : '',
        aciklama: m[0], simge: m[1], zaman: Date.now(),
      };
    }, zorla);

export async function kurGetir(zorla = false): Promise<Kur> {
  const kur = await getir<Omit<Kur, 'gramAltin'>>('kur', 'https://open.er-api.com/v6/latest/USD', j => {
    const t = j.rates?.TRY;
    if (typeof t !== 'number') throw new Error('veri yok');
    const yuvarla = (x: number) => Math.round(x * 100) / 100;
    return { usd: yuvarla(t), eur: j.rates.EUR ? yuvarla(t / j.rates.EUR) : null, gbp: j.rates.GBP ? yuvarla(t / j.rates.GBP) : null, zaman: Date.now() };
  }, zorla);
  /* Gram altın ayrı servisten gelir; alınamazsa kur kartı yine de görünür. */
  let gramAltin: number | null = null;
  try {
    const ons = await getir<number>('altin', 'https://api.gold-api.com/price/XAU', j => {
      if (typeof j.price !== 'number') throw new Error('veri yok');
      return j.price;
    }, zorla);
    gramAltin = Math.round((ons / 31.1035) * kur.usd * 100) / 100;
  } catch { /* altın yok */ }
  return { ...kur, gramAltin };
}

export type Sehir = { etiket: string; lat: number; lon: number };
export async function sehirAra(ad: string): Promise<Sehir[]> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ad)}&count=6&language=tr`);
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return (j.results ?? []).map((x: any) => ({
    etiket: [x.name, x.admin1].filter(Boolean).join(', '), lat: Math.round(x.latitude * 10000) / 10000, lon: Math.round(x.longitude * 10000) / 10000,
  }));
}

/* Haber akışı: RSS adresleri rss2json üzerinden JSON'a çevrilir (anahtarsız, tarayıcıdan erişilebilir). */
export type Haber = { baslik: string; baglanti: string; zaman: number | null; kaynak: string; resim: string | null };
export const HABER_KAYNAKLARI: { kod: string; ad: string; kaynak: string; rss: string }[] = [
  { kod: 'ekonomi', ad: 'Ekonomi', kaynak: 'Anadolu Ajansı', rss: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi' },
  { kod: 'gundem', ad: 'Gündem', kaynak: 'Anadolu Ajansı', rss: 'https://www.aa.com.tr/tr/rss/default?cat=guncel' },
  { kod: 'dunya', ad: 'Dünya', kaynak: 'BBC Türkçe', rss: 'https://feeds.bbci.co.uk/turkce/rss.xml' },
];
const https = (u: unknown) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null);

export const haberGetir = (kod: string, zorla = false) => {
  const k = HABER_KAYNAKLARI.find(x => x.kod === kod) ?? HABER_KAYNAKLARI[0]!;
  return getir<Haber[]>(`haber:${k.kod}`, `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(k.rss)}`, j => {
    if (j.status !== 'ok' || !Array.isArray(j.items)) throw new Error('veri yok');
    return j.items.slice(0, 10).map((x: any): Haber => {
      const ms = typeof x.pubDate === 'string' ? Date.parse(x.pubDate.replace(' ', 'T') + 'Z') : NaN;
      return {
        baslik: String(x.title ?? '').trim(), baglanti: https(x.link) ?? '', zaman: Number.isNaN(ms) ? null : ms,
        kaynak: k.kaynak, resim: https(x.thumbnail) ?? https(x.enclosure?.link),
      };
    }).filter((x: Haber) => x.baslik && x.baglanti);
  }, zorla);
};
