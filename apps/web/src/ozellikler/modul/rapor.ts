import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir, type Kayit } from '../../veri/kayit';
import { ayEkle, raporHesapla, type Rapor } from './hesap';
import { genelRaporYazdir } from './genel-rapor';

const AY_ADI = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const adi = (ay: string) => { const [y, m] = ay.split('-').map(Number); return AY_ADI.format(new Date(y!, m! - 1, 1)); };
const yuzde = (a: number, b: number) => (b ? `${a >= b ? '+' : '−'}%${Math.abs(Math.round(((a - b) / b) * 100))}` : '—');

export function aylikRaporSayfasi(kok: HTMLElement) {
  const s = { ay: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 7), hareketler: [] as Kayit[], odemeler: [] as Kayit[], yukleniyor: true, hata: '' };
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  const bar = el('div', 'tbar');
  const geri = el('button', 'btn ghost sm', '‹'); geri.type = 'button'; geri.setAttribute('aria-label', 'Önceki ay');
  const ileri = el('button', 'btn ghost sm', '›'); ileri.type = 'button'; ileri.setAttribute('aria-label', 'Sonraki ay');
  const baslik = el('b', 'ajanda-ay');
  const yaz = el('button', 'btn ghost sm', 'Genel durum raporunu yazdır'); yaz.type = 'button'; yaz.id = 'rapor-yazdir';
  yaz.addEventListener('click', () => void genelRaporYazdir());
  bar.append(geri, baslik, ileri, el('span', 'tbar-sp'), yaz);
  const icerik = el('div', 'rapor-icerik');
  kart.append(bar, icerik);

  const tablo = (basliklar: string[], satirlar: string[][]) => {
    const sarma = el('div', 'tablo-sarma'), t = el('table'), bs = el('tr');
    basliklar.forEach(h => bs.appendChild(el('th', '', h)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    satirlar.forEach(r => { const tr = el('tr'); r.forEach((c, i) => tr.appendChild(el('td', i > 0 ? 'sayi gz' : '', c))); g.appendChild(tr); });
    t.appendChild(g); sarma.appendChild(t); return sarma;
  };
  const hucre = (ozet: HTMLElement, et: string, d: string, not: string, sinif = '') => {
    const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x);
  };

  function ciz() {
    baslik.textContent = adi(s.ay);
    icerik.replaceChildren();
    if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      icerik.append(el('p', 'bos hata', s.hata), b); return;
    }
    const r: Rapor = raporHesapla(s.hareketler, s.ay), o: Rapor = raporHesapla(s.hareketler, ayEkle(s.ay, -1));
    const varMi = s.hareketler.some(h => String(h.tarih).startsWith(s.ay));
    if (!varMi) icerik.appendChild(el('p', 'bos', `${adi(s.ay)} için henüz para hareketi yok. Ödemeler sayfasında "Ödendi" işaretledikçe ve gelir, gider girdikçe rapor dolar.`));
    const ozet = el('div', 'icra-ozet');
    hucre(ozet, 'Gelir', tl(r.gelir), `geçen aya göre ${yuzde(r.gelir, o.gelir)}`, 'vurgu');
    hucre(ozet, 'Gider', tl(r.gider), `geçen aya göre ${yuzde(r.gider, o.gider)}`);
    hucre(ozet, 'Borç ödemesi', tl(r.borcOdemesi), `geçen ay ${tl(o.borcOdemesi)}`);
    hucre(ozet, 'Birikime ayrılan', tl(r.birikimeAyrilan), 'birikim hesaplarına giden');
    hucre(ozet, 'Net nakit değişimi', tl(r.net), 'tüm girişler eksi tüm çıkışlar', r.net < 0 ? 'uyari' : 'vurgu');
    icerik.appendChild(ozet);
    if (r.alinanBorc) icerik.appendChild(el('p', 'bos', `Bu ay alınan borç ${tl(r.alinanBorc)}. Nakit girişidir, gelire sayılmadı.`));

    const bek = s.odemeler.filter(x => String(x.vade_tarihi).startsWith(s.ay) && x.durum !== 'iptal');
    const planli = bek.reduce((t, x) => t + Number(x.tutar), 0), odenen = bek.filter(x => x.durum === 'odendi').reduce((t, x) => t + Number(x.tutar), 0);
    icerik.append(el('h3', '', 'Planlanan ödemeler'), tablo(['', 'Tutar'], [['Bu ay vadesi gelen', tl(planli)], ['Ödenen', tl(odenen)], ['Ödenmesi kalan', tl(planli - odenen)]]));
    if (r.giderKirilimi.length) icerik.append(el('h3', '', 'Giderler (kategoriye göre)'), tablo(['Kategori', 'Tutar', 'Pay'], r.giderKirilimi.map(([k, t]) => [k, tl(t), `%${Math.round((t / r.gider) * 100)}`])));
    if (r.gelirKirilimi.length) icerik.append(el('h3', '', 'Gelirler (kategoriye göre)'), tablo(['Kategori', 'Tutar', 'Pay'], r.gelirKirilimi.map(([k, t]) => [k, tl(t), `%${Math.round((t / r.gelir) * 100)}`])));
    icerik.append(el('h3', '', 'Önceki ayla karşılaştırma'), tablo(['', adi(s.ay), adi(ayEkle(s.ay, -1))],
      [['Gelir', tl(r.gelir), tl(o.gelir)], ['Gider', tl(r.gider), tl(o.gider)], ['Borç ödemesi', tl(r.borcOdemesi), tl(o.borcOdemesi)], ['Net', tl(r.net), tl(o.net)]]));
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try {
      [s.hareketler, s.odemeler] = await Promise.all([
        kayitlariGetir('hareketler', ['yon', 'tur', 'tutar', 'tarih', 'kategori', 'gelir_sayilir'], {}, 'tarih'),
        kayitlariGetir('odemeler', ['vade_tarihi', 'tutar', 'durum'], {}, 'vade_tarihi'),
      ]);
    } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }
  geri.addEventListener('click', () => { s.ay = ayEkle(s.ay, -1); ciz(); });
  ileri.addEventListener('click', () => { s.ay = ayEkle(s.ay, 1); ciz(); });
  void yukle();
}
