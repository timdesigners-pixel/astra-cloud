/* Komut paleti · doğal dil eşleştirme. Tarayıcıdan bağımsız saf mantık.
   Yazılan cümle sözcüklere ayrılır, dolgu sözcükleri atılır, Türkçe ekler kaba olarak kırpılır
   ("yedeklerimi" → "yedek") ve her komut adı + anahtar sözcükleriyle puanlanır.
   Her sözcük iki biçimle (yazıldığı gibi + kırpılmış) karşılaştırılır, iyisi alınır. */

export type Komut = {
  id: string; tur: string; ad: string; ac?: string; k?: string; sim?: string; sayfa?: string; grup?: string;
  eylemAd?: string; desen?: string; p?: Record<string, unknown>; eylem?: unknown;
};

export const kat = (s: unknown) => String(s == null ? '' : s)
  .toLocaleLowerCase('tr')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ı/g, 'i');

/* Cümlede anlam taşımayan dolgu sözcükleri (katlanmış biçimde). */
const DOLGU = new Set(('bir ve ile icin su bu o beni bana benim lutfen istiyorum isterim yap yapar misin '
  + 'et etmek ac acar goster git gel nasil nerede ne simdi hemen biraz tum butun hepsi olarak da de mi '
  + 'sayfa sayfasi sayfasina ekle kaydi').split(' '));

const EKLER = ['lerimizi', 'larimizi', 'lerimi', 'larimi', 'lerini', 'larini', 'lerden', 'lardan',
  'lerin', 'larin', 'leri', 'lari', 'imizi', 'umuzu', 'imi', 'umu', 'ami', 'emi', 'ini', 'unu',
  'ler', 'lar', 'im', 'um', 'am', 'em', 'ye', 'ya', 'yi', 'yu', 'den', 'dan', 'ten', 'tan',
  'de', 'da', 'te', 'ta', 'in', 'un', 'i', 'u', 'e', 'a'];
const CEKIM = ['leri', 'lari', 'ler', 'lar'];

export function kok(w: string): string {
  w = String(w).replace(/'.*$/, '');
  for (let tur = 0; tur < 2; tur++) {
    /* İkinci kırpma yalnız çoğul eki alır: "dosyalarım" → "dosyalar" → "dosya"; "dosya" → "dosy" olmaz. */
    const e = (tur ? CEKIM : EKLER).find(x => w.length - x.length >= 3 && w.endsWith(x));
    if (!e) break;
    w = w.slice(0, -e.length);
  }
  return w;
}

export const hamlar = (s: string) => kat(s).split(/[^a-z0-9'.-]+/)
  .map(w => w.replace(/'.*$/, '').replace(/^[.-]+|[.-]+$/g, ''))
  .filter(w => w.length >= 2 && !DOLGU.has(w));

export const bicimler = (s: string) => hamlar(s).map(w => [...new Set([w, kok(w)])]);

export function benzer(w: string, h: string): number {
  if (h === w) return 10;
  if ((h.startsWith(w) || w.startsWith(h)) && Math.min(w.length, h.length) >= 4) return 7;
  if (w.length >= 4 && h.includes(w)) return 4;
  return 0;
}

const HAVUZ = new WeakMap<Komut, { tum: string[]; ad: string[] }>();
function havuz(c: Komut) {
  let h = HAVUZ.get(c);
  if (!h) {
    h = { tum: bicimler(c.ad + ' ' + (c.k || '')).flat(), ad: bicimler(c.ad).flat() };
    HAVUZ.set(c, h);
  }
  return h;
}

/* Katalogdaki komutları sorguya göre puanlar; puanı yüksekten düşüğe, en çok `sinir` öğe. */
export function puanla(katalog: Komut[], q: string, sinir = 14): Komut[] {
  const ks = bicimler(q);
  if (!ks.length) return [];
  const sonuc: { c: Komut; puan: number }[] = [];
  for (const c of katalog) {
    const hv = havuz(c);
    let p = 0, tutan = 0;
    for (const bs of ks) {
      let en = 0, adda = 0;
      for (const w of bs) for (const h of hv.tum) { const d = benzer(w, h); if (d > en) en = d; }
      if (en) for (const w of bs) for (const h of hv.ad) if (benzer(w, h) >= 7) adda = 3;
      if (en) tutan++;
      p += en + adda;
    }
    if (p > 0) {
      /* Sorgudaki sözcüklerin hepsini karşılayan komut öne geçer. */
      if (tutan === ks.length && ks.length > 1) p += 4;
      /* Adında sorguda geçmeyen sözcük çok olan komut biraz geriler. */
      const fazla = bicimler(c.ad).filter(bs => !ks.some(qs => qs.some(w => bs.some(h => benzer(w, h) >= 7)))).length;
      p -= fazla * 0.5;
      if (c.tur === 'işlem') p += 0.25;
      sonuc.push({ c, puan: p });
    }
  }
  return sonuc.sort((a, b) => b.puan - a.puan).slice(0, sinir).map(x => x.c);
}

/* Addaki, sorguyla eşleşen sözcükleri işaretlemek için parçalar. */
export function vurguParcalari(ad: string, q: string): { t: string; es: boolean }[] {
  const ks = bicimler(q).flat();
  return String(ad).split(/(\s+)/).map(t => {
    const bs = bicimler(t).flat();
    return { t, es: !!bs.length && ks.some(w => bs.some(h => benzer(w, h) >= 7)) };
  });
}
