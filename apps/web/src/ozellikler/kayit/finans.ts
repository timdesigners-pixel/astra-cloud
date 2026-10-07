import { gun, tl } from '../../ortak/bicim';
import { kayitSayfasi, sayi, type Alan, type Hucre, type KayitAyari, type Sutun } from './kayit-sayfasi';
import { kayitlariGetir, type Kayit } from '../../veri/kayit';

const ad = (k: Kayit, f: string) => String(k[f] ?? '—');
const sec = (liste: [string, string][], v: unknown) => liste.find(x => x[0] === v)?.[1] ?? '—';
const topla = (l: Kayit[], f: string) => l.reduce((t, k) => t + sayi(k[f]), 0);

const DURUM: [string, string][] = [['acik', 'Açık'], ['yapilandirma', 'Yapılandırmada'], ['kapandi', 'Kapandı']];
const PERIYOT: [string, string][] = [['aylik', 'Aylık'], ['uc_aylik', '3 aylık'], ['yillik', 'Yıllık'], ['tek_sefer', 'Tek sefer']];
const PARA: [string, string][] = [['TRY', 'TL'], ['USD', 'Dolar'], ['EUR', 'Euro']];

/* ---------- borçlar ---------- */
const borcAlanlari = (altTurler: [string, string][] | null, kisiEtiketi: string, yonVar: boolean): Alan[] => [
  { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true, ipucu: 'Örnek: kredi adı, dönem ya da kişi notu' },
  ...(altTurler ? [{ ad: 'alt_tur', etiket: 'Tür', tur: 'secim', secenekler: altTurler, zorunlu: true } as Alan] : []),
  ...(yonVar ? [{ ad: 'yon', etiket: 'Yön', tur: 'secim', secenekler: [['borclu', 'Ben borçluyum'], ['alacakli', 'Ben alacaklıyım']], zorunlu: true, varsayilan: 'borclu' } as Alan] : []),
  { ad: 'alacakli_id', etiket: kisiEtiketi, tur: 'kisi' },
  { ad: 'hesap_id', etiket: 'Ödeme yapılacak hesap', tur: 'hesap' },
  { ad: 'anapara', etiket: 'Anapara (TL)', tur: 'sayi' },
  { ad: 'guncel_borc', etiket: 'Kalan borç (TL)', tur: 'sayi', ipucu: 'Boş bırakırsan anapara yazılır' },
  { ad: 'faiz_orani', etiket: 'Faiz oranı (%)', tur: 'sayi' },
  { ad: 'baslangic_tarihi', etiket: 'Başlangıç', tur: 'tarih' },
  { ad: 'bitis_tarihi', etiket: 'Bitiş ya da son tarih', tur: 'tarih' },
  { ad: 'durum', etiket: 'Durum', tur: 'secim', secenekler: DURUM, zorunlu: true, varsayilan: 'acik' },
  { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
];

const borcHazirla = (g: Record<string, unknown>) => {
  const anapara = (g.anapara as number | null) ?? 0;
  return { ...g, anapara, guncel_borc: (g.guncel_borc as number | null) ?? anapara };
};

function borcAyari(tur: string, yeni: string, baslik: string, bos: string, kisiEtiketi: string, altTurler: [string, string][] | null, yonVar: boolean,
  ozet: (l: Kayit[]) => Hucre[], kisiBaslik: string): KayitAyari {
  const sutunlar: Sutun[] = [
    { baslik: 'Ad', goster: k => ad(k, 'ad') },
    ...(altTurler ? [{ baslik: 'Tür', goster: (k: Kayit) => sec(altTurler, k.alt_tur) }] : []),
    { baslik: kisiBaslik, goster: (k, b) => b.kisiler.get(String(k.alacakli_id)) ?? '—' },
    ...(yonVar ? [{ baslik: 'Yön', goster: (k: Kayit) => (k.yon === 'alacakli' ? 'Alacaklıyım' : 'Borçluyum') }] : []),
    { baslik: 'Kalan', sayi: true, goster: k => tl(sayi(k.guncel_borc)) },
    { baslik: 'Son tarih', goster: k => gun(k.bitis_tarihi as string | null) },
    { baslik: 'Durum', goster: k => sec(DURUM, k.durum) },
  ];
  return {
    tablo: 'borclar', yeniDugme: yeni, yeniBaslik: baslik, bos, alanlar: borcAlanlari(altTurler, kisiEtiketi, yonVar), sutunlar,
    filtre: { tur }, sabit: { tur }, sirala: 'ad', aramaAlanlari: ['ad'], hazirla: borcHazirla, ozet,
  };
}

const acikBorclu = (l: Kayit[]) => l.filter(k => k.durum !== 'kapandi' && k.yon !== 'alacakli');

const kisiBorclari = borcAyari('kisi', '+ Yeni borç', 'Yeni kişi borcu', 'Henüz kişi borcu yok.', 'Kişi', null, true, l => {
  const borc = topla(acikBorclu(l), 'guncel_borc');
  const alacak = topla(l.filter(k => k.durum !== 'kapandi' && k.yon === 'alacakli'), 'guncel_borc');
  return [['Borçlu olduğum', tl(borc), `${acikBorclu(l).length} açık kayıt`, 'vurgu'], ['Alacağım', tl(alacak), 'borç toplamına karışmaz'], ['Net', tl(alacak - borc), 'alacak eksi borç']];
}, 'Kişi');

const BANKA_TURU: [string, string][] = [['kredi', 'Kredi'], ['kredi_karti', 'Kredi kartı'], ['kmh', 'KMH']];
const bankaBorclari = borcAyari('banka', '+ Yeni banka borcu', 'Yeni banka borcu', 'Henüz kredi, kart ya da KMH borcu yok.', 'Banka', BANKA_TURU, false, l => {
  const a = acikBorclu(l);
  const t = (u: string) => topla(a.filter(k => k.alt_tur === u), 'guncel_borc');
  return [['Toplam banka borcu', tl(topla(a, 'guncel_borc')), `${a.length} açık kayıt`, 'vurgu'], ['Kredi', tl(t('kredi'))], ['Kredi kartı', tl(t('kredi_karti'))], ['KMH', tl(t('kmh'))]];
}, 'Banka');

const VERGI_TURU: [string, string][] = [['kdv', 'KDV'], ['gelir_vergisi', 'Gelir vergisi'], ['damga', 'Damga'], ['mtv', 'MTV'], ['diger', 'Diğer']];
const vergiBorclari = borcAyari('vergi', '+ Yeni vergi borcu', 'Yeni vergi borcu', 'Henüz vergi borcu yok.', 'Vergi dairesi', VERGI_TURU, false, l => {
  const a = acikBorclu(l);
  return [['Toplam vergi borcu', tl(topla(a, 'guncel_borc')), `${a.length} açık kayıt`, 'vurgu']];
}, 'Vergi dairesi');

const SGK_TURU: [string, string][] = [['prim', 'Prim'], ['yapilandirma', 'Yapılandırma']];
const sgkBorclari = borcAyari('sgk', '+ Yeni SGK borcu', 'Yeni SGK borcu', 'Henüz SGK borcu yok.', 'SGK müdürlüğü', SGK_TURU, false, l => {
  const a = acikBorclu(l);
  return [['Toplam SGK borcu', tl(topla(a, 'guncel_borc')), `${a.length} açık kayıt`, 'vurgu']];
}, 'SGK');

/* ---------- limitler ---------- */
const limitler: KayitAyari = {
  tablo: 'limitler', yeniDugme: '+ Yeni limit', yeniBaslik: 'Yeni limit', bos: 'Henüz limit yok.',
  alanlar: [
    { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true },
    { ad: 'kisi_id', etiket: 'Kişi (kişiden alınan limit)', tur: 'kisi', ipucu: 'Kişi ya da banka hesabından yalnız biri seçilir' },
    { ad: 'hesap_id', etiket: 'Banka hesabı (bankadan alınan limit)', tur: 'hesap' },
    { ad: 'limit_tutari', etiket: 'Limit (TL)', tur: 'sayi', zorunlu: true },
    { ad: 'kullanilan', etiket: 'Kullanılan (TL)', tur: 'sayi' },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'Ad', goster: k => ad(k, 'ad') },
    { baslik: 'Kaynak', goster: (k, b) => b.kisiler.get(String(k.kisi_id)) ?? b.hesaplar.get(String(k.hesap_id)) ?? '—' },
    { baslik: 'Limit', sayi: true, goster: k => tl(sayi(k.limit_tutari)) },
    { baslik: 'Kullanılan', sayi: true, goster: k => tl(sayi(k.kullanilan)) },
    { baslik: 'Doluluk', sayi: true, goster: k => (sayi(k.limit_tutari) ? `%${Math.round((sayi(k.kullanilan) / sayi(k.limit_tutari)) * 100)}` : '—') },
  ],
  filtre: {}, sirala: 'ad',
  hazirla: g => ({ ...g, kullanilan: (g.kullanilan as number | null) ?? 0 }),
  dogrula: g => ((g.kisi_id ? 1 : 0) + (g.hesap_id ? 1 : 0) === 1 ? null : 'Kişi ya da banka hesabından yalnız birini seç.'),
  ozet: l => {
    const t = topla(l, 'limit_tutari'), k = topla(l, 'kullanilan');
    return [['Toplam limit', tl(t)], ['Kullanılan', tl(k), '', 'uyari'], ['Kullanılabilir', tl(t - k), '', 'vurgu']];
  },
};

/* ---------- hesaplar ---------- */
const HESAP_TURU: [string, string][] = [['vadesiz', 'Vadesiz'], ['kredi_karti', 'Kredi kartı'], ['kredi', 'Kredi'], ['kmh', 'KMH'], ['diger', 'Diğer']];
const hesaplar: KayitAyari = {
  tablo: 'hesaplar', yeniDugme: '+ Yeni hesap', yeniBaslik: 'Yeni hesap', bos: 'Henüz hesap yok. IBAN\'lar IBAN Rehberi\'nde tutulur.',
  alanlar: [
    { ad: 'ad', etiket: 'Hesap adı', tur: 'metin', zorunlu: true },
    { ad: 'banka_id', etiket: 'Banka', tur: 'kisi' },
    { ad: 'tur', etiket: 'Tür', tur: 'secim', secenekler: HESAP_TURU, zorunlu: true, varsayilan: 'vadesiz' },
    { ad: 'acilis_bakiyesi', etiket: 'Açılış bakiyesi (TL)', tur: 'sayi', ipucu: 'Güncel bakiye = açılış + girişler − çıkışlar' },
    { ad: 'hesap_kesim_gunu', etiket: 'Hesap kesim günü', tur: 'sayi', ipucu: 'Yalnız kartlar için, 1–31' },
    { ad: 'son_odeme_gunu', etiket: 'Son ödeme günü', tur: 'sayi', ipucu: 'Yalnız kartlar için, 1–31' },
    { ad: 'aktif', etiket: 'Aktif', tur: 'onay' },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'Hesap', goster: k => ad(k, 'ad') },
    { baslik: 'Banka', goster: (k, b) => b.kisiler.get(String(k.banka_id)) ?? '—' },
    { baslik: 'Tür', goster: k => sec(HESAP_TURU, k.tur) },
    { baslik: 'Güncel bakiye', sayi: true, goster: (k, b) => tl(sayi(k.acilis_bakiyesi) + ((b.dis?.hareket as Map<string, number> | undefined)?.get(k.id) ?? 0)) },
    { baslik: 'Durum', goster: k => (k.aktif === false ? 'Pasif' : 'Aktif') },
  ],
  filtre: {}, sirala: 'ad',
  dis: async () => {
    const h = await kayitlariGetir('hareketler', ['hesap_id', 'yon', 'tutar'], {}, 'tarih');
    const m = new Map<string, number>();
    h.forEach(x => m.set(String(x.hesap_id), (m.get(String(x.hesap_id)) ?? 0) + (x.yon === 'giris' ? 1 : -1) * sayi(x.tutar)));
    return { hareket: m };
  },
  hazirla: g => ({ ...g, acilis_bakiyesi: (g.acilis_bakiyesi as number | null) ?? 0 }),
  ozet: (l, b) => {
    const hareket = (b.dis?.hareket as Map<string, number> | undefined) ?? new Map<string, number>();
    const bakiye = (k: Kayit) => sayi(k.acilis_bakiyesi) + (hareket.get(k.id) ?? 0);
    const vadesiz = l.filter(k => k.aktif !== false && k.tur === 'vadesiz');
    return [['Vadesiz bakiye', tl(vadesiz.reduce((t, k) => t + bakiye(k), 0)), `${vadesiz.length} hesap`, 'vurgu'], ['Hesap', String(l.length), `${l.filter(k => k.aktif !== false).length} aktif`]];
  },
};

/* ---------- gelirler ---------- */
const aylik = (k: Kayit) => {
  const t = sayi(k.tutar);
  return k.periyot === 'yillik' ? t / 12 : k.periyot === 'uc_aylik' ? t / 3 : k.periyot === 'tek_sefer' ? 0 : t;
};
const gelirAlanlari = (turler: [string, string][], ekstra: boolean): Alan[] => [
  { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true },
  { ad: 'tur', etiket: 'Tür', tur: 'secim', secenekler: turler, zorunlu: true },
  ...(ekstra ? [] : [{ ad: 'periyot', etiket: 'Ne sıklıkla', tur: 'secim', secenekler: PERIYOT.slice(0, 3), zorunlu: true, varsayilan: 'aylik' } as Alan]),
  { ad: 'tutar', etiket: 'Tutar (TL)', tur: 'sayi', zorunlu: true, ipucu: ekstra ? 'Bahis zararı eksi tutarla yazılır' : undefined },
  ...(ekstra ? [{ ad: 'baslangic', etiket: 'Tarih', tur: 'tarih' } as Alan] : [{ ad: 'gun', etiket: 'Ayın kaçında gelir', tur: 'sayi' } as Alan]),
  { ad: 'hesap_id', etiket: 'Yattığı hesap', tur: 'hesap' },
  ...(ekstra ? [] : [{ ad: 'bitis', etiket: 'Bitiş tarihi', tur: 'tarih' } as Alan, { ad: 'aktif', etiket: 'Aktif', tur: 'onay' } as Alan]),
  { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
];
const SABIT_GELIR: [string, string][] = [['maas', 'Maaş'], ['kira', 'Kira geliri'], ['faiz', 'Faiz geliri'], ['tarla', 'Tarla kirası'], ['diger', 'Diğer']];
const EKSTRA_GELIR: [string, string][] = [['ek_is', 'Ek iş'], ['bahis', 'Bahis kazancı'], ['alinan_borc', 'Alınan borç'], ['diger', 'Diğer']];

const sabitGelirler: KayitAyari = {
  tablo: 'gelirler', yeniDugme: '+ Yeni gelir', yeniBaslik: 'Yeni sabit gelir', bos: 'Henüz sabit gelir yok.',
  alanlar: gelirAlanlari(SABIT_GELIR, false),
  sutunlar: [
    { baslik: 'Ad', goster: k => ad(k, 'ad') }, { baslik: 'Tür', goster: k => sec(SABIT_GELIR, k.tur) },
    { baslik: 'Sıklık', goster: k => sec(PERIYOT, k.periyot) }, { baslik: 'Tutar', sayi: true, goster: k => tl(sayi(k.tutar)) },
    { baslik: 'Gün', goster: k => (k.gun ? String(k.gun) : '—') }, { baslik: 'Durum', goster: k => (k.aktif === false ? 'Pasif' : 'Aktif') },
  ],
  filtre: { sabit: true }, sabit: { sabit: true }, sirala: 'ad',
  ozet: l => {
    const a = l.filter(k => k.aktif !== false);
    return [['Aylık eşdeğer', tl(a.reduce((t, k) => t + aylik(k), 0)), 'yıllık ve 3 aylık gelirler aya bölünür', 'vurgu'], ['Aktif kaynak', String(a.length)]];
  },
};

const ekstraGelirler: KayitAyari = {
  tablo: 'gelirler', yeniDugme: '+ Yeni gelir', yeniBaslik: 'Yeni ekstra gelir', bos: 'Henüz ekstra gelir yok.',
  alanlar: gelirAlanlari(EKSTRA_GELIR, true),
  sutunlar: [
    { baslik: 'Tarih', goster: k => gun(k.baslangic as string | null) }, { baslik: 'Ad', goster: k => ad(k, 'ad') },
    { baslik: 'Tür', goster: k => sec(EKSTRA_GELIR, k.tur) }, { baslik: 'Tutar', sayi: true, goster: k => tl(sayi(k.tutar)) },
    { baslik: 'Hesap', goster: (k, b) => b.hesaplar.get(String(k.hesap_id)) ?? '—' },
  ],
  filtre: { sabit: false }, sabit: { sabit: false, periyot: 'tek_sefer' }, sirala: 'baslangic',
  hazirla: g => ({ ...g, gelir_sayilir: g.tur !== 'alinan_borc' }),
  ozet: l => {
    const gelir = l.filter(k => k.tur !== 'alinan_borc');
    return [['Ekstra gelir', tl(topla(gelir, 'tutar')), 'alınan borç hariç', 'vurgu'], ['Alınan borç', tl(topla(l.filter(k => k.tur === 'alinan_borc'), 'tutar')), 'gelir sayılmaz, nakit girişidir']];
  },
};

/* ---------- giderler ---------- */
const giderAyari = (tur: string, yeni: string, baslik: string, bos: string, gunEtiketi: string, taksit: boolean, doviz: boolean): KayitAyari => ({
  tablo: 'giderler', yeniDugme: yeni, yeniBaslik: baslik, bos,
  alanlar: [
    { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true },
    { ad: 'tutar', etiket: 'Tutar', tur: 'sayi', zorunlu: true },
    ...(doviz ? [{ ad: 'para_birimi', etiket: 'Para birimi', tur: 'secim', secenekler: PARA, zorunlu: true, varsayilan: 'TRY' } as Alan] : []),
    { ad: 'periyot', etiket: 'Ne sıklıkla', tur: 'secim', secenekler: PERIYOT, zorunlu: true, varsayilan: 'aylik' },
    { ad: 'gun', etiket: gunEtiketi, tur: 'sayi', ipucu: '1–31' },
    { ad: 'hesap_id', etiket: 'Ödenen hesap', tur: 'hesap' },
    ...(taksit ? [{ ad: 'taksit_toplam', etiket: 'Toplam taksit', tur: 'sayi' } as Alan, { ad: 'taksit_kalan', etiket: 'Kalan taksit', tur: 'sayi' } as Alan,
      { ad: 'bitis', etiket: 'Bitiş tarihi', tur: 'tarih' } as Alan] : []),
    { ad: 'aktif', etiket: 'Aktif', tur: 'onay' },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'Ad', goster: k => ad(k, 'ad') },
    { baslik: 'Tutar', sayi: true, goster: k => (k.para_birimi && k.para_birimi !== 'TRY' ? `${sayi(k.tutar)} ${k.para_birimi}` : tl(sayi(k.tutar))) },
    { baslik: 'Sıklık', goster: k => sec(PERIYOT, k.periyot) },
    { baslik: 'Gün', goster: k => (k.gun ? String(k.gun) : '—') },
    ...(taksit ? [{ baslik: 'Kalan taksit', goster: (k: Kayit) => (k.taksit_kalan === null || k.taksit_kalan === undefined ? '—' : String(k.taksit_kalan)) }] : []),
    { baslik: 'Durum', goster: k => (k.aktif === false ? 'Pasif' : 'Aktif') },
  ],
  filtre: { tur }, sabit: { tur }, sirala: 'ad',
  ozet: l => {
    const a = l.filter(k => k.aktif !== false && (k.para_birimi ?? 'TRY') === 'TRY');
    const diger = l.filter(k => k.aktif !== false && (k.para_birimi ?? 'TRY') !== 'TRY').length;
    return [['Aylık eşdeğer (TL)', tl(a.reduce((t, k) => t + aylik(k), 0)), diger ? `${diger} dövizli kayıt dahil değil` : 'yıllık ve 3 aylık giderler aya bölünür', 'vurgu'], ['Aktif kayıt', String(l.filter(k => k.aktif !== false).length)]];
  },
});

export const FINANS_SAYFALARI: Record<string, (kok: HTMLElement) => void> = {
  'b-kisi': kayitSayfasi(kisiBorclari),
  'b-banka': kayitSayfasi(bankaBorclari),
  'b-vergi': kayitSayfasi(vergiBorclari),
  'b-sgk': kayitSayfasi(sgkBorclari),
  'b-limit': kayitSayfasi(limitler),
  'r-hesap': kayitSayfasi(hesaplar),
  'g-sabit': kayitSayfasi(sabitGelirler),
  'g-ekstra': kayitSayfasi(ekstraGelirler),
  'e-fatura': kayitSayfasi(giderAyari('fatura', '+ Yeni fatura', 'Yeni fatura', 'Henüz fatura yok.', 'Son ödeme günü', false, false)),
  'e-abone': kayitSayfasi(giderAyari('abonelik', '+ Yeni abonelik', 'Yeni abonelik', 'Henüz abonelik yok.', 'Yenileme günü', false, true)),
  'e-sabit': kayitSayfasi(giderAyari('sabit', '+ Yeni sabit gider', 'Yeni sabit gider', 'Henüz sabit gider yok.', 'Ödeme günü', true, false)),
};
