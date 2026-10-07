export type Sekme = { anahtar: string; glif: string; ad: string };
export type Obek = { ad: string; sekmeler: Sekme[] };
export type Grup = { ad?: string; sekmeler: Sekme[] };
export type Hub = { id: string; glif: string; ad: string; gruplar: Grup[] };

const s = (anahtar: string, glif: string, ad: string): Sekme => ({ anahtar, glif, ad });

/* Notion düzeninde merkezler: menü, çekmece, komut paleti, alt çubuk, 1–9 kısayolları ve rozetler bu tek tanımı okur. */
export const HUBLAR: Hub[] = [
  { id: 'dash', glif: '◈', ad: 'Dashboard', gruplar: [
    { sekmeler: [s('genel', '◈', 'Genel Bakış'), s('sirada', '⇥', 'Sırada Ne Var'), s('todo', '✓', 'Yapılacaklar')] },
  ] },
  { id: 'fin', glif: '₺', ad: 'Muhasebe & Finans', gruplar: [
    { ad: 'Nakit Akışı', sekmeler: [
      s('gider', '↓', 'Aylık Giderler'), s('kazanc', '↗', 'Gelir & İş Modelleri'),
      s('abonelik', '⟳', 'Abonelik & Fatura'), s('gmail', '✉︎', 'Gmail & E-Fatura'),
    ] },
    { ad: 'Borç & Limit', sekmeler: [
      s('borc', '⚠︎', 'Borç Takibi'), s('kisi', '⇄', 'Kişi Borçları'), s('limit', '▭', 'Limitler'),
      s('taksit', '▤', 'Taksitlendirme'), s('sim', '⚡︎', 'Borç Kapatma Sim.'),
    ] },
    { ad: 'Varlık & Büyüme', sekmeler: [
      s('mevduat', '%', 'Faiz / Getiri Motoru'), s('yatirim', '△', 'Yatırım Portföyü'), s('tahmin', '→', 'Gelecek Tahminleme'),
    ] },
    { ad: 'Karar & Strateji', sekmeler: [
      s('danisman', '◉', 'Eylemler & Bütçe'), s('karar', '⊙', 'Karar Desteği'), s('strateji', '⚖︎', 'Strateji Matrisi'),
    ] },
    { ad: 'Raporlar', sekmeler: [s('aylik', '▦', 'Aylık Z-Raporu'), s('rapor', '◎', 'Rapor Merkezi')] },
  ] },
  { id: 'huk', glif: '§', ad: 'Hukuk Merkezi', gruplar: [{ sekmeler: [s('hukuk', '§', 'Hukuk & İcra Masası')] }] },
  { id: 'my', glif: '☰', ad: 'My Space', gruplar: [
    { sekmeler: [s('plan', '☰', 'Alınacaklar'), s('odemeplan', '▤', 'Alım Planı'), s('market', '⊞', 'Market Harcamaları')] },
  ] },
  { id: 'ai', glif: '✦', ad: 'AI & Teknoloji Üssü', gruplar: [
    { sekmeler: [s('asistan', '✦', 'AI Danışman & Ses'), s('hub', '⌘', 'Modül Merkezi')] },
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
  { ad: 'BORÇLAR & HUKUK', sekmeler: al('borc', 'kisi', 'limit', 'taksit', 'sim', 'tahmin', 'hukuk') },
  { ad: 'VARLIK & BÜYÜME', sekmeler: al('mevduat', 'yatirim') },
  { ad: 'STRATEJİ & RAPOR', sekmeler: al('karar', 'strateji', 'sirada', 'todo', 'rapor', 'aylik') },
  { ad: 'SİSTEM', sekmeler: al('veri', 'sistem', 'hub') },
];

export const kisayolNo = (k: string) => {
  const i = SEKMELER.findIndex(x => x.anahtar === k);
  return i >= 0 && i < 9 ? i + 1 : 0;
};

export const ALT_CUBUK: [string, string, string][] = [
  ['genel', '◆', 'Komuta'], ['gider', '₺', 'Para'], ['hukuk', '⚖', 'Hukuk'], ['plan', '☰', 'Alınacak'], ['__more', '⋯', 'Tümü'],
];
