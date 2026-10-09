import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { icraDosyalariniGetir } from '../../veri/icra';
import { kayitlariGetir } from '../../veri/kayit';
import { motorGetir } from '../../veri/getiri';
import { GRUP_ADI, stratejiGrupla, type Grup } from '../../veri/strateji';

/* Strateji Matrisi: borçları kurallara göre gruplar; eşik, Getiri Motoru'ndaki net mevduat getirisidir. */
export function stratejiSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [borclar, odemeler, icra, motor] = await Promise.all([
        kayitlariGetir('borclar', ['ad', 'tur', 'yon', 'durum', 'guncel_borc', 'faiz_orani'], {}, 'ad'),
        kayitlariGetir('odemeler', ['borc_id', 'tutar', 'durum'], { durum: 'bekliyor' }, 'vade_tarihi'),
        icraDosyalariniGetir().catch(() => []), motorGetir(),
      ]);
      const esik = motor.rate * (1 - motor.stopaj / 100);
      const riskli = icra.filter(d => d.durum === 'acik' && (d.takip_turu === 'İlamlı' || d.takip_turu === 'Tahliye')).map(d => d.dosya_no ?? '').filter(Boolean);
      const liste = stratejiGrupla(borclar, odemeler, riskli, esik);
      const ozet = el('div', 'icra-ozet');
      const grupToplam = (g: Grup) => liste.filter(x => x.grup === g).reduce((t, x) => t + x.tutar, 0);
      (Object.keys(GRUP_ADI) as Grup[]).forEach(g => {
        const x = el('div', 'icra-hucre' + (g === 'hemen' ? ' uyari' : '')); x.append(el('span', 'et', GRUP_ADI[g][0]), el('b', 'gz', tl(grupToplam(g))), el('small', '', `${liste.filter(y => y.grup === g).length} borç`)); ozet.appendChild(x);
      });
      kart.replaceChildren(ozet, el('p', 'bos', `Mevduat net getirisi eşiği: %${esik.toFixed(1)} (yıllık %${motor.rate} faiz, %${motor.stopaj} stopaj; Birikim › Getiri Motoru'ndan değişir). Bir borcun faizi bu eşiğin üstündeyse tutmak zarardır.`));
      (Object.keys(GRUP_ADI) as Grup[]).forEach(g => {
        const l = liste.filter(x => x.grup === g);
        const b = el('section'); b.append(el('h3', '', GRUP_ADI[g][0]), el('p', 'bos', GRUP_ADI[g][1]));
        if (!l.length) { b.appendChild(el('p', 'bos', 'Bu grupta borç yok.')); kart.appendChild(b); return; }
        const t = el('table'), bs = el('tr'); ['Borç', 'Kalan', 'Yıllık faiz', 'Aylık taksit', 'Neden'].forEach(x => bs.appendChild(el('th', '', x)));
        t.appendChild(el('thead')).appendChild(bs);
        const gv = el('tbody');
        l.forEach(x => { const tr = el('tr'); tr.append(el('td', '', x.ad), el('td', 'sayi gz', tl(x.tutar)), el('td', 'sayi', x.faiz ? `%${x.faiz}` : '—'), el('td', 'sayi', x.taksit ? tl(x.taksit) : '—'), el('td', '', x.neden)); gv.appendChild(tr); });
        t.appendChild(gv); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); b.appendChild(sarma); kart.appendChild(b);
      });
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
