import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir } from '../../veri/kayit';
import { sayi } from './kayit-sayfasi';

const TUR: [string, string][] = [['kisi', 'Kişi borçları'], ['banka', 'Banka borçları'], ['icra', 'İcra dosyaları'], ['vergi', 'Vergi borçları'], ['sgk', 'SGK borçları']];

export function borcOzetiSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [borclar, odemeler] = await Promise.all([
        kayitlariGetir('borclar', ['tur', 'yon', 'durum', 'guncel_borc'], {}, 'ad'),
        kayitlariGetir('odemeler', ['vade_tarihi', 'tutar', 'durum'], { durum: 'bekliyor' }, 'vade_tarihi'),
      ]);
      const acik = borclar.filter(b => b.durum !== 'kapandi');
      const borclu = acik.filter(b => b.yon !== 'alacakli');
      const topla = (l: typeof borclar) => l.reduce((t, b) => t + sayi(b.guncel_borc), 0);
      const bugun = new Date().toISOString().slice(0, 10);
      const otuz = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const yaklasan = odemeler.filter(o => String(o.vade_tarihi) <= otuz);
      const geciken = odemeler.filter(o => String(o.vade_tarihi) < bugun);

      const ozet = el('div', 'icra-ozet');
      const hucre = (et: string, d: string, not: string, sinif = '') => {
        const h = el('div', 'icra-hucre ' + sinif);
        h.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not));
        ozet.appendChild(h);
      };
      hucre('Toplam borç', tl(topla(borclu)), `${borclu.length} açık kayıt`, 'vurgu');
      hucre('30 gün içinde ödenecek', tl(yaklasan.reduce((t, o) => t + sayi(o.tutar), 0)), `${yaklasan.length} ödeme`);
      hucre('Geciken ödeme', String(geciken.length), tl(geciken.reduce((t, o) => t + sayi(o.tutar), 0)), geciken.length ? 'uyari' : '');
      hucre('Alacağım', tl(topla(acik.filter(b => b.yon === 'alacakli'))), 'borç toplamına karışmaz');

      const tablo = el('table');
      const bs = el('tr');
      ['Tür', 'Kayıt', 'Kalan', 'Pay'].forEach(h => bs.appendChild(el('th', '', h)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const govde = el('tbody');
      const toplam = topla(borclu) || 1;
      TUR.forEach(([t, ad]) => {
        const l = borclu.filter(b => b.tur === t);
        const tr = el('tr');
        tr.append(el('td', '', ad), el('td', 'sayi', String(l.length)), el('td', 'sayi gz', tl(topla(l))), el('td', 'sayi', `%${Math.round((topla(l) / toplam) * 100)}`));
        govde.appendChild(tr);
      });
      tablo.appendChild(govde);
      const sarma = el('div', 'tablo-sarma'); sarma.appendChild(tablo);
      kart.replaceChildren(ozet, sarma);
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
