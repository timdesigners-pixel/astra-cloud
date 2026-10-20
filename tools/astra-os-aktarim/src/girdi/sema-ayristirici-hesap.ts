import { GirdiHatasi } from './girdi-hata.ts';

/* Kasa gövdesindeki (S) kayıt bazlı koleksiyon adları (plan §A.3, kaynak: eski `sync.js` koleksiyon listesi). */
export const KOLEKSIYON_ADLARI = [
  'debts', 'expenses', 'incomes', 'purchases', 'todos', 'deposits', 'investments', 'ibans', 'pantry', 'icra',
  'cases', 'petitions', 'legal', 'fixdates', 'people', 'receipts', 'bankRates', 'bes', 'scenarios', 'decisions',
  'aracIlan', 'teklifler', 'raporArsiv', 'moves', 'kutuphane', 'kutKategori', 'acilKisiler', 'rssKaynaklar', 'limitler',
] as const;

export type KoleksiyonAdi = (typeof KOLEKSIYON_ADLARI)[number];
export type Kayit = Record<string, unknown>;
export type Nesne = Record<string, unknown>;

/* Aktarım aracının içte kullandığı tek durum şeması. `koleksiyon` her bilinen ad için dizi içerir (eksik = boş), mezar taşlıları süzülmüştür. */
export type S = {
  _v: number | null;
  _ts: number | null;
  koleksiyon: Record<KoleksiyonAdi, Kayit[]>;
  ayar: Nesne;
  silinen: Record<string, Nesne>;
  statements: Nesne;
  ledger: Nesne;
  dayLog: Nesne;
  diger: Nesne;
};

export type Elenen = { koleksiyon: KoleksiyonAdi; kaynak_id: string };

/* Yalnız sayılar: bilinmeyen_anahtar_sayisi = kökte/koleksiyonda tanınmayan anahtarlar; gecersiz_kayit_sayisi = nesne olmayan dizi öğeleri. */
export type SemaOzeti = {
  koleksiyon_sayilari: Record<KoleksiyonAdi, number>;
  silinen_mezar_sayisi: number;
  bilinmeyen_anahtar_sayisi: number;
  gecersiz_kayit_sayisi: number;
};

export type SemaSonucu = { s: S; ozet: SemaOzeti; elenenler: Elenen[] };

const KOK_ANAHTARLARI = ['_v', '_ts', '_istemci', '_min', 'koleksiyon', 'ayar', 'silinen', 'statements', 'ledger', 'dayLog', 'diger'];
const KOK_IMZASI = ['koleksiyon', 'ayar', 'silinen', 'statements', 'ledger', 'dayLog', 'diger'];

/* Düz nesne mi (dizi/null değil). */
export function duzNesneMi(v: unknown): v is Nesne {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/* Kök, S şemasının en az bir imza anahtarını taşıyor mu (zarf algılamada kullanılır). */
export function semaKokuMu(kok: unknown): boolean {
  return duzNesneMi(kok) && KOK_IMZASI.some((a) => Object.hasOwn(kok, a));
}

/* Mezar taşı (silinen) listesinde bu kimlik var mı. Prototip anahtarlarına karşı yalnız kendi özellikleri sayılır. */
export function mezarMi(mezarlar: Nesne | undefined, id: string): boolean {
  return mezarlar !== undefined && Object.hasOwn(mezarlar, id);
}

/* Kayıtları mezar taşı kimliklerine göre eler. Kimliksiz kayıt kalır. Dönüş: kalanlar + elenen kimlikler (değer değil, yalnız kimlik). */
export function mezarsizSuz(kayitlar: Kayit[], mezarlar: Nesne | undefined): { kalan: Kayit[]; elenen: string[] } {
  const kalan: Kayit[] = [];
  const elenen: string[] = [];
  for (const k of kayitlar) {
    const id = k.id;
    const kimlik = typeof id === 'string' || typeof id === 'number' ? String(id) : null;
    if (kimlik !== null && mezarMi(mezarlar, kimlik)) elenen.push(kimlik);
    else kalan.push(k);
  }
  return { kalan, elenen };
}

function bosKoleksiyonlar(): Record<KoleksiyonAdi, Kayit[]> {
  const o = {} as Record<KoleksiyonAdi, Kayit[]>;
  for (const ad of KOLEKSIYON_ADLARI) o[ad] = [];
  return o;
}

function bosSayilar(): Record<KoleksiyonAdi, number> {
  const o = {} as Record<KoleksiyonAdi, number>;
  for (const ad of KOLEKSIYON_ADLARI) o[ad] = 0;
  return o;
}

/* Yok/null → boş nesne; nesne → kendisi; başka tür → SEMA_GECERSIZ. */
function nesneAl(v: unknown, yol: string): Nesne {
  if (v === undefined || v === null) return {};
  if (!duzNesneMi(v)) throw new GirdiHatasi('SEMA_GECERSIZ', yol);
  return v;
}

function sayiAl(v: unknown, yol: string): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new GirdiHatasi('SEMA_GECERSIZ', yol);
  return v;
}

/* Kök nesneyi doğrular ve S'ye çevirir: eksik/bilinmeyen koleksiyon boş sayılır, silinen kimlikler elenir; hata mesajları değer taşımaz. */
export function semaAyristir(kok: unknown): SemaSonucu {
  if (!duzNesneMi(kok)) throw new GirdiHatasi('GIRDI_BICIMI_TANINMADI');
  let bilinmeyen = 0;
  let gecersiz = 0;
  for (const a of Object.keys(kok)) if (!KOK_ANAHTARLARI.includes(a)) bilinmeyen++;

  const _v = sayiAl(kok._v, '_v');
  const _ts = sayiAl(kok._ts, '_ts');
  const ham = nesneAl(kok.koleksiyon, 'koleksiyon');
  const ayar = nesneAl(kok.ayar, 'ayar');
  const statements = nesneAl(kok.statements, 'statements');
  const ledger = nesneAl(kok.ledger, 'ledger');
  const dayLog = nesneAl(kok.dayLog, 'dayLog');
  const diger = nesneAl(kok.diger, 'diger');

  const silinenHam = nesneAl(kok.silinen, 'silinen');
  const silinen: Record<string, Nesne> = {};
  for (const liste of Object.keys(silinenHam)) silinen[liste] = nesneAl(silinenHam[liste], 'silinen');

  for (const a of Object.keys(ham)) if (!(KOLEKSIYON_ADLARI as readonly string[]).includes(a)) bilinmeyen++;

  const koleksiyon = bosKoleksiyonlar();
  const sayilar = bosSayilar();
  const elenenler: Elenen[] = [];
  for (const ad of KOLEKSIYON_ADLARI) {
    const dizi = ham[ad];
    if (dizi === undefined || dizi === null) continue;
    if (!Array.isArray(dizi)) throw new GirdiHatasi('SEMA_GECERSIZ', `koleksiyon.${ad}`);
    const nesneler: Kayit[] = [];
    for (const oge of dizi) {
      if (duzNesneMi(oge)) nesneler.push(oge);
      else gecersiz++;
    }
    const { kalan, elenen } = mezarsizSuz(nesneler, Object.hasOwn(silinen, ad) ? silinen[ad] : undefined);
    koleksiyon[ad] = kalan;
    sayilar[ad] = kalan.length;
    for (const kimlik of elenen) elenenler.push({ koleksiyon: ad, kaynak_id: kimlik });
  }

  return {
    s: { _v, _ts, koleksiyon, ayar, silinen, statements, ledger, dayLog, diger },
    ozet: { koleksiyon_sayilari: sayilar, silinen_mezar_sayisi: elenenler.length, bilinmeyen_anahtar_sayisi: bilinmeyen, gecersiz_kayit_sayisi: gecersiz },
    elenenler,
  };
}
