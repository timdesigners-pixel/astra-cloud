import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { tl } from '../../ortak/bicim';
import { bugunAnahtari } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import { kayitlariGetir, type Kayit } from '../../veri/kayit';
import { icraDosyalariniGetir, gecerliBakiye, type IcraDosyasi } from '../../veri/icra';
import { ibanlariGetir, type Iban } from '../../veri/iban';
import { kisileriGetir, type Kisi } from '../../veri/kisiler';
import { acilKisileriGetir, acilKisileriYaz, type AcilKisi } from '../../veri/acil';
import { sabitleriGetir, imzaGetir } from '../../veri/sabitler';
import { gunFarki, imzaDurumu, sureler, siradakiYukumluluk, type Imza, type Yukumluluk } from '../../veri/sureler';
import './acil-kart.css';

const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const sayi = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

type Veri = {
  kisiler: AcilKisi[]; rehber: Kisi[]; icra: IcraDosyasi[]; ibanlar: Iban[]; davalar: Kayit[]; odemeler: Kayit[]; borclar: Map<string, string>;
  sabitler: Yukumluluk[]; imza: Imza;
};
type Tarih = { tur: string; konu: string; kalan: number; not: string };
type Taksit = { ad: string; toplam: number; adet: number; vade: string; kalan: number };

/* Kartın ham sayıları: yazdırma ve ekrandaki özet aynı hesaptan beslenir. */
export function acilHesapla(v: Veri, bugun: string) {
  const tarihler: Tarih[] = [];
  v.davalar.filter(d => d.durum !== 'kapandi' && d.sonraki_durusma).forEach(d => {
    const k = gunFarki(String(d.sonraki_durusma), bugun);
    if (k >= 0 && k <= 30) tarihler.push({ tur: 'Duruşma', konu: `${d.konu ?? d.mahkeme ?? 'Dava'}`, kalan: k, not: String(d.mahkeme ?? '') });
  });
  v.icra.filter(d => d.durum !== 'kapandi' && d.tebligat_tarihi).forEach(d => {
    sureler(d.takip_turu, d.tebligat_tarihi, bugun).filter(s => s.kalan >= 0 && s.kalan <= 30)
      .forEach(s => tarihler.push({ tur: `${s.ad}`, konu: `${d.karsi_taraf ?? ''} — ${d.dosya_no ?? ''}`, kalan: s.kalan, not: `${s.gun} günlük süre · ${d.takip_turu ?? ''}` }));
  });
  v.sabitler.filter(y => y.aktif).forEach(y => {
    const s = siradakiYukumluluk(y, bugun);
    if (s.kalan <= 30) tarihler.push({ tur: 'Sabit tarih', konu: y.ad, kalan: s.kalan, not: `Her ayın ${y.gun}. günü` });
  });
  if (v.imza.aktif) {
    const i = imzaDurumu(v.imza, bugun.slice(0, 7), bugun);
    if (i.durum !== 'imzalandi') tarihler.push({ tur: 'İmza', konu: 'Karakol imzası', kalan: Math.max(0, i.kalan), not: i.durum === 'kacirildi' ? 'Bu ayın imzası işaretlenmemiş' : 'Ayın imza günü' });
  }
  tarihler.sort((a, b) => a.kalan - b.kalan);

  const grup = new Map<string, Taksit>();
  v.odemeler.filter(o => o.durum === 'bekliyor').forEach(o => {
    const kalan = gunFarki(String(o.vade_tarihi), bugun);
    if (kalan > 30) return;
    const ad = v.borclar.get(String(o.borc_id)) ?? 'Ödeme';
    const anahtar = `${ad}|${o.vade_tarihi}`;
    const g = grup.get(anahtar) ?? { ad, toplam: 0, adet: 0, vade: String(o.vade_tarihi), kalan };
    g.toplam += sayi(o.tutar); g.adet++; grup.set(anahtar, g);
  });
  const taksitler = [...grup.values()].sort((a, b) => a.kalan - b.kalan || b.toplam - a.toplam);
  const dosyalar = v.icra.filter(d => gecerliBakiye(d) > 0).sort((a, b) => gecerliBakiye(b) - gecerliBakiye(a)).slice(0, 12);
  const kritik = tarihler.filter(t => t.kalan <= 7).length;
  return { tarihler, taksitler, dosyalar, kritik, taksitToplam: taksitler.reduce((t, x) => t + x.toplam, 0) };
}

const g = (k: number) => (k <= 0 ? 'BUGÜN' : `${k} gün`);

function yazdirHtml(v: Veri, bugun: string): HTMLElement {
  const h = acilHesapla(v, bugun);
  const kok = el('div', 'acil-yazdir');
  const bolum = (no: number, ad: string) => { const x = el('h2'); x.append(el('span', '', String(no)), ad); return x; };
  const tablo = (basliklar: string[], satirlar: string[][]) => {
    const t = el('table'), bs = el('tr'); basliklar.forEach(b => bs.appendChild(el('th', '', b))); t.appendChild(el('thead')).appendChild(bs);
    const gv = el('tbody'); satirlar.forEach(s => { const tr = el('tr'); s.forEach(c => tr.appendChild(el('td', '', c))); gv.appendChild(tr); }); t.appendChild(gv); return t;
  };
  const bas = el('div', 'ak-bas');
  const sol = el('div'); sol.append(el('div', 'ak-ust', 'ASTRA FİNANS OS · GİZLİ BELGE'), el('h1', '', 'Acil Durum Kartı'), el('div', 'ak-alt', 'Ben ulaşılamaz durumdayken ilk 72 saatte yapılacaklar'));
  const damga = el('div', 'ak-damga', 'KAPALI ZARFTA SAKLAYIN'); damga.appendChild(el('small', '', new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })));
  bas.append(sol, damga);
  const kpi = el('div', 'ak-kpi');
  [['7 gün içinde kritik', String(h.kritik), 'süre, duruşma, sabit tarih'], ['30 günde ödeme', tl(h.taksitToplam), `${h.taksitler.length} kalem`], ['Açık icra dosyası', String(h.dosyalar.length), 'en büyük bakiyeliler']]
    .forEach(([et, d, n]) => { const x = el('div'); x.append(el('i', '', et), el('b', '', d), el('em', '', n)); kpi.appendChild(x); });

  const adimlar = el('ol', 'ak-adim');
  ['Tarihlere bak. Aşağıdaki tabloda 7 günden az kalan varsa önce onunla ilgilen; icra süresi kaçınca geri alınamaz.',
    'Alacaklı vekilini ara. Durumu bildir; süre ya da taksit talebini yazılı ilet.',
    'Taksiti aksatma. Tecilde tek taksit kaçarsa plan bozulur, bakiyenin tamamı muaccel olabilir.',
    'Veriye ulaş. Uygulama › Sistem › Yedeği indir. Giriş PIN ile yapılır; PIN bilinmiyorsa veri açılamaz.',
  ].forEach(m => { const li = el('li'); const [b, ...r] = m.split('. '); li.append(el('b', '', b + '. '), r.join('. ')); adimlar.appendChild(li); });
  const s1 = el('section'); s1.append(bolum(1, 'İlk 72 saat'), adimlar);

  const s2 = el('section'); s2.appendChild(bolum(2, 'Kime ulaşılmalı'));
  const kisi = v.kisiler.filter(x => x.ad.trim());
  if (kisi.length) {
    const ul = el('ul', 'ak-kisi');
    kisi.forEach(x => { const li = el('li'); li.append(el('b', '', x.ad)); if (x.rol) li.append(' ', el('em', '', x.rol)); if (x.tel) li.append(' ', el('span', 'ak-mono', x.tel)); if (x.adres) li.append(el('small', '', x.adres)); ul.appendChild(li); });
    s2.appendChild(ul);
  } else s2.appendChild(el('p', 'ak-bos', 'Güvendiğim kişi: ______________________'));
  const avukatlar = [...new Set(v.icra.map(d => v.rehber.find(k => k.id === d.avukat_id)).filter((k): k is Kisi => !!k).map(k => `${k.ad}${k.telefon ? ' · ' + k.telefon : ''}`))];
  if (avukatlar.length) { const ul = el('ul', 'ak-kisi'); avukatlar.slice(0, 6).forEach(a => ul.appendChild(el('li', '', a))); s2.append(el('h3', '', 'İcra avukatları'), ul); }
  s2.appendChild(el('p', 'ak-bos', 'PIN / parola nerede: ______________________'));

  const ust = el('div', 'ak-iki'); ust.append(s1, s2);
  const s3 = el('section'); s3.appendChild(bolum(3, 'Süresi kaçmaması gereken tarihler (30 gün)'));
  s3.appendChild(h.tarihler.length ? tablo(['Tür', 'Konu', 'Kalan', 'Not'], h.tarihler.map(t => [t.tur, t.konu, g(t.kalan), t.not]))
    : el('p', 'ak-bos', '30 gün içinde kayıtlı tarih yok. Bu, süre olmadığı anlamına gelmez; tebliğ tarihleri girilmemiş olabilir.'));
  const s4 = el('section'); s4.appendChild(bolum(4, '30 gün içindeki ödemeler'));
  s4.appendChild(h.taksitler.length ? tablo(['Kalem', 'Tutar', 'Vade', 'Kalan'], h.taksitler.map(t => [`${t.ad}${t.adet > 1 ? ` (${t.adet} adet)` : ''}`, tl(t.toplam), t.vade, g(t.kalan)]))
    : el('p', 'ak-bos', '30 gün içinde bekleyen ödeme yok.'));
  const s5 = el('section'); s5.appendChild(bolum(5, 'Açık icra dosyaları'));
  s5.appendChild(h.dosyalar.length ? tablo(['Dosya no', 'Daire', 'Karşı taraf', 'Bakiye'], h.dosyalar.map(d => [d.dosya_no ?? '', d.icra_dairesi ?? '', d.karsi_taraf ?? '', tl(gecerliBakiye(d))]))
    : el('p', 'ak-bos', 'Bakiyesi olan açık icra dosyası yok.'));
  const s6 = el('section'); s6.appendChild(bolum(6, 'Benim IBAN\'larım'));
  const kendi = v.ibanlar.filter(i => i.sahip_turu === 'kendim');
  s6.appendChild(kendi.length ? tablo(['Etiket', 'Banka', 'IBAN'], kendi.map(i => [i.etiket ?? '', i.banka ?? '', i.iban])) : el('p', 'ak-bos', 'Kayıtlı IBAN yok.'));
  const alt = el('div', 'ak-alt-not', 'Bu kartta dosya numaraları ve IBAN\'lar açık yazar. Yazdırdığın kopyanın kimde duracağına ona göre karar ver. Ödeme öncesi UYAP doğrulaması yapılmalıdır.');
  kok.append(bas, kpi, ust, s3, s4, s5, s6, alt);
  return kok;
}

export function acilKartSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card acil');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const [kisiler, rehber, icra, ibanlar, davalar, odemeler, borclar, sabitler, imza] = await Promise.all([
        acilKisileriGetir(), kisileriGetir(), icraDosyalariniGetir(), ibanlariGetir(),
        kayitlariGetir('davalar', ['tur', 'konu', 'mahkeme', 'durum', 'sonraki_durusma'], {}, 'sonraki_durusma'),
        kayitlariGetir('odemeler', ['borc_id', 'vade_tarihi', 'tutar', 'durum'], { durum: 'bekliyor' }, 'vade_tarihi'),
        kayitlariGetir('borclar', ['ad'], {}, 'ad'), sabitleriGetir(), imzaGetir(),
      ]);
      const v: Veri = { kisiler, rehber, icra, ibanlar, davalar, odemeler, borclar: new Map(borclar.map(b => [b.id, String(b.ad)])), sabitler, imza };
      const bugun = bugunAnahtari();
      const liste = [...kisiler];

      const ciz = () => {
        const h = acilHesapla({ ...v, kisiler: liste }, bugun);
        const ozet = el('div', 'icra-ozet');
        const hucre = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
        hucre('7 gün içinde kritik', String(h.kritik), 'süre, duruşma, sabit tarih, imza', h.kritik ? 'uyari' : '');
        hucre('30 günde ödeme', tl(h.taksitToplam), `${h.taksitler.length} kalem`);
        hucre('Karta girecek dosya', String(h.dosyalar.length), 'en büyük bakiyeliler');

        const aciklama = el('p', 'bos', 'Sen ulaşılamaz durumdayken (hastane, gözaltı, seyahat) süreler kaçmasın diye tek sayfalık bir kart: ilk 72 saatte ne yapılmalı, kime ulaşılmalı, hangi tarih kaçmamalı. Yazdır, kapalı bir zarfta güvendiğin kişide dursun.');
        const uyari = el('p', 'bos hata', 'Kartta dosya numaraları, IBAN\'lar ve tutarlar açık yazar. Gizlilik modu açıksa önce kapat.');

        const baslik = el('h3', '', `Kime ulaşılmalı · ${liste.length} kişi`);
        const dl = el('datalist'); dl.id = 'acil-oneri';
        rehber.filter(k => k.tur === 'kisi').forEach(k => { const o = el('option'); o.value = k.ad; dl.appendChild(o); });
        const tablo = el('table'), bs = el('tr');
        ['Ad Soyad', 'Yakınlık', 'Telefon', 'Adres', ''].forEach(x => bs.appendChild(el('th', '', x)));
        tablo.appendChild(el('thead')).appendChild(bs);
        const gv = el('tbody');
        liste.forEach(k => {
          const tr = el('tr');
          const alan = (f: 'ad' | 'rol' | 'tel' | 'adres', ph: string) => {
            const i = el('input'); i.value = k[f]; i.placeholder = ph; i.setAttribute('aria-label', ph); if (f === 'ad') i.setAttribute('list', 'acil-oneri'); if (f === 'tel') i.type = 'tel';
            i.addEventListener('change', () => {
              k[f] = i.value.trim();
              if (f === 'ad' && !k.tel) { const r = rehber.find(x => x.ad === k.ad); if (r?.telefon) { k.tel = r.telefon; ciz(); } }
              void kaydet();
            });
            const td = el('td'); td.appendChild(i); return td;
          };
          const sil = el('button', 'btn danger sm', 'sil'); sil.type = 'button';
          sil.addEventListener('click', () => { liste.splice(liste.indexOf(k), 1); ciz(); void kaydet(); });
          const tdS = el('td'); tdS.appendChild(sil);
          tr.append(alan('ad', 'Ad Soyad'), alan('rol', 'Yakınlık'), alan('tel', 'Telefon'), alan('adres', 'Adres'), tdS);
          gv.appendChild(tr);
        });
        tablo.appendChild(gv);
        const sarma = el('div', 'tablo-sarma'); sarma.appendChild(tablo);
        const ekle = el('button', 'btn ghost sm', '+ Kişi ekle'); ekle.type = 'button'; ekle.id = 'acil-ekle';
        ekle.addEventListener('click', () => { liste.push({ id: yeniId(), ad: '', rol: '', tel: '', adres: '' }); ciz(); });
        const yaz = el('button', 'btn primary', 'Acil Durum Kartını Yazdır'); yaz.type = 'button'; yaz.id = 'acil-yazdir';
        yaz.addEventListener('click', yazdir);
        const eylem = el('div', 'form-dugmeler'); eylem.append(yaz);
        kart.replaceChildren(aciklama, ozet, uyari, baslik, dl, liste.length ? sarma : el('p', 'bos', 'Henüz kişi yok. Eklediğin kişiler ad, yakınlık, telefon ve adresle karta basılır.'), ekle, eylem);
      };

      let kayitSayisi = 0;
      const kaydet = async () => {
        const sira = ++kayitSayisi;
        try { await acilKisileriYaz(liste.filter(k => k.ad || k.rol || k.tel || k.adres)); }
        catch (e) { if (sira === kayitSayisi) bildir(hataMetni(e), undefined, true); }
      };

      const yazdir = () => {
        if (document.body.classList.contains('gizli')) { bildir('Gizlilik modu açık; önce kapat', undefined, true); return; }
        const alan = yazdirHtml({ ...v, kisiler: liste }, bugun);
        document.body.appendChild(alan); document.body.classList.add('acil-yaziliyor');
        const bitir = () => { alan.remove(); document.body.classList.remove('acil-yaziliyor'); window.removeEventListener('afterprint', bitir); };
        window.addEventListener('afterprint', bitir);
        window.print();
      };
      ciz();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
