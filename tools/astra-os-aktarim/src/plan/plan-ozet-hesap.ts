/* Plan özeti: sayılar, kod sayaçları ve kuruş cinsinden kontrol toplamları. SAF; kayıt değeri döndürmez. */
import type { KodluKayit } from '../donusum/neden-kodu.ts';
import { kurusToplami } from '../donusum/sayi-hesap.ts';
import type { SemaOzeti } from '../girdi/sema-ayristirici-hesap.ts';
import type { BegeniPlanKaydi, GirdiOzeti, HedefTablo, HedefTabloOzeti, KodSatiri, PlanKaydi } from './plan-tipleri.ts';

/* Koleksiyon → hedef tablo (atlananların hangi tabloya ait sayılacağı). */
const KOLEKSIYON_TABLO: Readonly<Record<string, HedefTablo>> = { apps: 'uygulama_durumu', ilgi_urunleri: 'begeniler' };

function karsilastir(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* (koleksiyon, neden kodu) başına sayı; sıralı (deterministik). */
export function kodSayilariKur(kayitlar: readonly KodluKayit[]): KodSatiri[] {
  const harita = new Map<string, KodSatiri>();
  for (const k of kayitlar) {
    const anahtar = `${k.koleksiyon}\u0000${k.neden_kodu}`;
    const var_ = harita.get(anahtar);
    if (var_) var_.sayi++;
    else harita.set(anahtar, { koleksiyon: k.koleksiyon, neden_kodu: k.neden_kodu, sayi: 1 });
  }
  return [...harita.values()].sort((a, b) => karsilastir(a.koleksiyon, b.koleksiyon) || karsilastir(a.neden_kodu, b.neden_kodu));
}

export function girdiOzetiKur(ozet: SemaOzeti): GirdiOzeti {
  return {
    koleksiyon_sayilari: Object.entries(ozet.koleksiyon_sayilari)
      .map(([koleksiyon, sayi]) => ({ koleksiyon, sayi }))
      .sort((a, b) => karsilastir(a.koleksiyon, b.koleksiyon)),
    silinen_mezar_sayisi: ozet.silinen_mezar_sayisi,
    bilinmeyen_anahtar_sayisi: ozet.bilinmeyen_anahtar_sayisi,
    gecersiz_kayit_sayisi: ozet.gecersiz_kayit_sayisi,
  };
}

/* Tablo başına yazılacak (yeni) ve atlanan kayıt sayısı. Yalnız sayısı > 0 olan tablolar listelenir. */
export function hedefTablolariKur(kayitlar: readonly PlanKaydi[], atlananlar: readonly KodluKayit[]): HedefTabloOzeti[] {
  const harita = new Map<HedefTablo, HedefTabloOzeti>();
  const al = (tablo: HedefTablo): HedefTabloOzeti => {
    let o = harita.get(tablo);
    if (!o) {
      o = { tablo, yeni: 0, atlanan: 0 };
      harita.set(tablo, o);
    }
    return o;
  };
  for (const k of kayitlar) al(k.tablo).yeni++;
  for (const a of atlananlar) {
    const tablo = KOLEKSIYON_TABLO[a.koleksiyon];
    if (tablo !== undefined) al(tablo).atlanan++;
  }
  return [...harita.values()].sort((a, b) => karsilastir(a.tablo, b.tablo));
}

/* `begeniler.fiyat` toplamı, tam sayı kuruş (TRY varsayımı; ürün kaynağında para birimi alanı yok). */
export function begeniFiyatToplami(kayitlar: readonly PlanKaydi[]): number {
  const fiyatlar: number[] = [];
  for (const k of kayitlar) {
    if (k.tablo !== 'begeniler') continue;
    const fiyat = (k as BegeniPlanKaydi).satir.fiyat;
    if (fiyat !== null) fiyatlar.push(fiyat);
  }
  return kurusToplami(fiyatlar).kurus;
}
