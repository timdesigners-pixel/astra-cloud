import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CANARY_AD, CANARY_IBAN, CANARY_PAROLA, canaryBul } from '@astra/ortak-test';
import { AyarHatasi } from '../ayar.ts';
import { CiktiHatasi } from '../cikti.ts';
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { PlanHatasi } from '../plan/plan-tipleri.ts';
import { RaporHatasi } from '../rapor/rapor-sema.ts';
import { ciktiYakala, type CiktiYakalayici } from '../test-destek.ts';
import { EslesmeHatasi } from '../yazici/eslesme.ts';
import { OturumHatasi } from '../yazici/oturum.ts';
import { YaziciHatasi } from '../yazici/yazici-arayuzu.ts';
import { hataSonucuKur, hataYazdirVeCikisAl } from './hata-eslestir.ts';
import { KomutHatasi, KullanimHatasi } from './komut-hata.ts';

describe('hataSonucuKur', () => {
  const tablo: ReadonlyArray<[string, unknown, unknown, 1 | 2]> = [
    ['KullanimHatasi', new KullanimHatasi('BAYRAK_BILINMIYOR'), { tur: 'HATA', kod: 'KULLANIM_HATASI', alanlar: { neden: 'BAYRAK_BILINMIYOR' } }, 2],
    ['KomutHatasi', new KomutHatasi('ONAY_UYUSMADI'), { tur: 'HATA', kod: 'ONAY_UYUSMADI', alanlar: {} }, 1],
    ['KomutHatasi alanlı', new KomutHatasi('DALGA_YAZICI_YOK', { dalga: 'b' }), { tur: 'HATA', kod: 'DALGA_YAZICI_YOK', alanlar: { dalga: 'b' } }, 1],
    ['KomutHatasi çıkış 2', new KomutHatasi('ONAY_UYUSMADI', {}, 2), { tur: 'HATA', kod: 'ONAY_UYUSMADI', alanlar: {} }, 2],
    ['AyarHatasi değişkenli', new AyarHatasi('ORTAM_EKSIK', 'ASTRA_PIN'), { tur: 'HATA', kod: 'AYAR_HATASI', alanlar: { neden: 'ORTAM_EKSIK', degisken: 'ASTRA_PIN' } }, 2],
    ['AyarHatasi değişkensiz', new AyarHatasi('URL_GECERSIZ'), { tur: 'HATA', kod: 'AYAR_HATASI', alanlar: { neden: 'URL_GECERSIZ', degisken: 'yok' } }, 2],
    ['GirdiHatasi yolsuz', new GirdiHatasi('BOZUK_JSON'), { tur: 'HATA', kod: 'GIRDI_HATASI', alanlar: { neden: 'BOZUK_JSON' } }, 1],
    ['GirdiHatasi yollu', new GirdiHatasi('SEMA_GECERSIZ', 'koleksiyon.debts', 3), { tur: 'HATA', kod: 'GIRDI_HATASI', alanlar: { neden: 'SEMA_GECERSIZ', yol: 'koleksiyon.debts', sayi: 3 } }, 1],
    ['GirdiHatasi yol yok (2)', new GirdiHatasi('GIRDI_YOLU_YOK'), { tur: 'HATA', kod: 'GIRDI_HATASI', alanlar: { neden: 'GIRDI_YOLU_YOK' } }, 2],
    ['PlanHatasi', new PlanHatasi('DALGA_GECERSIZ'), { tur: 'HATA', kod: 'PLAN_HATASI', alanlar: { neden: 'DALGA_GECERSIZ' } }, 1],
    ['RaporHatasi', new RaporHatasi('atlanan.kaynak_id'), { tur: 'HATA', kod: 'RAPOR_SEMA_GECERSIZ', alanlar: { yol: 'atlanan.kaynak_id' } }, 1],
    ['OturumHatasi kalanlı', new OturumHatasi('PIN_HATALI', 2), { tur: 'HATA', kod: 'OTURUM_HATASI', alanlar: { neden: 'PIN_HATALI', kalan: 2 } }, 1],
    ['OturumHatasi kalansız', new OturumHatasi('KILITLI'), { tur: 'HATA', kod: 'OTURUM_HATASI', alanlar: { neden: 'KILITLI' } }, 1],
    ['YaziciHatasi', new YaziciHatasi({ kod: '23505', durum: 409, tablo: 'begeniler' }), { tur: 'HATA', kod: 'YAZICI_HATASI', alanlar: { neden: '23505', durum: 409, tablo: 'begeniler' } }, 1],
    ['YaziciHatasi boş', new YaziciHatasi({ kod: 'X', durum: null, tablo: null }), { tur: 'HATA', kod: 'YAZICI_HATASI', alanlar: { neden: 'X', durum: 0, tablo: 'yok' } }, 1],
    ['EslesmeHatasi', new EslesmeHatasi('HEDEF_YOK'), { tur: 'HATA', kod: 'ESLESME_HATASI', alanlar: { neden: 'HEDEF_YOK' } }, 1],
    ['CiktiHatasi', new CiktiHatasi(), { tur: 'HATA', kod: 'SIZINTI_ENGELLENDI' }, 1],
  ];
  it.each(tablo)('%s', (_ad, hata, olay, cikis) => {
    expect(hataSonucuKur(hata)).toEqual({ olay, cikis });
  });

  it('tanınmayan hata BEKLENMEYEN_HATA olur; mesaj/ayrıntı/yığın taşınmaz', () => {
    const tanimsizlar: unknown[] = [
      new Error(`${CANARY_AD} ${CANARY_IBAN}`),
      Object.assign(new Error(CANARY_PAROLA), { code: '23505', details: CANARY_IBAN }),
      new TypeError(CANARY_AD),
      CANARY_AD,
      { message: CANARY_PAROLA },
      null,
      undefined,
      42,
    ];
    for (const e of tanimsizlar) {
      const s = hataSonucuKur(e);
      expect(s).toEqual({ olay: { tur: 'HATA', kod: 'BEKLENMEYEN_HATA' }, cikis: 1 });
      expect(canaryBul(JSON.stringify(s))).toEqual([]);
    }
  });
});

describe('hataYazdirVeCikisAl', () => {
  let yakala: CiktiYakalayici;
  beforeEach(() => {
    yakala = ciktiYakala();
  });
  afterEach(() => yakala.birak());

  it('olayı yazar ve çıkış kodunu döner', () => {
    expect(hataYazdirVeCikisAl(new KullanimHatasi('KOMUT_BILINMIYOR'))).toBe(2);
    expect(hataYazdirVeCikisAl(new KomutHatasi('ONAY_UYUSMADI'))).toBe(1);
    expect(yakala.satirlar).toEqual(['HATA KULLANIM_HATASI neden=KOMUT_BILINMIYOR', 'HATA ONAY_UYUSMADI']);
  });

  it('olay desen kapısından geçemezse sabit BEKLENMEYEN_HATA yazılır (değer sızmaz)', () => {
    const kotu = new KomutHatasi('ONAY_UYUSMADI', { x: CANARY_AD }); /* boşluklu değer desene uymaz */
    expect(hataYazdirVeCikisAl(kotu)).toBe(1);
    expect(yakala.satirlar).toEqual(['HATA BEKLENMEYEN_HATA']);
  });

  it('IBAN içeren alan değeri son savunmada engellenir ve yazılmaz', () => {
    const kotu = new KomutHatasi('ONAY_UYUSMADI', { x: CANARY_IBAN });
    expect(hataYazdirVeCikisAl(kotu)).toBe(1);
    expect(canaryBul(yakala.metin())).toEqual([]);
    expect(yakala.satirlar).toEqual(['HATA BEKLENMEYEN_HATA']);
  });

  it('tanınmayan hata canary mesajını yazmaz', () => {
    expect(hataYazdirVeCikisAl(new Error(CANARY_AD))).toBe(1);
    expect(yakala.satirlar).toEqual(['HATA BEKLENMEYEN_HATA']);
  });
});
