const YOL: Record<string, string> = {
  genel:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  asistan:'<path d="M12 3v2M12 19v2M5 12H3M21 12h-2"/><path d="m12 7 1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z"/>',
  danisman:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  gider:'<path d="M12 4v14"/><path d="m6 12 6 6 6-6"/><path d="M4 21h16"/>',
  abonelik:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  kazanc:'<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  plan:'<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  odemeplan:'<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/>',
  market:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  gmail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  borc:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  kisi:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 11h5M19.5 8.5 22 11l-2.5 2.5"/>',
  taksit:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3M13 14h3"/>',
  sim:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  tahmin:'<path d="M3 12h14"/><path d="m13 6 6 6-6 6"/><path d="M21 5v14"/>',
  hukuk:'<path d="M12 3v18M5 21h14"/><path d="M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  mevduat:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  yatirim:'<path d="M3 20h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="7" width="3" height="11"/><rect x="16" y="4" width="3" height="14"/>',
  karar:'<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
  strateji:'<path d="M4 4h6v6H4zM14 14h6v6h-6z"/><path d="M10 7h4a3 3 0 0 1 3 3v4"/>',
  sirada:'<path d="M4 12h12"/><path d="m12 6 6 6-6 6"/><path d="M20 4v16"/>',
  todo:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  rapor:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  aylik:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/>',
  veri:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  sistem:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  kisiler:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2a5.5 5.5 0 0 1 5.5 5.3"/>',
  iban:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  hesaplar:'<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  vergisgk:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
  icraborc:'<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 9 4 16l4 4 7-7M3 21h8"/>',
  hub:'<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
  cuzdan:'<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/>',
  takvim:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  kalp:'<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  telefon:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  uygulama:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>',
  simsek:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',};
const KATEGORI: Record<string, string> = { apps: 'genel', finans: 'cuzdan', plan: 'takvim', saglik: 'kalp', envanter: 'telefon', araclar: 'simsek' };

const TAKMA: Record<string, string> = {
  'b-ozet': 'borc', 'b-kisi': 'kisi', 'b-banka': 'hesaplar', 'b-icra': 'icraborc', 'b-vergi': 'vergisgk', 'b-sgk': 'vergisgk', 'b-limit': 'limit',
  'g-ozet': 'kazanc', 'g-sabit': 'abonelik', 'g-ekstra': 'kazanc', 'e-ozet': 'gider', 'e-fatura': 'gmail', 'e-abone': 'abonelik',
  'e-sabit': 'taksit', 'e-alinacak': 'plan', 'e-market': 'market', 'o-takvim': 'aylik', 'o-vergi': 'vergisgk', 'o-icra': 'icraborc',
  'o-kisi': 'kisi', 'o-sgk': 'vergisgk', 'v-ozet': 'yatirim', 'v-bes': 'yatirim', 'v-mevduat': 'mevduat', 'v-altin': 'yatirim',
  'h-alinacak': 'plan', 'h-begen': 'kalp', 'h-hedef': 'karar', 'n-todo': 'todo', 'n-zihin': 'rapor', 'n-liste': 'rapor',
  'a-ajanda': 'aylik', 'r-hesap': 'hesaplar', 'r-sifre': 'sistem', 'r-iban': 'iban', 'r-kisi': 'kisiler',
  'k-ceza': 'hukuk', 'k-hukuk': 'hukuk', 'k-icra': 'icraborc', 'k-cbs': 'hukuk',
  'm-plan': 'tahmin', 'm-rapor': 'rapor', 'm-stok': 'market', 'm-liste': 'plan', 'm-karsi': 'strateji', 'm-sim': 'sim',
};

export function menuIkon(ad: string): string {
  const y = YOL[ad] ?? YOL[TAKMA[ad] ?? ''] ?? YOL[KATEGORI[ad] ?? ''] ?? (ad.startsWith('app-') ? YOL.uygulama : undefined);
  return y
    ? `<svg class="lu" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${y}</svg>`
    : '';
}
