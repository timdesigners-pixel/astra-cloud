import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { AZAMI_GIRDI_BAYT, girdiMetniOku, girdiYukle } from './dosya-oku.ts';
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
