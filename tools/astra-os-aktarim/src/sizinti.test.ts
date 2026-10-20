/* DEĞER SIZINTI (canary) TESTİ: sentetik girdiye gömülü tanınabilir sahte değerler (ad, IBAN, dosya no, parola, abone no, telefon, anahtar)
   hiçbir komutun `cikti.ts` çıktısında, `--rapor` dosyasında, `hataGuvenli` sonucunda ya da hata yolunda görünmemelidir. Gerçek ağ/Supabase yok. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  CANARY_ABONE_NO, CANARY_AD, CANARY_ANAHTAR, CANARY_DEGERLERI, CANARY_DOSYA_NO, CANARY_IBAN, CANARY_PAROLA, CANARY_TELEFON, canaryBul, ibanBoslukluYaz, sentetikSUret,
} from '@astra/ortak-test';
import { calistir } from './cli.ts';
import { STATIK_UYGULAMALAR } from './donusum/statik-plan-hesap.ts';
import { hataGuvenli } from './guvenlik/sir-koruma.ts';
import type { Bagimlilik } from './komut/bagimlilik.ts';
import { bellekStatikYukleyiciKur } from './yazici/bellek-statik-yukleyici.ts';
import { bellekDeposuKur, type BellekDeposu, type BellekYazici, type HataEnjeksiyonu } from './yazici/bellek-yazici.ts';
import type { YaziciYontemi } from './yazici/yazici-arayuzu.ts';
import { ciktiYakala, ilgiUrunleri, sahteBagimlilik, sentetikPlanKur, testOrtami, type CiktiYakalayici } from './test-destek.ts';

let yakala: CiktiYakalayici;
let kok = '';
beforeEach(() => {
  yakala = ciktiYakala();
  kok = mkdtempSync(join(tmpdir(), 'aktarim-sizinti-'));
});
afterEach(() => {
  yakala.birak();
  rmSync(kok, { recursive: true, force: true });
});

const TEMEL = ['--dalga', 'a', '--girdi', 'sahte.json', '--ilgi', 'sahte-ilgi.json'];
const AYRINTI = `${CANARY_AD} | ${CANARY_IBAN} | ${ibanBoslukluYaz(CANARY_IBAN)} | ${CANARY_DOSYA_NO} | ${CANARY_PAROLA} | ${CANARY_ABONE_NO} | ${CANARY_TELEFON} | ${CANARY_ANAHTAR}`;
const IBAN_DESENI = /[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){4,7}/;

function sizintiYok(metin: string, baglam: string): void {
  expect(canaryBul(metin), `${baglam}: canary sızdı`).toEqual([]);
  expect(IBAN_DESENI.test(metin.replace(/\s+/g, ' ')), `${baglam}: IBAN biçimi sızdı`).toBe(false);
}

function enjekteli(bag: Bagimlilik, h: HataEnjeksiyonu): Bagimlilik {
  return {
    ...bag,
    yaziciKur: async () => {
      const y = (await bag.yaziciKur()) as BellekYazici;
      y.hataEnjekte(h);
      return y;
    },
  };
}
function kodAl(metin: string, onEk: string): string {
  const m = new RegExp(`${onEk}[0-9a-f]{12}`).exec(metin);
  if (!m) throw new Error('kod yok');
  return m[0];
}
async function kos(argv: string[], bag: Bagimlilik): Promise<{ cikis: number; metin: string }> {
  yakala.satirlar.length = 0;
  const cikis = await calistir(argv, bag);
  return { cikis, metin: yakala.metin() };
}

describe('sızıntı testinin anlamlı olduğu (sanity)', () => {
  it('sentetik girdi canary değerlerini gerçekten taşır ve hedefe yazılan veri onları içerir', async () => {
    const s = sentetikSUret();
    const json = JSON.stringify(s);
    for (const c of [CANARY_AD, CANARY_DOSYA_NO, CANARY_PAROLA, CANARY_ABONE_NO, CANARY_TELEFON, CANARY_ANAHTAR, CANARY_IBAN]) expect(json).toContain(c);
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo, s);
    const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
    await kos(['yaz', ...TEMEL, '--onay', kodAl(kuru.metin, 'ONAY-a-')], bag);
    const yazilan = JSON.stringify([...depo.uygulamaDurumu].map(([u, m]) => [u, [...m]]));
    expect(yazilan).toContain(CANARY_PAROLA);
    expect(yazilan).toContain(CANARY_IBAN);
    expect(JSON.stringify(depo.begeniler)).toContain(CANARY_AD);
  });
  it('canaryBul ve IBAN deseni çıktıdaki sızıntıyı gerçekten yakalar', () => {
    expect(canaryBul(`HATA ${CANARY_AD}`)).toEqual([CANARY_AD]);
    expect(IBAN_DESENI.test(ibanBoslukluYaz(CANARY_IBAN))).toBe(true);
  });
});

describe('kuru-calistir: ekran, JSON ve --rapor dosyası', () => {
  it('metin, JSON ve rapor dosyası canary içermez', async () => {
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret());
    const yol = join(kok, 'rapor.json');
    const a = await kos(['kuru-calistir', ...TEMEL, '--rapor', yol], bag);
    const b = await kos(['kuru-calistir', ...TEMEL, '--json'], bag);
    expect([a.cikis, b.cikis]).toEqual([0, 0]);
    sizintiYok(a.metin, 'kuru metin');
    sizintiYok(b.metin, 'kuru json');
    sizintiYok(readFileSync(yol, 'utf8'), 'rapor dosyası');
  });
  it('S\'nin diğer koleksiyonlarındaki (kişi, icra, dava, gider) canary değerler de raporlanmaz', async () => {
    const s = sentetikSUret();
    const { bag } = sahteBagimlilik(bellekDeposuKur(), s);
    const r = await kos(['kuru-calistir', ...TEMEL, '--json'], bag);
    expect(r.metin).not.toContain('kisi-06');
    expect(r.metin).not.toContain('icra-x');
    sizintiYok(r.metin, 'json');
  });
  it('plan nesnesi değeri sızdırmaz (toJSON/inspect testi plan testindedir); komut sonucu yalnız özet', async () => {
    const { plan } = sentetikPlanKur();
    sizintiYok(JSON.stringify(plan), 'plan json');
  });
});

describe('girdi hataları: kayıt değeri hata çıktısına girmez', () => {
  const girdiler: ReadonlyArray<[string, string]> = [
    ['kesik JSON', `{"koleksiyon":{"debts":[{"name":"${CANARY_AD}","iban":"${CANARY_IBAN}"`],
    ['yanlış türlü koleksiyon', JSON.stringify({ koleksiyon: { debts: CANARY_AD } })],
    ['yanlış türlü ayar', JSON.stringify({ ayar: [CANARY_PAROLA, CANARY_IBAN] })],
    ['yanlış türlü sürüm', JSON.stringify({ _v: CANARY_AD, koleksiyon: {} })],
    ['tanınmayan nesne', JSON.stringify({ [CANARY_AD]: CANARY_IBAN })],
    ['tanınmayan dizi', JSON.stringify([CANARY_AD, CANARY_DOSYA_NO])],
    ['şifreli zarf', JSON.stringify({ v: 1, i: CANARY_AD, d: CANARY_PAROLA })],
    ['bozuk iç JSON', JSON.stringify({ v: 0, m: `{"x":"${CANARY_AD}` })],
    ['düz metin', JSON.stringify(CANARY_PAROLA)],
  ];
  it.each(girdiler)('%s', async (_ad, icerik) => {
    const yol = join(kok, `${CANARY_ANAHTAR}.json`);
    writeFileSync(yol, icerik);
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret(), { planKaynagi: undefined });
    const r = await kos(['kuru-calistir', '--dalga', 'a', '--girdi', yol], bag);
    expect(r.cikis).toBe(1);
    expect(r.metin).toMatch(/^HATA GIRDI_HATASI neden=[A-Z_]+/);
    sizintiYok(r.metin, 'girdi hatası');
    expect(r.metin).not.toContain(kok); /* dosya yolu da yazılmaz */
  });

  it('girdi dosyası bulunamadığında yol (canary adlı) yazılmaz', async () => {
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret(), { planKaynagi: undefined });
    const r = await kos(['kuru-calistir', '--dalga', 'a', '--girdi', join(kok, `${CANARY_ANAHTAR}-yok.json`)], bag);
    expect(r.cikis).toBe(1);
    sizintiYok(r.metin, 'dosya yok');
    expect(r.metin).not.toContain(kok);
  });

  it('bozuk --ilgi dosyası canary yazmaz', async () => {
    const girdi = join(kok, 'yedek.json');
    const ilgi = join(kok, 'ilgi.json');
    writeFileSync(girdi, JSON.stringify(sentetikSUret()));
    writeFileSync(ilgi, `[{"id":"x","name":"${CANARY_AD}`);
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret(), { planKaynagi: undefined });
    const r = await kos(['kuru-calistir', '--dalga', 'a', '--girdi', girdi, '--ilgi', ilgi], bag);
    expect(r.cikis).toBe(1);
    expect(r.metin).toBe('HATA GIRDI_HATASI neden=BOZUK_JSON yol=ilgi');
  });
});

const YONTEMLER: readonly YaziciYontemi[] = [
  'eslesmeOku', 'eslesmeEkle', 'eslesmeGuncelle', 'satirEkle', 'satirGizle', 'begeniKodlariOku', 'begeniFiyatlariOku', 'uygulamaAnahtarlariOku', 'uygulamaDurumuYaz', 'uygulamaDurumuSil',
];
const KODLAR = ['23505', '22023'] as const;

async function yazilmisBag(): Promise<{ bag: Bagimlilik; depo: BellekDeposu; yazKodu: string }> {
  const depo = bellekDeposuKur();
  const { bag } = sahteBagimlilik(depo, sentetikSUret());
  const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
  const yazKodu = kodAl(kuru.metin, 'ONAY-a-');
  expect((await kos(['yaz', ...TEMEL, '--onay', yazKodu], bag)).cikis).toBe(0);
  return { bag, depo, yazKodu };
}

describe('hata yolu: yazıcı 23505 / 22023 döndürürken ayrıntıya canary konur → çıktıda YOK', () => {
  it('yaz: her yazıcı yöntemi × her kod', async () => {
    let hataliCalisma = 0;
    for (const yontem of YONTEMLER) {
      for (const kod of KODLAR) {
        const depo = bellekDeposuKur();
        const { bag } = sahteBagimlilik(depo, sentetikSUret());
        const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
        const r = await kos(['yaz', ...TEMEL, '--onay', kodAl(kuru.metin, 'ONAY-a-')], enjekteli(bag, { n: 1, yontem, kod, ayrinti: AYRINTI }));
        sizintiYok(r.metin, `yaz ${yontem} ${kod}`);
        if (r.cikis === 1) {
          hataliCalisma++;
          expect(r.metin, `${yontem} ${kod}`).toMatch(new RegExp(`HATA YAZMA_DURDU neden=${kod} durum=0 tablo=[a-z_]+$`, 'm'));
        }
      }
    }
    expect(hataliCalisma).toBeGreaterThan(8); /* enjeksiyonlar gerçekten tetiklendi */
  });

  it('yaz: sonuç nesnesi (YazSonucu.hata) hataGuvenli biçimindedir ve canary içermez', async () => {
    const { yaz } = await import('./komut/yaz.ts');
    const { plan } = sentetikPlanKur();
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo, sentetikSUret());
    const sonuc = await yaz({
      plan, onay: plan.onay_kodu, aktarimId: '11111111-1111-4111-8111-000000000001',
      yaziciKur: async () => {
        const y = (await bag.yaziciKur()) as BellekYazici;
        y.hataEnjekte({ n: 2, yontem: 'uygulamaDurumuYaz', kod: '23505', ayrinti: AYRINTI });
        return y;
      },
    });
    expect(sonuc.hata).toEqual({ kod: '23505', durum: null, tablo: 'uygulama_durumu' });
    sizintiYok(JSON.stringify(sonuc), 'YazSonucu');
  });

  it('dogrula: okuma yöntemleri × kodlar', async () => {
    const { bag } = await yazilmisBag();
    let hataliCalisma = 0;
    for (const yontem of ['eslesmeOku', 'uygulamaAnahtarlariOku', 'begeniKodlariOku', 'begeniFiyatlariOku'] as const) {
      for (const kod of KODLAR) {
        const r = await kos(['dogrula', ...TEMEL], enjekteli(bag, { n: 1, yontem, kod, ayrinti: AYRINTI }));
        sizintiYok(r.metin, `dogrula ${yontem} ${kod}`);
        if (r.cikis !== 0) {
          hataliCalisma++;
          expect(r.metin).toBe(`HATA YAZICI_HATASI neden=${kod} durum=0 tablo=${yontem === 'eslesmeOku' ? 'aktarim_eslesme' : yontem.startsWith('begeni') ? 'begeniler' : 'yok'}`);
        }
      }
    }
    expect(hataliCalisma).toBe(8);
  });

  it('geri-al: kuru, onaylı ve bayraklı; her yöntem × kod', async () => {
    let hataliCalisma = 0;
    for (const bayrakli of [false, true]) {
      for (const yontem of ['eslesmeOku', 'eslesmeGuncelle', 'satirGizle', 'uygulamaDurumuSil'] as const) {
        for (const kod of KODLAR) {
          const { bag } = await yazilmisBag();
          const ek = bayrakli ? ['--uygulama-durumlarini-sil'] : [];
          const kuru = await kos(['geri-al', '--dalga', 'a', ...ek], bag);
          sizintiYok(kuru.metin, 'geri-al kuru');
          const geriKod = kodAl(kuru.metin, 'ONAY-geri-');
          const r = await kos(['geri-al', '--dalga', 'a', ...ek, '--onay', geriKod], enjekteli(bag, { n: 1, yontem, kod, ayrinti: AYRINTI }));
          sizintiYok(r.metin, `geri-al ${yontem} ${kod} bayrakli=${bayrakli}`);
          if (r.cikis === 1) hataliCalisma++;
        }
      }
    }
    expect(hataliCalisma).toBeGreaterThan(8);
  });

  it('yetim-tara: tarama ve temizleme', async () => {
    const { bag } = await yazilmisBag();
    for (const kod of KODLAR) {
      for (const yontem of ['eslesmeOku', 'begeniKodlariOku'] as const) {
        const r = await kos(['yetim-tara', '--baslangic', '2026-06-01T00:00:00Z'], enjekteli(bag, { n: 1, yontem, kod, ayrinti: AYRINTI }));
        expect(r.cikis).toBe(1);
        sizintiYok(r.metin, `yetim-tara ${yontem} ${kod}`);
        expect(r.metin).toContain(`HATA YETIM_TARA_DURDU neden=${kod}`);
      }
    }
  });

  it('yetim-tara --yetim-temizle: yetim varken tarama + onaylı temizleme hata yolu', async () => {
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo, sentetikSUret());
    const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
    const yazKodu = kodAl(kuru.metin, 'ONAY-a-');
    /* beğeniler yazıldı, beğeni eşleşmesi yazılamadı → yetim */
    const yarim = await kos(['yaz', ...TEMEL, '--onay', yazKodu], enjekteli(bag, { n: 17, yontem: 'eslesmeEkle', kod: '22023', ayrinti: AYRINTI }));
    expect(yarim.cikis).toBe(1);
    sizintiYok(yarim.metin, 'yarım yaz');
    const tara = await kos(['yetim-tara', '--baslangic', '2026-06-01T00:00:00Z'], bag);
    expect(tara.metin).toContain('SONUC YETIM_TARAMA taranan=6 yetim=6');
    const yetimKodu = kodAl(tara.metin, 'ONAY-yetim-');
    const hata = await kos(['yetim-tara', '--yetim-temizle', '--baslangic', '2026-06-01T00:00:00Z', '--onay', yetimKodu], enjekteli(bag, { n: 1, yontem: 'satirGizle', kod: '23505', ayrinti: AYRINTI }));
    expect(hata.cikis).toBe(1);
    sizintiYok(hata.metin, 'yetim temizle hata');
    const tamam = await kos(['yetim-tara', '--yetim-temizle', '--baslangic', '2026-06-01T00:00:00Z', '--onay', yetimKodu], bag);
    expect(tamam.cikis).toBe(0);
    expect(tamam.metin).toContain('SONUC YETIM_TEMIZLENDI temizlenen=6');
    sizintiYok(tamam.metin, 'yetim temizle');
  });

  it('yazıcı fabrikası / oturum hatası: tanınmayan hata mesajında canary → BEKLENMEYEN_HATA', async () => {
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret());
    const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
    const bozuk: Bagimlilik = { ...bag, yaziciKur: async () => { throw Object.assign(new Error(AYRINTI), { code: '23505', details: AYRINTI, hint: AYRINTI }); } };
    const r = await kos(['yaz', ...TEMEL, '--onay', kodAl(kuru.metin, 'ONAY-a-')], bozuk);
    expect(r).toEqual({ cikis: 1, metin: 'HATA BEKLENMEYEN_HATA' });
  });
});

describe('başarılı akışlar: yaz, dogrula, geri-al çıktıları', () => {
  it('tam akış çıktısı ve sonuçları canary içermez', async () => {
    const depo = bellekDeposuKur();
    const { bag } = sahteBagimlilik(depo, sentetikSUret());
    const hepsi: string[] = [];
    const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
    hepsi.push(kuru.metin);
    const yazKodu = kodAl(kuru.metin, 'ONAY-a-');
    hepsi.push((await kos(['yaz', ...TEMEL, '--onay', yazKodu], bag)).metin);
    hepsi.push((await kos(['yaz', ...TEMEL, '--onay', yazKodu], bag)).metin);
    hepsi.push((await kos(['dogrula', ...TEMEL], bag)).metin);
    hepsi.push((await kos(['yetim-tara', '--baslangic', '2026-06-01T00:00:00Z'], bag)).metin);
    const geri = await kos(['geri-al', '--dalga', 'a', '--uygulama-durumlarini-sil'], bag);
    hepsi.push(geri.metin);
    hepsi.push((await kos(['geri-al', '--dalga', 'a', '--uygulama-durumlarini-sil', '--onay', kodAl(geri.metin, 'ONAY-geri-')], bag)).metin);
    hepsi.push((await kos(['dogrula', ...TEMEL], bag)).metin);
    for (const m of hepsi) sizintiYok(m, 'akış');
    expect(hepsi.join('\n')).toContain('YAZ_TAMAM');
    expect(hepsi.join('\n')).toContain('GERI_AL_TAMAM');
  });

  it('çıktının her satırı izinli desenlerden biridir (serbest metin yok)', async () => {
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret());
    const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
    const satirlar: string[] = [];
    const topla = async (argv: string[]) => void satirlar.push(...(await kos(argv, bag)).metin.split('\n'));
    await topla(['yaz', ...TEMEL, '--onay', kodAl(kuru.metin, 'ONAY-a-')]);
    await topla(['dogrula', ...TEMEL]);
    await topla(['geri-al', '--dalga', 'a']);
    await topla(['yetim-tara']);
    await topla(['yaz', ...TEMEL, '--onay', 'yanlis']);
    await topla(['bilinmeyen-komut']);
    const izinli = /^(?:(?:BILGI|UYARI|HATA|SONUC|FARK) [A-Z][A-Z0-9_]+(?: [a-z][a-z0-9_]*=[A-Za-z0-9_.-]+)*|ILERLEME [a-z]+ \d+\/\d+|KULLANIM .*|KOMUT .*|SECENEK .*|ORTAM .*|CIKIS .*)$/;
    const yardimOncesi = satirlar.filter((s) => !/^(KULLANIM|KOMUT|SECENEK|ORTAM|CIKIS) /.test(s));
    expect(yardimOncesi.length).toBeGreaterThan(30);
    for (const s of satirlar) expect(s, s).toMatch(izinli);
  });
});

describe('statik-yukle: dosya içeriği (canary) çıktıya girmez', () => {
  function yaz(goreli: string, icerik: string): void {
    const yol = join(kok, goreli);
    mkdirSync(dirname(yol), { recursive: true });
    writeFileSync(yol, icerik, 'utf8');
  }
  function agac(): void {
    for (const u of STATIK_UYGULAMALAR) {
      yaz(`${u}/hero.json`, JSON.stringify({ ad: CANARY_AD, iban: CANARY_IBAN, parola: CANARY_PAROLA }));
      yaz(`${u}/kucuk.json`, JSON.stringify({ not: CANARY_DOSYA_NO }));
      yaz(`${u}/detay/01.json`, JSON.stringify({ tel: CANARY_TELEFON }));
      yaz(`${u}/${CANARY_ANAHTAR}.json`, '{}'); /* beyaz liste dışı: adı da yazılmamalı */
    }
  }

  it('kuru çalıştırma, onaylı yükleme, ikinci yükleme ve hata yolu', async () => {
    agac();
    const yukleyici = bellekStatikYukleyiciKur();
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret(), { statikYukleyiciKur: () => yukleyici });
    const kuru = await kos(['statik-yukle', '--kaynak', kok], bag);
    expect(kuru.cikis).toBe(0);
    sizintiYok(kuru.metin, 'statik kuru');
    expect(kuru.metin).toContain('STATIK_YOKSAYILAN sayi=2');
    const kod = kodAl(kuru.metin, 'ONAY-statik-');
    const yukle = await kos(['statik-yukle', '--kaynak', kok, '--onay', kod], bag);
    expect(yukle.cikis).toBe(0);
    sizintiYok(yukle.metin, 'statik yukle');
    const tekrar = await kos(['statik-yukle', '--kaynak', kok, '--onay', kod], bag);
    expect(tekrar.cikis).toBe(0);
    expect(tekrar.metin).toContain('NESNE_VAR sayi=6 ayni=6 farkli=0');
    sizintiYok(tekrar.metin, 'statik tekrar');
    for (const m of [kuru.metin, yukle.metin, tekrar.metin]) expect(m).not.toMatch(/hero|kucuk|detay\/|\.json|abcd1234/);

    const bozuk: Bagimlilik = { ...bag, statikYukleyiciKur: () => bellekStatikYukleyiciKur({ yuklemeHatasi: { sira: 2, kod: 'DEPO_DOLU' } }) };
    const hata = await kos(['statik-yukle', '--kaynak', kok, '--onay', kod], bozuk);
    expect(hata.cikis).toBe(1);
    sizintiYok(hata.metin, 'statik hata');
    const farkli: Bagimlilik = { ...bag, statikYukleyiciKur: () => bellekStatikYukleyiciKur({ indirmeyiBozYol: 'oynatma-listelerim/hero.json' }) };
    const fark = await kos(['statik-yukle', '--kaynak', kok, '--onay', kod], farkli);
    expect(fark.cikis).toBe(1);
    expect(fark.metin).toContain('neden=STATIK_DOGRULAMA_FARKI');
    sizintiYok(fark.metin, 'statik doğrulama farkı');
  });
});

describe('hataGuvenli: her hata biçiminde canary sızmaz', () => {
  it('PostgREST, fetch, Error, cause zinciri, string ve getter hatası', () => {
    const hatalar: unknown[] = [
      { code: '23505', message: AYRINTI, details: AYRINTI, hint: AYRINTI },
      { code: '22023', message: `Key (iban)=(${CANARY_IBAN}) already exists.`, details: `Key (ad)=(${CANARY_AD})` },
      { kod: CANARY_AD, durum: 400 },
      Object.assign(new Error(AYRINTI), { code: 'PGRST116', cause: { message: AYRINTI } }),
      new TypeError(AYRINTI),
      AYRINTI,
      { status: 500, statusText: AYRINTI, body: AYRINTI, error: { message: AYRINTI } },
      { get code(): string { throw new Error(AYRINTI); } },
    ];
    for (const h of hatalar) {
      const s = hataGuvenli(h, 'begeniler');
      sizintiYok(JSON.stringify(s), 'hataGuvenli');
      expect(Object.keys(s).sort()).toEqual(['durum', 'kod', 'tablo']);
    }
  });
});

describe('ortam değişkenleri: hiçbir çıktıda yok', () => {
  it('anon anahtar (canary), PIN ve servis anahtarı komut çıktılarında görünmez', async () => {
    const ortam = testOrtami({ ASTRA_SUPABASE_ANON: CANARY_ANAHTAR, ASTRA_PIN: CANARY_PAROLA, ASTRA_SERVIS_ANAHTARI: CANARY_ABONE_NO });
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret(), { ortam });
    const kuru = await kos(['kuru-calistir', ...TEMEL], bag);
    sizintiYok(kuru.metin, 'ortam kuru');
    const r = await kos(['yaz', ...TEMEL, '--onay', 'x'], bag);
    sizintiYok(r.metin, 'ortam yaz');
    sizintiYok((await kos(['statik-yukle', '--kaynak', kok], bag)).metin, 'ortam statik');
    expect(CANARY_DEGERLERI.length).toBeGreaterThan(5);
  });
});

describe('ilgi ürünleri: ad/not canary değerleri raporda yok', () => {
  it('ürün listesinde canary vardır ama rapor yalnız sayıları içerir', async () => {
    expect(JSON.stringify(ilgiUrunleri())).toContain(CANARY_AD);
    const { bag } = sahteBagimlilik(bellekDeposuKur(), sentetikSUret());
    const r = await kos(['kuru-calistir', ...TEMEL, '--json'], bag);
    sizintiYok(r.metin, 'ilgi');
    expect(r.metin).not.toContain('urun-002');
  });
});
