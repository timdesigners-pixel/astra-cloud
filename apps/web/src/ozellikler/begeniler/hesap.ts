import type { Begeni } from '../../veri/begeniler';

export const KATEGORILER: Record<string, { ad: string; simge: string }> = {
  elektronik: { ad: 'Elektronik', simge: '💻' }, giyim: { ad: 'Giyim', simge: '👕' }, ev: { ad: 'Ev Gereçleri', simge: '🏠' },
  beyaz: { ad: 'Beyaz Eşya', simge: '🧊' }, hobi: { ad: 'Kitap & Hobi', simge: '📚' }, 'kisisel-bakim': { ad: 'Kişisel Bakım', simge: '✨' },
  gida: { ad: 'Gıda & Market', simge: '🛒' }, kirtasiye: { ad: 'Kırtasiye', simge: '📝' }, diger: { ad: 'Diğer', simge: '📦' },
};
export const kategoriBul = (k: string) => KATEGORILER[k] ?? KATEGORILER.diger!;
export const ONCELIK_AD: Record<string, string> = { high: '🔥 Yüksek ilgi', medium: '⚡ Orta öncelik', low: '🕒 Düşük / ileride' };

export type Filtre = 'hepsi' | 'favori' | 'indirim' | 'hedef';
export type Siralama = 'yeni' | 'eski' | 'fiyat-artan' | 'fiyat-azalan' | 'ad' | 'oncelik';

export const indirimde = (p: Begeni) => !!p.rozet?.text?.includes('İndirim');
export const hedefteMi = (p: Begeni) => !!p.hedef_fiyat && !!p.fiyat && p.fiyat <= p.hedef_fiyat;

export function suz(liste: Begeni[], f: Filtre, kategori: string, ara: string): Begeni[] {
  const t = ara.trim().toLocaleLowerCase('tr');
  return liste.filter(p => (f === 'hepsi' || (f === 'favori' ? p.favori : f === 'indirim' ? indirimde(p) : hedefteMi(p)))
    && (!kategori || p.kategori === kategori)
    && (!t || p.ad.toLocaleLowerCase('tr').includes(t) || (p.notlar ?? '').toLocaleLowerCase('tr').includes(t)
      || p.ozellikler.some(([a, b]) => `${a} ${b}`.toLocaleLowerCase('tr').includes(t))));
}

const SIRA = { high: 0, medium: 1, low: 2 } as const;
export function siraliListe(liste: Begeni[], s: Siralama): Begeni[] {
  const zaman = (p: Begeni) => Date.parse(p.olusturma) || 0;
  return [...liste].sort((a, b) => {
    switch (s) {
      case 'eski': return zaman(a) - zaman(b);
      case 'fiyat-artan': return (a.fiyat ?? Infinity) - (b.fiyat ?? Infinity);
      case 'fiyat-azalan': return (b.fiyat ?? -Infinity) - (a.fiyat ?? -Infinity);
      case 'ad': return a.ad.localeCompare(b.ad, 'tr');
      case 'oncelik': return SIRA[a.oncelik] - SIRA[b.oncelik];
      default: return zaman(b) - zaman(a);
    }
  });
}

export function ozetle(liste: Begeni[]) {
  const bilinen = liste.filter(p => p.fiyat);
  const toplam = bilinen.reduce((t, p) => t + (p.fiyat ?? 0), 0);
  return {
    adet: liste.length, kategori: new Set(liste.map(p => p.kategori)).size, toplam, ortalama: bilinen.length ? toplam / bilinen.length : 0,
    yuksek: liste.filter(p => p.oncelik === 'high').length, favori: liste.filter(p => p.favori).length,
    indirim: liste.filter(indirimde).length, hedef: liste.filter(hedefteMi).length, fiyatliYuzde: liste.length ? Math.round((bilinen.length / liste.length) * 100) : 0,
  };
}

/* Fiyat değişirse geçmişe yeni nokta eklenir; aynı fiyat tekrar yazılmaz. */
export function gecmisEkle(gecmis: Begeni['fiyat_gecmisi'], eski: number | null, yeni: number | null, simdi = new Date()): Begeni['fiyat_gecmisi'] {
  if (yeni === null || yeni === eski) return gecmis;
  const sonu = gecmis[gecmis.length - 1];
  if (sonu && sonu.price === yeni) return gecmis;
  const taban = !gecmis.length && eski !== null ? [{ date: new Date(simdi.getTime() - 1000).toISOString(), price: eski }] : gecmis;
  return [...taban, { date: simdi.toISOString(), price: yeni }];
}

/* "Etiket | adres" satırları ve "Ad: değer" satırları metin kutusundan okunur. */
export function baglantilariOku(metin: string): { url: string; label: string }[] {
  return metin.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.lastIndexOf('|');
    const url = (i >= 0 ? s.slice(i + 1) : s).trim(), label = i >= 0 ? s.slice(0, i).trim() : url;
    return { url, label: label || url };
  }).filter(b => /^https?:\/\//i.test(b.url));
}
export const baglantilariYaz = (l: { url: string; label: string }[]) => l.map(b => `${b.label} | ${b.url}`).join('\n');
export function ozellikleriOku(metin: string): [string, string][] {
  return metin.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return (i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : ['', s]) as [string, string];
  });
}
export const ozellikleriYaz = (l: [string, string][]) => l.map(([a, b]) => (a ? `${a}: ${b}` : b)).join('\n');
