/* `S.diger.apps` (anahtar → JSON metni) → `uygulama_durumu` satırları (spec D, plan §6 dalga a, karar H-11).
   SAF: dosya/ağ/ortam yok. Değer olduğu gibi aktarılır (yeniden serileştirme YOK, bayt sadakati); `hesapyon` ve `karsilama` dahil;
   yerel pano tablolarına (görev/not) dönüştürme YOK. */
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { duzNesneMi, type S } from '../girdi/sema-ayristirici-hesap.ts';
import type { KodluKayit } from './neden-kodu.ts';

export const APP_KOLEKSIYONU = 'apps';
export const UYGULAMA_KODU_DESENI = /^[a-z]{2,24}$/;
export const AZAMI_DEGER = 8 * 1024 * 1024; /* uygulama_durumu_yaz: length(p_deger) > 8388608 reddedilir */
export const AZAMI_ANAHTAR_UZUNLUGU = 200;
export const AZAMI_UYGULAMA_ANAHTARI = 300; /* köprü: AZAMI_ANAHTAR */

/* Eski `apps-durum.js` APP_ANAHTARLARI (spec D). Uygulama kodları CL `UYGULAMALAR[].kod` ile aynıdır.
   BELİRSİZLİK: spec D `karsilama` için "12 anahtar" der ama yalnız 10 adı sayar (astra_* ... "…"); kalan 2 anahtarın adı plan/spec'te YOK, tahmin edilmedi:
   eşlenmeyen anahtarlar ANAHTAR_ESLENMEDI olarak sayılır (sessiz düşme yok). Plan "12 uygulama" der, spec 11 uygulamanın anahtarını verir (kutuphane yok). */
export const APP_ANAHTARLARI: Readonly<Record<string, readonly string[]>> = {
  odeme: ['odeme-raporu-v1'],
  tasarim: ['tasarim-atolyesi-kutuphane', 'tasarim-atolyesi-gecmis', 'tasarim-atolyesi-ayar'],
  karsilama: [
    'astra_prefs', 'astra_tasks', 'astra_events', 'astra_notes', 'astra_health',
    'astra_expenses', 'astra_payments', 'astra_balance', 'astra_emails', 'astra_menu',
  ],
  telrehber: ['tr-fav', 'tr-chip'],
  oynatma: ['oynatma-listelerim-durum-v2', 'oynatma-listelerim-ui'],
  pinterest: ['pinterest-panolarim-durum-v1', 'pinterest-panolarim-ui'],
  ilgi: ['ilgi-urunler-durum-v1', 'ilgi-urunler-ui'],
  dosya: ['dosya-yoneticisi-ui', 'dosya-yoneticisi-uretilen'],
  marketliste: ['market-listesi-v1', 'market-listesi-ayar'],
  bahis: ['bahis_takip_v2', 'bahis_takip_theme'],
  hesapyon: ['hesap-yoneticisi-v1'],
};

export type UygulamaSatiri = { uygulama: string; anahtar: string; deger: string };
export type UygulamaSayisi = { uygulama: string; sayi: number };
export type UygulamaDonusumu = {
  satirlar: UygulamaSatiri[];
  atlananlar: KodluKayit[];
  uyarilar: KodluKayit[];
  uygulama_sayilari: UygulamaSayisi[];
  kaynak_anahtar_sayisi: number;
};

/* anahtar → uygulama koduna ters dizin. Map kullanılır: '__proto__' gibi anahtarlar sıradan anahtar sayılır. */
function tersDizinKur(): Map<string, string> {
  const dizin = new Map<string, string>();
  for (const [uygulama, anahtarlar] of Object.entries(APP_ANAHTARLARI)) {
    if (!UYGULAMA_KODU_DESENI.test(uygulama)) continue;
    for (const a of anahtarlar) dizin.set(a, uygulama);
  }
  return dizin;
}
const TERS_DIZIN = tersDizinKur();

/* Karakter (kod noktası) sayısı: SQL `length()` ile aynı ölçü. UTF-16 uzunluğu sınırı aşmıyorsa kod noktası sayısı da aşmaz. */
function karakterSayisi(metin: string): number {
  if (metin.length <= AZAMI_DEGER) return metin.length;
  let n = 0;
  for (let i = 0; i < metin.length; i++) {
    const c = metin.charCodeAt(i);
    if (c >= 0xdc00 && c <= 0xdfff && i > 0) {
      const onceki = metin.charCodeAt(i - 1);
      if (onceki >= 0xd800 && onceki <= 0xdbff) continue;
    }
    n++;
  }
  return n;
}

function siraKarsilastir(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* `S.diger.apps` → `uygulama_durumu` satırları. Çıktı (uygulama, anahtar) sırasındadır (deterministik onay kodu için). */
export function uygulamaDonustur(s: S): UygulamaDonusumu {
  const ham = s.diger.apps;
  if (ham !== undefined && ham !== null && !duzNesneMi(ham)) throw new GirdiHatasi('SEMA_GECERSIZ', 'diger.apps');
  const apps = ham ?? {};
  const anahtarlar = Object.keys(apps).sort(siraKarsilastir);

  const satirlar: UygulamaSatiri[] = [];
  const atlananlar: KodluKayit[] = [];
  const sayac = new Map<string, number>();
  const atla = (kaynak_id: string, neden_kodu: KodluKayit['neden_kodu']): void => {
    atlananlar.push({ koleksiyon: APP_KOLEKSIYONU, kaynak_id, neden_kodu });
  };

  for (const anahtar of anahtarlar) {
    /* Uzunluk denetimi eşlemeden önce: çok uzun anahtar da sayılır (uygulama_durumu.anahtar ≤ 200). */
    if (karakterSayisi(anahtar) > AZAMI_ANAHTAR_UZUNLUGU) {
      atla(anahtar.slice(0, 40), 'ANAHTAR_COK_UZUN');
      continue;
    }
    const uygulama = TERS_DIZIN.get(anahtar);
    if (uygulama === undefined) {
      atla(anahtar, 'ANAHTAR_ESLENMEDI');
      continue;
    }
    const kaynak_id = `${uygulama}/${anahtar}`;
    const deger = apps[anahtar];
    if (typeof deger !== 'string') {
      atla(kaynak_id, 'DEGER_METIN_DEGIL');
      continue;
    }
    if (karakterSayisi(deger) > AZAMI_DEGER) {
      atla(kaynak_id, 'DEGER_COK_BUYUK');
      continue;
    }
    const onceki = sayac.get(uygulama) ?? 0;
    if (onceki >= AZAMI_UYGULAMA_ANAHTARI) {
      atla(kaynak_id, 'ANAHTAR_COK_FAZLA');
      continue;
    }
    sayac.set(uygulama, onceki + 1);
    satirlar.push({ uygulama, anahtar, deger });
  }

  satirlar.sort((a, b) => siraKarsilastir(a.uygulama, b.uygulama) || siraKarsilastir(a.anahtar, b.anahtar));
  const uygulama_sayilari = [...sayac.entries()].map(([uygulama, sayi]) => ({ uygulama, sayi })).sort((a, b) => siraKarsilastir(a.uygulama, b.uygulama));
  return { satirlar, atlananlar, uyarilar: [], uygulama_sayilari, kaynak_anahtar_sayisi: anahtarlar.length };
}
