import { el } from '../../ortak/dom';
import { tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir } from '../../veri/kayit';
import { simule, type SimBorc, type SimSonuc } from './hesap';
import { donem } from '../../kabuk/donem';
import { aylikEsdeger } from '../../veri/danisman';
import { ayarOku, ayarYaz } from '../../veri/karsilama';
import { panelGetir } from '../../veri/panel';

const AY = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const aySonra = (k: number) => AY.format(new Date(new Date().getFullYear(), new Date().getMonth() + k, 1));
const sureYaz = (ay: number | null) => (ay === null ? 'kapanmıyor' : ay === 0 ? 'borç yok' : `${ay} ay · ${aySonra(ay)}`);

type Satir = SimBorc & { dahil: boolean };

/* Borçsuzluğa en kısa yol: son kapanan borç yolun uzunluğunu belirler; günlük faiz kanaması sıralamayı belirler. */
function kritikYol(secili: Satir[], r: SimSonuc): HTMLElement {
  const kutu = el('div', 'kritik-yol');
  kutu.appendChild(el('h3', '', 'Kritik yol'));
  const sirali = secili.filter(s => r.kapanis.has(s.id)).sort((a, b) => r.kapanis.get(a.id)! - r.kapanis.get(b.id)!);
  const acik = secili.filter(s => !r.kapanis.has(s.id));
  const son = sirali[sirali.length - 1];
  const ozet = el('div', 'icra-ozet');
  const hucre = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
  hucre('Toplam süre', r.ay === null ? 'plan yürümüyor' : sureYaz(r.ay), `${tl(secili.reduce((t, s) => t + s.bakiye, 0))} borç`, r.ay === null ? 'uyari' : 'vurgu');
  hucre('Yolun sonu', son ? son.ad : '—', son ? `${r.kapanis.get(son.id)}. ay sonra kapanıyor` : '');
  hucre('Kapanmayan borç', String(acik.length), acik.length ? 'bütçe yetmiyor' : 'hepsi kapanıyor', acik.length ? 'uyari' : '');
  kutu.appendChild(ozet);

  const tablo = (baslik: string, kolonlar: string[], satirlar: string[][], bos: string) => {
    const k = el('div', 'kritik-kolon'); k.appendChild(el('h4', '', baslik));
    if (!satirlar.length) { k.appendChild(el('p', 'bos', bos)); return k; }
    const t = el('table'), bs = el('tr'); kolonlar.forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody'); satirlar.forEach(sat => { const tr = el('tr'); sat.forEach((c, i) => tr.appendChild(el('td', i ? 'sayi' : '', c))); g.appendChild(tr); });
    t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); k.appendChild(sarma); return k;
  };
  const kanama = secili.filter(s => s.faizYillik > 0).map(s => ({ s, gunluk: s.bakiye * s.faizYillik / 100 / 365 })).sort((a, b) => b.gunluk - a.gunluk).slice(0, 6);
  const iki = el('div', 'kritik-iki');
  iki.append(
    tablo('İlk kapanan beş borç', ['#', 'Borç', 'Kapanış'], sirali.slice(0, 5).map((s, i) => [String(i + 1), s.ad, `${r.kapanis.get(s.id)}. ay`]), 'Kapanan borç yok.'),
    tablo('Günlük faiz kanaması', ['Borç', 'Günlük', 'Yıllık'], kanama.map(x => [x.s.ad, tl(x.gunluk), `%${x.s.faizYillik.toLocaleString('tr-TR')}`]), 'Faizli borç yok.'));
  kutu.appendChild(iki);
  return kutu;
}

/* "Ne olursa" paneli: gelir ve çıkışlar değişirse serbest bütçe ve kasanın dayanma süresi ne olur. */
type NeOlursa = { gelir: number; sabitGelir: number; kiraGeliri: number; gider: number; serbest: number; nakit: number };
async function neOlursaVerisi(): Promise<NeOlursa> {
  const [panel, gelirler, hesaplar, hareketler] = await Promise.all([
    panelGetir(donem()),
    kayitlariGetir('gelirler', ['ad', 'tur', 'sabit', 'periyot', 'tutar', 'aktif'], {}, 'ad'),
    kayitlariGetir('hesaplar', ['tur', 'acilis_bakiyesi', 'aktif'], {}, 'ad'),
    kayitlariGetir('hareketler', ['hesap_id', 'yon', 'tutar'], {}, 'tarih'),
  ]);
  const aktif = gelirler.filter(g => g.aktif !== false && g.sabit);
  const vadesiz = new Set(hesaplar.filter(h => h.tur === 'vadesiz' && h.aktif !== false).map(h => h.id));
  const nakit = hesaplar.filter(h => vadesiz.has(h.id)).reduce((t, h) => t + Number(h.acilis_bakiyesi), 0)
    + hareketler.filter(h => vadesiz.has(String(h.hesap_id))).reduce((t, h) => t + (h.yon === 'giris' ? 1 : -1) * Number(h.tutar), 0);
  return {
    gelir: panel.gelir, sabitGelir: aktif.reduce((t, g) => t + aylikEsdeger(g), 0), nakit, gider: panel.gider, serbest: panel.serbest,
    kiraGeliri: aktif.filter(g => /kira/i.test(String(g.ad)) || g.tur === 'kira').reduce((t, g) => t + aylikEsdeger(g), 0),
  };
}
type Stres = { ay: number; gelirDusus: number };
function neOlursaKarti(v: NeOlursa, stres: Stres, stresDegisti: (s: Stres) => void): HTMLElement {
  const kutu = el('div', 'kritik-yol');
  kutu.appendChild(el('h3', '', '"Ne olursa" paneli'));
  kutu.appendChild(el('p', 'bos', `Taban: bu ayın serbest bütçesi ${tl(v.serbest)}. Her satır aynı hesabı tek bir şokla yeniden yapar.`));
  const t = el('table'), bs = el('tr'); ['Senaryo', 'Serbest bütçe', 'Değişim', 'Not'].forEach(x => bs.appendChild(el('th', '', x)));
  t.appendChild(el('thead')).appendChild(bs);
  const g = el('tbody');
  const satir = (ad: string, kayip: number, not: string) => {
    const serbest = v.serbest - kayip, tr = el('tr');
    tr.append(el('td', '', ad), el('td', 'sayi gz', tl(serbest)), el('td', 'sayi', kayip ? `−${tl(kayip)}` : '—'), el('td', '', not + (serbest < 0 ? ' · bütçe açığa düşer' : '')));
    g.appendChild(tr);
  };
  satir('Maaş/ücret gelirine haciz (1/4)', v.sabitGelir * 0.25, 'İİK 83: gelirin dörtte biri kesilir');
  satir('Kira geliri kesilirse', v.kiraGeliri, v.kiraGeliri ? 'kira kalemleri sabit gelirden çıkarılır' : 'kira geliri kaydı yok');
  satir(`Sabit gelir %${stres.gelirDusus} düşerse`, v.sabitGelir * stres.gelirDusus / 100, 'aşağıdaki oranı değiştirebilirsin');
  t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); kutu.appendChild(sarma);

  const cikis = v.gider, hic = v.gelir * (1 - stres.gelirDusus / 100);
  const acik = Math.max(0, cikis - hic), dayanma = acik > 0 ? v.nakit / acik : Infinity;
  const g2 = el('div', 'ic-grid');
  const oran = el('input'); oran.type = 'number'; oran.min = '0'; oran.max = '100'; oran.value = String(stres.gelirDusus); oran.id = 'ne-oran'; oran.setAttribute('aria-label', 'Gelir düşüşü yüzdesi');
  oran.addEventListener('change', () => stresDegisti({ ...stres, gelirDusus: Math.min(100, Math.max(0, Number(oran.value) || 0)) }));
  const l = el('label', 'alan'); l.append(el('span', '', 'Gelir düşüşü (%)'), oran); g2.appendChild(l);
  kutu.appendChild(g2);
  kutu.appendChild(el('p', 'bos', `Stres testi: gelir %${stres.gelirDusus} düşer, çıkışlar (${tl(cikis)}) aynı kalırsa aylık açık ${tl(acik)}. Vadesiz hesaplarda ${tl(v.nakit)} var → `
    + (acik <= 0 ? 'açık oluşmaz.' : `yaklaşık ${dayanma.toFixed(1).replace('.', ',')} ay dayanır${dayanma < stres.ay ? ` (hedef ${stres.ay} ay; yastık yetersiz)` : ''}.`)));
  return kutu;
}

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
      const neOlursa = el('div');
      let stres: Stres = { ay: 3, gelirDusus: 25 };
      const stresKaydet = () => ayarYaz('simulasyon_stres', stres).catch(() => undefined);
      const neCiz = async () => {
        try {
          const [veri, kayitli] = await Promise.all([neOlursaVerisi(), ayarOku<Partial<Stres>>('simulasyon_stres')]);
          stres = { ...stres, ...(kayitli?.deger ?? {}) };
          neOlursa.replaceChildren(neOlursaKarti(veri, stres, y => { stres = y; void stresKaydet(); void neCiz(); }));
        } catch (e) { neOlursa.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
      };
      void neCiz();
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
        sonuc.replaceChildren(kutular, sarma, aciklama, kritikYol(secili, cig), neOlursa);
      };

      ekGiris.addEventListener('input', () => { ek = Math.max(0, Number(ekGiris.value) || 0); hesapla(); });
      tabloCiz(); hesapla();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
