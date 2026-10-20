import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, CANARY_ANAHTAR, CANARY_DEGERLERI, CANARY_IBAN, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { calistir, varsayilanBagimlilik } from './cli.ts';
import { STATIK_UYGULAMALAR } from './donusum/statik-plan-hesap.ts';
import type { Bagimlilik } from './komut/bagimlilik.ts';
import { raporDogrula } from './rapor/rapor-sema.ts';
import { sha256HexBayt } from './guvenlik/ozet.ts';
import { OturumHatasi } from './yazici/oturum.ts';
import { bellekDeposuKur, type BellekDeposu } from './yazici/bellek-yazici.ts';
import { bellekStatikYukleyiciKur } from './yazici/bellek-statik-yukleyici.ts';
import { ciktiYakala, sahteBagimlilik, testOrtami, TEST_URL, type CiktiYakalayici } from './test-destek.ts';

let yakala: CiktiYakalayici;
let kok = '';
beforeEach(() => {
  yakala = ciktiYakala();
  kok = mkdtempSync(join(tmpdir(), 'aktarim-cli-'));
});
afterEach(() => {
  yakala.birak();
  rmSync(kok, { recursive: true, force: true });
});

const TEMEL = ['--dalga', 'a', '--girdi', 'sahte-girdi.json', '--ilgi', 'sahte-ilgi.json'];

function kurulum(ek: Partial<Bagimlilik> = {}, s = sentetikSUret(), depo: BellekDeposu = bellekDeposuKur()) {
  return { depo, ...sahteBagimlilik(depo, s, ek) };
}
function onayKodu(metin: string, onEk = 'ONAY-a-'): string {
  const m = new RegExp(`${onEk}[0-9a-f]{12}`).exec(metin);
  if (!m) throw new Error('onay kodu bulunamadı');
  return m[0];
}
async function kuruKodu(bag: Bagimlilik, ek: string[] = []): Promise<string> {
  yakala.satirlar.length = 0;
  expect(await calistir(['kuru-calistir', ...TEMEL, ...ek], bag)).toBe(0);
  return onayKodu(yakala.metin());
}

describe('calistir: kullanım hataları (çıkış 2)', () => {
  it('argümansız çağrı yardım gösterir ve 0 döner', async () => {
    const { bag } = kurulum();
    expect(await calistir([], bag)).toBe(0);
    expect(yakala.satirlar[0]).toBe('KULLANIM aktar <komut> [secenekler]');
    expect(yakala.metin()).toContain('CIKIS 0 basarili, 1 dogrulama farki veya hata, 2 kullanim hatasi');
  });
  it('--yardim 0 döner', async () => {
    expect(await calistir(['yaz', '--yardim'], kurulum().bag)).toBe(0);
  });
  it('bilinmeyen komut: çıkış 2, hata kodu ve yardım metni', async () => {
    expect(await calistir(['uc-boyutlu'], kurulum().bag)).toBe(2);
    expect(yakala.satirlar[0]).toBe('HATA KULLANIM_HATASI neden=KOMUT_BILINMIYOR');
    expect(yakala.metin()).toContain('KULLANIM aktar');
  });
  it('bilinmeyen bayrak: çıkış 2 ve bayrak adı/değeri yankılanmaz', async () => {
    expect(await calistir(['kuru-calistir', ...TEMEL, '--gizli-bayrak-424242'], kurulum().bag)).toBe(2);
    expect(yakala.satirlar[0]).toBe('HATA KULLANIM_HATASI neden=BAYRAK_BILINMIYOR');
    expect(yakala.metin()).not.toContain('424242');
    expect(yakala.metin()).not.toContain('gizli-bayrak');
  });
  it.each([[['--pin', '123456']], [['--pin=123456']], [['--parola', '123456']], [['--token', 'abc123456']], [['--key=123456']]])('sır bayrağı %j: çıkış 2, değer ve bayrak YANKILANMAZ', async (ek) => {
    const { bag, fabrika } = kurulum();
    expect(await calistir(['yaz', ...TEMEL, ...ek], bag)).toBe(2);
    expect(yakala.satirlar[0]).toBe('HATA KULLANIM_HATASI neden=PIN_ARGUMANI_YASAK');
    const metin = yakala.metin();
    expect(metin).not.toContain('123456');
    expect(metin.toLowerCase()).not.toMatch(/--(pin|parola|token|key)/);
    expect(fabrika.cagri()).toBe(0);
  });
  it('eksik zorunlu seçenekler çıkış 2 verir', async () => {
    const { bag } = kurulum();
    expect(await calistir(['yaz', '--girdi', 'x'], bag)).toBe(2);
    expect(yakala.satirlar[0]).toContain('DALGA_GEREKLI');
    expect(await calistir(['geri-al'], bag)).toBe(2);
    expect(await calistir(['yetim-tara', '--yetim-temizle'], bag)).toBe(2);
    expect(await calistir(['statik-yukle'], bag)).toBe(2);
  });
  it('geçersiz dalga ve aktarım kimliği çıkış 2 verir', async () => {
    const { bag } = kurulum();
    expect(await calistir(['kuru-calistir', '--dalga', 'x', '--girdi', 'g'], bag)).toBe(2);
    expect(await calistir(['geri-al', '--aktarim', 'uuid-degil'], bag)).toBe(2);
  });
});

describe('calistir: ayar hataları (çıkış 2)', () => {
  it('ASTRA_SUPABASE_URL yoksa AYAR_HATASI ORTAM_EKSIK verir', async () => {
    const { bag } = kurulum({ ortam: {} });
    expect(await calistir(['kuru-calistir', ...TEMEL], bag)).toBe(2);
    expect(yakala.satirlar[0]).toBe('HATA AYAR_HATASI neden=ORTAM_EKSIK degisken=ASTRA_SUPABASE_URL');
  });
  it.each([['http://abcd1234.supabase.co'], ['https://evil.com'], ['https://abcd1234.supabase.co.evil.com'], ['zzz']])('geçersiz hedef URL %s reddedilir ve değeri yazılmaz', async (url) => {
    const { bag, fabrika } = kurulum({ ortam: testOrtami({ ASTRA_SUPABASE_URL: url }) });
    expect(await calistir(['yaz', ...TEMEL, '--onay', 'ONAY-a-000000000000'], bag)).toBe(2);
    expect(yakala.satirlar[0]).toBe('HATA AYAR_HATASI neden=URL_GECERSIZ degisken=ASTRA_SUPABASE_URL');
    expect(yakala.metin()).not.toContain('evil');
    expect(fabrika.cagri()).toBe(0);
  });
});

describe('calistir: kuru-calistir', () => {
  it('çıkış 0, onay kodlu rapor yazar; yazıcı hiç kurulmaz (ağ/kimlik yok)', async () => {
    const { bag, fabrika, depo } = kurulum();
    expect(await calistir(['kuru-calistir', ...TEMEL], bag)).toBe(0);
    expect(yakala.satirlar[0]!.split('\n')[0]).toMatch(/^ARAC 15\.0\.0 DALGA a HEDEF abcd\.\.\. \([0-9a-f]{8}\)$/);
    expect(yakala.metin()).toMatch(/ONAY_KODU ONAY-a-[0-9a-f]{12}/);
    expect(fabrika.cagri()).toBe(0);
    expect(depo.begeniler.length + depo.eslesme.length + depo.uygulamaDurumu.size).toBe(0);
  });
  it('komut verilmezse kuru-calistir varsayılandır', async () => {
    const { bag } = kurulum();
    expect(await calistir(TEMEL, bag)).toBe(0);
    expect(yakala.metin()).toContain('ONAY_KODU');
  });
  it('--json ve --rapor: JSON çıktı şemadan geçer; dosya aynı raporu içerir', async () => {
    const { bag } = kurulum();
    const yol = join(kok, 'rapor.json');
    expect(await calistir(['kuru-calistir', ...TEMEL, '--json', '--rapor', yol], bag)).toBe(0);
    const ekran = raporDogrula(JSON.parse(yakala.satirlar[0]!));
    const dosya = raporDogrula(JSON.parse(readFileSync(yol, 'utf8')));
    expect(dosya).toEqual(ekran);
    expect(ekran.hedef_proje_kisa).toBe('abcd...');
  });
  it('--sessiz ekrana rapor yazmaz', async () => {
    const { bag } = kurulum();
    expect(await calistir(['kuru-calistir', ...TEMEL, '--sessiz'], bag)).toBe(0);
    expect(yakala.satirlar).toEqual([]);
  });
  it('olmayan girdi dosyası çıkış 1 ve GIRDI_HATASI verir (gerçek dosya kaynağı)', async () => {
    const { bag } = kurulum({ planKaynagi: undefined });
    expect(await calistir(['kuru-calistir', '--dalga', 'a', '--girdi', join(kok, 'yok.json')], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA GIRDI_HATASI neden=DOSYA_OKUNAMADI');
    expect(yakala.metin()).not.toContain(kok);
  });
  it('gerçek dosya kaynağı: yedek JSON\'dan plan kurar ve bellek kaynağıyla aynı kodu verir', async () => {
    const girdi = join(kok, 'yedek.json');
    writeFileSync(girdi, JSON.stringify(sentetikSUret()));
    const gercek = kurulum({ planKaynagi: undefined });
    expect(await calistir(['kuru-calistir', '--dalga', 'a', '--girdi', girdi], gercek.bag)).toBe(0);
    const kodGercek = onayKodu(yakala.metin());
    const bellek = kurulum({ planKaynagi: { girdiYukle: kurulum().bag.planKaynagi!.girdiYukle, ilgiOku: () => undefined } });
    yakala.satirlar.length = 0;
    expect(await calistir(['kuru-calistir', '--dalga', 'a', '--girdi', 'x'], bellek.bag)).toBe(0);
    expect(onayKodu(yakala.metin())).toBe(kodGercek);
  });
  it('şifreli girdi çıkış 1 ve SIFRELI_GIRDI verir', async () => {
    const { bag } = kurulum({ planKaynagi: undefined });
    const yol = join(kok, 'sifreli.json');
    writeFileSync(yol, JSON.stringify({ v: 1, i: 'AAAA', d: 'BBBB' }));
    expect(await calistir(['kuru-calistir', '--dalga', 'a', '--girdi', yol], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA GIRDI_HATASI neden=SIFRELI_GIRDI');
  });
});

describe('calistir: yaz (onay kapısı)', () => {
  it('--onay yoksa çıkış 1, ONAY_UYUSMADI ve yazıcı fabrikası 0 kez çağrılır', async () => {
    const { bag, fabrika } = kurulum();
    expect(await calistir(['yaz', ...TEMEL], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA ONAY_UYUSMADI');
    expect(fabrika.cagri()).toBe(0);
  });
  it.each([[''], ['ONAY-a-000000000000'], ['yanlis'], ['ONAY-geri-000000000000']])('--onay %j: çıkış 1, hiçbir yazma yok, oturum açılmaz', async (onay) => {
    const { bag, fabrika, depo } = kurulum();
    expect(await calistir(['yaz', ...TEMEL, '--onay', onay], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA ONAY_UYUSMADI');
    expect(fabrika.cagri()).toBe(0);
    expect(depo.begeniler.length + depo.eslesme.length + depo.uygulamaDurumu.size).toBe(0);
  });
  it('--onay değersiz bırakılırsa (sonraki bayrak) boş sayılır ve yazılmaz', async () => {
    const { bag, fabrika } = kurulum();
    expect(await calistir(['yaz', ...TEMEL, '--onay', '--json'], bag)).toBe(1);
    expect(fabrika.cagri()).toBe(0);
  });
  it('başka dalganın kodu yazmayı engeller (b kodu ile a yazılamaz)', async () => {
    const { bag, fabrika } = kurulum();
    const bKodu = await (async () => {
      yakala.satirlar.length = 0;
      await calistir(['kuru-calistir', '--dalga', 'b', '--girdi', 'x'], bag);
      return onayKodu(yakala.metin(), 'ONAY-b-');
    })();
    expect(await calistir(['yaz', ...TEMEL, '--onay', bKodu], bag)).toBe(1);
    expect(fabrika.cagri()).toBe(0);
  });
  it('dalga b doğru koduyla bile DALGA_YAZICI_YOK ile çıkış 1 verir, oturum açılmaz', async () => {
    const { bag, fabrika } = kurulum();
    yakala.satirlar.length = 0;
    await calistir(['kuru-calistir', '--dalga', 'b', '--girdi', 'x'], bag);
    const bKodu = onayKodu(yakala.metin(), 'ONAY-b-');
    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', '--dalga', 'b', '--girdi', 'x', '--onay', bKodu], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA DALGA_YAZICI_YOK dalga=b');
    expect(fabrika.cagri()).toBe(0);
  });
  it('kuru çalıştırmadan sonra girdi değişirse eski kod geçmez', async () => {
    const depo = bellekDeposuKur();
    const ilk = kurulum({}, sentetikSUret(), depo);
    const kod = await kuruKodu(ilk.bag);
    const degisik = sentetikSUret();
    degisik.diger.apps['tr-chip'] = '{"degisti":true}';
    const ikinci = kurulum({}, degisik, depo);
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], ikinci.bag)).toBe(1);
    expect(ikinci.fabrika.cagri()).toBe(0);
  });
});

describe('calistir: yaz / dogrula / geri-al / yetim-tara akışı', () => {
  it('kuru → yaz → dogrula → ikinci yaz → geri-al zinciri', async () => {
    const { bag, depo, fabrika } = kurulum();
    const kod = await kuruKodu(bag);

    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], bag)).toBe(0);
    expect(yakala.satirlar).toContain('SONUC YAZ_TAMAM aktarim_id=11111111-1111-4111-8111-000000000001 dalga=a');
    expect(yakala.satirlar).toContain('SONUC YAZILAN tablo=begeniler sayi=6');
    expect(yakala.satirlar).toContain('SONUC YAZILAN tablo=uygulama_durumu sayi=16');
    expect(depo.begeniler).toHaveLength(6);

    yakala.satirlar.length = 0;
    expect(await calistir(['dogrula', ...TEMEL], bag)).toBe(0);
    expect(yakala.satirlar.at(-1)).toBe('SONUC DOGRULAMA_TAMAM fark_sayisi=0');

    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], bag)).toBe(0);
    expect(yakala.satirlar.some((x) => x.startsWith('SONUC YAZILAN'))).toBe(false);
    expect(yakala.satirlar).toContain('SONUC OZET sahiplenilen=0 atlanan_eslesme=22 belirsiz=0 eslesme_yazilan=0 yetim_olabilir=0');
    expect(depo.begeniler).toHaveLength(6);

    /* geri al: önce kuru (kod verir), sonra kodla */
    yakala.satirlar.length = 0;
    expect(await calistir(['geri-al', '--aktarim', '11111111-1111-4111-8111-000000000001'], bag)).toBe(0);
    const geriKod = onayKodu(yakala.metin(), 'ONAY-geri-');
    expect(depo.begeniler.every((b) => b.silindi_at === null)).toBe(true);
    yakala.satirlar.length = 0;
    expect(await calistir(['geri-al', '--aktarim', '11111111-1111-4111-8111-000000000001', '--onay', geriKod], bag)).toBe(0);
    expect(yakala.satirlar.some((x) => x.startsWith('SONUC GERI_AL_TAMAM gizlenen_satir=6'))).toBe(true);
    expect(depo.begeniler.every((b) => b.silindi_at !== null)).toBe(true);
    expect(fabrika.uretilen.length).toBeGreaterThan(0);
    expect(fabrika.uretilen.every((y) => y.kapatildiMi())).toBe(true);
  });

  it('geri-al yanlış kodla çıkış 1 verir ve hiçbir şey gizlenmez', async () => {
    const { bag, depo } = kurulum();
    const kod = await kuruKodu(bag);
    await calistir(['yaz', ...TEMEL, '--onay', kod], bag);
    yakala.satirlar.length = 0;
    expect(await calistir(['geri-al', '--dalga', 'a', '--onay', 'ONAY-geri-000000000000'], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA ONAY_UYUSMADI');
    expect(depo.begeniler.every((b) => b.silindi_at === null)).toBe(true);
  });

  it('dogrula yazılmamış hedefte çıkış 1 ve fark tablosu verir', async () => {
    const { bag } = kurulum();
    expect(await calistir(['dogrula', ...TEMEL], bag)).toBe(1);
    expect(yakala.satirlar).toContain('FARK FARK_VAR kontrol=uygulama_durumu_anahtar kaynak=16 hedef=0 fark=-16');
    expect(yakala.satirlar.at(-1)).toMatch(/^FARK DOGRULAMA_FARKI fark_sayisi=5$/);
  });

  it('yazma yarıda kesilirse çıkış 1 ve YAZ_YARIM; yeniden çalıştırma tamamlar', async () => {
    const depo = bellekDeposuKur();
    const { bag } = kurulum({}, sentetikSUret(), depo);
    const kod = await kuruKodu(bag);
    let ilk = true;
    const bozucu: Bagimlilik = {
      ...bag,
      yaziciKur: async () => {
        const y = await bag.yaziciKur();
        if (ilk) {
          ilk = false;
          (y as unknown as { hataEnjekte: (h: unknown) => void }).hataEnjekte({ n: 3, yontem: 'uygulamaDurumuYaz', kod: '23505', ayrinti: `${CANARY_AD} ${CANARY_IBAN}` });
        }
        return y;
      },
    };
    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], bozucu)).toBe(1);
    expect(yakala.satirlar.some((x) => x.includes('YAZ_YARIM'))).toBe(true);
    expect(yakala.satirlar.at(-1)).toBe('HATA YAZMA_DURDU neden=23505 durum=0 tablo=uygulama_durumu');
    expect(canaryBul(yakala.metin())).toEqual([]);
    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], bozucu)).toBe(0);
    expect(depo.begeniler).toHaveLength(6);
    expect([...depo.uygulamaDurumu.values()].reduce((t, m) => t + m.size, 0)).toBe(16);
  });

  it('yetim-tara temiz depoda çıkış 0 verir', async () => {
    const { bag } = kurulum();
    const kod = await kuruKodu(bag);
    await calistir(['yaz', ...TEMEL, '--onay', kod], bag);
    yakala.satirlar.length = 0;
    expect(await calistir(['yetim-tara', '--baslangic', '2026-06-01T00:00:00Z'], bag)).toBe(0);
    expect(yakala.satirlar).toEqual(['SONUC YETIM_TARAMA taranan=6 yetim=0']);
  });
});

describe('calistir: beklenmeyen/oturum hataları', () => {
  it('yazıcı kurulurken OturumHatasi: çıkış 1, kalan deneme sayısı yazılır, PIN yazılmaz', async () => {
    const { bag } = kurulum();
    const kod = await kuruKodu(bag);
    const bozuk: Bagimlilik = { ...bag, yaziciKur: async () => { throw new OturumHatasi('PIN_HATALI', 2); } };
    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], bozuk)).toBe(1);
    expect(yakala.satirlar).toEqual(['HATA OTURUM_HATASI neden=PIN_HATALI kalan=2']);
  });
  it('tanınmayan hata (mesajında canary) BEKLENMEYEN_HATA olarak yazılır, mesaj yazılmaz', async () => {
    const { bag } = kurulum();
    const kod = await kuruKodu(bag);
    const bozuk: Bagimlilik = { ...bag, yaziciKur: async () => { throw new Error(`${CANARY_AD} ${CANARY_IBAN}`); } };
    yakala.satirlar.length = 0;
    expect(await calistir(['yaz', ...TEMEL, '--onay', kod], bozuk)).toBe(1);
    expect(yakala.satirlar).toEqual(['HATA BEKLENMEYEN_HATA']);
  });
});

describe('calistir: statik-yukle', () => {
  function statikKurulum() {
    const icerik = new Map<string, Uint8Array>();
    const dosyalar = STATIK_UYGULAMALAR.flatMap((u) =>
      ['hero.json', 'kucuk.json', 'detay/01.json'].map((g) => {
        const bayt = new TextEncoder().encode(JSON.stringify({ yol: `${u}/${g}`, ad: CANARY_AD }));
        icerik.set(`${u}/${g}`, bayt);
        return { bilgi: { yol: `${u}/${g}`, uygulama: u, boyut: bayt.byteLength, sha256: sha256HexBayt(bayt), json_gecerli: true }, oku: () => bayt };
      }),
    );
    const yukleyici = bellekStatikYukleyiciKur();
    const yukleyiciKur = vi.fn(() => yukleyici);
    const { bag } = kurulum({ statikTara: () => ({ dosyalar, yoksayilan: 0, sorunlar: [] }), statikYukleyiciKur: yukleyiciKur });
    return { bag, yukleyici, yukleyiciKur, icerik };
  }

  it('kuru çalıştırma onay kodunu verir; yükleyici (servis anahtarı) kurulmaz', async () => {
    const { bag, yukleyiciKur } = statikKurulum();
    expect(await calistir(['statik-yukle', '--kaynak', 'sahte'], bag)).toBe(0);
    expect(yakala.metin()).toMatch(/SONUC ONAY_KODU kod=ONAY-statik-[0-9a-f]{12}/);
    expect(yukleyiciKur).not.toHaveBeenCalled();
  });
  it.each([[''], ['ONAY-statik-000000000000'], ['ONAY-a-000000000000']])('yanlış kod %j: çıkış 1, yükleyici kurulmaz', async (onay) => {
    const { bag, yukleyiciKur, yukleyici } = statikKurulum();
    expect(await calistir(['statik-yukle', '--kaynak', 'sahte', '--onay', onay], bag)).toBe(1);
    expect(yakala.satirlar[0]).toBe('HATA ONAY_UYUSMADI');
    expect(yukleyiciKur).not.toHaveBeenCalled();
    expect(yukleyici.yuklemeCagrisi).toBe(0);
  });
  it('doğru kodla yükler, çıkış 0', async () => {
    const { bag, yukleyici, icerik } = statikKurulum();
    await calistir(['statik-yukle', '--kaynak', 'sahte'], bag);
    const kod = onayKodu(yakala.metin(), 'ONAY-statik-');
    yakala.satirlar.length = 0;
    expect(await calistir(['statik-yukle', '--kaynak', 'sahte', '--onay', kod], bag)).toBe(0);
    expect(yukleyici.yuklenenYollar.sort()).toEqual([...icerik.keys()].sort());
    expect(yakala.satirlar.some((x) => x.includes('STATIK_YUKLE_TAMAM'))).toBe(true);
  });
  it('--kova dosyalar ve --ilgi reddedilir (çıkış 2, yükleyici kurulmaz)', async () => {
    const { bag, yukleyiciKur } = statikKurulum();
    expect(await calistir(['statik-yukle', '--kaynak', 'sahte', '--kova', 'dosyalar'], bag)).toBe(2);
    expect(yakala.satirlar[0]).toBe('HATA KULLANIM_HATASI neden=KAPSAM_DISI_DOSYALAR_KOVASI');
    expect(await calistir(['statik-yukle', '--kaynak', 'sahte', '--ilgi', 'i.json'], bag)).toBe(2);
    expect(yakala.satirlar.some((x) => x.includes('KAPSAM_DISI_ILGI'))).toBe(true);
    expect(yukleyiciKur).not.toHaveBeenCalled();
  });
  it('doğrulama farkı çıkış 1 verir', async () => {
    const { bag } = statikKurulum();
    const kod = await (async () => { await calistir(['statik-yukle', '--kaynak', 's'], bag); return onayKodu(yakala.metin(), 'ONAY-statik-'); })();
    const bozuk = bellekStatikYukleyiciKur({ indirmeyiBozYol: 'oynatma-listelerim/detay/01.json' });
    const bag2: Bagimlilik = { ...bag, statikYukleyiciKur: () => bozuk };
    yakala.satirlar.length = 0;
    expect(await calistir(['statik-yukle', '--kaynak', 's', '--onay', kod], bag2)).toBe(1);
    expect(yakala.satirlar.at(-1)).toBe('HATA YUKLEME_DURDU neden=STATIK_DOGRULAMA_FARKI durum=0 tablo=storage_objects');
  });
});

describe('calistir: ortam değerleri çıktıya sızmaz', () => {
  it('anon anahtar, PIN ve hedef URL hiçbir komut çıktısında görünmez', async () => {
    const ortam = testOrtami({ ASTRA_SUPABASE_ANON: CANARY_ANAHTAR, ASTRA_PIN: '987654', ASTRA_SERVIS_ANAHTARI: 'servis-sir-98765' });
    const { bag } = kurulum({ ortam });
    const kod = await kuruKodu(bag);
    await calistir(['yaz', ...TEMEL, '--onay', kod], bag);
    await calistir(['dogrula', ...TEMEL], bag);
    await calistir(['geri-al', '--dalga', 'a'], bag);
    await calistir(['yetim-tara'], bag);
    await calistir(['yaz', ...TEMEL, '--pin', '987654'], bag);
    const metin = yakala.metin();
    expect(metin).not.toContain('987654');
    expect(metin).not.toContain('servis-sir');
    expect(metin).not.toContain(TEST_URL);
    expect(metin).not.toContain('abcd1234');
    expect(canaryBul(metin)).toEqual([]);
    for (const c of CANARY_DEGERLERI) expect(metin.toLowerCase()).not.toContain(c.toLowerCase());
  });
});

describe('varsayilanBagimlilik', () => {
  it('gerçek bağımlılık sabit sürümü ve UUID üretecini içerir; fabrikalar çağrılmadıkça ağ/kimlik/oturum yoktur', () => {
    const b = varsayilanBagimlilik();
    expect(b.aracSurumu).toBe('15.0.0');
    expect(b.uuidUret()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(b.uuidUret()).not.toBe(b.uuidUret());
    expect(b.simdi()).toBeInstanceOf(Date);
    expect(b.ortam).toBeUndefined();
  });
});
