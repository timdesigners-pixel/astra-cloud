import { serbestAnahtar, testBul } from './tahlil-katalog';

/* Rapordan kopyalanan metinden "Ad  değer  birim  alt - üst" biçimindeki satırları değer olarak çıkarır. */
export type AyiklananDeger = { test: string; ad: string; deger: number | null; metin: string | null; birim: string | null; ref_alt: number | null; ref_ust: number | null };

const SAYI = String.raw`[<>]?\s*\d+(?:[.,]\d+)?`;
const ARALIK = new RegExp(String.raw`\(?\s*(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*\)?`);
const SATIR = new RegExp(String.raw`^([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü0-9 .()/#%+-]*?)\s*[:\s]\s*(${SAYI})(.*)$`);
const GURULTU = /^(sayfa|page|tarih|protokol|hasta|doktor|barkod|tc|dogum|doğum|telefon|tel|yaş|yas|cinsiyet|örnek|ornek|kabul|onay|rapor|numune)/i;
const sayi = (s: string) => Number(s.replace(/[<>\s]/g, '').replace(',', '.'));

export function metindenAyikla(metin: string): AyiklananDeger[] {
  const cikti: AyiklananDeger[] = [];
  const goruldu = new Set<string>();
  for (const ham of metin.split(/\r?\n/)) {
    const satir = ham.replace(/\t/g, '  ').trim();
    if (satir.length < 4 || GURULTU.test(satir)) continue;
    const m = satir.match(SATIR);
    if (!m) continue;
    const ad = m[1]!.replace(/[:\s.]+$/, '').trim();
    if (ad.length < 2 || /^\d+$/.test(ad)) continue;
    const deger = sayi(m[2]!);
    if (!Number.isFinite(deger)) continue;
    const kalan = m[3]!.trim();
    const aralik = kalan.match(ARALIK);
    const bilgi = testBul(ad);
    // Katalogda tanınmayan bir ad ancak yanında referans aralığı varsa değer sayılır (tarih, numara gibi satırları elemek için).
    if (!bilgi && !aralik) continue;
    const birimAday = kalan.replace(ARALIK, '').trim().split(/\s+/)[0] ?? '';
    const birim = /^[A-Za-zµ%/0-9³⁶^.-]{1,14}$/.test(birimAday) && !/^\d+$/.test(birimAday) ? birimAday : (bilgi?.birim || null);
    const test = bilgi?.anahtar ?? serbestAnahtar(ad);
    if (goruldu.has(test)) continue;
    goruldu.add(test);
    cikti.push({
      test, ad: bilgi?.ad ?? ad, deger, metin: null, birim: birim || bilgi?.birim || null,
      ref_alt: aralik ? sayi(aralik[1]!) : bilgi?.alt ?? null, ref_ust: aralik ? sayi(aralik[2]!) : bilgi?.ust ?? null,
    });
  }
  return cikti;
}
