import { describe, it, expect } from 'vitest';
import { CANARY_ANAHTAR, CANARY_IBAN, CANARY_PAROLA, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { semaAyristir, type S } from '../girdi/sema-ayristirici-hesap.ts';
import {
  APP_ANAHTARLARI, AZAMI_ANAHTAR_UZUNLUGU, AZAMI_DEGER, AZAMI_UYGULAMA_ANAHTARI, UYGULAMA_KODU_DESENI, uygulamaDonustur,
} from './uygulama-hesap.ts';

function sOlustur(apps: unknown): S {
  return semaAyristir({ diger: { apps } }).s;
}

describe('APP_ANAHTARLARI', () => {
  it('uygulama kodları desene uyar ve hiçbir anahtar iki uygulamada tekrarlanmaz', () => {
    const tum: string[] = [];
    for (const [kod, anahtarlar] of Object.entries(APP_ANAHTARLARI)) {
      expect(kod).toMatch(UYGULAMA_KODU_DESENI);
      tum.push(...anahtarlar);
    }
    expect(new Set(tum).size).toBe(tum.length);
  });
  it('11 uygulama kodunu içerir', () => {
    expect(Object.keys(APP_ANAHTARLARI).sort()).toEqual(
      ['bahis', 'dosya', 'hesapyon', 'ilgi', 'karsilama', 'marketliste', 'odeme', 'oynatma', 'pinterest', 'tasarim', 'telrehber'],
    );
  });
});

describe('uygulamaDonustur', () => {
  const tablo = Object.entries(APP_ANAHTARLARI).flatMap(([uygulama, anahtarlar]) => anahtarlar.map((anahtar) => [uygulama, anahtar] as const));

  it.each(tablo)('%s uygulamasının %s anahtarı satıra dönüşür', (uygulama, anahtar) => {
    const sonuc = uygulamaDonustur(sOlustur({ [anahtar]: '{"v":1}' }));
    expect(sonuc.satirlar).toEqual([{ uygulama, anahtar, deger: '{"v":1}' }]);
    expect(sonuc.atlananlar).toEqual([]);
    expect(sonuc.uygulama_sayilari).toEqual([{ uygulama, sayi: 1 }]);
    expect(sonuc.kaynak_anahtar_sayisi).toBe(1);
  });

  it('sentetik girdinin bilinen 16 anahtarının hepsi eşlenir, hiçbiri atlanmaz', () => {
    const s = semaAyristir(sentetikSUret()).s;
    const sonuc = uygulamaDonustur(s);
    const kaynakAnahtarSayisi = Object.keys((s.diger.apps as Record<string, string>)).length;
    expect(kaynakAnahtarSayisi).toBe(16);
    expect(sonuc.satirlar).toHaveLength(16);
    expect(sonuc.atlananlar).toEqual([]);
    expect(sonuc.kaynak_anahtar_sayisi).toBe(16);
    expect(sonuc.uygulama_sayilari.reduce((t, u) => t + u.sayi, 0)).toBe(16);
  });

  it('değer bayt sadakatiyle taşınır (boşluk, satır sonu, canary dahil yeniden serileştirme yok)', () => {
    const deger = ' {"a":1,   "b":[1, 2]}\n\t"' + CANARY_PAROLA;
    const sonuc = uygulamaDonustur(sOlustur({ 'hesap-yoneticisi-v1': deger }));
    expect(sonuc.satirlar[0]!.deger).toBe(deger);
  });

  it('çıktı (uygulama, anahtar) sırasındadır; girdi sırası sonucu değiştirmez', () => {
    const a = { 'tr-chip': '2', 'bahis_takip_v2': '1', 'tr-fav': '3', 'astra_prefs': '4' };
    const b = { 'astra_prefs': '4', 'tr-fav': '3', 'bahis_takip_v2': '1', 'tr-chip': '2' };
    const ra = uygulamaDonustur(sOlustur(a));
    const rb = uygulamaDonustur(sOlustur(b));
    expect(ra).toEqual(rb);
    expect(ra.satirlar.map((x) => `${x.uygulama}/${x.anahtar}`)).toEqual(['bahis/bahis_takip_v2', 'karsilama/astra_prefs', 'telrehber/tr-chip', 'telrehber/tr-fav']);
  });

  it('ANAHTAR_ESLENMEDI: bilinmeyen anahtar sayılır, satır üretilmez', () => {
    const sonuc = uygulamaDonustur(sOlustur({ 'bilinmeyen-anahtar': 'x', 'tr-fav': '[]' }));
    expect(sonuc.satirlar).toHaveLength(1);
    expect(sonuc.atlananlar).toEqual([{ koleksiyon: 'apps', kaynak_id: 'bilinmeyen-anahtar', neden_kodu: 'ANAHTAR_ESLENMEDI' }]);
    expect(sonuc.kaynak_anahtar_sayisi).toBe(2);
  });

  it('__proto__ ve constructor gibi anahtarlar sıradan bilinmeyen anahtardır', () => {
    const apps = JSON.parse('{"__proto__":"x","constructor":"y","toString":"z"}') as unknown;
    const sonuc = uygulamaDonustur(sOlustur(apps));
    expect(sonuc.satirlar).toEqual([]);
    expect(sonuc.atlananlar.map((a) => a.neden_kodu)).toEqual(['ANAHTAR_ESLENMEDI', 'ANAHTAR_ESLENMEDI', 'ANAHTAR_ESLENMEDI']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('ANAHTAR_COK_UZUN: 200 karakteri aşan anahtar (eşlenmiş olsa bile) atlanır; kimlik 40 karaktere kırpılır', () => {
    const uzun = 'a'.repeat(AZAMI_ANAHTAR_UZUNLUGU + 1);
    const sonuc = uygulamaDonustur(sOlustur({ [uzun]: '1' }));
    expect(sonuc.satirlar).toEqual([]);
    expect(sonuc.atlananlar).toEqual([{ koleksiyon: 'apps', kaynak_id: 'a'.repeat(40), neden_kodu: 'ANAHTAR_COK_UZUN' }]);
  });

  it('tam 200 karakterlik anahtar uzun sayılmaz (yalnız eşlenmedi)', () => {
    const sinir = 'b'.repeat(AZAMI_ANAHTAR_UZUNLUGU);
    const sonuc = uygulamaDonustur(sOlustur({ [sinir]: '1' }));
    expect(sonuc.atlananlar.map((a) => a.neden_kodu)).toEqual(['ANAHTAR_ESLENMEDI']);
  });

  it('sentetik uzunAnahtar seçeneği ANAHTAR_COK_UZUN üretir', () => {
    const sonuc = uygulamaDonustur(semaAyristir(sentetikSUret({ uzunAnahtar: true })).s);
    expect(sonuc.atlananlar.map((a) => a.neden_kodu)).toEqual(['ANAHTAR_COK_UZUN']);
    expect(sonuc.satirlar).toHaveLength(16);
  });

  it.each([[5], [null], [{ a: 1 }], [['x']], [true]])('DEGER_METIN_DEGIL: metin olmayan değer %j atlanır', (deger) => {
    const sonuc = uygulamaDonustur(sOlustur({ 'tr-fav': deger }));
    expect(sonuc.satirlar).toEqual([]);
    expect(sonuc.atlananlar).toEqual([{ koleksiyon: 'apps', kaynak_id: 'telrehber/tr-fav', neden_kodu: 'DEGER_METIN_DEGIL' }]);
  });

  it('DEGER_COK_BUYUK: 8 MB aşan değer atlanır (sentetik buyukDeger)', () => {
    const sonuc = uygulamaDonustur(semaAyristir(sentetikSUret({ buyukDeger: true })).s);
    expect(sonuc.atlananlar).toEqual([{ koleksiyon: 'apps', kaynak_id: 'tasarim/tasarim-atolyesi-kutuphane', neden_kodu: 'DEGER_COK_BUYUK' }]);
    expect(sonuc.satirlar).toHaveLength(16);
  });

  it('8 MB sınırı karakter sayısıyla ölçülür: tam sınır kabul, bir fazlası ret', () => {
    const tam = uygulamaDonustur(sOlustur({ 'tr-fav': 'x'.repeat(AZAMI_DEGER) }));
    expect(tam.satirlar).toHaveLength(1);
    const fazla = uygulamaDonustur(sOlustur({ 'tr-fav': 'x'.repeat(AZAMI_DEGER + 1) }));
    expect(fazla.satirlar).toEqual([]);
    expect(fazla.atlananlar[0]!.neden_kodu).toBe('DEGER_COK_BUYUK');
  });

  it('UTF-16 uzunluğu sınırı aşan ama kod noktası sayısı aşmayan değer kabul edilir (SQL length() ölçüsü)', () => {
    const deger = '😀'.repeat(AZAMI_DEGER / 2 + 1); /* UTF-16: 8 MB + 2, kod noktası: 4 MB + 1 */
    expect(deger.length).toBeGreaterThan(AZAMI_DEGER);
    expect(uygulamaDonustur(sOlustur({ 'tr-fav': deger })).satirlar).toHaveLength(1);
  });

  it('uygulama başına en çok AZAMI_UYGULAMA_ANAHTARI anahtar: 300 sınırının üstündeki bilinmeyen anahtarlar tek tek sayılır', () => {
    const apps: Record<string, string> = {};
    for (let i = 0; i < AZAMI_UYGULAMA_ANAHTARI + 50; i++) apps[`ozel-anahtar-${String(i).padStart(4, '0')}`] = '1';
    const sonuc = uygulamaDonustur(sOlustur(apps));
    expect(sonuc.kaynak_anahtar_sayisi).toBe(350);
    expect(sonuc.satirlar).toEqual([]);
    expect(sonuc.atlananlar).toHaveLength(350);
    expect(new Set(sonuc.atlananlar.map((a) => a.neden_kodu))).toEqual(new Set(['ANAHTAR_ESLENMEDI']));
  });

  it('diger.apps yok ya da null ise boş sonuç döner', () => {
    expect(uygulamaDonustur(semaAyristir({}).s)).toEqual({ satirlar: [], atlananlar: [], uyarilar: [], uygulama_sayilari: [], kaynak_anahtar_sayisi: 0 });
    expect(uygulamaDonustur(semaAyristir({ diger: { apps: null } }).s).satirlar).toEqual([]);
  });

  it.each([[[]], ['metin'], [5]])('diger.apps nesne değilse (%j) SEMA_GECERSIZ fırlatır', (apps) => {
    try {
      uygulamaDonustur(sOlustur(apps));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(GirdiHatasi);
      expect((e as GirdiHatasi).kod).toBe('SEMA_GECERSIZ');
      expect((e as GirdiHatasi).yol).toBe('diger.apps');
    }
  });

  it('atlananlar ve uyarılar kayıt değeri taşımaz (yalnız anahtar adları)', () => {
    const sonuc = uygulamaDonustur(sOlustur({ 'hesap-yoneticisi-v1': 5, 'astra_prefs': JSON.stringify({ anahtar: CANARY_ANAHTAR, iban: CANARY_IBAN }), 'x-ozel': CANARY_PAROLA }));
    expect(canaryBul(JSON.stringify({ a: sonuc.atlananlar, u: sonuc.uyarilar, s: sonuc.uygulama_sayilari }))).toEqual([]);
    /* değerler yalnız satırlarda (bellekte) durur */
    expect(canaryBul(JSON.stringify(sonuc.satirlar))).not.toEqual([]);
  });
});
