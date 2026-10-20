/* Europe/Istanbul takvim günü ve dönem sınırları. SAF: saat parametredir, `Date.now()` çağrılmaz. */

const ISTANBUL_BICIM = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/* ms epoch (UTC) → Istanbul takvim günü 'YYYY-AA-GG'. Geçersiz/aralık dışı → null (rapor kodu GECERSIZ_TARIH çağırana aittir). */
export function istanbulGunu(ms: number): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const parcalar = ISTANBUL_BICIM.formatToParts(d);
  const al = (tur: string): string => parcalar.find((p) => p.type === tur)?.value ?? '';
  const y = al('year');
  const a = al('month');
  const g = al('day');
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(a) || !/^\d{2}$/.test(g)) return null;
  return `${y}-${a}-${g}`;
}

function ayGunSayisi(yil: number, ay: number): number {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

function donemAyir(donem: string): { yil: number; ay: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(donem);
  if (!m) return null;
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  if (yil < 1000 || ay < 1 || ay > 12) return null;
  return { yil, ay };
}

/* 'YYYY-AA' geçerli dönem mi. */
export function donemGecerliMi(donem: string): boolean {
  return typeof donem === 'string' && donemAyir(donem) !== null;
}

/* 'YYYY-AA-GG' takvimde var olan (artık yıl dahil) bir gün mü. */
export function gunGecerliMi(gun: string): boolean {
  if (typeof gun !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gun);
  if (!m) return false;
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  const g = Number(m[3]);
  if (yil < 1000 || ay < 1 || ay > 12 || g < 1) return false;
  return g <= ayGunSayisi(yil, ay);
}

/* 'YYYY-AA' → ayın ilk günü 'YYYY-AA-01'; geçersiz dönem → null. */
export function donemBasi(donem: string): string | null {
  const d = typeof donem === 'string' ? donemAyir(donem) : null;
  return d ? `${donem}-01` : null;
}

/* 'YYYY-AA' → ayın son günü (şubat/artık yıl dahil); geçersiz dönem → null. */
export function donemSonu(donem: string): string | null {
  const d = typeof donem === 'string' ? donemAyir(donem) : null;
  return d ? `${donem}-${String(ayGunSayisi(d.yil, d.ay)).padStart(2, '0')}` : null;
}
