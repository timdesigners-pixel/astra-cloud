/* Bütün gün, hafta ve dönem hesapları Europe/Istanbul saatine göre yapılır. */
const TZ = 'Europe/Istanbul';
export const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export type Parcalar = { yil: number; ay: number; gun: number; saat: number; dakika: number; haftaGunu: number };

export function parcalar(d = new Date()): Parcalar {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d).map(x => [x.type, x.value]),
  ) as Record<string, string>;
  const yil = +p.year!, ay = +p.month!, gun = +p.day!;
  return { yil, ay, gun, saat: +p.hour! % 24, dakika: +p.minute!, haftaGunu: new Date(Date.UTC(yil, ay - 1, gun)).getUTCDay() };
}

const iki = (n: number) => String(n).padStart(2, '0');
export const bugunAnahtari = (d = new Date()) => { const p = parcalar(d); return `${p.yil}-${iki(p.ay)}-${iki(p.gun)}`; };

export function tarihSatiri(d = new Date()) {
  const p = parcalar(d);
  return `${GUNLER[p.haftaGunu]}, ${p.gun} ${AYLAR[p.ay - 1]} ${p.yil}`.toLocaleUpperCase('tr');
}

export function selamlama(d = new Date()) {
  const s = parcalar(d).saat;
  if (s >= 5 && s < 12) return 'Günaydın';
  if (s >= 12 && s < 18) return 'Tünaydın';
  if (s >= 18 && s < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}

export function yilinGunu(d = new Date()) {
  const p = parcalar(d);
  return Math.round((Date.UTC(p.yil, p.ay - 1, p.gun) - Date.UTC(p.yil, 0, 0)) / 86400000);
}

export function haftaNo(d = new Date()) {
  const p = parcalar(d);
  const t = new Date(Date.UTC(p.yil, p.ay - 1, p.gun));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((+t - +f) / 86400000 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
}

export function saatSatiri(d = new Date()) {
  const p = parcalar(d);
  const ayinGunu = new Date(Date.UTC(p.yil, p.ay, 0)).getUTCDate();
  return `${iki(p.saat)}:${iki(p.dakika)} · ${haftaNo(d)}. hafta · yılın ${yilinGunu(d)}. günü · ${AYLAR[p.ay - 1]} ${p.yil} dönemi · ay bitimine ${ayinGunu - p.gun} gün`;
}
