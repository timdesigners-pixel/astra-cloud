/*
 * ASTRA-OS aktarım aracı için SENTETİK veri üreteci.
 *
 * Eski sistemin `S` (astra-finans-v1) gövdesini taklit eder. Buradaki HİÇBİR değer gerçek değildir:
 *  - adlar açıkça uydurmadır ('Örnek Kişi 01'),
 *  - IBAN'lar mod-97 GEÇERLİ ama gerçek bir bankaya ait olmayan TEST IBAN'larıdır (banka kodu 09999),
 *  - dosya numaraları uydurmadır ('2099/00001 Esas'),
 *  - "canary" değerleri sızıntı testleri için gömülen tanınabilir sahte değerlerdir.
 * Üreteç deterministiktir (tohum parametreli, Math.random yok) ve saftır (fs/ağ/ortam yok).
 */

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Sabit "şimdi": 2026-06-15 09:00:00 UTC (Europe/Istanbul 12:00). Tüm `_ts` değerleri buradan türer. */
export const SENTETIK_TEMEL_TS = Date.UTC(2026, 5, 15, 9, 0, 0);

/** Varsayılan tohum. */
export const SENTETIK_VARSAYILAN_TOHUM = 20260615;

/** Test IBAN'larının banka kodu: gerçek bir bankaya ait değildir. */
export const SENTETIK_BANKA_KODU = '09999';

/** `uygulama_durumu_yaz` değer sınırını (8 MB) aşan en küçük karakter sayısı. */
export const SENTETIK_BUYUK_DEGER_BAYT = 8 * 1024 * 1024 + 1;

/** Sızıntı testleri için gömülen sahte (uydurma) tanınabilir değerler. */
export const CANARY_AD = 'Canary Kişi Zeta';
export const CANARY_DOSYA_NO = '2099/CNR77 Esas';
export const CANARY_PAROLA = 'CanaryParola!7731x';
export const CANARY_ABONE_NO = '9990007770001';
export const CANARY_TELEFON = '0500 000 77 77';
export const CANARY_ANAHTAR = 'canary-anahtar-7f3a91c2';

/* ------------------------------------------------------------------ */
/* IBAN (mod-97)                                                       */
/* ------------------------------------------------------------------ */

/** Boşlukları atar, büyük harfe çevirir. */
export function ibanNormallestir(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

function harfleriSayiyaCevir(metin: string): string {
  let sonuc = '';
  for (const c of metin) {
    sonuc += c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c;
  }
  return sonuc;
}

function mod97(sayisal: string): number {
  let kalan = 0;
  for (const c of sayisal) kalan = (kalan * 10 + Number(c)) % 97;
  return kalan;
}

/** TR IBAN biçimi (TR + 24 hane) ve mod-97 doğrulaması. */
export function ibanMod97GecerliMi(iban: string): boolean {
  const n = ibanNormallestir(iban);
  if (!/^TR\d{24}$/.test(n)) return false;
  return mod97(harfleriSayiyaCevir(n.slice(4) + n.slice(0, 4))) === 1;
}

/** 22 haneli BBAN'dan (5 banka kodu + 0 + 16 hane) kontrol hanelerini hesaplayıp IBAN üretir. */
export function ibanBbandanKur(bban: string): string {
  if (!/^\d{22}$/.test(bban)) throw new Error('BBAN 22 haneli olmalı.');
  const kalan = mod97(harfleriSayiyaCevir(bban + 'TR00'));
  return `TR${String(98 - kalan).padStart(2, '0')}${bban}`;
}

/** IBAN'ı 4'lü gruplarla boşluklu yazar (kullanıcıların girdiği biçim). */
export function ibanBoslukluYaz(iban: string): string {
  return ibanNormallestir(iban).replace(/(.{4})/g, '$1 ').trim();
}

/** Mod-97 doğrulaması KESİN başarısız olan IBAN: son hane değiştirilir (tek hane değişimi 97'ye bölünemez). */
export function ibanBozGecersizKil(iban: string): string {
  const n = ibanNormallestir(iban);
  const son = Number(n.slice(-1));
  return n.slice(0, -1) + String((son + 1) % 10);
}

/** Deterministik rastgele sayı üreteci (mulberry32). Math.random KULLANILMAZ. */
export function tohumdanUretec(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Üreteçten bir TEST IBAN'ı (banka kodu 09999, mod-97 geçerli). */
export function testIbanUret(rastgele: () => number): string {
  let hesap = '';
  for (let i = 0; i < 16; i++) hesap += String(Math.floor(rastgele() * 10));
  return ibanBbandanKur(`${SENTETIK_BANKA_KODU}0${hesap}`);
}

/** Tohumdan `adet` tane birbirinden farklı geçerli TEST IBAN'ı. */
export function testIbanlari(tohum: number, adet: number): string[] {
  const rastgele = tohumdanUretec(tohum);
  const kume = new Set<string>();
  while (kume.size < adet) kume.add(testIbanUret(rastgele));
  return [...kume];
}

/** Tohumdan bağımsız, sabit canary IBAN'ı (mod-97 geçerli, test banka kodu). */
export const CANARY_IBAN: string = ibanBbandanKur(`${SENTETIK_BANKA_KODU}00000770077007700`.slice(0, 22));

/** Tohumdan bağımsız, sabit mod-97 GEÇERSİZ IBAN (biçimi doğru, kontrol toplamı yanlış). */
export const SENTETIK_GECERSIZ_IBAN: string = ibanBozGecersizKil(
  ibanBbandanKur(`${SENTETIK_BANKA_KODU}00000880088008800`.slice(0, 22)),
);

/** Sızıntı testinde aranacak tüm canary dizeleri (IBAN hem bitişik hem boşluklu). */
export const CANARY_DEGERLERI: readonly string[] = [
  CANARY_AD,
  CANARY_DOSYA_NO,
  CANARY_PAROLA,
  CANARY_ABONE_NO,
  CANARY_TELEFON,
  CANARY_ANAHTAR,
  CANARY_IBAN,
  ibanBoslukluYaz(CANARY_IBAN),
];

/** `metin` içinde geçen canary değerlerini döndürür (boş dizi = sızıntı yok). Büyük/küçük harf ve IBAN boşlukları yok sayılır. */
export function canaryBul(metin: string): string[] {
  const kucuk = metin.toLowerCase();
  const bitisik = kucuk.replace(/\s+/g, '');
  return CANARY_DEGERLERI.filter((c) => {
    const ck = c.toLowerCase();
    return kucuk.includes(ck) || bitisik.includes(ck.replace(/\s+/g, ''));
  });
}

/* ------------------------------------------------------------------ */
/* tr-TR sayı metni varyantları                                        */
/* ------------------------------------------------------------------ */

export type SayiVaryanti = {
  metin: string;
  /** Beklenen ayrıştırma sonucu; `null` = boş veya geçersiz (GECERSIZ_TUTAR adayı). */
  beklenen: number | null;
  tur: 'gecerli' | 'bos' | 'gecersiz';
  aciklama: string;
};

export const SAYI_METNI_VARYANTLARI: readonly SayiVaryanti[] = [
  { metin: '1.234,50', beklenen: 1234.5, tur: 'gecerli', aciklama: 'tr-TR: nokta binlik, virgül ondalık' },
  { metin: '1,234.50', beklenen: 1234.5, tur: 'gecerli', aciklama: 'en-US: virgül binlik, nokta ondalık' },
  { metin: '1,234', beklenen: 1.234, tur: 'gecerli', aciklama: 'tek virgül ondalık sayılır (1,234 = 1.234)' },
  { metin: '1,234,567', beklenen: 1234567, tur: 'gecerli', aciklama: 'birden çok virgül binlik ayracıdır' },
  { metin: '%12', beklenen: 12, tur: 'gecerli', aciklama: 'yüzde işareti atılır' },
  { metin: '₺99', beklenen: 99, tur: 'gecerli', aciklama: 'para simgesi atılır' },
  { metin: '12 TL', beklenen: 12, tur: 'gecerli', aciklama: 'TL soneki atılır' },
  { metin: '', beklenen: null, tur: 'bos', aciklama: 'boş metin' },
  { metin: 'abc', beklenen: null, tur: 'gecersiz', aciklama: 'sayı değil' },
];

/* ------------------------------------------------------------------ */
/* S gövdesi tipleri                                                   */
/* ------------------------------------------------------------------ */

export type SZaman = { id: string; _ts: number };

export type SBorc = SZaman & {
  name: string;
  cat: string;
  amount: number | string;
  cur: string;
  rate: number;
  min: number;
  note: string;
  pid: string;
  firm: string;
  balDate: string;
  verified: boolean;
  sozTarih: string;
  gelirId: string;
  kaynak: string;
  iban: string;
  vade: string;
  durum: string;
};

export type SGelir = SZaman & {
  name: string;
  firm: string;
  src: string;
  tur?: 'borc';
  monthly: number | string;
  cur: string;
  from: string;
  to: string;
  gun: number;
  note: string;
  off: Record<string, boolean>;
  borcId: string;
  pid: string;
};

export type SGider = SZaman & {
  name: string;
  cat: string;
  amount: number | string;
  cur: string;
  paid: boolean;
  once: boolean;
  month: string;
  dueDay: number;
  note: string;
  paidDate: string;
  paidAy: string;
  det: { iban?: string; alici?: string; banka?: string; aboneNo?: string };
};

export type SKisi = SZaman & { ad: string; iban: string; not: string; alias: string[]; created: number; phone: string };

export type SIban = SZaman & { label: string; iban: string; owner: string; bank: string };

export type SHaciz = { tur: string; hedef: string; tutar: number; d: string; durum: string; not: string };

export type SIcra = SZaman & {
  no: string;
  dr: string;
  al: string;
  as: number;
  gn: number;
  fz: number;
  tr: string;
  pr: number;
  av: string;
  dt: string;
  dur: string;
  dogr: string;
  teblig: string;
  odemePlani: { odemeler: { tutar: number; d: string }[] };
  hacizler: SHaciz[];
};

export type SDava = SZaman & {
  es: string;
  mh: string;
  ad: string;
  rk: string;
  as: string;
  sa: string;
  nt: string;
  taraf: string;
  dur: string;
};

export type SKayitGenel = SZaman & Record<string, unknown>;

export type SKoleksiyon = {
  debts: SBorc[];
  expenses: SGider[];
  incomes: SGelir[];
  purchases: SKayitGenel[];
  todos: SKayitGenel[];
  deposits: SKayitGenel[];
  investments: SKayitGenel[];
  ibans: SIban[];
  pantry: SKayitGenel[];
  icra: SIcra[];
  cases: SDava[];
  petitions: Record<string, unknown>[];
  legal: SKayitGenel[];
  fixdates: Record<string, unknown>[];
  people: SKisi[];
  receipts: SKayitGenel[];
  bankRates: SKayitGenel[];
  bes: SKayitGenel[];
  scenarios: SKayitGenel[];
  decisions: SKayitGenel[];
  aracIlan: SKayitGenel[];
  teklifler: SKayitGenel[];
  raporArsiv: SKayitGenel[];
  moves: SKayitGenel[];
  kutuphane: SKayitGenel[];
  kutKategori: SKayitGenel[];
  acilKisiler: SKayitGenel[];
  rssKaynaklar: SKayitGenel[];
  limitler: SKayitGenel[];
};

export type SentetikS = {
  _v: number;
  _ts: number;
  _istemci: string;
  _min: number;
  koleksiyon: SKoleksiyon;
  ayar: Record<string, unknown>;
  /** Mezar taşları: liste adı → { kayıt id → silinme zamanı }. */
  silinen: Record<string, Record<string, number>>;
  statements: Record<string, unknown>;
  ledger: Record<string, unknown>;
  dayLog: Record<string, unknown>;
  diger: { apps: Record<string, string> } & Record<string, unknown>;
};

export type SentetikSecenek = {
  /** Deterministik üreteç tohumu. */
  tohum?: number;
  /** true: `diger.apps` içine 8 MB'ı aşan bir değer ekler (DEGER_COK_BUYUK). Varsayılan false (çıktı şişirilmez). */
  buyukDeger?: boolean;
  /** true: `diger.apps` içine 200 karakterden uzun bir anahtar ekler (ANAHTAR_COK_UZUN). Varsayılan false. */
  uzunAnahtar?: boolean;
};

/* ------------------------------------------------------------------ */
/* Kimlik listeleri (testlerin kolay başvurması için)                  */
/* ------------------------------------------------------------------ */

/** Mezar taşı bulunan (aktarımda ATLANMASI gereken) kayıtlar; kayıtlar koleksiyonda da durur. */
export const SENTETIK_MEZAR_TASLARI: Readonly<Record<string, readonly string[]>> = {
  debts: ['borc-sil-01'],
  expenses: ['gider-sil-01'],
  people: ['kisi-sil-01'],
};

/** Alınan borç çifti: gelir (tur='borc') ↔ borç (gelirId). */
export const SENTETIK_ALINAN_BORC = { gelirId: 'gelir-borc-01', borcId: 'borc-alinan-01', kisiId: 'kisi-01' } as const;

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function ts(sira: number): number {
  return SENTETIK_TEMEL_TS + sira * 60_000;
}

function sira2(n: number): string {
  return String(n).padStart(2, '0');
}

function borcUret(sira: number, kismi: Partial<SBorc> & { id: string; name: string }): SBorc {
  return {
    _ts: ts(sira),
    cat: 'Banka',
    amount: 1000,
    cur: 'TRY',
    rate: 0,
    min: 0,
    note: '',
    pid: '',
    firm: '',
    balDate: '2026-06-01',
    verified: false,
    sozTarih: '',
    gelirId: '',
    kaynak: '',
    iban: '',
    vade: '',
    durum: 'acik',
    ...kismi,
  };
}

function giderUret(sira: number, kismi: Partial<SGider> & { id: string; name: string }): SGider {
  return {
    _ts: ts(100 + sira),
    cat: 'Fatura',
    amount: 500,
    cur: 'TRY',
    paid: false,
    once: false,
    month: '',
    dueDay: 15,
    note: '',
    paidDate: '',
    paidAy: '',
    det: {},
    ...kismi,
  };
}

function gelirUret(sira: number, kismi: Partial<SGelir> & { id: string; name: string }): SGelir {
  return {
    _ts: ts(200 + sira),
    firm: '',
    src: 'maas',
    monthly: 10000,
    cur: 'TRY',
    from: '2026-01',
    to: '',
    gun: 5,
    note: '',
    off: {},
    borcId: '',
    pid: '',
    ...kismi,
  };
}

function bosKoleksiyon(): SKoleksiyon {
  return {
    debts: [], expenses: [], incomes: [], purchases: [], todos: [], deposits: [], investments: [], ibans: [],
    pantry: [], icra: [], cases: [], petitions: [], legal: [], fixdates: [], people: [], receipts: [],
    bankRates: [], bes: [], scenarios: [], decisions: [], aracIlan: [], teklifler: [], raporArsiv: [],
    moves: [], kutuphane: [], kutKategori: [], acilKisiler: [], rssKaynaklar: [], limitler: [],
  };
}

/** Tam `length` karakterlik geçerli bir JSON metni (ASCII; bayt = karakter): "xxxx…". */
export function buyukUygulamaDegeriUret(uzunluk: number = SENTETIK_BUYUK_DEGER_BAYT): string {
  if (uzunluk < 2) throw new Error('Uzunluk en az 2 olmalı.');
  return `"${'x'.repeat(uzunluk - 2)}"`;
}

/* ------------------------------------------------------------------ */
/* Ana üreteç                                                          */
/* ------------------------------------------------------------------ */

export function sentetikSUret(secenek: SentetikSecenek = {}): SentetikS {
  const tohum = secenek.tohum ?? SENTETIK_VARSAYILAN_TOHUM;
  const rastgele = tohumdanUretec(tohum);
  const ibanlar = testIbanlari(tohum, 8);
  const tutar = (alt: number, ust: number): number => Math.round((alt + rastgele() * (ust - alt)) * 100) / 100;

  /* --- kişiler --- */
  const people: SKisi[] = [
    { id: 'kisi-01', _ts: ts(1), ad: 'Örnek Kişi 01', iban: ibanBoslukluYaz(ibanlar[0]), not: 'Alınan borç veren', alias: ['Örnek 01', 'ÖK01'], created: ts(1), phone: '0500 000 00 01' },
    { id: 'kisi-02', _ts: ts(2), ad: 'Örnek Kişi İlker 02', iban: ibanlar[1], not: '', alias: [], created: ts(2), phone: '' },
    { id: 'kisi-03', _ts: ts(3), ad: 'ÖRNEK KİŞİ IŞIL 03', iban: '', not: 'İ/ı katlama örneği', alias: ['ışıl'], created: ts(3), phone: '0500 000 00 03' },
    { id: 'kisi-04', _ts: ts(4), ad: 'Örnek Alacaklı A.Ş. 01', iban: ibanlar[2], not: '', alias: [], created: ts(4), phone: '' },
    { id: 'kisi-05', _ts: ts(5), ad: 'Örnek Kişi 05', iban: SENTETIK_GECERSIZ_IBAN, not: 'Mod-97 geçersiz IBAN', alias: [], created: ts(5), phone: '' },
    { id: 'kisi-06', _ts: ts(6), ad: CANARY_AD, iban: CANARY_IBAN, not: '', alias: [], created: ts(6), phone: CANARY_TELEFON },
    { id: 'kisi-07', _ts: ts(7), ad: 'Örnek Kişi 01', iban: '', not: 'Aynı ad (belirsiz eşleşme adayı)', alias: [], created: ts(7), phone: '' },
    { id: 'kisi-sil-01', _ts: ts(8), ad: 'Örnek Silinmiş Kişi', iban: '', not: 'Mezar taşı var', alias: [], created: ts(8), phone: '' },
  ];

  const sIbans: SIban[] = [
    { id: 'iban-01', _ts: ts(10), label: 'Örnek Maaş Hesabı', iban: ibanlar[3], owner: 'Örnek Hesap Sahibi', bank: 'Örnek Banka' },
    { id: 'iban-02', _ts: ts(11), label: 'Kişi 02 hesabı (tekrar)', iban: ibanlar[1], owner: 'Örnek Kişi İlker 02', bank: 'Örnek Banka 2' },
    { id: 'iban-03', _ts: ts(12), label: 'Geçersiz örnek', iban: SENTETIK_GECERSIZ_IBAN, owner: '', bank: '' },
  ];

  /* --- borçlar --- */
  const debts: SBorc[] = [
    borcUret(1, { id: 'borc-01', name: 'Örnek Banka Kredisi 01', cat: 'Banka', amount: 125000, rate: 42.5, min: 4200, vade: '2027-03-15', iban: ibanlar[3] }),
    borcUret(2, { id: 'borc-02', name: 'Örnek Şahıs Borcu 02', cat: 'Şahıs', amount: 15000.5, pid: 'kisi-02', note: 'Elden verilecek', verified: true }),
    borcUret(3, { id: 'borc-03', name: 'Örnek Vergi Borcu 03', cat: 'Vergi', amount: 8200, durum: 'acik' }),
    borcUret(4, { id: 'borc-04', name: 'Örnek SGK Borcu 04', cat: 'SGK', amount: 9100, durum: 'pazarlik' }),
    borcUret(5, { id: 'borc-05', name: 'Örnek İcra Borcu 05', cat: 'İcra', amount: 54321.99, durum: 'dava', note: 'İcra dosyasına bağlı' }),
    borcUret(6, { id: 'borc-06', name: 'Örnek Dolar Borcu 06', cat: 'Şahıs', amount: 1500, cur: 'USD', pid: 'kisi-03' }),
    borcUret(7, { id: 'borc-07', name: 'Örnek Euro Kredisi 07', cat: 'Banka', amount: 2500.75, cur: 'EUR', rate: 9.5 }),
    borcUret(8, { id: SENTETIK_ALINAN_BORC.borcId, name: 'Örnek Alınan Borç 08', cat: 'Şahıs', amount: 5000, pid: SENTETIK_ALINAN_BORC.kisiId, gelirId: SENTETIK_ALINAN_BORC.gelirId, sozTarih: '2026-09-30', kaynak: 'alinan-borc' }),
    borcUret(9, { id: 'borc-09', name: 'Örnek Bilinmeyen Kategori 09', cat: 'Bilinmeyen Kategori', amount: 777 }),
    borcUret(10, { id: 'borc-10', name: `Örnek Çok Uzun Ad ${'u'.repeat(200)}`, cat: 'Banka', amount: 100 }),
    borcUret(11, { id: 'borc-11', name: '', cat: 'Banka', amount: 100 }),
    borcUret(12, { id: 'borc-12', name: 'Örnek Geçersiz Tarih 12', cat: 'Banka', amount: 100, vade: '31/13/2026', balDate: 'dün' }),
    borcUret(13, { id: 'borc-sil-01', name: 'Örnek Silinmiş Borç', cat: 'Banka', amount: 321 }),
    borcUret(14, { id: 'borc-14', name: 'Örnek Kapanmış Borç 14', cat: 'Banka', amount: 0, durum: 'kapandi' }),
    borcUret(15, { id: 'borc-15', name: 'Örnek Geçersiz IBANlı Borç 15', cat: 'Şahıs', amount: 10, iban: SENTETIK_GECERSIZ_IBAN }),
    ...SAYI_METNI_VARYANTLARI.map((v, i) =>
      borcUret(20 + i, { id: `borc-sayi-${sira2(i + 1)}`, name: `Örnek Sayı Metni ${sira2(i + 1)}`, cat: 'Banka', amount: v.metin }),
    ),
  ];

  /* --- gelirler --- */
  const incomes: SGelir[] = [
    gelirUret(1, { id: 'gelir-01', name: 'Örnek Maaş 01', src: 'maas', monthly: 45000, gun: 1 }),
    gelirUret(2, { id: 'gelir-02', name: 'Örnek Kira Geliri 02', src: 'kira', monthly: 12500.5, gun: 10, from: '2026-02', to: '2027-02' }),
    gelirUret(3, { id: 'gelir-03', name: 'Örnek Ek İş 03', src: 'ekis', monthly: 3000, from: '2026-05', to: '2026-05', off: { '2026-03': true } }),
    gelirUret(4, { id: 'gelir-04', name: 'Örnek Tarla Geliri 04', src: 'tarla', monthly: '15.000,00' }),
    gelirUret(5, { id: 'gelir-05', name: 'Örnek Bahis Net Sonucu 05', src: 'bahis', monthly: -1250.5, from: '2026-05', to: '2026-05' }),
    gelirUret(6, { id: SENTETIK_ALINAN_BORC.gelirId, name: 'Örnek Alınan Borç Geliri', src: 'borc', tur: 'borc', monthly: 5000, from: '2026-03', to: '2026-03', borcId: SENTETIK_ALINAN_BORC.borcId, pid: SENTETIK_ALINAN_BORC.kisiId }),
    gelirUret(7, { id: 'gelir-07', name: 'Örnek Dolar Geliri 07', src: 'diger', monthly: 800, cur: 'USD' }),
    gelirUret(8, { id: 'gelir-08', name: 'Örnek Geçersiz Tutar 08', src: 'diger', monthly: 'abc' }),
  ];

  /* --- giderler --- */
  const expenses: SGider[] = [
    giderUret(1, { id: 'gider-01', name: 'Örnek Elektrik Faturası 01', cat: 'Fatura', amount: 1250.4, det: { aboneNo: CANARY_ABONE_NO } }),
    giderUret(2, { id: 'gider-02', name: 'Örnek Abonelik 02', cat: 'Abonelik', amount: '₺99', dueDay: 3, paid: true, paidDate: '2026-06-03', paidAy: '2026-06' }),
    giderUret(3, { id: 'gider-03', name: 'Örnek Tek Seferlik 03', cat: 'Diğer', amount: 4500, once: true, month: '2026-06' }),
    giderUret(4, { id: 'gider-04', name: 'Örnek Euro Gideri 04', cat: 'Abonelik', amount: 20, cur: 'EUR' }),
    giderUret(5, { id: 'gider-05', name: 'Örnek Kira 05', cat: 'Kira', amount: 18000, dueDay: 1, det: { iban: ibanBoslukluYaz(ibanlar[4]), alici: 'Örnek Ev Sahibi', banka: 'Örnek Banka' } }),
    giderUret(6, { id: 'gider-06', name: 'Örnek Geçersiz IBAN Gideri 06', cat: 'Fatura', amount: 10, det: { iban: SENTETIK_GECERSIZ_IBAN } }),
    giderUret(7, { id: 'gider-07', name: 'Örnek Su Faturası 07', cat: 'Fatura', amount: '1.234,50', dueDay: 31, det: { aboneNo: 'SENTETIK-ABONE-0007' } }),
    giderUret(8, { id: 'gider-sil-01', name: 'Örnek Silinmiş Gider', cat: 'Fatura', amount: 55 }),
  ];

  /* --- icra / dava --- */
  const icra: SIcra[] = [
    {
      id: '1', _ts: ts(300), no: '2099/00001 Esas', dr: 'Örnek İcra Dairesi 1', al: 'Örnek Alacaklı A.Ş. 01',
      as: 40000, gn: 54321.99, fz: 12000.5, tr: 'İlamsız', pr: 1, av: 'Av. Örnek Avukat 01', dt: '2025-11-20', dur: 'Aktif',
      dogr: '2026-05-01', teblig: '2025-12-01',
      odemePlani: { odemeler: [{ tutar: 2500, d: '2026-03-10' }, { tutar: 2500.5, d: '2026-04-10' }] },
      hacizler: [
        { tur: 'banka', hedef: 'Örnek Banka', tutar: 15000, d: '2026-01-15', durum: 'aktif', not: 'Örnek not' },
        { tur: 'maas', hedef: 'Örnek İşveren', tutar: 3000, d: '2026-02-01', durum: 'kaldirildi', not: '' },
        { tur: 'arac', hedef: 'Örnek Araç', tutar: 90000, d: '2026-02-15', durum: 'aktif', not: '' },
        { tur: 'tasinmaz', hedef: 'Örnek Taşınmaz', tutar: 250000, d: '2026-03-01', durum: 'aktif', not: '' },
        { tur: 'diger', hedef: 'Örnek Menkul', tutar: 500, d: '2026-03-15', durum: 'aktif', not: '' },
      ],
    },
    {
      id: '2', _ts: ts(301), no: '2099/00002 Esas', dr: 'Örnek İcra Dairesi 2', al: 'ÖRNEK ALACAKLI LTD. 02',
      as: 8000, gn: 9500, fz: 1500, tr: 'İlamlı', pr: 2, av: '', dt: '2026-01-05', dur: 'Kapalı',
      dogr: '', teblig: '',
      odemePlani: { odemeler: [] },
      hacizler: [],
    },
    {
      id: 'icra-x', _ts: ts(302), no: CANARY_DOSYA_NO, dr: 'Örnek İcra Dairesi 3', al: CANARY_AD,
      as: 1000, gn: 1100, fz: 100, tr: 'İlamsız', pr: 3, av: '', dt: '2026-02-02', dur: 'Aktif',
      dogr: '', teblig: '',
      odemePlani: { odemeler: [] },
      hacizler: [],
    },
  ];

  const cases: SDava[] = [
    { id: 'dava-01', _ts: ts(310), es: '2099/00101 E.', mh: 'Örnek Asliye Hukuk Mahkemesi 1', ad: 'Örnek alacak davası', rk: 'orta', as: 'Tahkikat', sa: 'Bilirkişi raporu', nt: 'Örnek not', taraf: 'Davacı', dur: 'Aktif' },
    { id: 'dava-02', _ts: ts(311), es: '2099/00102 E.', mh: 'Örnek Ağır Ceza Mahkemesi 2', ad: 'Örnek ceza dosyası', rk: 'yüksek', as: 'Duruşma', sa: '', nt: '', taraf: 'Sanık', dur: 'Aktif' },
    { id: 'dava-03', _ts: ts(312), es: CANARY_DOSYA_NO, mh: 'Örnek Cumhuriyet Başsavcılığı', ad: 'Örnek soruşturma', rk: '', as: '', sa: '', nt: '', taraf: 'Şüpheli', dur: 'Kapalı' },
  ];

  /* --- diğer koleksiyonlar --- */
  const koleksiyon: SKoleksiyon = {
    ...bosKoleksiyon(),
    debts,
    expenses,
    incomes,
    people,
    ibans: sIbans,
    icra,
    cases,
    petitions: [
      { s: 'Örnek dilekçe 01', n: 'Örnek not', d: '2026-04-01', c: 'Örnek mahkeme', b: 'Örnek gövde' },
    ],
    legal: [
      { id: 'hukuk-01', _ts: ts(320), title: 'Örnek duruşma', type: 'durusma', date: '2026-07-10', note: '' },
      { id: 'hukuk-02', _ts: ts(321), title: 'Örnek süre sonu', type: 'sure', date: '2026-08-01', note: 'Örnek' },
    ],
    fixdates: [{ t: 'Örnek vergi tarihi', r: 'vergi', k: 'Vergi', dom: 26 }],
    purchases: [
      { id: 'alis-01', _ts: ts(330), name: 'Örnek Ürün 01', cat: 'Ev', cost: 2500, cur: 'TRY', prio: 2, month: '2026-09', done: false, link: 'https://ornek.invalid/urun-01', note: '' },
      { id: 'alis-02', _ts: ts(331), name: 'Örnek Ürün 02', cat: 'Elektronik', cost: 150, cur: 'USD', prio: 4, month: '2026-12', done: true, link: '', note: '' },
    ],
    todos: [
      { id: 'yap-01', _ts: ts(340), text: 'Örnek yapılacak 01', done: false, date: '2026-06-20', tag: 'genel' },
      { id: 'yap-02', _ts: ts(341), text: 'Örnek yapılacak 02', done: true, date: '', tag: '' },
    ],
    deposits: [
      { id: 'mev-01', _ts: ts(350), name: 'Örnek Mevduat 01', amount: 100000, cur: 'TRY', rate: 38, bilesik: 'gunluk', vade: 32, stopaj: 7.5 },
      { id: 'mev-02', _ts: ts(351), name: 'Örnek Döviz Mevduatı 02', amount: 2000, cur: 'USD', rate: 1.5, bilesik: 'aylik', vade: 90, stopaj: 15 },
    ],
    investments: [
      { id: 'yat-01', _ts: ts(360), name: 'Örnek Altın 01', tur: 'altin', amount: 30, cur: 'TRY' },
      { id: 'yat-02', _ts: ts(361), name: 'Örnek BES 02', tur: 'bes', amount: 45000, cur: 'TRY' },
      { id: 'yat-03', _ts: ts(362), name: 'Örnek Hisse 03', tur: 'hisse', amount: 12000, cur: 'TRY' },
    ],
    limitler: [{ id: 'limit-01', _ts: ts(370), name: 'Örnek Kart Limiti', limit: tutar(10000, 50000), used: tutar(0, 10000) }],
  };

  /* --- uygulama durumları: S.apps = { anahtar: JSON string } --- */
  const apps: Record<string, string> = {
    'odeme-raporu-v1': JSON.stringify({ v: 1, akis: [{ tur: 'fatura', ad: 'Örnek Ödeme 01', tutar: 750, odemeler: [], sonOdeme: '2026-06-30', iban: CANARY_IBAN, aboneNo: CANARY_ABONE_NO, faturaNo: 'SENTETIK-FATURA-01' }] }),
    'market-listesi-v1': JSON.stringify({ liste: [{ ad: 'Örnek süt', adet: 2 }, { ad: 'Örnek ekmek', adet: 1 }] }),
    'market-listesi-ayar': JSON.stringify({ para: 'TRY' }),
    'bahis_takip_v2': JSON.stringify({ kayitlar: [{ site: 'ornek-site-1', net: -1250.5 }] }),
    'bahis_takip_theme': 'koyu',
    'hesap-yoneticisi-v1': JSON.stringify({ siteler: [{ ad: 'Örnek Site', kullanici: 'ornek.kullanici', parola: CANARY_PAROLA, ipucu: 'Örnek ipucu' }] }),
    'tr-fav': JSON.stringify(['kisi-01']),
    'tr-chip': JSON.stringify({ secili: 'hepsi' }),
    'oynatma-listelerim-durum-v2': JSON.stringify({ liste: ['Örnek Liste 1'] }),
    'oynatma-listelerim-ui': JSON.stringify({ gorunum: 'izgara' }),
    'pinterest-panolarim-durum-v1': JSON.stringify({ pano: ['Örnek Pano'] }),
    'ilgi-urunler-durum-v1': JSON.stringify({ favoriler: ['urun-001'] }),
    'dosya-yoneticisi-ui': JSON.stringify({ klasor: '/' }),
    'astra_prefs': JSON.stringify({ tema: 'koyu', anahtar: CANARY_ANAHTAR }),
    'astra_tasks': JSON.stringify([{ id: 't1', ad: 'Örnek görev', tamam: false }]),
    'tasarim-atolyesi-ayar': JSON.stringify({ renk: '#336699' }),
  };
  if (secenek.buyukDeger) apps['tasarim-atolyesi-kutuphane'] = buyukUygulamaDegeriUret();
  if (secenek.uzunAnahtar) apps[`uzun-anahtar-${'a'.repeat(210)}`] = '1';

  return {
    _v: 15,
    _ts: SENTETIK_TEMEL_TS,
    _istemci: 'sentetik-istemci',
    _min: 1,
    koleksiyon,
    ayar: {
      rate: 42.5, rateLo: 38, rateHi: 46, capital: 250000, alloc: { mevduat: 0.5, altin: 0.2, bes: 0.3 },
      engine: { aktif: true }, sim: { stres: 1.2 }, dep: { stopaj: 7.5 }, inv: { hedef: 0.1 }, inflation: 33.5,
      stopajMap: { '32': 7.5 }, rym: 0.02, tco: { yil: 5 }, kira: { artis: 25 }, firmaEsleme: {}, raporSablon: 'varsayilan',
      aracKirilim: {}, autoKur: false, autoClose: false, deferUntil: '', gold: { gram: 3200 }, rssAyar: {},
    },
    silinen: {
      debts: { 'borc-sil-01': ts(900) },
      expenses: { 'gider-sil-01': ts(901) },
      people: { 'kisi-sil-01': ts(902) },
    },
    statements: { '2026-05': { toplam: tutar(1000, 2000), kayit: 3 } },
    ledger: { '2026-05': { kapandi: true, ts: ts(950) } },
    dayLog: { '2026-06-14': { borc: tutar(100000, 200000), gelir: tutar(40000, 50000) } },
    diger: {
      apps,
      alacaklar: [],
      kasa: { nakit: tutar(500, 1500) },
      abonelikler: [],
      butce: { aylik: 30000 },
      gocBayraklari: { v15: true },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Girdi zarfları                                                      */
/* ------------------------------------------------------------------ */

export type SentetikZarflar = {
  /** Uygulama yedek JSON'u: kökte doğrudan `S` (koleksiyon/ayar/silinen/diger). */
  yedek: SentetikS;
  /** `astra_kasa_duz.durum` çıktısı: `{ durum: S }`. */
  kasaDuzDurum: { durum: SentetikS };
  /** Düz kasa zarfı: `{ v: 0, m: '<S JSON>' }`. */
  duzZarf: { v: 0; m: string };
  /** Şifreli zarf v1: `{ v: 1, i, d }` — çözülmez, SIFRELI_GIRDI olarak reddedilmeli. İçerik rastgele sahte bayt (base64). */
  sifreliZarfV1: { v: 1; i: string; d: string };
  /** Şifreli zarf v2 (aynı biçim, farklı sürüm). */
  sifreliZarfV2: { v: 2; i: string; d: string };
  /** Bozuk (kesik) JSON metni. */
  bozukMetin: string;
  /** Boş koleksiyonlu geçerli `S`. */
  bosS: SentetikS;
};

function sahteBase64(rastgele: () => number, bayt: number): string {
  const harfler = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  for (let i = 0; i < Math.ceil(bayt * 4 / 3); i++) s += harfler[Math.floor(rastgele() * 64)];
  return s;
}

/** Tüm girdi biçimleri. Dosya içeriği olarak yazmak için `JSON.stringify` (bozukMetin hariç) kullanın. */
export function sentetikZarflariUret(s: SentetikS = sentetikSUret(), tohum: number = SENTETIK_VARSAYILAN_TOHUM): SentetikZarflar {
  const rastgele = tohumdanUretec(tohum + 1);
  const bos: SentetikS = { ...sentetikSUret({ tohum }), koleksiyon: bosKoleksiyon(), silinen: {}, diger: { apps: {} } };
  return {
    yedek: s,
    kasaDuzDurum: { durum: s },
    duzZarf: { v: 0, m: JSON.stringify(s) },
    sifreliZarfV1: { v: 1, i: sahteBase64(rastgele, 12), d: sahteBase64(rastgele, 96) },
    sifreliZarfV2: { v: 2, i: sahteBase64(rastgele, 12), d: sahteBase64(rastgele, 96) },
    bozukMetin: JSON.stringify(s).slice(0, 120),
    bosS: bos,
  };
}
