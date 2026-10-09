import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { donem } from '../../kabuk/donem';
import { hataMetni } from '../../veri/hata';
import { alimHesapla, aracGetir, aracYaz, sahipOlmaKarsiKira, sahipOlmaMaliyeti, kiralamaMaliyeti, type Arac } from '../../veri/arac';
import { kayitEkle } from '../../veri/kayit';
import { panelGetir } from '../../veri/panel';

const sayi = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

/* Araç: kiralık paketin bakiyesi ve kullanım kaydı + senetle araç alım planlayıcı. */
export function aracSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [arac, panel] = await Promise.all([aracGetir(), panelGetir(donem()).catch(() => null)]);
      const v: Arac = arac;
      let bekle = 0;
      const kaydet = () => { window.clearTimeout(bekle); bekle = window.setTimeout(() => void aracYaz(v).catch(e => bildir(hataMetni(e), undefined, true)), 500); };
      const girdi = (etiket: string, deger: number | string, degis: (s: string) => void, tip = 'number') => {
        const l = el('label', 'alan'), i = el('input'); i.type = tip; i.value = String(deger); if (tip === 'number') i.step = 'any';
        i.addEventListener('input', () => { degis(i.value); kaydet(); }); i.addEventListener('change', () => ciz());
        l.append(el('span', '', etiket), i); return l;
      };
      const ozetKutu = (...hucreler: [string, string, string, string?][]) => {
        const o = el('div', 'icra-ozet');
        hucreler.forEach(([et, d, n, s]) => { const x = el('div', 'icra-hucre ' + (s ?? '')); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', n)); o.appendChild(x); });
        return o;
      };

      const ciz = () => {
        const p = v.paket, ay = bugunAnahtari().slice(0, 7);
        const kmAy = p.log.filter(x => x.d.slice(0, 7) === ay).reduce((t, x) => t + x.km, 0), kmGider = kmAy * p.kmUcret;
        const bonus = p.bakiye - p.yukleme, ekKm = p.kmUcret ? Math.floor(Math.max(0, p.kalan - p.aylik) / p.kmUcret) : 0;
        const paket = el('section'); paket.appendChild(el('h3', '', 'Kiralık araç paketi'));
        paket.appendChild(ozetKutu(
          ['Aylık ücret', tl(p.aylik), `${p.ad}${p.gunlukDk ? ` · günlük ${p.gunlukDk} dk` : ''}`, 'vurgu'],
          ['Kalan bakiye', tl(p.kalan), p.yukleme ? `${tl(p.yukleme)} yükleme → ${tl(p.bakiye)} (+%${Math.round(bonus / p.yukleme * 100)})` : ''],
          ['Paket sonrası ek km', `${ekKm} km`, `km başı ${tl(p.kmUcret)}`],
          ['Bu ayki km gideri', tl(kmGider), `aylık toplam yük ${tl(p.aylik + kmGider)}`]));
        const g = el('div', 'ic-grid');
        g.append(girdi('Paket adı', p.ad, s => { p.ad = s; }, 'text'), girdi('Aylık ücret (TL)', p.aylik, s => { p.aylik = sayi(s); }), girdi('Günlük dakika', p.gunlukDk, s => { p.gunlukDk = sayi(s); }),
          girdi('km başı (TL)', p.kmUcret, s => { p.kmUcret = sayi(s); }), girdi('Yükleme tutarı (TL)', p.yukleme, s => { p.yukleme = sayi(s); }),
          girdi('Dönüşen bakiye (TL)', p.bakiye, s => { p.bakiye = sayi(s); }), girdi('Kalan bakiye (TL)', p.kalan, s => { p.kalan = sayi(s); }));
        paket.appendChild(g);
        paket.appendChild(el('h4', '', 'Kullanım kaydı'));
        const sg = el('div', 'ic-grid');
        const km = el('input'); km.type = 'number'; km.id = 'ar-km'; km.placeholder = 'km'; km.setAttribute('aria-label', 'km');
        const dk = el('input'); dk.type = 'number'; dk.id = 'ar-dk'; dk.placeholder = 'dakika'; dk.setAttribute('aria-label', 'Dakika');
        const nt = el('input'); nt.id = 'ar-not'; nt.placeholder = 'Not'; nt.setAttribute('aria-label', 'Not');
        const ekle = el('button', 'btn sm', '+ Sürüş ekle'); ekle.type = 'button'; ekle.id = 'ar-surus';
        ekle.addEventListener('click', () => {
          const k = sayi(km.value); if (!(k > 0)) { bildir('km gir', undefined, true); return; }
          p.log.unshift({ id: yeniId(), d: bugunAnahtari(), km: k, dk: sayi(dk.value), nt: nt.value.trim() });
          p.kalan = Math.max(0, p.kalan - k * p.kmUcret); kaydet(); ciz();
        });
        sg.append(km, dk, nt, ekle); paket.appendChild(sg);
        if (p.log.length) {
          const t = el('table'), bs = el('tr'); ['Tarih', 'km', 'Dakika', 'Not', 'Tutar', ''].forEach(x => bs.appendChild(el('th', '', x)));
          t.appendChild(el('thead')).appendChild(bs);
          const gv = el('tbody');
          p.log.slice(0, 30).forEach(x => {
            const tr = el('tr'), td = el('td'), sil = el('button', 'btn danger sm', 'sil'); sil.type = 'button';
            sil.addEventListener('click', () => { p.log = p.log.filter(y => y.id !== x.id); kaydet(); ciz(); }); td.appendChild(sil);
            tr.append(el('td', '', gun(x.d)), el('td', 'sayi', String(x.km)), el('td', 'sayi', String(x.dk)), el('td', '', x.nt), el('td', 'sayi gz', tl(x.km * p.kmUcret)), td); gv.appendChild(tr);
          });
          t.appendChild(gv); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); paket.appendChild(sarma);
        }

        const a = v.alim, h = alimHesapla(a), serbest = Math.max(0, panel?.serbest ?? 0);
        const alim = el('section', 'arac-alim'); alim.appendChild(el('h3', '', 'Senetle araç alım planlayıcı'));
        alim.appendChild(el('p', 'bos', 'Peşinat ve senet vadesiyle araç alımının gerçek maliyeti. Peşin (nakit) fiyatı girersen vade farkı ve gerçek aylık faiz çözülür.'));
        const ag = el('div', 'ic-grid');
        const mod = el('select'); mod.id = 'ar-mod'; [['ekle', 'Fiyata aylık faiz eklenecek'], ['dahil', 'İlan fiyatı vade farkını içeriyor']].forEach(([val, t]) => { const o = el('option', '', t); o.value = val!; mod.appendChild(o); });
        mod.value = a.mod; mod.addEventListener('change', () => { a.mod = mod.value as 'ekle' | 'dahil'; kaydet(); ciz(); });
        const ml = el('label', 'alan'); ml.append(el('span', '', 'Fiyat modeli'), mod);
        ag.append(girdi('Araç', a.ad, s => { a.ad = s; }, 'text'), girdi(a.mod === 'ekle' ? 'Baz fiyat (peşin) TL' : 'Senetli satış fiyatı TL', a.senetFiyat, s => { a.senetFiyat = sayi(s); }),
          girdi('Peşinat %', a.pesinatPct, s => { a.pesinatPct = sayi(s); }), girdi('Vade (ay)', a.vade, s => { a.vade = sayi(s); }), ml,
          girdi('Aylık faiz %', a.aylikFaiz, s => { a.aylikFaiz = sayi(s); }), girdi('Peşin (nakit) fiyat TL — biliniyorsa', a.nakitFiyat, s => { a.nakitFiyat = sayi(s); }));
        alim.appendChild(ag);
        const sigar = h.taksit <= serbest;
        alim.appendChild(ozetKutu(
          [`Peşinat (%${a.pesinatPct})`, tl(h.pesinat), ''],
          ['Aylık taksit', tl(h.taksit), `${h.ay} ay · ${sigar ? 'serbest bütçeye sığıyor' : 'serbest bütçeyi aşıyor'}`, sigar ? 'vurgu' : 'uyari'],
          ['Toplam ödeme', tl(h.toplamOdeme), h.dahil ? `peşinat + ${h.ay} senet` : 'peşinat + faizli taksitler'],
          ['Vade farkı', h.nakit > 0 ? tl(h.gercekMaliyet) : '?', h.nakit > 0 ? 'peşin fiyata göre' : 'peşin fiyatı gir'],
          ['Gerçek aylık faiz', h.faiz > 0 ? `%${h.faiz.toFixed(2)}` : '?', h.faiz > 0 ? `yıllık etkin %${h.yillikEtkin.toFixed(1)}` : 'peşin fiyat olmadan çözülemez']));
        const kir = p.aylik + kmGider;
        alim.appendChild(el('p', 'bos', `Mevcut pakete karşı: aylık nakit çıkışı ${tl(kir)} (kira) ↔ ${tl(h.taksit)} (senet), peşin gereken ${tl(p.yukleme)} ↔ ${tl(h.pesinat)}. `
          + 'Kasko, MTV, bakım ve yakıt bu karşılaştırmaya dahil değildir; sahip olmayı olduğundan ucuz gösterir.'));
        const plan = el('button', 'btn sm', 'Alınacaklar\'a ekle'); plan.type = 'button'; plan.id = 'ar-alinacak';
        plan.addEventListener('click', async () => {
          plan.disabled = true;
          try {
            await kayitEkle('alinacaklar', ['ad', 'tahmini_tutar', 'notlar', 'durum'], { ad: `${a.ad} (senetli)`.slice(0, 160), tahmini_tutar: Math.round(h.toplamOdeme), durum: 'karar',
              notlar: `${h.ay} ay · peşinat ${tl(h.pesinat)} · aylık ${tl(h.taksit)}` });
            bildir('Alınacaklar listesine eklendi');
          } catch (e) { bildir(hataMetni(e), undefined, true); }
          plan.disabled = false;
        });
        alim.appendChild(plan);
        // Toplam sahip olma maliyeti
        const T = sahipOlmaMaliyeti(v.maliyet), m = v.maliyet;
        const tco = el('section'); tco.appendChild(el('h3', '', 'Toplam sahip olma maliyeti'));
        tco.appendChild(el('p', 'bos', `Aracın maliyeti taksit değildir. Taksit bittiğinde bile yılda ${tl(T.yillik)} gider sürer. Varsayımlar piyasa ortalamasıdır; kendi tekliflerinle değiştir.`));
        tco.appendChild(ozetKutu(['Yıllık sahip olma gideri', tl(T.yillik), `aylık ${tl(T.aylik)}`, 'vurgu'], ['Taksit + gider', tl(h.taksit + T.aylik), 'senet süresince aylık'], ['Km başına', tl(T.kmBasi), `${m.yilKm.toLocaleString('tr-TR')} km/yıl`]));
        const tt = el('table'), tb = el('tr'); ['Kalem', 'Yıllık', 'Aylık'].forEach(x => tb.appendChild(el('th', '', x)));
        tt.appendChild(el('thead')).appendChild(tb); const tg = el('tbody');
        T.kalem.forEach(([k, d]) => { const tr = el('tr'); tr.append(el('td', '', k), el('td', 'sayi gz', tl(d)), el('td', 'sayi', tl(d / 12))); tg.appendChild(tr); });
        tt.appendChild(tg); const ts = el('div', 'tablo-sarma'); ts.appendChild(tt); tco.appendChild(ts);
        const mgr = el('div', 'ic-grid');
        mgr.append(girdi('Yıllık km', m.yilKm, s => { m.yilKm = sayi(s); }), girdi('Tüketim (lt/100 km)', m.yakitTuketim, s => { m.yakitTuketim = sayi(s); }), girdi('Yakıt (TL/lt)', m.yakitFiyat, s => { m.yakitFiyat = sayi(s); }),
          girdi('Kasko (yıllık)', m.kasko, s => { m.kasko = sayi(s); }), girdi('Zorunlu trafik', m.trafik, s => { m.trafik = sayi(s); }), girdi('MTV', m.mtv, s => { m.mtv = sayi(s); }),
          girdi('Periyodik bakım', m.bakim, s => { m.bakim = sayi(s); }), girdi('Lastik takımı', m.lastik, s => { m.lastik = sayi(s); }), girdi('Otopark (aylık)', m.otopark, s => { m.otopark = sayi(s); }));
        tco.appendChild(mgr);

        // Değer kaybı ve kiralama
        const ks = sahipOlmaKarsiKira(v, 5), K = kiralamaMaliyeti(v.kira, v.maliyet), donum = ks.find(x => x.fark <= 0);
        const kr = el('section'); kr.appendChild(el('h3', '', 'Değer kaybı ve uzun dönem kiralama'));
        kr.appendChild(el('p', 'bos', 'Sahip olmak mı uzun dönem kiralamak mı ucuz? "Sahip olma (net)": o yılın sonunda aracı elden çıkarırsan cebinden çıkan net tutar (ödenen taksitler + kalan senet borcu + sahip olma gideri − elde kalan değer). Karşılaştırma bugünkü paranın alım gücüyle yapılır.'));
        const kt = el('table'), kb = el('tr'); ['Yıl', 'Reel değer', 'Nominal etiket', 'Değer kaybı', 'Kalan senet', 'Sahip olma (net)', 'Kiralama', 'Fark'].forEach(x => kb.appendChild(el('th', '', x)));
        kt.appendChild(el('thead')).appendChild(kb); const kg = el('tbody');
        ks.forEach(x => { const tr = el('tr'); tr.append(el('td', '', `${x.yil}. yıl`), el('td', 'sayi gz', tl(x.reel)), el('td', 'sayi', tl(x.nominal)), el('td', 'sayi', `−${tl(x.kayip)} (%${x.kayipPct})`),
          el('td', 'sayi', x.kalanBorc ? tl(x.kalanBorc) : '—'), el('td', 'sayi gz', tl(x.sahipNet)), el('td', 'sayi gz', tl(x.kiraNet)), el('td', 'sayi', `${x.fark <= 0 ? 'sahip olmak' : 'kiralamak'} ${tl(Math.abs(x.fark))} ucuz`)); kg.appendChild(tr); });
        kt.appendChild(kg); const ksr = el('div', 'tablo-sarma'); ksr.appendChild(kt); kr.appendChild(ksr);
        kr.appendChild(el('p', 'bos', donum ? `${donum.yil}. yıldan itibaren sahip olmak öne geçiyor; araç en az o kadar tutulacaksa senet mantıklı.` : 'Beş yıl boyunca kiralama önde kalıyor; bu tekliflerle satın almanın maliyet gerekçesi yok.'));
        const kgr = el('div', 'ic-grid');
        kgr.append(girdi('Uzun dönem kiralama (aylık TL)', v.kira.aylik, s => { v.kira.aylik = sayi(s); }), girdi('Aylık km limiti', v.kira.kmLimit, s => { v.kira.kmLimit = sayi(s); }),
          girdi('Aşım ücreti (TL/km)', v.kira.asimUcret, s => { v.kira.asimUcret = sayi(s); }), girdi('Enflasyon varsayımı %', v.enflasyon, s => { v.enflasyon = sayi(s); }));
        kr.appendChild(kgr);
        kr.appendChild(el('p', 'bos', `Yıllık ${m.yilKm.toLocaleString('tr-TR')} km'de kiralama limiti ${K.limitYil.toLocaleString('tr-TR')} km; aşım ${K.asimKm.toLocaleString('tr-TR')} km → ${tl(K.asim)} ek ücret. Yakıt (${tl(K.yakit)}) iki tarafta da kiracıya ait.`));
        kart.replaceChildren(paket, alim, tco, kr);
      };
      ciz();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
