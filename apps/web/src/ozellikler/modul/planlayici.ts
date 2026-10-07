import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir } from '../../veri/kayit';
import { planHesapla, type PlanSatiri } from './hesap';

const AY = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const ayAdi = (ay: string) => { const [y, m] = ay.split('-').map(Number); return AY.format(new Date(y!, m! - 1, 1)); };

export function planlayiciSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [gelirler, giderler, odemeler, alinacaklar, hedefler, hesaplar, hareketler] = await Promise.all([
        kayitlariGetir('gelirler', ['sabit', 'periyot', 'tutar', 'baslangic', 'bitis', 'aktif'], {}, 'ad'),
        kayitlariGetir('giderler', ['periyot', 'tutar', 'para_birimi', 'baslangic', 'bitis', 'taksit_kalan', 'aktif'], {}, 'ad'),
        kayitlariGetir('odemeler', ['vade_tarihi', 'tutar', 'durum'], {}, 'vade_tarihi'),
        kayitlariGetir('alinacaklar', ['tahmini_tutar', 'hedef_tarih', 'durum'], {}, 'ad'),
        kayitlariGetir('hedefler', ['hedef_tutar', 'biriken', 'hedef_tarihi', 'durum'], {}, 'ad'),
        kayitlariGetir('hesaplar', ['tur', 'acilis_bakiyesi', 'aktif'], {}, 'ad'),
        kayitlariGetir('hareketler', ['hesap_id', 'yon', 'tutar'], {}, 'tarih'),
      ]);
      const vadesiz = new Set(hesaplar.filter(h => h.tur === 'vadesiz' && h.aktif !== false).map(h => h.id));
      const baslangic = hesaplar.filter(h => vadesiz.has(h.id)).reduce((t, h) => t + Number(h.acilis_bakiyesi), 0)
        + hareketler.filter(h => vadesiz.has(String(h.hesap_id))).reduce((t, h) => t + (h.yon === 'giris' ? 1 : -1) * Number(h.tutar), 0);
      const bugun = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
      const plan: PlanSatiri[] = planHesapla({ bugun, baslangicBakiye: baslangic, gelirler, giderler, odemeler, alinacaklar, hedefler });
      const dovizli = giderler.filter(g => g.aktif !== false && (g.para_birimi ?? 'TRY') !== 'TRY').length;
      const sikisik = plan.filter(p => p.bakiye < 0);
      const enDusuk = plan.reduce((m, p) => (p.bakiye < m.bakiye ? p : m), plan[0]!);

      const ozet = el('div', 'icra-ozet');
      const h = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
      h('Bugünkü nakit', tl(baslangic), 'vadesiz hesaplarda', 'vurgu');
      h('12 ay sonu tahmini', tl(plan[plan.length - 1]!.bakiye), 'planlanan giriş ve çıkışlarla');
      h('En düşük bakiye', tl(enDusuk.bakiye), ayAdi(enDusuk.ay), enDusuk.bakiye < 0 ? 'uyari' : '');
      h('Sıkışık ay', String(sikisik.length), sikisik.length ? `ilk: ${ayAdi(sikisik[0]!.ay)}` : 'bakiye eksiye düşmüyor', sikisik.length ? 'uyari' : '');

      const sarma = el('div', 'tablo-sarma'), t = el('table'), bs = el('tr');
      ['Ay', 'Giriş', 'Sabit gider', 'Borç ödemesi', 'Alınacak', 'Hedef ayırma', 'Fark', 'Bakiye'].forEach(x => bs.appendChild(el('th', '', x)));
      t.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody');
      plan.forEach(p => {
        const tr = el('tr', p.bakiye < 0 ? 'sikisik' : '');
        tr.appendChild(el('td', '', ayAdi(p.ay)));
        [p.giris, p.gider, p.odeme, p.alinacak, p.hedef, p.fark, p.bakiye].forEach(v => tr.appendChild(el('td', 'sayi gz', tl(v))));
        g.appendChild(tr);
      });
      t.appendChild(g); sarma.appendChild(t);
      const not = el('p', 'bos', 'Hesaba katılanlar: sabit gelirler ve giderler kendi aylarında (aylık, 3 aylık, yıllık; tek seferlik giderler başlangıç ayında; taksidi biten çıkar), bekleyen ödemeler (gecikenler ilk ayda), tarihi olan alınacaklar ve hedeflere aylık ayırma. '
        + 'Kısa vadeli ekstra gelirler tahmine girmez.' + (dovizli ? ` ${dovizli} dövizli gider TL karşılığı bilinmediği için dahil değil.` : ''));
      kart.replaceChildren(ozet, sarma, not);
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
