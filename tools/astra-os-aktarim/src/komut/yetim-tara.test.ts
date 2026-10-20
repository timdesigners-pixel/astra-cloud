import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CANARY_AD, CANARY_IBAN, canaryBul } from '@astra/ortak-test';
import { bellekDeposuKur, type BellekDeposu } from '../yazici/bellek-yazici.ts';
import { ciktiYakala, kullaniciVeriliDepo, sentetikPlanKur, yazCalistir, yaziciFabrikasi, type CiktiYakalayici } from '../test-destek.ts';
import { YETIM_ONAY_DESENI } from './geri-al-hesap.ts';
import { yetimTara, yetimTaraSonucuYazdir, type YetimTaraGirdisi } from './yetim-tara.ts';

let yakala: CiktiYakalayici;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => yakala.birak());

const HEDEF_REF = 'abcd1234';
const BASLANGIC = '2026-06-01T00:00:00Z'; /* kullanıcı satırları 2026-01-01, aracın satırları 2026-06-15 (SABIT_SAAT) */

/* Çökme penceresi: 15 uygulama anahtarı + eşleşmeleri yazıldı, 5 beğeni yazıldı ama beğeni eşleşmeleri (sahiplenilen dahil) yazılamadı → 5 yetim beğeni. */
async function yetimliDepo(): Promise<BellekDeposu> {
  const depo = kullaniciVeriliDepo();
  const { plan } = sentetikPlanKur();
  const f = yaziciFabrikasi(depo);
  const { yaz } = await import('./yaz.ts');
  const sonuc = await yaz({
    plan, onay: plan.onay_kodu, aktarimId: '11111111-1111-4111-8111-0000000000a1',
    yaziciKur: async () => {
      const y = await f.fabrika();
      y.hataEnjekte({ n: 16, yontem: 'eslesmeEkle', kod: '57014' });
      return y;
    },
  });
  expect(sonuc.hata).not.toBeNull();
  return depo;
}

function girdi(depo: BellekDeposu, ek: Partial<YetimTaraGirdisi> = {}) {
  const f = yaziciFabrikasi(depo);
  const g: YetimTaraGirdisi = { baslangic: BASLANGIC, temizle: false, hedefRef: HEDEF_REF, yaziciKur: f.fabrika, ...ek };
  return { g, f };
}
const aktifBegeniler = (depo: BellekDeposu): string[] => depo.begeniler.filter((b) => b.silindi_at === null).map((b) => String(b.kod)).sort();

describe('yetimTara: tarama', () => {
  it('eşleşmesi olmayan, başlangıçtan sonra oluşturulmuş beğenileri yetim sayar; kullanıcının eski satırları sayılmaz', async () => {
    const depo = await yetimliDepo();
    expect(depo.begeniler).toHaveLength(7);
    const { g, f } = girdi(depo);
    const s = await yetimTara(g);
    expect(s).toMatchObject({ taranan: 5, yetim: 5, temizlenen: 0, hata: null });
    expect(s.onay_kodu).toMatch(YETIM_ONAY_DESENI);
    expect(f.uretilen[0]!.cagriSayisi('satirGizle')).toBe(0);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
  });

  it('başlangıç verilmezse kullanıcının eski satırları da aday olur (bu yüzden --baslangic önerilir)', async () => {
    const depo = await yetimliDepo();
    const s = await yetimTara(girdi(depo, { baslangic: undefined }).g);
    expect(s).toMatchObject({ taranan: 7, yetim: 7 });
  });

  it('başlangıçtan önce oluşturulan satırlar elenir; olusturma bilgisi olmayan satır aday olmaz', async () => {
    const depo = await yetimliDepo();
    const s = await yetimTara(girdi(depo, { baslangic: '2026-06-16T00:00:00Z' }).g);
    expect(s).toMatchObject({ taranan: 0, yetim: 0 });
    depo.begeniler[2]!.olusturma = undefined;
    expect((await yetimTara(girdi(depo).g)).taranan).toBe(4);
  });

  it('başarılı bir yazmadan sonra yetim yoktur', async () => {
    const depo = kullaniciVeriliDepo();
    await yazCalistir(sentetikPlanKur().plan, depo);
    const s = await yetimTara(girdi(depo).g);
    expect(s).toMatchObject({ taranan: 5, yetim: 0 });
  });

  it('eşleşmesi geri alınmış (silindi_at) olsa bile hedefi eşleşmiş sayılır', async () => {
    const depo = kullaniciVeriliDepo();
    await yazCalistir(sentetikPlanKur().plan, depo);
    for (const e of depo.eslesme) e.silindi_at = '2026-06-16T00:00:00.000Z';
    expect((await yetimTara(girdi(depo).g)).yetim).toBe(0);
  });

  it('kod yetim kümesine, başlangıca ve hedefe bağlıdır', async () => {
    const depo = await yetimliDepo();
    const a = (await yetimTara(girdi(depo).g)).onay_kodu;
    expect((await yetimTara(girdi(depo).g)).onay_kodu).toBe(a);
    expect((await yetimTara(girdi(depo, { baslangic: '2026-06-02T00:00:00Z' }).g)).onay_kodu).not.toBe(a);
    expect((await yetimTara(girdi(depo, { hedefRef: 'zzzz9999' }).g)).onay_kodu).not.toBe(a);
    depo.begeniler[3]!.silindi_at = '2026-06-16T00:00:00.000Z';
    expect((await yetimTara(girdi(depo).g)).onay_kodu).not.toBe(a);
  });

  it('tarama salt okunurdur', async () => {
    const depo = await yetimliDepo();
    const once = JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]]);
    const { g, f } = girdi(depo);
    await yetimTara(g);
    const y = f.uretilen[0]!;
    for (const m of ['eslesmeEkle', 'eslesmeGuncelle', 'satirEkle', 'satirGizle', 'uygulamaDurumuYaz', 'uygulamaDurumuSil'] as const) expect(y.cagriSayisi(m), m).toBe(0);
    expect(JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]])).toBe(once);
  });
});

describe('yetimTara: --yetim-temizle onay kapısı', () => {
  it.each([[undefined], [''], ['ONAY-yetim-000000000000'], ['ONAY-geri-000000000000'], [' ONAY-yetim-000000000000']])('onay %j ile ONAY_UYUSMADI verir, hiçbir satır gizlenmez', async (onay) => {
    const depo = await yetimliDepo();
    const once = aktifBegeniler(depo);
    const { g, f } = girdi(depo, { temizle: true, onay });
    await expect(yetimTara(g)).rejects.toMatchObject({ name: 'KomutHatasi', kod: 'ONAY_UYUSMADI' });
    expect(f.uretilen[0]!.cagriSayisi('satirGizle')).toBe(0);
    expect(aktifBegeniler(depo)).toEqual(once);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
  });

  it('doğru kodla yalnız yetim satırları soft-delete eder; kullanıcı satırlarına dokunmaz', async () => {
    const depo = await yetimliDepo();
    const kod = (await yetimTara(girdi(depo).g)).onay_kodu;
    const s = await yetimTara(girdi(depo, { temizle: true, onay: kod }).g);
    expect(s).toMatchObject({ yetim: 5, temizlenen: 5, hata: null });
    expect(aktifBegeniler(depo)).toEqual(['kullanici-baska', 'urun-003']);
    expect(depo.begeniler).toHaveLength(7); /* fiziksel silme yok */
    const sonra = await yetimTara(girdi(depo).g);
    expect(sonra).toMatchObject({ taranan: 0, yetim: 0 });
  });

  it('temizlikten sonra yeniden yazma satırları sorunsuz yeniden oluşturur (kod tekilliği gizlenmişle çakışmaz)', async () => {
    const depo = await yetimliDepo();
    const kod = (await yetimTara(girdi(depo).g)).onay_kodu;
    await yetimTara(girdi(depo, { temizle: true, onay: kod }).g);
    const { sonuc } = await yazCalistir(sentetikPlanKur().plan, depo, { aktarimId: '22222222-2222-4222-8222-0000000000a2' });
    expect(sonuc.hata).toBeNull();
    expect(aktifBegeniler(depo)).toEqual(['kullanici-baska', 'urun-001', 'urun-002', 'urun-003', 'urun-004', 'urun-005', 'urun-007']);
    expect((await yetimTara(girdi(depo).g)).yetim).toBe(0);
  });

  it('yetim yoksa onay istenmez, hiçbir şey gizlenmez', async () => {
    const depo = kullaniciVeriliDepo();
    await yazCalistir(sentetikPlanKur().plan, depo);
    const { g, f } = girdi(depo, { temizle: true });
    const s = await yetimTara(g);
    expect(s).toMatchObject({ yetim: 0, temizlenen: 0, hata: null });
    expect(f.uretilen[0]!.cagriSayisi('satirGizle')).toBe(0);
  });

  it('kuru taramada verilen onay yok sayılır (temizle=false)', async () => {
    const depo = await yetimliDepo();
    const { g, f } = girdi(depo, { temizle: false, onay: 'ONAY-yetim-000000000000' });
    expect((await yetimTara(g)).temizlenen).toBe(0);
    expect(f.uretilen[0]!.cagriSayisi('satirGizle')).toBe(0);
  });

  it('kod tarama ile temizleme arasında durum değişirse tutmaz', async () => {
    const depo = await yetimliDepo();
    const kod = (await yetimTara(girdi(depo).g)).onay_kodu;
    /* tarama sonrası aracın bir satırının eşleşmesi elle yazıldı */
    const hedef = depo.begeniler.find((b) => b.kod === 'urun-001')!;
    depo.eslesme.push({ id: 'e-x', koleksiyon: 'ilgi_urunleri', kaynak_id: 'urun-001', hedef_tablo: 'begeniler', hedef_id: hedef.id, hedef_ref: null, aktarim_id: '11111111-1111-4111-8111-0000000000a1', dalga: 'a', silindi_at: null, ekstra: { durum: 'yazildi' }, kaynak: 'astra-os' });
    await expect(yetimTara(girdi(depo, { temizle: true, onay: kod }).g)).rejects.toMatchObject({ kod: 'ONAY_UYUSMADI' });
  });
});

describe('yetimTara: hata yolu', () => {
  it('okuma hatası sonuçta süzülmüş hata olarak döner (canary sızmaz)', async () => {
    const depo = await yetimliDepo();
    const f = yaziciFabrikasi(depo);
    const s = await yetimTara({
      baslangic: BASLANGIC, temizle: false, hedefRef: HEDEF_REF,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: 1, yontem: 'begeniKodlariOku', kod: '42501', ayrinti: `${CANARY_AD} ${CANARY_IBAN}` });
        return y;
      },
    });
    expect(s.hata).toEqual({ kod: '42501', durum: null, tablo: 'begeniler' });
    expect(canaryBul(JSON.stringify(s))).toEqual([]);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
  });

  it('gizleme hatasında temizlenen 0 kalır', async () => {
    const depo = await yetimliDepo();
    const kod = (await yetimTara(girdi(depo).g)).onay_kodu;
    const f = yaziciFabrikasi(depo);
    const s = await yetimTara({
      baslangic: BASLANGIC, temizle: true, onay: kod, hedefRef: HEDEF_REF,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: 1, yontem: 'satirGizle', kod: '40001' });
        return y;
      },
    });
    expect(s).toMatchObject({ temizlenen: 0, yetim: 5 });
    expect(s.hata).toMatchObject({ kod: '40001', tablo: 'begeniler' });
    expect(aktifBegeniler(depo)).toHaveLength(7);
  });
});

describe('yetimTaraSonucuYazdir', () => {
  it('yetim varken kuru taramada onay kodunu bildirir', async () => {
    const depo = await yetimliDepo();
    const s = await yetimTara(girdi(depo).g);
    yakala.satirlar.length = 0;
    yetimTaraSonucuYazdir(s, false);
    expect(yakala.satirlar).toEqual(['SONUC YETIM_TARAMA taranan=5 yetim=5', `BILGI YETIM_ONAY_KODU onay_kodu=${s.onay_kodu}`]);
  });
  it('yetim yoksa onay kodu yazılmaz; temizle kipinde YETIM_TEMIZLENDI yazılır', () => {
    yetimTaraSonucuYazdir({ taranan: 3, yetim: 0, onay_kodu: 'ONAY-yetim-0123456789ab', temizlenen: 0, hata: null }, false);
    expect(yakala.satirlar).toEqual(['SONUC YETIM_TARAMA taranan=3 yetim=0']);
    yakala.satirlar.length = 0;
    yetimTaraSonucuYazdir({ taranan: 6, yetim: 6, onay_kodu: 'ONAY-yetim-0123456789ab', temizlenen: 6, hata: null }, true);
    expect(yakala.satirlar).toEqual(['SONUC YETIM_TARAMA taranan=6 yetim=6', 'SONUC YETIM_TEMIZLENDI temizlenen=6']);
  });
  it('hata varsa YETIM_TARA_DURDU yazılır', () => {
    yetimTaraSonucuYazdir({ taranan: 0, yetim: 0, onay_kodu: '', temizlenen: 0, hata: { kod: '42501', durum: null, tablo: 'begeniler' } }, false);
    expect(yakala.satirlar.at(-1)).toBe('HATA YETIM_TARA_DURDU neden=42501 durum=0 tablo=begeniler');
  });
});

describe('yetimTara: boş depo', () => {
  it('beğeni yoksa sıfır döner', async () => {
    expect(await yetimTara(girdi(bellekDeposuKur()).g)).toMatchObject({ taranan: 0, yetim: 0, hata: null });
  });
});
