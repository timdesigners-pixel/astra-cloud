export type Sekme = { anahtar: string; glif: string; ad: string };
export type Obek = { ad: string; sekmeler: Sekme[] };

const s = (anahtar: string, glif: string, ad: string): Sekme => ({ anahtar, glif, ad });

/* Menü, komut paleti, alt çubuk, 1–9 kısayolları ve rozetler bu tek tanımı okur. */
export const OBEKLER: Obek[] = [
  { ad: 'GENEL KOMUTA', sekmeler: [s('genel', '◈', 'Genel Bakış')] },
  { ad: 'YAPAY ZEKA', sekmeler: [s('asistan', '✦', 'AI Danışman & Ses'), s('danisman', '◉', 'Eylemler & Bütçe')] },
  { ad: 'PARA AKIŞI', sekmeler: [
    s('gider', '↓', 'Aylık Giderler'), s('abonelik', '⟳', 'Abonelik & Fatura'),
    s('kazanc', '↗', 'Gelir & İş Modelleri'), s('plan', '☰', 'Alınacaklar'),
    s('odemeplan', '▤', 'Alım Planı'), s('market', '⊞', 'Market Harcamaları'),
    s('gmail', '✉︎', 'Gmail & E-Fatura'),
  ] },
  { ad: 'BORÇLAR & HUKUK', sekmeler: [
    s('borc', '⚠︎', 'Borç Takibi'), s('kisi', '⇄', 'Kişi Borçları'), s('limit', '▭', 'Limitler'),
    s('taksit', '▤', 'Taksitlendirme'), s('sim', '⚡︎', 'Borç Kapatma Sim.'),
    s('tahmin', '→', 'Gelecek Tahminleme'), s('hukuk', '§', 'Hukuk & İcra Masası'),
  ] },
  { ad: 'VARLIK & BÜYÜME', sekmeler: [s('mevduat', '%', 'Faiz / Getiri Motoru'), s('yatirim', '△', 'Yatırım Portföyü')] },
  { ad: 'STRATEJİ & RAPOR', sekmeler: [
    s('karar', '⊙', 'Karar Desteği'), s('strateji', '⚖︎', 'Strateji Matrisi'),
    s('sirada', '⇥', 'Sırada Ne Var'), s('todo', '✓', 'Yapılacaklar'),
    s('rapor', '◎', 'Rapor Merkezi'), s('aylik', '▦', 'Aylık Z-Raporu'),
  ] },
  { ad: 'SİSTEM', sekmeler: [s('veri', '⊕', 'Veri Girişi'), s('sistem', '⚙︎', 'Sistem Ayarları'), s('hub', '⌘', 'Modül Merkezi')] },
];

export const SEKMELER: Sekme[] = OBEKLER.flatMap(o => o.sekmeler);
export const sekmeBul = (k: string) => SEKMELER.find(x => x.anahtar === k);
export const kisayolNo = (k: string) => {
  const i = SEKMELER.findIndex(x => x.anahtar === k);
  return i >= 0 && i < 9 ? i + 1 : 0;
};

export const ALT_CUBUK: [string, string, string][] = [
  ['genel', '◆', 'Komuta'], ['gider', '₺', 'Para'], ['hukuk', '⚖', 'Hukuk'], ['plan', '☰', 'Alınacak'], ['__more', '⋯', 'Tümü'],
];
