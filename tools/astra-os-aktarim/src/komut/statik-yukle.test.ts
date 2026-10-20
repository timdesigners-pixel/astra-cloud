import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CANARY_AD, CANARY_IBAN, canaryBul } from '@astra/ortak-test';
import { STATIK_UYGULAMALAR, statikPlanOlustur, type StatikDosya } from '../donusum/statik-plan-hesap.ts';
import type { StatikTaramaSonucu } from '../girdi/statik-tara.ts';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import { bellekStatikYukleyiciKur } from '../yazici/bellek-statik-yukleyici.ts';
import { ciktiYakala, TEST_ANA_MAKINE, TEST_SURUM, type CiktiYakalayici } from '../test-destek.ts';
import { KomutHatasi } from './komut-hata.ts';
import { statikYukle, statikYukleCikisKodu, statikYukleSonucuYazdir, type StatikYukleGirdisi } from './statik-yukle.ts';

let yakala: CiktiYakalayici;
beforeEach(() => {
  yakala = ciktiYakala();
});
afterEach(() => yakala.birak());

const HEDEF = { anaMakine: TEST_ANA_MAKINE, kisa: 'abcd...' };
const kodla = (s: string): Uint8Array => new TextEncoder().encode(s);

type SahteTarama = { tarama: StatikTaramaSonucu; icerik: Map<string, Uint8Array>; oku: ReturnType<typeof vi.fn>[] };

/* Dosya sistemi olmadan sahte tarama: her dosya canary içerir (sızıntı denetimi için). */
function sahteTarama(ek: { degisenYol?: string; sorun?: StatikTaramaSonucu['sorunlar']; bozukJson?: string } = {}): SahteTarama {
  const icerik = new Map<string, Uint8Array>();
  const oku: ReturnType<typeof vi.fn>[] = [];
  const dosyalar: StatikTaramaSonucu['dosyalar'] = [];
  for (const u of STATIK_UYGULAMALAR) {
    for (const g of ['hero.json', 'kucuk.json', 'detay/01.json', 'detay/02.json']) {
      const yol = `${u}/${g}`;
      const bayt = kodla(yol === ek.bozukJson ? `{"ad": "${CANARY_AD}` : JSON.stringify({ yol, ad: CANARY_AD, iban: CANARY_IBAN }));
      icerik.set(yol, bayt);
      const o = vi.fn(() => (yol === ek.degisenYol ? kodla('{"degisti":true}') : bayt));
      oku.push(o);
      const bilgi: StatikDosya = { yol, uygulama: u, boyut: bayt.byteLength, sha256: sha256HexBayt(bayt), json_gecerli: yol !== ek.bozukJson };
      dosyalar.push({ bilgi, oku: o as unknown as () => Uint8Array });
    }
  }
  return { tarama: { dosyalar, yoksayilan: 2, sorunlar: ek.sorun ?? [] }, icerik, oku };
}
function girdi(t: SahteTarama, ek: Partial<StatikYukleGirdisi> = {}): StatikYukleGirdisi {
  return { kaynak: 'sahte-kaynak', onay: undefined, hedef: HEDEF, aracSurumu: TEST_SURUM, tara: () => t.tarama, ...ek };
}
function planKodu(t: SahteTarama): string {
  return statikPlanOlustur({ dosyalar: t.tarama.dosyalar.map((d) => d.bilgi), taramaSorunlari: t.tarama.sorunlar, anaMakine: TEST_ANA_MAKINE, aracSurumu: TEST_SURUM }).onay_kodu!;
}

describe('statikYukle: kuru çalıştırma (varsayılan)', () => {
  it('ağ ve kimlik olmadan planı ve onay kodunu üretir; yükleyici fabrikası çağrılmaz, hiçbir dosya okunmaz', async () => {
    const t = sahteTarama();
    const fabrika = vi.fn();
    const s = await statikYukle(girdi(t, { yukleyiciKur: fabrika }));
    expect(s.kuru).toBe(true);
    expect(s.plan.onay_kodu).toBe(planKodu(t));
    expect(s.plan.toplam_dosya).toBe(8);
    expect(s.yoksayilan).toBe(2);
    expect([s.yuklenen, s.dogrulanan, s.nesne_var, s.hata]).toEqual([0, 0, 0, null]);
    expect(fabrika).not.toHaveBeenCalled();
    for (const o of t.oku) expect(o).not.toHaveBeenCalled();
    expect(statikYukleCikisKodu(s)).toBe(0);
  });

  it('sorunlu planda kod verilmez ve çıkış kodu 1 olur', async () => {
    const t = sahteTarama({ bozukJson: 'oynatma-listelerim/hero.json' });
    const s = await statikYukle(girdi(t));
    expect(s.plan.sorunlar).toEqual([{ kod: 'JSON_GECERSIZ', sayi: 1 }]);
    expect(s.plan.onay_kodu).toBeNull();
    expect(statikYukleCikisKodu(s)).toBe(1);
  });

  it('tarama sorunları (ör. sembolik bağlantı) kodu engeller', async () => {
    const s = await statikYukle(girdi(sahteTarama({ sorun: ['SEMBOLIK_BAGLANTI'] })));
    expect(s.plan.onay_kodu).toBeNull();
    expect(statikYukleCikisKodu(s)).toBe(1);
  });
});

describe('statikYukle: onay kapısı (yükleyici ve servis anahtarı hiç kurulmaz)', () => {
  const yanlislar: ReadonlyArray<[string, string]> = [
    ['boş kod', ''],
    ['yanlış kod', 'ONAY-statik-000000000000'],
    ['yazma kodu', 'ONAY-a-0123456789ab'],
    ['geri alma kodu', 'ONAY-geri-0123456789ab'],
    ['küçük harf', 'onay-statik-0123456789ab'],
    ['boşluklu', ' ONAY-statik-0123456789ab'],
  ];
  it.each(yanlislar)('%s -> ONAY_UYUSMADI, fabrika 0 çağrı, hiçbir dosya okunmaz', async (_ad, onay) => {
    const t = sahteTarama();
    const fabrika = vi.fn();
    await expect(statikYukle(girdi(t, { onay, yukleyiciKur: fabrika }))).rejects.toMatchObject({ name: 'KomutHatasi', kod: 'ONAY_UYUSMADI' });
    expect(fabrika).not.toHaveBeenCalled();
    for (const o of t.oku) expect(o).not.toHaveBeenCalled();
  });

  it('dosya içeriği değişmiş (sha256 farklı) tarama eski kodu geçersiz kılar', async () => {
    const t = sahteTarama();
    const eskiKod = planKodu(t);
    const d = sahteTarama();
    const bilgi = d.tarama.dosyalar[0]!.bilgi;
    d.tarama.dosyalar[0]!.bilgi = { ...bilgi, sha256: sha256HexBayt(kodla('baska')) };
    const fabrika = vi.fn();
    await expect(statikYukle(girdi(d, { onay: eskiKod, yukleyiciKur: fabrika }))).rejects.toMatchObject({ kod: 'ONAY_UYUSMADI' });
    expect(fabrika).not.toHaveBeenCalled();
  });

  it('sorunlu planda doğru görünen kod bile yükleme başlatmaz: STATIK_PLAN_SORUNLU', async () => {
    const temiz = sahteTarama();
    const t = sahteTarama({ bozukJson: 'pinterest-panolarim/kucuk.json' });
    const fabrika = vi.fn();
    await expect(statikYukle(girdi(t, { onay: planKodu(temiz), yukleyiciKur: fabrika }))).rejects.toMatchObject({ kod: 'STATIK_PLAN_SORUNLU' });
    expect(fabrika).not.toHaveBeenCalled();
  });

  it('doğru kod var ama yükleyici fabrikası verilmemişse STATIK_YUKLEYICI_YOK', async () => {
    const t = sahteTarama();
    await expect(statikYukle(girdi(t, { onay: planKodu(t) }))).rejects.toMatchObject({ kod: 'STATIK_YUKLEYICI_YOK' });
  });

  it('hedef proje başka ise aynı dosyaların kodu geçmez', async () => {
    const t = sahteTarama();
    const baska = statikPlanOlustur({ dosyalar: t.tarama.dosyalar.map((d) => d.bilgi), anaMakine: 'zzzz9999.supabase.co', aracSurumu: TEST_SURUM }).onay_kodu!;
    await expect(statikYukle(girdi(t, { onay: baska, yukleyiciKur: vi.fn() }))).rejects.toMatchObject({ kod: 'ONAY_UYUSMADI' });
  });
});

describe('statikYukle: yükleme', () => {
  it('tüm dosyaları plan sırasında yükler, geri indirip boyut + sha256 doğrular', async () => {
    const t = sahteTarama();
    const y = bellekStatikYukleyiciKur();
    const s = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => y }));
    expect(s.hata).toBeNull();
    expect([s.yuklenen, s.dogrulanan, s.nesne_var, s.nesne_ayni, s.nesne_farkli]).toEqual([8, 8, 0, 0, 0]);
    expect(s.yuklenen_bayt).toBe([...t.icerik.values()].reduce((n, b) => n + b.byteLength, 0));
    expect(y.yuklenenYollar).toEqual([...t.icerik.keys()].sort());
    for (const [yol, bayt] of t.icerik) expect(Buffer.from(y.depo.get(yol)!).equals(Buffer.from(bayt))).toBe(true);
    expect(y.dogrulamaCagrisi).toBe(8);
    expect(statikYukleCikisKodu(s)).toBe(0);
  });

  it('ikinci çalıştırmada mevcut nesneler EZİLMEZ: nesne_var=8, nesne_ayni=8, yüklenen 0', async () => {
    const t = sahteTarama();
    const y = bellekStatikYukleyiciKur();
    const onay = planKodu(t);
    await statikYukle(girdi(t, { onay, yukleyiciKur: () => y }));
    const once = new Map([...y.depo].map(([k, v]) => [k, Buffer.from(v).toString('hex')]));
    const s2 = await statikYukle(girdi(t, { onay, yukleyiciKur: () => y }));
    expect([s2.yuklenen, s2.nesne_var, s2.nesne_ayni, s2.nesne_farkli, s2.hata]).toEqual([0, 8, 8, 0, null]);
    expect(new Map([...y.depo].map(([k, v]) => [k, Buffer.from(v).toString('hex')]))).toEqual(once);
  });

  it('hedefte içeriği FARKLI nesne varsa ezilmez, nesne_farkli sayılır ve uyarı yazılır', async () => {
    const t = sahteTarama();
    const var_ = 'oynatma-listelerim/hero.json';
    const eski = kodla('{"kullanici":"eski icerik"}');
    const y = bellekStatikYukleyiciKur({ onceden: { [var_]: eski } });
    const s = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => y }));
    expect([s.yuklenen, s.nesne_var, s.nesne_ayni, s.nesne_farkli, s.hata]).toEqual([7, 1, 0, 1, null]);
    expect(Buffer.from(y.depo.get(var_)!).equals(Buffer.from(eski))).toBe(true);
    yakala.satirlar.length = 0;
    statikYukleSonucuYazdir(s);
    expect(yakala.satirlar).toContain('UYARI NESNE_FARKLI sayi=1');
  });

  it('geri indirilen içerik bozuksa STATIK_DOGRULAMA_FARKI ile DURUR (sonraki dosyalar yüklenmez)', async () => {
    const t = sahteTarama();
    const bozulacak = [...t.icerik.keys()].sort()[2]!;
    const y = bellekStatikYukleyiciKur({ indirmeyiBozYol: bozulacak });
    const s = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => y }));
    expect(s.hata).toEqual({ kod: 'STATIK_DOGRULAMA_FARKI', durum: null, tablo: 'storage_objects' });
    expect(s.yuklenen).toBe(2);
    expect(y.yuklemeCagrisi).toBe(3);
    expect(y.yuklenenYollar).toHaveLength(3);
    expect(statikYukleCikisKodu(s)).toBe(1);
  });

  it('ilk yükleme hatasında durur ve o ana kadarki sayılar raporlanır', async () => {
    const t = sahteTarama();
    const y = bellekStatikYukleyiciKur({ yuklemeHatasi: { sira: 4, kod: 'DEPO_DOLU' } });
    const s = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => y }));
    expect(s.hata).toEqual({ kod: 'DEPO_DOLU', durum: 500, tablo: 'storage_objects' });
    expect([s.yuklenen, s.dogrulanan, y.yuklemeCagrisi]).toEqual([3, 3, 4]);
    expect(statikYukleCikisKodu(s)).toBe(1);
  });

  it('onaydan sonra dosya değişmişse STATIK_DOSYA_DEGISTI ile durur, o dosya yüklenmez', async () => {
    const hedefYol = [...sahteTarama().icerik.keys()].sort()[1]!;
    const t = sahteTarama({ degisenYol: hedefYol });
    const y = bellekStatikYukleyiciKur();
    const s = await statikYukle(girdi(t, { onay: planKodu(sahteTarama()), yukleyiciKur: () => y }));
    expect(s.hata).toMatchObject({ kod: 'STATIK_DOSYA_DEGISTI' });
    expect(s.yuklenen).toBe(1);
    expect(y.yuklenenYollar).not.toContain(hedefYol);
    expect(y.depo.has(hedefYol)).toBe(false);
  });

  it('hata sonucunda canary içerik/IBAN sızmaz', async () => {
    const t = sahteTarama();
    const y = bellekStatikYukleyiciKur({ yuklemeHatasi: { sira: 1, kod: 'DEPO_DOLU' } });
    const s = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => y }));
    expect(canaryBul(JSON.stringify({ hata: s.hata, plan: s.plan }))).toEqual([]);
  });
});

describe('statikYukle: gerçek dosya sistemi taraması + sahte yükleyici (ağ yok)', () => {
  let kok = '';
  beforeEach(() => {
    kok = mkdtempSync(join(tmpdir(), 'aktarim-statik-yukle-'));
  });
  afterEach(() => rmSync(kok, { recursive: true, force: true }));

  function yaz(goreli: string, icerik: string): void {
    const yol = join(kok, goreli);
    mkdirSync(dirname(yol), { recursive: true });
    writeFileSync(yol, icerik, 'utf8');
  }

  it('beyaz listedeki dosyalar yüklenir; index.html ve beyaz liste dışı hiçbir şey yüklenmez', async () => {
    for (const u of STATIK_UYGULAMALAR) {
      yaz(`${u}/hero.json`, JSON.stringify({ ad: CANARY_AD }));
      yaz(`${u}/kucuk.json`, '{"k":1}');
      yaz(`${u}/detay/01.json`, '{"d":1}');
      yaz(`${u}/index.html`, '<html>legacy</html>');
      yaz(`${u}/gizli.txt`, 'x');
    }
    const kuru = await statikYukle({ kaynak: kok, onay: undefined, hedef: HEDEF, aracSurumu: TEST_SURUM });
    expect(kuru.plan.toplam_dosya).toBe(6);
    expect(kuru.yoksayilan).toBe(4);
    const y = bellekStatikYukleyiciKur();
    const s = await statikYukle({ kaynak: kok, onay: kuru.plan.onay_kodu!, hedef: HEDEF, aracSurumu: TEST_SURUM, yukleyiciKur: () => y });
    expect(s.hata).toBeNull();
    expect(y.yuklenenYollar).toHaveLength(6);
    expect(y.yuklenenYollar.every((p) => /\/(hero|kucuk)\.json$|\/detay\/\d\d\.json$/.test(p))).toBe(true);
    expect(y.yuklenenYollar.some((p) => p.includes('index.html') || p.includes('gizli'))).toBe(false);
  });

  it('kaynak yoksa STATIK_KAYNAK_YOK fırlatır', async () => {
    await expect(statikYukle({ kaynak: join(kok, 'yok'), onay: undefined, hedef: HEDEF, aracSurumu: TEST_SURUM })).rejects.toMatchObject({ kod: 'STATIK_KAYNAK_YOK' });
  });

  it('kuru çalıştırma ile yükleme arasında dosya değişirse kod tutmaz', async () => {
    for (const u of STATIK_UYGULAMALAR) {
      yaz(`${u}/hero.json`, '{"a":1}');
      yaz(`${u}/kucuk.json`, '{"a":2}');
      yaz(`${u}/detay/01.json`, '{"a":3}');
    }
    const kuru = await statikYukle({ kaynak: kok, onay: undefined, hedef: HEDEF, aracSurumu: TEST_SURUM });
    yaz('oynatma-listelerim/detay/01.json', '{"a":999}');
    const fabrika = vi.fn();
    await expect(statikYukle({ kaynak: kok, onay: kuru.plan.onay_kodu!, hedef: HEDEF, aracSurumu: TEST_SURUM, yukleyiciKur: fabrika })).rejects.toBeInstanceOf(KomutHatasi);
    expect(fabrika).not.toHaveBeenCalled();
  });
});

describe('statikYukleSonucuYazdir', () => {
  it('kuru çalıştırma çıktısı: uygulama özeti, toplam, yok sayılan, onay kodu; dosya adı/yolu ve içerik yazılmaz', async () => {
    const t = sahteTarama();
    const s = await statikYukle(girdi(t));
    yakala.satirlar.length = 0;
    statikYukleSonucuYazdir(s);
    const m = yakala.metin();
    expect(yakala.satirlar[0]).toBe('BILGI STATIK_KURU_CALISTIRMA hedef=abcd... kova=apps');
    expect(m).toContain('SONUC STATIK_UYGULAMA uygulama=oynatma-listelerim dosya=4 detay=2');
    expect(m).toContain('SONUC STATIK_UYGULAMA uygulama=pinterest-panolarim dosya=4 detay=2');
    expect(m).toMatch(/SONUC STATIK_TOPLAM dosya=8 bayt=\d+ en_buyuk=\d+ sinir=52428800 ozet=[0-9a-f]{12}/);
    expect(m).toContain('BILGI STATIK_YOKSAYILAN sayi=2');
    expect(m).toContain(`SONUC ONAY_KODU kod=${s.plan.onay_kodu}`);
    expect(m).not.toMatch(/hero\.json|kucuk\.json|detay\/|index\.html/);
    expect(canaryBul(m)).toEqual([]);
  });

  it('sorunlu planda STATIK_SORUN ve ONAY_VERILMEDI yazar', async () => {
    const s = await statikYukle(girdi(sahteTarama({ bozukJson: 'oynatma-listelerim/hero.json' })));
    yakala.satirlar.length = 0;
    statikYukleSonucuYazdir(s);
    expect(yakala.satirlar).toContain('UYARI STATIK_SORUN neden=JSON_GECERSIZ sayi=1');
    expect(yakala.satirlar).toContain('UYARI ONAY_VERILMEDI neden=PLAN_SORUNLU');
    expect(yakala.satirlar.some((x) => x.includes('ONAY_KODU'))).toBe(false);
  });

  it('dosyasız planda ONAY_VERILMEDI neden=DOSYA_YOK yazar', async () => {
    const s = await statikYukle(girdi({ tarama: { dosyalar: [], yoksayilan: 0, sorunlar: [] }, icerik: new Map(), oku: [] }));
    yakala.satirlar.length = 0;
    statikYukleSonucuYazdir(s);
    expect(yakala.satirlar).toContain('UYARI ONAY_VERILMEDI neden=DOSYA_YOK');
  });

  it('gerçek yükleme çıktısı: YUKLE_TAMAM + sayılar; hata varsa YUKLEME_DURDU', async () => {
    const t = sahteTarama();
    const s = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => bellekStatikYukleyiciKur() }));
    yakala.satirlar.length = 0;
    statikYukleSonucuYazdir(s);
    expect(yakala.satirlar[0]).toBe('SONUC STATIK_YUKLE_TAMAM hedef=abcd... kova=apps');
    expect(yakala.satirlar[1]).toMatch(/^SONUC STATIK_YUKLENEN dosya=8 bayt=\d+ dogrulanan=8 toplam=8$/);
    expect(yakala.satirlar[2]).toBe('SONUC NESNE_VAR sayi=0 ayni=0 farkli=0');

    const y = bellekStatikYukleyiciKur({ yuklemeHatasi: { sira: 2, kod: 'DEPO_DOLU' } });
    const h = await statikYukle(girdi(t, { onay: planKodu(t), yukleyiciKur: () => y }));
    yakala.satirlar.length = 0;
    statikYukleSonucuYazdir(h);
    expect(yakala.satirlar[0]).toContain('STATIK_YUKLE_YARIM');
    expect(yakala.satirlar.at(-1)).toBe('HATA YUKLEME_DURDU neden=DEPO_DOLU durum=500 tablo=storage_objects');
  });
});
