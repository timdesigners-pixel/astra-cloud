/* KONTROL TOPLAMI: kaynak Σkuruş = hedef Σkuruş − atlanan. Dalga a'da toplanan tutar `begeniler.fiyat`'tır (TRY varsayımı).
   Dalga b/c (borç, gelir, gider, icra) tutar dönüştürücüleri henüz yazılmadığı için onların kontrol toplamı T8/T10 sonrası eklenecek;
   TRY dışı para birimi / bahis negatifi için saf kuruş yardımcıları `donusum/sayi-hesap.test.ts` içinde sınanır. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { calistir } from './cli.ts';
import { ilgiDonustur } from './donusum/ilgi-hesap.ts';
import { kurusToplami } from './donusum/sayi-hesap.ts';
import { dogrula } from './komut/dogrula.ts';
import { bellekDeposuKur } from './yazici/bellek-yazici.ts';
import { ILGI_BEKLENEN_KURUS, ciktiYakala, ilgiUrunleri, sahteBagimlilik, sentetikPlanKur, yazCalistir, yaziciFabrikasi, type CiktiYakalayici } from './test-destek.ts';

let yakala: CiktiYakalayici;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => yakala.birak());

/* Bağımsız beklenti: ham ürün fiyatlarının (metin/sayı) elle hesaplanmış kuruşları. */
const HAM_KURUS = { 'urun-001': 101, 'urun-002': 123450, 'urun-003': 13, 'urun-004': 25000, 'urun-005': 0, 'urun-006': 99900, 'urun-001-tekrar': 11100, 'urun-007': 0 } as const;
const ATLANAN_KURUS = HAM_KURUS['urun-006'] + HAM_KURUS['urun-001-tekrar']; /* AD_BOS + KOD_TEKRAR ürünleri planlanmaz */
const HAM_TOPLAM = (Object.values(HAM_KURUS) as number[]).reduce((t, k) => t + k, 0); /* geçersiz tutarlı urun-007 (−5) hiçbir toplamda yok */

describe('kaynak Σkuruş = hedef Σkuruş − atlanan', () => {
  it('ham toplam − atlanan = plan toplamı = bağımsız beklenti', () => {
    expect(HAM_TOPLAM - ATLANAN_KURUS).toBe(ILGI_BEKLENEN_KURUS);
    const { plan } = sentetikPlanKur();
    expect(plan.ozet.kontrol_toplamlari).toEqual([{ ad: 'begeniler_fiyat', kurus_toplami: ILGI_BEKLENEN_KURUS }]);
  });

  it('atlanan ürünler (AD_BOS, KOD_TEKRAR) toplama girmez; geçersiz tutar (−5) toplamı etkilemez', () => {
    const d = ilgiDonustur(ilgiUrunleri());
    expect(d.atlananlar.map((a) => a.neden_kodu).sort()).toEqual(['AD_BOS', 'KOD_TEKRAR']);
    expect(d.uyarilar.map((u) => u.neden_kodu)).toEqual(['GECERSIZ_TUTAR']);
    const fiyatlar = d.satirlar.flatMap((s) => (s.fiyat !== null ? [s.fiyat] : []));
    expect(fiyatlar).toHaveLength(4);
    expect(kurusToplami(fiyatlar)).toEqual({ kurus: ILGI_BEKLENEN_KURUS, gecersiz: 0 });
  });

  it('yarım-yukarı sınırları: 1.005 → 101 ve 0.125 → 13 toplama bu değerlerle girer', () => {
    const d = ilgiDonustur([{ id: 'a', name: 'a', price: 1.005 }, { id: 'b', name: 'b', price: 0.125 }]);
    expect(d.satirlar.map((s) => s.fiyat)).toEqual([1.01, 0.13]);
    expect(kurusToplami(d.satirlar.map((s) => s.fiyat!)).kurus).toBe(101 + 13);
  });

  it('yazmadan sonra hedef (bellek) Σkuruş = plan Σkuruş = dogrula kontrolünün iki tarafı', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    await yazCalistir(plan, depo);
    const hedefToplam = kurusToplami(depo.begeniler.filter((b) => b.silindi_at === null).map((b) => (typeof b.fiyat === 'number' ? b.fiyat : 0))).kurus;
    expect(hedefToplam).toBe(ILGI_BEKLENEN_KURUS);
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.kontroller.find((k) => k.ad === 'begeniler_fiyat_kurus')).toEqual({ ad: 'begeniler_fiyat_kurus', kaynak: ILGI_BEKLENEN_KURUS, hedef: hedefToplam });
    expect(s.farklar).toEqual([]);
  });

  it('hedefte kullanıcıya ait (sahiplenilen) satır toplamı bozmaz: kaynaktan da düşülür', async () => {
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur({ begeniler: [{ kod: 'urun-004', ad: 'Kullanıcı satırı', fiyat: 9999 }, { kod: 'bagimsiz', ad: 'x', fiyat: 5 }] });
    await yazCalistir(plan, depo);
    const s = await dogrula({ plan, yaziciKur: yaziciFabrikasi(depo).fabrika });
    expect(s.farklar).toEqual([]);
    expect(s.kontroller.find((k) => k.ad === 'begeniler_fiyat_kurus')).toEqual({ ad: 'begeniler_fiyat_kurus', kaynak: ILGI_BEKLENEN_KURUS - 25000, hedef: ILGI_BEKLENEN_KURUS - 25000 });
  });

  it('kuruş toplamı kayan nokta toplamından farklı olduğunda tamsayı toplam esas alınır', () => {
    const d = ilgiDonustur(Array.from({ length: 10 }, (_, i) => ({ id: `u${i}`, name: `Ürün ${i}`, price: 0.1 })));
    const kayan = d.satirlar.reduce((t, s) => t + (s.fiyat ?? 0), 0);
    expect(kayan).not.toBe(1); /* 0.9999999999999999 */
    expect(kurusToplami(d.satirlar.map((s) => s.fiyat!)).kurus).toBe(100);
  });
});

describe('dogrula fark tablosu ve çıkış kodu 1 (CLI)', () => {
  const TEMEL = ['--dalga', 'a', '--girdi', 'sahte.json', '--ilgi', 'sahte-ilgi.json'];

  it('yazılmamış hedef: çıkış 1, her kalem için kaynak/hedef/fark satırı ve toplam fark sayısı', async () => {
    const { bag } = sahteBagimlilik(bellekDeposuKur());
    expect(await calistir(['dogrula', ...TEMEL], bag)).toBe(1);
    expect(yakala.satirlar).toContain(`FARK FARK_VAR kontrol=begeniler_fiyat_kurus kaynak=${ILGI_BEKLENEN_KURUS} hedef=0 fark=-${ILGI_BEKLENEN_KURUS}`);
    expect(yakala.satirlar).toContain('FARK FARK_VAR kontrol=begeniler_satir kaynak=6 hedef=0 fark=-6');
    expect(yakala.satirlar.at(-1)).toBe('FARK DOGRULAMA_FARKI fark_sayisi=5');
  });

  it('doğru yazılmış hedef: çıkış 0 ve tüm kalemler ESIT', async () => {
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo);
    await yazCalistir(sentetikPlanKur().plan, depo);
    expect(await calistir(['dogrula', ...TEMEL], bag)).toBe(0);
    expect(yakala.satirlar.filter((s) => s.startsWith('SONUC ESIT')).length).toBe(5);
    expect(yakala.satirlar.at(-1)).toBe('SONUC DOGRULAMA_TAMAM fark_sayisi=0');
  });

  it('tek kuruşluk sapma bile çıkış 1 verir ve fark = hedef − kaynak olarak yazılır', async () => {
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo);
    await yazCalistir(sentetikPlanKur().plan, depo);
    depo.begeniler.find((b) => b.kod === 'urun-003')!.fiyat = 0.12; /* 0.13 → 0.12 */
    expect(await calistir(['dogrula', ...TEMEL], bag)).toBe(1);
    expect(yakala.satirlar).toContain(`FARK FARK_VAR kontrol=begeniler_fiyat_kurus kaynak=${ILGI_BEKLENEN_KURUS} hedef=${ILGI_BEKLENEN_KURUS - 1} fark=-1`);
    expect(yakala.satirlar.at(-1)).toBe('FARK DOGRULAMA_FARKI fark_sayisi=1');
  });

  it('eksik uygulama anahtarı sayı farkı üretir', async () => {
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo);
    await yazCalistir(sentetikPlanKur().plan, depo);
    depo.uygulamaDurumu.get('bahis')!.clear();
    expect(await calistir(['dogrula', ...TEMEL], bag)).toBe(1);
    expect(yakala.satirlar).toContain('FARK FARK_VAR kontrol=uygulama_durumu_anahtar kaynak=16 hedef=14 fark=-2');
  });
});
