import { ayaDenk } from '../ozellikler/kayit/tekrar';
import { simule, type SimBorc } from '../ozellikler/modul/hesap';
import type { IcraDosyasi } from './icra';
import { gunFarki, imzaDurumu, sureler, type Imza } from './sureler';

/* Proaktif danışman: durumu tarar ve ne yapılacağını söyleyen kural motoru. Aynı durum her zaman aynı bulguyu verir;
   her kural kendi eşiğini taşır ve tek kuralın hatası diğerlerini susturmaz. */
export type Satir = Record<string, unknown>;
export type Bulgu = { id: string; seviye: 'kritik' | 'uyari' | 'firsat' | 'bilgi'; baslik: string; aciklama: string; tasarruf: number; git: string; etiket: string };
export type DanismanGirdi = {
  bugun: string; nakit: number; borclar: Satir[]; odemeler: Satir[]; gelirler: Satir[]; giderler: Satir[]; varliklar: Satir[]; serbest: number;
  icra: IcraDosyasi[]; imza: Imza; gelir: number; gider: number;
};
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const TL = (v: number) => Math.round(v).toLocaleString('tr-TR');
const SIRA = { kritik: 0, uyari: 1, firsat: 2, bilgi: 3 } as const;

/* Aylık eşdeğer: 3 aylık ve yıllık kalemler aya bölünür; tek seferlikler sayılmaz. */
export const aylikEsdeger = (k: Satir) => (k.periyot === 'aylik' ? n(k.tutar) : k.periyot === 'uc_aylik' ? n(k.tutar) / 3 : k.periyot === 'yillik' ? n(k.tutar) / 12 : 0);

export function bulgular(g: DanismanGirdi): Bulgu[] {
  const kurallar: (() => Bulgu | Bulgu[] | null)[] = [
    () => (g.serbest < 0 ? { id: 'butce:negatif', seviye: 'kritik', baslik: `Bu ay serbest bütçe −${TL(Math.abs(g.serbest))} ₺`,
      aciklama: `Gelir ${TL(g.gelir)} ₺, çıkış ${TL(g.gider)} ₺. Sabit giderler ve borç ödemeleri gelirin üstünde; kısılacak ilk yer giderler.`, tasarruf: 0, git: 'e-ozet', etiket: 'Giderleri aç' } : null),
    () => {
      const geciken = g.odemeler.filter(o => o.durum === 'bekliyor' && String(o.vade_tarihi) < g.bugun);
      if (!geciken.length) return null;
      const top = geciken.reduce((t, o) => t + n(o.tutar), 0);
      return { id: 'odeme:geciken', seviye: 'kritik', baslik: `${geciken.length} ödeme gecikmiş (${TL(top)} ₺)`, aciklama: 'Vadesi geçen ödemeler faiz ve gecikme cezası doğurur; tecil planındaysa plan bozulabilir.', tasarruf: 0, git: 'o-takvim', etiket: 'Ödeme takvimi' };
    },
    () => {
      const hafta = g.odemeler.filter(o => o.durum === 'bekliyor' && String(o.vade_tarihi) >= g.bugun && gunFarki(String(o.vade_tarihi), g.bugun) <= 7);
      const yuk = hafta.reduce((t, o) => t + n(o.tutar), 0);
      if (yuk <= 0 || g.nakit >= yuk) return null;
      return { id: 'nakit:7gun', seviye: 'kritik', baslik: `7 gün içinde ${TL(yuk)} ₺ ödeme var, vadesiz hesaplarda ${TL(g.nakit)} ₺`,
        aciklama: `${hafta.length} ödeme bu haftaya yığılmış; ${TL(yuk - g.nakit)} ₺ açık görünüyor. Ödeme günlerini aya yaymak ya da vadesi geleni öne almak gerekebilir.`, tasarruf: 0, git: 'o-takvim', etiket: 'Ödeme takvimi' };
    },
    () => g.icra.filter(d => d.durum === 'acik' && d.tebligat_tarihi).flatMap(d => sureler(d.takip_turu, d.tebligat_tarihi, g.bugun)
      .filter(s => s.kalan >= 0 && s.kalan <= 7).map(s => ({ id: `sure:${d.id}:${s.ad}`, seviye: 'kritik' as const, baslik: `${d.dosya_no ?? 'İcra'} — ${s.ad} ${s.kalan === 0 ? 'bugün bitiyor' : `${s.kalan} gün içinde bitiyor`}`,
        aciklama: `${s.gun} günlük süre ${s.son} tarihinde dolar. Süre kaçarsa itiraz/ödeme hakkı kaybedilebilir.`, tasarruf: 0, git: 'k-sure', etiket: 'Süreler' }))),
    () => {
      if (!g.imza.aktif) return null;
      const i = imzaDurumu(g.imza, g.bugun.slice(0, 7), g.bugun);
      if (i.durum === 'kacirildi') return { id: 'imza:kacirildi', seviye: 'kritik', baslik: 'Bu ayın karakol imzası işaretlenmemiş', aciklama: `İmza günü ${i.tarih} idi. İmzalandıysa işaretle; atılmadıysa hemen at.`, tasarruf: 0, git: 'k-sure', etiket: 'İmza takvimi' };
      if (i.durum === 'bugun' || i.durum === 'yaklasiyor') return { id: 'imza:yakin', seviye: 'uyari', baslik: i.durum === 'bugun' ? 'Bugün karakol imza günü' : `Karakol imzasına ${i.kalan} gün var`, aciklama: 'İmzayı attıktan sonra Süreler ve İmza sayfasında işaretle.', tasarruf: 0, git: 'k-sure', etiket: 'İmza takvimi' };
      return null;
    },
    () => {
      const bayat = g.icra.filter(d => d.durum === 'acik' && d.taraf_rolu !== 'Alacaklı' && (!d.dogrulama_tarihi || gunFarki(g.bugun, d.dogrulama_tarihi) > 30));
      if (!bayat.length) return null;
      return { id: 'icra:bayat', seviye: 'uyari', baslik: `${bayat.length} icra dosyasının bakiyesi 30 günden eski`, aciklama: 'Faizli dosyalarda eski bakiye yanlış karar demektir. UYAP\'tan doğrula ya da içe aktar.', tasarruf: 0, git: 'b-icra', etiket: 'İcra dosyaları' };
    },
    () => {
      const faizli = g.borclar.filter(b => b.yon !== 'alacakli' && b.durum !== 'kapandi' && n(b.faiz_orani) > 0 && n(b.guncel_borc) > 0).sort((a, b) => n(b.faiz_orani) - n(a.faiz_orani));
      if (faizli.length < 2) return null;
      const ust = faizli[0]!, alt = faizli[faizli.length - 1]!;
      if (n(ust.faiz_orani) - n(alt.faiz_orani) < 5) return null;
      return { id: 'borc:cig', seviye: 'firsat', baslik: `Önce "${String(ust.ad)}" kapatılmalı — %${n(ust.faiz_orani)} faiz`,
        aciklama: `En düşük faizli borcun %${n(alt.faiz_orani)} ("${String(alt.ad)}"). Fazla ödemeyi yüksek faizliye yönlendirmek aynı parayla daha çok anapara eritir.`,
        tasarruf: Math.round(n(ust.guncel_borc) * (n(ust.faiz_orani) - n(alt.faiz_orani)) / 100), git: 'm-sim', etiket: 'Kapatma simülasyonu' };
    },
    () => {
      const tampon = (g.gider + g.odemeler.filter(o => o.durum === 'bekliyor' && String(o.vade_tarihi).slice(0, 7) === g.bugun.slice(0, 7)).reduce((t, o) => t + n(o.tutar), 0)) * 3;
      const fazla = g.nakit - tampon;
      const mevduat = g.varliklar.filter(v => v.tur === 'mevduat').reduce((t, v) => t + n(v.guncel_deger ?? v.anapara), 0);
      if (fazla <= 0 || mevduat > fazla) return null;
      return { id: 'nakit:atil', seviye: 'firsat', baslik: `${TL(fazla)} ₺ atıl nakit duruyor`, aciklama: `3 aylık çıkışın (${TL(tampon)} ₺) üstünde kalan kısım. Vadeli/fon tarafına alınırsa yılda kabaca ${TL(fazla * 0.3)} ₺ getiri üretir.`, tasarruf: Math.round(fazla * 0.3), git: 'v-mevduat', etiket: 'Mevduat' };
    },
    () => {
      const ay = g.bugun.slice(0, 7);
      const yuk = g.giderler.filter(k => k.aktif !== false && (k.tur === 'abonelik' || k.tur === 'sabit') && (k.para_birimi ?? 'TRY') === 'TRY' && ayaDenk(k, ay)).reduce((t, k) => t + aylikEsdeger(k), 0);
      const gelir = g.gelirler.filter(k => k.aktif !== false && k.sabit).reduce((t, k) => t + aylikEsdeger(k), 0);
      if (gelir <= 0 || yuk / gelir < 0.05) return null;
      return { id: 'abonelik:pay', seviye: 'bilgi', baslik: `Sabit gider ve abonelik yükü gelirin %${(yuk / gelir * 100).toFixed(1)}'i`, aciklama: `Aylık ${TL(yuk)} ₺, yılda ${TL(yuk * 12)} ₺. Yıllık rakam aylık ödemelerin tek başına göstermediği büyüklüktür.`, tasarruf: 0, git: 'e-sabit', etiket: 'Sabit giderler' };
    },
  ];
  const cikti: Bulgu[] = [];
  kurallar.forEach(k => { try { const r = k(); (Array.isArray(r) ? r : r ? [r] : []).forEach(x => cikti.push(x)); } catch { /* tek kural düşer */ } });
  return cikti.sort((a, b) => SIRA[a.seviye] - SIRA[b.seviye] || b.tasarruf - a.tasarruf);
}

/* Sırada ne var: önümüzdeki 30–60 günün eylem listesi. */
export type Sirada = {
  buTur: { ad: string; ay: number }[]; sonraki: { ad: string; ay: number }[]; taksitler: { ad: string; tutar: number; vade: string; kalan: number }[];
  alimlar: { ad: string; tutar: number; tarih: string }[]; tarihli: { ad: string; tarih: string; kalan: number }[]; butce: number;
};
export function siradaHesapla(g: DanismanGirdi, davalar: Satir[], alinacaklar: Satir[], ek = 0): Sirada {
  const bekleyen = g.odemeler.filter(o => o.durum === 'bekliyor');
  const sim: SimBorc[] = g.borclar.filter(b => b.yon !== 'alacakli' && b.durum !== 'kapandi' && n(b.guncel_borc) > 0).map(b => {
    const o = bekleyen.filter(x => x.borc_id === b.id);
    return { id: String(b.id), ad: String(b.ad), bakiye: n(b.guncel_borc), faizYillik: n(b.faiz_orani), min: o.length ? o.reduce((t, x) => t + n(x.tutar), 0) / o.length : 0 };
  });
  const r = simule(sim, ek, 'cig');
  const ad = new Map(sim.map(s => [s.id, s.ad]));
  const kapanis = [...r.kapanis.entries()].sort((a, b) => a[1] - b[1]).map(([id, ay]) => ({ ad: ad.get(id) ?? '', ay }));
  return {
    buTur: kapanis.filter(x => x.ay <= 2), sonraki: kapanis.filter(x => x.ay > 2 && x.ay <= 6).slice(0, 6),
    taksitler: bekleyen.filter(o => gunFarki(String(o.vade_tarihi), g.bugun) <= 31).map(o => ({ ad: String(g.borclar.find(b => b.id === o.borc_id)?.ad ?? 'Ödeme'), tutar: n(o.tutar), vade: String(o.vade_tarihi), kalan: gunFarki(String(o.vade_tarihi), g.bugun) })).sort((a, b) => a.kalan - b.kalan),
    alimlar: alinacaklar.filter(x => x.durum === 'karar' && x.hedef_tarih && gunFarki(String(x.hedef_tarih), g.bugun) <= 90).map(x => ({ ad: String(x.ad), tutar: n(x.tahmini_tutar), tarih: String(x.hedef_tarih) })),
    tarihli: [
      ...davalar.filter(d => d.durum !== 'kapandi' && d.sonraki_durusma && gunFarki(String(d.sonraki_durusma), g.bugun) >= -1 && gunFarki(String(d.sonraki_durusma), g.bugun) <= 30)
        .map(d => ({ ad: `Duruşma: ${String(d.konu ?? d.mahkeme ?? 'Dava')}`, tarih: String(d.sonraki_durusma), kalan: gunFarki(String(d.sonraki_durusma), g.bugun) })),
      ...g.varliklar.filter(v => v.vade_tarihi && gunFarki(String(v.vade_tarihi), g.bugun) >= -5 && gunFarki(String(v.vade_tarihi), g.bugun) <= 14)
        .map(v => ({ ad: `Mevduat vadesi: ${String(v.ad)}`, tarih: String(v.vade_tarihi), kalan: gunFarki(String(v.vade_tarihi), g.bugun) })),
    ].sort((a, b) => a.kalan - b.kalan),
    butce: sim.reduce((t, s) => t + s.min, 0) + ek,
  };
}
