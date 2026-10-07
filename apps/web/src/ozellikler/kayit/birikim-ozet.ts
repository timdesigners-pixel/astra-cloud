import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir } from '../../veri/kayit';
import { kurGetir } from '../genel/dis-veri';
import { altinDegeri } from './birikim';
import { sayi } from './kayit-sayfasi';

const TUR: [string, string][] = [['mevduat', 'Mevduat'], ['bes', 'BES'], ['altin', 'Altın']];

export function birikimOzetiSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [varlik, hesap, hareket, borc, kur] = await Promise.all([
        kayitlariGetir('varliklar', ['tur', 'ad', 'miktar', 'birim', 'anapara', 'guncel_deger'], {}, 'ad'),
        kayitlariGetir('hesaplar', ['acilis_bakiyesi', 'tur', 'aktif'], {}, 'ad'),
        kayitlariGetir('hareketler', ['hesap_id', 'yon', 'tutar'], {}, 'tarih'),
        kayitlariGetir('borclar', ['yon', 'durum', 'guncel_borc'], {}, 'ad'),
        kurGetir().catch(() => null),
      ]);
      const gram = kur?.gramAltin ?? null;
      const deger = (v: typeof varlik[number]) => (v.tur === 'altin' ? altinDegeri(v, gram) ?? 0 : sayi(v.guncel_deger ?? v.anapara));
      const toplamBirikim = varlik.reduce((t, v) => t + deger(v), 0);
      const acilis = hesap.filter(h => h.aktif !== false && h.tur === 'vadesiz').reduce((t, h) => t + sayi(h.acilis_bakiyesi), 0);
      const vadesizIdler = new Set(hesap.filter(h => h.tur === 'vadesiz').map(h => h.id));
      const hareketToplam = hareket.filter(h => vadesizIdler.has(String(h.hesap_id))).reduce((t, h) => t + (h.yon === 'giris' ? 1 : -1) * sayi(h.tutar), 0);
      const nakit = acilis + hareketToplam;
      const borc_ = borc.filter(b => b.yon !== 'alacakli' && b.durum !== 'kapandi').reduce((t, b) => t + sayi(b.guncel_borc), 0);

      const ozet = el('div', 'icra-ozet');
      const h = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
      h('Toplam birikim', tl(toplamBirikim), `${varlik.length} kayıt`, 'vurgu');
      h('Vadesiz hesaplarda', tl(nakit), 'açılış bakiyesi ve hareketlerden');
      h('Borç', tl(borc_), 'açık, borçlu olduğum kayıtlar', 'uyari');
      h('Net durum', tl(toplamBirikim + nakit - borc_), 'birikim + nakit − borç', toplamBirikim + nakit - borc_ < 0 ? 'uyari' : 'vurgu');

      const tablo = el('table'), bs = el('tr');
      ['Tür', 'Kayıt', 'Değer', 'Pay'].forEach(x => bs.appendChild(el('th', '', x)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const govde = el('tbody');
      TUR.forEach(([t, ad]) => {
        const l = varlik.filter(v => v.tur === t), d = l.reduce((x, v) => x + deger(v), 0);
        const tr = el('tr');
        tr.append(el('td', '', ad), el('td', 'sayi', String(l.length)), el('td', 'sayi gz', tl(d)), el('td', 'sayi', toplamBirikim ? `%${Math.round((d / toplamBirikim) * 100)}` : '—'));
        govde.appendChild(tr);
      });
      tablo.appendChild(govde);
      const sarma = el('div', 'tablo-sarma'); sarma.appendChild(tablo);
      kart.replaceChildren(ozet, sarma);
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
