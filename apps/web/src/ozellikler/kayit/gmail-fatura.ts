import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { kayitEkle, kayitlariGetir } from '../../veri/kayit';
import {
  baglimi, faturaAdaylariniBul, gmailBaglan, islenenleriGetir, islenenleriYaz, istemciKimligiGetir, istemciKimligiYaz, type FaturaAdayi,
} from '../../veri/gmail';

const GIDER_SUTUN = ['ad', 'tur', 'periyot', 'tutar', 'para_birimi', 'gun', 'baslangic', 'aktif', 'notlar'];

/* Gmail faturaları: son iletilerde fatura, ekstre ve son ödeme bildirimlerini bulur; seçtiklerini fatura olarak ekler. */
export function gmailFaturaSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  let istemci = '', adaylar: FaturaAdayi[] = [], islenen = new Set<string>(), mevcutlar: { ad: string; tutar: number; baslangic: string }[] = [];
  let yukleniyor = false, hata = '', gunSayisi = 45;

  const mevcutMu = (a: FaturaAdayi) => mevcutlar.some(m => a.tutar !== null && Math.abs(m.tutar - a.tutar) < 0.01 && m.baslangic === (a.vade ?? a.tarih));

  function ciz() {
    const ust = el('div', 'tbar');
    const kimlik = el('input'); kimlik.id = 'gm-kimlik'; kimlik.value = istemci; kimlik.placeholder = 'Google OAuth istemci kimliği (….apps.googleusercontent.com)'; kimlik.setAttribute('aria-label', 'Google OAuth istemci kimliği');
    kimlik.addEventListener('change', async () => {
      istemci = kimlik.value.trim();
      try { await istemciKimligiYaz(istemci); bildir('Kaydedildi'); } catch (e) { bildir(hataMetni(e), undefined, true); }
    });
    const gunSec = el('select'); gunSec.id = 'gm-gun'; gunSec.setAttribute('aria-label', 'Kaç günlük iletiler');
    [[14, 'Son 14 gün'], [45, 'Son 45 gün'], [90, 'Son 90 gün']].forEach(([v, a]) => { const o = el('option', '', String(a)); o.value = String(v); gunSec.appendChild(o); });
    gunSec.value = String(gunSayisi); gunSec.addEventListener('change', () => { gunSayisi = Number(gunSec.value); });
    const tara = el('button', 'btn primary sm', baglimi() ? 'Faturaları tara' : 'Gmail\'e bağlan ve tara'); tara.type = 'button'; tara.id = 'gm-tara'; tara.disabled = yukleniyor || !istemci;
    tara.addEventListener('click', () => void tarat());
    ust.append(kimlik, gunSec, el('span', 'tbar-sp'), tara);

    const notu = el('p', 'bos', istemci ? 'Yalnız okuma izni istenir; iletiler değiştirilmez ya da silinmez. Bağlantı yalnız bu sayfa açıkken bellekte tutulur.'
      : 'Önce Google Cloud\'da bir OAuth istemci kimliği (Web uygulaması) oluşturup bu sitenin adresini "Yetkili JavaScript kaynakları" listesine ekle, kimliği yukarıya yapıştır. Gmail API\'si de etkin olmalı.');
    const govde = el('div');
    if (hata) govde.appendChild(el('p', 'bos hata', hata));
    else if (yukleniyor) govde.appendChild(el('p', 'bos', 'Gmail taranıyor…'));
    else if (!adaylar.length) govde.appendChild(el('p', 'bos', baglimi() ? 'Fatura benzeri ileti bulunamadı.' : ''));
    else {
      const t = el('table'), bs = el('tr');
      ['Gönderen', 'Konu', 'Tutar', 'Son ödeme', 'Tür', ''].forEach(x => bs.appendChild(el('th', '', x)));
      t.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody');
      adaylar.forEach(a => {
        const tr = el('tr');
        const eklendi = islenen.has(a.id) || mevcutMu(a);
        const dugme = el('button', 'btn sm', eklendi ? 'Eklendi' : 'Gider ekle'); dugme.type = 'button'; dugme.disabled = eklendi || a.tutar === null;
        dugme.addEventListener('click', async () => {
          dugme.disabled = true;
          try {
            const vade = a.vade ?? a.tarih;
            const k = await kayitEkle('giderler', GIDER_SUTUN, { ad: `${a.gonderen}`.slice(0, 120), tur: 'fatura', periyot: 'tek_sefer', tutar: a.tutar, para_birimi: a.paraBirimi,
              gun: Number(vade.slice(8, 10)), baslangic: vade, aktif: true, notlar: `Gmail: ${a.konu}${a.faturaNo ? ` · ${a.faturaNo}` : ''}`.slice(0, 1900) });
            islenen.add(a.id); mevcutlar.push({ ad: String(k.ad), tutar: a.tutar!, baslangic: vade });
            await islenenleriYaz([...islenen]); ciz(); bildir('Fatura eklendi');
          } catch (e) { dugme.disabled = false; bildir(hataMetni(e), undefined, true); }
        });
        const td = el('td'); td.appendChild(dugme);
        tr.append(el('td', '', a.gonderen), el('td', '', a.konu.slice(0, 80)), el('td', 'sayi gz', a.tutar === null ? '—' : a.paraBirimi === 'TRY' ? tl(a.tutar) : `${a.tutar} ${a.paraBirimi}`),
          el('td', '', a.vade ? gun(a.vade) : gun(a.tarih) + ' (ileti)'), el('td', '', a.kategori), td);
        g.appendChild(tr);
      });
      t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); govde.appendChild(sarma);
    }
    kart.replaceChildren(ust, notu, govde);
  }

  async function tarat() {
    hata = ''; yukleniyor = true; ciz();
    try {
      if (!baglimi()) await gmailBaglan(istemci);
      adaylar = (await faturaAdaylariniBul(gunSayisi)).filter(a => a.tutar !== null).sort((x, y) => y.tarih.localeCompare(x.tarih));
    } catch (e) { hata = e instanceof Error ? e.message : hataMetni(e); }
    yukleniyor = false; ciz();
  }

  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [id, islenenler, giderler] = await Promise.all([istemciKimligiGetir(), islenenleriGetir(), kayitlariGetir('giderler', GIDER_SUTUN, { tur: 'fatura' }, 'ad')]);
      istemci = id; islenen = new Set(islenenler);
      mevcutlar = giderler.map(k => ({ ad: String(k.ad), tutar: Number(k.tutar), baslangic: String(k.baslangic ?? '') }));
    } catch (e) { hata = hataMetni(e); }
    ciz();
  })();
}
