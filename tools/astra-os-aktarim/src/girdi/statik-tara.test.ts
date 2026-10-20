import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, canaryBul } from '@astra/ortak-test';
import { STATIK_UYGULAMALAR, statikPlanOlustur } from '../donusum/statik-plan-hesap.ts';
import { GirdiHatasi } from './girdi-hata.ts';
import { statikKokCoz, statikTara } from './statik-tara.ts';

let kok = '';
beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), 'aktarim-statik-'));
});
afterEach(() => {
  rmSync(kok, { recursive: true, force: true });
});

function yaz(goreli: string, icerik: string): void {
  const yol = join(kok, goreli);
  mkdirSync(join(yol, '..'), { recursive: true });
  writeFileSync(yol, icerik, 'utf8');
}

/* Tam ve geçerli iki uygulama ağacı; her dosyada canary içerik vardır. */
function tamAgac(taban = ''): void {
  for (const u of STATIK_UYGULAMALAR) {
    yaz(join(taban, u, 'hero.json'), JSON.stringify({ u, ad: CANARY_AD, tur: 'hero' }));
    yaz(join(taban, u, 'kucuk.json'), JSON.stringify({ u, tur: 'kucuk' }));
    yaz(join(taban, u, 'detay', '01.json'), JSON.stringify({ u, n: 1 }));
    yaz(join(taban, u, 'detay', '02.json'), JSON.stringify({ u, n: 2 }));
  }
}

describe('statikKokCoz', () => {
  it('<kaynak>/public/apps yapısını çözer', () => {
    tamAgac(join('public', 'apps'));
    expect(statikKokCoz(kok)).toBe(join(kok, 'public', 'apps'));
  });
  it('doğrudan public/apps dizinini de çözer', () => {
    tamAgac();
    expect(statikKokCoz(kok)).toBe(kok);
  });
  it('beyaz listeli klasör yoksa STATIK_KAYNAK_YOK verir', () => {
    yaz('baska/hero.json', '{}');
    expect(() => statikKokCoz(kok)).toThrowError(GirdiHatasi);
    try {
      statikKokCoz(kok);
    } catch (e) {
      expect((e as GirdiHatasi).kod).toBe('STATIK_KAYNAK_YOK');
    }
  });
  it('olmayan yol STATIK_KAYNAK_YOK, boş yol GIRDI_YOLU_YOK verir', () => {
    expect(() => statikKokCoz(join(kok, 'yok'))).toThrowError(/STATIK_KAYNAK_YOK/);
    expect(() => statikKokCoz('')).toThrowError(/GIRDI_YOLU_YOK/);
    expect(() => statikKokCoz('   ')).toThrowError(/GIRDI_YOLU_YOK/);
  });
});

describe('statikTara', () => {
  it('tam ağacı tarar: 8 dosya, sha256 ve boyut doğru, sorun yok', () => {
    tamAgac();
    const sonuc = statikTara(kok);
    expect(sonuc.sorunlar).toEqual([]);
    expect(sonuc.yoksayilan).toBe(0);
    expect(sonuc.dosyalar).toHaveLength(8);
    for (const d of sonuc.dosyalar) {
      const bayt = d.oku();
      expect(d.bilgi.boyut).toBe(bayt.byteLength);
      expect(d.bilgi.sha256).toBe(createHash('sha256').update(bayt).digest('hex'));
      expect(d.bilgi.json_gecerli).toBe(true);
      expect(d.bilgi.yol.startsWith(`${d.bilgi.uygulama}/`)).toBe(true);
    }
    expect(sonuc.dosyalar.map((d) => d.bilgi.yol).sort()).toEqual([
      'oynatma-listelerim/detay/01.json', 'oynatma-listelerim/detay/02.json', 'oynatma-listelerim/hero.json', 'oynatma-listelerim/kucuk.json',
      'pinterest-panolarim/detay/01.json', 'pinterest-panolarim/detay/02.json', 'pinterest-panolarim/hero.json', 'pinterest-panolarim/kucuk.json',
    ]);
  });

  it('tarama sonucu içerik DEĞERİ taşımaz (yalnız yol, boyut, sha256, bayrak)', () => {
    tamAgac();
    const { dosyalar } = statikTara(kok);
    expect(canaryBul(JSON.stringify(dosyalar.map((d) => d.bilgi)))).toEqual([]);
    expect(canaryBul(Buffer.from(dosyalar.find((d) => d.bilgi.yol.endsWith('/hero.json'))!.oku()).toString('utf8'))).not.toEqual([]);
  });

  it('beyaz liste dışı girdileri yok sayar ve yalnız sayar (index.html, detay/abc.json, diğer dosyalar)', () => {
    tamAgac();
    yaz('oynatma-listelerim/index.html', '<html></html>');
    yaz('oynatma-listelerim/notlar.txt', 'x');
    yaz('oynatma-listelerim/dosyalar/x.json', '{}');
    yaz('oynatma-listelerim/detay/abc.json', '{}');
    yaz('oynatma-listelerim/detay/1.json', '{}');
    yaz('pinterest-panolarim/detay/001.json', '{}');
    const sonuc = statikTara(kok);
    expect(sonuc.dosyalar).toHaveLength(8);
    expect(sonuc.sorunlar).toEqual([]);
    /* index.html, notlar.txt, dosyalar (klasör), detay/abc, detay/1, detay/001 */
    expect(sonuc.yoksayilan).toBe(6);
    expect(sonuc.dosyalar.map((d) => d.bilgi.yol).some((y) => /index|notlar|dosyalar|abc|\/1\.json|001/.test(y))).toBe(false);
  });

  it('bozuk JSON dosyasını json_gecerli=false ile işaretler; plan JSON_GECERSIZ sayar', () => {
    tamAgac();
    yaz('oynatma-listelerim/detay/02.json', `{"a": "${CANARY_AD}`);
    const sonuc = statikTara(kok);
    const bozuk = sonuc.dosyalar.find((d) => d.bilgi.yol === 'oynatma-listelerim/detay/02.json')!;
    expect(bozuk.bilgi.json_gecerli).toBe(false);
    const plan = statikPlanOlustur({ dosyalar: sonuc.dosyalar.map((d) => d.bilgi), taramaSorunlari: sonuc.sorunlar, anaMakine: 'abcd1234.supabase.co', aracSurumu: '15.0.0' });
    expect(plan.sorunlar).toEqual([{ kod: 'JSON_GECERSIZ', sayi: 1 }]);
    expect(plan.onay_kodu).toBeNull();
  });

  it('eksik uygulama klasörü UYGULAMA_YOK, eksik dosyalar DOSYA_YOK, eksik detay DETAY_YOK verir', () => {
    yaz('oynatma-listelerim/hero.json', '{}');
    mkdirSync(join(kok, 'pinterest-panolarim'));
    const sonuc = statikTara(kok);
    /* oynatma: kucuk.json yok, detay yok ; pinterest: hero+kucuk yok, detay yok */
    expect(sonuc.sorunlar.sort()).toEqual(['DETAY_YOK', 'DETAY_YOK', 'DOSYA_YOK', 'DOSYA_YOK', 'DOSYA_YOK']);
    expect(sonuc.dosyalar).toHaveLength(1);
  });

  it('klasörde hiç NN.json yoksa DETAY_YOK verir', () => {
    tamAgac();
    rmSync(join(kok, 'pinterest-panolarim', 'detay', '01.json'));
    rmSync(join(kok, 'pinterest-panolarim', 'detay', '02.json'));
    expect(statikTara(kok).sorunlar).toEqual(['DETAY_YOK']);
  });

  it('uygulama klasörlerinden biri hiç yoksa UYGULAMA_YOK verir', () => {
    tamAgac();
    rmSync(join(kok, 'pinterest-panolarim'), { recursive: true });
    expect(statikTara(kok).sorunlar).toEqual(['UYGULAMA_YOK']);
  });

  it('sembolik bağlantılı dosya SEMBOLIK_BAGLANTI sayılır ve okunmaz', () => {
    tamAgac();
    const hedef = join(kok, 'gercek-dosya.json');
    writeFileSync(hedef, '{"gizli":true}');
    rmSync(join(kok, 'oynatma-listelerim', 'hero.json'));
    symlinkSync(hedef, join(kok, 'oynatma-listelerim', 'hero.json'));
    const sonuc = statikTara(kok);
    expect(sonuc.sorunlar).toEqual(['SEMBOLIK_BAGLANTI']);
    expect(sonuc.dosyalar.map((d) => d.bilgi.yol)).not.toContain('oynatma-listelerim/hero.json');
  });

  it('sembolik bağlantılı uygulama ve detay klasörleri izlenmez', () => {
    tamAgac();
    const dis = join(kok, 'dis-klasor');
    mkdirSync(join(dis, 'detay'), { recursive: true });
    writeFileSync(join(dis, 'hero.json'), '{}');
    rmSync(join(kok, 'pinterest-panolarim'), { recursive: true });
    symlinkSync(dis, join(kok, 'pinterest-panolarim'));
    rmSync(join(kok, 'oynatma-listelerim', 'detay'), { recursive: true });
    symlinkSync(join(dis, 'detay'), join(kok, 'oynatma-listelerim', 'detay'));
    const sonuc = statikTara(kok);
    expect(sonuc.sorunlar.sort()).toEqual(['SEMBOLIK_BAGLANTI', 'SEMBOLIK_BAGLANTI']);
    expect(sonuc.dosyalar.map((d) => d.bilgi.yol).sort()).toEqual(['oynatma-listelerim/hero.json', 'oynatma-listelerim/kucuk.json']);
  });

  it('oku() dosyayı her çağrıda diskten yeniden okur', () => {
    tamAgac();
    const d = statikTara(kok).dosyalar.find((x) => x.bilgi.yol === 'oynatma-listelerim/kucuk.json')!;
    const once = Buffer.from(d.oku()).toString('utf8');
    yaz('oynatma-listelerim/kucuk.json', '{"degisti":true}');
    expect(Buffer.from(d.oku()).toString('utf8')).not.toBe(once);
  });

  it('tarama kaynak dizini DEĞİŞTİRMEZ (yazmaz, silmez)', () => {
    tamAgac();
    const once = statikTara(kok).dosyalar.map((d) => d.bilgi.sha256);
    statikTara(kok);
    expect(statikTara(kok).dosyalar.map((d) => d.bilgi.sha256)).toEqual(once);
  });
});
