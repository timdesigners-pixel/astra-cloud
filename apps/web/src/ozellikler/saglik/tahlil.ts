import './saglik.css';
import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { bugunAnahtari } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import {
  AZAMI_DOSYA, degerDurumu, degerleriGetir, degerleriKaydet, dosyaYukle, egilimMetni, farkHesapla, imzaliAdres, istatistik, raporEkle, raporGuncelle, raporlariGetir,
  raporuSil, testGrubu, testlereAyir, yapayZekaylaOku, type Deger, type DegerGirdisi, type Fark, type Rapor, type TestOzeti,
} from '../../veri/tahlil';
import { DURUM_ADI, KATALOG, durumHesapla, serbestAnahtar, testBul, type Durum } from '../../veri/tahlil-katalog';
import { metindenAyikla } from '../../veri/tahlil-ayikla';
import { girdi, kutu } from '../notlar/ortak';
import { grafikCiz, minikCiz } from './grafik';

/* Tahliller: rapor dosyasını yükle, değerleri gir (elle, metinden ya da yapay zekâyla), zaman içindeki değişimi ve referans dışı değerleri izle. */
const tarihYaz = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const sayiYaz = (n: number | null) => (n === null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 3 }));
const sayiOku = (s: string): number | null => { const n = Number(s.trim().replace(',', '.').replace(/^[<>]=?\s*/, '')); return s.trim() && Number.isFinite(n) ? n : null; };
const referans = (alt: number | null, ust: number | null) => (alt === null && ust === null ? '—' : alt !== null && ust !== null ? `${sayiYaz(alt)} – ${sayiYaz(ust)}` : alt !== null ? `≥ ${sayiYaz(alt)}` : `≤ ${sayiYaz(ust)}`);
const durumRozeti = (d: Durum) => el('span', `sg-durum ${d}`, DURUM_ADI[d]);
const farkMetni = (f: Fark | null) => (f === null ? '—' : Math.abs(f.fark) < 1e-9 ? 'değişmedi' : `${f.fark > 0 ? '↑ +' : '↓ −'}${sayiYaz(Math.abs(f.fark))}${f.yuzde === null ? '' : ` (%${Math.abs(Math.round(f.yuzde))})`}`);
const kisaTarih = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(2, 4)}`;
const degerMetni = (d: Pick<Deger, 'deger' | 'metin'>) => (d.metin && d.deger === null ? d.metin : d.metin && /^[<>]/.test(d.metin) ? d.metin : sayiYaz(d.deger));

type Satir = DegerGirdisi & { id?: string };

export function tahlilSayfasi(kok: HTMLElement) {
  const s = {
    raporlar: [] as Rapor[], degerler: [] as Deger[], gorunum: 'degerler' as 'degerler' | 'karsilastirma' | 'raporlar', ara: '', sadeceDisi: false, grup: '', matrisSon: 6,
    yukleniyor: true, hata: '', aiOnay: false,
  };
  const kart = el('section', 'card sg');
  kok.replaceChildren(kart);

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { [s.raporlar, s.degerler] = await Promise.all([raporlariGetir(), degerleriGetir()]); }
    catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  const raporBul = (id: string) => s.raporlar.find(r => r.id === id);
  const dosyaAc = async (r: Rapor) => {
    if (!r.dosya_yol) return;
    try { window.open(await imzaliAdres(r.dosya_yol, undefined, 120), '_blank', 'noopener'); } catch (e) { bildir(hataMetni(e), undefined, true); }
  };

  /* ——— Test ayrıntısı: istatistik, önceki sonuçlarla karşılaştırma, grafik ve geçmiş tablosu ——— */
  function testDetay(t: TestOzeti) {
    const dlg = el('dialog', 'kutu genis'); dlg.setAttribute('aria-label', t.ad);
    const bas = el('div', 'sg-ust');
    bas.append(el('h2', '', t.ad), el('small', 'pill', testGrubu(t.test)));
    dlg.appendChild(bas);
    const ist = istatistik(t.seri);
    const birim = t.birim ?? '';
    if (ist) {
      const kutular = el('div', 'sg-istat');
      const kutu_ = (et: string, deger: string, alt = '', sinif = '') => { const k = el('div', 'sg-istat-k ' + sinif); k.append(el('span', 'et', et), el('b', '', deger), el('small', '', alt)); kutular.appendChild(k); };
      const sayisalSeri = t.seri.filter(d => d.deger !== null);
      const onceki = sayisalSeri.length > 1 ? sayisalSeri[sayisalSeri.length - 2]! : null;
      kutu_('Son sonuç', `${degerMetni(t.son)} ${birim}`, `${tarihYaz(t.son.tarih)} · ${DURUM_ADI[t.durum]}`, t.durum === 'dusuk' || t.durum === 'yuksek' ? 'disari' : '');
      kutu_('Önceki sonuç', onceki ? `${degerMetni(onceki)} ${birim}` : '—', onceki ? tarihYaz(onceki.tarih) : '');
      kutu_('Fark', farkMetni(farkHesapla(onceki, t.son)), onceki ? `${tarihYaz(onceki.tarih)} → ${tarihYaz(t.son.tarih)}` : '');
      kutu_('İlk sonuca göre', farkMetni(farkHesapla(ist.ilk, t.son)), `${tarihYaz(ist.ilk.tarih)}'den beri`);
      kutu_('En düşük', `${sayiYaz(ist.en_dusuk.deger)} ${birim}`, tarihYaz(ist.en_dusuk.tarih));
      kutu_('En yüksek', `${sayiYaz(ist.en_yuksek.deger)} ${birim}`, tarihYaz(ist.en_yuksek.tarih));
      kutu_('Ortalama', `${sayiYaz(Math.round(ist.ortalama * 100) / 100)} ${birim}`, `${ist.n} sonuç`);
      kutu_('Referans dışı', `${ist.disinda} / ${ist.n}`, `Referans ${referans(t.son.ref_alt, t.son.ref_ust)}`);
      dlg.appendChild(kutular);
      dlg.appendChild(el('p', 'sg-trend', egilimMetni(t.seri)));
    }
    const sayisal = t.seri.filter(d => d.deger !== null);
    if (sayisal.length) {
      dlg.appendChild(grafikCiz(sayisal.map(d => ({ x: d.tarih, y: d.deger!, disarida: ['dusuk', 'yuksek'].includes(degerDurumu(d)), etiket: `${tarihYaz(d.tarih)}: ${degerMetni(d)} ${d.birim ?? ''}` })),
        { ondalik: 1, alt: t.son.ref_alt, ust: t.son.ref_ust, aralikAdi: 'Referans aralığı', yukseklik: 220 }));
    }
    // iki sonucu seçip karşılaştır
    if (sayisal.length > 1) {
      const kar = el('div', 'sg-karsi');
      const sec = (id: string, varsayilan: Deger) => {
        const x = el('select'); x.id = id; x.setAttribute('aria-label', 'Tarih seç');
        t.seri.filter(d => d.deger !== null).forEach(d => { const o = el('option', '', `${tarihYaz(d.tarih)} · ${degerMetni(d)}`); o.value = d.id; x.appendChild(o); });
        x.value = varsayilan.id; return x;
      };
      const A = sec('th-kar-a', sayisal[0]!), B = sec('th-kar-b', sayisal[sayisal.length - 1]!);
      const sonuc = el('span', 'sg-karsi-sonuc');
      const hesapla = () => {
        const da = t.seri.find(d => d.id === A.value)!, db = t.seri.find(d => d.id === B.value)!;
        sonuc.textContent = `${farkMetni(farkHesapla(da, db))} · ${DURUM_ADI[degerDurumu(da)]} → ${DURUM_ADI[degerDurumu(db)]}`;
      };
      A.addEventListener('change', hesapla); B.addEventListener('change', hesapla); hesapla();
      kar.append(el('span', 'et', 'İki sonucu karşılaştır:'), A, el('span', '', '→'), B, sonuc);
      dlg.appendChild(kar);
    }
    const sarma = el('div', 'tablo-sarma sg-tablo-kisa'), tablo = el('table'), bs = el('tr');
    ['Tarih', 'Değer', 'Önceki sonuca göre', 'Referans', 'Durum', 'Rapor'].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    const sirali = t.seri;
    [...sirali].reverse().forEach((d, ri) => {
      const idx = sirali.length - 1 - ri;
      const onceki = sirali.slice(0, idx).reverse().find(x => x.deger !== null) ?? null;
      const tr = el('tr');
      const r = raporBul(d.rapor_id);
      tr.append(el('td', '', tarihYaz(d.tarih)), el('td', 'sayi', `${degerMetni(d)} ${d.birim ?? ''}`), el('td', '', farkMetni(farkHesapla(onceki, d))), el('td', '', referans(d.ref_alt, d.ref_ust)));
      const td = el('td'); td.appendChild(durumRozeti(degerDurumu(d)));
      const tdr = el('td');
      if (r) { const b = el('button', 'btn ghost sm', r.ad); b.type = 'button'; b.addEventListener('click', () => { dlg.close(); raporEditoru(r); }); tdr.appendChild(b); }
      tr.append(td, tdr); g.appendChild(tr);
    });
    tablo.appendChild(g); sarma.appendChild(tablo); dlg.appendChild(sarma);
    const kapat = el('button', 'btn ghost', 'Kapat'); kapat.type = 'button'; kapat.addEventListener('click', () => dlg.close());
    dlg.appendChild(kapat);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg); dlg.showModal();
  }

  /* ——— Rapor ekleme / düzenleme ——— */
  function raporEditoru(mevcut?: Rapor) {
    const d = kutu(mevcut ? 'Tahlili düzenle' : 'Tahlil ekle');
    d.dlg.classList.add('genis', 'sg-editor');
    const tarih = girdi('th-tarih', 'date', mevcut?.tarih ?? bugunAnahtari()); tarih.max = bugunAnahtari();
    const ad = girdi('th-ad', 'text', mevcut?.ad ?? ''); ad.maxLength = 200; ad.placeholder = 'Örn. Genel kan tahlili';
    const kurum = girdi('th-kurum', 'text', mevcut?.kurum ?? ''); kurum.maxLength = 200; kurum.placeholder = 'Hastane ya da laboratuvar';
    const not = el('textarea'); not.id = 'th-not'; not.rows = 2; not.maxLength = 4000; not.value = mevcut?.notlar ?? '';
    const dosya = el('input'); dosya.type = 'file'; dosya.id = 'th-dosya'; dosya.accept = 'application/pdf,image/*,.pdf';
    d.alan('Tahlil tarihi', tarih); d.alan('Başlık', ad); d.alan('Kurum', kurum);
    if (mevcut?.dosya_yol) {
      const satir = el('div', 'alan');
      satir.append(el('span', '', 'Yüklü dosya'));
      const ac = el('button', 'btn ghost sm', `${mevcut.dosya_ad ?? 'Dosya'} (aç)`); ac.type = 'button'; ac.addEventListener('click', () => void dosyaAc(mevcut));
      satir.appendChild(ac); d.f.appendChild(satir);
    } else d.alan('Rapor dosyası (PDF ya da fotoğraf)', dosya, `İsteğe bağlı, en fazla ${Math.round(AZAMI_DOSYA / 1048576)} MB. Dosya yalnız sana özel depoda saklanır.`);

    // değer satırları
    const satirlar: Satir[] = s.degerler.filter(x => mevcut && x.rapor_id === mevcut.id).map(x => ({ id: x.id, test: x.test, ad: x.ad, deger: x.deger, metin: x.metin, birim: x.birim, ref_alt: x.ref_alt, ref_ust: x.ref_ust }));
    const mevcutDegerler = s.degerler.filter(x => mevcut && x.rapor_id === mevcut.id);
    const aracCubugu = el('div', 'sg-arac');
    const tabloKap = el('div', 'tablo-sarma sg-deger-kap');
    const liste = el('datalist'); liste.id = 'th-testler';
    KATALOG.forEach(t => liste.appendChild(Object.assign(el('option'), { value: t.ad })));

    /* Aynı testin bu rapor dışındaki en son sonucu: değer girerken karşılaştırma için yanında gösterilir. */
    const oncekiBul = (test: string): Deger | undefined => s.degerler.filter(x => x.test === test && x.rapor_id !== mevcut?.id && x.tarih <= tarih.value).sort((a, b) => b.tarih.localeCompare(a.tarih))[0];
    function tabloCiz() {
      tabloKap.replaceChildren();
      if (!satirlar.length) { tabloKap.appendChild(el('p', 'bos', 'Henüz değer yok. Aşağıdan ekle, metinden ayıkla ya da dosyayı yapay zekâyla okut.')); return; }
      const tablo = el('table', 'sg-deger-tablo'), bs = el('tr');
      ['Test', 'Değer', 'Birim', 'Referans alt', 'Referans üst', 'Durum', ''].forEach(x => bs.appendChild(el('th', '', x)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const g = el('tbody');
      satirlar.forEach((st, i) => {
        const tr = el('tr');
        const mk = (deger: string, uz: number, sinif = '') => { const x = el('input', sinif); x.value = deger; x.maxLength = uz; return x; };
        const adG = mk(st.ad, 120); adG.setAttribute('list', 'th-testler'); adG.setAttribute('aria-label', 'Test adı');
        const dG = mk(st.metin && /^[<>]/.test(st.metin) ? st.metin : st.deger !== null ? String(st.deger) : st.metin ?? '', 40, 'sayi'); dG.inputMode = 'decimal'; dG.setAttribute('aria-label', 'Değer');
        const bG = mk(st.birim ?? '', 30); bG.setAttribute('aria-label', 'Birim');
        const aG = mk(st.ref_alt === null ? '' : String(st.ref_alt), 20, 'sayi'); aG.inputMode = 'decimal'; aG.setAttribute('aria-label', 'Referans alt');
        const uG = mk(st.ref_ust === null ? '' : String(st.ref_ust), 20, 'sayi'); uG.inputMode = 'decimal'; uG.setAttribute('aria-label', 'Referans üst');
        const durumTd = el('td');
        const guncelle = () => {
          st.ad = adG.value.trim();
          const metin = dG.value.trim();
          st.deger = sayiOku(metin);
          st.metin = st.deger !== null && !/^[<>]/.test(metin) ? null : metin || null;
          st.birim = bG.value.trim() || null; st.ref_alt = sayiOku(aG.value); st.ref_ust = sayiOku(uG.value);
          durumTd.replaceChildren(durumRozeti(durumHesapla(st.deger, st.ref_alt, st.ref_ust)));
        };
        const ipucu = el('small', 'takma');
        const ipucuGuncelle = () => {
          const o = oncekiBul(st.test);
          ipucu.textContent = o ? `önceki: ${degerMetni(o)} ${o.birim ?? ''} (${tarihYaz(o.tarih)})` : '';
        };
        ipucuGuncelle();
        adG.addEventListener('change', () => {
          const b = testBul(adG.value);
          if (b) {
            adG.value = b.ad; st.test = b.anahtar;
            if (!bG.value) bG.value = b.birim;
            if (!aG.value && !uG.value) { aG.value = b.alt === undefined ? '' : String(b.alt); uG.value = b.ust === undefined ? '' : String(b.ust); }
          } else st.test = serbestAnahtar(adG.value);
          guncelle(); ipucuGuncelle();
        });
        [dG, bG, aG, uG].forEach(x => x.addEventListener('input', guncelle));
        guncelle();
        const sil = el('button', 'dy-i tehlike', '✕'); sil.type = 'button'; sil.title = 'Satırı sil'; sil.setAttribute('aria-label', 'Satırı sil');
        sil.addEventListener('click', () => { satirlar.splice(i, 1); tabloCiz(); });
        [adG, dG, bG, aG, uG].forEach(x => { const td = el('td'); td.appendChild(x); if (x === adG) td.appendChild(ipucu); tr.appendChild(td); });
        const sd = el('td'); sd.appendChild(sil);
        tr.append(durumTd, sd); g.appendChild(tr);
      });
      tablo.appendChild(g); tabloKap.appendChild(tablo);
    }

    const ekle = (yeni: (Omit<DegerGirdisi, 'test'> & { test?: string })[]) => {
      let n = 0;
      for (const y of yeni) {
        const b = testBul(y.ad);
        const test = y.test ?? b?.anahtar ?? serbestAnahtar(y.ad);
        if (satirlar.some(x => x.test === test)) continue;
        satirlar.push({ test, ad: b?.ad ?? y.ad, deger: y.deger, metin: y.metin, birim: y.birim ?? b?.birim ?? null, ref_alt: y.ref_alt ?? b?.alt ?? null, ref_ust: y.ref_ust ?? b?.ust ?? null });
        n++;
      }
      tabloCiz();
      return n;
    };

    const satirEkle = el('button', 'btn ghost sm', '＋ Değer ekle'); satirEkle.type = 'button';
    satirEkle.addEventListener('click', () => { satirlar.push({ test: serbestAnahtar('yeni-' + satirlar.length), ad: '', deger: null, metin: null, birim: null, ref_alt: null, ref_ust: null }); tabloCiz(); tabloKap.querySelector<HTMLInputElement>('tbody tr:last-child input')?.focus(); });
    const metinden = el('button', 'btn ghost sm', 'Metinden ayıkla'); metinden.type = 'button';
    metinden.addEventListener('click', () => {
      const m = kutu('Metinden ayıkla');
      const alan = el('textarea'); alan.id = 'th-metin'; alan.rows = 10; alan.placeholder = 'Tahlil sonucunu (e-Nabız, hastane portalı ya da PDF\'ten kopyaladığın metni) buraya yapıştır.\nÖrn: Hemoglobin 13,5 g/dL 12.0 - 16.0';
      m.alan('Rapor metni', alan, 'Her satırda test adı, değer, birim ve varsa referans aralığı olmalı.');
      m.kaydet.textContent = 'Ayıkla';
      m.f.addEventListener('submit', e => {
        e.preventDefault();
        const bulunan = metindenAyikla(alan.value);
        if (!bulunan.length) { m.hatayaz('Değer bulunamadı. Satırlar "Ad  değer  birim  alt - üst" biçiminde olmalı.'); return; }
        const n = ekle(bulunan);
        m.dlg.close(); bildir(`${n} değer eklendi${n < bulunan.length ? `, ${bulunan.length - n} tanesi zaten listede` : ''}`);
      });
      m.bitir();
    });
    const yz = el('button', 'btn sm', '✨ Dosyadan oku (yapay zekâ)'); yz.type = 'button';
    yz.addEventListener('click', async () => {
      let f: File | undefined = dosya.files?.[0];
      try {
        if (!f && mevcut?.dosya_yol) {
          const r = await fetch(await imzaliAdres(mevcut.dosya_yol, undefined, 120));
          f = new File([await r.blob()], mevcut.dosya_ad ?? 'tahlil', { type: mevcut.mime ?? '' });
        }
      } catch (e) { bildir(hataMetni(e), undefined, true); return; }
      if (!f) { d.hatayaz('Önce rapor dosyasını seç.'); return; }
      if (!s.aiOnay) {
        if (!(await onayla({ baslik: 'Dosya yapay zekâ servisine gönderilsin mi?', metin: 'Okuma için rapor, Google Gemini servisine gönderilir (kalıcı olarak saklanmadığı varsayılır, ama Google\'ın koşulları geçerlidir). İstemezsen değerleri elle girebilir ya da metni yapıştırabilirsin.', evet: 'Gönder ve oku', tehlike: false }))) return;
        s.aiOnay = true;
      }
      yz.disabled = true; yz.textContent = 'Okunuyor…'; d.hata.hidden = true;
      try {
        const o = await yapayZekaylaOku(f);
        if (o.tarih && !mevcut && o.tarih <= bugunAnahtari()) tarih.value = o.tarih;
        if (o.kurum && !kurum.value) kurum.value = o.kurum;
        if (o.ad && !ad.value) ad.value = o.ad;
        const n = ekle(o.degerler);
        bildir(n ? `${n} değer okundu; kaydetmeden önce kontrol et` : 'Yeni değer bulunamadı');
      } catch (e) { d.hatayaz(hataMetni(e)); }
      yz.disabled = false; yz.textContent = '✨ Dosyadan oku (yapay zekâ)';
    });
    aracCubugu.append(satirEkle, metinden, yz);

    d.f.append(liste, el('h3', 'sg-baslik', 'Değerler'), aracCubugu, tabloKap, el('p', 'sg-not', 'Yapay zekâ ya da metinden gelen değerleri rapordaki ile karşılaştırarak kontrol et. Referans aralığı boşsa genel yetişkin aralığı kullanılır.'));
    tabloCiz();
    const not2 = el('label', 'alan'); not2.append(el('span', '', 'Not'), not); d.f.appendChild(not2);
    d.kaydet.textContent = 'Kaydet';
    d.f.append(d.hata, d.dugmeler);
    if (mevcut) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button';
      sil.addEventListener('click', async () => {
        if (!(await onayla({ baslik: 'Tahlil silinsin mi?', metin: 'Rapor, dosyası ve değerleri kalıcı olarak silinecek. Bu işlem geri alınamaz.', evet: 'Kalıcı sil' }))) return;
        sil.disabled = true;
        try { await raporuSil(mevcut); d.dlg.close(); bildir('Tahlil silindi'); void yukle(); } catch (e) { sil.disabled = false; d.hatayaz(hataMetni(e)); }
      });
      d.dugmeler.appendChild(sil);
    }
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!tarih.value || tarih.value > bugunAnahtari()) { d.hatayaz('Geçerli bir tahlil tarihi seç.'); return; }
      if (!ad.value.trim()) { d.hatayaz('Tahlile bir başlık yaz.'); ad.focus(); return; }
      const bos = satirlar.filter(x => !x.ad.trim() && x.deger === null && !x.metin);
      const dolu = satirlar.filter(x => !bos.includes(x));
      const eksik = dolu.find(x => !x.ad.trim() || (x.deger === null && !x.metin));
      if (eksik) { d.hatayaz(!eksik.ad.trim() ? 'Adı boş bir değer satırı var.' : `"${eksik.ad}" için değer yaz.`); return; }
      d.kaydet.disabled = true; d.hata.hidden = true;
      const g = { tarih: tarih.value, ad: ad.value.trim(), kurum: kurum.value.trim() || null, notlar: not.value.trim() || null };
      try {
        let r: Pick<Rapor, 'id' | 'tarih'>;
        if (mevcut) { await raporGuncelle(mevcut, g); r = { id: mevcut.id, tarih: g.tarih }; }
        else {
          const f = dosya.files?.[0];
          const yuklenen = f ? await dosyaYukle(f) : null;
          r = await raporEkle(g, yuklenen);
        }
        await degerleriKaydet(r, mevcutDegerler, dolu.map(x => ({ ...x, test: x.test.trim() })));
        d.dlg.close(); bildir('Tahlil kaydedildi'); void yukle();
      } catch (err) {
        d.kaydet.disabled = false;
        d.hatayaz(err instanceof Error && err.message.startsWith('boyut:') ? `Dosya çok büyük (en fazla ${Math.round(AZAMI_DOSYA / 1048576)} MB).` : hataMetni(err));
      }
    });
    d.bitir();
  }

  /* ——— Listeler ——— */
  function suzulmus(): TestOzeti[] {
    const q = katla(s.ara.trim());
    return testlereAyir(s.degerler).filter(t => (!q || katla(t.ad).includes(q)) && (!s.grup || testGrubu(t.test) === s.grup) && (!s.sadeceDisi || t.durum === 'dusuk' || t.durum === 'yuksek'));
  }
  const bosMesaj = (kap: HTMLElement, hepsi: number, l: number) => {
    if (!hepsi) { kap.appendChild(el('p', 'bos', 'Henüz tahlil değeri yok. "＋ Tahlil ekle" ile ilk raporunu yükle.')); return true; }
    if (!l) { kap.appendChild(el('p', 'bos', s.sadeceDisi ? 'Referans dışı değer yok.' : 'Aramana uyan test yok.')); return true; }
    return false;
  };

  function degerlerCiz(kap: HTMLElement) {
    const l = suzulmus();
    if (bosMesaj(kap, s.degerler.length, l.length)) return;
    const sarma = el('div', 'tablo-sarma'), tablo = el('table', 'sg-test-tablo'), bs = el('tr');
    ['Test', 'Son değer', 'Önceki', 'Fark', 'Referans', 'Durum', 'Eğilim', 'Tarih'].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    l.forEach(t => {
      const tr = el('tr', 'satir'); tr.tabIndex = 0;
      const ad = el('td'); ad.append(el('b', '', t.ad), el('small', 'takma', `${testGrubu(t.test)} · ${t.seri.length} kayıt`));
      const deger = el('td', 'sayi' + (t.durum === 'dusuk' || t.durum === 'yuksek' ? ' sg-disari' : ''), `${degerMetni(t.son)} ${t.birim ?? ''}`);
      const onceki = el('td', 'sayi');
      if (t.onceki) { onceki.append(`${degerMetni(t.onceki)} `, el('small', 'takma', tarihYaz(t.onceki.tarih))); } else onceki.textContent = '—';
      const dur = el('td'); dur.appendChild(durumRozeti(t.durum));
      const egilim = el('td');
      const sayisal = t.seri.filter(x => x.deger !== null).map(x => ({ x: x.tarih, y: x.deger! }));
      if (sayisal.length > 1) egilim.appendChild(minikCiz(sayisal, t.durum === 'normal' ? 'var(--cyan)' : 'var(--red)'));
      tr.append(ad, deger, onceki, el('td', '', farkMetni(farkHesapla(t.onceki, t.son))), el('td', '', referans(t.son.ref_alt, t.son.ref_ust)), dur, egilim, el('td', '', tarihYaz(t.son.tarih)));
      const ac = () => testDetay(t);
      tr.addEventListener('click', ac); tr.addEventListener('keydown', e => { if (e.key === 'Enter') ac(); });
      g.appendChild(tr);
    });
    tablo.appendChild(g); sarma.appendChild(tablo); kap.appendChild(sarma);
  }

  /* Karşılaştırma tablosu: satırlar testler, sütunlar tahlil tarihleri; her hücre o tarihteki sonuç ve bir öncekine göre yönü. */
  function matrisCiz(kap: HTMLElement) {
    const l = suzulmus();
    if (bosMesaj(kap, s.degerler.length, l.length)) return;
    const tumTarihler = [...new Set(s.degerler.map(d => d.tarih))].sort();
    const tarihler = s.matrisSon > 0 ? tumTarihler.slice(-s.matrisSon) : tumTarihler;
    const sarma = el('div', 'tablo-sarma sg-matris-kap'), tablo = el('table', 'sg-matris'), bs = el('tr');
    bs.appendChild(el('th', 'sg-matris-ilk', 'Test'));
    tarihler.forEach(tar => {
      const r = s.raporlar.find(x => x.tarih === tar);
      const th = el('th', 'sg-matris-tarih');
      const b = el('button', 'sg-matris-baslik', kisaTarih(tar)); b.type = 'button'; b.title = r ? `${r.ad}${r.kurum ? ' · ' + r.kurum : ''} — raporu aç` : tarihYaz(tar);
      if (r) b.addEventListener('click', () => raporEditoru(r));
      th.appendChild(b); bs.appendChild(th);
    });
    bs.appendChild(el('th', '', 'Referans'));
    tablo.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    l.forEach(t => {
      const tr = el('tr');
      const ad = el('th', 'sg-matris-ilk'); const b = el('button', 'sg-matris-baslik', t.ad); b.type = 'button'; b.addEventListener('click', () => testDetay(t)); ad.appendChild(b);
      tr.appendChild(ad);
      tarihler.forEach(tar => {
        const idx = t.seri.findIndex(d => d.tarih === tar);
        const td = el('td', 'sayi');
        if (idx >= 0) {
          const d = t.seri[idx]!;
          const durum = degerDurumu(d);
          td.classList.add('sg-h-' + durum);
          const onceki = t.seri.slice(0, idx).reverse().find(x => x.deger !== null) ?? null;
          const f = farkHesapla(onceki, d);
          td.append(degerMetni(d));
          if (f && Math.abs(f.fark) > 1e-9) td.append(' ', el('span', 'sg-ok', f.fark > 0 ? '↑' : '↓'));
          td.title = `${tarihYaz(tar)} · ${degerMetni(d)} ${d.birim ?? ''} · ${DURUM_ADI[durum]}${f ? ' · ' + farkMetni(f) : ''}`;
        } else td.textContent = '·';
        tr.appendChild(td);
      });
      tr.appendChild(el('td', 'sg-matris-ref', `${referans(t.son.ref_alt, t.son.ref_ust)} ${t.birim ?? ''}`));
      g.appendChild(tr);
    });
    tablo.appendChild(g); sarma.appendChild(tablo); kap.appendChild(sarma);
    if (tumTarihler.length > tarihler.length || s.matrisSon === 0) {
      const d = el('button', 'btn ghost sm', s.matrisSon === 0 ? 'Yalnız son 6 tahlili göster' : `Tüm ${tumTarihler.length} tahlili göster`); d.type = 'button';
      d.addEventListener('click', () => { s.matrisSon = s.matrisSon === 0 ? 6 : 0; ciz(); });
      kap.appendChild(d);
    }
    kap.appendChild(el('p', 'sg-not', 'Hücrelerdeki ↑ ↓ oku, o testin bir önceki sonucuna göre yönü gösterir. Kırmızı: referansın üstünde, turuncu: altında. Başlıktaki tarihe basınca o rapor açılır.'));
  }

  function raporlarCiz(kap: HTMLElement) {
    const q = katla(s.ara.trim());
    const l = s.raporlar.filter(r => !q || katla(`${r.ad} ${r.kurum ?? ''}`).includes(q));
    if (!s.raporlar.length) { kap.appendChild(el('p', 'bos', 'Henüz tahlil raporu yok.')); return; }
    if (!l.length) { kap.appendChild(el('p', 'bos', 'Aramana uyan rapor yok.')); return; }
    const sarma = el('div', 'tablo-sarma'), tablo = el('table'), bs = el('tr');
    ['Tarih', 'Rapor', 'Kurum', 'Değer', 'Referans dışı', ''].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody');
    l.forEach(r => {
      const dr = s.degerler.filter(x => x.rapor_id === r.id);
      const disi = dr.filter(x => ['dusuk', 'yuksek'].includes(degerDurumu(x))).length;
      const tr = el('tr', 'satir'); tr.tabIndex = 0;
      tr.append(el('td', '', tarihYaz(r.tarih)), el('td', '', r.ad), el('td', '', r.kurum ?? '—'), el('td', 'sayi', String(dr.length)), el('td', 'sayi' + (disi ? ' sg-disari' : ''), String(disi)));
      const td = el('td', 'dy-isl');
      if (r.dosya_yol) { const b = el('button', 'dy-i', '📄'); b.type = 'button'; b.title = 'Dosyayı aç'; b.setAttribute('aria-label', 'Dosyayı aç'); b.addEventListener('click', ev => { ev.stopPropagation(); void dosyaAc(r); }); td.appendChild(b); }
      tr.appendChild(td);
      const ac = () => raporEditoru(r);
      tr.addEventListener('click', ac); tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) ac(); });
      g.appendChild(tr);
    });
    tablo.appendChild(g); sarma.appendChild(tablo); kap.appendChild(sarma);
  }

  function ciz() {
    kart.replaceChildren();
    const ust = el('div', 'sg-ust');
    ust.append(el('h2', '', 'Tahliller'), el('span', 'tbar-sp'));
    const yeni = el('button', 'btn primary sm', '＋ Tahlil ekle'); yeni.type = 'button'; yeni.addEventListener('click', () => raporEditoru());
    ust.appendChild(yeni);
    kart.appendChild(ust);
    if (s.yukleniyor) { kart.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      kart.append(el('p', 'bos hata', s.hata), b); return;
    }
    const disiSay = testlereAyir(s.degerler).filter(t => t.durum === 'dusuk' || t.durum === 'yuksek').length;
    if (disiSay) kart.appendChild(el('p', 'sg-uyari', `${disiSay} testin son değeri referans aralığının dışında. Sonuçları doktorunla değerlendir; bu sayfa tanı koymaz.`));
    const sekme = el('div', 'dy-sekme');
    (['degerler', 'karsilastirma', 'raporlar'] as const).forEach(g => {
      const b = el('button', 'dy-s' + (s.gorunum === g ? ' acik' : ''), g === 'degerler' ? `Değerler (${testlereAyir(s.degerler).length})` : g === 'karsilastirma' ? 'Karşılaştırma' : `Raporlar (${s.raporlar.length})`); b.type = 'button';
      b.addEventListener('click', () => { s.gorunum = g; ciz(); });
      sekme.appendChild(b);
    });
    const arac = el('div', 'dy-satir');
    const ara = el('input'); ara.type = 'search'; ara.id = 'th-ara'; ara.placeholder = s.gorunum === 'raporlar' ? 'Rapor ara' : 'Test ara'; ara.value = s.ara; ara.setAttribute('aria-label', 'Ara');
    const icerik = el('div', 'sg-icerik');
    const doldur = () => { icerik.replaceChildren(); if (s.gorunum === 'degerler') degerlerCiz(icerik); else if (s.gorunum === 'karsilastirma') matrisCiz(icerik); else raporlarCiz(icerik); };
    ara.addEventListener('input', () => { s.ara = ara.value; doldur(); });
    arac.appendChild(ara);
    if (s.gorunum !== 'raporlar') {
      const gruplar = [...new Set(testlereAyir(s.degerler).map(x => testGrubu(x.test)))].sort((a, b) => a.localeCompare(b, 'tr'));
      const grupSec = el('select'); grupSec.id = 'th-grup'; grupSec.setAttribute('aria-label', 'Gruba göre süz');
      [['', 'Tüm gruplar'], ...gruplar.map(x => [x, x])].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; grupSec.appendChild(o); });
      grupSec.value = gruplar.includes(s.grup) ? s.grup : '';
      grupSec.addEventListener('change', () => { s.grup = grupSec.value; doldur(); });
      arac.appendChild(grupSec);
      const dis = el('button', 'btn ghost sm' + (s.sadeceDisi ? ' acik' : ''), 'Yalnız referans dışı'); dis.type = 'button';
      dis.addEventListener('click', () => { s.sadeceDisi = !s.sadeceDisi; ciz(); });
      arac.appendChild(dis);
    }
    kart.append(sekme, arac, icerik);
    doldur();
    kart.appendChild(el('p', 'sg-not', 'Referans aralıkları rapordaki değerlerden alınır; rapor aralık vermediyse genel yetişkin aralığı kullanılır. Bu sayfa tıbbi tavsiye ya da tanı yerine geçmez.'));
  }

  ciz();
  void yukle();
}
