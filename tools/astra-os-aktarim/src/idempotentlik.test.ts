/* İDEMPOTENTLİK (kritik): `bellek-yazici` kalıcı mağaza simüle eder. Aynı depoya yeni yazıcı bağlamak "yeniden çalıştırma" demektir.
   Dalga b/c (kişi, icra, IBAN, dava) yazıcı yöntemleri henüz yok: eski_id'li icra sahiplenmesi ve belirsiz kişi senaryoları T8/T10 sonrası eklenecek;
   aynı sözleşme (sahiplenme/belirsiz/yetim) burada `begeniler.kod` ve `uygulama_durumu` anahtarı üzerinden sınanır. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bellekDeposuKur, type BellekDeposu } from './yazici/bellek-yazici.ts';
import { geriAl } from './komut/geri-al.ts';
import { yetimTara } from './komut/yetim-tara.ts';
import { dogrula } from './komut/dogrula.ts';
import {
  AKTARIM_1, AKTARIM_2, KULLANICI_ODEME_DEGERI, SABIT_SAAT, ciktiYakala, kullaniciVeriliDepo, sentetikPlanKur, yazCalistir, yaziciFabrikasi, type CiktiYakalayici,
} from './test-destek.ts';

let yakala: CiktiYakalayici;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => yakala.birak());

const HEDEF_REF = 'abcd1234';
const { plan } = sentetikPlanKur();
const UYG_SAYISI = 16;
const BEGENI_SAYISI = 6;

type Durum = { uyg: string; aktifBegeniler: string[]; aktifEslesme: string[]; ciftBegeni: string[]; ciftEslesme: string[] };

/* Depoyu karşılaştırılabilir özete çevirir (kimlikler ve zaman damgaları dışarıda). */
function durum(depo: BellekDeposu): Durum {
  const aktif = depo.begeniler.filter((b) => b.silindi_at === null);
  const kodSayilari = new Map<string, number>();
  for (const b of aktif) kodSayilari.set(String(b.kod), (kodSayilari.get(String(b.kod)) ?? 0) + 1);
  const eslesmeSayilari = new Map<string, number>();
  for (const e of depo.eslesme) eslesmeSayilari.set(`${e.koleksiyon}|${e.kaynak_id}`, (eslesmeSayilari.get(`${e.koleksiyon}|${e.kaynak_id}`) ?? 0) + 1);
  return {
    uyg: JSON.stringify([...depo.uygulamaDurumu].map(([u, m]) => [u, [...m].sort()]).sort()),
    aktifBegeniler: aktif.map((b) => `${String(b.kod)}|${String(b.ad)}|${String(b.fiyat)}`).sort(),
    aktifEslesme: depo.eslesme.filter((e) => e.silindi_at === null).map((e) => `${e.koleksiyon}|${e.kaynak_id}|${e.hedef_tablo}`).sort(),
    ciftBegeni: [...kodSayilari].filter(([, n]) => n > 1).map(([k]) => k),
    ciftEslesme: [...eslesmeSayilari].filter(([, n]) => n > 1).map(([k]) => k),
  };
}

async function kontrolDurumu(): Promise<Durum> {
  const depo = bellekDeposuKur();
  await yazCalistir(plan, depo);
  return durum(depo);
}

describe('(1) iki kez yaz: ikincisinde yeni = 0', () => {
  it('ikinci çalıştırma hiçbir satır yazmaz, tüm kayıtları TEKRAR_ESLESME olarak atlar', async () => {
    const depo = bellekDeposuKur();
    const ilk = await yazCalistir(plan, depo);
    expect(ilk.sonuc.yazilan).toEqual([{ tablo: 'begeniler', sayi: BEGENI_SAYISI }, { tablo: 'uygulama_durumu', sayi: UYG_SAYISI }]);
    const once = durum(depo);
    const onceHam = JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu].map(([u, m]) => [u, [...m]])]);

    const ikinci = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(ikinci.sonuc).toMatchObject({ yazilan: [], sahiplenilen: 0, atlanan_eslesme: BEGENI_SAYISI + UYG_SAYISI, belirsiz: 0, eslesme_yazilan: 0, yetim_olabilir: 0, hata: null });
    for (const m of ['satirEkle', 'uygulamaDurumuYaz', 'eslesmeEkle', 'eslesmeGuncelle', 'satirGizle', 'uygulamaDurumuSil'] as const) expect(ikinci.yazici.cagriSayisi(m), m).toBe(0);
    expect(durum(depo)).toEqual(once);
    expect(JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu].map(([u, m]) => [u, [...m]])])).toBe(onceHam);
  });

  it('beş kez art arda yazmak durumu değiştirmez; eşleşme ve beğeni çiftlenmez', async () => {
    const depo = bellekDeposuKur();
    for (let i = 0; i < 5; i++) await yazCalistir(plan, depo, { aktarimId: `33333333-3333-4333-8333-00000000000${i}` });
    const d = durum(depo);
    expect(d.ciftBegeni).toEqual([]);
    expect(d.ciftEslesme).toEqual([]);
    expect(d.aktifEslesme).toHaveLength(UYG_SAYISI + BEGENI_SAYISI);
    expect(depo.begeniler).toHaveLength(BEGENI_SAYISI);
    expect(depo.eslesme.every((e) => e.aktarim_id === AKTARIM_1 || e.aktarim_id.endsWith('0'))).toBe(true);
  });

  it('ikinci yaz sonrası dogrula farksızdır', async () => {
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    await yazCalistir(plan, depo);
    expect((await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika })).farklar).toEqual([]);
  });
});

describe('(2) yazma yarıda kesilir → yeniden çalıştırma yalnız eksikleri yazar', () => {
  it('N. yazıcı çağrısında hata (N = 1…60): yeniden çalıştırma her seferinde kontrol çalıştırmasıyla AYNI duruma varır, çift satır yok', async () => {
    const kontrol = await kontrolDurumu();
    let hataliCalisma = 0;
    let yetimGorulen = 0;
    let temizCalisma = 0;
    for (let n = 1; n <= 60; n++) {
      const depo = bellekDeposuKur();
      const f = yaziciFabrikasi(depo);
      let ilkSonuc: Awaited<ReturnType<typeof yazCalistir>>['sonuc'] | null = null;
      try {
        const { yaz } = await import('./komut/yaz.ts');
        ilkSonuc = await yaz({
          plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1,
          yaziciKur: async () => {
            const y = await f.fabrika();
            y.hataEnjekte({ n, kod: '57014', ayrinti: 'sahte kesinti' });
            return y;
          },
        });
      } catch {
        /* kapat() çağrısında kesinti: yazma tamamlanmış sayılır; yeniden çalıştırma yine tutarlı olmalı */
      }
      if (ilkSonuc?.hata) hataliCalisma++;
      else temizCalisma++;
      if ((ilkSonuc?.yetim_olabilir ?? 0) > 0) yetimGorulen++;

      const ikinci = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
      expect(ikinci.sonuc.hata, `n=${n}`).toBeNull();
      const d = durum(depo);
      expect(d.ciftBegeni, `n=${n} çift beğeni`).toEqual([]);
      expect(d.ciftEslesme, `n=${n} çift eşleşme`).toEqual([]);
      expect(d, `n=${n}`).toEqual(kontrol);
      /* ve üçüncü çalıştırma artık hiçbir şey yazmaz */
      const ucuncu = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
      expect(ucuncu.sonuc.yazilan, `n=${n} üçüncü`).toEqual([]);
      expect(ucuncu.sonuc.sahiplenilen, `n=${n} üçüncü`).toBe(0);
    }
    expect(hataliCalisma).toBeGreaterThan(30); /* kesintiler gerçekten tetiklendi */
    expect(temizCalisma).toBeGreaterThan(0); /* çağrı sayısını aşan N kesintisiz tamamlanır */
    expect(yetimGorulen).toBeGreaterThan(0); /* R-3 penceresi (satır var, eşleşme yok) en az bir N'de yaşandı */
  });

  it('yetim bırakan kesintide yeniden çalıştırma yetim satırı SAHİPLENİR (çift yazmaz, değeri ezmez)', async () => {
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const { yaz } = await import('./komut/yaz.ts');
    const yarim = await yaz({
      plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: UYG_SAYISI + 1, yontem: 'eslesmeEkle', kod: '57014' });
        return y;
      },
    });
    expect(yarim.hata).toMatchObject({ kod: '57014', tablo: 'aktarim_eslesme' });
    expect(yarim.yetim_olabilir).toBe(BEGENI_SAYISI);
    expect(depo.begeniler).toHaveLength(BEGENI_SAYISI);
    expect(depo.eslesme).toHaveLength(UYG_SAYISI);

    const tekrar = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(tekrar.sonuc).toMatchObject({ yazilan: [], sahiplenilen: BEGENI_SAYISI, atlanan_eslesme: UYG_SAYISI, hata: null });
    expect(depo.begeniler).toHaveLength(BEGENI_SAYISI);
    const yeniEslesmeler = depo.eslesme.filter((e) => e.hedef_tablo === 'begeniler');
    expect(yeniEslesmeler).toHaveLength(BEGENI_SAYISI);
    expect(yeniEslesmeler.every((e) => e.ekstra.durum === 'sahiplenildi' && e.hedef_id !== null)).toBe(true);
    const idler = new Set(depo.begeniler.map((b) => b.id));
    expect(yeniEslesmeler.every((e) => idler.has(e.hedef_id!))).toBe(true);
  });

  it('uygulama anahtarı yazıldı ama eşleşmesi yazılamadıysa yeniden çalıştırma anahtarı SAHİPLENİR, değeri değişmez', async () => {
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const { yaz } = await import('./komut/yaz.ts');
    await yaz({
      plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: 3, yontem: 'eslesmeEkle', kod: '57014' });
        return y;
      },
    });
    const yazilan = [...depo.uygulamaDurumu].flatMap(([u, m]) => [...m].map(([a, d]) => `${u}/${a}=${d}`)).sort();
    expect(yazilan).toHaveLength(3); /* 3. anahtar yazıldı, eşleşmesi yok */
    const tekrar = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(tekrar.sonuc.sahiplenilen).toBe(1);
    expect(tekrar.sonuc.yazilan.find((y) => y.tablo === 'uygulama_durumu')?.sayi).toBe(UYG_SAYISI - 3);
    const sonra = [...depo.uygulamaDurumu].flatMap(([u, m]) => [...m].map(([a, d]) => `${u}/${a}=${d}`)).sort();
    expect(sonra).toHaveLength(UYG_SAYISI);
    for (const satir of yazilan) expect(sonra).toContain(satir);
  });
});

describe('(3)-(5) sahiplenme ve belirsizlik', () => {
  it('(4) hedefteki mevcut uygulama_durumu anahtarı EZİLMEZ (sahiplenilir); kullanıcının planda olmayan anahtarı da korunur', async () => {
    const depo = kullaniciVeriliDepo();
    const { sonuc, yazici } = await yazCalistir(plan, depo);
    expect(sonuc).toMatchObject({ hata: null, sahiplenilen: 2 });
    expect(depo.uygulamaDurumu.get('odeme')!.get('odeme-raporu-v1')).toBe(KULLANICI_ODEME_DEGERI);
    expect(depo.uygulamaDurumu.get('odeme')!.get('kullanici-ozel')).toBe('KO');
    expect(yazici.cagriSayisi('uygulamaDurumuYaz')).toBe(UYG_SAYISI - 1);
    const e = depo.eslesme.find((x) => x.kaynak_id === 'odeme/odeme-raporu-v1')!;
    expect(e).toMatchObject({ hedef_id: null, hedef_ref: 'odeme/odeme-raporu-v1', ekstra: { durum: 'sahiplenildi' } });
    /* ikinci çalıştırmada da ezilmez */
    await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(depo.uygulamaDurumu.get('odeme')!.get('odeme-raporu-v1')).toBe(KULLANICI_ODEME_DEGERI);
  });

  it('hedefte aynı kodlu tek beğeni varsa sahiplenilir: çift satır YOK, mevcut satır DEĞİŞMEZ', async () => {
    const depo = kullaniciVeriliDepo();
    const once = JSON.stringify(depo.begeniler.find((b) => b.kod === 'urun-003'));
    await yazCalistir(plan, depo);
    expect(depo.begeniler.filter((b) => b.kod === 'urun-003')).toHaveLength(1);
    expect(JSON.stringify(depo.begeniler.find((b) => b.kod === 'urun-003'))).toBe(once);
    expect(depo.begeniler.find((b) => b.kod === 'urun-003')).toMatchObject({ ad: 'Kullanici Urun', fiyat: 5 });
    const e = depo.eslesme.find((x) => x.kaynak_id === 'urun-003')!;
    expect(e.ekstra.durum).toBe('sahiplenildi');
    expect(e.hedef_id).toBe(depo.begeniler.find((b) => b.kod === 'urun-003')!.id);
  });

  it('(5) belirsiz (iki aday): otomatik birleştirme YOK — yazılmaz, eşleşme oluşmaz, her çalıştırmada belirsiz sayılır', async () => {
    const depo = bellekDeposuKur({ begeniler: [{ kod: 'urun-003', ad: 'Aday 1' }, { kod: 'urun-003', ad: 'Aday 2' }] });
    const ilk = await yazCalistir(plan, depo);
    expect(ilk.sonuc).toMatchObject({ belirsiz: 1, sahiplenilen: 0, hata: null });
    expect(ilk.sonuc.yazilan.find((y) => y.tablo === 'begeniler')?.sayi).toBe(BEGENI_SAYISI - 1);
    expect(depo.begeniler.filter((b) => b.kod === 'urun-003').map((b) => b.ad)).toEqual(['Aday 1', 'Aday 2']);
    expect(depo.eslesme.some((e) => e.kaynak_id === 'urun-003')).toBe(false);
    const ikinci = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(ikinci.sonuc).toMatchObject({ belirsiz: 1, yazilan: [], hata: null });
    expect(depo.begeniler.filter((b) => b.kod === 'urun-003')).toHaveLength(2);
  });

  it('kullanıcının silinmiş (gizlenmiş) aynı kodlu beğenisi çakışma sayılmaz: yeni satır yazılır', async () => {
    const depo = kullaniciVeriliDepo();
    depo.begeniler.find((b) => b.kod === 'urun-003')!.silindi_at = '2026-02-01T00:00:00.000Z';
    const { sonuc } = await yazCalistir(plan, depo);
    expect(sonuc.hata).toBeNull();
    expect(sonuc.sahiplenilen).toBe(1); /* yalnız odeme-raporu-v1 */
    expect(depo.begeniler.filter((b) => b.kod === 'urun-003' && b.silindi_at === null)).toHaveLength(1);
  });
});

describe('(6)-(7) geri-al ile yaz döngüsü', () => {
  async function geriAlOnayli(depo: BellekDeposu, aktarim: string, bayrak = false) {
    const f1 = yaziciFabrikasi(depo);
    const kuru = await geriAl({ aktarim, uygulamaDurumlariniSil: bayrak, hedefRef: HEDEF_REF, yaziciKur: f1.fabrika, simdi: () => SABIT_SAAT });
    const f2 = yaziciFabrikasi(depo);
    const sonuc = await geriAl({ aktarim, uygulamaDurumlariniSil: bayrak, onay: kuru.onay_kodu, hedefRef: HEDEF_REF, yaziciKur: f2.fabrika, simdi: () => SABIT_SAAT });
    return { sonuc, yazici: f2.uretilen[0]! };
  }

  it('(6) geri-al sonrası yaz beğenileri yeniden oluşturur; eşleşme satırları GÜNCELLENİR (çiftlenmez), uygulama anahtarları atlanır', async () => {
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo, { aktarimId: AKTARIM_1 });
    const eslesmeIdleri = depo.eslesme.map((e) => e.id).sort();
    const { sonuc: geri } = await geriAlOnayli(depo, AKTARIM_1);
    expect(geri).toMatchObject({ hata: null, gizlenen_satir: BEGENI_SAYISI, silinen_anahtar: 0, korunan_uygulama_durumu: UYG_SAYISI });
    expect(depo.begeniler.filter((b) => b.silindi_at === null)).toHaveLength(0);

    const tekrar = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(tekrar.sonuc).toMatchObject({ hata: null, sahiplenilen: 0, atlanan_eslesme: UYG_SAYISI, eslesme_yazilan: BEGENI_SAYISI });
    expect(tekrar.sonuc.yazilan).toEqual([{ tablo: 'begeniler', sayi: BEGENI_SAYISI }]);
    expect(tekrar.yazici.cagriSayisi('uygulamaDurumuYaz')).toBe(0);
    expect(tekrar.yazici.cagriSayisi('eslesmeEkle')).toBe(0); /* yalnız güncelleme */
    expect(tekrar.yazici.cagriSayisi('eslesmeGuncelle')).toBe(BEGENI_SAYISI);

    expect(depo.eslesme.map((e) => e.id).sort()).toEqual(eslesmeIdleri); /* aynı satırlar */
    const aktifBegeniler = depo.begeniler.filter((b) => b.silindi_at === null);
    expect(aktifBegeniler).toHaveLength(BEGENI_SAYISI);
    expect(depo.begeniler).toHaveLength(BEGENI_SAYISI * 2); /* eskiler gizli duruyor, fiziksel silme yok */
    const begeniEslesmeleri = depo.eslesme.filter((e) => e.hedef_tablo === 'begeniler');
    expect(begeniEslesmeleri.every((e) => e.silindi_at === null && e.aktarim_id === AKTARIM_2)).toBe(true);
    expect(new Set(begeniEslesmeleri.map((e) => e.hedef_id))).toEqual(new Set(aktifBegeniler.map((b) => b.id)));
    expect(durum(depo).ciftBegeni).toEqual([]);
    expect((await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika })).farklar).toEqual([]);
  });

  it('(7) geri-al uygulama_durumu\'nu bayraksız SİLMEZ', async () => {
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    const { sonuc, yazici } = await geriAlOnayli(depo, AKTARIM_1, false);
    expect(sonuc.silinen_anahtar).toBe(0);
    expect(yazici.cagriSayisi('uygulamaDurumuSil')).toBe(0);
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(UYG_SAYISI);
    expect(depo.eslesme.filter((e) => e.hedef_tablo === 'uygulama_durumu').every((e) => e.silindi_at === null)).toBe(true);
  });

  it('--uygulama-durumlarini-sil yalnız aracın yazdıklarını siler; sonra yaz hepsini yeniden yazar', async () => {
    const depo = kullaniciVeriliDepo();
    await yazCalistir(plan, depo, { aktarimId: AKTARIM_1 });
    const { sonuc } = await geriAlOnayli(depo, AKTARIM_1, true);
    expect(sonuc.silinen_anahtar).toBe(UYG_SAYISI - 1);
    expect(depo.uygulamaDurumu.get('odeme')!.get('odeme-raporu-v1')).toBe(KULLANICI_ODEME_DEGERI);
    expect(depo.uygulamaDurumu.get('odeme')!.get('kullanici-ozel')).toBe('KO');
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(2);

    const tekrar = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(tekrar.sonuc.hata).toBeNull();
    /* sahiplenilenler (odeme-raporu-v1, urun-003) bu kez de sahiplenilir; geri kalanlar yeniden yazılır */
    expect(tekrar.yazici.cagriSayisi('uygulamaDurumuYaz')).toBe(UYG_SAYISI - 1);
    expect(tekrar.sonuc.yazilan.find((y) => y.tablo === 'begeniler')?.sayi).toBe(BEGENI_SAYISI - 1);
    expect(depo.uygulamaDurumu.get('odeme')!.get('odeme-raporu-v1')).toBe(KULLANICI_ODEME_DEGERI);
    expect(durum(depo).ciftEslesme).toEqual([]);
    expect((await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika })).farklar).toEqual([]);
  });

  it('geri-al yarıda kesilir (N. yazıcı çağrısında) → yeniden geri-al + yaz sonunda tutarlı durum', async () => {
    const kontrol = await kontrolDurumu();
    for (let n = 3; n <= 20; n++) {
      const depo = bellekDeposuKur();
      await yazCalistir(plan, depo, { aktarimId: AKTARIM_1 });
      const f0 = yaziciFabrikasi(depo);
      const kuru = await geriAl({ aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, yaziciKur: f0.fabrika, simdi: () => SABIT_SAAT });
      const f1 = yaziciFabrikasi(depo);
      try {
        await geriAl({
          aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, onay: kuru.onay_kodu, hedefRef: HEDEF_REF, simdi: () => SABIT_SAAT,
          yaziciKur: async () => {
            const y = await f1.fabrika();
            y.hataEnjekte({ n, kod: '40001' });
            return y;
          },
        });
      } catch {
        /* kapat() çağrısına denk gelen kesinti (gerçek yazıcıda kapat hatayı yutar): iş yarım kalmış sayılır */
      }
      /* kalan eşleşmeler için yeniden geri-al (sayım değiştiği için yeni kod) */
      const k2 = await geriAl({ aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika, simdi: () => SABIT_SAAT });
      await geriAl({ aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, onay: k2.onay_kodu, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika, simdi: () => SABIT_SAAT });
      const son = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
      expect(son.sonuc.hata, `n=${n}`).toBeNull();
      expect(durum(depo), `n=${n}`).toEqual(kontrol);
    }
  });
});

describe('yetim-tara (satır var, eşleşme yok) ve --yetim-temizle zorunlulukları', () => {
  it('yetim bulur, onaysız temizlemez, onayla temizler; sonra yeniden yazma tutarlı duruma getirir', async () => {
    const kontrol = await kontrolDurumu();
    const depo = bellekDeposuKur();
    const f = yaziciFabrikasi(depo);
    const { yaz } = await import('./komut/yaz.ts');
    await yaz({
      plan, onay: plan.onay_kodu, aktarimId: AKTARIM_1,
      yaziciKur: async () => {
        const y = await f.fabrika();
        y.hataEnjekte({ n: UYG_SAYISI + 1, yontem: 'eslesmeEkle', kod: '57014' });
        return y;
      },
    });
    const baslangic = '2026-06-01T00:00:00Z';
    const tara = await yetimTara({ baslangic, temizle: false, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(tara).toMatchObject({ taranan: BEGENI_SAYISI, yetim: BEGENI_SAYISI, hata: null });

    await expect(yetimTara({ baslangic, temizle: true, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika })).rejects.toMatchObject({ kod: 'ONAY_UYUSMADI' });
    expect(depo.begeniler.every((b) => b.silindi_at === null)).toBe(true);

    const temiz = await yetimTara({ baslangic, temizle: true, onay: tara.onay_kodu, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(temiz.temizlenen).toBe(BEGENI_SAYISI);

    const son = await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    expect(son.sonuc.hata).toBeNull();
    expect(son.sonuc.sahiplenilen).toBe(0);
    expect(durum(depo)).toEqual(kontrol);
  });

  it('başarılı yazmadan sonra yetim yoktur; geri alınmış (gizlenmiş) satırlar yetim sayılmaz', async () => {
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    expect(await yetimTara({ temizle: false, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika })).toMatchObject({ yetim: 0 });
    const f = yaziciFabrikasi(depo);
    const kuru = await geriAl({ aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, hedefRef: HEDEF_REF, yaziciKur: f.fabrika, simdi: () => SABIT_SAAT });
    await geriAl({ aktarim: AKTARIM_1, uygulamaDurumlariniSil: false, onay: kuru.onay_kodu, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika, simdi: () => SABIT_SAAT });
    expect(await yetimTara({ temizle: false, hedefRef: HEDEF_REF, yaziciKur: yaziciFabrikasi(depo).fabrika })).toMatchObject({ taranan: 0, yetim: 0 });
  });
});

describe('eşleşme tablosu değişmezleri (her senaryo sonunda)', () => {
  it('(koleksiyon, kaynak_id) tekildir; tüm eşleşmeler dalga a ve kaynak astra-os; hedef_id ya da hedef_ref doludur', async () => {
    const depo = kullaniciVeriliDepo();
    await yazCalistir(plan, depo);
    await yazCalistir(plan, depo, { aktarimId: AKTARIM_2 });
    for (const e of depo.eslesme) {
      expect([e.dalga, e.kaynak]).toEqual(['a', 'astra-os']);
      expect(e.hedef_id !== null || e.hedef_ref !== null).toBe(true);
      expect(['yazildi', 'sahiplenildi']).toContain(e.ekstra.durum);
    }
    expect(durum(depo).ciftEslesme).toEqual([]);
  });
});
