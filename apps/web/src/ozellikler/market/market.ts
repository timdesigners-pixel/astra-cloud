import { bildir } from '../../ortak/bildirim';
import { gun } from '../../ortak/bicim';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from '../../veri/kayit';
import { kayitSayfasi, sayi, type KayitAyari } from '../kayit/kayit-sayfasi';

const ad = (k: Kayit) => String(k.ad ?? '—');
const miktar = (v: unknown) => String(Math.round(sayi(v) * 1000) / 1000);
const azaldi = (k: Kayit) => sayi(k.asgari_stok) > 0 && sayi(k.stok_miktari) <= sayi(k.asgari_stok);
const bitti = (k: Kayit) => sayi(k.stok_miktari) <= 0;
const sktYakin = (k: Kayit) => !!k.son_kullanma && String(k.son_kullanma) <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

const stok: KayitAyari = {
  tablo: 'urunler', yeniDugme: '+ Yeni ürün', yeniBaslik: 'Yeni ürün', bos: 'Henüz ürün yok. Market fişi girdikçe ürünler ve stoklar kendiliğinden oluşur.',
  alanlar: [
    { ad: 'ad', etiket: 'Ürün', tur: 'metin', zorunlu: true },
    { ad: 'birim', etiket: 'Birim', tur: 'metin', zorunlu: true, varsayilan: 'adet', ipucu: 'adet, kg, lt, paket…' },
    { ad: 'kategori', etiket: 'Kategori', tur: 'metin' },
    { ad: 'stok_miktari', etiket: 'Evdeki miktar', tur: 'sayi', zorunlu: true, varsayilan: 0 },
    { ad: 'asgari_stok', etiket: 'Asgari miktar', tur: 'sayi', ipucu: 'Bunun altına inince "azaldı" uyarısı çıkar' },
    { ad: 'son_kullanma', etiket: 'Son kullanma tarihi', tur: 'tarih' },
  ],
  sutunlar: [
    { baslik: 'Ürün', goster: k => ad(k) }, { baslik: 'Kategori', goster: k => String(k.kategori ?? '—') },
    { baslik: 'Stok', sayi: true, goster: k => `${miktar(k.stok_miktari)} ${k.birim ?? ''}` }, { baslik: 'Asgari', sayi: true, goster: k => miktar(k.asgari_stok) },
    { baslik: 'Son kullanma', goster: k => gun(k.son_kullanma as string | null) },
    { baslik: 'Durum', goster: k => (bitti(k) ? 'Bitti' : azaldi(k) ? 'Azaldı' : sktYakin(k) ? 'SKT yakın' : 'Tamam') },
  ],
  filtre: {}, sirala: 'ad', aramaAlanlari: ['ad', 'kategori'],
  hazirla: g => ({ ...g, birim: g.birim ?? 'adet', stok_miktari: g.stok_miktari ?? 0, asgari_stok: g.asgari_stok ?? 0 }),
  ozet: l => [['Ürün', String(l.length), '', 'vurgu'], ['Azalan', String(l.filter(k => !bitti(k) && azaldi(k)).length), 'asgari miktarın altında'],
    ['Biten', String(l.filter(bitti).length), 'stokta yok', l.some(bitti) ? 'uyari' : ''], ['SKT yaklaşan', String(l.filter(sktYakin).length), '7 gün içinde']],
  islemler: [{
    etiket: 'Listeye ekle', gorunur: k => bitti(k) || azaldi(k),
    calistir: async k => {
      const var_ = await kayitlariGetir('alisveris_ogeleri', ['urun_id', 'alindi'], { urun_id: k.id, alindi: false }, 'ad');
      if (var_.length) { bildir('Bu ürün zaten alışveriş listesinde'); return; }
      const eksik = Math.max(1, sayi(k.asgari_stok) - sayi(k.stok_miktari));
      await kayitEkle('alisveris_ogeleri', ['ad'], { ad: k.ad, miktar: eksik, birim: k.birim ?? null, urun_id: k.id });
      bildir('Alışveriş listesine eklendi');
    },
  }],
};

const liste: KayitAyari = {
  tablo: 'alisveris_ogeleri', yeniDugme: '+ Yeni öğe', yeniBaslik: 'Yeni öğe', bos: 'Alışveriş listen boş. Eksikleri Market Stok sayfasından tek tuşla ekleyebilirsin.',
  alanlar: [
    { ad: 'ad', etiket: 'Ürün', tur: 'metin', zorunlu: true },
    { ad: 'miktar', etiket: 'Miktar', tur: 'sayi', zorunlu: true, varsayilan: 1 },
    { ad: 'birim', etiket: 'Birim', tur: 'metin' },
    { ad: 'alindi', etiket: 'Alındı', tur: 'onay', varsayilan: false },
  ],
  sutunlar: [
    { baslik: 'Ürün', goster: k => ad(k) }, { baslik: 'Miktar', sayi: true, goster: k => `${miktar(k.miktar)} ${k.birim ?? ''}` },
    { baslik: 'Durum', goster: k => (k.alindi ? 'Alındı' : 'Alınacak') },
  ],
  filtre: {}, sirala: 'ad', aramaAlanlari: ['ad'],
  hazirla: g => ({ ...g, miktar: g.miktar ?? 1 }),
  ozet: l => [['Alınacak', String(l.filter(k => !k.alindi).length), 'bekleyen öğe', 'vurgu'], ['Alındı', String(l.filter(k => k.alindi).length)]],
  islemler: [
    { etiket: 'Alındı', gorunur: k => !k.alindi, calistir: async k => { await kayitGuncelle('alisveris_ogeleri', ['alindi'], k.id, k.surum, { alindi: true }); } },
    { etiket: 'Geri al', gorunur: k => !!k.alindi, calistir: async k => { await kayitGuncelle('alisveris_ogeleri', ['alindi'], k.id, k.surum, { alindi: false }); } },
  ],
};

export const MARKET_SAYFALARI: Record<string, (kok: HTMLElement) => void> = { 'm-stok': kayitSayfasi(stok), 'm-liste': kayitSayfasi(liste) };
