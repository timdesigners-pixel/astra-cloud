import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANARY_AD, CANARY_PAROLA, canaryBul, sentetikSUret } from '@astra/ortak-test';
import { sessizAyarla } from '../cikti.ts';
import { ciktiYakala, sentetikPlanKur, type CiktiYakalayici } from '../test-destek.ts';
import { raporJsonu, raporMetni } from './rapor-metni.ts';
import { RaporHatasi, raporDogrula, type Rapor } from './rapor-sema.ts';
import { raporYaz } from './rapor-yaz.ts';

function rapor(): Rapor {
  return { ...sentetikPlanKur().plan.ozet, hedef_proje_kisa: 'abcd...' };
}

describe('raporJsonu', () => {
  it('doğrulanmış raporu girintili JSON olarak yazar ve geri okununca şemadan geçer', () => {
    const metin = raporJsonu(rapor());
    expect(metin).toContain('\n  "dalga": "a"');
    expect(raporDogrula(JSON.parse(metin))).toEqual(rapor());
  });
  it('şemaya uymayan raporu yazmaz', () => {
    expect(() => raporJsonu({ ...rapor(), kaynak_id: 'x' } as unknown as Rapor)).toThrowError(RaporHatasi);
  });
  it('canary değer içermez', () => {
    expect(canaryBul(raporJsonu(rapor()))).toEqual([]);
  });
});

describe('raporMetni', () => {
  it('başlık, onay kodu, tablo, kontrol toplamı, sayaç, atlanan, uyarı satırlarını üretir', () => {
    const r = rapor();
    const metin = raporMetni(r);
    const satirlar = metin.split('\n');
    expect(satirlar[0]).toBe(`ARAC 15.0.0 DALGA a HEDEF abcd... (${r.hedef_ref})`);
    expect(satirlar[1]).toBe(`ONAY_KODU ${r.onay_kodu}`);
    expect(metin).toContain('GIRDI mezar=3 bilinmeyen_anahtar=0 gecersiz_kayit=0');
    expect(metin).toContain('TABLO begeniler yeni=6 atlanan=2');
    expect(metin).toContain('TABLO uygulama_durumu yeni=16 atlanan=0');
    expect(metin).toContain('KONTROL begeniler_fiyat kurus=148564 (1485.64)');
    expect(metin).toContain('SAYAC uygulama_kaynak_anahtar=16');
    expect(metin).toContain('ATLANAN ilgi_urunleri AD_BOS x1');
    expect(metin).toContain('ATLANAN ilgi_urunleri KOD_TEKRAR x1');
    expect(metin).toContain('UYARI ilgi_urunleri GECERSIZ_TUTAR x1');
    expect(metin).toContain('  koleksiyon debts=');
  });
  it('proje kısaltması yoksa tire yazar; boş koleksiyon satırı yazılmaz; bilgi kodu BILGI satırıdır', () => {
    const { plan } = sentetikPlanKur({ ilgi: undefined });
    const metin = raporMetni(plan.ozet);
    expect(metin.split('\n')[0]).toMatch(/HEDEF - \(/);
    expect(metin).toContain('BILGI ILGI_KAYNAK_YOK');
    expect(metin).not.toMatch(/koleksiyon \w+=0/);
  });
  it('kuruş metni: negatif, tam sayı ve tek haneli kuruş doğru biçimlenir', () => {
    const r = rapor();
    const dene = (kurus: number): string => raporMetni({ ...r, kontrol_toplamlari: [{ ad: 'kk', kurus_toplami: kurus }] }).split('\n').find((s) => s.startsWith('KONTROL'))!;
    expect(dene(-12345)).toBe('KONTROL kk kurus=-12345 (-123.45)');
    expect(dene(5)).toBe('KONTROL kk kurus=5 (0.05)');
    expect(dene(0)).toBe('KONTROL kk kurus=0 (0.00)');
    expect(dene(100)).toBe('KONTROL kk kurus=100 (1.00)');
    expect(dene(-5)).toBe('KONTROL kk kurus=-5 (-0.05)');
  });
  it('şemaya uymayan raporu yazmaz', () => {
    expect(() => raporMetni({ ...rapor(), onay_kodu: 'yanlis' })).toThrowError(RaporHatasi);
  });
  it('canary değer içermez', () => {
    expect(canaryBul(raporMetni(rapor()))).toEqual([]);
  });
});

describe('raporMetni / raporJsonu: eslenmeyen_anahtarlar', () => {
  function eslenmeyenRapor(adlar: Record<string, string>): Rapor {
    const d = sentetikSUret();
    Object.assign(d.diger.apps, adlar);
    return { ...sentetikPlanKur({ s: d }).plan.ozet, hedef_proje_kisa: 'abcd...' };
  }

  it('her ad için "ESLENMEYEN_ANAHTAR <ad>" satırı yazar (sıra korunur)', () => {
    const satirlar = raporMetni(eslenmeyenRapor({ 'zeta-ayar': 'v', 'alfa-ayar': 'v' })).split('\n');
    expect(satirlar.filter((x) => x.startsWith('ESLENMEYEN_ANAHTAR'))).toEqual(['ESLENMEYEN_ANAHTAR alfa-ayar', 'ESLENMEYEN_ANAHTAR zeta-ayar']);
  });
  it('satırlar ATLANAN satırlarından sonra, UYARI satırlarından önce gelir', () => {
    const satirlar = raporMetni(eslenmeyenRapor({ 'yeni-ayar': 'v' })).split('\n');
    const ilk = satirlar.findIndex((x) => x.startsWith('ESLENMEYEN_ANAHTAR'));
    expect(satirlar[ilk - 1]).toMatch(/^ATLANAN /);
    expect(satirlar[ilk + 1]).toMatch(/^UYARI /);
    expect(satirlar.findIndex((x) => x.startsWith('ATLANAN apps ANAHTAR_ESLENMEDI'))).toBeLessThan(ilk);
  });
  it('alan yoksa hiç ESLENMEYEN_ANAHTAR satırı yoktur (metin biçimi değişmez)', () => {
    expect(raporMetni(rapor())).not.toContain('ESLENMEYEN_ANAHTAR');
  });
  it('boş dizi satır üretmez', () => {
    expect(raporMetni({ ...rapor(), eslenmeyen_anahtarlar: [] })).not.toContain('ESLENMEYEN_ANAHTAR');
  });
  it('DEĞER metinde ve JSON çıktıda ASLA yoktur (canary)', () => {
    const r = eslenmeyenRapor({ 'yeni-ayar': CANARY_PAROLA });
    expect(raporMetni(r)).not.toContain(CANARY_PAROLA);
    expect(raporJsonu(r)).not.toContain(CANARY_PAROLA);
    expect(canaryBul(raporMetni(r) + raporJsonu(r))).toEqual([]);
  });
  it('JSON alanı taşır ve geri okununca şemadan geçer', () => {
    const r = eslenmeyenRapor({ 'yeni-ayar': 'v' });
    const json = JSON.parse(raporJsonu(r)) as Record<string, unknown>;
    expect(json.eslenmeyen_anahtarlar).toEqual(['yeni-ayar']);
    expect(raporDogrula(json)).toEqual(r);
  });
  it('JSON: alan yoksa anahtar da yoktur', () => {
    expect('eslenmeyen_anahtarlar' in (JSON.parse(raporJsonu(rapor())) as object)).toBe(false);
  });
  it('şemaya uymayan ad (desen dışı) metin/JSON üretimini durdurur', () => {
    const kotu = { ...rapor(), eslenmeyen_anahtarlar: ['bosluk var'] };
    expect(() => raporMetni(kotu)).toThrowError(RaporHatasi);
    expect(() => raporJsonu(kotu)).toThrowError(RaporHatasi);
  });
});

describe('raporYaz', () => {
  let yakala: CiktiYakalayici;
  let kok = '';
  beforeEach(() => {
    yakala = ciktiYakala();
    kok = mkdtempSync(join(tmpdir(), 'aktarim-rapor-'));
  });
  afterEach(() => {
    yakala.birak();
    rmSync(kok, { recursive: true, force: true });
  });

  it('ekrana metin ya da JSON yazar', () => {
    raporYaz(rapor());
    expect(yakala.satirlar).toHaveLength(1);
    expect(yakala.satirlar[0]).toContain('ONAY_KODU ONAY-a-');
    raporYaz(rapor(), { json: true });
    expect(JSON.parse(yakala.satirlar[1]!)).toEqual(rapor());
  });

  it('--rapor dosyasına doğrulanmış JSON yazar (0600)', () => {
    const yol = join(kok, 'rapor.json');
    raporYaz(rapor(), { dosya: yol });
    const icerik = readFileSync(yol, 'utf8');
    expect(icerik.endsWith('\n')).toBe(true);
    expect(raporDogrula(JSON.parse(icerik))).toEqual(rapor());
    expect(statSync(yol).mode & 0o777).toBe(0o600);
    expect(canaryBul(icerik)).toEqual([]);
  });

  it('sessiz kipte ekrana yazmaz ama dosyayı yine yazar', () => {
    const yol = join(kok, 'rapor.json');
    sessizAyarla(true);
    raporYaz(rapor(), { dosya: yol });
    expect(yakala.satirlar).toEqual([]);
    expect(statSync(yol).isFile()).toBe(true);
  });

  it('şemaya uymayan rapor ne ekrana ne dosyaya yazılır', () => {
    const yol = join(kok, 'rapor.json');
    const kotu = { ...rapor(), atlanan: [{ koleksiyon: 'apps', neden_kodu: 'MEZAR_TASI', sayi: 1, kaynak_id: CANARY_AD }] } as unknown as Rapor;
    expect(() => raporYaz(kotu, { dosya: yol })).toThrowError(RaporHatasi);
    expect(yakala.satirlar).toEqual([]);
    expect(() => statSync(yol)).toThrowError();
  });

  it('var olan dosyanın üzerine yazar', () => {
    const yol = join(kok, 'rapor.json');
    writeFileSync(yol, 'eski icerik');
    raporYaz(rapor(), { dosya: yol });
    expect(readFileSync(yol, 'utf8')).not.toContain('eski');
  });
});
