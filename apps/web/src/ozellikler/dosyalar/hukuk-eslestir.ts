/* Eski belge klasörlerini (ör. "2026-94", "2024-123 Ahmet Yılmaz") dava ve icra kayıtlarına eşler. Ağ ya da ekran bilgisi içermez. */
export type Aday = { tur: 'dava' | 'icra'; id: string; etiket: string; esas: string };
export type Parca = { f: File; yol: string[] };
export type Grup = { ad: string; anahtar: string | null; parcalar: Parca[]; boyut: number; adaylar: Aday[]; buyuk: number };
export type Secim = `dava:${string}` | `icra:${string}` | 'normal' | 'atla' | '';

export const AZAMI_DOSYA = 25 * 1024 * 1024;
const GURULTU = /^(thumbs\.db|\.ds_store|desktop\.ini|\.localized)$/i;

/** "2026/94", "2026-094", "E. 2026 / 94 Esas" gibi yazımları "2026-94" biçimine getirir; esas numarası yoksa null. */
export function esasAnahtari(s: string): string | null {
  const m = s.match(/(\d{4})\s*[-_./\\]\s*(\d{1,7})(?!\d)/);
  return m ? `${m[1]}-${Number(m[2])}` : null;
}

export const gurultuMu = (ad: string) => GURULTU.test(ad) || ad.startsWith('~$') || ad.startsWith('._');

/** Seçilen klasörün dosyalarını ilk alt klasöre göre gruplar. Seçilen klasörün kendisi bir esas numarasıysa tek grup olur. */
export function gruplaEsle(dosyalar: File[], adaylar: Aday[]): { gruplar: Grup[]; atlananGurultu: number; kokDosya: number } {
  const harita = new Map<string, Grup>();
  let atlananGurultu = 0, kokDosya = 0;
  const liste = dosyalar.filter(f => {
    if (gurultuMu(f.name) || f.size === 0) { atlananGurultu++; return false; }
    return true;
  }).map(f => ({ f, parcalar: (f.webkitRelativePath || f.name).split('/') }));
  const kokAd = liste[0]?.parcalar[0] ?? '';
  const altKlasorluMu = liste.some(x => x.parcalar.length >= 3 && esasAnahtari(x.parcalar[1]!) !== null);
  const tekDosya = !altKlasorluMu && esasAnahtari(kokAd) !== null;
  for (const { f, parcalar } of liste) {
    let ad: string, yol: string[];
    if (tekDosya) { ad = kokAd; yol = parcalar.slice(1, -1); }
    else if (parcalar.length >= 3) { ad = parcalar[1]!; yol = parcalar.slice(2, -1); }
    else { kokDosya++; continue; }
    const g = harita.get(ad) ?? { ad, anahtar: esasAnahtari(ad), parcalar: [], boyut: 0, adaylar: [], buyuk: 0 };
    if (f.size > AZAMI_DOSYA) g.buyuk++;
    else { g.parcalar.push({ f, yol }); g.boyut += f.size; }
    harita.set(ad, g);
  }
  const gruplar = [...harita.values()].map(g => ({ ...g, adaylar: g.anahtar ? adaylar.filter(a => esasAnahtari(a.esas) === g.anahtar) : [] }));
  gruplar.sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true }));
  return { gruplar, atlananGurultu, kokDosya };
}

/** Varsayılan seçim: tek aday varsa o, hiç yoksa sıradan klasör, birden çoksa kullanıcı seçsin. */
export const varsayilanSecim = (g: Grup): Secim => (g.adaylar.length === 1 ? `${g.adaylar[0]!.tur}:${g.adaylar[0]!.id}` : g.adaylar.length === 0 ? 'normal' : '');
