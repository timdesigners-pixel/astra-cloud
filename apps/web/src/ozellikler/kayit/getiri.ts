import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import { bankaOranlariniGetir, bankaOranlariniYaz, getiriHesapla, motorGetir, motorSim, motorYaz, type Bilesik, type BankaOrani, type Motor } from '../../veri/getiri';
import { gunFarki } from '../../veri/sureler';
import { kayitlariGetir } from '../../veri/kayit';

const sayi = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const STOPAJ = 17.5;

/* Faiz / Getiri Motoru: mevduatların vadeye kadar getirisi, banka oranları radarı ve hesap makinesi. */
export function getiriSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [varliklar, oranlar, motorKayitli] = await Promise.all([
        kayitlariGetir('varliklar', ['tur', 'ad', 'anapara', 'guncel_deger', 'faiz_orani', 'vade_tarihi'], { tur: 'mevduat' }, 'ad'),
        bankaOranlariniGetir(), motorGetir(),
      ]);
      const motor: Motor = motorKayitli;
      let motorBekle = 0;
      let radar: BankaOrani[] = oranlar.map(o => ({ ...o }));
      const bugun = bugunAnahtari();
      let stopaj = STOPAJ, bilesik: Bilesik = 'gunluk';

      const ciz = () => {
        const ozet = el('div', 'icra-ozet');
        const hucre = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
        const toplam = varliklar.reduce((t, v) => t + sayi(v.guncel_deger ?? v.anapara), 0);
        const agirlikli = toplam > 0 ? varliklar.reduce((t, v) => t + sayi(v.guncel_deger ?? v.anapara) * sayi(v.faiz_orani), 0) / toplam : 0;
        const enIyi = radar.reduce<BankaOrani | null>((m, o) => (!m || o.oran > m.oran ? o : m), null);
        const fark = enIyi && agirlikli > 0 ? (enIyi.oran - agirlikli) : 0;
        hucre('Mevduat toplamı', tl(toplam), `${varliklar.length} kayıt`, 'vurgu');
        hucre('Ağırlıklı yıllık oran', agirlikli ? `%${agirlikli.toFixed(1).replace('.', ',')}` : '—', 'anapara ağırlıklı');
        hucre('Radardaki en iyi oran', enIyi ? `%${enIyi.oran.toString().replace('.', ',')}` : '—', enIyi?.banka ?? 'radar boş');
        hucre('Yıllık fark', fark > 0 ? tl(toplam * fark / 100) : '—', fark > 0 ? 'en iyi orana geçilirse brüt ek getiri' : 'mevcut oranlar radarın altında değil', fark > 0 ? 'uyari' : '');

        // Mevduatlar
        const tablo = el('table'), bs = el('tr');
        ['Mevduat', 'Anapara', 'Oran', 'Vade', 'Vadeye kalan', 'Vadede net getiri'].forEach(x => bs.appendChild(el('th', '', x)));
        tablo.appendChild(el('thead')).appendChild(bs);
        const g = el('tbody');
        varliklar.forEach(v => {
          const kalan = v.vade_tarihi ? gunFarki(String(v.vade_tarihi), bugun) : null;
          const r = getiriHesapla(sayi(v.anapara), sayi(v.faiz_orani), kalan !== null && kalan > 0 ? kalan : 0, bilesik, stopaj);
          const tr = el('tr');
          tr.append(el('td', '', String(v.ad)), el('td', 'sayi gz', tl(sayi(v.anapara))), el('td', 'sayi', v.faiz_orani === null ? '—' : `%${sayi(v.faiz_orani)}`),
            el('td', '', v.vade_tarihi ? gun(String(v.vade_tarihi)) : '—'), el('td', 'sayi', kalan === null ? '—' : kalan <= 0 ? 'doldu' : `${kalan} gün`), el('td', 'sayi gz', kalan !== null && kalan > 0 ? tl(r.net) : '—'));
          g.appendChild(tr);
        });
        tablo.appendChild(g);
        const sarma = el('div', 'tablo-sarma'); sarma.appendChild(tablo);

        // Hesap makinesi
        const hm = el('section', 'getiri-hm'); hm.appendChild(el('h3', '', 'Hesap makinesi'));
        const girdiler = el('div', 'ic-grid');
        const alan = (id: string, et: string, v: string, tip = 'number') => { const l = el('label', 'alan'); const i = el('input'); i.id = id; i.type = tip; i.value = v; if (tip === 'number') i.step = 'any'; l.append(el('span', '', et), i); girdiler.appendChild(l); return i; };
        const tutar = alan('gt-tutar', 'Tutar (TL)', '100000'), oran = alan('gt-oran', 'Yıllık oran (%)', String(enIyi?.oran ?? 40)), gunI = alan('gt-gun', 'Süre (gün)', '32'), st = alan('gt-stopaj', 'Stopaj (%)', String(stopaj));
        const bl = el('label', 'alan'); const bsec = el('select'); bsec.id = 'gt-bilesik';
        [['gunluk', 'Günlük bileşik'], ['basit', 'Basit faiz']].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; bsec.appendChild(o); }); bsec.value = bilesik;
        bl.append(el('span', '', 'Yöntem'), bsec); girdiler.appendChild(bl);
        const sonuc = el('div', 'icra-ozet'); sonuc.id = 'gt-sonuc';
        const hesapla = () => {
          stopaj = sayi(st.value); bilesik = bsec.value as Bilesik;
          const r = getiriHesapla(sayi(tutar.value), sayi(oran.value), sayi(gunI.value), bilesik, stopaj);
          sonuc.replaceChildren();
          [['Brüt getiri', tl(r.brut)], ['Stopaj', tl(r.stopaj)], ['Net getiri', tl(r.net)], ['Vade sonu tutar', tl(r.son)]].forEach(([et, d]) => {
            const x = el('div', 'icra-hucre'); x.append(el('span', 'et', et!), el('b', 'gz', d!)); sonuc.appendChild(x);
          });
        };
        [tutar, oran, gunI, st, bsec].forEach(x => x.addEventListener('input', hesapla));
        hm.append(girdiler, sonuc); hesapla();

        // Radar
        const rd = el('section', 'getiri-radar'); rd.appendChild(el('h3', '', 'Banka oranları radarı'));
        rd.appendChild(el('p', 'bos', 'Bankaların güncel mevduat oranlarını buraya gir; en iyi oran ile mevcut oranların farkı yukarıda hesaplanır.'));
        const rt = el('table'), rb = el('tr'); ['Banka', 'Yıllık oran (%)', ''].forEach(x => rb.appendChild(el('th', '', x)));
        rt.appendChild(el('thead')).appendChild(rb);
        const rg = el('tbody');
        radar.forEach(o => {
          const tr = el('tr');
          const ad = el('input'); ad.value = o.banka; ad.setAttribute('aria-label', 'Banka');
          const or = el('input'); or.type = 'number'; or.step = 'any'; or.value = String(o.oran); or.setAttribute('aria-label', 'Oran');
          const sil = el('button', 'btn danger sm', 'sil'); sil.type = 'button';
          const kaydet = async () => { o.banka = ad.value.trim(); o.oran = sayi(or.value); try { await bankaOranlariniYaz(radar.filter(x => x.banka)); ciz(); } catch (e) { bildir(hataMetni(e), undefined, true); } };
          ad.addEventListener('change', kaydet); or.addEventListener('change', kaydet);
          sil.addEventListener('click', async () => { radar = radar.filter(x => x !== o); try { await bankaOranlariniYaz(radar.filter(x => x.banka)); ciz(); } catch (e) { bildir(hataMetni(e), undefined, true); } });
          const t1 = el('td'), t2 = el('td'), t3 = el('td'); t1.appendChild(ad); t2.appendChild(or); t3.appendChild(sil);
          tr.append(t1, t2, t3); rg.appendChild(tr);
        });
        rt.appendChild(rg);
        const rs = el('div', 'tablo-sarma'); rs.appendChild(rt);
        const ekle = el('button', 'btn ghost sm', '+ Banka ekle'); ekle.type = 'button'; ekle.id = 'gt-banka-ekle';
        ekle.addEventListener('click', () => { radar.push({ banka: '', oran: 0 }); ciz(); });
        rd.append(rs, ekle);
        // Getiri motoru
        const mt = el('section', 'getiri-motor'); mt.appendChild(el('h3', '', 'Getiri motoru'));
        mt.appendChild(el('p', 'bos', 'Anaparayı faize yatır; faizin ne kadarının anaparaya ekleneceğini seç. Eklenmeyen kısım harcanabilir gelir olarak çekilir.'));
        const mg = el('div', 'ic-grid');
        const mgirdi = (et: string, deger: number, degis: (n: number) => void) => {
          const l = el('label', 'alan'), i = el('input'); i.type = 'number'; i.step = 'any'; i.value = String(deger);
          i.addEventListener('change', () => { degis(sayi(i.value)); window.clearTimeout(motorBekle); motorBekle = window.setTimeout(() => void motorYaz(motor).catch(e => bildir(hataMetni(e), undefined, true)), 400); ciz(); });
          l.append(el('span', '', et), i); return l;
        };
        const mod = el('select'); mod.id = 'mt-mod';
        [['gunluk', 'Her gün anaparaya'], ['haftalik', 'Haftada X gün anaparaya'], ['aylik', 'Ayda 1 kez']].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; mod.appendChild(o); });
        mod.value = motor.mode; mod.addEventListener('change', () => { motor.mode = mod.value as Motor['mode']; void motorYaz(motor).catch(() => undefined); ciz(); });
        const ml = el('label', 'alan'); ml.append(el('span', '', 'Faiz ekleme sıklığı'), mod);
        mg.append(mgirdi('Anapara (TL)', motor.amount, n => { motor.amount = n; }), mgirdi('Yıllık faiz %', motor.rate, n => { motor.rate = n; }), mgirdi('Stopaj %', motor.stopaj, n => { motor.stopaj = n; }),
          mgirdi('Süre (ay)', motor.months, n => { motor.months = n; }), ml);
        if (motor.mode === 'haftalik') mg.appendChild(mgirdi('Haftada kaç gün (1–7)', motor.perWeek, n => { motor.perWeek = n; }));
        if (motor.mode === 'aylik') mg.appendChild(mgirdi('Faizin % kaçı anaparaya', motor.reinvest, n => { motor.reinvest = n; }));
        mt.appendChild(mg);
        const dep = varliklar.reduce((t, v) => t + sayi(v.guncel_deger ?? v.anapara), 0);
        if (dep > 0 && Math.abs(dep - motor.amount) > 1) {
          const esle = el('button', 'btn ghost sm', `Anaparayı mevduat toplamına eşitle (${tl(dep)})`); esle.type = 'button';
          esle.addEventListener('click', () => { motor.amount = Math.round(dep); void motorYaz(motor).catch(() => undefined); ciz(); }); mt.appendChild(esle);
        }
        const r = motorSim(motor), ortInc = r.rows.length ? r.income / r.rows.length : 0, ortBuyume = r.rows.length ? (r.P - r.P0) / r.rows.length : 0;
        const ms = el('div', 'icra-ozet');
        [['Dönem sonu anapara', tl(r.P), 'vurgu'], ['Ort. aylık çekilen gelir', tl(ortInc), ''], ['Ort. aylık birikim artışı', tl(ortBuyume), ''], ['Toplam net kazanç', tl(r.gain), '']].forEach(([et, d, sn]) => {
          const x = el('div', 'icra-hucre ' + sn); x.append(el('span', 'et', et!), el('b', 'gz', d!)); ms.appendChild(x);
        });
        mt.appendChild(ms);
        if (r.rows.length) {
          const t2 = el('table'), b2 = el('tr'); ['Ay', 'Brüt faiz', 'Net faiz', 'Anaparaya eklenen', 'Çekilen gelir', 'Ay sonu anapara'].forEach(x => b2.appendChild(el('th', '', x)));
          t2.appendChild(el('thead')).appendChild(b2);
          const g2 = el('tbody');
          r.rows.slice(0, 24).forEach(x => { const tr = el('tr'); tr.append(el('td', '', String(x.m))); [x.gross, x.net, x.add, x.inc, x.P].forEach(v => tr.appendChild(el('td', 'sayi gz', tl(v)))); g2.appendChild(tr); });
          t2.appendChild(g2); const s2 = el('div', 'tablo-sarma'); s2.appendChild(t2); mt.appendChild(s2);
          if (r.rows.length > 24) mt.appendChild(el('p', 'bos', 'İlk 24 ay gösteriliyor.'));
        }
        kart.replaceChildren(ozet, mt, el('h3', '', 'Mevduatlarım'), varliklar.length ? sarma : el('p', 'bos', 'Mevduat kaydı yok. Birikim › Mevduat sayfasından ekle.'), hm, rd);
      };
      ciz();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
