import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { raporDogrula } from '../rapor/rapor-sema.ts';
import { bellekPlanKaynagi, ciktiYakala, ilgiUrunleri, sentetikPlanKur, TEST_ANA_MAKINE, TEST_SURUM, type CiktiYakalayici } from '../test-destek.ts';
import { kuruCalistir } from './kuru-calistir.ts';
import { planKur } from './plan-kur.ts';

let yakala: CiktiYakalayici;
let kok = '';
beforeEach(() => {
  yakala = ciktiYakala();
  kok = mkdtempSync(join(tmpdir(), 'aktarim-plankur-'));
});
afterEach(() => {
  yakala.birak();
  rmSync(kok, { recursive: true, force: true });
});

const HEDEF = { anaMakine: TEST_ANA_MAKINE, kisa: 'abcd...' };

describe('planKur', () => {
  it('bellek kaynağıyla kurulan plan doğrudan kurulanla aynı kodu verir', () => {
    const s = sentetikSUret();
    const plan = planKur({ girdi: 'yok.json', ilgi: 'ilgi.json', dalga: 'a', anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM, kaynak: bellekPlanKaynagi(s) });
    expect(plan.onay_kodu).toBe(sentetikPlanKur({ s }).plan.onay_kodu);
  });
  it('ilgi yolu verilmezse ilgi okunmaz (ILGI_KAYNAK_YOK)', () => {
    const plan = planKur({ girdi: 'g.json', dalga: 'a', anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM, kaynak: bellekPlanKaynagi(sentetikSUret()) });
    expect(plan.ozet.bilgi_kodlari).toEqual(['ILGI_KAYNAK_YOK']);
  });
  it('gerçek dosya kaynağıyla (varsayılan) girdi ve ilgi dosyalarını okur', () => {
    const girdi = join(kok, 'yedek.json');
    const ilgi = join(kok, 'ilgi.json');
    writeFileSync(girdi, JSON.stringify(sentetikSUret()));
    writeFileSync(ilgi, JSON.stringify(ilgiUrunleri()));
    const plan = planKur({ girdi, ilgi, dalga: 'a', anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM });
    expect(plan.onay_kodu).toBe(sentetikPlanKur().plan.onay_kodu);
  });
  it('bozuk ilgi JSON\'u BOZUK_JSON yol=ilgi verir; ayrıştırıcı hata metni (içerik parçası) taşınmaz', () => {
    const girdi = join(kok, 'yedek.json');
    const ilgi = join(kok, 'ilgi.json');
    writeFileSync(girdi, JSON.stringify(sentetikSUret()));
    writeFileSync(ilgi, `[{"id":"x","name":"${CANARY_AD}`);
    try {
      planKur({ girdi, ilgi, dalga: 'a', anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(GirdiHatasi);
      expect((e as GirdiHatasi).kod).toBe('BOZUK_JSON');
      expect((e as GirdiHatasi).yol).toBe('ilgi');
      expect(canaryBul((e as Error).message)).toEqual([]);
    }
  });
  it('olmayan girdi dosyası DOSYA_OKUNAMADI verir', () => {
    expect(() => planKur({ girdi: join(kok, 'yok.json'), dalga: 'a', anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM })).toThrowError(/DOSYA_OKUNAMADI/);
  });
  it('ilgi dizi değilse SEMA_GECERSIZ verir', () => {
    const girdi = join(kok, 'yedek.json');
    const ilgi = join(kok, 'ilgi.json');
    writeFileSync(girdi, JSON.stringify(sentetikSUret()));
    writeFileSync(ilgi, '{"liste":[]}');
    expect(() => planKur({ girdi, ilgi, dalga: 'a', anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM })).toThrowError(/SEMA_GECERSIZ yol=ilgi/);
  });
});

describe('kuruCalistir', () => {
  const kaynak = () => bellekPlanKaynagi(sentetikSUret());
  const g = (ek: Record<string, unknown> = {}) => ({ girdi: 'g.json', dalga: 'a' as const, json: false, hedef: HEDEF, aracSurumu: TEST_SURUM, kaynak: kaynak(), ilgi: 'i.json', ...ek });

  it('planı döndürür ve raporu metin olarak yazar (onay kodu ve hedef kısaltması dahil)', () => {
    const plan = kuruCalistir(g());
    expect(yakala.satirlar).toHaveLength(1);
    expect(yakala.satirlar[0]).toContain(`ONAY_KODU ${plan.onay_kodu}`);
    expect(yakala.satirlar[0]).toContain('HEDEF abcd...');
  });
  it('--json ile rapor JSON olarak yazılır ve şemadan geçer', () => {
    const plan = kuruCalistir(g({ json: true }));
    const r = raporDogrula(JSON.parse(yakala.satirlar[0]!));
    expect(r.onay_kodu).toBe(plan.onay_kodu);
    expect(r.hedef_proje_kisa).toBe('abcd...');
  });
  it('--rapor dosyasına aynı raporu 0600 ile yazar', () => {
    const yol = join(kok, 'rapor.json');
    const plan = kuruCalistir(g({ rapor: yol }));
    expect(raporDogrula(JSON.parse(readFileSync(yol, 'utf8'))).onay_kodu).toBe(plan.onay_kodu);
    expect(statSync(yol).mode & 0o777).toBe(0o600);
  });
  it('ağ ve yazıcı gerektirmez ve canary içermez', () => {
    kuruCalistir(g({ json: true }));
    expect(canaryBul(yakala.metin())).toEqual([]);
  });
  it('geçersiz girdi hatası fırlatır ve hiçbir şey yazmaz', () => {
    const kotu = { girdiYukle: () => { throw new GirdiHatasi('BOZUK_JSON'); }, ilgiOku: () => undefined };
    expect(() => kuruCalistir(g({ kaynak: kotu }))).toThrowError(GirdiHatasi);
    expect(yakala.satirlar).toEqual([]);
  });
});
