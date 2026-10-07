import { gun, tl } from '../../ortak/bicim';
import { kurGetir } from '../genel/dis-veri';
import { kayitSayfasi, sayi, type Alan, type KayitAyari } from './kayit-sayfasi';
import type { Kayit } from '../../veri/kayit';

const ad = (k: Kayit) => String(k.ad ?? '—');
const topla = (l: Kayit[], f: string) => l.reduce((t, k) => t + sayi(k[f]), 0);

/* Altın cinsinin saf (24 ayar) gram karşılığı; çeyrek/yarım/tam 22 ayar gram esaslıdır. Değer tahminidir, işçilik içermez. */
export const ALTIN_BIRIM: [string, string, number][] = [
  ['gram24', 'Gram (24 ayar)', 1], ['ceyrek', 'Çeyrek', 1.6045], ['yarim', 'Yarım', 3.209], ['tam', 'Tam', 6.418],
  ['bilezik22', 'Bilezik (22 ayar, gram)', 0.916], ['gram14', '14 ayar (gram)', 0.585],
];
const katsayi = (b: unknown) => ALTIN_BIRIM.find(x => x[0] === b)?.[2] ?? 1;
const birimAdi = (b: unknown) => ALTIN_BIRIM.find(x => x[0] === b)?.[1] ?? '—';

/* Girilen güncel değer varsa o, yoksa güncel gram altın kuruyla tahmin. */
export function altinDegeri(k: Kayit, gramFiyat: number | null | undefined): number | null {
  if (k.guncel_deger !== null && k.guncel_deger !== undefined) return sayi(k.guncel_deger);
  return gramFiyat ? Math.round(sayi(k.miktar) * katsayi(k.birim) * gramFiyat * 100) / 100 : null;
}

const alanlar = (liste: Alan[]): Alan[] => liste;

const mevduat: KayitAyari = {
  tablo: 'varliklar', yeniDugme: '+ Yeni mevduat', yeniBaslik: 'Yeni mevduat', bos: 'Henüz mevduat yok.',
  alanlar: alanlar([
    { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true, ipucu: 'Örnek: Banka A 32 gün vadeli' },
    { ad: 'hesap_id', etiket: 'Banka hesabı', tur: 'hesap' },
    { ad: 'anapara', etiket: 'Anapara (TL)', tur: 'sayi', zorunlu: true },
    { ad: 'faiz_orani', etiket: 'Yıllık faiz (%)', tur: 'sayi' },
    { ad: 'vade_tarihi', etiket: 'Vade tarihi', tur: 'tarih' },
    { ad: 'guncel_deger', etiket: 'Güncel değer (TL)', tur: 'sayi', ipucu: 'Boş bırakırsan anapara sayılır' },
  ]),
  sutunlar: [
    { baslik: 'Ad', goster: k => ad(k) }, { baslik: 'Hesap', goster: (k, b) => b.hesaplar.get(String(k.hesap_id)) ?? '—' },
    { baslik: 'Anapara', sayi: true, goster: k => tl(sayi(k.anapara)) }, { baslik: 'Faiz', sayi: true, goster: k => (k.faiz_orani === null ? '—' : `%${sayi(k.faiz_orani)}`) },
    { baslik: 'Vade', goster: k => gun(k.vade_tarihi as string | null) },
    { baslik: 'Değer', sayi: true, goster: k => tl(k.guncel_deger === null ? sayi(k.anapara) : sayi(k.guncel_deger)) },
  ],
  filtre: { tur: 'mevduat' }, sabit: { tur: 'mevduat' }, sirala: 'ad', aramaAlanlari: ['ad'],
  hazirla: g => ({ ...g, guncel_deger: g.guncel_deger ?? g.anapara }),
  ozet: l => {
    const yillik = l.reduce((t, k) => t + (sayi(k.anapara) * sayi(k.faiz_orani)) / 100, 0);
    const otuz = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const yaklasan = l.filter(k => k.vade_tarihi && String(k.vade_tarihi) <= otuz).length;
    return [['Toplam mevduat', tl(topla(l, 'guncel_deger') || topla(l, 'anapara')), `${l.length} kayıt`, 'vurgu'],
      ['Yıllık faiz tahmini', tl(yillik), 'anapara × oran, vergi düşülmeden'], ['30 gün içinde vadesi gelen', String(yaklasan)]];
  },
};

const bes: KayitAyari = {
  tablo: 'varliklar', yeniDugme: '+ Yeni BES', yeniBaslik: 'Yeni BES sözleşmesi', bos: 'Henüz BES kaydı yok.',
  alanlar: alanlar([
    { ad: 'ad', etiket: 'Şirket ya da sözleşme', tur: 'metin', zorunlu: true },
    { ad: 'anapara', etiket: 'Yatırılan toplam (TL)', tur: 'sayi', ipucu: 'Katkı payı toplamı' },
    { ad: 'guncel_deger', etiket: 'Güncel birikim (TL)', tur: 'sayi', zorunlu: true },
    { ad: 'hesap_id', etiket: 'Katkının çıktığı hesap', tur: 'hesap' },
  ]),
  sutunlar: [
    { baslik: 'Sözleşme', goster: k => ad(k) }, { baslik: 'Yatırılan', sayi: true, goster: k => tl(sayi(k.anapara)) },
    { baslik: 'Güncel birikim', sayi: true, goster: k => tl(sayi(k.guncel_deger)) },
    { baslik: 'Getiri', sayi: true, goster: k => tl(sayi(k.guncel_deger) - sayi(k.anapara)) },
  ],
  filtre: { tur: 'bes' }, sabit: { tur: 'bes' }, sirala: 'ad', aramaAlanlari: ['ad'],
  ozet: l => [['BES birikimi', tl(topla(l, 'guncel_deger')), `${l.length} sözleşme`, 'vurgu'], ['Getiri', tl(topla(l, 'guncel_deger') - topla(l, 'anapara')), 'güncel birikim eksi yatırılan']],
};

const altin: KayitAyari = {
  tablo: 'varliklar', yeniDugme: '+ Yeni altın', yeniBaslik: 'Yeni altın kaydı', bos: 'Henüz altın kaydı yok.',
  alanlar: alanlar([
    { ad: 'ad', etiket: 'Ad', tur: 'metin', zorunlu: true, ipucu: 'Örnek: Çeyrek altın' },
    { ad: 'birim', etiket: 'Cins', tur: 'secim', secenekler: ALTIN_BIRIM.map(x => [x[0], x[1]] as [string, string]), zorunlu: true, varsayilan: 'gram24' },
    { ad: 'miktar', etiket: 'Miktar (gram ya da adet)', tur: 'sayi', zorunlu: true, ipucu: 'Çeyrek, yarım ve tam için adet; diğerleri için gram' },
    { ad: 'anapara', etiket: 'Alış maliyeti (TL)', tur: 'sayi' },
    { ad: 'guncel_deger', etiket: 'Güncel değer (TL)', tur: 'sayi', ipucu: 'Boş bırakırsan güncel gram altın kuruyla tahmin edilir' },
  ]),
  sutunlar: [
    { baslik: 'Ad', goster: k => ad(k) }, { baslik: 'Cins', goster: k => birimAdi(k.birim) }, { baslik: 'Miktar', sayi: true, goster: k => String(sayi(k.miktar)) },
    { baslik: 'Maliyet', sayi: true, goster: k => tl(sayi(k.anapara)) },
    { baslik: 'Değer', sayi: true, goster: (k, b) => tl(altinDegeri(k, b.dis?.gramAltin)) },
  ],
  filtre: { tur: 'altin' }, sabit: { tur: 'altin' }, sirala: 'ad', aramaAlanlari: ['ad'],
  dis: async () => ({ gramAltin: (await kurGetir()).gramAltin }),
  ozet: (l, b) => {
    const gram = b.dis?.gramAltin as number | null | undefined;
    const deger = l.reduce((t, k) => t + (altinDegeri(k, gram) ?? 0), 0);
    const saf = l.reduce((t, k) => t + sayi(k.miktar) * katsayi(k.birim), 0);
    return [['Altın değeri', tl(deger), gram ? `gram altın ${tl(gram)} (tahmin)` : 'güncel kur alınamadı, girilen değerler toplandı', 'vurgu'],
      ['Saf karşılığı', `${saf.toFixed(2)} gr`, '24 ayar gram'], ['Kâr', tl(deger - topla(l, 'anapara')), 'değer eksi alış maliyeti']];
  },
};

export const BIRIKIM_SAYFALARI: Record<string, (kok: HTMLElement) => void> = {
  'v-mevduat': kayitSayfasi(mevduat), 'v-bes': kayitSayfasi(bes), 'v-altin': kayitSayfasi(altin),
};
