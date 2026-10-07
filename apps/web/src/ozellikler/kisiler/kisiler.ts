import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import {
  kisiEkle, kisiGeriAl, kisiGuncelle, kisiSil, kisileriGetir,
  type AltTur, type Kisi, type KisiGirdisi, type KisiTuru,
} from '../../veri/kisiler';

const TUR_AD: Record<KisiTuru, string> = { kisi: 'Kişi', kurum: 'Kurum', firma: 'Firma' };
const ALT_TUR_AD: Record<AltTur, string> = {
  banka: 'Banka', vergi_dairesi: 'Vergi dairesi', sgk: 'SGK', icra_dairesi: 'İcra dairesi',
  avukat: 'Avukat', mahkeme: 'Mahkeme', diger: 'Diğer',
};
const TAKMA_AD_SINIRI = 10;

type Durum = {
  liste: Kisi[];
  yukleniyor: boolean;
  hata: string;
  ara: string;
  tur: '' | KisiTuru;
};

export function kisilerSayfasi(kok: HTMLElement) {
  const d: Durum = { liste: [], yukleniyor: true, hata: '', ara: '', tur: '' };
  const kart = el('section', 'card kisiler');
  kok.replaceChildren(kart);

  /* ---- araç çubuğu ---- */
  const bar = el('div', 'tbar');
  const ara = el('input');
  ara.type = 'search';
  ara.id = 'kisi-ara';
  ara.placeholder = 'Ad, takma ad ya da telefon ara';
  ara.setAttribute('aria-label', 'Kişi ara');
  const turSec = el('select');
  turSec.id = 'kisi-tur';
  turSec.setAttribute('aria-label', 'Türe göre süz');
  [['', 'Hepsi'], ['kisi', 'Kişiler'], ['kurum', 'Kurumlar'], ['firma', 'Firmalar']].forEach(([v, a]) => {
    const o = el('option', '', a); o.value = v!; turSec.appendChild(o);
  });
  const say = el('span', 'tbar-count');
  const yeni = el('button', 'btn primary sm', '+ Yeni kayıt');
  yeni.type = 'button';
  yeni.id = 'kisi-yeni';
  bar.append(ara, turSec, el('span', 'tbar-sp'), say, yeni);

  const icerik = el('div', 'kisiler-icerik');
  kart.append(bar, icerik);

  /* ---- liste ---- */
  const gorunen = () => {
    const t = katla(d.ara.trim());
    return d.liste.filter(k => (!d.tur || k.tur === d.tur)
      && (!t || [k.ad, k.telefon ?? '', ...k.takma_adlar].some(x => katla(x).includes(t))));
  };

  function ciz() {
    const liste = gorunen();
    say.textContent = d.yukleniyor ? '' : `${liste.length} / ${d.liste.length}`;
    icerik.replaceChildren();
    if (d.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (d.hata) {
      const p = el('p', 'bos hata', d.hata);
      const b = el('button', 'btn ghost sm', 'Tekrar dene');
      b.type = 'button';
      b.addEventListener('click', () => void yukle());
      icerik.append(p, b);
      return;
    }
    if (!d.liste.length) {
      icerik.appendChild(el('p', 'bos', 'Henüz kişi ya da kurum yok. Borç, IBAN ve ödeme kayıtlarında kullanacağın herkesi buraya ekle.'));
      return;
    }
    if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan kayıt yok.')); return; }

    const sarma = el('div', 'tablo-sarma');
    const tablo = el('table');
    const bas = el('thead');
    const bs = el('tr');
    ['Ad', 'Tür', 'Telefon', ''].forEach(h => bs.appendChild(el('th', '', h)));
    bas.appendChild(bs);
    const govde = el('tbody');
    liste.forEach(k => {
      const tr = el('tr', 'satir');
      tr.tabIndex = 0;
      tr.dataset.id = k.id;
      const ad = el('td');
      ad.appendChild(el('b', '', k.ad));
      if (k.takma_adlar.length) ad.appendChild(el('small', 'takma', k.takma_adlar.join(' · ')));
      const tur = el('td');
      tur.appendChild(el('span', 'pill', k.alt_tur ? ALT_TUR_AD[k.alt_tur] : TUR_AD[k.tur]));
      const tel = el('td', 'gz', k.telefon ?? '—');
      const islem = el('td', 'islem');
      const duz = el('button', 'btn ghost xs', 'Düzenle');
      duz.type = 'button';
      islem.appendChild(duz);
      tr.append(ad, tur, tel, islem);
      const ac = () => form(k);
      tr.addEventListener('click', ac);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') ac(); });
      govde.appendChild(tr);
    });
    tablo.append(bas, govde);
    sarma.appendChild(tablo);
    icerik.appendChild(sarma);
  }

  async function yukle() {
    d.yukleniyor = true; d.hata = ''; ciz();
    try { d.liste = await kisileriGetir(); }
    catch (e) { d.hata = hataMetni(e); }
    d.yukleniyor = false; ciz();
  }

  function birlestir(k: Kisi) {
    const i = d.liste.findIndex(x => x.id === k.id);
    if (i >= 0) d.liste[i] = k; else d.liste.push(k);
    d.liste.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }

  /* ---- form ---- */
  function form(mevcut?: Kisi) {
    const dlg = el('dialog', 'kutu');
    dlg.setAttribute('aria-label', mevcut ? 'Kaydı düzenle' : 'Yeni kayıt');
    const f = el('form');
    f.noValidate = true;
    f.method = 'dialog';
    f.appendChild(el('h2', '', mevcut ? 'Kaydı düzenle' : 'Yeni kayıt'));

    const alan = (etiket: string, girdi: HTMLElement, ipucu?: string) => {
      const l = el('label', 'alan');
      l.appendChild(el('span', '', etiket));
      l.appendChild(girdi);
      if (ipucu) l.appendChild(el('small', '', ipucu));
      return l;
    };
    const ad = el('input'); ad.id = 'kf-ad'; ad.maxLength = 120; ad.required = true; ad.value = mevcut?.ad ?? '';
    const tur = el('select'); tur.id = 'kf-tur';
    (Object.keys(TUR_AD) as KisiTuru[]).forEach(v => { const o = el('option', '', TUR_AD[v]); o.value = v; tur.appendChild(o); });
    tur.value = mevcut?.tur ?? 'kisi';
    const alt = el('select'); alt.id = 'kf-alt';
    const o0 = el('option', '', '—'); o0.value = ''; alt.appendChild(o0);
    (Object.keys(ALT_TUR_AD) as AltTur[]).forEach(v => { const o = el('option', '', ALT_TUR_AD[v]); o.value = v; alt.appendChild(o); });
    alt.value = mevcut?.alt_tur ?? '';
    const takma = el('input'); takma.id = 'kf-takma'; takma.value = (mevcut?.takma_adlar ?? []).join(', ');
    const tel = el('input'); tel.id = 'kf-tel'; tel.type = 'tel'; tel.maxLength = 40; tel.value = mevcut?.telefon ?? '';
    const not = el('textarea'); not.id = 'kf-not'; not.rows = 3; not.maxLength = 4000; not.value = mevcut?.notlar ?? '';

    const altKap = alan('Kurum türü', alt);
    const altGoster = () => { altKap.hidden = tur.value === 'kisi'; if (tur.value === 'kisi') alt.value = ''; };
    tur.addEventListener('change', altGoster);
    altGoster();

    const hataKutu = el('p', 'form-hata'); hataKutu.hidden = true; hataKutu.setAttribute('role', 'alert');
    f.append(alan('Ad', ad), alan('Tür', tur), altKap,
      alan('Takma adlar', takma, `Virgülle ayır, en çok ${TAKMA_AD_SINIRI}`),
      alan('Telefon', tel), alan('Not', not), hataKutu);

    const alt2 = el('div', 'form-dugmeler');
    const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
    const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button';
    vazgec.addEventListener('click', () => dlg.close());
    alt2.append(kaydet, vazgec);
    if (mevcut) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; sil.id = 'kf-sil';
      let emin = false;
      sil.addEventListener('click', async () => {
        if (!emin) { emin = true; sil.textContent = 'Emin misin? Tekrar bas'; return; }
        sil.disabled = true;
        try {
          const silinen = await kisiSil(mevcut.id, mevcut.surum);
          d.liste = d.liste.filter(x => x.id !== mevcut.id);
          dlg.close(); ciz();
          bildir(`"${mevcut.ad}" silindi`, async () => {
            try { birlestir(await kisiGeriAl(silinen.id, silinen.surum)); ciz(); bildir('Geri alındı'); }
            catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
          });
        } catch (e) {
          sil.disabled = false;
          if (e instanceof CakismaHatasi) { dlg.close(); void yukle(); }
          hataKutu.textContent = hataMetni(e); hataKutu.hidden = false;
        }
      });
      alt2.appendChild(sil);
    }
    f.appendChild(alt2);

    f.addEventListener('submit', async e => {
      e.preventDefault();
      const adi = ad.value.trim();
      if (!adi) { hataKutu.textContent = 'Ad boş olamaz.'; hataKutu.hidden = false; ad.focus(); return; }
      const takmalar = [...new Set(takma.value.split(',').map(x => x.trim()).filter(Boolean))].slice(0, TAKMA_AD_SINIRI);
      const g: KisiGirdisi = {
        ad: adi, tur: tur.value as KisiTuru, alt_tur: (alt.value || null) as AltTur | null,
        takma_adlar: takmalar, telefon: tel.value.trim() || null, notlar: not.value.trim() || null,
      };
      kaydet.disabled = true; hataKutu.hidden = true;
      try {
        const k = mevcut ? await kisiGuncelle(mevcut.id, mevcut.surum, g) : await kisiEkle(g);
        birlestir(k); dlg.close(); ciz(); bildir('Kaydedildi');
      } catch (err) {
        kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
        hataKutu.textContent = hataMetni(err); hataKutu.hidden = false;
      }
    });

    dlg.appendChild(f);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
    ad.focus();
  }

  ara.addEventListener('input', () => { d.ara = ara.value; ciz(); });
  turSec.addEventListener('change', () => { d.tur = turSec.value as Durum['tur']; ciz(); });
  yeni.addEventListener('click', () => form());
  void yukle();
}
