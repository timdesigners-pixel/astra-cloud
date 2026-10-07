export type Sekme = { anahtar: string; glif: string; ad: string };
export type Obek = { ad: string; sekmeler: Sekme[] };
export type Grup = { ad?: string; sekmeler: Sekme[] };
export type Hub = { id: string; glif: string; ad: string; gruplar: Grup[] };

const s = (anahtar: string, glif: string, ad: string): Sekme => ({ anahtar, glif, ad });

/* Notion düzeninde merkezler: menü, çekmece, komut paleti, alt çubuk, 1–9 kısayolları ve rozetler bu tek tanımı okur. */
export const HUBLAR: Hub[] = [
  { id: 'dash', glif: '◈', ad: 'Dashboard', gruplar: [
    { sekmeler: [s('genel', '◈', 'Genel Bakış'), s('sirada', '⇥', 'Sırada Ne Var'), s('todo', '✓', 'Yapılacaklar'), s('asistan', '✦', 'AI Danışman & Ses')] },
  ] },
  { id: 'fin', glif: '₺', ad: 'Muhasebe & Finans', gruplar: [
    { ad: 'Nakit Akışı', sekmeler: [
      s('gider', '↓', 'Aylık Giderler'), s('kazanc', '↗', 'Gelir & İş Modelleri'),
      s('abonelik', '⟳', 'Abonelik & Fatura'), s('gmail', '✉︎', 'Gmail & E-Fatura'),
    ] },
    { ad: 'Varlık & Büyüme', sekmeler: [
      s('mevduat', '%', 'Faiz / Getiri Motoru'), s('yatirim', '△', 'Yatırım Portföyü'), s('tahmin', '→', 'Gelecek Tahminleme'),
    ] },
    { ad: 'Karar & Strateji', sekmeler: [
      s('danisman', '◉', 'Eylemler & Bütçe'), s('karar', '⊙', 'Karar Desteği'), s('strateji', '⚖︎', 'Strateji Matrisi'),
    ] },
    { ad: 'Raporlar', sekmeler: [s('aylik', '▦', 'Aylık Z-Raporu'), s('rapor', '◎', 'Rapor Merkezi')] },
  ] },
  { id: 'borc', glif: '▣', ad: 'Borçlar & Hesaplar', gruplar: [
    { ad: 'Borçlar', sekmeler: [
      s('borc', '⚠︎', 'Borç Takibi'), s('kisi', '⇄', 'Kişilere Borçlar'), s('vergisgk', '▧', 'Vergi & SGK Borçları'),
      s('icraborc', '▲', 'İcra Borçları'), s('taksit', '▤', 'Taksitlendirme'), s('sim', '⚡︎', 'Borç Kapatma Sim.'),
    ] },
    { ad: 'Hesaplar', sekmeler: [s('hesaplar', '▩', 'Banka Hesapları'), s('limit', '▭', 'Limitler')] },
    { ad: 'Rehber', sekmeler: [s('kisiler', '◍', 'Kişiler & Kurumlar'), s('iban', '▥', 'IBAN Rehberi')] },
  ] },
  { id: 'huk', glif: '§', ad: 'Hukuk Merkezi', gruplar: [{ sekmeler: [s('hukuk', '§', 'Hukuk & İcra Masası')] }] },
  { id: 'my', glif: '☰', ad: 'My Space', gruplar: [
    { sekmeler: [s('plan', '☰', 'Alınacaklar'), s('odemeplan', '▤', 'Alım Planı'), s('market', '⊞', 'Market Harcamaları')] },
  ] },
  { id: 'modul', glif: '⌘', ad: 'Modül Merkezi', gruplar: [
    { sekmeler: [s('hub', '⌘', 'Tüm Uygulamalar')] },
    { ad: 'Finans & Takip', sekmeler: [
      s('app-odeme', '▤', 'Ödeme Raporu'), s('app-hesapyon', '▩', 'Hesap Yöneticisi'),
      s('app-bahis', '♠', 'Bahis Dünyası'), s('app-marketliste', '⊞', 'Market Listesi'),
    ] },
    { ad: 'Günlük', sekmeler: [s('app-karsilama', '☀', 'Günlük Karşılama'), s('app-ilgi', '★', 'İlgi Çekici Ürünler')] },
    { ad: 'Araçlar', sekmeler: [
      s('app-tasarim', '✎', 'Tasarım Atölyesi'), s('app-dosya', '▦', 'Dosya Yöneticisi'),
      s('app-telrehber', '☎', 'Telefon Rehberi'), s('app-kutuphane', '❏', 'Bilgi Kütüphanesi'),
    ] },
    { ad: 'Arşivler', sekmeler: [s('app-oynatma', '▶', 'Oynatma Listelerim'), s('app-pinterest', '✧', 'Pinterest Panolarım')] },
  ] },
  { id: 'sis', glif: '⚙︎', ad: 'Sistem', gruplar: [
    { sekmeler: [s('veri', '⊕', 'Veri Girişi'), s('sistem', '⚙︎', 'Sistem Ayarları')] },
  ] },
];

export const SEKMELER: Sekme[] = HUBLAR.flatMap(h => h.gruplar.flatMap(g => g.sekmeler));
export const sekmeBul = (k: string) => SEKMELER.find(x => x.anahtar === k);
export const hubBul = (k: string) => HUBLAR.find(h => h.gruplar.some(g => g.sekmeler.some(x => x.anahtar === k)));
const al = (...k: string[]) => k.map(x => sekmeBul(x)!);

/* Eski düz menü (Sistem Ayarları'ndan seçilirse). */
export const OBEKLER: Obek[] = [
  { ad: 'GENEL KOMUTA', sekmeler: al('genel') },
  { ad: 'YAPAY ZEKA', sekmeler: al('asistan', 'danisman') },
  { ad: 'PARA AKIŞI', sekmeler: al('gider', 'abonelik', 'kazanc', 'plan', 'odemeplan', 'market', 'gmail') },
  { ad: 'BORÇLAR & HUKUK', sekmeler: al('borc', 'kisi', 'vergisgk', 'icraborc', 'hesaplar', 'limit', 'kisiler', 'iban', 'taksit', 'sim', 'tahmin', 'hukuk') },
  { ad: 'VARLIK & BÜYÜME', sekmeler: al('mevduat', 'yatirim') },
  { ad: 'STRATEJİ & RAPOR', sekmeler: al('karar', 'strateji', 'sirada', 'todo', 'rapor', 'aylik') },
  { ad: 'MODÜL MERKEZİ', sekmeler: al('hub', 'app-odeme', 'app-hesapyon', 'app-bahis', 'app-marketliste', 'app-karsilama', 'app-ilgi', 'app-tasarim', 'app-dosya', 'app-telrehber', 'app-kutuphane', 'app-oynatma', 'app-pinterest') },
  { ad: 'SİSTEM', sekmeler: al('veri', 'sistem') },
];

export const kisayolNo = (k: string) => {
  const i = SEKMELER.findIndex(x => x.anahtar === k);
  return i >= 0 && i < 9 ? i + 1 : 0;
};

export const ALT_CUBUK: [string, string, string][] = [
  ['genel', '◆', 'Komuta'], ['gider', '₺', 'Para'], ['hukuk', '⚖', 'Hukuk'], ['plan', '☰', 'Alınacak'], ['__more', '⋯', 'Tümü'],
];
