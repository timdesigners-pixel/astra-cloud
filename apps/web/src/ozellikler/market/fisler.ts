import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { istemciAl } from '../../veri/istemci';
import { kayitGuncelle, kayitlariGetir } from '../../veri/kayit';
import { fisKaydet, fisSil, fisleriGetir, kalemleriGetir, urunleriGetir, type Fis, type FisKalemi, type Urun, type YeniKalem } from '../../veri/market';
import { bugunStr, girdi, kutu, secim } from '../notlar/ortak';

const AY = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

export function marketAlisverisiSayfasi(kok: HTMLElement) {
  const s = { fisler: [] as Fis[], kalemler: [] as FisKalemi[], urunler: [] as Urun[], hesaplar: new Map<string, string>(), yukleniyor: true, hata: '', ara: '' };
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  const ozet = el('div', 'icra-ozet');
  const bar = el('div', 'tbar');
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Market ya da ürün ara'; ara.setAttribute('aria-label', 'Ara');
  const say = el('span', 'tbar-count');
  const yeni = el('button', 'btn primary sm', '+ Yeni fiş'); yeni.type = 'button'; yeni.id = 'fis-yeni';
  bar.append(ara, el('span', 'tbar-sp'), say, yeni);
  const icerik = el('div', 'icra-icerik');
  kart.append(ozet, bar, icerik);

  const urunAdi = (id: string) => s.urunler.find(u => u.id === id)?.ad ?? '—';
  const gorunen = () => {
    const t = katla(s.ara.trim());
    return s.fisler.filter(f => !t || katla(f.market).includes(t) || s.kalemler.some(k => k.fis_id === f.id && katla(urunAdi(k.urun_id)).includes(t)))
      .sort((a, b) => b.tarih.localeCompare(a.tarih));
  };

  function ozetCiz() {
    ozet.replaceChildren();
    if (s.yukleniyor || s.hata) return;
    const ay = bugunStr().slice(0, 7), d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const onceki = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const buAy = s.fisler.filter(f => f.tarih.startsWith(ay)), gecen = s.fisler.filter(f => f.tarih.startsWith(onceki));
    const top = (l: Fis[]) => l.reduce((t, f) => t + Number(f.toplam), 0);
    const h = (et: string, v: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', v), el('small', '', not)); ozet.appendChild(x); };
    h(`${AY.format(new Date())} market`, tl(top(buAy)), `${buAy.length} fiş`, 'vurgu');
    h('Ortalama fiş', tl(buAy.length ? top(buAy) / buAy.length : 0), 'bu ay');
    h('Geçen ay', tl(top(gecen)), `${gecen.length} fiş`);
  }

  function ciz() {
    const liste = gorunen();
    say.textContent = s.yukleniyor ? '' : `${liste.length} / ${s.fisler.length}`;
    ozetCiz();
    icerik.replaceChildren();
    if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      icerik.append(el('p', 'bos hata', s.hata), b); return;
    }
    if (!s.fisler.length) { icerik.appendChild(el('p', 'bos', 'Henüz fiş yok. "Yeni fiş" ile ilk alışverişini gir; stok ve fiyat geçmişi buradan dolar.')); return; }
    if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan fiş yok.')); return; }
    const sarma = el('div', 'tablo-sarma'), t = el('table'), bs = el('tr');
    ['Tarih', 'Market', 'Kalem', 'Hesap', 'Toplam'].forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    liste.forEach(f => {
      const tr = el('tr', 'satir'); tr.tabIndex = 0; tr.dataset.id = f.id;
      tr.append(el('td', '', gun(f.tarih)), el('td', '', f.market), el('td', 'sayi', String(s.kalemler.filter(k => k.fis_id === f.id).length)),
        el('td', '', s.hesaplar.get(f.hesap_id ?? '') ?? '—'), el('td', 'sayi gz', tl(Number(f.toplam))));
      tr.addEventListener('click', () => detay(f)); tr.addEventListener('keydown', e => { if (e.key === 'Enter') detay(f); });
      g.appendChild(tr);
    });
    t.appendChild(g); sarma.appendChild(t); icerik.appendChild(sarma);
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try {
      const [f, k, u, h] = await Promise.all([fisleriGetir(), kalemleriGetir(), urunleriGetir(), istemciAl().from('hesaplar').select('id,ad').is('silindi_at', null).order('ad')]);
      if (h.error) throw h.error;
      s.fisler = f; s.kalemler = k; s.urunler = u; s.hesaplar = new Map((h.data ?? []).map(x => [x.id as string, x.ad as string]));
    } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  function detay(f: Fis) {
    const d = kutu(`${f.market} · ${gun(f.tarih)}`);
    d.kaydet.hidden = true;
    const sarma = el('div', 'tablo-sarma'), t = el('table'), bs = el('tr');
    ['Ürün', 'Miktar', 'Birim fiyat', 'Tutar'].forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    s.kalemler.filter(k => k.fis_id === f.id).forEach(k => {
      const tr = el('tr'); tr.append(el('td', '', urunAdi(k.urun_id)), el('td', 'sayi', String(Number(k.miktar))), el('td', 'sayi', tl(Number(k.birim_fiyat))), el('td', 'sayi', tl(Number(k.tutar))));
      g.appendChild(tr);
    });
    t.appendChild(g); sarma.appendChild(t);
    d.f.append(sarma, el('p', 'alt', `Toplam ${tl(Number(f.toplam))}${f.hesap_id ? ' · ' + (s.hesaplar.get(f.hesap_id) ?? '') : ' · hesaba işlenmedi'}${f.notlar ? ' · ' + f.notlar : ''}`));
    const sil = el('button', 'btn danger', 'Fişi sil'); sil.type = 'button'; let emin = false;
    sil.addEventListener('click', async () => {
      if (!emin) { emin = true; sil.textContent = 'Stok ve hesap geri alınır. Emin misin?'; return; }
      sil.disabled = true;
      try { await fisSil(f.id); d.dlg.close(); bildir('Fiş silindi'); await yukle(); }
      catch (err) { sil.disabled = false; d.hatayaz(hataMetni(err)); }
    });
    d.dugmeler.appendChild(sil);
    d.bitir();
  }

  async function form() {
    const d = kutu('Yeni fiş');
    const market = girdi('ff-market', 'text', ''); market.maxLength = 120; market.setAttribute('list', 'ff-marketler');
    const mList = el('datalist'); mList.id = 'ff-marketler'; [...new Set(s.fisler.map(f => f.market))].forEach(m => { const o = el('option'); o.value = m; mList.appendChild(o); });
    const tarih = girdi('ff-tarih', 'date', bugunStr());
    const hesap = secim('ff-hesap', [['', 'Hesaba işleme'], ...[...s.hesaplar.entries()].map(([id, a]) => [id, a] as [string, string])], '');
    const not = girdi('ff-not', 'text', ''); not.maxLength = 1000;
    d.f.appendChild(mList);
    d.alan('Market', market); d.alan('Tarih', tarih); d.alan('Ödenen hesap', hesap, 'Seçersen toplam tutar hesaptan düşer'); d.alan('Not', not);

    const uList = el('datalist'); uList.id = 'ff-urunler'; s.urunler.forEach(u => { const o = el('option'); o.value = u.ad; uList.appendChild(o); }); d.f.appendChild(uList);
    const satirlar = el('div', 'fis-satirlar');
    const toplamYazi = el('p', 'alt');
    type Satir = { ad: HTMLInputElement; miktar: HTMLInputElement; fiyat: HTMLInputElement; tutar: HTMLElement; liste?: string };
    const kayit: Satir[] = [];
    const topla = () => { const t = kayit.reduce((x, r) => x + (Number(r.miktar.value) || 0) * (Number(r.fiyat.value) || 0), 0); toplamYazi.textContent = `Toplam ${tl(Math.round(t * 100) / 100)}`; };
    const satirEkle = (ad = '', miktar = '1', listeId?: string) => {
      const kutuS = el('div', 'fis-satir');
      const a = el('input'); a.setAttribute('list', 'ff-urunler'); a.placeholder = 'Ürün'; a.value = ad; a.setAttribute('aria-label', 'Ürün');
      const m = el('input'); m.type = 'number'; m.step = '0.001'; m.min = '0'; m.value = miktar; m.placeholder = 'Miktar'; m.setAttribute('aria-label', 'Miktar');
      const f = el('input'); f.type = 'number'; f.step = '0.01'; f.min = '0'; f.placeholder = 'Birim fiyat'; f.setAttribute('aria-label', 'Birim fiyat');
      const t = el('span', 'sayi', tl(0));
      const sil = el('button', 'btn ghost xs', '×'); sil.type = 'button'; sil.setAttribute('aria-label', 'Satırı sil');
      const r: Satir = { ad: a, miktar: m, fiyat: f, tutar: t, liste: listeId };
      const guncelle = () => { t.textContent = tl((Number(m.value) || 0) * (Number(f.value) || 0)); topla(); };
      m.addEventListener('input', guncelle); f.addEventListener('input', guncelle);
      sil.addEventListener('click', () => { kayit.splice(kayit.indexOf(r), 1); kutuS.remove(); topla(); });
      kutuS.append(a, m, f, t, sil); satirlar.appendChild(kutuS); kayit.push(r);
    };
    satirEkle();
    const ekle = el('button', 'btn ghost sm', '+ Kalem'); ekle.type = 'button'; ekle.addEventListener('click', () => satirEkle());
    const listeden = el('button', 'btn ghost sm', 'Alışveriş listesinden getir'); listeden.type = 'button';
    listeden.addEventListener('click', async () => {
      try {
        const l = await kayitlariGetir('alisveris_ogeleri', ['ad', 'miktar', 'alindi'], { alindi: false }, 'ad');
        if (!l.length) { bildir('Alışveriş listesinde bekleyen öğe yok'); return; }
        if (kayit.length === 1 && !kayit[0]!.ad.value) { kayit.splice(0, 1); satirlar.firstElementChild?.remove(); }
        l.forEach(o => satirEkle(String(o.ad), String(o.miktar), o.id));
      } catch (e) { bildir(hataMetni(e), undefined, true); }
    });
    const araclar = el('div', 'form-dugmeler'); araclar.append(ekle, listeden);
    d.f.append(satirlar, araclar, toplamYazi);
    topla();

    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!market.value.trim() || !tarih.value) { d.hatayaz('Market ve tarih gerekli.'); return; }
      const kalemler: YeniKalem[] = [];
      for (const r of kayit) {
        if (!r.ad.value.trim() && !r.fiyat.value) continue;
        const adi = r.ad.value.trim(), miktar = Number(r.miktar.value), fiyat = Number(r.fiyat.value);
        if (!adi || !(miktar > 0) || !(fiyat >= 0) || r.fiyat.value === '') { d.hatayaz('Her kalemde ürün, miktar ve birim fiyat olmalı.'); return; }
        const u = s.urunler.find(x => katla(x.ad) === katla(adi));
        kalemler.push({ ad: adi, miktar, birim_fiyat: fiyat, birim: u?.birim ?? 'adet', urun_id: u?.id });
      }
      if (!kalemler.length) { d.hatayaz('En az bir kalem ekle.'); return; }
      d.kaydet.disabled = true; d.hata.hidden = true;
      try {
        await fisKaydet(market.value.trim(), tarih.value, hesap.value || null, not.value.trim() || null, kalemler);
        for (const r of kayit) if (r.liste) { try { const o = (await kayitlariGetir('alisveris_ogeleri', ['alindi'], {}, 'ad')).find(x => x.id === r.liste); if (o) await kayitGuncelle('alisveris_ogeleri', ['alindi'], o.id, o.surum, { alindi: true }); } catch { /* liste güncellemesi isteğe bağlı */ } }
        d.dlg.close(); bildir('Fiş kaydedildi'); await yukle();
      } catch (err) {
        d.kaydet.disabled = false;
        d.hatayaz(err instanceof CakismaHatasi ? hataMetni(err) : hataMetni(err));
      }
    });
    d.bitir();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
  yeni.addEventListener('click', () => void form());
  void yukle();
}
