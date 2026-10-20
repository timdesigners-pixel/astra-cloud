import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { CANARY_ANAHTAR, CANARY_PAROLA, canaryBul } from '@astra/ortak-test';
import { AyarHatasi, Gizli, anaMakineKisalt, ayarOku, hedefAnaMakineCoz, hedefOku } from './ayar.ts';
import { ORTAM_ADLARI } from './guvenlik/ortam-adlari.ts';

function ayarHatasi(f: () => unknown): AyarHatasi {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(AyarHatasi);
    return e as AyarHatasi;
  }
  throw new Error('AyarHatasi bekleniyordu');
}

describe('hedefAnaMakineCoz', () => {
  it.each([
    ['https://abcd1234.supabase.co', 'abcd1234.supabase.co'],
    ['https://abcd1234.supabase.co/', 'abcd1234.supabase.co'],
    ['  https://abcd1234.supabase.co  ', 'abcd1234.supabase.co'],
    ['https://ABCD1234.Supabase.CO', 'abcd1234.supabase.co'],
    ['https://ab.supabase.co', 'ab.supabase.co'],
    ['https://a-b-c.supabase.co', 'a-b-c.supabase.co'],
    ['https://abcd1234.supabase.co:443', 'abcd1234.supabase.co'],
  ])('%s kabul edilir -> %s', (url, beklenen) => {
    expect(hedefAnaMakineCoz(url)).toBe(beklenen);
  });

  const reddedilen: ReadonlyArray<[string, string]> = [
    ['http (şifrelemesiz)', 'http://abcd1234.supabase.co'],
    ['başka alan adı', 'https://evil.com'],
    ['yol içeren', 'https://abcd1234.supabase.co/rest/v1'],
    ['alt alan adı sahtekârlığı', 'https://abcd1234.supabase.co.evil.com'],
    ['önek sahtekârlığı', 'https://evil-supabase.co'],
    ['kullanıcı bilgisiyle kandırma', 'https://abcd1234.supabase.co@evil.com'],
    ['kullanıcı bilgisi', 'https://user@abcd1234.supabase.co'],
    ['kullanıcı ve parola', 'https://user:parola@abcd1234.supabase.co'],
    ['özel port', 'https://abcd1234.supabase.co:8443'],
    ['sorgu', 'https://abcd1234.supabase.co?x=1'],
    ['parça', 'https://abcd1234.supabase.co#kisim'],
    ['yolda alan adı', 'https://evil.com/.supabase.co'],
    ['kökte ref yok', 'https://supabase.co'],
    ['tek harfli ref', 'https://a.supabase.co'],
    ['tire ile başlayan ref', 'https://-abcd.supabase.co'],
    ['alt çizgili ref', 'https://abc_def.supabase.co'],
    ['iç içe alt alan', 'https://x.y.supabase.co'],
    ['supabase.in', 'https://abcd1234.supabase.in'],
    ['yerel ana makine', 'https://localhost'],
    ['IP adresi', 'https://127.0.0.1'],
    ['rastgele metin', 'zzz'],
    ['boş', ''],
    ['yalnız boşluk', '   '],
    ['şemasız', 'abcd1234.supabase.co'],
    ['file şeması', 'file:///etc/passwd'],
    ['javascript şeması', 'javascript:alert(1)'],
  ];
  it.each(reddedilen)('%s reddedilir', (_ad, url) => {
    const e = ayarHatasi(() => hedefAnaMakineCoz(url));
    expect(e.kod).toBe('URL_GECERSIZ');
    expect(e.degisken).toBe('ASTRA_SUPABASE_URL');
  });

  it('hata mesajı URL değerini (kullanıcı bilgisi dahil) içermez', () => {
    for (const url of [`https://${CANARY_ANAHTAR}@evil.com`, `https://user:${CANARY_PAROLA}@abcd1234.supabase.co`, `https://evil.com/${CANARY_ANAHTAR}`, CANARY_PAROLA]) {
      const e = ayarHatasi(() => hedefAnaMakineCoz(url));
      expect(canaryBul(e.message)).toEqual([]);
      expect(e.message).toBe('AYAR_HATASI URL_GECERSIZ degisken=ASTRA_SUPABASE_URL');
    }
  });
});

describe('anaMakineKisalt', () => {
  it('proje ref\'inin ilk 4 karakterini ... ile yazar', () => {
    expect(anaMakineKisalt('mwrbxyz123.supabase.co')).toBe('mwrb...');
    expect(anaMakineKisalt('ab12.supabase.co')).toBe('ab12...');
    expect(anaMakineKisalt('ab.supabase.co')).toBe('ab...');
  });
});

describe('hedefOku', () => {
  it('URL\'den ana makine ve kısaltma çıkarır', () => {
    expect(hedefOku({ ASTRA_SUPABASE_URL: 'https://abcd1234.supabase.co' })).toEqual({ anaMakine: 'abcd1234.supabase.co', kisa: 'abcd...' });
  });
  it('URL yoksa ya da boşsa ORTAM_EKSIK verir (yalnız değişken adıyla)', () => {
    for (const ortam of [{}, { ASTRA_SUPABASE_URL: '' }, { ASTRA_SUPABASE_URL: '   ' }, { ASTRA_SUPABASE_URL: undefined }]) {
      const e = ayarHatasi(() => hedefOku(ortam));
      expect([e.kod, e.degisken]).toEqual(['ORTAM_EKSIK', 'ASTRA_SUPABASE_URL']);
      expect(e.message).toBe('AYAR_HATASI ORTAM_EKSIK degisken=ASTRA_SUPABASE_URL');
    }
  });
  it('geçersiz URL URL_GECERSIZ verir', () => {
    expect(ayarHatasi(() => hedefOku({ ASTRA_SUPABASE_URL: 'https://evil.com' })).kod).toBe('URL_GECERSIZ');
  });
  it('yalnız URL\'yi okur: anon anahtar ve PIN olmasa da çalışır (kuru çalıştırma)', () => {
    expect(() => hedefOku({ ASTRA_SUPABASE_URL: 'https://abcd1234.supabase.co' })).not.toThrow();
  });
});

describe('ayarOku', () => {
  const temel = { ASTRA_SUPABASE_URL: 'https://abcd1234.supabase.co', ASTRA_SUPABASE_ANON: ` ${CANARY_ANAHTAR} ` };

  it('URL ve anon anahtarla ayar kurar; PIN ve servis anahtarı isteğe bağlıdır', () => {
    const a = ayarOku({}, temel);
    expect(a.anaMakine).toBe('abcd1234.supabase.co');
    expect(a.kisa).toBe('abcd...');
    expect(a.supabaseUrl.ac()).toBe('https://abcd1234.supabase.co');
    expect(a.anonAnahtar.ac()).toBe(CANARY_ANAHTAR); /* kenar boşlukları kırpılır */
    expect(a.pin).toBeNull();
    expect(a.servisAnahtari).toBeNull();
  });

  it('PIN ortamdan alınırsa Gizli içinde tutulur', () => {
    const a = ayarOku({}, { ...temel, ASTRA_PIN: '123456' });
    expect(a.pin).toBeInstanceOf(Gizli);
    expect(a.pin!.ac()).toBe('123456');
  });

  it('anon anahtar eksikse ORTAM_EKSIK verir', () => {
    const e = ayarHatasi(() => ayarOku({}, { ASTRA_SUPABASE_URL: 'https://abcd1234.supabase.co' }));
    expect([e.kod, e.degisken]).toEqual(['ORTAM_EKSIK', 'ASTRA_SUPABASE_ANON']);
  });

  it('servis anahtarı yalnız istenirse okunur ve o zaman zorunludur', () => {
    expect(ayarOku({}, { ...temel, ASTRA_SERVIS_ANAHTARI: CANARY_PAROLA }).servisAnahtari).toBeNull();
    const e = ayarHatasi(() => ayarOku({ servisAnahtari: true }, temel));
    expect([e.kod, e.degisken]).toEqual(['ORTAM_EKSIK', 'ASTRA_SERVIS_ANAHTARI']);
    expect(ayarOku({ servisAnahtari: true }, { ...temel, ASTRA_SERVIS_ANAHTARI: CANARY_PAROLA }).servisAnahtari!.ac()).toBe(CANARY_PAROLA);
  });

  it('ayar nesnesi serileştirilince/yazdırılınca hiçbir sır görünmez', () => {
    const a = ayarOku({ servisAnahtari: true }, { ...temel, ASTRA_PIN: '987654', ASTRA_SERVIS_ANAHTARI: CANARY_PAROLA });
    for (const metin of [JSON.stringify(a), inspect(a, { depth: 10, showHidden: true }), `${a.supabaseUrl} ${a.anonAnahtar} ${a.pin} ${a.servisAnahtari}`, String(Object.values(a))]) {
      expect(canaryBul(metin)).toEqual([]);
      expect(metin).not.toContain('987654');
      expect(metin).not.toContain('abcd1234.supabase.co/');
    }
    expect(JSON.stringify(a)).toContain('[gizli]');
  });

  it('hata mesajları sır içermez', () => {
    const e = ayarHatasi(() => ayarOku({}, { ASTRA_SUPABASE_URL: 'https://evil.com', ASTRA_SUPABASE_ANON: CANARY_ANAHTAR, ASTRA_PIN: '987654' }));
    expect(canaryBul(e.message)).toEqual([]);
    expect(e.message).not.toContain('987654');
  });
});

describe('Gizli', () => {
  const g = new Gizli(CANARY_PAROLA);

  it('ac() değeri verir', () => {
    expect(g.ac()).toBe(CANARY_PAROLA);
  });
  it('toString / toJSON / inspect / şablon / birleştirme [gizli] gösterir', () => {
    expect(g.toString()).toBe('[gizli]');
    expect(g.toJSON()).toBe('[gizli]');
    expect(`${g}`).toBe('[gizli]');
    expect(String(g)).toBe('[gizli]');
    expect('' + (g as unknown as string)).toBe('[gizli]');
    expect(JSON.stringify(g)).toBe('"[gizli]"');
    expect(JSON.stringify({ iç: { g }, dizi: [g] })).toBe('{"iç":{"g":"[gizli]"},"dizi":["[gizli]"]}');
    expect(inspect(g)).toBe('[gizli]');
    expect(inspect({ g, ic: [g] }, { depth: null })).toBe("{ g: [gizli], ic: [ [gizli] ] }");
    expect(inspect(g, { showHidden: true, depth: null })).toBe('[gizli]');
  });
  it('özel alan dışarıdan görünmez', () => {
    expect(Object.keys(g)).toEqual([]);
    expect(Reflect.ownKeys(g)).toEqual([]);
    expect(Object.getOwnPropertyNames(g)).toEqual([]);
    expect(canaryBul(JSON.stringify(Object.entries(g)))).toEqual([]);
    expect(canaryBul(JSON.stringify({ ...g }))).toEqual([]);
  });
  it('Symbol.toPrimitive [gizli] verir', () => {
    expect(`${g}`).toBe('[gizli]');
    expect(g[Symbol.toPrimitive]()).toBe('[gizli]');
  });
});

describe('ortam adları', () => {
  it('yalnız dört değişken adı tanımlıdır', () => {
    expect([...ORTAM_ADLARI]).toEqual(['ASTRA_SUPABASE_URL', 'ASTRA_SUPABASE_ANON', 'ASTRA_PIN', 'ASTRA_SERVIS_ANAHTARI']);
  });
});
