import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANARY_AD, CANARY_IBAN, CANARY_PAROLA, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { KomutHatasi } from './komut-hata.ts';
import { VARSAYILAN_YIGIN, yaz, yazSonucuYazdir } from './yaz.ts';
import { bellekDeposuKur } from '../yazici/bellek-yazici.ts';
import { AKTARIM_1, AKTARIM_2, ciktiYakala, sentetikPlanKur, yazCalistir, yaziciFabrikasi, type CiktiYakalayici } from '../test-destek.ts';

const s = sentetikSUret();

/* Yazma sırasında ilerleme satırları `cikti.ts` kapısına gider: gerçek stdout'a sızmasın diye her testte yakalanır. */
let genelYakala: CiktiYakalayici;
beforeEach(() => {
  genelYakala = ciktiYakala();
});
afterEach(() => genelYakala.birak());

describe('yaz: onay kapısı (hiçbir yazma, oturum bile açılmaz)', () => {
  const { plan } = sentetikPlanKur();
  const baskaDalga = sentetikPlanKur({ dalga: 'b' }).plan.onay_kodu;
  const sonHane = plan.onay_kodu.endsWith('0') ? '1' : '0';

  const yanlislar: ReadonlyArray<[string, unknown]> = [
    ['undefined', undefined],
    ['boş metin', ''],
    ['yalnız boşluk', '   '],
    ['null', null],
    ['sayı', 123456],
    ['nesne', {}],
    ['son hanesi yanlış', plan.onay_kodu.slice(0, -1) + sonHane],
    ['küçük/büyük harf', plan.onay_kodu.toUpperCase()],
    ['başında boşluk', ` ${plan.onay_kodu}`],
    ['sonunda satır sonu', `${plan.onay_kodu}\n`],
    ['başka dalganın kodu (b)', baskaDalga],
    ['dalga harfi değiştirilmiş', plan.onay_kodu.replace('ONAY-a-', 'ONAY-b-')],
    ['geri alma kodu', 'ONAY-geri-0123456789ab'],
    ['statik kod', 'ONAY-statik-0123456789ab'],
    ['hedef farklı projenin kodu', sentetikPlanKur({ host: 'zzzz9999.supabase.co' }).plan.onay_kodu],
    ['girdisi değişmiş planın kodu', (() => { const d = sentetikSUret(); d.diger.apps['tr-fav'] = '[]'; return sentetikPlanKur({ s: d }).plan.onay_kodu; })()],
  ];

  it.each(yanlislar)('%s -> ONAY_UYUSMADI ve yazıcı fabrikası 0 kez çağrılır', async (_ad, onay) => {
    const fabrika = vi.fn();
    const depo = bellekDeposuKur();
    await expect(yaz({ plan, onay, yaziciKur: fabrika, aktarimId: AKTARIM_1 })).rejects.toMatchObject({ name: 'KomutHatasi', kod: 'ONAY_UYUSMADI' });
    expect(fabrika).not.toHaveBeenCalled();
    expect(depo.begeniler).toEqual([]);
    expect(depo.eslesme).toEqual([]);
    expect(depo.uygulamaDurumu.size).toBe(0);
  });

  it('doğru kodla fabrika tam bir kez çağrılır', async () => {
    const f = yaziciFabrikasi(bellekDeposuKur());
    await yaz({ plan, onay: plan.onay_kodu, yaziciKur: f.fabrika, aktarimId: AKTARIM_1 });
    expect(f.cagri()).toBe(1);
  });

  it('dalga b doğru kodla bile DALGA_YAZICI_YOK verir ve yazıcı kurulmaz', async () => {
    const b = sentetikPlanKur({ dalga: 'b' }).plan;
    const fabrika = vi.fn();
    try {
      await yaz({ plan: b, onay: b.onay_kodu, yaziciKur: fabrika, aktarimId: AKTARIM_1 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(KomutHatasi);
      expect((e as KomutHatasi).kod).toBe('DALGA_YAZICI_YOK');
      expect((e as KomutHatasi).alanlar).toEqual({ dalga: 'b' });
    }
    expect(fabrika).not.toHaveBeenCalled();
  });
});

describe('yaz: başarılı yazma', () => {
  it('uygulama durumlarını ve beğenileri yazar; sayılar ve eşleşmeler tutarlıdır', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const { sonuc, yazici } = await yazCalistir(plan, depo);
    expect(sonuc).toEqual({
      aktarim_id: AKTARIM_1, dalga: 'a', yazilan: [{ tablo: 'begeniler', sayi: 6 }, { tablo: 'uygulama_durumu', sayi: 16 }],
      sahiplenilen: 0, atlanan_eslesme: 0, belirsiz: 0, yaris_atlanan: 0, eslesme_yazilan: 22, yetim_olabilir: 0, hata: null,
    });
    expect(depo.begeniler).toHaveLength(6);
    expect(depo.eslesme).toHaveLength(22);
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(16);
    expect(yazici.kapatildiMi()).toBe(true);
  });

  it('uygulama değerleri kaynakla bayt bayt aynıdır', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    for (const k of plan.kayitlar()) {
      if (k.tablo !== 'uygulama_durumu') continue;
      expect(depo.uygulamaDurumu.get(k.uygulama)!.get(k.anahtar)).toBe(s.diger.apps[k.anahtar]);
    }
  });

  it('eşleşme satırlarında hedef kimliği, kaynak kimliği, dalga ve aktarım kimliği doğrudur', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    const uyg = depo.eslesme.find((e) => e.kaynak_id === 'odeme/odeme-raporu-v1')!;
    expect(uyg).toMatchObject({ koleksiyon: 'apps', hedef_tablo: 'uygulama_durumu', hedef_id: null, hedef_ref: 'odeme/odeme-raporu-v1', dalga: 'a', aktarim_id: AKTARIM_1, silindi_at: null, ekstra: { durum: 'yazildi' }, kaynak: 'astra-os' });
    const begeni = depo.eslesme.find((e) => e.kaynak_id === 'urun-002')!;
    const satir = depo.begeniler.find((b) => b.kod === 'urun-002')!;
    expect(begeni).toMatchObject({ koleksiyon: 'ilgi_urunleri', hedef_tablo: 'begeniler', hedef_id: satir.id, hedef_ref: null, ekstra: { durum: 'yazildi' } });
  });

  it('beğeni satırları plan satırıyla aynıdır (kuruş yuvarlaması, kod, ekstra.eski)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    const b1 = depo.begeniler.find((b) => b.kod === 'urun-001')!;
    expect(b1).toMatchObject({ kod: 'urun-001', ad: 'Örnek Ürün 001', fiyat: 1.01, oncelik: 'high', favori: true, puan: 4, ekstra: { eski: { koleksiyon: 'ilgi_urunleri', id: 'urun-001', ts: 1750000000000 } } });
    expect(depo.begeniler.find((b) => b.kod === 'urun-003')!.fiyat).toBe(0.13);
    expect(depo.begeniler.find((b) => b.kod === 'urun-007')!.fiyat).toBeNull();
    expect(depo.begeniler.find((b) => b.kod === 'urun-006')).toBeUndefined(); /* AD_BOS atlanmıştı */
  });

  it('ilgi kaynağı yoksa yalnız uygulama durumları yazılır (begeniler okunmaz bile)', async () => {
    const { plan } = sentetikPlanKur({ ilgi: undefined });
    const depo = bellekDeposuKur();
    const { sonuc, yazici } = await yazCalistir(plan, depo);
    expect(sonuc.yazilan).toEqual([{ tablo: 'uygulama_durumu', sayi: 16 }]);
    expect(yazici.cagriSayisi('begeniKodlariOku')).toBe(0);
    expect(yazici.cagriSayisi('satirEkle')).toBe(0);
  });

  it('varsayılan yığın 50: 6 beğeni tek ekleme çağrısıdır; yığın 2 ise üç çağrıdır', async () => {
    expect(VARSAYILAN_YIGIN).toBe(50);
    const { plan } = sentetikPlanKur();
    const a = await yazCalistir(plan, bellekDeposuKur());
    expect(a.yazici.cagriSayisi('satirEkle')).toBe(1);
    expect(a.yazici.cagriSayisi('eslesmeEkle')).toBe(16 + 1);
    const b = await yazCalistir(plan, bellekDeposuKur(), { yigin: 2 });
    expect(b.yazici.cagriSayisi('satirEkle')).toBe(3);
    expect(b.yazici.cagriSayisi('eslesmeEkle')).toBe(16 + 3);
    expect(b.sonuc.hata).toBeNull();
    expect(b.sonuc.yazilan).toEqual(a.sonuc.yazilan);
  });

  it('hedefteki mevcut satırı hiç güncellemez: yazıcıda satır güncelleme/gizleme çağrısı yoktur', async () => {
    const { plan } = sentetikPlanKur();
    const { yazici } = await yazCalistir(plan, bellekDeposuKur());
    expect(yazici.cagriSayisi('satirGizle')).toBe(0);
    expect(yazici.cagriSayisi('uygulamaDurumuSil')).toBe(0);
    expect(yazici.cagriSayisi('eslesmeGuncelle')).toBe(0);
  });
});

describe('yaz: okuma-sonra-yaz yarışı (yazmadan hemen önce anahtar yeniden okunur)', () => {
  const KULLANICI_DEGERI = 'YARIS-KULLANICI-DEGERI';

  /* İlk okumalar (plan anı) bittikten sonra hedefe `uygulama/anahtar` yazar: "kullanıcı o sırada uygulamayı açtı" benzetimi. */
  function yarisliYaziciKur(depo: ReturnType<typeof bellekDeposuKur>, plan: ReturnType<typeof sentetikPlanKur>['plan'], hedefler: ReadonlyArray<{ uygulama: string; anahtar: string }>) {
    const f = yaziciFabrikasi(depo);
    const uygulamaSayisi = new Set(plan.kayitlar().flatMap((k) => (k.tablo === 'uygulama_durumu' ? [k.uygulama] : []))).size;
    const yaziciKur = async () => {
      const y = await f.fabrika();
      const orijinal = y.uygulamaAnahtarlariOku.bind(y);
      let okuma = 0;
      y.uygulamaAnahtarlariOku = async (uygulama: string) => {
        okuma += 1;
        const sonuc = await orijinal(uygulama);
        if (okuma === uygulamaSayisi) {
          for (const h of hedefler) {
            if (!depo.uygulamaDurumu.has(h.uygulama)) depo.uygulamaDurumu.set(h.uygulama, new Map());
            depo.uygulamaDurumu.get(h.uygulama)!.set(h.anahtar, KULLANICI_DEGERI);
          }
        }
        return sonuc;
      };
      return y;
    };
    return { f, yaziciKur };
  }
  function ilkUygulamaKaydi(plan: ReturnType<typeof sentetikPlanKur>['plan'], sira = 0) {
    const k = plan.kayitlar().filter((x) => x.tablo === 'uygulama_durumu')[sira]!;
    if (k.tablo !== 'uygulama_durumu') throw new Error('uygulama kaydı bekleniyordu');
    return { uygulama: k.uygulama, anahtar: k.anahtar };
  }

  it('plan anından sonra belirmiş anahtar EZİLMEZ: yazılmaz, sahiplenildi sayılır, yaris_atlanan=1', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const h = ilkUygulamaKaydi(plan);
    const { f, yaziciKur } = yarisliYaziciKur(depo, plan, [h]);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur });
    expect(sonuc.hata).toBeNull();
    expect(sonuc.yaris_atlanan).toBe(1);
    expect(sonuc.sahiplenilen).toBe(0); /* plan anındaki sahiplenme ayrı sayılır */
    expect(depo.uygulamaDurumu.get(h.uygulama)!.get(h.anahtar)).toBe(KULLANICI_DEGERI);
    expect(sonuc.yazilan).toEqual([{ tablo: 'begeniler', sayi: 6 }, { tablo: 'uygulama_durumu', sayi: 15 }]);
    expect(f.uretilen[0]!.cagriSayisi('uygulamaDurumuYaz')).toBe(15);
  });

  it('yarışta atlanan anahtar için eşleşme "sahiplenildi" yazılır (geri-al bunu aracın yazdığı sanmaz)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const h = ilkUygulamaKaydi(plan);
    const { yaziciKur } = yarisliYaziciKur(depo, plan, [h]);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur });
    const e = depo.eslesme.filter((x) => x.hedef_tablo === 'uygulama_durumu' && x.hedef_ref === `${h.uygulama}/${h.anahtar}`);
    expect(e).toHaveLength(1);
    expect(e[0]!.ekstra.durum).toBe('sahiplenildi');
    expect(sonuc.eslesme_yazilan).toBe(22);
    expect(sonuc.yetim_olabilir).toBe(0);
    expect(depo.eslesme.filter((x) => x.hedef_tablo === 'uygulama_durumu' && x.ekstra.durum === 'yazildi')).toHaveLength(15);
  });

  it('birden çok yarış: hepsi atlanır ve sayılır (3 anahtar -> yaris_atlanan=3)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const hedefler = [0, 4, 9].map((i) => ilkUygulamaKaydi(plan, i));
    const { yaziciKur } = yarisliYaziciKur(depo, plan, hedefler);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur });
    expect(sonuc.yaris_atlanan).toBe(3);
    expect(sonuc.yazilan.find((x) => x.tablo === 'uygulama_durumu')!.sayi).toBe(13);
    for (const h of hedefler) expect(depo.uygulamaDurumu.get(h.uygulama)!.get(h.anahtar)).toBe(KULLANICI_DEGERI);
  });

  it('yarış yoksa yaris_atlanan=0 ve her anahtar yazılır (olumsuz kontrol)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const { yaziciKur } = yarisliYaziciKur(depo, plan, []);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur });
    expect(sonuc.yaris_atlanan).toBe(0);
    expect(sonuc.yazilan.find((x) => x.tablo === 'uygulama_durumu')!.sayi).toBe(16);
  });

  it('yeniden okuma yazmadan ÖNCE yapılır: her uygulama_durumu yazmasından önce bir okuma vardır', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const olaylar: string[] = [];
    await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => {
      const y = await f.fabrika();
      const oku = y.uygulamaAnahtarlariOku.bind(y);
      const yaz_ = y.uygulamaDurumuYaz.bind(y);
      y.uygulamaAnahtarlariOku = async (u: string) => { olaylar.push('oku'); return oku(u); };
      y.uygulamaDurumuYaz = async (u: string, a: string, d: string) => { olaylar.push('yaz'); return yaz_(u, a, d); };
      return y;
    } });
    const ilkYaz = olaylar.indexOf('yaz');
    expect(ilkYaz).toBeGreaterThan(0);
    for (let i = 0; i < olaylar.length; i++) if (olaylar[i] === 'yaz') expect(olaylar[i - 1]).toBe('oku');
    expect(olaylar.filter((x) => x === 'yaz')).toHaveLength(16);
  });

  it('yarış sonrası yeniden çalıştırma da kullanıcı değerini ezmez (idempotent)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const h = ilkUygulamaKaydi(plan);
    const { yaziciKur } = yarisliYaziciKur(depo, plan, [h]);
    await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur });
    const ikinci = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(ikinci.sonuc.hata).toBeNull();
    expect(ikinci.sonuc.yaris_atlanan).toBe(0);
    expect(depo.uygulamaDurumu.get(h.uygulama)!.get(h.anahtar)).toBe(KULLANICI_DEGERI);
  });

  it('canary ve kullanıcı değeri sonuç nesnesine sızmaz', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const { yaziciKur } = yarisliYaziciKur(depo, plan, [ilkUygulamaKaydi(plan)]);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur });
    expect(JSON.stringify(sonuc)).not.toContain(KULLANICI_DEGERI);
    expect(canaryBul(JSON.stringify(sonuc))).toEqual([]);
  });
});

describe('yaz: hata yolu (ilk hatada durur, sayılar raporlanır, yazıcı kapatılır)', () => {
  it('uygulama durumu yazarken hata: yazılanlar sayılır, beğenilere geçilmez', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => {
      const y = await f.fabrika();
      y.hataEnjekte({ n: 3, yontem: 'uygulamaDurumuYaz', kod: '23505', ayrinti: `${CANARY_AD} ${CANARY_IBAN}` });
      return y;
    } });
    expect(sonuc.hata).toEqual({ kod: '23505', durum: null, tablo: 'uygulama_durumu' });
    expect(sonuc.yazilan).toEqual([{ tablo: 'uygulama_durumu', sayi: 2 }]);
    expect(sonuc.eslesme_yazilan).toBe(2);
    expect(sonuc.yetim_olabilir).toBe(0);
    expect(f.uretilen[0]!.cagriSayisi('satirEkle')).toBe(0);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
    expect(canaryBul(JSON.stringify(sonuc))).toEqual([]);
  });

  it('eşleşme yazılamazsa yetim_olabilir sayılır (R-3 çökme penceresi)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => {
      const y = await f.fabrika();
      y.hataEnjekte({ n: 3, yontem: 'eslesmeEkle', kod: '23514' });
      return y;
    } });
    expect(sonuc.hata).toMatchObject({ kod: '23514', tablo: 'aktarim_eslesme' });
    expect(sonuc.yetim_olabilir).toBe(1);
    expect([...depo.uygulamaDurumu.get('bahis')?.keys() ?? [], ...depo.uygulamaDurumu.get('dosya')?.keys() ?? []].length).toBeGreaterThan(0);
  });

  it('beğeni eklenemezse (hiç yazılmadı) yetim sayısı 0 kalır', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => {
      const y = await f.fabrika();
      y.hataEnjekte({ n: 1, yontem: 'satirEkle', kod: '23505', ayrinti: CANARY_PAROLA });
      return y;
    } });
    expect(sonuc.hata).toEqual({ kod: '23505', durum: null, tablo: 'begeniler' });
    expect(sonuc.yetim_olabilir).toBe(0);
    expect(sonuc.yazilan).toEqual([{ tablo: 'uygulama_durumu', sayi: 16 }]);
    expect(depo.begeniler).toEqual([]);
  });

  it('beğeniler yazıldı ama eşleşmeleri yazılamadıysa yetim_olabilir beğeni sayısıdır', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => {
      const y = await f.fabrika();
      y.hataEnjekte({ n: 17, yontem: 'eslesmeEkle', kod: '22023' });
      return y;
    } });
    expect(sonuc.hata).toMatchObject({ kod: '22023', tablo: 'aktarim_eslesme' });
    expect(sonuc.yetim_olabilir).toBe(6);
    expect(depo.begeniler).toHaveLength(6);
    expect(depo.eslesme).toHaveLength(16);
  });

  it('eşleşme okunamazsa hiçbir şey yazılmaz', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const sonuc = await yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => {
      const y = await f.fabrika();
      y.hataEnjekte({ n: 1, yontem: 'eslesmeOku', kod: '42P01' });
      return y;
    } });
    expect(sonuc.hata).toMatchObject({ kod: '42P01', tablo: 'aktarim_eslesme' });
    expect(sonuc.yazilan).toEqual([]);
    expect(depo.uygulamaDurumu.size + depo.begeniler.length + depo.eslesme.length).toBe(0);
  });

  it('yazıcı fabrikası hata fırlatırsa yaz da fırlatır (hata kodu çıktıya cli katmanında çevrilir)', async () => {
    const { plan } = sentetikPlanKur();
    await expect(yaz({ plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1, yaziciKur: async () => { throw new Error('oturum'); } })).rejects.toThrowError('oturum');
  });
});

describe('yazSonucuYazdir', () => {
  let yakala: CiktiYakalayici;
  beforeEach(() => {
    yakala = ciktiYakala();
  });
  afterEach(() => yakala.birak());

  it('başarılı sonucu sayı ve kodlarla yazar', async () => {
    const { sonuc } = await yazCalistir(sentetikPlanKur().plan, bellekDeposuKur());
    yakala.satirlar.length = 0;
    yazSonucuYazdir(sonuc);
    expect(yakala.satirlar).toEqual([
      `SONUC YAZ_TAMAM aktarim_id=${AKTARIM_1} dalga=a`,
      'SONUC YAZILAN tablo=begeniler sayi=6',
      'SONUC YAZILAN tablo=uygulama_durumu sayi=16',
      'SONUC OZET sahiplenilen=0 atlanan_eslesme=0 belirsiz=0 eslesme_yazilan=22 yetim_olabilir=0',
    ]);
  });

  it('yaris_atlanan > 0 ise UYARI YARIS_ATLANAN sayi=N yazar (OZET\'ten sonra)', () => {
    yazSonucuYazdir({
      aktarim_id: AKTARIM_1, dalga: 'a', yazilan: [], sahiplenilen: 0, atlanan_eslesme: 0, belirsiz: 0, yaris_atlanan: 2, eslesme_yazilan: 0, yetim_olabilir: 0, hata: null,
    });
    const i = yakala.satirlar.findIndex((x) => x.startsWith('SONUC OZET'));
    expect(yakala.satirlar[i + 1]).toBe('UYARI YARIS_ATLANAN sayi=2');
    expect(yakala.satirlar.filter((x) => x.includes('YARIS_ATLANAN'))).toHaveLength(1);
  });

  it('yaris_atlanan = 0 ise UYARI satırı yoktur (çıktı biçimi değişmez)', async () => {
    const { sonuc } = await yazCalistir(sentetikPlanKur().plan, bellekDeposuKur());
    yakala.satirlar.length = 0;
    yazSonucuYazdir(sonuc);
    expect(yakala.satirlar.some((x) => x.includes('YARIS_ATLANAN') || x.startsWith('UYARI'))).toBe(false);
  });

  it('hatalı sonuçta YAZ_YARIM ve YAZMA_DURDU yazar', () => {
    yazSonucuYazdir({
      aktarim_id: AKTARIM_1, dalga: 'a', yazilan: [], sahiplenilen: 0, atlanan_eslesme: 0, belirsiz: 0, yaris_atlanan: 0, eslesme_yazilan: 0, yetim_olabilir: 0,
      hata: { kod: '23505', durum: null, tablo: null },
    });
    expect(yakala.satirlar[0]).toBe(`SONUC YAZ_YARIM aktarim_id=${AKTARIM_1} dalga=a`);
    expect(yakala.satirlar.at(-1)).toBe('HATA YAZMA_DURDU neden=23505 durum=0 tablo=yok');
    expect(yakala.satirlar.some((x) => x.includes('YAZILAN'))).toBe(false);
  });
});
