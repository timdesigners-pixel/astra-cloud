import { describe, it, expect } from 'vitest';
import { CANARY_AD } from '@astra/ortak-test';
import { HEDEF_TABLOLARI } from '../plan/plan-tipleri.ts';
import { bellekDeposuKur, bellekYaziciKur } from './bellek-yazici.ts';
import {
  EslesmeHatasi, eslesmeAnahtari, eslesmeDiziniKur, eslesmeDiziniYukle, eslesmeGirdisiDogrula, eslesmeKaydet, hedefTabloIzinliMi,
} from './eslesme.ts';
import type { EslesmeGirdisi, EslesmeSatiri } from './yazici-arayuzu.ts';

const AKTARIM = '11111111-1111-4111-8111-000000000001';
const HEDEF = '00000000-0000-4000-8000-000000000001';

function girdi(ek: Partial<EslesmeGirdisi> = {}): EslesmeGirdisi {
  return { koleksiyon: 'apps', kaynak_id: 'odeme/odeme-raporu-v1', hedef_tablo: 'uygulama_durumu', hedef_id: null, hedef_ref: 'odeme/odeme-raporu-v1', aktarim_id: AKTARIM, dalga: 'a', ekstra: { durum: 'yazildi' }, ...ek };
}
function satir(ek: Partial<EslesmeSatiri> = {}): EslesmeSatiri {
  return { id: 's1', koleksiyon: 'apps', kaynak_id: 'k1', hedef_tablo: 'uygulama_durumu', hedef_id: null, hedef_ref: 'k1', aktarim_id: AKTARIM, dalga: 'a', silindi_at: null, ekstra: {}, ...ek };
}
function kod(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(EslesmeHatasi);
    return (e as EslesmeHatasi).kod;
  }
  throw new Error('EslesmeHatasi bekleniyordu');
}

describe('hedefTabloIzinliMi', () => {
  it('HEDEF_TABLOLARI içindeki her tabloyu kabul eder', () => {
    for (const t of HEDEF_TABLOLARI) expect(hedefTabloIzinliMi(t)).toBe(true);
  });
  it('başka tabloyu reddeder', () => {
    for (const t of ['users', 'auth.users', '', 'Begeniler', 'begeniler ', 'aktarim_eslesme']) expect(hedefTabloIzinliMi(t)).toBe(false);
  });
});

describe('eslesmeGirdisiDogrula', () => {
  it('geçerli girdiyi kabul eder (hedef_ref ile ya da hedef_id ile)', () => {
    expect(() => eslesmeGirdisiDogrula(girdi())).not.toThrow();
    expect(() => eslesmeGirdisiDogrula(girdi({ hedef_tablo: 'begeniler', hedef_id: HEDEF, hedef_ref: null }))).not.toThrow();
  });
  it('HEDEF_TABLO_IZINSIZ', () => {
    expect(kod(() => eslesmeGirdisiDogrula(girdi({ hedef_tablo: 'users' })))).toBe('HEDEF_TABLO_IZINSIZ');
  });
  it('KOLEKSIYON_GECERSIZ', () => {
    for (const k of ['Apps', 'a', 'a b', 'x'.repeat(41), '']) expect(kod(() => eslesmeGirdisiDogrula(girdi({ koleksiyon: k })))).toBe('KOLEKSIYON_GECERSIZ');
  });
  it('KAYNAK_ID_GECERSIZ (boş ve 200 karakterden uzun)', () => {
    for (const k of ['', 'x'.repeat(201), 5 as unknown as string]) expect(kod(() => eslesmeGirdisiDogrula(girdi({ kaynak_id: k })))).toBe('KAYNAK_ID_GECERSIZ');
    expect(() => eslesmeGirdisiDogrula(girdi({ kaynak_id: 'x'.repeat(200) }))).not.toThrow();
  });
  it('HEDEF_YOK (ikisi de boş, hedef_id UUID değil, hedef_ref çok uzun)', () => {
    expect(kod(() => eslesmeGirdisiDogrula(girdi({ hedef_id: null, hedef_ref: null })))).toBe('HEDEF_YOK');
    expect(kod(() => eslesmeGirdisiDogrula(girdi({ hedef_id: 'uuid-degil', hedef_ref: null })))).toBe('HEDEF_YOK');
    expect(kod(() => eslesmeGirdisiDogrula(girdi({ hedef_id: null, hedef_ref: 'r'.repeat(261) })))).toBe('HEDEF_YOK');
  });
  it('DALGA_GECERSIZ', () => {
    expect(kod(() => eslesmeGirdisiDogrula(girdi({ dalga: 'd' as never })))).toBe('DALGA_GECERSIZ');
  });
  it('AKTARIM_ID_GECERSIZ', () => {
    for (const id of ['', 'abc', 'ABCDEFAB-1111-4111-8111-000000000001', `${AKTARIM}0`]) expect(kod(() => eslesmeGirdisiDogrula(girdi({ aktarim_id: id })))).toBe('AKTARIM_ID_GECERSIZ');
  });
  it('hata mesajı girdi değerini taşımaz', () => {
    try {
      eslesmeGirdisiDogrula(girdi({ kaynak_id: CANARY_AD, hedef_tablo: CANARY_AD }));
    } catch (e) {
      expect((e as Error).message).toBe('ESLESME_HATASI HEDEF_TABLO_IZINSIZ');
    }
    try {
      eslesmeGirdisiDogrula(girdi({ kaynak_id: CANARY_AD.repeat(20) }));
    } catch (e) {
      expect((e as Error).message).toBe('ESLESME_HATASI KAYNAK_ID_GECERSIZ');
    }
  });
});

describe('eslesmeDiziniKur', () => {
  it('bul, aktifMi ve hepsi çalışır; silinmiş eşleşme dizindedir ama aktif değildir', () => {
    const a = satir({ id: 'a', kaynak_id: 'k1' });
    const b = satir({ id: 'b', kaynak_id: 'k2', silindi_at: '2026-06-15T09:00:00.000Z' });
    const dizin = eslesmeDiziniKur([a, b]);
    expect(dizin.bul('apps', 'k1')).toBe(a);
    expect(dizin.bul('apps', 'k2')).toBe(b);
    expect(dizin.bul('apps', 'yok')).toBeUndefined();
    expect(dizin.aktifMi('apps', 'k1')).toBe(true);
    expect(dizin.aktifMi('apps', 'k2')).toBe(false);
    expect(dizin.aktifMi('apps', 'yok')).toBe(false);
    expect(dizin.hepsi()).toEqual([a, b]);
  });
  it('koleksiyon ayrımı korunur (aynı kaynak_id farklı koleksiyonda ayrı)', () => {
    const dizin = eslesmeDiziniKur([satir({ id: 'a', koleksiyon: 'apps', kaynak_id: 'k' })]);
    expect(dizin.aktifMi('apps', 'k')).toBe(true);
    expect(dizin.aktifMi('ilgi_urunleri', 'k')).toBe(false);
  });
  it('eslesmeAnahtari NUL ayraçlıdır (ab|c ile a|bc çakışmaz)', () => {
    expect(eslesmeAnahtari('ab', 'c')).not.toBe(eslesmeAnahtari('a', 'bc'));
  });
});

describe('eslesmeDiziniYukle / eslesmeKaydet (bellek yazıcıyla)', () => {
  it('yazıcıdan eşleşmeleri yükler', async () => {
    const y = bellekYaziciKur();
    await y.eslesmeEkle([girdi()]);
    const dizin = await eslesmeDiziniYukle(y);
    expect(dizin.aktifMi('apps', 'odeme/odeme-raporu-v1')).toBe(true);
  });

  it('yeni eşleşmeleri tek toplu ekleme ile yazar', async () => {
    const y = bellekYaziciKur();
    await eslesmeKaydet(y, [
      { mevcut: undefined, girdi: girdi({ kaynak_id: 'a/a1', hedef_ref: 'a/a1' }) },
      { mevcut: undefined, girdi: girdi({ kaynak_id: 'a/a2', hedef_ref: 'a/a2' }) },
    ]);
    expect(y.cagriSayisi('eslesmeEkle')).toBe(1);
    expect(y.cagriSayisi('eslesmeGuncelle')).toBe(0);
    expect(y.depo.eslesme).toHaveLength(2);
  });

  it('geri alınmış eşleşmeyi aynı satırı güncelleyerek canlandırır (tekrar eklemez)', async () => {
    const depo = bellekDeposuKur();
    const y1 = bellekYaziciKur(depo);
    await y1.eslesmeEkle([girdi()]);
    const [ilk] = await y1.eslesmeOku();
    await y1.eslesmeGuncelle(ilk!.id, { silindi_at: '2026-06-15T09:00:00.000Z' });
    const y2 = bellekYaziciKur(depo);
    const [silinmis] = await y2.eslesmeOku();
    await eslesmeKaydet(y2, [{ mevcut: silinmis, girdi: girdi({ aktarim_id: '22222222-2222-4222-8222-000000000002', hedef_ref: 'yeni/ref' }) }]);
    expect(y2.cagriSayisi('eslesmeEkle')).toBe(0);
    expect(depo.eslesme).toHaveLength(1);
    expect(depo.eslesme[0]).toMatchObject({ id: ilk!.id, silindi_at: null, aktarim_id: '22222222-2222-4222-8222-000000000002', hedef_ref: 'yeni/ref' });
  });

  it('doğrulama yazmadan önce yapılır: bir girdi geçersizse hiçbir şey yazılmaz', async () => {
    const y = bellekYaziciKur();
    await expect(
      eslesmeKaydet(y, [
        { mevcut: undefined, girdi: girdi() },
        { mevcut: undefined, girdi: girdi({ kaynak_id: 'b', hedef_tablo: 'users' }) },
      ]),
    ).rejects.toBeInstanceOf(EslesmeHatasi);
    expect(y.cagriSayisi()).toBe(0);
    expect(y.depo.eslesme).toEqual([]);
  });

  it('boş listede hiçbir yazıcı çağrısı yapmaz', async () => {
    const y = bellekYaziciKur();
    await eslesmeKaydet(y, []);
    expect(y.cagriSayisi()).toBe(0);
  });
});
