import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CANARY_AD, CANARY_IBAN, canaryBul } from '@astra/ortak-test';
import { bellekDeposuKur, type BellekDeposu } from '../yazici/bellek-yazici.ts';
import {
  AKTARIM_1, AKTARIM_2, KULLANICI_ODEME_DEGERI, SABIT_SAAT, ciktiYakala, kullaniciVeriliDepo, sentetikPlanKur, yazCalistir, yaziciFabrikasi, type CiktiYakalayici,
} from '../test-destek.ts';
import { geriAl, geriAlSonucuYazdir, type GeriAlGirdisi } from './geri-al.ts';
import { GERI_ONAY_DESENI } from './geri-al-hesap.ts';
import { KomutHatasi } from './komut-hata.ts';

let yakala: CiktiYakalayici;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => yakala.birak());

const HEDEF_REF = 'abcd1234';

/* Kullanıcı verili depoya plan yazılmış durum: 6 beğeniden 1'i (urun-003) ve 16 anahtardan 1'i (odeme-raporu-v1) SAHİPLENİLİR. */
async function yazilmisDepo(): Promise<BellekDeposu> {
  const depo = kullaniciVeriliDepo();
  const { sonuc } = await yazCalistir(sentetikPlanKur().plan, depo);
  expect(sonuc.hata).toBeNull();
  expect(sonuc.sahiplenilen).toBe(2);
  return depo;
}

function girdi(depo: BellekDeposu, ek: Partial<GeriAlGirdisi> = {}) {
  const f = yaziciFabrikasi(depo);
  const g: GeriAlGirdisi = { aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, yaziciKur: f.fabrika, simdi: () => SABIT_SAAT, ...ek };
  return { g, f };
}
async function kuruKod(depo: BellekDeposu, ek: Partial<GeriAlGirdisi> = {}): Promise<string> {
  const { g } = girdi(depo, ek);
  return (await geriAl(g)).onay_kodu;
}
function yazmaSayisi(f: ReturnType<typeof yaziciFabrikasi>): number {
  const y = f.uretilen[0]!;
  return (['eslesmeEkle', 'eslesmeGuncelle', 'satirEkle', 'satirGizle', 'uygulamaDurumuYaz', 'uygulamaDurumuSil', 'rpcCagir'] as const).reduce((t, m) => t + y.cagriSayisi(m), 0);
}

describe('geriAl: kuru çalıştırma (varsayılan)', () => {
  it.each([[undefined], ['']])('onay %j ise yalnız sayım ve onay kodu verir, hiçbir yazma yapmaz', async (onay) => {
    const depo = await yazilmisDepo();
    const once = JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]]);
    const { g, f } = girdi(depo, { onay });
    const s = await geriAl(g);
    expect(s.kuru).toBe(true);
    expect(s.secilen).toBe(22);
    expect(s.onay_kodu).toMatch(GERI_ONAY_DESENI);
    expect([...s.sayimlar].sort((a, b) => a.hedef_tablo.localeCompare(b.hedef_tablo))).toEqual([
      { hedef_tablo: 'begeniler', yazildi: 5, sahiplenildi: 1 },
      { hedef_tablo: 'uygulama_durumu', yazildi: 15, sahiplenildi: 1 },
    ]);
    expect([s.gizlenen_satir, s.silinen_anahtar, s.gizlenen_eslesme, s.korunan_uygulama_durumu, s.hata]).toEqual([0, 0, 0, 0, null]);
    expect(yazmaSayisi(f)).toBe(0);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
    expect(JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]])).toBe(once);
  });

  it('onay kodu sayıma ve bayrağa bağlıdır; kuru çalıştırmalar aynı kodu verir', async () => {
    const depo = await yazilmisDepo();
    const a = await kuruKod(depo);
    expect(await kuruKod(depo)).toBe(a);
    expect(await kuruKod(depo, { uygulamaDurumlariniSil: true })).not.toBe(a);
    expect(await kuruKod(depo, { hedefRef: 'zzzz9999' })).not.toBe(a);
    expect(await kuruKod(depo, { aktarim: undefined, dalga: 'a' })).not.toBe(a);
    depo.eslesme[0]!.silindi_at = '2026-06-16T00:00:00.000Z';
    expect(await kuruKod(depo)).not.toBe(a);
  });

  it('aktarım ya da dalga süzgeci eşleşmeyi seçmezse seçilen 0 olur', async () => {
    const depo = await yazilmisDepo();
    expect((await geriAl(girdi(depo, { aktarim: AKTARIM_2 }).g)).secilen).toBe(0);
    expect((await geriAl(girdi(depo, { aktarim: undefined, dalga: 'b' }).g)).secilen).toBe(0);
    expect((await geriAl(girdi(depo, { aktarim: undefined, dalga: 'a' }).g)).secilen).toBe(22);
  });
});

describe('geriAl: onay kapısı', () => {
  it.each([['yanlış sabit kod', 'ONAY-geri-000000000000'], ['küçük/büyük harf', 'onay-geri-000000000000'], ['yazma kodu', 'ONAY-a-0123456789ab'], ['boşluklu', ' ONAY-geri-000000000000']])('%s -> ONAY_UYUSMADI ve hiçbir yazma yok', async (_ad, onay) => {
    const depo = await yazilmisDepo();
    const once = JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]]);
    const { g, f } = girdi(depo, { onay });
    await expect(geriAl(g)).rejects.toMatchObject({ name: 'KomutHatasi', kod: 'ONAY_UYUSMADI' });
    expect(yazmaSayisi(f)).toBe(0);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
    expect(JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]])).toBe(once);
  });

  it('bayraksız alınan kod bayraklı çalıştırmada geçmez (ve tersi)', async () => {
    const depo = await yazilmisDepo();
    const bayraksiz = await kuruKod(depo);
    const bayrakli = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    await expect(geriAl(girdi(depo, { uygulamaDurumlariniSil: true, onay: bayraksiz }).g)).rejects.toBeInstanceOf(KomutHatasi);
    await expect(geriAl(girdi(depo, { uygulamaDurumlariniSil: false, onay: bayrakli }).g)).rejects.toBeInstanceOf(KomutHatasi);
  });

  it('desteklenmeyen hedef tablo varsa HİÇ başlamaz (DESTEKLENMEYEN_TABLO)', async () => {
    const depo = await yazilmisDepo();
    depo.eslesme.push({ ...depo.eslesme[0]!, id: 'x1', koleksiyon: 'people', kaynak_id: 'kisi-01', hedef_tablo: 'kisiler', hedef_id: '00000000-0000-4000-8000-0000000000ff', hedef_ref: null });
    const onay = await kuruKod(depo);
    const { g, f } = girdi(depo, { onay });
    await expect(geriAl(g)).rejects.toMatchObject({ kod: 'DESTEKLENMEYEN_TABLO', alanlar: { tablo: 'kisiler' } });
    expect(yazmaSayisi(f)).toBe(0);
  });
});

describe('geriAl: bayraksız (uygulama_durumu korunur)', () => {
  it('yalnız aracın yazdığı beğenileri gizler, sahiplenileni ve kullanıcı satırlarını bırakır; uygulama anahtarlarına dokunmaz', async () => {
    const depo = await yazilmisDepo();
    const onay = await kuruKod(depo);
    const { g, f } = girdi(depo, { onay });
    const s = await geriAl(g);
    expect(s).toMatchObject({ kuru: false, hata: null, gizlenen_satir: 5, silinen_anahtar: 0, gizlenen_eslesme: 6, korunan_uygulama_durumu: 16 });
    const damga = SABIT_SAAT.toISOString();
    const gizli = depo.begeniler.filter((b) => b.silindi_at !== null);
    expect(gizli).toHaveLength(5);
    expect(gizli.every((b) => b.silindi_at === damga)).toBe(true);
    expect(gizli.map((b) => String(b.kod)).sort()).toEqual(['urun-001', 'urun-002', 'urun-004', 'urun-005', 'urun-007']);
    expect(depo.begeniler.find((b) => b.kod === 'urun-003')!.silindi_at).toBeNull(); /* sahiplenilen */
    expect(depo.begeniler.find((b) => b.kod === 'kullanici-baska')!.silindi_at).toBeNull();
    expect(depo.begeniler).toHaveLength(7); /* 2 kullanıcı + 5 aracın yazdığı; fiziksel silme yok */
    /* uygulama_durumu anahtarları duruyor; kullanıcı değeri ezilmedi */
    expect(depo.uygulamaDurumu.get('odeme')!.get('odeme-raporu-v1')).toBe(KULLANICI_ODEME_DEGERI);
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(17);
    expect(f.uretilen[0]!.cagriSayisi('uygulamaDurumuSil')).toBe(0);
    /* eşleşmeler: beğeni eşleşmeleri gizlendi, uygulama eşleşmeleri aktif */
    expect(depo.eslesme.filter((e) => e.hedef_tablo === 'begeniler').every((e) => e.silindi_at === damga)).toBe(true);
    expect(depo.eslesme.filter((e) => e.hedef_tablo === 'uygulama_durumu').every((e) => e.silindi_at === null)).toBe(true);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
  });

  it('eşleşme satırları fiziksel silinmez (aynı satırlar, yalnız silindi_at)', async () => {
    const depo = await yazilmisDepo();
    const idler = depo.eslesme.map((e) => e.id);
    await geriAl(girdi(depo, { onay: await kuruKod(depo) }).g);
    expect(depo.eslesme.map((e) => e.id)).toEqual(idler);
  });

  it('ikinci geri alma seçilen 0 verir (idempotent): yeni kod ile yazma yok', async () => {
    const depo = await yazilmisDepo();
    await geriAl(girdi(depo, { onay: await kuruKod(depo) }).g);
    const kuru = await geriAl(girdi(depo).g);
    expect(kuru.secilen).toBe(16); /* yalnız uygulama eşleşmeleri aktif */
    const bos = await geriAl(girdi(depo, { aktarim: AKTARIM_2 }).g);
    expect(bos.secilen).toBe(0);
  });
});

describe('geriAl: --uygulama-durumlarini-sil', () => {
  it('yalnız aracın yazdığı anahtarları siler; sahiplenilen (kullanıcı) anahtar ve planda olmayan kullanıcı anahtarı kalır', async () => {
    const depo = await yazilmisDepo();
    const onay = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    const { g, f } = girdi(depo, { uygulamaDurumlariniSil: true, onay });
    const s = await geriAl(g);
    expect(s).toMatchObject({ hata: null, gizlenen_satir: 5, silinen_anahtar: 15, gizlenen_eslesme: 22, korunan_uygulama_durumu: 0 });
    expect(depo.uygulamaDurumu.get('odeme')!.get('odeme-raporu-v1')).toBe(KULLANICI_ODEME_DEGERI);
    expect(depo.uygulamaDurumu.get('odeme')!.get('kullanici-ozel')).toBe('KO');
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(2);
    expect(f.uretilen[0]!.cagriSayisi('uygulamaDurumuSil')).toBe(15);
    expect(depo.eslesme.every((e) => e.silindi_at !== null)).toBe(true);
  });

  it('ayraçsız ya da boş hedef_ref silme çağrısı üretmez (boş anahtarla çağrı yapılmaz)', async () => {
    const depo = await yazilmisDepo();
    const yazilan = depo.eslesme.filter((e) => e.hedef_tablo === 'uygulama_durumu' && e.ekstra.durum === 'yazildi');
    yazilan[0]!.hedef_ref = 'ayracsiz';
    yazilan[1]!.hedef_ref = null;
    const onay = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    const { g, f } = girdi(depo, { uygulamaDurumlariniSil: true, onay });
    const s = await geriAl(g);
    expect(s.hata).toBeNull();
    expect(s.silinen_anahtar).toBe(13);
    expect(f.uretilen[0]!.cagriSayisi('uygulamaDurumuSil')).toBe(13);
    expect(s.gizlenen_eslesme).toBe(22); /* eşleşmeler yine de gizlenir */
  });

  it('anahtarı boş hedef_ref ("odeme/") yazıcıda ANAHTAR_BOS ile durur; uygulamanın diğer anahtarları silinmez', async () => {
    const depo = await yazilmisDepo();
    const yazilan = depo.eslesme.filter((e) => e.hedef_tablo === 'uygulama_durumu' && e.ekstra.durum === 'yazildi');
    yazilan[0]!.hedef_ref = 'telrehber/';
    const onay = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    const s = await geriAl(girdi(depo, { uygulamaDurumlariniSil: true, onay }).g);
    expect(s.hata).toMatchObject({ kod: 'ANAHTAR_BOS' });
    expect(depo.uygulamaDurumu.get('odeme')!.get('kullanici-ozel')).toBe('KO');
    expect(depo.uygulamaDurumu.get('telrehber')?.size).toBe(2);
  });
});

describe('geriAl: seçim izin listesidir (yalnız durum === "yazildi" aracın yazdığı sayılır; bilinmeyen durum korunur)', () => {
  const BILINMEYENLER: ReadonlyArray<[string, Record<string, unknown>]> = [
    ['durum alanı yok', {}],
    ['durum null', { durum: null }],
    ['beklenmeyen durum metni', { durum: 'bilinmeyen' }],
    ['büyük harfli YAZILDI', { durum: 'YAZILDI' }],
    ['boşluklu "yazildi "', { durum: 'yazildi ' }],
    ['metin olmayan durum', { durum: 1 }],
  ];

  function yazilmisBegeni(depo: BellekDeposu) {
    return depo.eslesme.find((e) => e.hedef_tablo === 'begeniler' && e.ekstra.durum === 'yazildi')!;
  }
  function yazilmisUygulama(depo: BellekDeposu) {
    return depo.eslesme.find((e) => e.hedef_tablo === 'uygulama_durumu' && e.ekstra.durum === 'yazildi')!;
  }

  it.each(BILINMEYENLER)('%s: sayımda sahiplenildi gibi sayılır (yazildi azalır, sahiplenildi artar), toplam değişmez', async (_ad, ekstra) => {
    const depo = await yazilmisDepo();
    yazilmisBegeni(depo).ekstra = ekstra;
    yazilmisUygulama(depo).ekstra = ekstra;
    const s = await geriAl(girdi(depo).g);
    expect(s.secilen).toBe(22);
    expect([...s.sayimlar].sort((a, b) => a.hedef_tablo.localeCompare(b.hedef_tablo))).toEqual([
      { hedef_tablo: 'begeniler', yazildi: 4, sahiplenildi: 2 },
      { hedef_tablo: 'uygulama_durumu', yazildi: 14, sahiplenildi: 2 },
    ]);
  });

  it.each(BILINMEYENLER)('%s: beğeni satırı gizlenmez (eşleşmesi yine de gizlenir)', async (_ad, ekstra) => {
    const depo = await yazilmisDepo();
    const e = yazilmisBegeni(depo);
    e.ekstra = ekstra;
    const kod = await kuruKod(depo);
    const s = await geriAl(girdi(depo, { onay: kod }).g);
    expect(s.hata).toBeNull();
    expect(s.gizlenen_satir).toBe(4);
    expect(depo.begeniler.find((b) => b.id === e.hedef_id)!.silindi_at).toBeNull();
    expect(depo.begeniler.filter((b) => b.silindi_at !== null)).toHaveLength(4);
    expect(s.gizlenen_eslesme).toBe(6);
  });

  it.each(BILINMEYENLER)('%s: uygulama anahtarı --uygulama-durumlarini-sil ile SİLİNMEZ', async (_ad, ekstra) => {
    const depo = await yazilmisDepo();
    const e = yazilmisUygulama(depo);
    e.ekstra = ekstra;
    const [uygulama, anahtar] = [e.hedef_ref!.slice(0, e.hedef_ref!.indexOf('/')), e.hedef_ref!.slice(e.hedef_ref!.indexOf('/') + 1)];
    const onay = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    const { g, f } = girdi(depo, { uygulamaDurumlariniSil: true, onay });
    const s = await geriAl(g);
    expect(s.hata).toBeNull();
    expect(s.silinen_anahtar).toBe(14);
    expect(f.uretilen[0]!.cagriSayisi('uygulamaDurumuSil')).toBe(14);
    expect(depo.uygulamaDurumu.get(uygulama)!.has(anahtar)).toBe(true);
  });

  it('sayım ile işlem aynı listeden gelir: onay kodundaki sayım gerçekte silinen anahtar sayısına eşittir', async () => {
    const depo = await yazilmisDepo();
    yazilmisUygulama(depo).ekstra = { durum: 'bilinmeyen' };
    const kuru = await geriAl(girdi(depo, { uygulamaDurumlariniSil: true }).g);
    const sayilanYazildi = kuru.sayimlar.find((x) => x.hedef_tablo === 'uygulama_durumu')!.yazildi;
    const s = await geriAl(girdi(depo, { uygulamaDurumlariniSil: true, onay: kuru.onay_kodu }).g);
    expect(s.silinen_anahtar).toBe(sayilanYazildi);
  });

  it('bilinmeyen duruma çevirmek onay kodunu değiştirir (eski kod geçmez)', async () => {
    const depo = await yazilmisDepo();
    const once = await kuruKod(depo);
    yazilmisBegeni(depo).ekstra = {};
    expect(await kuruKod(depo)).not.toBe(once);
    await expect(geriAl(girdi(depo, { onay: once }).g)).rejects.toMatchObject({ kod: 'ONAY_UYUSMADI' });
  });

  it('olumlu: tüm durumlar "yazildi" ise davranış değişmez (5 beğeni gizlenir, 15 anahtar silinir)', async () => {
    const depo = await yazilmisDepo();
    const onay = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    const s = await geriAl(girdi(depo, { uygulamaDurumlariniSil: true, onay }).g);
    expect([s.gizlenen_satir, s.silinen_anahtar]).toEqual([5, 15]);
  });

  it('sınır: hiçbir eşleşmenin durumu "yazildi" değilse hiçbir hedef satıra dokunulmaz', async () => {
    const depo = await yazilmisDepo();
    for (const e of depo.eslesme) e.ekstra = {};
    const onay = await kuruKod(depo, { uygulamaDurumlariniSil: true });
    const { g, f } = girdi(depo, { uygulamaDurumlariniSil: true, onay });
    const s = await geriAl(g);
    expect([s.gizlenen_satir, s.silinen_anahtar, s.hata]).toEqual([0, 0, null]);
    expect(f.uretilen[0]!.cagriSayisi('satirGizle')).toBe(0);
    expect(f.uretilen[0]!.cagriSayisi('uygulamaDurumuSil')).toBe(0);
    expect(depo.begeniler.every((b) => b.silindi_at === null)).toBe(true);
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(17);
  });
});

describe('geriAl: hata yolu', () => {
  it('beğeni gizlerken hata: eşleşmelere HİÇ dokunulmaz (güvenli sıra); canary sızmaz', async () => {
    const depo = await yazilmisDepo();
    const onay = await kuruKod(depo);
    const f = yaziciFabrikasi(depo);
    const s = await geriAl({
      aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, onay, simdi: () => SABIT_SAAT,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: 1, yontem: 'satirGizle', kod: '23505', ayrinti: `${CANARY_AD} ${CANARY_IBAN}` });
        return y;
      },
    });
    expect(s.hata).toEqual({ kod: '23505', durum: null, tablo: 'begeniler' });
    expect(s.gizlenen_eslesme).toBe(0);
    expect(depo.eslesme.every((e) => e.silindi_at === null)).toBe(true);
    expect(canaryBul(JSON.stringify(s))).toEqual([]);
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
  });

  it('eşleşme gizlerken yarıda kesilirse yeniden çalıştırma kalanı tamamlar (yeni onay kodu ile)', async () => {
    const depo = await yazilmisDepo();
    const onay = await kuruKod(depo);
    const f1 = yaziciFabrikasi(depo);
    const yarim = await geriAl({
      aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, onay, simdi: () => SABIT_SAAT,
      yaziciKur: async () => {
        const y = await f1.fabrika();
        y.hataEnjekte({ n: 3, yontem: 'eslesmeGuncelle', kod: '40001' });
        return y;
      },
    });
    expect(yarim.hata).toMatchObject({ kod: '40001', tablo: 'aktarim_eslesme' });
    expect(yarim.gizlenen_eslesme).toBe(2);
    /* sayım değiştiği için eski kod artık geçmez */
    await expect(geriAl(girdi(depo, { onay }).g)).rejects.toMatchObject({ kod: 'ONAY_UYUSMADI' });
    const yeniKod = await kuruKod(depo);
    expect(yeniKod).not.toBe(onay);
    const tam = await geriAl(girdi(depo, { onay: yeniKod }).g);
    expect(tam.hata).toBeNull();
    expect(depo.eslesme.filter((e) => e.hedef_tablo === 'begeniler').every((e) => e.silindi_at !== null)).toBe(true);
    expect(depo.begeniler.filter((b) => b.silindi_at !== null)).toHaveLength(5);
  });

  it('eşleşme okunamazsa hata sonucu döner, yazma yok', async () => {
    const depo = await yazilmisDepo();
    const f = yaziciFabrikasi(depo);
    const s = await geriAl({
      aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, simdi: () => SABIT_SAAT,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: 1, yontem: 'eslesmeOku', kod: '42P01' });
        return y;
      },
    });
    expect(s.hata).toMatchObject({ kod: '42P01', tablo: 'aktarim_eslesme' });
    expect(s.secilen).toBe(0);
  });
});

describe('geriAlSonucuYazdir', () => {
  it('kuru sonuç: sayım satırları + GERI_AL_KURU (seçilen ve onay kodu)', async () => {
    const depo = await yazilmisDepo();
    yakala.satirlar.length = 0;
    const s = await geriAl(girdi(depo).g);
    geriAlSonucuYazdir(s);
    expect(yakala.satirlar).toContain('BILGI GERI_AL_SAYIM tablo=begeniler yazildi=5 sahiplenildi=1');
    expect(yakala.satirlar.at(-1)).toBe(`SONUC GERI_AL_KURU secilen=22 onay_kodu=${s.onay_kodu}`);
  });
  it('gerçek sonuç: GERI_AL_TAMAM sayıları; hata varsa GERI_AL_YARIM + GERI_AL_DURDU', () => {
    yakala.satirlar.length = 0;
    geriAlSonucuYazdir({ kuru: false, secilen: 3, sayimlar: [], onay_kodu: '', gizlenen_satir: 1, silinen_anahtar: 0, gizlenen_eslesme: 2, korunan_uygulama_durumu: 4, hata: null });
    expect(yakala.satirlar).toEqual(['SONUC GERI_AL_TAMAM gizlenen_satir=1 silinen_anahtar=0 gizlenen_eslesme=2 korunan_uygulama_durumu=4']);
    yakala.satirlar.length = 0;
    geriAlSonucuYazdir({ kuru: false, secilen: 3, sayimlar: [], onay_kodu: '', gizlenen_satir: 0, silinen_anahtar: 0, gizlenen_eslesme: 0, korunan_uygulama_durumu: 0, hata: { kod: '40001', durum: null, tablo: 'aktarim_eslesme' } });
    expect(yakala.satirlar[0]).toContain('GERI_AL_YARIM');
    expect(yakala.satirlar[1]).toBe('HATA GERI_AL_DURDU neden=40001 durum=0 tablo=aktarim_eslesme');
  });
});

describe('geriAl: boş depo', () => {
  it('eşleşme yoksa seçilen 0 ve kod yine üretilir', async () => {
    const s = await geriAl(girdi(bellekDeposuKur()).g);
    expect(s.secilen).toBe(0);
    expect(s.onay_kodu).toMatch(GERI_ONAY_DESENI);
  });
});
