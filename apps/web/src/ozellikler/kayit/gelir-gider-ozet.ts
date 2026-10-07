import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir, type Kayit } from '../../veri/kayit';
import { ayAdi, ayAnahtari, ayKaydir, gelirAyi, giderAyi, sonAylar } from './ozet-hesap';

const GELIR_TUR: Record<string, string> = { maas: 'Maaş', kira: 'Kira geliri', faiz: 'Faiz geliri', tarla: 'Tarla kirası', ek_is: 'Ek iş', bahis: 'Bahis net sonucu', diger: 'Diğer' };
const GIDER_TUR: Record<string, string> = { fatura: 'Faturalar', abonelik: 'Abonelikler', sabit: 'Sabit giderler' };

type Hucre = [etiket: string, deger: string, not: string, sinif?: string];

/* Ay seçici + özet hücreleri + kırılım tablosu + son 6 ay çubukları çizen ortak iskelet. */
function ozetSayfasi(yukle: () => Promise<(ay: string) => { hucreler: Hucre[]; kirilim: [string, number][]; kirilimBaslik: string; toplam: number }>, trendBaslik: string) {
  return (kok: HTMLElement) => {
    const kart = el('section', 'card icra');
    kok.replaceChildren(kart);
    kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
    void (async () => {
      try {
        const hesapla = await yukle();
        let ay = ayAnahtari(new Date());
        const ciz = () => {
          const r = hesapla(ay);
          const bar = el('div', 'tbar');
          const geri = el('button', 'btn ghost sm ay-geri', '‹'); geri.type = 'button'; geri.setAttribute('aria-label', 'Önceki ay');
          const ileri = el('button', 'btn ghost sm ay-ileri', '›'); ileri.type = 'button'; ileri.setAttribute('aria-label', 'Sonraki ay');
          const etiket = el('b', 'ay-etiket gz', ayAdi(ay));
          geri.addEventListener('click', () => { ay = ayKaydir(ay, -1); ciz(); });
          ileri.addEventListener('click', () => { ay = ayKaydir(ay, 1); ciz(); });
          bar.append(geri, etiket, ileri);

          const ozet = el('div', 'icra-ozet');
          r.hucreler.forEach(([et, d, not, sinif]) => { const x = el('div', 'icra-hucre ' + (sinif ?? '')); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); });

          const tablo = el('table'), bs = el('tr');
          [r.kirilimBaslik, 'Tutar', 'Pay'].forEach(x => bs.appendChild(el('th', '', x)));
          tablo.appendChild(el('thead')).appendChild(bs);
          const govde = el('tbody');
          const satirlar = r.kirilim.filter(([, v]) => v !== 0);
          if (!satirlar.length) { const tr = el('tr'); const td = el('td', 'bos', 'Bu ay için kayıt yok.'); td.colSpan = 3; tr.appendChild(td); govde.appendChild(tr); }
          const mutlak = satirlar.reduce((t, [, v]) => t + Math.abs(v), 0) || 1;
          satirlar.forEach(([ad, v]) => {
            const tr = el('tr');
            tr.append(el('td', '', ad), el('td', 'sayi gz', tl(v)), el('td', 'sayi', `%${Math.round((Math.abs(v) / mutlak) * 100)}`));
            govde.appendChild(tr);
          });
          tablo.appendChild(govde);
          const sarma = el('div', 'tablo-sarma'); sarma.appendChild(tablo);

          const trend = el('div', 'ay-trend');
          trend.appendChild(el('h3', 'ay-trend-baslik', trendBaslik));
          const aylar = sonAylar(ay, 6), degerler = aylar.map(a => hesapla(a).toplam);
          const en = Math.max(...degerler.map(Math.abs), 1);
          aylar.forEach((a, i) => {
            const s = el('div', 'ay-satir' + (a === ay ? ' secili' : ''));
            const cubuk = el('span', 'ay-cubuk'); const ic = el('i'); ic.style.width = `${Math.round((Math.abs(degerler[i]!) / en) * 100)}%`; cubuk.appendChild(ic);
            s.append(el('span', 'ay-ad', ayAdi(a)), cubuk, el('span', 'sayi gz', tl(degerler[i]!)));
            trend.appendChild(s);
          });
          kart.replaceChildren(bar, ozet, sarma, trend);
        };
        ciz();
      } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
    })();
  };
}

export const gelirOzetiSayfasi = ozetSayfasi(async () => {
  const gelirler = await kayitlariGetir('gelirler', ['tur', 'sabit', 'periyot', 'tutar', 'baslangic', 'bitis', 'aktif'], {}, 'ad');
  return ay => {
    const a = gelirAyi(gelirler, ay);
    const kirilim: [string, number][] = [
      ...[...a.sabit].map(([t, v]) => [`${GELIR_TUR[t] ?? t} (sabit)`, v] as [string, number]),
      ...[...a.ekstra].map(([t, v]) => [`${GELIR_TUR[t] ?? t} (ekstra)`, v] as [string, number]),
    ];
    return {
      hucreler: [
        ['Toplam gelir', tl(a.toplam), 'sabit + ekstra', 'vurgu'],
        ['Sabit gelir', tl(a.sabitToplam), 'yıllık ve 3 aylık gelirler aya bölünür'],
        ['Ekstra gelir', tl(a.ekstraToplam), 'bahis zararı eksi sayılır'],
        ['Alınan borç', tl(a.alinanBorc), 'gelir sayılmaz'],
      ],
      kirilim, kirilimBaslik: 'Kaynak', toplam: a.toplam,
    };
  };
}, 'Son 6 ay toplam gelir');

export const giderOzetiSayfasi = ozetSayfasi(async () => {
  const [giderler, fisler, hareketler]: Kayit[][] = await Promise.all([
    kayitlariGetir('giderler', ['tur', 'periyot', 'tutar', 'para_birimi', 'bitis', 'aktif'], {}, 'ad'),
    kayitlariGetir('fisler', ['tarih', 'toplam'], {}, 'tarih'),
    kayitlariGetir('hareketler', ['yon', 'tur', 'tutar', 'tarih'], {}, 'tarih'),
  ]);
  return ay => {
    const g = giderAyi(giderler, fisler, hareketler, ay);
    const kirilim: [string, number][] = [
      ...Object.entries(GIDER_TUR).map(([t, ad]) => [ad, g.sabit.get(t) ?? 0] as [string, number]),
      ['Market alışverişi', g.market], ['Borç ödemeleri', g.borcOdemesi], ['Alınanlar', g.alinanlar],
    ];
    return {
      hucreler: [
        ['Toplam gider', tl(g.toplam), 'sabit yük + market + borç ödemesi + alınanlar', 'vurgu'],
        ['Sabit yük', tl(g.sabitToplam), g.dovizli ? `${g.dovizli} dövizli kayıt dahil değil` : 'fatura, abonelik ve sabit giderler'],
        ['Market', tl(g.market), 'fişlerden'],
        ['Borç ödemesi', tl(g.borcOdemesi), 'ödenmiş taksit ve borçlar'],
      ],
      kirilim, kirilimBaslik: 'Kalem', toplam: g.toplam,
    };
  };
}, 'Son 6 ay toplam gider');
