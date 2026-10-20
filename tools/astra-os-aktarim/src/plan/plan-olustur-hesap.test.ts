import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { CANARY_ANAHTAR, CANARY_IBAN, CANARY_PAROLA, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { ARAC_SURUMU } from '../surum.ts';
import { ILGI_BEKLENEN_KURUS, ilgiUrunleri, semaKur, sentetikPlanKur, TEST_ANA_MAKINE } from '../test-destek.ts';
import { Plan } from './plan.ts';
import { ONAY_KODU_DESENI, onayDogrula } from './onay-kodu-hesap.ts';
import { hedefRefKur, planOlustur } from './plan-olustur-hesap.ts';
import { PlanHatasi } from './plan-tipleri.ts';

function kod(secenek: Parameters<typeof sentetikPlanKur>[0] = {}): string {
  return sentetikPlanKur(secenek).plan.onay_kodu;
}

describe('planOlustur: içerik', () => {
  it('dalga a: uygulama durumları ve beğeniler için kayıt, atlanan ve sayaç üretir', () => {
    const { plan } = sentetikPlanKur();
    const kayitlar = plan.kayitlar();
    expect(kayitlar.filter((k) => k.tablo === 'uygulama_durumu')).toHaveLength(16);
    expect(kayitlar.filter((k) => k.tablo === 'begeniler')).toHaveLength(6);
    expect(plan.dalga).toBe('a');
    expect(plan.ozet.hedef_tablolar).toEqual([
      { tablo: 'begeniler', yeni: 6, atlanan: 2 },
      { tablo: 'uygulama_durumu', yeni: 16, atlanan: 0 },
    ]);
    expect(plan.ozet.atlanan).toEqual([
      { koleksiyon: 'ilgi_urunleri', neden_kodu: 'AD_BOS', sayi: 1 },
      { koleksiyon: 'ilgi_urunleri', neden_kodu: 'KOD_TEKRAR', sayi: 1 },
    ]);
    expect(plan.ozet.uyarilar).toEqual([{ koleksiyon: 'ilgi_urunleri', neden_kodu: 'GECERSIZ_TUTAR', sayi: 1 }]);
    expect(plan.atlananSayisi()).toBe(2);
    expect(plan.uyariSayisi()).toBe(1);
    expect(plan.ozet.girdi_ozeti.silinen_mezar_sayisi).toBe(3);
    expect(plan.ozet.bilgi_kodlari).toEqual([]);
  });

  it('kontrol toplamı Σ yuvarlanmış kuruştur (1.005 → 101, 0.125 → 13)', () => {
    expect(sentetikPlanKur().plan.ozet.kontrol_toplamlari).toEqual([{ ad: 'begeniler_fiyat', kurus_toplami: ILGI_BEKLENEN_KURUS }]);
  });

  it('ilgi kaynağı yoksa ILGI_KAYNAK_YOK bilgisi verilir ve yalnız uygulama durumları planlanır', () => {
    const { plan } = sentetikPlanKur({ ilgi: undefined });
    expect(plan.ozet.bilgi_kodlari).toEqual(['ILGI_KAYNAK_YOK']);
    expect(plan.kayitlar().every((k) => k.tablo === 'uygulama_durumu')).toBe(true);
    expect(plan.ozet.kontrol_toplamlari).toEqual([{ ad: 'begeniler_fiyat', kurus_toplami: 0 }]);
  });

  it('dalga b ve c için dönüştürücü yoktur: boş plan + DALGA_DONUSTURUCU_YOK, kontrol toplamı yok', () => {
    for (const dalga of ['b', 'c'] as const) {
      const { plan } = sentetikPlanKur({ dalga });
      expect(plan.kayitlar()).toEqual([]);
      expect(plan.ozet.bilgi_kodlari).toEqual(['DALGA_DONUSTURUCU_YOK']);
      expect(plan.ozet.kontrol_toplamlari).toEqual([]);
      expect(plan.onay_kodu).toMatch(new RegExp(`^ONAY-${dalga}-[0-9a-f]{12}$`));
    }
  });

  it('plan özeti dondurulmuştur ve araç sürümü / hedef özeti taşır', () => {
    const { plan } = sentetikPlanKur();
    expect(Object.isFrozen(plan.ozet)).toBe(true);
    expect(plan.ozet.arac_surumu).toBe('15.0.0');
    expect(plan.ozet.hedef_ref).toBe(hedefRefKur(TEST_ANA_MAKINE));
    expect(plan.ozet.hedef_ref).toMatch(/^[0-9a-f]{8}$/);
  });

  it('gerçek araç sürümüyle de plan kurulur', () => {
    expect(sentetikPlanKur({ surum: ARAC_SURUMU }).plan.ozet.arac_surumu).toBe(ARAC_SURUMU);
  });
});

describe('planOlustur: deterministik onay kodu', () => {
  it('aynı girdi aynı kodu verir (ayrı üretimlerde)', () => {
    const a = kod();
    expect(a).toMatch(ONAY_KODU_DESENI);
    expect(kod()).toBe(a);
    expect(kod({ s: sentetikSUret() })).toBe(a);
  });

  it('S içindeki nesne anahtar sırası kodu değiştirmez', () => {
    const s = sentetikSUret();
    const ters = { ...s, diger: { ...s.diger, apps: Object.fromEntries(Object.entries(s.diger.apps).reverse()) } };
    expect(kod({ s: ters })).toBe(kod({ s }));
  });

  it('tek bir uygulama değeri değişince kod değişir', () => {
    const s = sentetikSUret();
    const d = sentetikSUret();
    d.diger.apps['tr-fav'] = JSON.stringify(['kisi-02']);
    expect(kod({ s: d })).not.toBe(kod({ s }));
  });

  it('tek bir ürün alanı değişince kod değişir', () => {
    const ilgi = ilgiUrunleri();
    (ilgi[3] as Record<string, unknown>).price = 250.01;
    expect(kod({ ilgi })).not.toBe(kod());
    const ilgi2 = ilgiUrunleri();
    (ilgi2[0] as Record<string, unknown>).favorite = false;
    expect(kod({ ilgi: ilgi2 })).not.toBe(kod());
  });

  it('atlanan kayıt değişince de kod değişir (atlananlar onay özetine girer)', () => {
    const ilgi = [...ilgiUrunleri(), { id: 'urun-099', name: '' }];
    expect(kod({ ilgi })).not.toBe(kod());
  });

  it('ilgi listesi eklenince/çıkarılınca kod değişir', () => {
    expect(kod({ ilgi: undefined })).not.toBe(kod());
  });

  it('dalga farkı kodu değiştirir (hex kısmı da farklıdır)', () => {
    const a = kod({ dalga: 'a' });
    const b = kod({ dalga: 'b' });
    const c = kod({ dalga: 'c' });
    expect(new Set([a.slice(-12), b.slice(-12), c.slice(-12)]).size).toBe(3);
    expect(a.startsWith('ONAY-a-')).toBe(true);
    expect(b.startsWith('ONAY-b-')).toBe(true);
  });

  it('hedef proje farkı kodu değiştirir; ana makine büyük/küçük harf ve boşluktan etkilenmez', () => {
    const temel = kod();
    expect(kod({ host: 'zzzz9999.supabase.co' })).not.toBe(temel);
    expect(kod({ host: `  ${TEST_ANA_MAKINE.toUpperCase()} ` })).toBe(temel);
  });

  it('araç sürümü farkı kodu değiştirir', () => {
    expect(kod({ surum: '15.0.1' })).not.toBe(kod({ surum: '15.0.0' }));
    expect(kod({ surum: '16.0.0' })).not.toBe(kod({ surum: '15.0.0' }));
  });

  it('girdi ile aynı veri farklı yoldan (durum zarfı) gelse de kod aynıdır', () => {
    const s = sentetikSUret();
    const plan = planOlustur({ dalga: 'a', sema: semaKur(s), ilgiHam: ilgiUrunleri(), hedefAnaMakine: TEST_ANA_MAKINE, aracSurumu: '15.0.0' });
    expect(plan.onay_kodu).toBe(kod({ s }));
  });
});

describe('planOlustur: geçersiz parametreler', () => {
  function planHatasi(f: () => unknown): PlanHatasi {
    try {
      f();
    } catch (e) {
      expect(e).toBeInstanceOf(PlanHatasi);
      return e as PlanHatasi;
    }
    throw new Error('hata bekleniyordu');
  }
  const temel = { dalga: 'a' as const, sema: semaKur(), hedefAnaMakine: TEST_ANA_MAKINE, aracSurumu: '15.0.0' };

  it('geçersiz dalga DALGA_GECERSIZ verir', () => {
    for (const d of ['z', '', 'A', undefined, null, 1]) expect(planHatasi(() => planOlustur({ ...temel, dalga: d as never })).kod).toBe('DALGA_GECERSIZ');
  });
  it('geçersiz araç sürümü SURUM_GECERSIZ verir', () => {
    for (const v of ['1.0', 'v1.0.0', '1.0.0-beta', '', undefined, 15]) expect(planHatasi(() => planOlustur({ ...temel, aracSurumu: v as never })).kod).toBe('SURUM_GECERSIZ');
  });
  it('boş hedef ana makine HEDEF_BOS verir', () => {
    for (const h of ['', '   ']) expect(planHatasi(() => planOlustur({ ...temel, hedefAnaMakine: h })).kod).toBe('HEDEF_BOS');
  });
  it('dizi olmayan ilgi SEMA_GECERSIZ fırlatır', () => {
    expect(() => planOlustur({ ...temel, ilgiHam: { a: 1 } })).toThrowError(/SEMA_GECERSIZ yol=ilgi/);
  });
});

describe('Plan: değer sızdırmaz', () => {
  const { plan } = sentetikPlanKur();

  it('sanity: kayıtlar (yazıcı için) canary değerleri bellekte tutar', () => {
    const tum = JSON.stringify(plan.kayitlar());
    expect(canaryBul(tum).length).toBeGreaterThan(0);
    expect(tum).toContain(CANARY_PAROLA);
    expect(tum).toContain(CANARY_ANAHTAR);
    expect(tum).toContain(CANARY_IBAN);
  });

  it('JSON.stringify yalnız özeti verir', () => {
    const json = JSON.stringify(plan);
    expect(canaryBul(json)).toEqual([]);
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(plan.ozet)));
    expect(plan.toJSON()).toBe(plan.ozet);
    expect(canaryBul(JSON.stringify({ kok: { plan } }))).toEqual([]);
  });

  it('toString ve şablon metni değersiz kısa biçimdir', () => {
    expect(plan.toString()).toBe(`[Plan dalga=a onay=${plan.onay_kodu}]`);
    expect(`${plan}`).toBe(plan.toString());
    expect(String(plan)).toBe(plan.toString());
    expect(canaryBul(`${plan}`)).toEqual([]);
  });

  it('util.inspect (her derinlik ve showHidden ile) değer göstermez', () => {
    for (const secenek of [{}, { depth: 10 }, { depth: null }, { showHidden: true, depth: null }, { showHidden: true, depth: 20, maxArrayLength: null, maxStringLength: null }]) {
      const cikti = inspect(plan, secenek);
      expect(cikti).toBe(plan.toString());
      expect(canaryBul(cikti)).toEqual([]);
      expect(canaryBul(inspect({ ic: { plan }, liste: [plan] }, secenek))).toEqual([]);
    }
  });

  it('özel (#) alanlar numaralandırılamaz ve nesne anahtarlarında görünmez', () => {
    expect(Object.keys(plan).sort()).toEqual(['dalga', 'onay_kodu', 'ozet']);
    expect(Reflect.ownKeys(plan).map(String).sort()).toEqual(['dalga', 'onay_kodu', 'ozet']);
    expect(canaryBul(JSON.stringify(Object.entries(plan)))).toEqual([]);
    expect(canaryBul(JSON.stringify({ ...plan }))).toEqual([]);
    expect(canaryBul(JSON.stringify(structuredClone({ ...plan })))).toEqual([]);
  });

  it('özetin hiçbir yerinde kayıt değeri yoktur', () => {
    expect(canaryBul(JSON.stringify(plan.ozet))).toEqual([]);
  });

  it('Plan örneği doğrudan kurulunca da onay kodu yeniden hesaplanır', () => {
    const { plan: ikinci } = sentetikPlanKur();
    expect(ikinci).toBeInstanceOf(Plan);
    expect(ikinci.onay_kodu).toBe(plan.onay_kodu);
  });
});

describe('onayDogrula', () => {
  const { plan } = sentetikPlanKur();

  it('doğru kodu kabul eder', () => {
    expect(onayDogrula(plan, plan.onay_kodu)).toBe(true);
  });

  it('boş, eksik ve metin olmayan kodu reddeder', () => {
    for (const k of ['', undefined, null, 0, 12, {}, [], true, '   ']) expect(onayDogrula(plan, k)).toBe(false);
  });

  it('yanlış kodu reddeder (son hane, ön ek, büyük harf, boşluk)', () => {
    const k = plan.onay_kodu;
    const son = k.endsWith('0') ? '1' : '0';
    expect(onayDogrula(plan, k.slice(0, -1) + son)).toBe(false);
    expect(onayDogrula(plan, k.toUpperCase())).toBe(false);
    expect(onayDogrula(plan, ` ${k}`)).toBe(false);
    expect(onayDogrula(plan, `${k} `)).toBe(false);
    expect(onayDogrula(plan, k.slice(0, -1))).toBe(false);
    expect(onayDogrula(plan, `${k}0`)).toBe(false);
    expect(onayDogrula(plan, 'ONAY-a-000000000000')).toBe(false);
    expect(onayDogrula(plan, 'ONAY-geri-0123456789ab')).toBe(false);
  });

  it('başka dalganın kodunu reddeder, aynı hex olsa bile', () => {
    const b = sentetikPlanKur({ dalga: 'b' }).plan;
    const c = sentetikPlanKur({ dalga: 'c' }).plan;
    expect(onayDogrula(plan, b.onay_kodu)).toBe(false);
    expect(onayDogrula(plan, c.onay_kodu)).toBe(false);
    expect(onayDogrula(b, plan.onay_kodu)).toBe(false);
    expect(onayDogrula(plan, plan.onay_kodu.replace('ONAY-a-', 'ONAY-b-'))).toBe(false);
  });

  it('başka girdinin ya da başka hedefin kodunu reddeder', () => {
    expect(onayDogrula(plan, kod({ host: 'zzzz9999.supabase.co' }))).toBe(false);
    const d = sentetikSUret();
    d.diger.apps['tr-fav'] = '[]';
    expect(onayDogrula(plan, kod({ s: d }))).toBe(false);
  });
});

describe('hedefRefKur', () => {
  it('8 hex özet üretir ve ana makineyi içermez', () => {
    const r = hedefRefKur('abcd1234.supabase.co');
    expect(r).toMatch(/^[0-9a-f]{8}$/);
    expect(r).not.toContain('abcd');
    expect(hedefRefKur('ABCD1234.supabase.co ')).toBe(r);
    expect(hedefRefKur('abcd1235.supabase.co')).not.toBe(r);
  });
});
