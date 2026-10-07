import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { istemciAl } from '../../veri/istemci';
import { kayitEkle, kayitlariGetir, type Kayit } from '../../veri/kayit';
import { alinacakAlindi, alinacakGeriAl } from '../../veri/odemeler';
import { kayitSayfasi, sayi, type KayitAyari } from './kayit-sayfasi';

const ad = (k: Kayit) => String(k.ad ?? '—');
const topla = (l: Kayit[], f: string) => l.reduce((t, k) => t + sayi(k[f]), 0);
const GRUP: [string, string][] = [['bakim', 'Kişisel bakım'], ['alisveris', 'Alışveriş'], ['diger', 'Diğer']];
const ONCELIK: [string, string][] = [['yuksek', 'Yüksek'], ['orta', 'Orta'], ['dusuk', 'Düşük']];
const sec = (l: [string, string][], v: unknown) => l.find(x => x[0] === v)?.[1] ?? '—';
const bugunStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

async function hedefAdlari() {
  const l = await kayitlariGetir('hedefler', ['ad'], {}, 'ad');
  return { hedefler: new Map(l.map(h => [h.id, String(h.ad)])) };
}
const hedefSecenekleri = (b: { dis: { hedefler?: Map<string, string> } }): [string, string][] => [...(b.dis.hedefler ?? new Map()).entries()];

/* Kalan tutarın hedef tarihine kadar aylık karşılığı. */
function aylikGerekli(k: Kayit): number | null {
  const kalan = sayi(k.hedef_tutar) - sayi(k.biriken);
  if (kalan <= 0 || !k.hedef_tarihi) return null;
  const bugun = new Date(), h = new Date(String(k.hedef_tarihi));
  const ay = (h.getFullYear() - bugun.getFullYear()) * 12 + (h.getMonth() - bugun.getMonth());
  return ay >= 1 ? kalan / ay : kalan;
}

const hedefler: KayitAyari = {
  tablo: 'hedefler', yeniDugme: '+ Yeni hedef', yeniBaslik: 'Yeni hedef', bos: 'Henüz hedef yok.',
  alanlar: [
    { ad: 'ad', etiket: 'Hedef', tur: 'metin', zorunlu: true },
    { ad: 'grup', etiket: 'Grup', tur: 'secim', secenekler: GRUP, zorunlu: true, varsayilan: 'diger' },
    { ad: 'hedef_tutar', etiket: 'Hedef tutar (TL)', tur: 'sayi', zorunlu: true },
    { ad: 'biriken', etiket: 'Biriken (TL)', tur: 'sayi', ipucu: 'Şimdiye kadar ayırdığın tutar' },
    { ad: 'hedef_tarihi', etiket: 'Hedef tarih', tur: 'tarih' },
    { ad: 'durum', etiket: 'Durum', tur: 'secim', secenekler: [['aktif', 'Aktif'], ['tamamlandi', 'Tamamlandı']], zorunlu: true, varsayilan: 'aktif' },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'Hedef', goster: k => ad(k) }, { baslik: 'Grup', goster: k => sec(GRUP, k.grup) },
    { baslik: 'Hedef tutar', sayi: true, goster: k => tl(sayi(k.hedef_tutar)) }, { baslik: 'Biriken', sayi: true, goster: k => tl(sayi(k.biriken)) },
    { baslik: 'İlerleme', sayi: true, goster: k => (sayi(k.hedef_tutar) ? `%${Math.min(100, Math.round((sayi(k.biriken) / sayi(k.hedef_tutar)) * 100))}` : '—') },
    { baslik: 'Hedef tarih', goster: k => gun(k.hedef_tarihi as string | null) },
    { baslik: 'Aylık gerekli', sayi: true, goster: k => { const a = k.durum === 'aktif' ? aylikGerekli(k) : null; return a === null ? '—' : tl(a); } },
  ],
  filtre: {}, sirala: 'ad',
  hazirla: g => ({ ...g, hedef_tutar: g.hedef_tutar ?? 0, biriken: g.biriken ?? 0 }),
  ozet: l => {
    const a = l.filter(k => k.durum === 'aktif');
    const aylik = a.reduce((t, k) => t + (aylikGerekli(k) ?? 0), 0);
    return [['Aktif hedef', String(a.length), `${l.length - a.length} tamamlandı`], ['Toplam hedef', tl(topla(a, 'hedef_tutar')), '', 'vurgu'],
      ['Biriken', tl(topla(a, 'biriken')), `kalan ${tl(Math.max(0, topla(a, 'hedef_tutar') - topla(a, 'biriken')))}`], ['Aylık ayırmalısın', tl(aylik), 'tarihi olan hedefler için']];
  },
};

const istekler: KayitAyari = {
  tablo: 'istekler', yeniDugme: '+ Yeni istek', yeniBaslik: 'Yeni istek', bos: 'Henüz istek yok. Beğendiğin ürünleri buraya taşıyabilirsin.',
  alanlar: [
    { ad: 'ad', etiket: 'İstek', tur: 'metin', zorunlu: true },
    { ad: 'tahmini_tutar', etiket: 'Tahmini fiyat (TL)', tur: 'sayi' },
    { ad: 'oncelik', etiket: 'Öncelik', tur: 'secim', secenekler: ONCELIK, zorunlu: true, varsayilan: 'orta' },
    { ad: 'hedef_id', etiket: 'Bağlı hedef', tur: 'secim', secenekler: hedefSecenekleri },
    { ad: 'baglanti', etiket: 'Bağlantı', tur: 'metin' },
    { ad: 'durum', etiket: 'Durum', tur: 'secim', secenekler: [['bekliyor', 'Bekliyor'], ['vazgecildi', 'Vazgeçildi']], zorunlu: true, varsayilan: 'bekliyor' },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'İstek', goster: k => ad(k) }, { baslik: 'Fiyat', sayi: true, goster: k => (k.tahmini_tutar === null ? '—' : tl(sayi(k.tahmini_tutar))) },
    { baslik: 'Öncelik', goster: k => sec(ONCELIK, k.oncelik) }, { baslik: 'Hedef', goster: (k, b) => b.dis.hedefler?.get(String(k.hedef_id)) ?? '—' },
    { baslik: 'Durum', goster: k => (k.durum === 'vazgecildi' ? 'Vazgeçildi' : 'Bekliyor') },
  ],
  filtre: {}, sirala: 'ad', dis: hedefAdlari,
  ozet: l => {
    const b = l.filter(k => k.durum === 'bekliyor');
    return [['Bekleyen istek', String(b.length), '', 'vurgu'], ['Tahmini toplam', tl(topla(b, 'tahmini_tutar')), 'fiyatı girilenler'], ['Yüksek öncelik', String(b.filter(k => k.oncelik === 'yuksek').length)]];
  },
};

const begeniler: KayitAyari = {
  tablo: 'begeniler', yeniDugme: '+ Yeni ürün', yeniBaslik: 'Beğenilen ürün', bos: 'Henüz beğenilen ürün yok.',
  alanlar: [
    { ad: 'ad', etiket: 'Ürün', tur: 'metin', zorunlu: true },
    { ad: 'fiyat', etiket: 'Güncel fiyat (TL)', tur: 'sayi', ipucu: 'Fiyat değişince buradan güncelle; ilk fiyatla karşılaştırılır' },
    { ad: 'ilk_fiyat', etiket: 'İlk görülen fiyat (TL)', tur: 'sayi', ipucu: 'Boş bırakırsan güncel fiyat yazılır' },
    { ad: 'baglanti', etiket: 'Bağlantı', tur: 'metin' },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'Ürün', goster: k => ad(k) }, { baslik: 'Fiyat', sayi: true, goster: k => (k.fiyat === null ? '—' : tl(sayi(k.fiyat))) },
    { baslik: 'Değişim', sayi: true, goster: k => (k.fiyat === null || !k.ilk_fiyat ? '—' : `${sayi(k.fiyat) < sayi(k.ilk_fiyat) ? '−' : '+'}%${Math.abs(Math.round(((sayi(k.fiyat) - sayi(k.ilk_fiyat)) / sayi(k.ilk_fiyat)) * 100))}`) },
    { baslik: 'Bağlantı', goster: k => (k.baglanti ? 'var' : '—') },
  ],
  filtre: {}, sirala: 'ad',
  hazirla: g => ({ ...g, ilk_fiyat: g.ilk_fiyat ?? g.fiyat }),
  ozet: l => [['Ürün', String(l.length)], ['Fiyatı düşen', String(l.filter(k => k.fiyat !== null && k.ilk_fiyat && sayi(k.fiyat) < sayi(k.ilk_fiyat)).length), 'ilk fiyata göre', 'vurgu']],
  islemler: [{
    etiket: 'İstek listesine ekle',
    calistir: async k => {
      await kayitEkle('istekler', ['ad'], { ad: k.ad, tahmini_tutar: k.fiyat ?? null, baglanti: k.baglanti ?? null, oncelik: 'orta', durum: 'bekliyor' });
      bildir('İstek listesine eklendi');
    },
  }],
};

/* Alındı: hesap ve gerçek tutar sorulur; hareket tek işlemde yazılır. */
function alindiSor(k: Kayit, hesaplar: Map<string, string>): Promise<boolean> {
  return new Promise(coz => {
    const dlg = el('dialog', 'kutu'); dlg.setAttribute('aria-label', 'Alındı olarak işaretle');
    const f = el('form'); f.noValidate = true; f.method = 'dialog'; f.appendChild(el('h2', '', 'Alındı olarak işaretle'));
    const al = (et: string, g: HTMLElement) => { const l = el('label', 'alan'); l.append(el('span', '', et), g); f.appendChild(l); };
    const hesap = el('select'); hesap.id = 'af-hesap';
    const b = el('option', '', '—'); b.value = ''; hesap.appendChild(b);
    hesaplar.forEach((a, id) => { const o = el('option', '', a); o.value = id; hesap.appendChild(o); });
    const tutar = el('input'); tutar.id = 'af-tutar'; tutar.type = 'number'; tutar.step = '0.01'; tutar.value = k.tahmini_tutar === null ? '' : String(k.tahmini_tutar);
    const tarih = el('input'); tarih.id = 'af-tarih'; tarih.type = 'date'; tarih.value = bugunStr();
    al('Ödenen hesap', hesap); al('Ödenen tutar (TL)', tutar); al('Tarih', tarih);
    const hata = el('p', 'form-hata'); hata.hidden = true; f.appendChild(hata);
    const d = el('div', 'form-dugmeler');
    const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
    const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
    d.append(kaydet, vazgec); f.appendChild(d);
    let tamam = false;
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const t = Number(tutar.value.replace(',', '.'));
      if (!hesap.value || !(t > 0) || !tarih.value) { hata.textContent = 'Hesap, tutar ve tarih gerekli.'; hata.hidden = false; return; }
      kaydet.disabled = true;
      try { await alinacakAlindi(k.id, hesap.value, t, tarih.value); tamam = true; dlg.close(); }
      catch (err) { kaydet.disabled = false; hata.textContent = hataMetni(err); hata.hidden = false; }
    });
    dlg.appendChild(f);
    dlg.addEventListener('close', () => { dlg.remove(); coz(tamam); });
    document.body.appendChild(dlg); dlg.showModal();
  });
}

const alinacaklar: KayitAyari = {
  tablo: 'alinacaklar', yeniDugme: '+ Yeni alınacak', yeniBaslik: 'Yeni alınacak', bos: 'Henüz alınacak yok. Alınmasına karar verdiğin şeyleri buraya ekle; istekler Hayaller sayfasındadır.',
  alanlar: [
    { ad: 'ad', etiket: 'Ne alınacak', tur: 'metin', zorunlu: true },
    { ad: 'tahmini_tutar', etiket: 'Tahmini tutar (TL)', tur: 'sayi' },
    { ad: 'hedef_tarih', etiket: 'Ne zaman alınacak', tur: 'tarih' },
    { ad: 'hedef_id', etiket: 'Bağlı hedef', tur: 'secim', secenekler: hedefSecenekleri },
    { ad: 'notlar', etiket: 'Not', tur: 'uzun' },
  ],
  sutunlar: [
    { baslik: 'Ürün', goster: k => ad(k) }, { baslik: 'Tutar', sayi: true, goster: k => (k.tahmini_tutar === null ? '—' : tl(sayi(k.tahmini_tutar))) },
    { baslik: 'Hedef ay', goster: k => gun(k.hedef_tarih as string | null) },
    { baslik: 'Durum', goster: k => (k.durum === 'alindi' ? `Alındı · ${gun(k.alindi_tarihi as string | null)}` : 'Karar verildi') },
  ],
  filtre: {}, sirala: 'ad', dis: hedefAdlari, ekSutunlar: ['durum', 'alindi_tarihi'],
  ozet: l => {
    const k = l.filter(x => x.durum === 'karar'), ay = new Date().toISOString().slice(0, 7);
    return [['Planlanan toplam', tl(topla(k, 'tahmini_tutar')), `${k.length} ürün`, 'vurgu'],
      ['Bu ay alınacak', String(k.filter(x => String(x.hedef_tarih ?? '').slice(0, 7) === ay).length)], ['Alındı', String(l.length - k.length)]];
  },
  islemler: [
    {
      etiket: 'Alındı', gorunur: k => k.durum === 'karar',
      calistir: async k => {
        const { data, error } = await istemciAl().from('hesaplar').select('id,ad').is('silindi_at', null).order('ad');
        if (error) throw error;
        const tamam = await alindiSor(k, new Map((data ?? []).map(h => [h.id as string, h.ad as string])));
        if (tamam) bildir('Alındı olarak işaretlendi');
      },
    },
    { etiket: 'Geri al', gorunur: k => k.durum === 'alindi', calistir: async k => { await alinacakGeriAl(k.id); bildir('Geri alındı'); } },
  ],
};

export const HEDEF_SAYFALARI: Record<string, (kok: HTMLElement) => void> = {
  'h-hedef': kayitSayfasi(hedefler), 'h-alinacak': kayitSayfasi(istekler), 'h-begen': kayitSayfasi(begeniler), 'e-alinacak': kayitSayfasi(alinacaklar),
};
