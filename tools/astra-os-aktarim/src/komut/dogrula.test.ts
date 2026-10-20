import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANARY_AD, canaryBul } from '@astra/ortak-test';
import { bellekDeposuKur } from '../yazici/bellek-yazici.ts';
import {
  ILGI_BEKLENEN_KURUS, ciktiYakala, kullaniciVeriliDepo, sentetikPlanKur, yazCalistir, yaziciFabrikasi, type CiktiYakalayici,
} from '../test-destek.ts';
import { dogrula, dogrulaSonucuYazdir, farklariBul, type KontrolKalemi } from './dogrula.ts';
import { KomutHatasi } from './komut-hata.ts';

let yakala: CiktiYakalayici;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => yakala.birak());

const kalem = (s: Awaited<ReturnType<typeof dogrula>>, ad: string): KontrolKalemi => s.kontroller.find((k) => k.ad === ad)!;
const bilgiSayisi = (s: Awaited<ReturnType<typeof dogrula>>, ad: string): number | undefined => s.bilgi.find((b) => b.ad === ad)?.sayi;

describe('farklariBul', () => {
  it('yalnız kaynak ≠ hedef olan kalemleri döndürür', () => {
    expect(farklariBul([{ ad: 'a', kaynak: 1, hedef: 1 }, { ad: 'b', kaynak: 2, hedef: 3 }, { ad: 'c', kaynak: 0, hedef: 0 }])).toEqual([{ ad: 'b', kaynak: 2, hedef: 3 }]);
    expect(farklariBul([])).toEqual([]);
  });
});

describe('dogrula', () => {
  it('yazılmamış hedefte tüm kalemler fark verir (hedef 0), kaynak kuruş toplamı bağımsız beklentiyle eşittir', async () => {
    const { plan } = sentetikPlanKur();
    const f = yaziciFabrikasi(bellekDeposuKur());
    const s = await dogrula({ plan, yaziciKur: f.fabrika });
    expect(s.farklar.map((k) => k.ad).sort()).toEqual(['aktarim_eslesme_begeniler', 'aktarim_eslesme_uygulama_durumu', 'begeniler_fiyat_kurus', 'begeniler_satir', 'uygulama_durumu_anahtar']);
    expect(s.kontroller).toEqual([
      { ad: 'uygulama_durumu_anahtar', kaynak: 16, hedef: 0 },
      { ad: 'aktarim_eslesme_uygulama_durumu', kaynak: 16, hedef: 0 },
      { ad: 'begeniler_satir', kaynak: 6, hedef: 0 },
      { ad: 'aktarim_eslesme_begeniler', kaynak: 6, hedef: 0 },
      { ad: 'begeniler_fiyat_kurus', kaynak: ILGI_BEKLENEN_KURUS, hedef: 0 },
    ]);
    expect(bilgiSayisi(s, 'eslesme_dalga_a')).toBe(0);
    expect(bilgiSayisi(s, 'plan_atlanan')).toBe(2);
  });

  it('yazma sonrası tüm kalemler eşittir; kuruş toplamı kaynak = hedef = bağımsız beklenti', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.farklar).toEqual([]);
    expect(kalem(s, 'begeniler_fiyat_kurus')).toEqual({ ad: 'begeniler_fiyat_kurus', kaynak: ILGI_BEKLENEN_KURUS, hedef: ILGI_BEKLENEN_KURUS });
    expect(bilgiSayisi(s, 'begeniler_kodlu')).toBe(6);
    expect(bilgiSayisi(s, 'eslesme_dalga_a')).toBe(22);
    expect(bilgiSayisi(s, 'eslesme_tablo_begeniler')).toBe(6);
    expect(bilgiSayisi(s, 'eslesme_tablo_uygulama_durumu')).toBe(16);
    expect(bilgiSayisi(s, 'uygulama_anahtar_odeme')).toBe(1);
  });

  it('hedefte bir beğenin fiyatı bozulursa fiyat farkı kuruş cinsinden görünür (fark = hedef − kaynak)', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    depo.begeniler.find((b) => b.kod === 'urun-004')!.fiyat = 250.01;
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.farklar).toEqual([{ ad: 'begeniler_fiyat_kurus', kaynak: ILGI_BEKLENEN_KURUS, hedef: ILGI_BEKLENEN_KURUS + 1 }]);
  });

  it('hedefte uygulama anahtarı silinirse anahtar kalemi fark verir', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    depo.uygulamaDurumu.get('telrehber')!.delete('tr-fav');
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.farklar).toEqual([{ ad: 'uygulama_durumu_anahtar', kaynak: 16, hedef: 15 }]);
  });

  it('hedefte beğeni gizlenirse (silinirse) satır ve fiyat farkı görünür', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    depo.begeniler.find((b) => b.kod === 'urun-002')!.silindi_at = '2026-06-16T00:00:00.000Z';
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.farklar.map((k) => k.ad).sort()).toEqual(['begeniler_fiyat_kurus', 'begeniler_satir']);
    expect(kalem(s, 'begeniler_fiyat_kurus').hedef).toBe(ILGI_BEKLENEN_KURUS - 123450);
  });

  it('sahiplenilen beğeni kuruş toplamına girmez (hedef satır değiştirilmediği için); kontrol yine eşit çıkar', async () => {
    const { plan } = sentetikPlanKur();
    const depo = kullaniciVeriliDepo();
    await yazCalistir(plan, depo);
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.farklar).toEqual([]);
    /* urun-003 (0.13 → 13 kuruş) sahiplenildi: kaynak toplamdan düşer */
    expect(kalem(s, 'begeniler_fiyat_kurus')).toEqual({ ad: 'begeniler_fiyat_kurus', kaynak: ILGI_BEKLENEN_KURUS - 13, hedef: ILGI_BEKLENEN_KURUS - 13 });
    expect(kalem(s, 'begeniler_satir')).toEqual({ ad: 'begeniler_satir', kaynak: 6, hedef: 6 });
  });

  it('geri alınmış (silinmiş) eşleşmeler eşleşme kalemlerinde sayılmaz', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    for (const e of depo.eslesme.filter((x) => x.hedef_tablo === 'begeniler')) e.silindi_at = '2026-06-16T00:00:00.000Z';
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(kalem(s, 'aktarim_eslesme_begeniler')).toEqual({ ad: 'aktarim_eslesme_begeniler', kaynak: 6, hedef: 0 });
    expect(bilgiSayisi(s, 'eslesme_dalga_a')).toBe(16);
  });

  it('salt okunurdur: hiçbir yazma/silme çağrısı yapmaz ve yazıcıyı kapatır', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    const once = JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]]);
    const f = yaziciFabrikasi(depo);
    await dogrula({ plan, yaziciKur: f.fabrika });
    const y = f.uretilen[0]!;
    for (const yontem of ['eslesmeEkle', 'eslesmeGuncelle', 'satirEkle', 'satirGizle', 'uygulamaDurumuYaz', 'uygulamaDurumuSil', 'rpcCagir'] as const) expect(y.cagriSayisi(yontem), yontem).toBe(0);
    expect(y.kapatildiMi()).toBe(true);
    expect(JSON.stringify([depo.begeniler, depo.eslesme, [...depo.uygulamaDurumu]])).toBe(once);
  });

  it('dalga b için DALGA_YAZICI_YOK verir ve yazıcı kurulmaz', async () => {
    const { plan } = sentetikPlanKur({ dalga: 'b' });
    const fabrika = vi.fn();
    await expect(dogrula({ plan, yaziciKur: fabrika })).rejects.toBeInstanceOf(KomutHatasi);
    await expect(dogrula({ plan, yaziciKur: fabrika })).rejects.toMatchObject({ kod: 'DALGA_YAZICI_YOK' });
    expect(fabrika).not.toHaveBeenCalled();
  });

  it('okuma hatasında fırlatır ama yazıcıyı yine kapatır', async () => {
    const { plan } = sentetikPlanKur();
    const f = yaziciFabrikasi(bellekDeposuKur());
    await expect(
      dogrula({
        plan,
        yaziciKur: async () => {
          const y = await f.fabrika();
          y.hataEnjekte({ n: 1, yontem: 'eslesmeOku', kod: '42P01', ayrinti: CANARY_AD });
          return y;
        },
      }),
    ).rejects.toMatchObject({ kod: '42P01' });
    expect(f.uretilen[0]!.kapatildiMi()).toBe(true);
  });
});

describe('dogrulaSonucuYazdir', () => {
  it('eşit kalemleri SONUC ESIT, farkları FARK FARK_VAR (fark = hedef − kaynak) yazar; sonuç satırı fark sayısını verir', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    depo.begeniler.find((b) => b.kod === 'urun-004')!.fiyat = 250.01;
    yakala.satirlar.length = 0;
    dogrulaSonucuYazdir(await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika }));
    const m = yakala.satirlar;
    expect(m).toContain('SONUC ESIT kontrol=uygulama_durumu_anahtar kaynak=16 hedef=16 fark=0');
    expect(m).toContain(`FARK FARK_VAR kontrol=begeniler_fiyat_kurus kaynak=${ILGI_BEKLENEN_KURUS} hedef=${ILGI_BEKLENEN_KURUS + 1} fark=1`);
    expect(m.at(-1)).toBe('FARK DOGRULAMA_FARKI fark_sayisi=1');
    expect(m).toContain('BILGI SAYIM ad=plan_atlanan sayi=2');
    expect(canaryBul(m.join('\n'))).toEqual([]);
  });

  it('fark yoksa DOGRULAMA_TAMAM yazar', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    yakala.satirlar.length = 0;
    dogrulaSonucuYazdir(await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika }));
    expect(yakala.satirlar.at(-1)).toBe('SONUC DOGRULAMA_TAMAM fark_sayisi=0');
    expect(yakala.satirlar.some((x) => x.startsWith('FARK'))).toBe(false);
  });
});
