import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  STATIK_AZAMI_BAYT, STATIK_ONAY_DESENI, STATIK_UYGULAMALAR, statikOnayDogrula, statikPlanOlustur, statikYoluGecerliMi,
  type StatikDosya, type StatikPlanGirdisi,
} from './statik-plan-hesap.ts';

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const ANA = 'abcd1234.supabase.co';

function dosya(yol: string, icerik = yol, secenek: Partial<StatikDosya> = {}): StatikDosya {
  const uygulama = STATIK_UYGULAMALAR.find((u) => yol.startsWith(`${u}/`)) ?? STATIK_UYGULAMALAR[0];
  return { yol, uygulama, boyut: icerik.length, sha256: sha(icerik), json_gecerli: true, ...secenek };
}

function tamListe(): StatikDosya[] {
  const l: StatikDosya[] = [];
  for (const u of STATIK_UYGULAMALAR) for (const y of ['hero.json', 'kucuk.json', 'detay/01.json', 'detay/02.json']) l.push(dosya(`${u}/${y}`, `icerik ${u}/${y}`));
  return l;
}

function girdi(dosyalar: readonly StatikDosya[], ek: Partial<StatikPlanGirdisi> = {}): StatikPlanGirdisi {
  return { dosyalar, anaMakine: ANA, aracSurumu: '15.0.0', ...ek };
}

describe('statikYoluGecerliMi', () => {
  const gecerli = [
    'oynatma-listelerim/hero.json', 'oynatma-listelerim/kucuk.json', 'oynatma-listelerim/detay/00.json', 'oynatma-listelerim/detay/99.json',
    'pinterest-panolarim/hero.json', 'pinterest-panolarim/kucuk.json', 'pinterest-panolarim/detay/07.json',
  ];
  it.each(gecerli)('beyaz listedeki %s geçerlidir', (yol) => {
    expect(statikYoluGecerliMi(yol)).toBe(true);
  });

  const gecersiz: ReadonlyArray<[string, unknown]> = [
    ['üst dizine kaçış', '../hero.json'],
    ['ortada ..', 'oynatma-listelerim/../pinterest-panolarim/hero.json'],
    ['sonda ..', 'oynatma-listelerim/detay/01.json/..'],
    ['nokta parçası', 'oynatma-listelerim/./hero.json'],
    ['mutlak yol', '/oynatma-listelerim/hero.json'],
    ['mutlak sistem yolu', '/etc/passwd'],
    ['ters bölü', 'oynatma-listelerim\\hero.json'],
    ['ters bölü kaçışı', 'oynatma-listelerim\\..\\hero.json'],
    ['NUL baytı', 'oynatma-listelerim/hero.json\0'],
    ['NUL ortada', 'oynatma\0-listelerim/hero.json'],
    ['Windows sürücüsü', 'C:/oynatma-listelerim/hero.json'],
    ['Windows sürücüsü bitişik', 'C:hero.json'],
    ['index.html', 'oynatma-listelerim/index.html'],
    ['kök index.html', 'index.html'],
    ['dosyalar altında json', 'oynatma-listelerim/dosyalar/x.json'],
    ['dosyalar kovası', 'dosyalar/x.json'],
    ['bilinmeyen uygulama', 'baska-uygulama/hero.json'],
    ['uygulama öneki uzatılmış', 'oynatma-listelerim-x/hero.json'],
    ['büyük harf', 'OYNATMA-LISTELERIM/hero.json'],
    ['tek haneli detay', 'oynatma-listelerim/detay/1.json'],
    ['üç haneli detay', 'oynatma-listelerim/detay/001.json'],
    ['harfli detay', 'oynatma-listelerim/detay/ab.json'],
    ['detay alt klasörü', 'oynatma-listelerim/detay/01/02.json'],
    ['çift bölü', 'oynatma-listelerim//hero.json'],
    ['sonda bölü', 'oynatma-listelerim/hero.json/'],
    ['sonda satır sonu', 'oynatma-listelerim/hero.json\n'],
    ['yüzde kodlu kaçış', 'oynatma-listelerim/%2e%2e/hero.json'],
    ['başka uzantı', 'oynatma-listelerim/hero.json.bak'],
    ['boş metin', ''],
    ['yalnız uygulama', 'oynatma-listelerim'],
    ['200 karakterden uzun', `oynatma-listelerim/detay/${'0'.repeat(200)}.json`],
    ['null', null],
    ['sayı', 5],
    ['nesne', { toString: () => 'oynatma-listelerim/hero.json' }],
  ];
  it.each(gecersiz)('%s reddedilir', (_ad, yol) => {
    expect(statikYoluGecerliMi(yol)).toBe(false);
  });
});

describe('statikPlanOlustur', () => {
  it('geçerli taramadan sıralı plan, uygulama özetleri ve onay kodu üretir', () => {
    const liste = tamListe();
    const plan = statikPlanOlustur(girdi(liste));
    expect(plan.kova).toBe('apps');
    expect(plan.sorunlar).toEqual([]);
    expect(plan.onay_kodu).toMatch(STATIK_ONAY_DESENI);
    expect(plan.toplam_dosya).toBe(8);
    expect(plan.dosyalar.map((d) => d.yol)).toEqual([...liste.map((d) => d.yol)].sort());
    expect(plan.toplam_bayt).toBe(liste.reduce((t, d) => t + d.boyut, 0));
    expect(plan.en_buyuk).toBe(Math.max(...liste.map((d) => d.boyut)));
    expect(plan.uygulamalar.map((u) => [u.uygulama, u.dosya, u.detay])).toEqual([['oynatma-listelerim', 4, 2], ['pinterest-panolarim', 4, 2]]);
    expect(plan.ozet_sha256).toMatch(/^[0-9a-f]{12}$/);
  });

  it('kod deterministiktir: girdi sırası kodu değiştirmez', () => {
    const liste = tamListe();
    const a = statikPlanOlustur(girdi(liste));
    const b = statikPlanOlustur(girdi([...liste].reverse()));
    expect(b.onay_kodu).toBe(a.onay_kodu);
    expect(b.ozet_sha256).toBe(a.ozet_sha256);
    expect(b.dosyalar).toEqual(a.dosyalar);
  });

  it('hedef ana makine değişince kod değişir (özet aynı kalır)', () => {
    const liste = tamListe();
    const a = statikPlanOlustur(girdi(liste));
    const b = statikPlanOlustur(girdi(liste, { anaMakine: 'zzzz9999.supabase.co' }));
    expect(b.onay_kodu).not.toBe(a.onay_kodu);
    expect(b.ozet_sha256).toBe(a.ozet_sha256);
  });

  it('araç sürümü değişince kod değişir', () => {
    const liste = tamListe();
    expect(statikPlanOlustur(girdi(liste, { aracSurumu: '15.0.1' })).onay_kodu).not.toBe(statikPlanOlustur(girdi(liste)).onay_kodu);
  });

  it('bir dosyanın içeriği (sha256) değişince kod ve özet değişir', () => {
    const liste = tamListe();
    const degisik = liste.map((d, i) => (i === 3 ? { ...d, sha256: sha('baska icerik') } : d));
    const a = statikPlanOlustur(girdi(liste));
    const b = statikPlanOlustur(girdi(degisik));
    expect(b.onay_kodu).not.toBe(a.onay_kodu);
    expect(b.ozet_sha256).not.toBe(a.ozet_sha256);
  });

  it('dosya eklenince ya da çıkarılınca kod değişir', () => {
    const liste = tamListe();
    const a = statikPlanOlustur(girdi(liste));
    expect(statikPlanOlustur(girdi(liste.slice(1))).onay_kodu).not.toBe(a.onay_kodu);
    expect(statikPlanOlustur(girdi([...liste, dosya('pinterest-panolarim/detay/03.json')])).onay_kodu).not.toBe(a.onay_kodu);
  });

  it('kaçış içeren yol plana alınmaz, YOL_BEYAZ_LISTE_DISI sayılır ve kod verilmez', () => {
    const kotu = [dosya('oynatma-listelerim/../x.json'), dosya('oynatma-listelerim/index.html'), dosya('oynatma-listelerim/dosyalar/x.json')];
    const plan = statikPlanOlustur(girdi([...tamListe(), ...kotu]));
    expect(plan.dosyalar).toHaveLength(8);
    expect(plan.sorunlar).toEqual([{ kod: 'YOL_BEYAZ_LISTE_DISI', sayi: 3 }]);
    expect(plan.onay_kodu).toBeNull();
  });

  it('dosyanın uygulaması yolun önekiyle uyuşmazsa reddedilir', () => {
    const plan = statikPlanOlustur(girdi([{ ...dosya('oynatma-listelerim/hero.json'), uygulama: 'pinterest-panolarim' }]));
    expect(plan.sorunlar).toEqual([{ kod: 'YOL_BEYAZ_LISTE_DISI', sayi: 1 }]);
    expect(plan.toplam_dosya).toBe(0);
  });

  it('yinelenen yol YOL_TEKRAR olur ve ikincisi alınmaz', () => {
    const plan = statikPlanOlustur(girdi([...tamListe(), dosya('oynatma-listelerim/hero.json', 'baska')]));
    expect(plan.sorunlar).toEqual([{ kod: 'YOL_TEKRAR', sayi: 1 }]);
    expect(plan.toplam_dosya).toBe(8);
    expect(plan.onay_kodu).toBeNull();
  });

  it('geçersiz JSON, boş dosya, aşırı büyük dosya ve bozuk sha256 sorun sayılır', () => {
    const l = tamListe();
    const sorunlu = [
      { ...l[0]!, json_gecerli: false },
      { ...l[1]!, boyut: 0 },
      { ...l[2]!, boyut: STATIK_AZAMI_BAYT + 1, sha256: '' },
      { ...l[3]!, sha256: 'xyz' },
    ];
    const plan = statikPlanOlustur(girdi([...sorunlu, ...l.slice(4)]));
    expect(plan.sorunlar).toEqual([
      { kod: 'BOYUT_SINIRI_ASILDI', sayi: 1 },
      { kod: 'DOSYA_BOS', sayi: 1 },
      { kod: 'JSON_GECERSIZ', sayi: 1 },
      { kod: 'SHA256_BICIMI', sayi: 1 },
    ]);
    expect(plan.onay_kodu).toBeNull();
  });

  it('50 MB tam sınırdaki dosya kabul edilir', () => {
    const l = tamListe();
    const plan = statikPlanOlustur(girdi([{ ...l[0]!, boyut: STATIK_AZAMI_BAYT }, ...l.slice(1)]));
    expect(plan.sorunlar).toEqual([]);
  });

  it('tarama sorunları plana geçer ve kodu engeller', () => {
    const plan = statikPlanOlustur(girdi(tamListe(), { taramaSorunlari: ['UYGULAMA_YOK', 'DOSYA_YOK', 'DOSYA_YOK'] }));
    expect(plan.sorunlar).toEqual([{ kod: 'DOSYA_YOK', sayi: 2 }, { kod: 'UYGULAMA_YOK', sayi: 1 }]);
    expect(plan.onay_kodu).toBeNull();
  });

  it('dosya yoksa (sorunsuz da olsa) onay kodu verilmez', () => {
    const plan = statikPlanOlustur(girdi([]));
    expect(plan.toplam_dosya).toBe(0);
    expect(plan.sorunlar).toEqual([]);
    expect(plan.onay_kodu).toBeNull();
  });
});

describe('statikOnayDogrula', () => {
  const plan = statikPlanOlustur(girdi(tamListe()));
  it('doğru kodu kabul eder', () => {
    expect(statikOnayDogrula(plan, plan.onay_kodu)).toBe(true);
  });
  it.each([[''], [undefined], [null], [5], [{}], ['ONAY-statik-000000000000'], ['onay-statik-abc'], ['ONAY-a-0123456789ab'], [' ONAY-statik-0123456789ab']])('yanlış/biçimsiz kod %j reddedilir', (kod) => {
    expect(statikOnayDogrula(plan, kod)).toBe(false);
  });
  it('kodun son hanesi değişirse reddedilir', () => {
    const kod = plan.onay_kodu!;
    const son = kod.endsWith('0') ? '1' : '0';
    expect(statikOnayDogrula(plan, kod.slice(0, -1) + son)).toBe(false);
  });
  it('sorunlu plan (kod null) hiçbir girdiyi kabul etmez', () => {
    const sorunlu = statikPlanOlustur(girdi(tamListe(), { taramaSorunlari: ['DETAY_YOK'] }));
    expect(statikOnayDogrula(sorunlu, plan.onay_kodu)).toBe(false);
    expect(statikOnayDogrula(sorunlu, null)).toBe(false);
  });
  it('başka planın kodunu reddeder', () => {
    const baska = statikPlanOlustur(girdi(tamListe(), { anaMakine: 'zzzz9999.supabase.co' }));
    expect(statikOnayDogrula(plan, baska.onay_kodu)).toBe(false);
  });
});
