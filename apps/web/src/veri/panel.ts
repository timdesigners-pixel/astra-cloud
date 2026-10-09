import { kayitlariGetir, type Kayit } from './kayit';
import { ayarOku } from './karsilama';
import { gelirAyi, giderAyi } from '../ozellikler/kayit/ozet-hesap';
import { bugunAnahtari } from '../ortak/zaman';
import { bildirimUret, type Bildirim } from './bildirim';
import { durumHesapla } from './tahlil-katalog';
import { sabitleriGetir, imzaGetir } from './sabitler';
import { sureler, type Imza, type Yukumluluk } from './sureler';
import { icraDosyalariniGetir } from './icra';
import { planDurumu, planlariGetir } from './icra-ek';

const sayi = (v: unknown) => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? 0 : Number(v));
const gunFarki = (t: string, bugun: string) => Math.round((Date.parse(t.slice(0, 10)) - Date.parse(bugun)) / 86400000);

export type Uyari = { onem: 'kritik' | 'uyari' | 'bilgi'; baslik: string; not: string; sekme: string };
export type Kontrol = { ad: string; tamam: boolean; not: string };
export type Girdi = {
  borclar: Kayit[]; odemeler: Kayit[]; gelirler: Kayit[]; giderler: Kayit[]; fisler: Kayit[]; hareketler: Kayit[];
  varliklar: Kayit[]; todolar: Kayit[]; davalar: Kayit[]; urunler: Kayit[]; sonYedek: string | null;
  ajanda?: Kayit[]; alinacaklar?: Kayit[]; tahliller?: Kayit[]; sabitler?: Yukumluluk[]; imza?: Imza;
  icraSureleri?: NonNullable<Parameters<typeof bildirimUret>[0]['icraSureleri']>; icraPlanlari?: NonNullable<Parameters<typeof bildirimUret>[0]['icraPlanlari']>;
};
export type Panel = {
  gelir: number; gider: number; serbest: number; borc: number; anapara: number; borcBitis: string | null;
  saglik: number; saglikEtiket: string; uyarilar: Uyari[]; kontroller: Kontrol[]; yedek: string | null;
  todoAcik: number; todoBugun: number; todoGecikmis: number; bildirimler: Bildirim[];
};

export function saglikEtiketi(p: number) { return p >= 80 ? 'İyi' : p >= 60 ? 'Orta' : 'Zayıf'; }

/* Saf hesap: ağ erişimi yok, bugünün tarihi dışarıdan verilir. */
export function panelHesapla(g: Girdi, ay: string, bugun: string): Panel {
  const gel = gelirAyi(g.gelirler, ay), gid = giderAyi(g.giderler, g.fisler, g.hareketler, ay);
  const serbest = gel.toplam - gid.toplam;
  const borc = g.borclar.filter(b => b.durum !== 'kapandi' && b.yon !== 'alacakli').reduce((t, b) => t + sayi(b.guncel_borc), 0);
  const anapara = g.varliklar.filter(v => v.tur === 'mevduat').reduce((t, v) => t + sayi(v.anapara), 0);

  const bekleyen = g.odemeler.filter(o => o.durum === 'bekliyor');
  const geciken = bekleyen.filter(o => String(o.vade_tarihi) < bugun);
  const yedigun = bekleyen.filter(o => String(o.vade_tarihi) >= bugun && gunFarki(String(o.vade_tarihi), bugun) <= 7);
  const acikBorclar = new Set(g.borclar.filter(b => b.durum !== 'kapandi' && b.yon !== 'alacakli' && sayi(b.guncel_borc) > 0).map(b => String(b.id)));
  const sonBorcVadesi = bekleyen.filter(o => o.borc_id && acikBorclar.has(String(o.borc_id)) && String(o.vade_tarihi) >= bugun).map(o => String(o.vade_tarihi)).sort().pop() ?? null;
  const borcBitis = sonBorcVadesi
    ? new Date(sonBorcVadesi.slice(0, 7) + '-01').toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' }) : null;

  const acikTodo = g.todolar.filter(t => !t.tamamlandi);
  const todoBugun = acikTodo.filter(t => t.tarih && String(t.tarih) === bugun).length;
  const todoGecikmis = acikTodo.filter(t => t.tarih && String(t.tarih) < bugun).length;
  const durusma = g.davalar.filter(d => d.durum !== 'kapandi' && d.sonraki_durusma && gunFarki(String(d.sonraki_durusma), bugun) >= 0 && gunFarki(String(d.sonraki_durusma), bugun) <= 14);
  const azStok = g.urunler.filter(u => u.asgari_stok !== null && u.asgari_stok !== undefined && sayi(u.stok_miktari) < sayi(u.asgari_stok));
  const yedekGun = g.sonYedek ? -gunFarki(g.sonYedek, bugun) : null;

  const tl = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
  const uyarilar: Uyari[] = [];
  if (geciken.length) uyarilar.push({ onem: 'kritik', baslik: `${geciken.length} geciken ödeme`, not: `Toplam ${tl(geciken.reduce((t, o) => t + sayi(o.tutar), 0))}`, sekme: 'o-takvim' });
  if (yedigun.length) uyarilar.push({ onem: 'uyari', baslik: `${yedigun.length} ödeme 7 gün içinde`, not: `Toplam ${tl(yedigun.reduce((t, o) => t + sayi(o.tutar), 0))}`, sekme: 'o-takvim' });
  if (serbest < 0) uyarilar.push({ onem: 'uyari', baslik: 'Bu ay giderler geliri aşıyor', not: `Fark ${tl(serbest)}`, sekme: 'e-ozet' });
  if (durusma.length) uyarilar.push({ onem: 'uyari', baslik: `${durusma.length} duruşma 14 gün içinde`, not: 'Hukuk sayfasında tarihleri gör', sekme: 'k-hukuk' });
  if (todoGecikmis) uyarilar.push({ onem: 'uyari', baslik: `${todoGecikmis} gecikmiş görev`, not: 'Yapılacaklar listesinde bekliyor', sekme: 'n-todo' });
  if (azStok.length) uyarilar.push({ onem: 'bilgi', baslik: `${azStok.length} ürünün stoğu azaldı`, not: azStok.slice(0, 3).map(u => String(u.ad)).join(', '), sekme: 'm-stok' });
  if (yedekGun === null || yedekGun > 30) uyarilar.push({ onem: 'bilgi', baslik: yedekGun === null ? 'Henüz yedek alınmadı' : `Son yedek ${yedekGun} gün önce`, not: 'Sistem Ayarları\'ndan yedek indir', sekme: 'sistem' });

  const sabitGelir = g.gelirler.filter(k => k.sabit === true && k.aktif !== false).reduce((t, k) => t + sayi(k.tutar) / (k.periyot === 'yillik' ? 12 : k.periyot === 'uc_aylik' ? 3 : 1), 0);
  const oran = sabitGelir > 0 ? borc / sabitGelir : 0;
  const saglik = Math.max(0, 100 - Math.min(45, 15 * geciken.length) - (serbest < 0 ? 25 : 0) - (oran > 24 ? 25 : oran > 12 ? 15 : oran > 6 ? 5 : 0));

  const borcDurum = new Map(g.borclar.map(b => [b.id, b.durum]));
  const kontroller: Kontrol[] = [
    { ad: 'Ödenmiş her ödemenin hesap hareketi var', ...say(g.odemeler.filter(o => o.durum === 'odendi' && !o.hareket_id).length) },
    { ad: 'Kapalı borçlarda bekleyen ödeme yok', ...say(bekleyen.filter(o => o.borc_id && borcDurum.get(String(o.borc_id)) === 'kapandi').length) },
    { ad: 'Stok miktarı eksiye düşmemiş', ...say(g.urunler.filter(u => sayi(u.stok_miktari) < 0).length) },
    { ad: 'Aktif gelir ve giderlerde tutar sıfır değil', ...say([...g.gelirler, ...g.giderler].filter(k => k.aktif !== false && sayi(k.tutar) === 0).length) },
  ];
  const tahlilDisi = tahlilDisiBul(g.tahliller ?? [], bugun);
  const bildirimler = bildirimUret({
    odemeler: g.odemeler, borclar: g.borclar, todolar: g.todolar, davalar: g.davalar, ajanda: g.ajanda ?? [], varliklar: g.varliklar,
    alinacaklar: g.alinacaklar ?? [], urunler: g.urunler, serbest, yedekGun, sorunlar: kontroller.filter(k => !k.tamam).map(k => k.ad), tahlilDisi, sabitler: g.sabitler, imza: g.imza, icraSureleri: g.icraSureleri, icraPlanlari: g.icraPlanlari,
  }, bugun);
  return {
    gelir: gel.toplam, gider: gid.toplam, serbest, borc, anapara, borcBitis, saglik, saglikEtiket: saglikEtiketi(saglik), uyarilar, kontroller,
    yedek: yedekGun === null ? null : yedekGun === 0 ? 'bugün' : `${yedekGun} gün önce`,
    todoAcik: acikTodo.length, todoBugun, todoGecikmis, bildirimler,
  };
}
/* Her testin en son değerine bakar; son 90 günde yapılmış tahlillerde referans dışı kalanları döndürür. */
function tahlilDisiBul(satirlar: Kayit[], bugun: string): { adlar: string[]; tarih: string } | undefined {
  const son = new Map<string, Kayit>();
  for (const d of satirlar) {
    const o = son.get(String(d.test));
    if (!o || String(d.tarih) >= String(o.tarih)) son.set(String(d.test), d);
  }
  const disi = [...son.values()].filter(d => gunFarki(String(d.tarih), bugun) >= -90 && ['dusuk', 'yuksek'].includes(durumHesapla(d.deger === null ? null : sayi(d.deger), d.ref_alt === null ? null : sayi(d.ref_alt), d.ref_ust === null ? null : sayi(d.ref_ust))));
  if (!disi.length) return undefined;
  return { adlar: disi.map(d => String(d.ad)), tarih: disi.map(d => String(d.tarih)).sort().pop()! };
}
const say = (n: number) => ({ tamam: n === 0, not: n === 0 ? 'sorun yok' : `${n} kayıtta sorun var` });

let onbellek: { ay: string; zaman: number; veri: Promise<Panel> } | null = null;
async function icraSureleriniBul(bugun: string) {
  try {
    const l = await icraDosyalariniGetir();
    return l.filter(d => d.durum === 'acik' && d.tebligat_tarihi).flatMap(d => sureler(d.takip_turu, d.tebligat_tarihi, bugun)
      .map(x => ({ id: d.id, ad: `${d.karsi_taraf ?? 'İcra'} · ${d.dosya_no ?? ''}`.trim(), sure: x.ad, kalan: x.kalan, son: x.son })));
  } catch { return []; }
}
async function icraPlanlariniBul(bugun: string) {
  try {
    const [planlar, dosyalar] = await Promise.all([planlariGetir(), icraDosyalariniGetir()]);
    return planlar.map(p => {
      const d = dosyalar.find(x => x.id === p.icra_id), st = planDurumu(p, bugun);
      return { id: p.id, ad: `${d?.karsi_taraf ?? 'İcra'} · ${d?.dosya_no ?? ''}`.trim(), gecikme: st.gecikme, geride: st.durum === 'geride' ? 1 : 0 };
    });
  } catch { return []; }
}
export function panelSifirla() { onbellek = null; }

export function panelGetir(ay: string): Promise<Panel> {
  if (onbellek && onbellek.ay === ay && Date.now() - onbellek.zaman < 10000) return onbellek.veri;
  const veri = (async () => {
    const [borclar, odemeler, gelirler, giderler, fisler, hareketler, varliklar, todolar, davalar, urunler, yedek, ajanda, alinacaklar, tahliller, sabitler, imza, icraSureleri, icraPlanlari] = await Promise.all([
      kayitlariGetir('borclar', ['ad', 'yon', 'durum', 'guncel_borc'], {}, 'ad'),
      kayitlariGetir('odemeler', ['borc_id', 'hesap_id', 'vade_tarihi', 'tutar', 'durum', 'hareket_id', 'notlar'], {}, 'vade_tarihi'),
      kayitlariGetir('gelirler', ['tur', 'sabit', 'periyot', 'tutar', 'baslangic', 'bitis', 'aktif'], {}, 'ad'),
      kayitlariGetir('giderler', ['tur', 'periyot', 'tutar', 'para_birimi', 'baslangic', 'bitis', 'aktif'], {}, 'ad'),
      kayitlariGetir('fisler', ['tarih', 'toplam'], {}, 'tarih'),
      kayitlariGetir('hareketler', ['yon', 'tur', 'tutar', 'tarih'], {}, 'tarih'),
      kayitlariGetir('varliklar', ['tur', 'ad', 'anapara', 'guncel_deger', 'vade_tarihi'], {}, 'ad'),
      kayitlariGetir('todolar', ['baslik', 'tarih', 'tamamlandi'], {}, 'olusturma'),
      kayitlariGetir('davalar', ['tur', 'konu', 'mahkeme', 'durum', 'sonraki_durusma'], {}, 'olusturma'),
      kayitlariGetir('urunler', ['ad', 'stok_miktari', 'asgari_stok'], {}, 'ad'),
      ayarOku<{ tarih?: string }>('son_yedek').catch(() => null),
      kayitlariGetir('ajanda_olaylari', ['baslik', 'tarih', 'saat', 'notlar', 'tamamlandi'], {}, 'tarih'),
      kayitlariGetir('alinacaklar', ['ad', 'tahmini_tutar', 'hedef_tarih', 'durum'], {}, 'olusturma'),
      kayitlariGetir('tahlil_degerleri', ['tarih', 'test', 'ad', 'deger', 'ref_alt', 'ref_ust'], {}, 'tarih').catch(() => [] as Kayit[]),
      sabitleriGetir().catch(() => [] as Yukumluluk[]),
      imzaGetir().catch(() => undefined),
      icraSureleriniBul(bugunAnahtari()),
      icraPlanlariniBul(bugunAnahtari()),
    ]);
    return panelHesapla({ borclar, odemeler, gelirler, giderler, fisler, hareketler, varliklar, todolar, davalar, urunler, ajanda, alinacaklar, tahliller, sabitler, imza, icraSureleri, icraPlanlari, sonYedek: yedek?.deger?.tarih ?? null }, ay, bugunAnahtari());
  })();
  onbellek = { ay, zaman: Date.now(), veri };
  veri.catch(() => { if (onbellek?.veri === veri) onbellek = null; });
  return veri;
}
