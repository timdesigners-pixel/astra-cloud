import type { Kayit } from './kayit';
import { imzaDurumu, siradakiYukumluluk, ONEM_ADI, type Imza, type Yukumluluk } from './sureler';

export type Kategori = 'borc' | 'gider' | 'hukuk' | 'todo' | 'diger';
export type Seviye = 'red' | 'gold' | 'cyan';
export type Eylem =
  | { tur: 'odeme'; id: string; hesapId: string | null; tutar: number }
  | { tur: 'todo'; id: string }
  | { tur: 'ajanda'; id: string };

export type Bildirim = {
  id: string; kategori: Kategori; etiket: string; seviye: Seviye; acil: boolean;
  kalanGun: number | null; vade: string; baslik: string; tutar: number; rozet: string;
  not: string; ikon: string; sekme: string; sekmeAd: string; eylem?: Eylem; skor: number;
  /* Aynı uyarı vade değişince yeniden gelsin diye anahtara vade eklenir. */
  anahtar: string;
};

export type BildirimGirdi = {
  odemeler: Kayit[]; borclar: Kayit[]; todolar: Kayit[]; davalar: Kayit[]; ajanda: Kayit[];
  varliklar: Kayit[]; alinacaklar: Kayit[]; urunler: Kayit[];
  serbest: number; yedekGun: number | null; sorunlar: string[];
  /* Son tahlil raporundaki referans dışı değerler (ad listesi) ve raporun tarihi. */
  tahlilDisi?: { adlar: string[]; tarih: string };
  /* Her ay tekrarlayan sabit tarihler ve karakol imzası. */
  sabitler?: Yukumluluk[]; imza?: Imza;
  /* Tebliği girilmiş icra dosyalarının süreleri ve anlaşılan taksit planında geride kalanlar. */
  icraSureleri?: { id: string; ad: string; sure: string; kalan: number; son: string }[];
  icraPlanlari?: { id: string; ad: string; gecikme: number; geride: number }[];
};

const sayi = (v: unknown) => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? 0 : Number(v));
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const tl = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });

export const gunFarkiTarih = (t: string, bugun: string) => Math.round((Date.parse(t.slice(0, 10)) - Date.parse(bugun)) / 86400000);
const kisaTarih = (t: string) => { const [, a, g] = t.slice(0, 10).split('-').map(Number); return `${g} ${AYLAR[(a ?? 1) - 1]}`; };

/* Küçük olan üstte durur: bütçe açığı ve vadesi geçenler en başta. */
export function aciliyetPuani(b: Pick<Bildirim, 'kalanGun' | 'seviye' | 'acil'> & { tur?: string }): number {
  if (b.tur === 'butce') return -700;
  if (typeof b.kalanGun === 'number' && !Number.isNaN(b.kalanGun)) {
    if (b.kalanGun < 0) return -1000 + b.kalanGun;
    if (b.kalanGun === 0) return -500;
    return b.kalanGun;
  }
  if (b.acil || b.seviye === 'red') return -300;
  return 5000;
}

function vadeDurumu(fark: number, tarih: string, sonGunMetni: string): { seviye: Seviye; acil: boolean; rozet: string; vade: string } {
  const vade = kisaTarih(tarih);
  if (fark === 0) return { seviye: 'red', acil: true, rozet: sonGunMetni, vade: 'Bugün' };
  if (fark < 0) return { seviye: 'red', acil: true, rozet: `VADESİ GEÇTİ (${Math.abs(fark)} gün)`, vade };
  if (fark <= 3) return { seviye: 'red', acil: true, rozet: `${fark} GÜN KALDI`, vade };
  if (fark <= 7) return { seviye: 'gold', acil: false, rozet: `${fark} GÜN KALDI`, vade };
  return { seviye: 'cyan', acil: false, rozet: `${fark} gün sonra`, vade };
}

export function bildirimUret(g: BildirimGirdi, bugun: string): Bildirim[] {
  const liste: Bildirim[] = [];
  const ekle = (b: Omit<Bildirim, 'skor' | 'anahtar'> & { tur?: string }) => {
    const { tur, ...govde } = b;
    liste.push({ ...govde, skor: aciliyetPuani({ ...govde, tur }), anahtar: `${b.id}|${b.vade}` });
  };
  const borcAd = new Map(g.borclar.map(b => [String(b.id), String(b.ad ?? '')]));
  const borcTutar = new Map(g.borclar.map(b => [String(b.id), sayi(b.guncel_borc)]));

  /* Bekleyen ödemeler: geçmişin hepsi, gelecekte 14 gün. */
  g.odemeler.filter(o => o.durum === 'bekliyor').forEach(o => {
    const t = String(o.vade_tarihi);
    const fark = gunFarkiTarih(t, bugun);
    if (fark > 14) return;
    const d = vadeDurumu(fark, t, 'BUGÜN VADESİ!');
    const ad = borcAd.get(String(o.borc_id)) || 'Ödeme';
    const kalan = borcTutar.get(String(o.borc_id));
    ekle({
      id: `odeme-${o.id}`, kategori: 'borc', etiket: 'Borç / Ödeme', seviye: d.seviye, acil: d.acil, kalanGun: fark, vade: d.vade,
      baslik: ad, tutar: sayi(o.tutar), rozet: d.rozet,
      not: `Vade: ${kisaTarih(t)}${kalan ? ` · Kalan borç: ${tl(kalan)}` : ''}${o.notlar ? ` · ${String(o.notlar)}` : ''}`,
      ikon: fark < 0 ? '⚠️' : fark === 0 ? '🚨' : d.acil ? '⚡' : '💳', sekme: 'o-takvim', sekmeAd: 'Ödeme Takvimi',
      eylem: { tur: 'odeme', id: String(o.id), hesapId: (o.hesap_id as string | null) ?? null, tutar: sayi(o.tutar) },
    });
  });

  /* Duruşmalar: iki gün gecikmeden 14 gün öncesine. */
  g.davalar.filter(d => d.durum !== 'kapandi' && d.sonraki_durusma).forEach(d => {
    const t = String(d.sonraki_durusma);
    const fark = gunFarkiTarih(t, bugun);
    if (fark < -2 || fark > 14) return;
    const acil = fark <= 2;
    const tur = String(d.tur);
    ekle({
      id: `durusma-${d.id}`, kategori: 'hukuk', etiket: 'Duruşma', seviye: acil ? 'red' : 'gold', acil, kalanGun: fark, vade: kisaTarih(t),
      baslik: `Duruşma: ${String(d.konu ?? d.mahkeme ?? 'Dava')}`, tutar: 0, rozet: fark <= 0 ? 'BUGÜN' : `${fark} GÜN KALDI`,
      not: `${d.mahkeme ? String(d.mahkeme) + ' · ' : ''}Tarih: ${kisaTarih(t)}`, ikon: '🏛️',
      sekme: tur === 'ceza' ? 'k-ceza' : tur === 'cbs' ? 'k-cbs' : 'k-hukuk', sekmeAd: 'Davalar',
    });
  });

  /* Ajanda: yaklaşan ve yapılmamış kayıtlar. */
  g.ajanda.filter(a => a.tamamlandi !== true).forEach(a => {
    const t = String(a.tarih);
    const fark = gunFarkiTarih(t, bugun);
    if (fark < -2 || fark > 7) return;
    const d = vadeDurumu(fark, t, 'BUGÜN');
    ekle({
      id: `ajanda-${a.id}`, kategori: 'todo', etiket: 'Ajanda', seviye: fark < 0 ? 'red' : fark === 0 ? 'gold' : 'cyan', acil: fark < 0,
      kalanGun: fark, vade: `${d.vade}${a.saat ? ' ' + String(a.saat) : ''}`, baslik: String(a.baslik), tutar: 0,
      rozet: fark < 0 ? `${Math.abs(fark)} gün geçti` : fark === 0 ? `BUGÜN${a.saat ? ' ' + String(a.saat) : ''}` : `${fark} gün`,
      not: a.notlar ? String(a.notlar) : 'Ajanda kaydı', ikon: '⏰', sekme: 'a-ajanda', sekmeAd: 'Ajanda',
      eylem: { tur: 'ajanda', id: String(a.id) },
    });
  });

  /* Tarihli açık görevler: beş gün öncesinden başlar. */
  g.todolar.filter(t => !t.tamamlandi && t.tarih).forEach(t => {
    const fark = gunFarkiTarih(String(t.tarih), bugun);
    if (fark > 5) return;
    const acil = fark <= 1;
    ekle({
      id: `todo-${t.id}`, kategori: 'todo', etiket: 'Görev', seviye: fark < 0 || acil ? 'red' : 'gold', acil, kalanGun: fark, vade: kisaTarih(String(t.tarih)),
      baslik: String(t.baslik), tutar: 0, rozet: fark < 0 ? `${Math.abs(fark)} gün gecikti` : fark === 0 ? 'BUGÜN' : `${fark} GÜN KALDI`,
      not: 'Yapılacaklar listesinde bekliyor', ikon: '✓', sekme: 'n-todo', sekmeAd: 'Todo\'s', eylem: { tur: 'todo', id: String(t.id) },
    });
  });

  /* Vadesi yaklaşan mevduat ve birikimler: nakit girişi olduğundan sakin renkte. */
  g.varliklar.filter(v => v.vade_tarihi).forEach(v => {
    const fark = gunFarkiTarih(String(v.vade_tarihi), bugun);
    if (fark < -3 || fark > 14) return;
    ekle({
      id: `varlik-${v.id}`, kategori: 'borc', etiket: 'Mevduat / Nakit Dönüşü', seviye: fark <= 3 ? 'gold' : 'cyan', acil: false, kalanGun: fark,
      vade: fark <= 0 ? 'Vade doldu' : kisaTarih(String(v.vade_tarihi)), baslik: `Vade: ${String(v.ad)}`,
      tutar: sayi(v.guncel_deger) || sayi(v.anapara), rozet: fark <= 0 ? 'VADE DOLDU' : `${fark} GÜN KALDI`,
      not: 'Vadesi gelen birikim nakde döner; borç ödemeleri için kullanılabilir.', ikon: '⏳', sekme: 'v-mevduat', sekmeAd: 'Mevduat',
    });
  });

  /* Alınmaya karar verilenler. */
  g.alinacaklar.filter(a => a.durum === 'karar' && a.hedef_tarih).forEach(a => {
    const fark = gunFarkiTarih(String(a.hedef_tarih), bugun);
    if (fark < -3 || fark > 14) return;
    ekle({
      id: `alinacak-${a.id}`, kategori: 'gider', etiket: 'Alınacak', seviye: fark < 0 ? 'red' : fark <= 3 ? 'gold' : 'cyan', acil: fark < 0, kalanGun: fark,
      vade: kisaTarih(String(a.hedef_tarih)), baslik: String(a.ad), tutar: sayi(a.tahmini_tutar), rozet: fark < 0 ? `${Math.abs(fark)} gün geçti` : fark === 0 ? 'BUGÜN' : `${fark} GÜN KALDI`,
      not: 'Alınmaya karar verilen ürün', ikon: '🛒', sekme: 'h-alinacak', sekmeAd: 'Alınacaklar',
    });
  });

  /* Sabit tarihli yükümlülükler: bir hafta öncesinden başlar. */
  (g.sabitler ?? []).filter(y => y.aktif).forEach(y => {
    const { tarih, kalan } = siradakiYukumluluk(y, bugun);
    if (kalan > 7) return;
    const d = vadeDurumu(kalan, tarih, 'BUGÜN!');
    ekle({
      id: `sabit-${y.id}`, kategori: y.tur === 'durusma' ? 'hukuk' : y.tur === 'odeme' || y.tur === 'vergi' ? 'borc' : 'diger', etiket: 'Sabit tarih',
      seviye: y.onem === 'kritik' ? d.seviye : kalan <= 1 ? 'gold' : 'cyan', acil: y.onem === 'kritik' && d.acil, kalanGun: kalan, vade: d.vade,
      baslik: y.ad, tutar: 0, rozet: kalan === 0 ? 'BUGÜN' : `${kalan} GÜN KALDI`, not: `Her ayın ${y.gun}. günü · ${ONEM_ADI[y.onem]}`,
      ikon: '📌', sekme: 'k-sure', sekmeAd: 'Süreler ve İmza',
    });
  });
  (g.icraSureleri ?? []).filter(x => x.kalan >= 0 && x.kalan <= 3).forEach(x => ekle({
    id: `icra-sure-${x.id}-${x.sure}`, kategori: 'hukuk', etiket: 'İcra süresi', seviye: 'red', acil: true, kalanGun: x.kalan, vade: kisaTarih(x.son),
    baslik: `${x.ad} — ${x.sure}`, tutar: 0, rozet: x.kalan === 0 ? 'SON GÜN' : `${x.kalan} GÜN KALDI`,
    not: 'Süre kaçarsa itiraz/ödeme hakkı kaybedilebilir.', ikon: '⚖', sekme: 'k-sure', sekmeAd: 'Süreler ve İmza',
  }));
  (g.icraPlanlari ?? []).filter(x => x.gecikme > 0.5).forEach(x => ekle({
    id: `icra-plan-${x.id}`, kategori: 'borc', etiket: 'İcra taksiti', seviye: 'red', acil: true, kalanGun: -1, vade: 'Geride',
    baslik: `${x.ad} — taksit planında geride`, tutar: x.gecikme, rozet: 'TAKSİT GERİDE',
    not: `Plana göre ${tl(x.gecikme)} ödenmemiş görünüyor. Tek taksit kaçarsa plan bozulabilir.`, ikon: '▲', sekme: 'b-icra', sekmeAd: 'İcra Dosyaları',
  }));
  if (g.imza?.aktif) {
    const i = imzaDurumu(g.imza, bugun.slice(0, 7), bugun);
    if (i.durum === 'kacirildi' || i.durum === 'bugun' || i.durum === 'yaklasiyor') {
      ekle({
        id: 'karakol-imza', kategori: 'hukuk', etiket: 'Karakol imzası', seviye: i.durum === 'yaklasiyor' ? 'gold' : 'red', acil: i.durum !== 'yaklasiyor',
        kalanGun: i.kalan, vade: kisaTarih(i.tarih), baslik: 'Karakol imzası', tutar: 0,
        rozet: i.durum === 'kacirildi' ? `${Math.abs(i.kalan)} GÜN GEÇTİ` : i.durum === 'bugun' ? 'BUGÜN' : `${i.kalan} GÜN KALDI`,
        not: i.durum === 'kacirildi' ? 'Bu ayın imzası işaretlenmedi.' : 'İmzaladıktan sonra Süreler ve İmza sayfasında işaretle.',
        ikon: '✍️', sekme: 'k-sure', sekmeAd: 'Süreler ve İmza',
      });
    }
  }

  if (g.serbest < 0) {
    ekle({
      id: 'butce-acigi', kategori: 'gider', etiket: 'Bütçe Riski', seviye: 'red', acil: true, kalanGun: 0, vade: 'Bu ay',
      baslik: 'Bu ay giderler geliri aşıyor', tutar: Math.abs(g.serbest), rozet: 'BÜTÇE AÇIĞI',
      not: `Serbest nakit akışı ${tl(g.serbest)}. Harcama kesintisi ya da ek kaynak gerekir.`, ikon: '🔻', sekme: 'e-ozet', sekmeAd: 'Gider Özeti', tur: 'butce',
    });
  }

  const azStok = g.urunler.filter(u => u.asgari_stok !== null && u.asgari_stok !== undefined && sayi(u.stok_miktari) < sayi(u.asgari_stok));
  if (azStok.length) {
    ekle({
      id: 'stok-az', kategori: 'diger', etiket: 'Market Stok', seviye: 'cyan', acil: false, kalanGun: null, vade: 'Şimdi',
      baslik: `${azStok.length} ürünün stoğu azaldı`, tutar: 0, rozet: 'STOK AZ', not: azStok.slice(0, 4).map(u => String(u.ad)).join(', '),
      ikon: '📦', sekme: 'm-stok', sekmeAd: 'Market Stok',
    });
  }
  if (g.yedekGun === null || g.yedekGun > 30) {
    ekle({
      id: 'yedek-eski', kategori: 'diger', etiket: 'Yedek', seviye: 'cyan', acil: false, kalanGun: null, vade: 'Şimdi',
      baslik: g.yedekGun === null ? 'Henüz yedek alınmadı' : `Son yedek ${g.yedekGun} gün önce`, tutar: 0, rozet: 'YEDEK',
      not: 'Sistem Ayarları\'ndan yedeği indir.', ikon: '💾', sekme: 'sistem', sekmeAd: 'Sistem Ayarları',
    });
  }
  if (g.tahlilDisi?.adlar.length) {
    const n = g.tahlilDisi.adlar.length;
    ekle({
      id: 'tahlil-disi', kategori: 'diger', etiket: 'Sağlık', seviye: 'red', acil: false, kalanGun: null, vade: g.tahlilDisi.tarih,
      baslik: `${n} tahlil değeri referans dışı`, tutar: 0, rozet: 'TAHLİL', not: g.tahlilDisi.adlar.slice(0, 4).join(', ') + (n > 4 ? ` ve ${n - 4} değer daha` : '') + '. Doktorunla değerlendir.',
      ikon: '⚗', sekme: 's-tahlil', sekmeAd: 'Tahliller',
    });
  }
  g.sorunlar.forEach((s, i) => ekle({
    id: `veri-sorun-${i}-${s.slice(0, 24)}`, kategori: 'diger', etiket: 'Veri Sağlığı', seviye: 'red', acil: false, kalanGun: null, vade: 'Şimdi',
    baslik: s, tutar: 0, rozet: 'TUTARSIZLIK', not: 'Sistem Ayarları › Veri bütünlüğü bölümünde ayrıntı var.', ikon: '🧬', sekme: 'sistem', sekmeAd: 'Sistem Ayarları',
  }));

  return siralaBildirim(liste, 'vade');
}

export type Siralama = 'vade' | 'tutar' | 'ad';
export function siralaBildirim(l: Bildirim[], mod: Siralama): Bildirim[] {
  const k = [...l];
  if (mod === 'vade') k.sort((a, b) => a.skor - b.skor || b.tutar - a.tutar);
  else if (mod === 'tutar') k.sort((a, b) => b.tutar - a.tutar);
  else k.sort((a, b) => a.baslik.localeCompare(b.baslik, 'tr'));
  return k;
}
