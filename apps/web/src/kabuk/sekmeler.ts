export type Sekme = { anahtar: string; glif: string; ad: string };
export type Obek = { ad: string; sekmeler: Sekme[] };
export type Grup = { ad?: string; sekmeler: Sekme[] };
export type Hub = { id: string; glif: string; ad: string; gruplar: Grup[] };

const s = (anahtar: string, glif: string, ad: string): Sekme => ({ anahtar, glif, ad });

/* Merkezler: menü, çekmece, komut paleti, alt çubuk, 1–9 kısayolları ve rozetler bu tek tanımı okur. */
export const HUBLAR: Hub[] = [
  { id: 'dash', glif: '◈', ad: 'Genel Bakış', gruplar: [{ sekmeler: [s('genel', '◈', 'Genel Bakış')] }] },
  { id: 'borc', glif: '▣', ad: 'Borçlar', gruplar: [{ sekmeler: [
    s('b-ozet', '▣', 'Borç Özeti'), s('b-kisi', '⇄', 'Kişi Borçları'), s('b-banka', '▩', 'Banka Borçları'),
    s('b-icra', '▲', 'İcra Dosyaları'), s('b-vergi', '▧', 'Vergi Borçları'), s('b-sgk', '▤', 'SGK Borçları'), s('b-limit', '▭', 'Limitler'),
  ] }] },
  { id: 'gelir', glif: '↗', ad: 'Gelirler', gruplar: [{ sekmeler: [
    s('g-ozet', '↗', 'Gelir Özeti'), s('g-sabit', '⟳', 'Sabit Gelirler'), s('g-ekstra', '+', 'Ekstra Gelirler'),
  ] }] },
  { id: 'gider', glif: '↓', ad: 'Giderler', gruplar: [{ sekmeler: [
    s('e-ozet', '↓', 'Gider Özeti'), s('e-fatura', '▦', 'Faturalar'), s('e-gmail', '✉', 'Gmail Faturaları'), s('e-abone', '⟳', 'Abonelikler'),
    s('e-sabit', '▤', 'Sabit Giderler'), s('e-alinacak', '☰', 'Alınacaklar'), s('e-market', '⊞', 'Market Alışverişi'),
  ] }] },
  { id: 'odeme', glif: '₺', ad: 'Ödemeler', gruplar: [{ sekmeler: [
    s('o-takvim', '▦', 'Ödeme Takvimi'), s('o-vergi', '▧', 'Vergi Borçları'), s('o-icra', '▲', 'İcra Borçları'),
    s('o-kisi', '⇄', 'Kişi Borçları'), s('o-sgk', '▤', 'SGK Borçları'),
  ] }] },
  { id: 'birikim', glif: '△', ad: 'Birikim ve Yatırımlar', gruplar: [{ sekmeler: [
    s('v-ozet', '△', 'Birikim Özeti'), s('v-bes', '◍', 'BES Hesabı'), s('v-mevduat', '%', 'Mevduat'), s('v-altin', '◆', 'Altın Birikimi'),
  ] }] },
  { id: 'hedef', glif: '☆', ad: 'Hayaller ve Hedefler', gruplar: [{ sekmeler: [
    s('h-alinacak', '☰', 'Alınacaklar Listesi'), s('h-begen', '♡', 'Beğendim Ürünler'), s('h-hedef', '⊙', 'Hedefler'),
  ] }] },
  { id: 'saglik', glif: '♥', ad: 'Sağlık', gruplar: [{ sekmeler: [
    s('s-ozet', '♥', 'Sağlık Özeti'), s('s-tahlil', '⚗', 'Tahliller'), s('s-cihaz', '⌚︎', 'Cihaz Senkronu'),
  ] }] },
  { id: 'not', glif: '✓', ad: 'Notlar ve Yapılacaklar', gruplar: [{ sekmeler: [
    s('n-todo', '✓', "Todo's"), s('n-zihin', '❏', 'Zihin Sarayı'), s('n-liste', '≡', 'Listeler'),
  ] }] },
  { id: 'ajanda', glif: '▦', ad: 'Ajanda', gruplar: [{ sekmeler: [s('a-ajanda', '▦', 'Ajanda')] }] },
  { id: 'rehber', glif: '◍', ad: 'Rehber', gruplar: [{ sekmeler: [
    s('r-hesap', '▩', 'Banka Hesaplarım'), s('r-sifre', '◉', 'Hesaplar ve Şifreler'), s('r-iban', '▥', 'IBAN Rehberi'), s('r-kisi', '◍', 'Kişiler ve Kurumlar'),
  ] }] },
  { id: 'huk', glif: '§', ad: 'Hukuk', gruplar: [{ sekmeler: [
    s('k-ceza', '§', 'Ceza Davaları'), s('k-hukuk', '⚖︎', 'Hukuk Davaları'), s('k-icra', '▲', 'İcra Dosyaları'), s('k-cbs', '▧', 'CBS Dosyaları'), s('k-sure', '⏳︎', 'Süreler ve İmza'),
  ] }] },
  { id: 'modul', glif: '⌘', ad: 'Modül Merkezi', gruplar: [
    { sekmeler: [
      s('m-plan', '☰', 'Planlayıcı'), s('m-rapor', '▦', 'Aylık Rapor'), s('m-stok', '⊞', 'Market Stok'),
      s('m-liste', '≡', 'Alışveriş Listesi'), s('m-karsi', '⇄', 'Karşılaştırma Robotu'), s('m-sim', '⚡︎', 'Simülasyon Merkezi'),
    ] },
    { ad: 'Uygulamalar', sekmeler: [
      s('hub', '⌘', 'Tüm Uygulamalar'),
      s('app-odeme', '▤', 'Ödeme Raporu'), s('app-hesapyon', '▩', 'Hesap Yöneticisi'), s('app-bahis', '♠', 'Bahis Dünyası'),
      s('app-marketliste', '⊞', 'Market Listesi'), s('app-karsilama', '☀', 'Günlük Karşılama'), s('app-ilgi', '★', 'İlgi Çekici Ürünler'),
      s('app-tasarim', '✎', 'Tasarım Atölyesi'), s('app-dosya', '▦', 'Dosya Yöneticisi'), s('app-telrehber', '☎', 'Telefon Rehberi'),
      s('app-kutuphane', '❏', 'Bilgi Kütüphanesi'), s('app-oynatma', '▶', 'Oynatma Listelerim'), s('app-pinterest', '✧', 'Pinterest Panolarım'),
    ] },
  ] },
  { id: 'sis', glif: '⚙︎', ad: 'Sistem', gruplar: [{ sekmeler: [s('sistem', '⚙︎', 'Sistem Ayarları'), s('acil', '✚', 'Acil Durum Kartı')] }] },
];

/* Eski adresler ve bağlantılar yeni sayfalara yönlenir. */
const ESKI_ADLAR: Record<string, string> = {
  borc: 'b-ozet', kisi: 'b-kisi', vergisgk: 'b-vergi', icraborc: 'b-icra', taksit: 'o-takvim', sim: 'm-sim',
  hesaplar: 'r-hesap', limit: 'b-limit', kisiler: 'r-kisi', iban: 'r-iban', hukuk: 'k-hukuk',
  gider: 'e-ozet', kazanc: 'g-ozet', abonelik: 'e-abone', gmail: 'e-gmail', mevduat: 'v-mevduat', yatirim: 'v-ozet',
  tahmin: 'm-plan', danisman: 'm-plan', karar: 'm-sim', strateji: 'm-sim', aylik: 'm-rapor', rapor: 'm-rapor',
  plan: 'e-alinacak', odemeplan: 'o-takvim', market: 'e-market', todo: 'n-todo', sirada: 'a-ajanda', veri: 'sistem',
  asistan: 'genel', saglik: 's-ozet', tahlil: 's-tahlil', cihaz: 's-cihaz',
  odeme: 'app-odeme', tasarim: 'app-tasarim', karsilama: 'app-karsilama', telrehber: 'app-telrehber', oynatma: 'app-oynatma',
  pinterest: 'app-pinterest', ilgi: 'app-ilgi', dosya: 'app-dosya', marketliste: 'app-marketliste', kutuphane: 'app-kutuphane',
  bahis: 'app-bahis', hesapyon: 'app-hesapyon',
};

export const SEKMELER: Sekme[] = HUBLAR.flatMap(h => h.gruplar.flatMap(g => g.sekmeler));
export const sekmeCoz = (k: string) => (SEKMELER.some(x => x.anahtar === k) ? k : ESKI_ADLAR[k]);
export const sekmeBul = (k: string) => SEKMELER.find(x => x.anahtar === sekmeCoz(k));
export const hubBul = (k: string) => {
  const c = sekmeCoz(k);
  return HUBLAR.find(h => h.gruplar.some(g => g.sekmeler.some(x => x.anahtar === c)));
};

/* Eski düz menü (Sistem Ayarları'ndan seçilirse): her merkez bir bölüm. */
export const OBEKLER: Obek[] = HUBLAR.map(h => ({ ad: h.ad.toLocaleUpperCase('tr'), sekmeler: h.gruplar.flatMap(g => g.sekmeler) }));

export const kisayolNo = (k: string) => {
  const i = SEKMELER.findIndex(x => x.anahtar === k);
  return i >= 0 && i < 9 ? i + 1 : 0;
};

export const ALT_CUBUK: [string, string, string][] = [
  ['genel', '◆', 'Komuta'], ['b-ozet', '▣', 'Borç'], ['e-ozet', '↓', 'Gider'], ['a-ajanda', '▦', 'Ajanda'], ['__more', '⋯', 'Tümü'],
];
