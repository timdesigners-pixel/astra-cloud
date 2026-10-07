import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { tl } from '../../ortak/bicim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { begeniEkle, begeniGeriAl, begeniGuncelle, begeniSil, begenileriGetir, type Begeni, type BegeniGirdisi, type Oncelik } from '../../veri/begeniler';
import { kayitEkle } from '../../veri/kayit';
import { girdi, guvenliBaglanti, kutu, secim } from '../notlar/ortak';
import {
  KATEGORILER, ONCELIK_AD, baglantilariOku, baglantilariYaz, gecmisEkle, hedefteMi, indirimde, kategoriBul, ozetle, ozellikleriOku, ozellikleriYaz,
  siraliListe, suz, type Filtre, type Siralama,
} from './hesap';

const SVG = 'http://www.w3.org/2000/svg';
const sayiOku = (v: string) => { const t = v.trim().replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) && n >= 0 ? n : NaN; };

/* Fiyat geçmişi + güncel fiyat için küçük çizgi grafik. */
function cizgi(p: Begeni): SVGElement | null {
  const noktalar = p.fiyat_gecmisi.map(x => x.price);
  if (p.fiyat !== null && noktalar[noktalar.length - 1] !== p.fiyat) noktalar.push(p.fiyat);
  if (noktalar.length < 2) return null;
  const en = 220, boy = 48, kenar = 4, alt = Math.min(...noktalar), ust = Math.max(...noktalar), aralik = ust - alt || 1;
  const xy = noktalar.map((v, i) => [kenar + (i / (noktalar.length - 1)) * (en - 2 * kenar), boy - kenar - ((v - alt) / aralik) * (boy - 2 * kenar)] as const);
  const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', `0 0 ${en} ${boy}`); s.setAttribute('class', 'bg-cizgi'); s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `Fiyat geçmişi: ${noktalar.map(v => tl(v)).join(' → ')}`);
  const yol = document.createElementNS(SVG, 'polyline'); yol.setAttribute('points', xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')); yol.setAttribute('fill', 'none'); yol.setAttribute('class', 'bg-yol');
  const son = xy[xy.length - 1]!, nokta = document.createElementNS(SVG, 'circle'); nokta.setAttribute('cx', son[0].toFixed(1)); nokta.setAttribute('cy', son[1].toFixed(1)); nokta.setAttribute('r', '3'); nokta.setAttribute('class', 'bg-nokta');
  s.append(yol, nokta); return s;
}

export function begenilerSayfasi(kok: HTMLElement) {
  const s = { liste: [] as Begeni[], yukleniyor: true, hata: '', ara: '', filtre: 'hepsi' as Filtre, kategori: '', sira: 'yeni' as Siralama };
  const kart = el('section', 'card begeniler');
  kok.replaceChildren(kart);
  const ozet = el('div', 'icra-ozet');
  const bar = el('div', 'tbar');
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Ürün, not ya da özellik ara'; ara.setAttribute('aria-label', 'Ara');
  const kat = el('select'); kat.id = 'bg-kategori'; kat.setAttribute('aria-label', 'Kategori');
  const srl = el('select'); srl.id = 'bg-sira'; srl.setAttribute('aria-label', 'Sırala');
  ([['yeni', 'En yeni eklenenler'], ['eski', 'En eski eklenenler'], ['fiyat-artan', 'Fiyat: artan'], ['fiyat-azalan', 'Fiyat: azalan'], ['ad', 'İsim: A-Z'], ['oncelik', 'Öncelik']] as [string, string][])
    .forEach(([v, t]) => { const o = el('option', '', t); o.value = v; srl.appendChild(o); });
  const say = el('span', 'tbar-count');
  const yeni = el('button', 'btn primary sm', '+ Yeni ürün'); yeni.type = 'button'; yeni.id = 'bg-yeni';
  bar.append(ara, kat, srl, el('span', 'tbar-sp'), say, yeni);
  const filtreler = el('div', 'bg-filtre');
  const izgara = el('div', 'bg-izgara');
  kart.append(ozet, bar, filtreler, izgara);

  function ciz() {
    const o = ozetle(s.liste);
    ozet.replaceChildren();
    if (!s.yukleniyor && !s.hata) {
      const h = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
      h('Ürün', String(o.adet), `${o.kategori} kategoride`, 'vurgu');
      h('Toplam değer', tl(o.toplam), `%${o.fiyatliYuzde} ürünün fiyatı belli`);
      h('Ortalama fiyat', tl(o.ortalama), 'fiyatı belli olanlar');
      h('Yüksek ilgi', String(o.yuksek), `${o.favori} favori`, o.yuksek ? 'uyari' : '');
    }
    const secili = kat.value;
    kat.replaceChildren();
    const hepsi = el('option', '', 'Tüm kategoriler'); hepsi.value = ''; kat.appendChild(hepsi);
    Object.keys(KATEGORILER).filter(k => s.liste.some(p => p.kategori === k)).forEach(k => {
      const op = el('option', '', `${KATEGORILER[k]!.simge} ${KATEGORILER[k]!.ad} (${s.liste.filter(p => p.kategori === k).length})`); op.value = k; kat.appendChild(op);
    });
    kat.value = [...kat.options].some(x => x.value === secili) ? secili : '';

    filtreler.replaceChildren();
    ([['hepsi', '✨ Tümü', o.adet], ['favori', '❤️ Favorilerim', o.favori], ['indirim', '🔥 İndirimdekiler', o.indirim], ['hedef', '🎯 Hedefe ulaşanlar', o.hedef]] as [Filtre, string, number][]).forEach(([k, ad, n]) => {
      const b = el('button', 'wpill' + (s.filtre === k ? ' secili' : ''), `${ad} ${n}`); b.type = 'button'; b.id = `bg-f-${k}`;
      b.addEventListener('click', () => { s.filtre = k; ciz(); }); filtreler.appendChild(b);
    });

    const liste = siraliListe(suz(s.liste, s.filtre, s.kategori, s.ara), s.sira);
    say.textContent = s.yukleniyor ? '' : `${liste.length} / ${s.liste.length}`;
    izgara.replaceChildren();
    if (s.yukleniyor) { izgara.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      izgara.append(el('p', 'bos hata', s.hata), b); return;
    }
    if (!s.liste.length) { izgara.appendChild(el('p', 'bos', 'Henüz beğenilen ürün yok.')); return; }
    if (!liste.length) { izgara.appendChild(el('p', 'bos', 'Aramana uyan ürün yok.')); return; }
    liste.forEach(p => izgara.appendChild(urunKarti(p)));
  }

  function urunKarti(p: Begeni) {
    const k = kategoriBul(p.kategori);
    const c = el('article', 'bg-kart'); c.tabIndex = 0; c.dataset.id = p.id;
    const resim = el('div', 'bg-resim');
    const yedek = el('span', 'bg-yedek', k.simge); resim.appendChild(yedek);
    if (p.resim && /^https:\/\//i.test(p.resim)) {
      const r = document.createElement('img'); r.alt = ''; r.loading = 'lazy'; r.referrerPolicy = 'no-referrer'; r.src = p.resim;
      r.addEventListener('error', () => r.remove()); resim.appendChild(r);
    }
    const kalp = el('button', 'bg-kalp' + (p.favori ? ' acik' : ''), p.favori ? '♥' : '♡'); kalp.type = 'button';
    kalp.setAttribute('aria-pressed', String(p.favori)); kalp.setAttribute('aria-label', p.favori ? 'Favoriden çıkar' : 'Favoriye ekle');
    kalp.addEventListener('click', e => { e.stopPropagation(); void favoriCevir(p); });
    resim.appendChild(kalp);
    if (p.rozet?.text) resim.appendChild(el('span', `bg-rozet ${p.rozet.cls === 'ok' ? 'iyi' : 'dikkat'}`, p.rozet.text));
    const govde = el('div', 'bg-govde');
    govde.appendChild(el('small', 'bg-kat', `${k.simge} ${k.ad}`));
    govde.appendChild(el('b', 'bg-ad', p.ad));
    const fiyat = el('div', 'bg-fiyat');
    fiyat.append(el('b', 'gz', p.fiyat === null ? '—' : tl(p.fiyat)));
    if (p.fiyat === null && p.fiyat_etiketi) fiyat.appendChild(el('small', '', p.fiyat_etiketi));
    if (p.fiyat !== null && p.ilk_fiyat && p.fiyat !== p.ilk_fiyat) {
      const d = Math.round(((p.fiyat - p.ilk_fiyat) / p.ilk_fiyat) * 100);
      fiyat.appendChild(el('small', d < 0 ? 'dus' : 'art', `${d < 0 ? '−' : '+'}%${Math.abs(d)}`));
    }
    govde.appendChild(fiyat);
    const alt = el('div', 'bg-alt');
    alt.append(el('span', '', ONCELIK_AD[p.oncelik] ?? ''), el('span', 'bg-puan', p.puan ? '★'.repeat(p.puan) : ''));
    govde.appendChild(alt);
    if (hedefteMi(p)) govde.appendChild(el('small', 'bg-hedef', '🎯 Hedef fiyata ulaştı'));
    else if (p.hedef_fiyat && p.fiyat) govde.appendChild(el('small', 'bg-hedef bekle', `Hedef ${tl(p.hedef_fiyat)}`));
    c.append(resim, govde);
    const ac = () => detay(p);
    c.addEventListener('click', ac); c.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === c) ac(); });
    return c;
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { s.liste = await begenileriGetir(); } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  function degistir(p: Begeni) {
    const i = s.liste.findIndex(x => x.id === p.id); if (i >= 0) s.liste[i] = p; else s.liste.push(p);
  }

  async function favoriCevir(p: Begeni) {
    try { degistir(await begeniGuncelle(p.id, p.surum, { favori: !p.favori })); ciz(); }
    catch (e) { if (e instanceof CakismaHatasi) void yukle(); bildir(hataMetni(e), undefined, true); }
  }

  function detay(p: Begeni) {
    const d = kutu(p.ad); d.dlg.classList.add('genis'); d.kaydet.remove(); d.f.querySelector('h2')!.classList.add('bg-baslik');
    const k = kategoriBul(p.kategori);
    d.f.appendChild(el('p', 'bg-ust', `${k.simge} ${k.ad} · ${ONCELIK_AD[p.oncelik] ?? ''}${p.puan ? ' · ' + '★'.repeat(p.puan) : ''}`));
    if (p.resim && /^https:\/\//i.test(p.resim)) { const r = document.createElement('img'); r.className = 'bg-buyuk'; r.alt = ''; r.referrerPolicy = 'no-referrer'; r.src = p.resim; r.addEventListener('error', () => r.remove()); d.f.appendChild(r); }
    const fiyat = el('div', 'bg-fiyat buyuk'); fiyat.append(el('b', 'gz', p.fiyat === null ? '—' : tl(p.fiyat)));
    if (p.fiyat_etiketi && p.fiyat === null) fiyat.appendChild(el('small', '', p.fiyat_etiketi));
    if (p.hedef_fiyat) fiyat.appendChild(el('small', '', `hedef ${tl(p.hedef_fiyat)}`));
    d.f.appendChild(fiyat);
    const grafik = cizgi(p); if (grafik) d.f.appendChild(grafik);
    if (p.ozellikler.length) {
      const dl = el('dl', 'bg-ozellik'); p.ozellikler.forEach(([a, b]) => { if (a) dl.appendChild(el('dt', '', a)); dl.appendChild(el('dd', '', b)); });
      const b = el('section', 'bolum'); b.append(el('h3', '', 'Özellikler'), dl); d.f.appendChild(b);
    }
    if (p.notlar) { const b = el('section', 'bolum'); b.append(el('h3', '', 'Not'), el('p', '', p.notlar)); d.f.appendChild(b); }
    const baglar = p.baglantilar.filter(x => guvenliBaglanti(x.url));
    if (baglar.length) {
      const ul = el('ul'); baglar.forEach(x => { const li = el('li'), a = el('a', '', x.label || x.url); a.href = x.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); ul.appendChild(li); });
      const b = el('section', 'bolum'); b.append(el('h3', '', 'Bağlantılar'), ul); d.f.appendChild(b);
    }
    const duzenle = el('button', 'btn primary', 'Düzenle'); duzenle.type = 'button'; duzenle.id = 'bg-duzenle';
    duzenle.addEventListener('click', () => { d.dlg.close(); form(p); });
    const istek = el('button', 'btn ghost', 'İstek listesine ekle'); istek.type = 'button'; istek.id = 'bg-istek';
    istek.addEventListener('click', async () => {
      istek.disabled = true;
      try { await kayitEkle('istekler', ['ad'], { ad: p.ad, tahmini_tutar: p.fiyat, baglanti: baglar[0]?.url ?? null, oncelik: p.oncelik === 'high' ? 'yuksek' : p.oncelik === 'low' ? 'dusuk' : 'orta', durum: 'bekliyor' }); bildir('İstek listesine eklendi'); }
      catch (e) { istek.disabled = false; bildir(hataMetni(e), undefined, true); }
    });
    const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; sil.id = 'bg-sil';
    sil.addEventListener('click', async () => {
      if (!(await onayla({ baslik: 'Ürün silinsin mi?', metin: p.ad, evet: 'Sil' }))) return;
      sil.disabled = true;
      try {
        const silinen = await begeniSil(p.id, p.surum);
        s.liste = s.liste.filter(x => x.id !== p.id); d.dlg.close(); ciz();
        bildir('Ürün silindi', async () => { try { await begeniGeriAl(silinen.id, silinen.surum); await yukle(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
      } catch (e) { sil.disabled = false; if (e instanceof CakismaHatasi) { d.dlg.close(); void yukle(); } d.hatayaz(hataMetni(e)); }
    });
    d.dugmeler.replaceChildren(duzenle, istek, sil);
    d.bitir();
  }

  function form(m?: Begeni) {
    const d = kutu(m ? 'Ürünü düzenle' : 'Yeni ürün'); d.dlg.classList.add('genis');
    const ad = girdi('bf-ad', 'text', m?.ad ?? ''); ad.maxLength = 160;
    const katS = secim('bf-kategori', Object.entries(KATEGORILER).map(([k, v]) => [k, `${v.simge} ${v.ad}`] as [string, string]), m?.kategori ?? 'diger');
    const fiyat = girdi('bf-fiyat', 'text', m?.fiyat === null || m?.fiyat === undefined ? '' : String(m.fiyat)); fiyat.inputMode = 'decimal';
    const etiket = girdi('bf-etiket', 'text', m?.fiyat_etiketi ?? ''); etiket.maxLength = 120; etiket.placeholder = 'Fiyat yoksa neden (örnek: Türkiye satışı yok)';
    const hedef = girdi('bf-hedef', 'text', m?.hedef_fiyat === null || m?.hedef_fiyat === undefined ? '' : String(m.hedef_fiyat)); hedef.inputMode = 'decimal';
    const onc = secim('bf-oncelik', Object.entries(ONCELIK_AD) as [string, string][], m?.oncelik ?? 'medium');
    const puan = secim('bf-puan', [['', '—'], ...[1, 2, 3, 4, 5].map(n => [String(n), '★'.repeat(n)] as [string, string])], m?.puan ? String(m.puan) : '');
    const resim = girdi('bf-resim', 'text', m?.resim ?? ''); resim.maxLength = 1000; resim.placeholder = 'https://…';
    const fav = girdi('bf-favori', 'checkbox'); fav.checked = m?.favori ?? false;
    const bag = el('textarea'); bag.id = 'bf-baglanti'; bag.rows = 3; bag.value = baglantilariYaz(m?.baglantilar ?? []);
    const oz = el('textarea'); oz.id = 'bf-ozellik'; oz.rows = 4; oz.value = ozellikleriYaz(m?.ozellikler ?? []);
    const not = el('textarea'); not.id = 'bf-not'; not.rows = 3; not.maxLength = 2000; not.value = m?.notlar ?? '';
    d.alan('Ürün', ad); d.alan('Kategori', katS); d.alan('Güncel fiyat (TL)', fiyat, m ? 'Fiyat değişirse fiyat geçmişine eklenir' : 'Biliniyorsa yaz');
    d.alan('Fiyat notu', etiket); d.alan('Hedef fiyat (TL)', hedef, 'Fiyat bu değere inince "Hedefe ulaşanlar"da görünür'); d.alan('Öncelik', onc); d.alan('Puan', puan);
    d.alan('Resim adresi', resim); d.alan('Favori', fav);
    d.alan('Özellikler', oz, 'Her satıra bir özellik: "Bellek: 16 GB"'); d.alan('Bağlantılar', bag, 'Her satıra bir bağlantı: "Mağaza | https://…"'); d.alan('Not', not);
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!ad.value.trim()) { d.hatayaz('Ürün adı boş olamaz.'); ad.focus(); return; }
      const f = sayiOku(fiyat.value), h = sayiOku(hedef.value);
      if (Number.isNaN(f) || Number.isNaN(h)) { d.hatayaz('Fiyat ve hedef fiyat sıfır ya da daha büyük bir sayı olmalı.'); return; }
      if (resim.value.trim() && !/^https:\/\//i.test(resim.value.trim())) { d.hatayaz('Resim adresi https:// ile başlamalı.'); return; }
      const baglar = baglantilariOku(bag.value);
      const g: BegeniGirdisi = {
        ad: ad.value.trim(), kategori: katS.value, fiyat: f, fiyat_etiketi: etiket.value.trim() || null, hedef_fiyat: h, oncelik: onc.value as Oncelik,
        puan: puan.value ? Number(puan.value) : null, resim: resim.value.trim() || null, favori: fav.checked, ozellikler: ozellikleriOku(oz.value),
        baglantilar: baglar, baglanti: baglar[0]?.url.slice(0, 500) ?? null, notlar: not.value.trim() || null,
        fiyat_gecmisi: m ? gecmisEkle(m.fiyat_gecmisi, m.fiyat, f) : [], ilk_fiyat: m ? m.ilk_fiyat ?? f : f,
      };
      d.kaydet.disabled = true; d.hata.hidden = true;
      try {
        const k = m ? await begeniGuncelle(m.id, m.surum, g) : await begeniEkle(g);
        degistir(k); d.dlg.close(); ciz(); bildir('Kaydedildi');
      } catch (err) {
        d.kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
        d.hatayaz(hataMetni(err));
      }
    });
    d.bitir();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
  kat.addEventListener('change', () => { s.kategori = kat.value; ciz(); });
  srl.addEventListener('change', () => { s.sira = srl.value as Siralama; ciz(); });
  yeni.addEventListener('click', () => form());
  void yukle();
}
