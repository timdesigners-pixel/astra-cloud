import { describe, it, expect } from 'vitest';
import { CANARY_AD, CANARY_DOSYA_NO, CANARY_IBAN, canaryBul } from '@astra/ortak-test';
import { sentetikPlanKur } from '../test-destek.ts';
import { RaporHatasi, raporDogrula, type Rapor } from './rapor-sema.ts';

function gecerliRapor(): Rapor {
  return { ...sentetikPlanKur().plan.ozet, hedef_proje_kisa: 'abcd...' };
}
function klon(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(gecerliRapor())) as Record<string, unknown>;
}
function yolAl(girdi: unknown): string {
  try {
    raporDogrula(girdi);
  } catch (e) {
    expect(e).toBeInstanceOf(RaporHatasi);
    expect((e as RaporHatasi).kod).toBe('RAPOR_SEMA_GECERSIZ');
    return (e as RaporHatasi).yol;
  }
  throw new Error('RaporHatasi bekleniyordu');
}
function degistir(f: (r: Record<string, any>) => void): unknown {
  const r = klon() as Record<string, any>;
  f(r);
  return r;
}

describe('raporDogrula: geçerli rapor', () => {
  it('plan özetini (+ proje kısaltmasını) kabul eder ve aynı içeriği YENİ nesne olarak döndürür', () => {
    const r = gecerliRapor();
    const d = raporDogrula(r);
    expect(d).toEqual(r);
    expect(d).not.toBe(r);
    expect(d.girdi_ozeti).not.toBe(r.girdi_ozeti);
  });
  it('hedef_proje_kisa isteğe bağlıdır', () => {
    const r = klon();
    delete r.hedef_proje_kisa;
    expect('hedef_proje_kisa' in raporDogrula(r)).toBe(false);
  });
  it('beyaz liste dışı alanlar çıktıya taşınmaz (yalnız şema alanları)', () => {
    expect(Object.keys(raporDogrula(gecerliRapor())).sort()).toEqual([
      'arac_surumu', 'atlanan', 'bilgi_kodlari', 'dalga', 'girdi_ozeti', 'hedef_proje_kisa', 'hedef_ref', 'hedef_tablolar',
      'kontrol_toplamlari', 'onay_kodu', 'sayaclar', 'uyarilar',
    ]);
  });
  it('dalga b/c boş planı da geçerlidir', () => {
    for (const dalga of ['b', 'c'] as const) expect(() => raporDogrula(sentetikPlanKur({ dalga }).plan.ozet)).not.toThrow();
  });
});

describe('raporDogrula: yasak anahtarlar reddedilir', () => {
  const yasaklar = ['kaynak_id', 'ad', 'iban', 'dosya_no', 'tutar', 'deger', 'kayitlar', 'parola', 'pin', 'ayrinti', 'message', 'details'];
  it.each(yasaklar)('kökte %s anahtarı', (anahtar) => {
    expect(yolAl(degistir((r) => (r[anahtar] = 'x')))).toBe(`rapor.${anahtar}`);
  });
  it('atlanan satırında kaynak_id', () => {
    expect(yolAl(degistir((r) => (r.atlanan = [{ koleksiyon: 'apps', neden_kodu: 'MEZAR_TASI', sayi: 1, kaynak_id: 'borc-sil-01' }])))).toBe('atlanan.kaynak_id');
  });
  it('uyarılar satırında ad', () => {
    expect(yolAl(degistir((r) => (r.uyarilar = [{ koleksiyon: 'apps', neden_kodu: 'AD_BOS', sayi: 1, ad: CANARY_AD }])))).toBe('uyarilar.ad');
  });
  it('hedef tablo satırında fazladan alan', () => {
    expect(yolAl(degistir((r) => (r.hedef_tablolar[0].iban = CANARY_IBAN)))).toBe('hedef_tablolar.iban');
  });
  it('kontrol toplamı ve sayaç satırlarında fazladan alan', () => {
    expect(yolAl(degistir((r) => (r.kontrol_toplamlari[0].deger = 1)))).toBe('kontrol_toplamlari.deger');
    expect(yolAl(degistir((r) => (r.sayaclar[0].ad2 = 'x')))).toBe('sayaclar.ad2');
  });
  it('girdi özetinde ve koleksiyon sayısı satırında fazladan alan', () => {
    expect(yolAl(degistir((r) => (r.girdi_ozeti.kayit_adi = 'x')))).toBe('girdi_ozeti.kayit_adi');
    expect(yolAl(degistir((r) => (r.girdi_ozeti.koleksiyon_sayilari[0].adlar = ['x'])))).toBe('girdi_ozeti.koleksiyon_sayilari.adlar');
  });
});

describe('raporDogrula: eksik ve biçimsiz alanlar', () => {
  it.each(['dalga', 'arac_surumu', 'hedef_ref', 'onay_kodu', 'girdi_ozeti', 'hedef_tablolar', 'kontrol_toplamlari', 'sayaclar', 'atlanan', 'uyarilar', 'bilgi_kodlari'])('zorunlu %s eksikse reddedilir', (alan) => {
    expect(yolAl(degistir((r) => delete r[alan]))).toBe(`rapor.${alan}`);
  });
  it('nesne olmayan kök reddedilir', () => {
    for (const v of [null, undefined, [], 'x', 5]) expect(yolAl(v)).toBe('rapor');
  });
  it('geçersiz dalga, sürüm, hedef özeti, onay kodu ve proje kısaltması', () => {
    expect(yolAl(degistir((r) => (r.dalga = 'z')))).toBe('dalga');
    expect(yolAl(degistir((r) => (r.arac_surumu = '15.0')))).toBe('arac_surumu');
    expect(yolAl(degistir((r) => (r.hedef_ref = 'ABCD1234')))).toBe('hedef_ref');
    expect(yolAl(degistir((r) => (r.hedef_ref = 'abcd12')))).toBe('hedef_ref');
    expect(yolAl(degistir((r) => (r.onay_kodu = 'ONAY-d-0123456789ab')))).toBe('onay_kodu');
    expect(yolAl(degistir((r) => (r.onay_kodu = 'ONAY-a-0123456789AB')))).toBe('onay_kodu');
    expect(yolAl(degistir((r) => (r.hedef_proje_kisa = 'abcde...')))).toBe('hedef_proje_kisa');
    expect(yolAl(degistir((r) => (r.hedef_proje_kisa = 'Abc...')))).toBe('hedef_proje_kisa');
    expect(yolAl(degistir((r) => (r.hedef_proje_kisa = 'abcd')))).toBe('hedef_proje_kisa');
    expect(yolAl(degistir((r) => (r.hedef_proje_kisa = 'abcd1234.supabase.co')))).toBe('hedef_proje_kisa');
  });
  it('tamsayı olmayan sayılar reddedilir (ondalık, metin, NaN, güvenli aralık dışı)', () => {
    for (const v of [1.5, '3', NaN, Infinity, null, 2 ** 60]) {
      expect(yolAl(degistir((r) => (r.atlanan = [{ koleksiyon: 'apps', neden_kodu: 'MEZAR_TASI', sayi: v }])))).toBe('atlanan.sayi');
    }
    expect(yolAl(degistir((r) => (r.girdi_ozeti.silinen_mezar_sayisi = 1.5)))).toBe('girdi_ozeti.silinen_mezar_sayisi');
    expect(yolAl(degistir((r) => (r.kontrol_toplamlari[0].kurus_toplami = 12.5)))).toBe('kontrol_toplamlari.kurus_toplami');
  });
  it('kuruş toplamı negatif tamsayı olabilir (bahis zararı)', () => {
    expect(() => raporDogrula(degistir((r) => (r.kontrol_toplamlari[0].kurus_toplami = -12345)))).not.toThrow();
  });
  it('kümelerin dışındaki neden kodu, koleksiyon, tablo ve bilgi kodu reddedilir', () => {
    expect(yolAl(degistir((r) => (r.atlanan = [{ koleksiyon: 'apps', neden_kodu: 'KENDI_KODUM', sayi: 1 }])))).toBe('atlanan.neden_kodu');
    expect(yolAl(degistir((r) => (r.atlanan = [{ koleksiyon: 'baska_liste', neden_kodu: 'MEZAR_TASI', sayi: 1 }])))).toBe('atlanan.koleksiyon');
    expect(yolAl(degistir((r) => (r.hedef_tablolar = [{ tablo: 'users', yeni: 1, atlanan: 0 }])))).toBe('hedef_tablolar.tablo');
    expect(yolAl(degistir((r) => (r.bilgi_kodlari = ['SERBEST_METIN'])))).toBe('bilgi_kodlari');
    expect(yolAl(degistir((r) => (r.girdi_ozeti.koleksiyon_sayilari = [{ koleksiyon: 'x', sayi: 1 }])))).toBe('girdi_ozeti.koleksiyon');
  });
  it('ad desenine uymayan sayaç/kontrol adları reddedilir (boşluk, büyük harf, Türkçe karakter, çok uzun)', () => {
    for (const ad of ['Büyük', 'bosluk var', 'ç_ad', 'a', 'x'.repeat(61), '1sayi', CANARY_AD]) {
      expect(yolAl(degistir((r) => (r.sayaclar = [{ ad, sayi: 1 }]))), ad).toBe('sayaclar.ad');
      expect(yolAl(degistir((r) => (r.kontrol_toplamlari = [{ ad, kurus_toplami: 1 }]))), ad).toBe('kontrol_toplamlari.ad');
    }
  });
  it('dizi olması gereken alanlar dizi değilse reddedilir', () => {
    for (const alan of ['hedef_tablolar', 'kontrol_toplamlari', 'sayaclar', 'atlanan', 'uyarilar', 'bilgi_kodlari']) {
      expect(yolAl(degistir((r) => (r[alan] = {})))).toBe(alan);
    }
    expect(yolAl(degistir((r) => (r.girdi_ozeti.koleksiyon_sayilari = {})))).toBe('girdi_ozeti.koleksiyon_sayilari');
  });
});

describe('RaporHatasi: değer taşımaz', () => {
  it('mesaj yalnız şema yolunu içerir; reddedilen değer ve anahtar değeri sızmaz', () => {
    const sizintili = [
      degistir((r) => (r.atlanan = [{ koleksiyon: 'apps', neden_kodu: CANARY_AD, sayi: 1 }])),
      degistir((r) => (r.sayaclar = [{ ad: CANARY_DOSYA_NO, sayi: 1 }])),
      degistir((r) => (r.onay_kodu = CANARY_IBAN)),
      degistir((r) => (r.hedef_proje_kisa = CANARY_AD)),
      degistir((r) => (r.dalga = CANARY_AD)),
      degistir((r) => (r.girdi_ozeti.silinen_mezar_sayisi = CANARY_AD)),
    ];
    for (const g of sizintili) {
      try {
        raporDogrula(g);
        expect.unreachable();
      } catch (e) {
        const h = e as RaporHatasi;
        expect(canaryBul(h.message)).toEqual([]);
        expect(h.message).toMatch(/^RAPOR_SEMA_GECERSIZ yol=[A-Za-z_.]+$/);
      }
    }
  });
});
