import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Filtre, type Kayit } from '../../veri/kayit';
import { kisileriGetir } from '../../veri/kisiler';
import { istemciAl } from '../../veri/istemci';

export type Alan = {
  ad: string;
  etiket: string;
  tur: 'metin' | 'sayi' | 'tarih' | 'secim' | 'kisi' | 'hesap' | 'onay' | 'uzun';
  secenekler?: [string, string][];
  zorunlu?: boolean;
  ipucu?: string;
  varsayilan?: unknown;
};

/* dis: sayfaya özel ek veri (ör. altın kuru, hesap hareket toplamları); yüklenemezse boş nesne. */
export type Baglam = { kisiler: Map<string, string>; hesaplar: Map<string, string>; dis: any };
export type Sutun = { baslik: string; goster: (k: Kayit, b: Baglam) => string; sayi?: boolean };
export type Hucre = [etiket: string, deger: string, not?: string, sinif?: string];

export type KayitAyari = {
  tablo: string;
  yeniDugme: string;
  yeniBaslik: string;
  bos: string;
  alanlar: Alan[];
  sutunlar: Sutun[];
  /* Sunucuda süzülen sabit koşul ve yeni kayıtta sabit yazılan değerler. */
  filtre: Filtre;
  sabit?: Record<string, unknown>;
  sirala: string;
  aramaAlanlari?: string[];
  ozet?: (liste: Kayit[], b: Baglam) => Hucre[];
  dis?: () => Promise<unknown>;
  hazirla?: (g: Record<string, unknown>) => Record<string, unknown>;
  dogrula?: (g: Record<string, unknown>) => string | null;
};

export const sayi = (v: unknown) => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? 0 : Number(v));

async function hesaplariGetir(): Promise<Map<string, string>> {
  const { data, error } = await istemciAl().from('hesaplar').select('id,ad').is('silindi_at', null).order('ad');
  if (error) throw error;
  return new Map((data ?? []).map(h => [h.id as string, h.ad as string]));
}

/* Ayara göre liste + yeni/düzenle formu + geri alınabilir silme üreten genel veri sayfası. */
export function kayitSayfasi(a: KayitAyari) {
  return (kok: HTMLElement) => {
    const sutunlar = a.alanlar.map(x => x.ad);
    const s = { liste: [] as Kayit[], b: { kisiler: new Map(), hesaplar: new Map(), dis: {} } as Baglam, yukleniyor: true, hata: '', ara: '' };
    const kart = el('section', 'card icra');
    kok.replaceChildren(kart);

    const ozet = el('div', 'icra-ozet');
    const bar = el('div', 'tbar');
    const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Ara'; ara.setAttribute('aria-label', 'Ara');
    const say = el('span', 'tbar-count');
    const yeni = el('button', 'btn primary sm', a.yeniDugme); yeni.type = 'button';
    bar.append(ara, el('span', 'tbar-sp'), say, yeni);
    const icerik = el('div', 'icra-icerik');
    kart.append(ozet, bar, icerik);

    const metinSatiri = (k: Kayit) => (a.aramaAlanlari ?? ['ad']).map(f => String(k[f] ?? '')).join(' ');
    const gorunen = () => {
      const t = katla(s.ara.trim());
      return t ? s.liste.filter(k => katla(metinSatiri(k)).includes(t)) : s.liste;
    };

    function ciz() {
      const liste = gorunen();
      say.textContent = s.yukleniyor ? '' : `${liste.length} / ${s.liste.length}`;
      ozet.replaceChildren();
      if (!s.yukleniyor && !s.hata && a.ozet) {
        for (const [et, deger, not, sinif] of a.ozet(s.liste, s.b)) {
          const h = el('div', 'icra-hucre ' + (sinif ?? ''));
          h.append(el('span', 'et', et), el('b', 'gz', deger));
          if (not) h.appendChild(el('small', '', not));
          ozet.appendChild(h);
        }
      }
      icerik.replaceChildren();
      if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
      if (s.hata) {
        const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
        icerik.append(el('p', 'bos hata', s.hata), b);
        return;
      }
      if (!s.liste.length) { icerik.appendChild(el('p', 'bos', a.bos)); return; }
      if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan kayıt yok.')); return; }
      const sarma = el('div', 'tablo-sarma');
      const tablo = el('table');
      const bs = el('tr');
      a.sutunlar.forEach(c => bs.appendChild(el('th', '', c.baslik)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const govde = el('tbody');
      liste.forEach(k => {
        const tr = el('tr', 'satir'); tr.tabIndex = 0; tr.dataset.id = k.id;
        a.sutunlar.forEach(c => tr.appendChild(el('td', c.sayi ? 'sayi gz' : '', c.goster(k, s.b))));
        const ac = () => form(k);
        tr.addEventListener('click', ac);
        tr.addEventListener('keydown', e => { if (e.key === 'Enter') ac(); });
        govde.appendChild(tr);
      });
      tablo.appendChild(govde);
      sarma.appendChild(tablo);
      icerik.appendChild(sarma);
    }

    async function yukle() {
      s.yukleniyor = true; s.hata = ''; ciz();
      try {
        const [liste, kisiler, hesaplar, dis] = await Promise.all([
          kayitlariGetir(a.tablo, sutunlar, a.filtre, a.sirala),
          kisileriGetir(),
          hesaplariGetir(),
          a.dis ? a.dis().catch(() => ({})) : Promise.resolve({}),
        ]);
        s.liste = liste;
        s.b = { kisiler: new Map(kisiler.map(x => [x.id, x.ad])), hesaplar, dis };
      } catch (e) { s.hata = hataMetni(e); }
      s.yukleniyor = false; ciz();
    }

    function birlestir(k: Kayit) {
      const i = s.liste.findIndex(x => x.id === k.id);
      if (i >= 0) s.liste[i] = k; else s.liste.push(k);
    }

    function form(mevcut?: Kayit) {
      const dlg = el('dialog', 'kutu');
      dlg.setAttribute('aria-label', mevcut ? 'Kaydı düzenle' : a.yeniBaslik);
      const f = el('form'); f.noValidate = true; f.method = 'dialog';
      f.appendChild(el('h2', '', mevcut ? 'Kaydı düzenle' : a.yeniBaslik));
      const girdiler = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
      for (const al of a.alanlar) {
        const l = el('label', 'alan'); l.appendChild(el('span', '', al.etiket + (al.zorunlu ? ' *' : '')));
        let g: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const eski = mevcut ? mevcut[al.ad] : al.varsayilan;
        if (al.tur === 'secim' || al.tur === 'kisi' || al.tur === 'hesap') {
          const sec = el('select');
          const bos = el('option', '', '—'); bos.value = ''; sec.appendChild(bos);
          const secenek: [string, string][] = al.tur === 'secim' ? (al.secenekler ?? [])
            : [...(al.tur === 'kisi' ? s.b.kisiler : s.b.hesaplar).entries()].map(([id, ad]) => [id, ad]);
          secenek.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; sec.appendChild(o); });
          sec.value = eski === null || eski === undefined ? '' : String(eski);
          g = sec;
        } else if (al.tur === 'uzun') {
          const t = el('textarea'); t.rows = 3; t.value = eski ? String(eski) : ''; g = t;
        } else {
          const i = el('input');
          i.type = al.tur === 'sayi' ? 'number' : al.tur === 'tarih' ? 'date' : al.tur === 'onay' ? 'checkbox' : 'text';
          if (al.tur === 'sayi') { i.step = '0.01'; i.inputMode = 'decimal'; }
          if (al.tur === 'onay') i.checked = eski === undefined ? true : !!eski;
          else i.value = eski === null || eski === undefined ? '' : String(eski);
          g = i;
        }
        g.id = 'kf-' + al.ad;
        girdiler.set(al.ad, g);
        l.appendChild(g);
        if (al.ipucu) l.appendChild(el('small', '', al.ipucu));
        f.appendChild(l);
      }
      const hataKutu = el('p', 'form-hata'); hataKutu.hidden = true; hataKutu.setAttribute('role', 'alert');
      f.appendChild(hataKutu);
      const alt = el('div', 'form-dugmeler');
      const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
      const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
      alt.append(kaydet, vazgec);
      if (mevcut) {
        const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; sil.id = 'kf-sil';
        let emin = false;
        sil.addEventListener('click', async () => {
          if (!emin) { emin = true; sil.textContent = 'Emin misin? Tekrar bas'; return; }
          sil.disabled = true;
          try {
            const silinen = await kayitGuncelle(a.tablo, sutunlar, mevcut.id, mevcut.surum, { silindi_at: new Date().toISOString() });
            s.liste = s.liste.filter(x => x.id !== mevcut.id);
            dlg.close(); ciz();
            bildir('Kayıt silindi', async () => {
              try { birlestir(await kayitGuncelle(a.tablo, sutunlar, silinen.id, silinen.surum, { silindi_at: null })); ciz(); bildir('Geri alındı'); }
              catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
            });
          } catch (e) {
            sil.disabled = false;
            if (e instanceof CakismaHatasi) { dlg.close(); void yukle(); }
            hataKutu.textContent = hataMetni(e); hataKutu.hidden = false;
          }
        });
        alt.appendChild(sil);
      }
      f.appendChild(alt);

      f.addEventListener('submit', async e => {
        e.preventDefault();
        const g: Record<string, unknown> = {};
        for (const al of a.alanlar) {
          const i = girdiler.get(al.ad)!;
          if (al.tur === 'onay') { g[al.ad] = (i as HTMLInputElement).checked; continue; }
          const v = i.value.trim();
          if (al.zorunlu && !v) { hataKutu.textContent = `${al.etiket} boş olamaz.`; hataKutu.hidden = false; i.focus(); return; }
          g[al.ad] = v === '' ? null : al.tur === 'sayi' ? Number(v.replace(',', '.')) : v;
          if (al.tur === 'sayi' && g[al.ad] !== null && !Number.isFinite(g[al.ad] as number)) { hataKutu.textContent = `${al.etiket} sayı olmalı.`; hataKutu.hidden = false; i.focus(); return; }
        }
        const son = a.hazirla ? a.hazirla(g) : g;
        const h = a.dogrula?.(son);
        if (h) { hataKutu.textContent = h; hataKutu.hidden = false; return; }
        kaydet.disabled = true; hataKutu.hidden = true;
        try {
          const k = mevcut
            ? await kayitGuncelle(a.tablo, sutunlar, mevcut.id, mevcut.surum, son)
            : await kayitEkle(a.tablo, sutunlar, { ...a.sabit, ...son });
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
      f.querySelector<HTMLElement>('input,select,textarea')?.focus();
    }

    ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
    yeni.addEventListener('click', () => form());
    void yukle();
  };
}
