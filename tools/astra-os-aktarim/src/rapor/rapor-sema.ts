/* Rapor şeması: BEYAZ LİSTE. Rapora yalnız dalga, tablo/koleksiyon adı, sayılar, rapor kodları ve kuruş toplamı girer.
   Kayıt değeri, ad, IBAN, dosya no ve kaynak kimliği şemada YOKTUR. `raporDogrula` bilinmeyen anahtarı ve desen dışı metni reddeder. */
import { BILGI_KODLARI, NEDEN_KODLARI } from '../donusum/neden-kodu.ts';
import { KOLEKSIYON_ADLARI } from '../girdi/sema-ayristirici-hesap.ts';
import { DALGALAR, HEDEF_TABLOLARI, type PlanOzeti } from '../plan/plan-tipleri.ts';

/* Rapor = plan özeti (+ isteğe bağlı kısaltılmış hedef proje adı). */
export type Rapor = PlanOzeti & { hedef_proje_kisa?: string };

export class RaporHatasi extends Error {
  kod = 'RAPOR_SEMA_GECERSIZ' as const;
  yol: string;

  /* `yol` yalnız şema yolu adıdır (örn. 'atlanan.neden_kodu'); değer taşımaz. */
  constructor(yol: string) {
    super(`RAPOR_SEMA_GECERSIZ yol=${yol}`);
    this.name = 'RaporHatasi';
    this.yol = yol;
  }
}

const AD_DESENI = /^[a-z][a-z0-9_]{1,59}$/;
/* Rapora girebilen koleksiyon adları: S koleksiyonları + dönüştürücü kaynakları (apps, ilgi_urunleri). */
const KOLEKSIYON_KUMESI: readonly string[] = [...KOLEKSIYON_ADLARI, 'apps', 'ilgi_urunleri'];
const SURUM_DESENI = /^\d+\.\d+\.\d+$/;
const ONAY_DESENI = /^ONAY-[abc]-[0-9a-f]{12}$/;
const HEDEF_REF_DESENI = /^[0-9a-f]{8}$/;
const PROJE_KISA_DESENI = /^[a-z0-9]{1,4}\.\.\.$/;

type Nesne = Record<string, unknown>;

function nesne(v: unknown, izinli: readonly string[], yol: string, zorunlu: readonly string[] = izinli): Nesne {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new RaporHatasi(yol);
  const o = v as Nesne;
  for (const a of Object.keys(o)) if (!izinli.includes(a)) throw new RaporHatasi(`${yol}.${a}`);
  for (const a of zorunlu) if (!Object.hasOwn(o, a)) throw new RaporHatasi(`${yol}.${a}`);
  return o;
}

function dizi(v: unknown, yol: string): unknown[] {
  if (!Array.isArray(v)) throw new RaporHatasi(yol);
  return v;
}

function tamsayi(v: unknown, yol: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new RaporHatasi(yol);
  return v;
}

function desenli(v: unknown, desen: RegExp, yol: string): string {
  if (typeof v !== 'string' || !desen.test(v)) throw new RaporHatasi(yol);
  return v;
}

function kumeden<T extends string>(v: unknown, kume: readonly T[], yol: string): T {
  if (typeof v !== 'string' || !(kume as readonly string[]).includes(v)) throw new RaporHatasi(yol);
  return v as T;
}

/* Rapor nesnesini şemaya göre doğrular ve YENİ bir nesne olarak (yalnız beyaz liste alanlarıyla) döndürür. */
export function raporDogrula(girdi: unknown): Rapor {
  const k = nesne(
    girdi,
    ['dalga', 'arac_surumu', 'hedef_ref', 'onay_kodu', 'girdi_ozeti', 'hedef_tablolar', 'kontrol_toplamlari', 'sayaclar', 'atlanan', 'uyarilar', 'bilgi_kodlari', 'hedef_proje_kisa'],
    'rapor',
    ['dalga', 'arac_surumu', 'hedef_ref', 'onay_kodu', 'girdi_ozeti', 'hedef_tablolar', 'kontrol_toplamlari', 'sayaclar', 'atlanan', 'uyarilar', 'bilgi_kodlari'],
  );
  const gi = nesne(k.girdi_ozeti, ['koleksiyon_sayilari', 'silinen_mezar_sayisi', 'bilinmeyen_anahtar_sayisi', 'gecersiz_kayit_sayisi'], 'girdi_ozeti');
  const kodSatiri = (v: unknown, yol: string) => {
    const o = nesne(v, ['koleksiyon', 'neden_kodu', 'sayi'], yol);
    return { koleksiyon: kumeden(o.koleksiyon, KOLEKSIYON_KUMESI, `${yol}.koleksiyon`), neden_kodu: kumeden(o.neden_kodu, NEDEN_KODLARI, `${yol}.neden_kodu`), sayi: tamsayi(o.sayi, `${yol}.sayi`) };
  };

  const rapor: Rapor = {
    dalga: kumeden(k.dalga, DALGALAR, 'dalga'),
    arac_surumu: desenli(k.arac_surumu, SURUM_DESENI, 'arac_surumu'),
    hedef_ref: desenli(k.hedef_ref, HEDEF_REF_DESENI, 'hedef_ref'),
    onay_kodu: desenli(k.onay_kodu, ONAY_DESENI, 'onay_kodu'),
    girdi_ozeti: {
      koleksiyon_sayilari: dizi(gi.koleksiyon_sayilari, 'girdi_ozeti.koleksiyon_sayilari').map((v) => {
        const o = nesne(v, ['koleksiyon', 'sayi'], 'girdi_ozeti.koleksiyon_sayilari');
        return { koleksiyon: kumeden(o.koleksiyon, KOLEKSIYON_KUMESI, 'girdi_ozeti.koleksiyon'), sayi: tamsayi(o.sayi, 'girdi_ozeti.sayi') };
      }),
      silinen_mezar_sayisi: tamsayi(gi.silinen_mezar_sayisi, 'girdi_ozeti.silinen_mezar_sayisi'),
      bilinmeyen_anahtar_sayisi: tamsayi(gi.bilinmeyen_anahtar_sayisi, 'girdi_ozeti.bilinmeyen_anahtar_sayisi'),
      gecersiz_kayit_sayisi: tamsayi(gi.gecersiz_kayit_sayisi, 'girdi_ozeti.gecersiz_kayit_sayisi'),
    },
    hedef_tablolar: dizi(k.hedef_tablolar, 'hedef_tablolar').map((v) => {
      const o = nesne(v, ['tablo', 'yeni', 'atlanan'], 'hedef_tablolar');
      return { tablo: kumeden(o.tablo, HEDEF_TABLOLARI, 'hedef_tablolar.tablo'), yeni: tamsayi(o.yeni, 'hedef_tablolar.yeni'), atlanan: tamsayi(o.atlanan, 'hedef_tablolar.atlanan') };
    }),
    kontrol_toplamlari: dizi(k.kontrol_toplamlari, 'kontrol_toplamlari').map((v) => {
      const o = nesne(v, ['ad', 'kurus_toplami'], 'kontrol_toplamlari');
      return { ad: desenli(o.ad, AD_DESENI, 'kontrol_toplamlari.ad'), kurus_toplami: tamsayi(o.kurus_toplami, 'kontrol_toplamlari.kurus_toplami') };
    }),
    sayaclar: dizi(k.sayaclar, 'sayaclar').map((v) => {
      const o = nesne(v, ['ad', 'sayi'], 'sayaclar');
      return { ad: desenli(o.ad, AD_DESENI, 'sayaclar.ad'), sayi: tamsayi(o.sayi, 'sayaclar.sayi') };
    }),
    atlanan: dizi(k.atlanan, 'atlanan').map((v) => kodSatiri(v, 'atlanan')),
    uyarilar: dizi(k.uyarilar, 'uyarilar').map((v) => kodSatiri(v, 'uyarilar')),
    bilgi_kodlari: dizi(k.bilgi_kodlari, 'bilgi_kodlari').map((v) => kumeden(v, BILGI_KODLARI, 'bilgi_kodlari')),
  };
  if (k.hedef_proje_kisa !== undefined) rapor.hedef_proje_kisa = desenli(k.hedef_proje_kisa, PROJE_KISA_DESENI, 'hedef_proje_kisa');
  return rapor;
}
