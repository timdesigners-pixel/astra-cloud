/* `astra_ilgi_urunler` (eski proje, 120 ürün) → `begeniler` satırları (spec B.5, plan §6 dalga a). SAF: dosya/ağ/ortam yok.
   Idempotent anahtar `kod` (= ürün `id`; CL `begeniler_kod` tekil indeksi, plan §4.1).
   BELİRSİZLİK (tahmin edilmedi): ürünlerin `S` içinde olup olmadığı plan/spec'te açık değil. Plan §6 dalga a bunu `S`'den AYRI bir JSON girdisi
   (`--ilgi <yol>`) olarak tanımlar; `S.diger.apps` içinde yalnız arayüz durumu (`ilgi-urunler-durum-v1`) vardır, ürün kataloğu yoktur.
   Bu yüzden dönüştürücü ürün dizisini AYRI parametre olarak alır; parametre yoksa boş sonuç + bilgi kodu ILGI_KAYNAK_YOK döner.
   Kaynak alan adları spec B.5'ten (id, name, category, image, badge, price, price_label, specs, note, links, priority, favorite, rating,
   target_price, price_history, added_at); `sira` için kaynakta alan belirtilmemiştir → dizi sırası (1'den) kullanılır. */
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { duzNesneMi, type Nesne } from '../girdi/sema-ayristirici-hesap.ts';
import type { BilgiKodu, KodluKayit, NedenKodu } from './neden-kodu.ts';
import { kurusYuvarla, tutarCoz } from './sayi-hesap.ts';
import { sozlukAnahtari } from './sozluk-hesap.ts';

export const ILGI_KOLEKSIYONU = 'ilgi_urunleri';
const AZAMI = { kod: 80, ad: 160, kategori: 40, resim: 1000, fiyat_etiketi: 120, notlar: 2000 } as const;

export type Oncelik = 'low' | 'medium' | 'high';
export type FiyatNoktasi = { date: string; price: number };
/* `begeniler` insert GRANT'ine uyan alanlar; `olusturma` yazılamadığı için kaynak `added_at` ekstra.eski.ts içinde taşınır (plan §0.3). */
export type BegeniSatiri = {
  kod: string;
  sira: number;
  kategori: string;
  ad: string;
  resim: string | null;
  rozet: Nesne | null;
  fiyat: number | null;
  fiyat_etiketi: string | null;
  ozellikler: unknown[];
  notlar: string | null;
  baglantilar: unknown[];
  oncelik: Oncelik;
  favori: boolean;
  puan: number | null;
  hedef_fiyat: number | null;
  fiyat_gecmisi: FiyatNoktasi[];
  ilk_fiyat: number | null;
  ekstra: { eski: { koleksiyon: typeof ILGI_KOLEKSIYONU; id: string; ts?: number } };
};

export type IlgiDonusumu = {
  satirlar: BegeniSatiri[];
  atlananlar: KodluKayit[];
  uyarilar: KodluKayit[];
  bilgi: BilgiKodu[];
  kaynak_sayisi: number;
};

const ONCELIKLER: Readonly<Record<string, Oncelik>> = { low: 'low', medium: 'medium', high: 'high', dusuk: 'low', orta: 'medium', yuksek: 'high' };

function metinAl(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/* Sayısal alan (fiyat, hedef_fiyat): boş → null (kod yok); geçersiz/negatif → null + GECERSIZ_TUTAR uyarısı. Değer 2 haneye yarım-yukarı yuvarlanır. */
function tutarAlani(v: unknown, uyar: (k: NedenKodu) => void): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  const t = tutarCoz(v);
  if (!t.tamam || t.deger < 0) {
    uyar('GECERSIZ_TUTAR');
    return null;
  }
  const y = kurusYuvarla(t.deger);
  if (Number.isNaN(y)) {
    uyar('GECERSIZ_TUTAR');
    return null;
  }
  return y;
}

/* Metin alanı: boş → null; üst sınırı aşarsa kırpılır ve ALAN_KIRPILDI sayılır. */
function kirpilmisMetin(v: unknown, sinir: number, uyar: (k: NedenKodu) => void): string | null {
  const m = metinAl(v);
  if (m === null) return null;
  if (m.length <= sinir) return m;
  uyar('ALAN_KIRPILDI');
  return m.slice(0, sinir);
}

/* `added_at`: ms epoch (sayı) ya da tarih metni → ms; boş → undefined; çözülemeyen → GECERSIZ_TARIH uyarısı. */
function zamanDamgasi(v: unknown, uyar: (k: NedenKodu) => void): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const ms = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(ms) || ms < 0) {
    uyar('GECERSIZ_TARIH');
    return undefined;
  }
  return Math.trunc(ms);
}

function diziAlani(v: unknown, uyar: (k: NedenKodu) => void): unknown[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  uyar('ALAN_BICIMI_GECERSIZ');
  return [];
}

function fiyatGecmisiAlani(v: unknown, uyar: (k: NedenKodu) => void): FiyatNoktasi[] {
  const dizi = diziAlani(v, uyar);
  const sonuc: FiyatNoktasi[] = [];
  for (const oge of dizi) {
    const tarih = duzNesneMi(oge) ? metinAl(oge.date) : null;
    const t = duzNesneMi(oge) ? tutarCoz(oge.price) : null;
    if (tarih === null || t === null || !t.tamam || t.deger < 0) {
      uyar('FIYAT_GECMISI_ELENDI');
      continue;
    }
    const y = kurusYuvarla(t.deger);
    if (Number.isNaN(y)) uyar('FIYAT_GECMISI_ELENDI');
    else sonuc.push({ date: tarih, price: y });
  }
  return sonuc;
}

function evetMi(v: unknown): boolean {
  return v === true || v === 1 || (typeof v === 'string' && ['true', '1', 'evet'].includes(sozlukAnahtari(v)));
}

/* Ürün listesi (JSON'dan çözülmüş dizi) → `begeniler` satırları. `ilgiHam` undefined → ILGI_KAYNAK_YOK. Dizi değilse SEMA_GECERSIZ (yol: 'ilgi'). */
export function ilgiDonustur(ilgiHam: unknown): IlgiDonusumu {
  if (ilgiHam === undefined || ilgiHam === null) {
    return { satirlar: [], atlananlar: [], uyarilar: [], bilgi: ['ILGI_KAYNAK_YOK'], kaynak_sayisi: 0 };
  }
  if (!Array.isArray(ilgiHam)) throw new GirdiHatasi('SEMA_GECERSIZ', 'ilgi');

  const satirlar: BegeniSatiri[] = [];
  const atlananlar: KodluKayit[] = [];
  const uyarilar: KodluKayit[] = [];
  const gorulen = new Set<string>();

  ilgiHam.forEach((ham, indeks) => {
    const sira = indeks + 1;
    if (!duzNesneMi(ham)) {
      atlananlar.push({ koleksiyon: ILGI_KOLEKSIYONU, kaynak_id: `#${sira}`, neden_kodu: 'ILGI_KAYDI_GECERSIZ' });
      return;
    }
    const idHam = typeof ham.id === 'string' ? ham.id.trim() : typeof ham.id === 'number' ? String(ham.id) : '';
    const kimlik = idHam === '' ? `#${sira}` : idHam;
    const atla = (neden_kodu: NedenKodu): void => {
      atlananlar.push({ koleksiyon: ILGI_KOLEKSIYONU, kaynak_id: kimlik.slice(0, 80), neden_kodu });
    };
    const uyar = (neden_kodu: NedenKodu): void => {
      uyarilar.push({ koleksiyon: ILGI_KOLEKSIYONU, kaynak_id: kimlik.slice(0, 80), neden_kodu });
    };

    if (idHam === '') return atla('KOD_BOS');
    /* `kod` idempotent anahtardır: kırpılamaz, sınırı aşan kayıt atlanır. */
    if (idHam.length > AZAMI.kod) return atla('KOD_UZUN');
    if (gorulen.has(idHam)) return atla('KOD_TEKRAR');
    const adHam = metinAl(ham.name);
    if (adHam === null) return atla('AD_BOS');
    gorulen.add(idHam);

    let ad = adHam;
    if (ad.length > AZAMI.ad) {
      uyar('AD_UZUN_KIRPILDI');
      ad = ad.slice(0, AZAMI.ad);
    }

    const kategori = kirpilmisMetin(ham.category, AZAMI.kategori, uyar) ?? 'diger';
    let resim = metinAl(ham.image);
    if (resim !== null && resim.length > AZAMI.resim) {
      /* Kırpılmış adres bozuk olur: alan atılır. */
      uyar('ALAN_COK_UZUN');
      resim = null;
    }
    let rozet: Nesne | null = null;
    if (ham.badge !== null && ham.badge !== undefined) {
      if (duzNesneMi(ham.badge)) rozet = ham.badge;
      else uyar('ALAN_BICIMI_GECERSIZ');
    }

    let oncelik: Oncelik = 'medium';
    const oncelikAnahtari = sozlukAnahtari(ham.priority);
    if (oncelikAnahtari !== '') {
      const bulunan = Object.hasOwn(ONCELIKLER, oncelikAnahtari) ? ONCELIKLER[oncelikAnahtari] : undefined;
      if (bulunan !== undefined) oncelik = bulunan;
      else uyar('SOZLUK_BILINMIYOR');
    }

    let puan: number | null = null;
    if (ham.rating !== null && ham.rating !== undefined && ham.rating !== '') {
      const t = tutarCoz(ham.rating);
      if (!t.tamam) uyar('GECERSIZ_TUTAR');
      else if (t.deger < 0 || t.deger > 5) uyar('ALAN_ARALIK_DISI');
      else {
        /* puan smallint: tamsayıya yarım-yukarı yuvarlanır. */
        puan = Math.floor(t.deger + 0.5);
        if (puan !== t.deger) uyar('PUAN_YUVARLANDI');
      }
    }

    const fiyat_gecmisi = fiyatGecmisiAlani(ham.price_history, uyar);
    const ts = zamanDamgasi(ham.added_at, uyar);
    const eski: BegeniSatiri['ekstra']['eski'] = { koleksiyon: ILGI_KOLEKSIYONU, id: idHam };
    if (ts !== undefined) eski.ts = ts;

    satirlar.push({
      kod: idHam,
      sira,
      kategori,
      ad,
      resim,
      rozet,
      fiyat: tutarAlani(ham.price, uyar),
      fiyat_etiketi: kirpilmisMetin(ham.price_label, AZAMI.fiyat_etiketi, uyar),
      ozellikler: diziAlani(ham.specs, uyar),
      notlar: kirpilmisMetin(ham.note, AZAMI.notlar, uyar),
      baglantilar: diziAlani(ham.links, uyar),
      oncelik,
      favori: evetMi(ham.favorite),
      puan,
      hedef_fiyat: tutarAlani(ham.target_price, uyar),
      fiyat_gecmisi,
      /* Spec B.5 önerisi: ilk_fiyat ← price_history[0]. */
      ilk_fiyat: fiyat_gecmisi.length > 0 ? fiyat_gecmisi[0]!.price : null,
      ekstra: { eski },
    });
  });

  return { satirlar, atlananlar, uyarilar, bilgi: [], kaynak_sayisi: ilgiHam.length };
}
