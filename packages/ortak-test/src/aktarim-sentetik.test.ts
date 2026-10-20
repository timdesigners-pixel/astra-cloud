import { describe, it, expect } from 'vitest';
import {
  CANARY_ABONE_NO, CANARY_AD, CANARY_DEGERLERI, CANARY_DOSYA_NO, CANARY_IBAN, CANARY_PAROLA,
  SAYI_METNI_VARYANTLARI, SENTETIK_ALINAN_BORC, SENTETIK_BUYUK_DEGER_BAYT, SENTETIK_GECERSIZ_IBAN,
  SENTETIK_MEZAR_TASLARI, buyukUygulamaDegeriUret, canaryBul, ibanBbandanKur, ibanBoslukluYaz,
  ibanMod97GecerliMi, ibanNormallestir, sentetikSUret, sentetikZarflariUret, testIbanlari, tohumdanUretec,
} from './index';

/** Nesne ağacındaki tüm TR ile başlayan IBAN benzeri dizeleri toplar. */
function ibanBenzerleriTopla(deger: unknown, bulunan: string[] = []): string[] {
  if (typeof deger === 'string') {
    if (/^TR\d{2}(\s?\d{4}){5}\s?\d{2}$/.test(deger.trim())) bulunan.push(deger);
  } else if (Array.isArray(deger)) {
    for (const x of deger) ibanBenzerleriTopla(x, bulunan);
  } else if (deger && typeof deger === 'object') {
    for (const x of Object.values(deger)) ibanBenzerleriTopla(x, bulunan);
  }
  return bulunan;
}

describe('ibanMod97GecerliMi', () => {
  it('üretilen test IBAN\'larını doğrular', () => {
    for (const iban of testIbanlari(1, 20)) expect(ibanMod97GecerliMi(iban)).toBe(true);
  });
  it('boşluklu ve küçük harfli girdiyi de kabul eder', () => {
    const iban = testIbanlari(2, 1)[0];
    expect(ibanMod97GecerliMi(ibanBoslukluYaz(iban).toLowerCase())).toBe(true);
  });
  it('tek haneli değişikliği reddeder', () => {
    expect(ibanMod97GecerliMi(SENTETIK_GECERSIZ_IBAN)).toBe(false);
  });
  it('biçimi bozuk girdiyi reddeder', () => {
    expect(ibanMod97GecerliMi('')).toBe(false);
    expect(ibanMod97GecerliMi('TR12')).toBe(false);
    expect(ibanMod97GecerliMi('DE89370400440532013000')).toBe(false);
  });
});

describe('testIbanlari', () => {
  it('banka kodu 09999 ve 26 karakter, birbirinden farklı', () => {
    const liste = testIbanlari(7, 10);
    expect(new Set(liste).size).toBe(10);
    for (const iban of liste) {
      expect(iban).toHaveLength(26);
      expect(iban.slice(4, 9)).toBe('09999');
      expect(iban[9]).toBe('0');
    }
  });
  it('aynı tohum aynı sonucu verir, farklı tohum farklı', () => {
    expect(testIbanlari(5, 3)).toEqual(testIbanlari(5, 3));
    expect(testIbanlari(5, 3)).not.toEqual(testIbanlari(6, 3));
  });
});

describe('ibanBbandanKur', () => {
  it('22 hane dışını reddeder', () => {
    expect(() => ibanBbandanKur('123')).toThrow();
  });
});

describe('tohumdanUretec', () => {
  it('deterministik ve [0,1) aralığında', () => {
    const a = tohumdanUretec(42);
    const b = tohumdanUretec(42);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('sentetikSUret', () => {
  it('aynı tohum bire bir aynı çıktıyı verir', () => {
    expect(JSON.stringify(sentetikSUret({ tohum: 11 }))).toBe(JSON.stringify(sentetikSUret({ tohum: 11 })));
  });
  it('farklı tohum farklı çıktı verir', () => {
    expect(JSON.stringify(sentetikSUret({ tohum: 11 }))).not.toBe(JSON.stringify(sentetikSUret({ tohum: 12 })));
  });
  it('kök şema ve koleksiyon anahtarlarını içerir', () => {
    const s = sentetikSUret();
    expect(Object.keys(s)).toEqual(expect.arrayContaining(['koleksiyon', 'ayar', 'silinen', 'statements', 'ledger', 'dayLog', 'diger']));
    for (const k of ['debts', 'expenses', 'incomes', 'purchases', 'deposits', 'investments', 'ibans', 'people', 'icra', 'cases', 'petitions', 'legal', 'fixdates', 'todos', 'limitler']) {
      expect(s.koleksiyon[k as keyof typeof s.koleksiyon].length).toBeGreaterThan(0);
    }
    expect(Object.keys(s.koleksiyon)).toHaveLength(29);
    expect(typeof s.diger.apps).toBe('object');
  });
  it('kimlikler koleksiyon içinde benzersizdir', () => {
    const s = sentetikSUret();
    for (const liste of [s.koleksiyon.debts, s.koleksiyon.expenses, s.koleksiyon.incomes, s.koleksiyon.people]) {
      const idler = liste.map((k) => k.id);
      expect(new Set(idler).size).toBe(idler.length);
    }
  });

  describe('IBAN\'lar', () => {
    it('geçerli sayısı > 0 ve yalnız bilinen tek geçersiz IBAN vardır', () => {
      const tum = ibanBenzerleriTopla(sentetikSUret());
      const gecerli = tum.filter((i) => ibanMod97GecerliMi(i));
      const gecersiz = tum.filter((i) => !ibanMod97GecerliMi(i));
      expect(gecerli.length).toBeGreaterThanOrEqual(8);
      expect(gecersiz.length).toBeGreaterThanOrEqual(1);
      expect(new Set(gecersiz.map(ibanNormallestir))).toEqual(new Set([SENTETIK_GECERSIZ_IBAN]));
    });
    it('tüm IBAN\'lar test banka kodunu taşır (gerçek banka değil)', () => {
      for (const iban of ibanBenzerleriTopla(sentetikSUret())) expect(ibanNormallestir(iban).slice(4, 9)).toBe('09999');
    });
    it('hem boşluklu hem bitişik biçim vardır; tekrar eden IBAN mevcuttur', () => {
      const s = sentetikSUret();
      const tum = ibanBenzerleriTopla(s);
      expect(tum.some((i) => i.includes(' '))).toBe(true);
      expect(tum.some((i) => !i.includes(' '))).toBe(true);
      const norm = tum.map(ibanNormallestir);
      expect(new Set(norm).size).toBeLessThan(norm.length);
    });
  });

  describe('sözleşme alanları', () => {
    it('alınan borç çifti: gelir tur=borc <-> borç gelirId', () => {
      const s = sentetikSUret();
      const gelir = s.koleksiyon.incomes.find((g) => g.id === SENTETIK_ALINAN_BORC.gelirId);
      const borc = s.koleksiyon.debts.find((b) => b.id === SENTETIK_ALINAN_BORC.borcId);
      expect(gelir?.tur).toBe('borc');
      expect(gelir?.borcId).toBe(borc?.id);
      expect(borc?.gelirId).toBe(gelir?.id);
      expect(borc?.pid).toBe(gelir?.pid);
    });
    it('bahis geliri negatif net sonuçtur', () => {
      const bahis = sentetikSUret().koleksiyon.incomes.find((g) => g.src === 'bahis');
      expect(Number(bahis?.monthly)).toBeLessThan(0);
    });
    it('TRY dışı para birimli kayıtlar vardır', () => {
      const s = sentetikSUret();
      expect(s.koleksiyon.debts.some((b) => b.cur === 'USD')).toBe(true);
      expect(s.koleksiyon.debts.some((b) => b.cur === 'EUR')).toBe(true);
      expect(s.koleksiyon.incomes.some((g) => g.cur !== 'TRY')).toBe(true);
      expect(s.koleksiyon.expenses.some((g) => g.cur !== 'TRY')).toBe(true);
    });
    it('her tr-TR sayı metni varyantı bir borç tutarı olarak yer alır', () => {
      const tutarlar = sentetikSUret().koleksiyon.debts.map((b) => b.amount);
      for (const v of SAYI_METNI_VARYANTLARI) expect(tutarlar).toContain(v.metin);
    });
    it('sayı varyantı beklenenleri tutarlı', () => {
      const beklenen = Object.fromEntries(SAYI_METNI_VARYANTLARI.map((v) => [v.metin, v.beklenen]));
      expect(beklenen['1,234']).toBe(1.234);
      expect(beklenen['1,234,567']).toBe(1234567);
      expect(beklenen['1.234,50']).toBe(1234.5);
      expect(beklenen['abc']).toBeNull();
      expect(beklenen['']).toBeNull();
    });
    it('mezar taşı kayıtları hem silinen\'de hem koleksiyonda durur', () => {
      const s = sentetikSUret();
      for (const [liste, idler] of Object.entries(SENTETIK_MEZAR_TASLARI)) {
        for (const id of idler) {
          expect(s.silinen[liste][id]).toBeTypeOf('number');
          const koleksiyon = s.koleksiyon[liste as 'debts' | 'expenses' | 'people'] as { id: string }[];
          expect(koleksiyon.some((k) => k.id === id)).toBe(true);
        }
      }
    });
    it('icra: ödeme planı ve haciz türleri/durumları', () => {
      const icra = sentetikSUret().koleksiyon.icra;
      expect(icra[0].odemePlani.odemeler.length).toBeGreaterThan(0);
      const turler = new Set(icra.flatMap((i) => i.hacizler.map((h) => h.tur)));
      expect(turler).toEqual(new Set(['banka', 'maas', 'arac', 'tasinmaz', 'diger']));
      const durumlar = new Set(icra.flatMap((i) => i.hacizler.map((h) => h.durum)));
      expect(durumlar).toEqual(new Set(['aktif', 'kaldirildi']));
    });
    it('uydurma dosya numaraları 2099 yılıyla başlar', () => {
      const s = sentetikSUret();
      for (const i of s.koleksiyon.icra) expect(i.no).toMatch(/^2099\//);
      for (const d of s.koleksiyon.cases) expect(d.es).toMatch(/^2099\//);
    });
    it('uzun ad, boş ad ve geçersiz tarih örnekleri vardır', () => {
      const borclar = sentetikSUret().koleksiyon.debts;
      expect(borclar.some((b) => b.name.length > 160)).toBe(true);
      expect(borclar.some((b) => b.name === '')).toBe(true);
      expect(borclar.some((b) => b.vade === '31/13/2026')).toBe(true);
    });
  });

  describe('uygulama durumları (S.diger.apps)', () => {
    it('her değer JSON string\'dir; anahtarlar 200 karakteri aşmaz (varsayılan)', () => {
      const apps = sentetikSUret().diger.apps;
      for (const [anahtar, deger] of Object.entries(apps)) {
        expect(anahtar.length).toBeLessThanOrEqual(200);
        expect(typeof deger).toBe('string');
      }
      const json = Object.entries(apps).filter(([, d]) => d.startsWith('{') || d.startsWith('['));
      for (const [, d] of json) expect(() => JSON.parse(d)).not.toThrow();
    });
    it('varsayılan çıktı şişirilmez (8 MB değer yok)', () => {
      const apps = sentetikSUret().diger.apps;
      for (const d of Object.values(apps)) expect(d.length).toBeLessThan(SENTETIK_BUYUK_DEGER_BAYT);
      expect(JSON.stringify(sentetikSUret()).length).toBeLessThan(200_000);
    });
    it('buyukDeger bayrağı 8 MB üstü değer ekler', () => {
      const apps = sentetikSUret({ buyukDeger: true }).diger.apps;
      const en = Math.max(...Object.values(apps).map((d) => d.length));
      expect(en).toBeGreaterThan(8 * 1024 * 1024);
    });
    it('uzunAnahtar bayrağı 200 karakterden uzun anahtar ekler', () => {
      const anahtarlar = Object.keys(sentetikSUret({ uzunAnahtar: true }).diger.apps);
      expect(anahtarlar.some((a) => a.length > 200)).toBe(true);
    });
  });
});

describe('buyukUygulamaDegeriUret', () => {
  it('tam uzunlukta geçerli JSON string döner', () => {
    const d = buyukUygulamaDegeriUret(1000);
    expect(d).toHaveLength(1000);
    expect(JSON.parse(d)).toHaveLength(998);
  });
  it('varsayılan 8 MB sınırını aşar', () => {
    expect(buyukUygulamaDegeriUret().length).toBeGreaterThan(8 * 1024 * 1024);
  });
  it('2\'den kısa uzunluğu reddeder', () => {
    expect(() => buyukUygulamaDegeriUret(1)).toThrow();
  });
});

describe('canary değerleri', () => {
  it('CANARY_IBAN mod-97 geçerli ve test banka kodlu', () => {
    expect(ibanMod97GecerliMi(CANARY_IBAN)).toBe(true);
    expect(CANARY_IBAN.slice(4, 9)).toBe('09999');
  });
  it('tüm canary değerleri üretilen S içinde gömülüdür', () => {
    const metin = JSON.stringify(sentetikSUret());
    for (const c of [CANARY_AD, CANARY_DOSYA_NO, CANARY_PAROLA, CANARY_ABONE_NO, CANARY_IBAN]) {
      expect(metin).toContain(c);
    }
  });
  it('canaryBul sızıntıyı bulur; temiz metinde boş döner', () => {
    expect(canaryBul('hata: ' + ibanBoslukluYaz(CANARY_IBAN))).toContain(CANARY_IBAN);
    expect(canaryBul(`Hesap ${CANARY_PAROLA.toUpperCase()}`)).toContain(CANARY_PAROLA);
    expect(canaryBul('borclar: 12, hata kodu: 23505')).toEqual([]);
  });
  it('canary kümesi tekrarsızdır ve boş değer içermez', () => {
    expect(new Set(CANARY_DEGERLERI).size).toBe(CANARY_DEGERLERI.length);
    for (const c of CANARY_DEGERLERI) expect(c.length).toBeGreaterThan(5);
  });
});

describe('sentetikZarflariUret', () => {
  const s = sentetikSUret();
  const z = sentetikZarflariUret(s);

  it('yedek ve kasaDuzDurum aynı S\'yi taşır', () => {
    expect(JSON.parse(JSON.stringify(z.yedek))).toEqual(JSON.parse(JSON.stringify(s)));
    expect(JSON.parse(JSON.stringify(z.kasaDuzDurum)).durum).toEqual(JSON.parse(JSON.stringify(s)));
  });
  it('düz zarf v:0 ve m alanı parse edilince S verir', () => {
    expect(z.duzZarf.v).toBe(0);
    expect(JSON.parse(z.duzZarf.m)).toEqual(JSON.parse(JSON.stringify(s)));
  });
  it('şifreli zarflar {v,i,d} biçimindedir ve m/koleksiyon içermez', () => {
    for (const zarf of [z.sifreliZarfV1, z.sifreliZarfV2]) {
      expect(Object.keys(zarf).sort()).toEqual(['d', 'i', 'v']);
      expect(zarf.i).toMatch(/^[A-Za-z0-9+/]+$/);
      expect(zarf.d.length).toBeGreaterThan(50);
    }
    expect(z.sifreliZarfV1.v).toBe(1);
    expect(z.sifreliZarfV2.v).toBe(2);
    expect(canaryBul(JSON.stringify([z.sifreliZarfV1, z.sifreliZarfV2]))).toEqual([]);
  });
  it('bozuk metin parse edilemez', () => {
    expect(() => JSON.parse(z.bozukMetin)).toThrow();
  });
  it('boş S koleksiyonları boştur ama biçimi geçerlidir', () => {
    expect(Object.keys(z.bosS.koleksiyon)).toHaveLength(29);
    expect(Object.values(z.bosS.koleksiyon).every((l) => l.length === 0)).toBe(true);
    expect(z.bosS.diger.apps).toEqual({});
  });
  it('deterministiktir', () => {
    expect(JSON.stringify(sentetikZarflariUret(sentetikSUret(), 3))).toBe(JSON.stringify(sentetikZarflariUret(sentetikSUret(), 3)));
  });
});
