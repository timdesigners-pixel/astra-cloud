import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir } from '../../veri/kayit';
import { simule, type SimBorc, type SimSonuc } from './hesap';

const AY = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const aySonra = (k: number) => AY.format(new Date(new Date().getFullYear(), new Date().getMonth() + k, 1));
const sureYaz = (ay: number | null) => (ay === null ? 'kapanmıyor' : ay === 0 ? 'borç yok' : `${ay} ay · ${aySonra(ay)}`);

type Satir = SimBorc & { dahil: boolean };

export function simulasyonSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [borclar, odemeler] = await Promise.all([
        kayitlariGetir('borclar', ['ad', 'yon', 'durum', 'guncel_borc', 'faiz_orani'], {}, 'ad'),
        kayitlariGetir('odemeler', ['borc_id', 'tutar', 'durum'], { durum: 'bekliyor' }, 'vade_tarihi'),
      ]);
      const satirlar: Satir[] = borclar.filter(b => b.yon !== 'alacakli' && b.durum !== 'kapandi' && Number(b.guncel_borc) > 0).map(b => {
        const o = odemeler.filter(x => x.borc_id === b.id);
        return { id: b.id, ad: String(b.ad), bakiye: Number(b.guncel_borc), faizYillik: Number(b.faiz_orani ?? 0),
          min: o.length ? Math.round((o.reduce((t, x) => t + Number(x.tutar), 0) / o.length) * 100) / 100 : 0, dahil: true };
      });
      if (!satirlar.length) { kart.replaceChildren(el('p', 'bos', 'Açık borç yok. Borçlar menüsünden borç ekleyince burada senaryo çalıştırabilirsin.')); return; }

      let ek = 0;
      const girisler = el('div', 'sim-girisler');
      const ekGiris = el('input'); ekGiris.type = 'number'; ekGiris.min = '0'; ekGiris.step = '100'; ekGiris.id = 'sim-ek'; ekGiris.value = '0';
      const ekEtiket = el('label', 'alan'); ekEtiket.append(el('span', '', 'Aylık ek ödeme (TL)'), ekGiris, el('small', '', 'Mevcut taksitlerin üstüne ayırabileceğin tutar'));
      girisler.appendChild(ekEtiket);
      const sonuc = el('div', 'sim-sonuc');
      const tablo = el('div', 'tablo-sarma');
      kart.replaceChildren(girisler, tablo, sonuc);

      const tabloCiz = () => {
        const t = el('table'), bs = el('tr');
        ['Dahil', 'Borç', 'Kalan', 'Yıllık faiz %', 'Aylık ödeme'].forEach(x => bs.appendChild(el('th', '', x)));
        t.appendChild(el('thead')).appendChild(bs);
        const g = el('tbody');
        satirlar.forEach(s => {
          const tr = el('tr');
          const c = el('input'); c.type = 'checkbox'; c.checked = s.dahil; c.setAttribute('aria-label', `${s.ad} dahil`);
          c.addEventListener('change', () => { s.dahil = c.checked; hesapla(); });
          const tdC = el('td'); tdC.appendChild(c);
          const faiz = el('input'); faiz.type = 'number'; faiz.step = '0.1'; faiz.min = '0'; faiz.value = String(s.faizYillik); faiz.setAttribute('aria-label', `${s.ad} yıllık faiz`);
          faiz.addEventListener('input', () => { s.faizYillik = Math.max(0, Number(faiz.value) || 0); hesapla(); });
          const min = el('input'); min.type = 'number'; min.step = '50'; min.min = '0'; min.value = String(s.min); min.setAttribute('aria-label', `${s.ad} aylık ödeme`);
          min.addEventListener('input', () => { s.min = Math.max(0, Number(min.value) || 0); hesapla(); });
          const tdF = el('td'); tdF.appendChild(faiz); const tdM = el('td'); tdM.appendChild(min);
          tr.append(tdC, el('td', '', s.ad), el('td', 'sayi gz', tl(s.bakiye)), tdF, tdM);
          g.appendChild(tr);
        });
        t.appendChild(g); tablo.replaceChildren(t);
      };

      const hesapla = () => {
        const secili = satirlar.filter(s => s.dahil);
        const adlar = new Map(secili.map(s => [s.id, s.ad]));
        const kutu = (baslik: string, r: SimSonuc, vurgu = false) => {
          const k = el('div', 'icra-hucre' + (vurgu ? ' vurgu' : ''));
          k.append(el('span', 'et', baslik), el('b', 'gz', sureYaz(r.ay)), el('small', '', r.ay === null ? (r.neden ?? '') : `toplam faiz ${tl(r.toplamFaiz)}`));
          return k;
        };
        const yok = simule(secili, 0, 'cig'), cig = simule(secili, ek, 'cig'), kar = simule(secili, ek, 'kartopu');
        const kutular = el('div', 'icra-ozet');
        kutular.append(kutu('Ek ödeme olmadan', yok), kutu(`Çığ yöntemi · ek ${tl(ek)}`, cig, true), kutu(`Kartopu yöntemi · ek ${tl(ek)}`, kar));
        const aciklama = el('p', 'bos', 'Çığ: önce faizi en yüksek borç kapatılır, toplam faiz en azdır. Kartopu: önce en küçük borç kapatılır, ilk borçlar daha çabuk biter. Kapanan borcun taksiti sıradaki borca eklenir.');
        const kapanis = el('table'), bs = el('tr');
        ['Borç', 'Çığ ile kapanış', 'Kartopu ile kapanış'].forEach(x => bs.appendChild(el('th', '', x)));
        kapanis.appendChild(el('thead')).appendChild(bs);
        const g = el('tbody');
        [...cig.kapanis.entries()].sort((a, b) => a[1] - b[1]).forEach(([id, ay]) => {
          const k2 = kar.kapanis.get(id);
          const tr = el('tr'); tr.append(el('td', '', adlar.get(id) ?? ''), el('td', '', `${ay}. ay · ${aySonra(ay)}`), el('td', '', k2 ? `${k2}. ay · ${aySonra(k2)}` : '—'));
          g.appendChild(tr);
        });
        kapanis.appendChild(g);
        const sarma = el('div', 'tablo-sarma'); if (cig.kapanis.size) sarma.appendChild(kapanis);
        sonuc.replaceChildren(kutular, sarma, aciklama);
      };

      ekGiris.addEventListener('input', () => { ek = Math.max(0, Number(ekGiris.value) || 0); hesapla(); });
      tabloCiz(); hesapla();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
