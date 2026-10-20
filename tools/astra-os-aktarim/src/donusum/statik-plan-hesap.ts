/* Statik yükleme planı. SAF: dosya/ağ/ortam yok. Girdi: taranmış dosya bilgileri (yol, boyut, sha256, JSON geçerliliği) — içerik DEĞERİ burada hiç yoktur.
   Beyaz liste (H-12): yalnız `oynatma-listelerim` ve `pinterest-panolarim` altında `hero.json`, `kucuk.json`, `detay/NN.json`. Başka hiçbir yol planlanmaz.
   Onay kodu: `ONAY-statik-<12 hex>` = SHA-256(araç sürümü + hedef ana makine + kova + (yol, sha256) listesi). Dosya, hedef proje ya da sürüm değişince kod değişir. */
import { ozetOlustur, sabitSureliEsitMi } from '../guvenlik/ozet.ts';

export const STATIK_KOVA = 'apps';
export const STATIK_UYGULAMALAR = ['oynatma-listelerim', 'pinterest-panolarim'] as const;
export type StatikUygulama = (typeof STATIK_UYGULAMALAR)[number];
export const STATIK_MIME = 'application/json';
/* Kova sınırı (0020: 50 MB/dosya). */
export const STATIK_AZAMI_BAYT = 50 * 1024 * 1024;
export const STATIK_ONAY_DESENI = /^ONAY-statik-[0-9a-f]{12}$/;

const YOL_DESENI = /^(oynatma-listelerim|pinterest-panolarim)\/(?:hero\.json|kucuk\.json|detay\/[0-9]{2}\.json)$/;
const SHA256_DESENI = /^[0-9a-f]{64}$/;

/* Hedef nesne yolu geçerli mi: kaçış (`..`, `.`, boş parça, mutlak yol, ters bölü, NUL) VE beyaz liste dışı yol → false.
   Kaçış denetimi beyaz liste deseninden bağımsız ayrıca yapılır (derinlemesine savunma). */
export function statikYoluGecerliMi(yol: unknown): yol is string {
  if (typeof yol !== 'string' || yol === '' || yol.length > 200) return false;
  if (yol.startsWith('/') || yol.includes('\\') || yol.includes('\0') || /^[A-Za-z]:/.test(yol)) return false;
  if (yol.split('/').some((p) => p === '' || p === '.' || p === '..')) return false;
  return YOL_DESENI.test(yol);
}

export type StatikDosya = {
  /* Kova içi yol: `<uygulama>/hero.json` */
  yol: string;
  uygulama: StatikUygulama;
  boyut: number;
  sha256: string;
  json_gecerli: boolean;
};

/* Tarama aşamasının (dosya sistemi) bildirdiği sorunlar da plana girer. */
export type StatikSorunKodu =
  | 'YOL_BEYAZ_LISTE_DISI'
  | 'SHA256_BICIMI'
  | 'YOL_TEKRAR'
  | 'BOYUT_SINIRI_ASILDI'
  | 'JSON_GECERSIZ'
  | 'DOSYA_BOS'
  | 'UYGULAMA_YOK'
  | 'DOSYA_YOK'
  | 'DETAY_YOK'
  | 'SEMBOLIK_BAGLANTI';

export type StatikSorun = { kod: StatikSorunKodu; sayi: number };

export type StatikUygulamaOzeti = { uygulama: StatikUygulama; dosya: number; detay: number; bayt: number; en_buyuk: number };

export type StatikPlan = {
  kova: typeof STATIK_KOVA;
  /* Yola göre sıralı (kod belirleyici olsun). */
  dosyalar: readonly StatikDosya[];
  uygulamalar: readonly StatikUygulamaOzeti[];
  toplam_dosya: number;
  toplam_bayt: number;
  en_buyuk: number;
  /* Tüm (yol, sha256) listesinin kısa özeti: iki taramanın aynı olduğunu göstermek için. */
  ozet_sha256: string;
  sorunlar: readonly StatikSorun[];
  /* Sorun varsa kod VERİLMEZ (null): sorunlu plan onaylanıp yüklenemez. */
  onay_kodu: string | null;
};

export type StatikPlanGirdisi = {
  dosyalar: readonly StatikDosya[];
  taramaSorunlari?: readonly StatikSorunKodu[];
  anaMakine: string;
  aracSurumu: string;
};

function sirala(a: StatikDosya, b: StatikDosya): number {
  return a.yol < b.yol ? -1 : a.yol > b.yol ? 1 : 0;
}

function ozetHex(g: StatikPlanGirdisi, dosyalar: readonly StatikDosya[], ana: boolean): string {
  const o = ozetOlustur();
  if (ana) o.guncelle(JSON.stringify([g.aracSurumu, g.anaMakine, STATIK_KOVA]));
  for (const d of dosyalar) o.guncelle(JSON.stringify([d.yol, d.sha256]));
  return o.hex();
}

export function statikPlanOlustur(g: StatikPlanGirdisi): StatikPlan {
  const sayac = new Map<StatikSorunKodu, number>();
  const sorunEkle = (k: StatikSorunKodu): void => void sayac.set(k, (sayac.get(k) ?? 0) + 1);
  for (const k of g.taramaSorunlari ?? []) sorunEkle(k);

  const gorulen = new Set<string>();
  const gecerli: StatikDosya[] = [];
  for (const d of g.dosyalar) {
    /* Beyaz liste dışı ya da kaçış içeren yol: dosya plana ALINMAZ ve sorun sayılır. */
    if (!statikYoluGecerliMi(d.yol) || !d.yol.startsWith(`${d.uygulama}/`)) {
      sorunEkle('YOL_BEYAZ_LISTE_DISI');
      continue;
    }
    if (gorulen.has(d.yol)) {
      sorunEkle('YOL_TEKRAR');
      continue;
    }
    gorulen.add(d.yol);
    if (!SHA256_DESENI.test(d.sha256) && d.boyut <= STATIK_AZAMI_BAYT) sorunEkle('SHA256_BICIMI');
    if (d.boyut > STATIK_AZAMI_BAYT) sorunEkle('BOYUT_SINIRI_ASILDI');
    else if (d.boyut <= 0) sorunEkle('DOSYA_BOS');
    else if (!d.json_gecerli) sorunEkle('JSON_GECERSIZ');
    gecerli.push(d);
  }
  gecerli.sort(sirala);

  const uygulamalar: StatikUygulamaOzeti[] = [];
  for (const u of STATIK_UYGULAMALAR) {
    const dd = gecerli.filter((d) => d.uygulama === u);
    uygulamalar.push({
      uygulama: u,
      dosya: dd.length,
      detay: dd.filter((d) => d.yol.startsWith(`${u}/detay/`)).length,
      bayt: dd.reduce((t, d) => t + d.boyut, 0),
      en_buyuk: dd.reduce((m, d) => Math.max(m, d.boyut), 0),
    });
  }

  const sorunlar = [...sayac.entries()].map(([kod, sayi]) => ({ kod, sayi })).sort((a, b) => (a.kod < b.kod ? -1 : 1));
  const ozet = ozetHex(g, gecerli, false);
  return {
    kova: STATIK_KOVA,
    dosyalar: gecerli,
    uygulamalar,
    toplam_dosya: gecerli.length,
    toplam_bayt: uygulamalar.reduce((t, u) => t + u.bayt, 0),
    en_buyuk: uygulamalar.reduce((m, u) => Math.max(m, u.en_buyuk), 0),
    ozet_sha256: ozet.slice(0, 12),
    sorunlar,
    onay_kodu: sorunlar.length === 0 && gecerli.length > 0 ? `ONAY-statik-${ozetHex(g, gecerli, true).slice(0, 12)}` : null,
  };
}

/* Verilen kod bu planın kodu mu. Sorunlu plan (kod null), biçim bozuk ya da farklı plan → false. */
export function statikOnayDogrula(plan: StatikPlan, kod: unknown): boolean {
  return plan.onay_kodu !== null && typeof kod === 'string' && STATIK_ONAY_DESENI.test(kod) && sabitSureliEsitMi(plan.onay_kodu, kod);
}
