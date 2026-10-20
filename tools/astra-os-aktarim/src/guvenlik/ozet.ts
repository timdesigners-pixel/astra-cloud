/* SHA-256 özet yardımcıları. `node:crypto` yalnız burada kullanılır; `plan/` bu dosyadan içe aktarır (plan §9.2: plan/ içinde node:* yok). */
import { createHash, timingSafeEqual } from 'node:crypto';

export type OzetAkisi = { guncelle: (parca: string) => void; hex: () => string };

/* Parça parça beslenen özet (büyük planın tek metne çevrilmemesi için). `hex()` yalnız bir kez çağrılır. */
export function ozetOlustur(): OzetAkisi {
  const h = createHash('sha256');
  return {
    guncelle: (parca) => {
      h.update(parca, 'utf8');
    },
    hex: () => h.digest('hex'),
  };
}

export function sha256Hex(metin: string): string {
  const o = ozetOlustur();
  o.guncelle(metin);
  return o.hex();
}

/* Ham bayt özeti (dosya içeriği): UTF-8 dönüşümü olmadan bayt sadakati; statik yükleme doğrulaması için. */
export function sha256HexBayt(bayt: Uint8Array): string {
  return createHash('sha256').update(bayt).digest('hex');
}

/* Sabit süreli metin eşitliği (onay kodu karşılaştırması). Uzunluk farkı doğrudan false. */
export function sabitSureliEsitMi(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}
