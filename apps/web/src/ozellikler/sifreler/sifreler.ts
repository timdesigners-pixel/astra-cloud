import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { sifreGeriAl, sifreGoster, sifreKaydet, sifreSil, sifreleriGetir, type SifreHesabi } from '../../veri/sifreler';
import { girdi, guvenliBaglanti, kutu } from '../notlar/ortak';

const KATEGORILER = ['Banka', 'E-devlet', 'Vergi / SGK', 'Alışveriş', 'Sosyal medya', 'E-posta', 'Diğer'];
const GOSTERIM_SURESI = 15000;

async function kopyala(metin: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(metin); return true; } catch { return false; }
}

export function sifrelerSayfasi(kok: HTMLElement) {
  const s = { liste: [] as SifreHesabi[], yukleniyor: true, hata: '', ara: '', acik: new Map<string, { sifre: string; zaman: number }>() };
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  const bar = el('div', 'tbar');
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Hizmet, kullanıcı adı ya da not ara'; ara.setAttribute('aria-label', 'Ara');
  const say = el('span', 'tbar-count');
  const yeni = el('button', 'btn primary sm', '+ Yeni hesap'); yeni.type = 'button'; yeni.id = 'sifre-yeni';
  bar.append(ara, el('span', 'tbar-sp'), say, yeni);
  const uyari = el('p', 'sifre-not', 'Kullanıcı adı, şifre ve notlar şifreli saklanır. Şifre listede gizlidir; yalnız "Göster" dediğinde 15 saniye görünür.');
  const icerik = el('div', 'icra-icerik');
  kart.append(bar, uyari, icerik);

  const gorunen = () => {
    const t = katla(s.ara.trim());
    return s.liste.filter(x => !t || katla([x.hizmet, x.kategori ?? '', x.kullanici ?? '', x.notlar ?? '', x.adres ?? ''].join(' ')).includes(t));
  };
  let zamanlayici = 0;
  const gizlemeKur = () => {
    window.clearTimeout(zamanlayici);
    if (!s.acik.size) return;
    zamanlayici = window.setTimeout(() => {
      const simdi = Date.now();
      for (const [id, v] of s.acik) if (simdi - v.zaman >= GOSTERIM_SURESI) s.acik.delete(id);
      ciz();
    }, 1000);
  };

  function ciz() {
    const liste = gorunen();
    say.textContent = s.yukleniyor ? '' : `${liste.length} / ${s.liste.length}`;
    icerik.replaceChildren();
    if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      icerik.append(el('p', 'bos hata', s.hata), b); return;
    }
    if (!s.liste.length) { icerik.appendChild(el('p', 'bos', 'Henüz kayıtlı hesap yok. Giriş bilgilerini buraya ekleyebilirsin.')); return; }
    if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan hesap yok.')); return; }
    const sarma = el('div', 'tablo-sarma'), tablo = el('table'), bs = el('tr');
    ['Hizmet', 'Kullanıcı adı', 'Şifre', ''].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const govde = el('tbody');
    liste.forEach(x => {
      const tr = el('tr', 'satir'); tr.dataset.id = x.id;
      const hizmet = el('td'); hizmet.appendChild(el('b', 'gz', x.hizmet));
      const alt = [x.kategori].filter(Boolean).join(' · ');
      if (alt) hizmet.appendChild(el('small', 'takma', alt));
      const baglanti = guvenliBaglanti(x.adres);
      if (baglanti) { const a = el('a', 'takma', 'Siteyi aç'); a.href = baglanti; a.target = '_blank'; a.rel = 'noopener noreferrer'; hizmet.appendChild(a); }
      const kul = el('td'); kul.appendChild(el('span', 'gz', x.kullanici ?? '—'));
      if (x.kullanici) kul.appendChild(dugme('Kopyala', 'kul-kopya', async () => { bildir(await kopyala(x.kullanici!) ? 'Kullanıcı adı kopyalandı' : 'Kopyalanamadı', undefined, false); }));
      const sf = el('td', 'sifre-hucre');
      const acik = s.acik.get(x.id);
      if (!x.sifre_var) sf.appendChild(el('span', 'dim', '—'));
      else if (acik) {
        sf.appendChild(el('code', 'sifre-metin', acik.sifre));
        sf.appendChild(dugme('Kopyala', 'sifre-kopya', async () => { bildir(await kopyala(acik.sifre) ? 'Şifre kopyalandı' : 'Kopyalanamadı'); }));
        sf.appendChild(dugme('Gizle', 'sifre-gizle', () => { s.acik.delete(x.id); ciz(); }));
      } else {
        sf.appendChild(el('span', 'sifre-nokta', '••••••••'));
        sf.appendChild(dugme('Göster', 'sifre-goster', async () => {
          try { const v = await sifreGoster(x.id); s.acik.set(x.id, { sifre: v, zaman: Date.now() }); ciz(); gizlemeKur(); } catch (e) { bildir(hataMetni(e), undefined, true); }
        }));
      }
      const islem = el('td');
      islem.appendChild(dugme('Düzenle', 'sifre-duzenle', () => form(x)));
      tr.append(hizmet, kul, sf, islem); govde.appendChild(tr);
    });
    tablo.appendChild(govde); sarma.appendChild(tablo); icerik.appendChild(sarma);
  }

  function dugme(metin: string, sinif: string, tikla: () => void | Promise<void>) {
    const b = el('button', 'btn ghost sm ' + sinif, metin); b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); void tikla(); });
    return b;
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { s.liste = await sifreleriGetir(); } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  function form(m?: SifreHesabi) {
    const d = kutu(m ? 'Hesabı düzenle' : 'Yeni hesap');
    const hizmet = girdi('sf-hizmet', 'text', m?.hizmet ?? ''); hizmet.maxLength = 120; hizmet.placeholder = 'Örnek: Ziraat Bankası';
    const kat = girdi('sf-kategori', 'text', m?.kategori ?? ''); kat.maxLength = 40; kat.setAttribute('list', 'sf-kategori-liste');
    const dl = el('datalist'); dl.id = 'sf-kategori-liste'; KATEGORILER.forEach(k => { const o = el('option'); o.value = k; dl.appendChild(o); });
    const adres = girdi('sf-adres', 'text', m?.adres ?? ''); adres.maxLength = 500; adres.placeholder = 'https://…';
    const kul = girdi('sf-kullanici', 'text', m?.kullanici ?? ''); kul.maxLength = 300; kul.autocomplete = 'off';
    const sifre = girdi('sf-sifre', 'password', ''); sifre.maxLength = 300; sifre.autocomplete = 'new-password';
    if (m?.sifre_var) sifre.placeholder = 'Değiştirmek istemiyorsan boş bırak';
    const not = el('textarea'); not.id = 'sf-not'; not.rows = 3; not.maxLength = 4000; not.value = m?.notlar ?? '';
    d.alan('Hizmet', hizmet); d.alan('Kategori', kat); d.f.appendChild(dl); d.alan('Adres', adres);
    d.alan('Kullanıcı adı', kul, 'Şifreli saklanır'); d.alan('Şifre', sifre, 'Şifreli saklanır'); d.alan('Not', not, 'Güvenlik sorusu gibi bilgileri yazabilirsin; şifreli saklanır');
    if (m) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; let emin = false;
      sil.addEventListener('click', async () => {
        if (!emin) { emin = true; sil.textContent = 'Emin misin? Tekrar bas'; return; }
        sil.disabled = true;
        try {
          const silinen = await sifreSil(m.id, m.surum);
          s.liste = s.liste.filter(x => x.id !== m.id); s.acik.delete(m.id); d.dlg.close(); ciz();
          bildir('Hesap silindi', async () => { try { await sifreGeriAl(silinen.id, silinen.surum); await yukle(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
        } catch (err) { sil.disabled = false; if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); } d.hatayaz(hataMetni(err)); }
      });
      d.dugmeler.appendChild(sil);
    }
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!hizmet.value.trim()) { d.hatayaz('Hizmet adı boş olamaz.'); hizmet.focus(); return; }
      d.kaydet.disabled = true; d.hata.hidden = true;
      try {
        const k = await sifreKaydet({ hizmet: hizmet.value, kategori: kat.value, adres: adres.value, kullanici: kul.value, sifre: sifre.value, notlar: not.value }, m);
        if (m) s.acik.delete(m.id);
        const i = s.liste.findIndex(x => x.id === k.id); if (i >= 0) s.liste[i] = k; else s.liste.push(k);
        s.liste.sort((p, q) => p.hizmet.localeCompare(q.hizmet, 'tr'));
        d.dlg.close(); ciz(); bildir('Kaydedildi');
      } catch (err) {
        d.kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
        d.hatayaz(hataMetni(err));
      }
    });
    d.bitir();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
  yeni.addEventListener('click', () => form());
  void yukle();
}
