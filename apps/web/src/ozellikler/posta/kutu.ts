import './posta.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { baglananHesaplar } from '../../veri/gmail';
import { ETIKET_RENKLERI, ETIKET_ONEKI, gmailEtiketAdi, siniflandir } from '../../veri/gmail-etiketleyici';
import { BOS_SUZGEC, etiketKimligi, etiketUygula, etiketleriGetir, kurallariGetir, sorguKur, tumHesaplardaListele, type GmailEtiket, type Posta, type Suzgec } from '../../veri/gmail-posta';
import { hesapDurumuYukle, hesapSeridi, type HesapDurumu } from './ortak';

/* E-posta Kutusu: bağlı hesapların iletilerini süzer, Astra etiketlerini gösterir, seçilen iletilere Gmail etiketi ekler/kaldırır. */
export function postaKutusuSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card posta');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  let durum: HesapDurumu = { istemci: '', hesaplar: [] };
  const s = { suzgec: { ...BOS_SUZGEC } as Suzgec, hesap: '', astraEtiket: '', gmailEtiket: '', postalar: [] as Posta[], hatalar: [] as string[], etiketler: new Map<string, GmailEtiket[]>(), secili: new Set<string>(), yukleniyor: false, tarandi: false };
  let kurallar: Awaited<ReturnType<typeof kurallariGetir>> = [];
  const anahtar = (p: Posta) => `${p.hesap}|${p.id}`;
  const sinif = new Map<string, ReturnType<typeof siniflandir>>();

  async function etiketleriYukle() {
    for (const h of baglananHesaplar()) if (!s.etiketler.has(h)) { try { s.etiketler.set(h, await etiketleriGetir(h)); } catch { /* hesap hatası tarama sırasında gösterilir */ } }
  }
  async function ara() {
    s.yukleniyor = true; s.tarandi = true; s.secili.clear(); ciz();
    const hesaplar = s.hesap ? [s.hesap] : baglananHesaplar();
    await etiketleriYukle();
    const gmailAd = s.gmailEtiket ? s.etiketler.get(hesaplar[0] ?? '')?.find(e => e.id === s.gmailEtiket)?.name ?? '' : '';
    const r = await tumHesaplardaListele(hesaplar, sorguKur(s.suzgec, gmailAd), 30);
    s.postalar = r.postalar; s.hatalar = r.hatalar;
    sinif.clear(); s.postalar.forEach(p => sinif.set(anahtar(p), siniflandir(p, kurallar)));
    s.yukleniyor = false; ciz();
  }

  function etiketAdlari(p: Posta): string[] {
    const liste = s.etiketler.get(p.hesap) ?? [];
    return p.etiketIds.map(i => liste.find(e => e.id === i)?.name ?? '').filter(n => n.startsWith(ETIKET_ONEKI)).map(n => n.slice(ETIKET_ONEKI.length));
  }

  function ciz() {
    kart.replaceChildren(hesapSeridi(durum, () => { void yenile(); }));
    if (!baglananHesaplar().length) { kart.appendChild(el('p', 'bos', 'Bağlı hesap yok. Bir hesap bağla; iletiler yalnız bu sayfa açıkken ve tarayıcı belleğinde tutulan bağlantıyla okunur.')); return; }
    // süzgeç
    const f = el('div', 'ic-grid posta-suzgec');
    const girdi = (id: string, et: string, v: string, ph = '') => { const l = el('label', 'alan'), i = el('input'); i.id = id; i.value = v; i.placeholder = ph; l.append(el('span', '', et), i); f.appendChild(l); return i; };
    const hs = el('select'); hs.id = 'ps-hesap'; const ho = el('option', '', 'Tüm hesaplar'); ho.value = ''; hs.appendChild(ho);
    baglananHesaplar().forEach(h => { const o = el('option', '', h); o.value = h; hs.appendChild(o); }); hs.value = s.hesap;
    const hl = el('label', 'alan'); hl.append(el('span', '', 'Hesap'), hs); f.appendChild(hl);
    const metin = girdi('ps-metin', 'Ara', s.suzgec.metin, 'kelime, ifade'), gon = girdi('ps-gonderen', 'Gönderen', s.suzgec.gonderen, 'ad ya da adres'), konu = girdi('ps-konu', 'Konu', s.suzgec.konu);
    const gn = el('select'); gn.id = 'ps-gun'; [[0, 'Tüm zamanlar'], [7, 'Son 7 gün'], [30, 'Son 30 gün'], [90, 'Son 90 gün'], [365, 'Son 1 yıl']].forEach(([v, a]) => { const o = el('option', '', String(a)); o.value = String(v); gn.appendChild(o); }); gn.value = String(s.suzgec.gun);
    const gl = el('label', 'alan'); gl.append(el('span', '', 'Tarih'), gn); f.appendChild(gl);
    const ge = el('select'); ge.id = 'ps-gmail-etiket'; const go = el('option', '', 'Her Gmail etiketi'); go.value = ''; ge.appendChild(go);
    (s.hesap ? s.etiketler.get(s.hesap) ?? [] : []).filter(e => e.type !== 'system' || ['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT'].includes(e.id)).forEach(e => { const o = el('option', '', e.name); o.value = e.id; ge.appendChild(o); }); ge.value = s.gmailEtiket; ge.disabled = !s.hesap;
    const gel = el('label', 'alan'); gel.append(el('span', '', 'Gmail etiketi (tek hesapta)'), ge); f.appendChild(gel);
    const ae = el('select'); ae.id = 'ps-astra-etiket'; const ao = el('option', '', 'Her Astra etiketi'); ao.value = ''; ae.appendChild(ao);
    Object.keys(ETIKET_RENKLERI).forEach(x => { const o = el('option', '', x); o.value = x; ae.appendChild(o); }); ae.value = s.astraEtiket;
    const al = el('label', 'alan'); al.append(el('span', '', 'Astra etiketi'), ae); f.appendChild(al);
    const onoy = (id: string, et: string, v: boolean) => { const l = el('label', 'ic-onay'), c = el('input'); c.type = 'checkbox'; c.id = id; c.checked = v; l.append(c, el('span', '', et)); f.appendChild(l); return c; };
    const ok = onoy('ps-okunmamis', 'Yalnız okunmamış', s.suzgec.okunmamis), ek = onoy('ps-ekli', 'Yalnız ekli', s.suzgec.ekli);
    const bul = el('button', 'btn primary', s.yukleniyor ? 'Aranıyor…' : 'İletileri getir'); bul.type = 'button'; bul.id = 'ps-bul'; bul.disabled = s.yukleniyor;
    const uygula = () => { s.hesap = hs.value; s.suzgec = { metin: metin.value, gonderen: gon.value, konu: konu.value, gun: Number(gn.value), okunmamis: ok.checked, ekli: ek.checked, etiket: '' }; s.gmailEtiket = s.hesap ? ge.value : ''; s.astraEtiket = ae.value; };
    hs.addEventListener('change', () => { uygula(); s.gmailEtiket = ''; ciz(); });
    bul.addEventListener('click', () => { uygula(); void ara(); });
    [metin, gon, konu].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { uygula(); void ara(); } }));
    ae.addEventListener('change', () => { uygula(); ciz(); });
    f.appendChild(bul); kart.appendChild(f);

    if (s.hatalar.length) kart.appendChild(el('p', 'bos hata', s.hatalar.join(' · ')));
    if (s.yukleniyor) { kart.appendChild(el('p', 'bos', 'İletiler getiriliyor…')); return; }
    if (!s.tarandi) { kart.appendChild(el('p', 'bos', 'Süzgeci ayarla ve "İletileri getir"e bas.')); return; }
    const gorunen = s.postalar.filter(p => !s.astraEtiket || sinif.get(anahtar(p))?.etiketler.includes(s.astraEtiket));
    if (!gorunen.length) { kart.appendChild(el('p', 'bos', 'Bu süzgeçle ileti bulunamadı.')); return; }

    // toplu etiket
    const bar = el('div', 'tbar posta-toplu');
    const ad = el('input'); ad.id = 'pt-ad'; ad.placeholder = 'Etiket adı (örn. Fatura)'; ad.setAttribute('aria-label', 'Etiket adı');
    const ekle = el('button', 'btn sm', 'Seçililere etiket ekle'); ekle.type = 'button'; ekle.id = 'pt-ekle';
    const cikar = el('button', 'btn ghost sm', 'Seçililerden kaldır'); cikar.type = 'button'; cikar.id = 'pt-cikar';
    const hepsi = el('button', 'btn ghost sm', 'Tümünü seç'); hepsi.type = 'button';
    hepsi.addEventListener('click', () => { gorunen.forEach(p => s.secili.add(anahtar(p))); ciz(); });
    const say = el('span', 'tbar-count', `${gorunen.length} ileti · ${s.secili.size} seçili`);
    const islem = async (ekleMi: boolean) => {
      const adi = gmailEtiketAdi(ad.value.trim().replace(/^Astra\//i, ''));
      if (adi === ETIKET_ONEKI || !ad.value.trim()) { bildir('Etiket adı yaz', undefined, true); return; }
      const secililer = gorunen.filter(p => s.secili.has(anahtar(p)));
      if (!secililer.length) { bildir('Önce ileti seç', undefined, true); return; }
      ekle.disabled = cikar.disabled = true;
      try {
        for (const h of new Set(secililer.map(p => p.hesap))) {
          const id = await etiketKimligi(h, adi, s.etiketler);
          const ids = secililer.filter(p => p.hesap === h).map(p => p.id);
          await etiketUygula(h, ids, ekleMi ? [id] : [], ekleMi ? [] : [id]);
          secililer.filter(p => p.hesap === h).forEach(p => { p.etiketIds = ekleMi ? [...new Set([...p.etiketIds, id])] : p.etiketIds.filter(x => x !== id); });
        }
        bildir(`${secililer.length} iletide etiket ${ekleMi ? 'eklendi' : 'kaldırıldı'}: ${adi}`);
      } catch (e) { bildir(e instanceof Error ? e.message : hataMetni(e), undefined, true); }
      ciz();
    };
    ekle.addEventListener('click', () => void islem(true)); cikar.addEventListener('click', () => void islem(false));
    bar.append(ad, ekle, cikar, hepsi, el('span', 'tbar-sp'), say);
    kart.appendChild(bar);

    const t = el('table'), bs = el('tr');
    ['', 'Hesap', 'Gönderen', 'Konu', 'Tarih', 'Etiketler'].forEach(x => bs.appendChild(el('th', '', x)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    gorunen.forEach(p => {
      const tr = el('tr', p.okunmamis ? 'okunmamis' : '');
      const c = el('input'); c.type = 'checkbox'; c.checked = s.secili.has(anahtar(p)); c.setAttribute('aria-label', 'Seç');
      c.addEventListener('change', () => { if (c.checked) s.secili.add(anahtar(p)); else s.secili.delete(anahtar(p)); say.textContent = `${gorunen.length} ileti · ${s.secili.size} seçili`; });
      const t0 = el('td'); t0.appendChild(c);
      const et = el('td', 'posta-etiketler');
      const astra = sinif.get(anahtar(p))?.etiketler ?? [];
      astra.forEach(x => { const r = el('span', 'posta-etiket onerilen', x); r.style.setProperty('--c', ETIKET_RENKLERI[x] ?? 'var(--dim)'); r.title = 'Etiketleyicinin önerisi'; et.appendChild(r); });
      etiketAdlari(p).forEach(x => { const r = el('span', 'posta-etiket uygulanmis', `✓ ${x}`); r.style.setProperty('--c', ETIKET_RENKLERI[x] ?? 'var(--dim)'); r.title = 'Gmail\'de uygulanmış'; et.appendChild(r); });
      if (p.ekli) et.appendChild(el('span', 'posta-etiket', '📎'));
      tr.append(t0, el('td', 'posta-hesap-hucre', p.hesap), el('td', '', p.gonderen), el('td', '', `${p.konu.slice(0, 90)}${p.snippet ? ' — ' + p.snippet.slice(0, 70) : ''}`), el('td', '', gun(p.tarih.slice(0, 10))), et);
      g.appendChild(tr);
    });
    t.appendChild(g); const sarma = el('div', 'tablo-sarma'); sarma.appendChild(t); kart.appendChild(sarma);
  }

  async function yenile() { durum = await hesapDurumuYukle(); await etiketleriYukle(); ciz(); }
  void (async () => {
    try { durum = await hesapDurumuYukle(); kurallar = await kurallariGetir(); await etiketleriYukle(); } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); return; }
    ciz();
  })();
}
