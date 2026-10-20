import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, CANARY_IBAN, SENTETIK_GECERSIZ_IBAN, canaryBul, ibanBoslukluYaz, testIbanlari } from '@astra/ortak-test';
import {
  CiktiHatasi, ciktiHedefiAyarla, hataYazdir, ilerlemeYazdir, istemiBitir, olayYazdir, pinIstemiYazdir, raporDosyasiYaz, raporYazdir, sessizAyarla, yardimYazdir,
  type KomutOlayi,
} from './cikti.ts';
import { ciktiYakala, sentetikPlanKur, type CiktiYakalayici } from './test-destek.ts';
import { raporDogrula, type Rapor } from './rapor/rapor-sema.ts';

let yakala: CiktiYakalayici;
let kok = '';
beforeEach(() => {
  yakala = ciktiYakala();
  kok = mkdtempSync(join(tmpdir(), 'aktarim-cikti-'));
});
afterEach(() => {
  yakala.birak();
  rmSync(kok, { recursive: true, force: true });
});

const rapor = (): Rapor => ({ ...sentetikPlanKur().plan.ozet, hedef_proje_kisa: 'abcd...' });

describe('olayYazdir: biçim', () => {
  it('tür, kod ve alanları tek satıra yazar', () => {
    olayYazdir({ tur: 'SONUC', kod: 'YAZ_TAMAM', alanlar: { aktarim_id: '11111111-1111-4111-8111-000000000001', dalga: 'a', sayi: 12 } });
    expect(yakala.satirlar).toEqual(['SONUC YAZ_TAMAM aktarim_id=11111111-1111-4111-8111-000000000001 dalga=a sayi=12']);
  });
  it('alansız olay yalnız tür ve kod yazar', () => {
    olayYazdir({ tur: 'HATA', kod: 'BEKLENMEYEN_HATA' });
    expect(yakala.satirlar).toEqual(['HATA BEKLENMEYEN_HATA']);
  });
  it('onay kodları, tablo adları ve nokta/tire içeren kısa kimlikler geçer', () => {
    for (const deger of ['ONAY-a-0123456789ab', 'ONAY-geri-0123456789ab', 'ONAY-statik-0123456789ab', 'aktarim_eslesme', 'koleksiyon.debts', 'a-b_c.d', 'x'.repeat(64)]) {
      yakala.satirlar.length = 0;
      olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger } });
      expect(yakala.satirlar).toHaveLength(1);
    }
  });
});

describe('olayYazdir: desen kapısı (serbest metin kabul edilmez)', () => {
  const kotuKodlar = ['kucuk_harf', 'AB', 'BOSLUK VAR', 'TURKCE_İ', '1SAYI', '', 'A'.repeat(49), CANARY_AD, 'KOD-TIRE'];
  it.each(kotuKodlar.map((k) => [k]))('geçersiz olay kodu %j reddedilir', (kod) => {
    expect(() => olayYazdir({ tur: 'BILGI', kod })).toThrowError(CiktiHatasi);
    expect(yakala.satirlar).toEqual([]);
  });

  it.each([['Buyuk'], ['1ad'], ['bosluk var'], ['a'.repeat(41)], [''], ['ç']])('geçersiz alan adı %j reddedilir', (ad) => {
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { [ad]: 1 } })).toThrowError(CiktiHatasi);
    expect(yakala.satirlar).toEqual([]);
  });

  it.each([[1.5], [NaN], [Infinity], [2 ** 60], [-(2 ** 60)]])('güvenli tamsayı olmayan sayı %j reddedilir', (deger) => {
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { sayi: deger } })).toThrowError(CiktiHatasi);
  });

  it('negatif ve sıfır tamsayı kabul edilir', () => {
    olayYazdir({ tur: 'FARK', kod: 'FARK_VAR', alanlar: { fark: -12345, sifir: 0 } });
    expect(yakala.satirlar).toEqual(['FARK FARK_VAR fark=-12345 sifir=0']);
  });

  it.each([['boşluklu metin'], ['a/b'], [''], ['x'.repeat(65)], ['Türkçe ç'], ['a=b'], ['a\nb'], [CANARY_AD], ['2099/CNR77 Esas']])('serbest metin değer %j reddedilir', (deger) => {
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger } })).toThrowError(CiktiHatasi);
    expect(yakala.satirlar).toEqual([]);
  });

  it('CiktiHatasi mesajı sabittir ve girdi değeri taşımaz', () => {
    try {
      olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger: CANARY_AD } });
      expect.unreachable();
    } catch (e) {
      expect((e as CiktiHatasi).message).toBe('CIKTI_HATASI SIZINTI_ENGELLENDI');
      expect((e as CiktiHatasi).kod).toBe('SIZINTI_ENGELLENDI');
    }
  });
});

describe('IBAN son savunma', () => {
  it('düz IBAN içeren değer alan deseninden geçse bile yazılmaz', () => {
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger: CANARY_IBAN } })).toThrowError(CiktiHatasi);
    expect(yakala.satirlar).toEqual([]);
  });
  it('mod-97 geçersiz ama IBAN biçimli değer de engellenir', () => {
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger: SENTETIK_GECERSIZ_IBAN } })).toThrowError(CiktiHatasi);
  });
  it('rastgele test IBAN\'ları hep engellenir', () => {
    for (const iban of testIbanlari(5, 8)) {
      expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger: iban } }), iban).toThrowError(CiktiHatasi);
    }
    expect(yakala.satirlar).toEqual([]);
  });
  it('boşluklu IBAN raporun alan değerinden geçemez (desen) ve yazılmaz', () => {
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger: ibanBoslukluYaz(CANARY_IBAN) } })).toThrowError(CiktiHatasi);
  });
  it('normal onay kodu, UUID ve sayılar IBAN sanılmaz (yanlış pozitif yok)', () => {
    olayYazdir({ tur: 'SONUC', kod: 'GERI_AL_KURU', alanlar: { secilen: 22, onay_kodu: 'ONAY-geri-0123456789ab', aktarim_id: '00000000-0000-4000-8000-000000000001' } });
    olayYazdir({ tur: 'SONUC', kod: 'ONAY_KODU', alanlar: { kod: 'ONAY-statik-ab12cd34ef56' } });
    expect(yakala.satirlar).toHaveLength(2);
  });
  it('hedef çağrılmadan önce engellenir (kısmi yazma yok)', () => {
    const yazilan: string[] = [];
    ciktiHedefiAyarla({ satir: (m) => void yazilan.push(m) });
    expect(() => olayYazdir({ tur: 'BILGI', kod: 'DENEME', alanlar: { deger: CANARY_IBAN } })).toThrowError();
    expect(yazilan).toEqual([]);
  });
});

describe('sessiz kip', () => {
  it('BILGI olaylarını, raporu ve ilerlemeyi bastırır; SONUC/HATA/UYARI/FARK geçer', () => {
    sessizAyarla(true);
    olayYazdir({ tur: 'BILGI', kod: 'DENEME' });
    raporYazdir(rapor(), false);
    ilerlemeYazdir({ asama: 'yazma', tamamlanan: 1, toplam: 2 });
    expect(yakala.satirlar).toEqual([]);
    for (const tur of ['SONUC', 'HATA', 'UYARI', 'FARK'] as const) olayYazdir({ tur, kod: 'DENEME' });
    expect(yakala.satirlar).toEqual(['SONUC DENEME', 'HATA DENEME', 'UYARI DENEME', 'FARK DENEME']);
  });
  it('sessizAyarla(false) çıktıyı geri açar', () => {
    sessizAyarla(true);
    sessizAyarla(false);
    olayYazdir({ tur: 'BILGI', kod: 'DENEME' });
    expect(yakala.satirlar).toEqual(['BILGI DENEME']);
  });
});

describe('raporYazdir / raporDosyasiYaz', () => {
  it('metin ve JSON biçimlerini yazar', () => {
    raporYazdir(rapor(), false);
    raporYazdir(rapor(), true);
    expect(yakala.satirlar[0]).toContain('ONAY_KODU ONAY-a-');
    expect(raporDogrula(JSON.parse(yakala.satirlar[1]!))).toEqual(rapor());
  });
  it('rapor dosyasını 0600 izniyle yazar ve içeriği şemadan geçer', () => {
    const yol = join(kok, 'r.json');
    raporDosyasiYaz(yol, rapor());
    expect(statSync(yol).mode & 0o777).toBe(0o600);
    expect(raporDogrula(JSON.parse(readFileSync(yol, 'utf8')))).toEqual(rapor());
  });
  it('önceden var olan (0644) dosyaya yazılsa bile sonuç yalnız sahibi okuyabilir (0600) olur', () => {
    const yol = join(kok, 'r.json');
    writeFileSync(yol, 'eski');
    chmodSync(yol, 0o644);
    raporDosyasiYaz(yol, rapor());
    expect(statSync(yol).mode & 0o777).toBe(0o600);
  });
  it('geçersiz rapor dosyaya yazılmaz', () => {
    const yol = join(kok, 'r.json');
    expect(() => raporDosyasiYaz(yol, { ...rapor(), kaynak_id: 'x' } as unknown as Rapor)).toThrowError();
    expect(() => statSync(yol)).toThrowError();
  });
});

describe('hataYazdir', () => {
  it('süzülmüş hatayı sabit biçimde yazar', () => {
    hataYazdir({ kod: '23505', durum: 409, tablo: 'begeniler' });
    hataYazdir({ kod: 'BILINMEYEN_HATA', durum: null, tablo: null });
    expect(yakala.satirlar).toEqual(['HATA kod=23505 durum=409 tablo=begeniler', 'HATA kod=BILINMEYEN_HATA durum=- tablo=-']);
  });
});

describe('ilerlemeYazdir', () => {
  it('sayıları tamsayıya keser', () => {
    ilerlemeYazdir({ asama: 'yazma', tamamlanan: 3.9, toplam: 10.2 });
    expect(yakala.satirlar).toEqual(['ILERLEME yazma 3/10']);
  });
});

describe('PIN istemi ve yardım', () => {
  it('istem satır sonsuz yazıcıya gider; yoksa satıra', () => {
    pinIstemiYazdir();
    expect(yakala.satirlar).toEqual(['PIN (gizli, ekranda gorunmez): ']);
    const normal: string[] = [];
    ciktiHedefiAyarla({ satir: (m) => void normal.push(m) });
    pinIstemiYazdir();
    istemiBitir();
    expect(normal).toEqual(['PIN (gizli, ekranda gorunmez): ', '']);
  });
  it('yardım metni sabittir, komutları ve ortam değişkeni ADLARINI içerir, değer içermez', () => {
    yardimYazdir();
    const metin = yakala.metin();
    for (const komut of ['kuru-calistir', 'yaz', 'dogrula', 'geri-al', 'yetim-tara', 'statik-yukle']) expect(metin).toContain(komut);
    for (const ad of ['ASTRA_SUPABASE_URL', 'ASTRA_SUPABASE_ANON', 'ASTRA_PIN', 'ASTRA_SERVIS_ANAHTARI']) expect(metin).toContain(ad);
    expect(metin).not.toContain('--pin');
    expect(canaryBul(metin)).toEqual([]);
  });
});

describe('ciktiHedefiAyarla', () => {
  it('null varsayılan hedefe döner (test hedefi artık çağrılmaz)', () => {
    const olay: KomutOlayi = { tur: 'BILGI', kod: 'DENEME' };
    ciktiHedefiAyarla(null);
    const yazilan: string[] = [];
    ciktiHedefiAyarla({ satir: (m) => void yazilan.push(m) });
    olayYazdir(olay);
    expect(yazilan).toEqual(['BILGI DENEME']);
  });
});
