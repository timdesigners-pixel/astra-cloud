/* İcra yasal süreleri, zamanaşımı, karakol imzası ve denetim süresi hesapları. Saf işlevler: ağ ve ekran bilgisi yok. */
export type SureTuru = 'Kambiyo' | 'İlamsız' | 'İlamlı' | 'Tahliye' | 'Mükerrer' | 'Talimat';
export const SURE_TABLO: Record<SureTuru, { itiraz: number; odeme: number; not: string }> = {
  Kambiyo: { itiraz: 5, odeme: 10, not: 'İİK 168 — imzaya/borca itiraz 5 gün, ödeme 10 gün' },
  İlamsız: { itiraz: 7, odeme: 7, not: 'İİK 62 — ödeme emrine itiraz 7 gün, ödeme 7 gün' },
  İlamlı: { itiraz: 0, odeme: 7, not: 'İlama dayalı — itirazla durmaz, icranın geri bırakılması istenir' },
  Tahliye: { itiraz: 7, odeme: 30, not: 'Kira — itiraz 7 gün, tahliye için 30 gün ödeme süresi' },
  Mükerrer: { itiraz: 0, odeme: 0, not: 'Bağlı dosya' },
  Talimat: { itiraz: 0, odeme: 0, not: 'Bağlı dosya' },
};
export const ZAMANASIMI_YIL: Record<SureTuru, number> = { Kambiyo: 3, İlamlı: 10, İlamsız: 5, Tahliye: 5, Mükerrer: 0, Talimat: 0 };
const ADLI_TATIL = { bas: '07-20', bit: '08-31' } as const;

export const sureTuru = (takipTuru: string | null | undefined): SureTuru | null => (takipTuru && takipTuru in SURE_TABLO ? (takipTuru as SureTuru) : null);

const GUN_MS = 86400000;
/* Tarihler "YYYY-AA-GG" metni; UTC ile işlenir, saat dilimi kayması olmaz. */
const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z');
const yaz = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const gunEkle = (tarih: string, gun: number) => yaz(t(tarih) + gun * GUN_MS);
export const gunFarki = (a: string, b: string) => Math.round((t(a) - t(b)) / GUN_MS);

export function adliTatildeMi(tarih: string): boolean {
  const aygun = tarih.slice(5, 10);
  return aygun >= ADLI_TATIL.bas && aygun <= ADLI_TATIL.bit;
}

/** Süre sonu: tebliğ + gün. Adli tatile denk gelirse tatil bitiminden (31 Ağustos) itibaren bir hafta uzar. */
export function sureSonu(teblig: string, gun: number, tatilUzar = true): string | null {
  if (!teblig || !gun) return null;
  const son = gunEkle(teblig, gun);
  return tatilUzar && adliTatildeMi(son) ? gunEkle(`${son.slice(0, 4)}-08-31`, 7) : son;
}

export type SureSatiri = { ad: string; gun: number; son: string; kalan: number };
export function sureler(takipTuru: string | null, teblig: string | null, bugun: string): SureSatiri[] {
  const tur = sureTuru(takipTuru);
  if (!tur || !teblig) return [];
  const T = SURE_TABLO[tur];
  const cikti: SureSatiri[] = [];
  const ekle = (ad: string, gun: number) => { const son = sureSonu(teblig, gun); if (son) cikti.push({ ad, gun, son, kalan: gunFarki(son, bugun) }); };
  if (T.itiraz) ekle('İtiraz süresi', T.itiraz);
  if (T.odeme) ekle('Ödeme süresi', T.odeme);
  return cikti;
}

export type Zamanasimi = { bas: string; bitis: string; yil: number; kalan: number; gecti: boolean };
/** Zamanaşımı son işlem (yoksa açılış) tarihinden işler. */
export function zamanasimi(takipTuru: string | null, sonIslem: string | null, acilis: string | null, bugun: string): Zamanasimi | null {
  const tur = sureTuru(takipTuru);
  const yil = tur ? ZAMANASIMI_YIL[tur] : 0;
  const bas = sonIslem || acilis;
  if (!yil || !bas) return null;
  const bitis = `${Number(bas.slice(0, 4)) + yil}${bas.slice(4, 10)}`;
  const kalan = gunFarki(bitis, bugun);
  return { bas, bitis, yil, kalan, gecti: kalan < 0 };
}

/* ——— Karakol imzası: ayarlar > imza { gun, aktif, log: { "2026-10": "2026-10-15" } } ——— */
export type Imza = { gun: number; aktif: boolean; log: Record<string, string> };
export const VARSAYILAN_IMZA: Imza = { gun: 15, aktif: true, log: {} };
export function imzaAylari(bugun: string, geri = 5, ileri = 2): string[] {
  const y = Number(bugun.slice(0, 4)), a = Number(bugun.slice(5, 7)) - 1;
  const cikti: string[] = [];
  for (let i = -geri; i <= ileri; i++) { const d = new Date(Date.UTC(y, a + i, 1)); cikti.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
  return cikti;
}
export type ImzaDurumu = 'imzalandi' | 'kacirildi' | 'bugun' | 'yaklasiyor' | 'bekliyor';
/** O ayın imza durumu: imza günü geçtiyse ve işaretlenmediyse kaçırılmış sayılır. */
export function imzaDurumu(imza: Imza, ay: string, bugun: string): { durum: ImzaDurumu; tarih: string; kalan: number } {
  const sonGun = new Date(Date.UTC(Number(ay.slice(0, 4)), Number(ay.slice(5, 7)), 0)).getUTCDate();
  const tarih = `${ay}-${String(Math.min(imza.gun, sonGun)).padStart(2, '0')}`;
  const kalan = gunFarki(tarih, bugun);
  if (imza.log[ay]) return { durum: 'imzalandi', tarih, kalan };
  if (kalan < 0) return { durum: 'kacirildi', tarih, kalan };
  if (kalan === 0) return { durum: 'bugun', tarih, kalan };
  return { durum: kalan <= 3 ? 'yaklasiyor' : 'bekliyor', tarih, kalan };
}

/* ——— Denetim süresi (ör. TCK 191, dava açılmasının ertelenmesi) ——— */
export type DenetimSuresi = { bas: string; yil: number; not: string };
export function denetimDurumu(d: DenetimSuresi, bugun: string): { bitis: string; kalan: number; yuzde: number; bitti: boolean } | null {
  if (!d.bas || !d.yil) return null;
  const bitis = `${Number(d.bas.slice(0, 4)) + d.yil}${d.bas.slice(4, 10)}`;
  const toplam = gunFarki(bitis, d.bas), gecen = Math.max(0, gunFarki(bugun, d.bas));
  const kalan = gunFarki(bitis, bugun);
  return { bitis, kalan, yuzde: Math.min(100, Math.round((gecen / toplam) * 100)), bitti: kalan < 0 };
}

/* ——— Sabit tarihli yükümlülükler: her ayın belirli günü ——— */
export type YukumlulukTuru = 'odeme' | 'vergi' | 'durusma' | 'imza' | 'saglik' | 'plan' | 'diger';
export type Onem = 'kritik' | 'onemli' | 'normal';
export type Yukumluluk = { id: string; ad: string; gun: number; tur: YukumlulukTuru; onem: Onem; aktif: boolean };
export const YUKUMLULUK_TUR_ADI: Record<YukumlulukTuru, string> = { odeme: 'Ödeme', vergi: 'Vergi', durusma: 'Duruşma', imza: 'İmza', saglik: 'Sağlık', plan: 'Plan', diger: 'Diğer' };
export const ONEM_ADI: Record<Onem, string> = { kritik: 'Kritik', onemli: 'Önemli', normal: 'Normal' };

/** Verilen ayda (YYYY-AA) yükümlülüğün düştüğü gün; ay kısaysa son güne çekilir. */
export function yukumlulukTarihi(y: Pick<Yukumluluk, 'gun'>, ay: string): string {
  const sonGun = new Date(Date.UTC(Number(ay.slice(0, 4)), Number(ay.slice(5, 7)), 0)).getUTCDate();
  return `${ay}-${String(Math.min(Math.max(1, y.gun), sonGun)).padStart(2, '0')}`;
}
export function siradakiYukumluluk(y: Pick<Yukumluluk, 'gun'>, bugun: string): { tarih: string; kalan: number } {
  const bu = yukumlulukTarihi(y, bugun.slice(0, 7));
  if (bu >= bugun) return { tarih: bu, kalan: gunFarki(bu, bugun) };
  const d = new Date(Date.UTC(Number(bugun.slice(0, 4)), Number(bugun.slice(5, 7)), 1));
  const sonraki = yukumlulukTarihi(y, `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  return { tarih: sonraki, kalan: gunFarki(sonraki, bugun) };
}
