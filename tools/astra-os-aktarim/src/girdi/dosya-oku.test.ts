import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { AZAMI_GIRDI_BAYT, girdiMetniOku, girdiYukle, raporYoluDenetle } from './dosya-oku.ts';
import { GirdiHatasi } from './girdi-hata.ts';

let kok = '';
beforeEach(() => {
  kok = mkdtempSync(join(tmpdir(), 'aktarim-test-'));
});
afterEach(() => {
  rmSync(kok, { recursive: true, force: true });
});

function kodAl(f: () => unknown): GirdiHatasi {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(GirdiHatasi);
    return e as GirdiHatasi;
  }
  throw new Error('hata bekleniyordu');
}

describe('girdiMetniOku', () => {
  it('dosyayı UTF-8 metin olarak okur', () => {
    const yol = join(kok, 'girdi.json');
    writeFileSync(yol, '{"ç":"ğ"}', 'utf8');
    expect(girdiMetniOku(yol)).toBe('{"ç":"ğ"}');
  });

  it.each([[''], ['   ']])('boş yol %j GIRDI_YOLU_YOK verir', (yol) => {
    expect(kodAl(() => girdiMetniOku(yol)).kod).toBe('GIRDI_YOLU_YOK');
  });

  it('metin olmayan yol GIRDI_YOLU_YOK verir', () => {
    expect(kodAl(() => girdiMetniOku(undefined as unknown as string)).kod).toBe('GIRDI_YOLU_YOK');
  });

  it('olmayan dosya DOSYA_OKUNAMADI verir ve mesaj yolu içermez', () => {
    const yol = join(kok, `${CANARY_AD.replace(/\s/g, '-')}-yok.json`);
    const e = kodAl(() => girdiMetniOku(yol));
    expect(e.kod).toBe('DOSYA_OKUNAMADI');
    expect(e.message).not.toContain(kok);
    expect(canaryBul(e.message.replace(/-/g, ' '))).toEqual([]);
  });

  it('dizin DOSYA_OKUNAMADI verir', () => {
    const dizin = join(kok, 'klasor');
    mkdirSync(dizin);
    expect(kodAl(() => girdiMetniOku(dizin)).kod).toBe('DOSYA_OKUNAMADI');
  });

  it('sınırı aşan dosya okunmadan GIRDI_COK_BUYUK verir', () => {
    const yol = join(kok, 'dev.json');
    writeFileSync(yol, '');
    truncateSync(yol, AZAMI_GIRDI_BAYT + 1); /* seyrek dosya: diskte yer tutmaz */
    expect(kodAl(() => girdiMetniOku(yol)).kod).toBe('GIRDI_COK_BUYUK');
  });
});

describe('girdiYukle', () => {
  it('dosyadan S okur (BOM\'lu dosya dahil)', () => {
    const yol = join(kok, 'yedek.json');
    writeFileSync(yol, '﻿' + JSON.stringify(sentetikSUret()), 'utf8');
    const sonuc = girdiYukle(yol);
    expect(sonuc.ozet.silinen_mezar_sayisi).toBe(3);
  });

  it('bozuk dosya içeriği BOZUK_JSON verir', () => {
    const yol = join(kok, 'bozuk.json');
    writeFileSync(yol, '{"koleksiyon":', 'utf8');
    expect(kodAl(() => girdiYukle(yol)).kod).toBe('BOZUK_JSON');
  });

  it('boş dosya GIRDI_BOS verir', () => {
    const yol = join(kok, 'bos.json');
    writeFileSync(yol, '');
    expect(kodAl(() => girdiYukle(yol)).kod).toBe('GIRDI_BOS');
  });
});

describe('raporYoluDenetle', () => {
  const ICERIK = 'SENTETIK-YEDEK-ICERIGI';
  function girdiDosyasi(ad = 'yedek.json'): string {
    const yol = join(kok, ad);
    writeFileSync(yol, ICERIK, 'utf8');
    return yol;
  }

  it('yeni (olmayan) rapor yolu TAMAM verir; hiçbir şey oluşturmaz', () => {
    const girdi = girdiDosyasi();
    const rapor = join(kok, 'rapor.json');
    expect(raporYoluDenetle(rapor, [girdi])).toBe('TAMAM');
    expect(() => readFileSync(rapor)).toThrow();
  });

  it('girdiden ayrı, var olan sıradan dosya TAMAM verir (üzerine yazma kararı bu işlevin değil)', () => {
    const girdi = girdiDosyasi();
    const rapor = join(kok, 'eski-rapor.json');
    writeFileSync(rapor, 'eski', 'utf8');
    expect(raporYoluDenetle(rapor, [girdi])).toBe('TAMAM');
    expect(readFileSync(rapor, 'utf8')).toBe('eski');
  });

  it('rapor yolu girdi yoluyla aynıysa CAKISIYOR (içerik dokunulmaz)', () => {
    const girdi = girdiDosyasi();
    expect(raporYoluDenetle(girdi, [girdi])).toBe('CAKISIYOR');
    expect(readFileSync(girdi, 'utf8')).toBe(ICERIK);
  });

  it('aynı dosyaya "./" ve ".." ile dolaylı yol CAKISIYOR', () => {
    const girdi = girdiDosyasi();
    mkdirSync(join(kok, 'alt'));
    expect(raporYoluDenetle(join(kok, 'alt', '..', 'yedek.json'), [girdi])).toBe('CAKISIYOR');
    expect(raporYoluDenetle(join(kok, '.', 'yedek.json'), [girdi])).toBe('CAKISIYOR');
  });

  it('korunan yol sembolik bağlantıysa ve rapor gerçek dosyaysa CAKISIYOR (çözülmüş yol)', () => {
    const gercek = girdiDosyasi('gercek.json');
    const baglanti = join(kok, 'girdi-baglanti.json');
    symlinkSync(gercek, baglanti);
    expect(raporYoluDenetle(gercek, [baglanti])).toBe('CAKISIYOR');
  });

  it('sert bağlantı (farklı yol, aynı dev+ino) CAKISIYOR', () => {
    const girdi = girdiDosyasi();
    const sert = join(kok, 'sert.json');
    linkSync(girdi, sert);
    expect(raporYoluDenetle(sert, [girdi])).toBe('CAKISIYOR');
    expect(readFileSync(girdi, 'utf8')).toBe(ICERIK);
  });

  it('rapor, --kaynak dizininin içindeyse CAKISIYOR (var olmayan dosya ve alt dizin dahil)', () => {
    const kaynak = join(kok, 'kaynak');
    mkdirSync(join(kaynak, 'detay'), { recursive: true });
    expect(raporYoluDenetle(join(kaynak, 'rapor.json'), [undefined, undefined, kaynak])).toBe('CAKISIYOR');
    expect(raporYoluDenetle(join(kaynak, 'detay', 'rapor.json'), [kaynak])).toBe('CAKISIYOR');
  });

  it('sınır: ad öneki aynı olan kardeş dizin çakışma değildir ("kaynak2" ≠ "kaynak" altı)', () => {
    const kaynak = join(kok, 'kaynak');
    mkdirSync(kaynak);
    mkdirSync(join(kok, 'kaynak2'));
    expect(raporYoluDenetle(join(kok, 'kaynak2', 'rapor.json'), [kaynak])).toBe('TAMAM');
    expect(raporYoluDenetle(join(kok, 'kaynak-rapor.json'), [kaynak])).toBe('TAMAM');
  });

  it('rapor sembolik bağlantıysa SEMBOLIK_BAGLANTI (hedef ezilmez)', () => {
    const baska = join(kok, 'baska-dosya.txt');
    writeFileSync(baska, 'KORUNAN', 'utf8');
    const baglanti = join(kok, 'rapor-baglanti.json');
    symlinkSync(baska, baglanti);
    expect(raporYoluDenetle(baglanti, [girdiDosyasi()])).toBe('SEMBOLIK_BAGLANTI');
    expect(readFileSync(baska, 'utf8')).toBe('KORUNAN');
  });

  it('kırık (hedefi olmayan) sembolik bağlantı da SEMBOLIK_BAGLANTI', () => {
    const baglanti = join(kok, 'kirik.json');
    symlinkSync(join(kok, 'olmayan-hedef.json'), baglanti);
    expect(raporYoluDenetle(baglanti, [])).toBe('SEMBOLIK_BAGLANTI');
  });

  it('sembolik bağlantı denetimi çakışma denetiminden önce gelir (girdiye işaret eden bağlantı)', () => {
    const girdi = girdiDosyasi();
    const baglanti = join(kok, 'rapor-girdiye.json');
    symlinkSync(girdi, baglanti);
    expect(raporYoluDenetle(baglanti, [girdi])).toBe('SEMBOLIK_BAGLANTI');
    expect(readFileSync(girdi, 'utf8')).toBe(ICERIK);
  });

  it('sınır: korunan liste boş, undefined ya da boşluklu girdilerden oluşuyorsa TAMAM', () => {
    const rapor = join(kok, 'rapor.json');
    expect(raporYoluDenetle(rapor, [])).toBe('TAMAM');
    expect(raporYoluDenetle(rapor, [undefined, undefined, undefined])).toBe('TAMAM');
    expect(raporYoluDenetle(rapor, ['', '   '])).toBe('TAMAM');
  });

  it('sınır: korunan yol okunamıyorsa (yok) hata fırlatmaz; yol karşılaştırması yapılır', () => {
    const rapor = join(kok, 'rapor.json');
    writeFileSync(rapor, 'eski', 'utf8');
    expect(raporYoluDenetle(rapor, [join(kok, 'olmayan-girdi.json')])).toBe('TAMAM');
    expect(raporYoluDenetle(join(kok, 'olmayan-girdi.json'), [join(kok, 'olmayan-girdi.json')])).toBe('CAKISIYOR');
  });

  it('sınır: üst dizini de olmayan rapor yolu hata fırlatmaz (yazma aşaması hata verir)', () => {
    expect(raporYoluDenetle(join(kok, 'yok', 'dizin', 'rapor.json'), [girdiDosyasi()])).toBe('TAMAM');
  });
});
