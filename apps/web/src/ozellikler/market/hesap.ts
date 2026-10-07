/* Market fiyat karşılaştırması: fiş kalemlerinden ürün ve market bazında fiyat özeti. */
export type FiyatKaydi = { urun_id: string; market: string; tarih: string; birim_fiyat: number };
export type MarketFiyati = { market: string; son: number; ortalama: number; enDusuk: number; adet: number; sonTarih: string };

export function marketFiyatlari(kayitlar: FiyatKaydi[], urunId: string): MarketFiyati[] {
  const m = new Map<string, FiyatKaydi[]>();
  kayitlar.filter(k => k.urun_id === urunId).forEach(k => m.set(k.market, [...(m.get(k.market) ?? []), k]));
  return [...m.entries()].map(([market, l]) => {
    const s = [...l].sort((a, b) => a.tarih.localeCompare(b.tarih));
    const son = s[s.length - 1]!;
    return { market, son: son.birim_fiyat, ortalama: l.reduce((t, x) => t + x.birim_fiyat, 0) / l.length,
      enDusuk: Math.min(...l.map(x => x.birim_fiyat)), adet: l.length, sonTarih: son.tarih };
  }).sort((a, b) => a.son - b.son);
}

/* Her ürünün son iki alışveriş fiyatı arasındaki değişim (yüzde), büyükten küçüğe. */
export function fiyatDegisimleri(kayitlar: FiyatKaydi[]): { urun_id: string; onceki: number; son: number; yuzde: number }[] {
  const u = new Map<string, FiyatKaydi[]>();
  kayitlar.forEach(k => u.set(k.urun_id, [...(u.get(k.urun_id) ?? []), k]));
  const out: { urun_id: string; onceki: number; son: number; yuzde: number }[] = [];
  for (const [id, l] of u) {
    const s = [...l].sort((a, b) => a.tarih.localeCompare(b.tarih));
    if (s.length < 2) continue;
    const onceki = s[s.length - 2]!.birim_fiyat, son = s[s.length - 1]!.birim_fiyat;
    if (onceki > 0) out.push({ urun_id: id, onceki, son, yuzde: ((son - onceki) / onceki) * 100 });
  }
  return out.sort((a, b) => b.yuzde - a.yuzde);
}

/* Teklif karşılaştırma: toplam fiyatı miktara bölüp birim fiyata göre sıralar. */
export function teklifSirala(t: { ad: string; fiyat: number; miktar: number }[]) {
  return t.filter(x => x.fiyat > 0 && x.miktar > 0).map(x => ({ ...x, birim: x.fiyat / x.miktar })).sort((a, b) => a.birim - b.birim);
}
