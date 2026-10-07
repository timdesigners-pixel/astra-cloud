import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { istemciAl } from '../../veri/istemci';
import { kisileriGetir } from '../../veri/kisiler';
import {
  odemeBorclariniGetir, odemeGeriAl, odemeGuncelle, odemeIsaretle, odemeleriEkle, odemeleriGetir,
  type Odeme, type OdemeBorcu,
} from '../../veri/odemeler';
import { onayla } from '../../ortak/uyari';

const bugunStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

/* "2026-01-31" + k ay: ayın son gününe taşan günler o ayın sonuna çekilir. */
export function ayEkle(tarih: string, k: number): string {
  const [y, m, d] = tarih.split('-').map(Number);
  const hedef = new Date(Date.UTC(y!, m! - 1 + k, 1));
  const sonGun = new Date(Date.UTC(hedef.getUTCFullYear(), hedef.getUTCMonth() + 1, 0)).getUTCDate();
  hedef.setUTCDate(Math.min(d!, sonGun));
  return hedef.toISOString().slice(0, 10);
}

type Durum = {
  odemeler: Odeme[]; borclar: Map<string, OdemeBorcu>; hesaplar: Map<string, string>; kisiler: Map<string, string>;
  yukleniyor: boolean; hata: string; goster: 'bekleyen' | 'odenen' | 'hepsi';
};


/* Ödemeler menüsü: tek tablonun türe göre süzülmüş sayfaları. tur boşsa hepsi (Ödeme Takvimi). */
export function odemeSayfasi(tur: string) {
  return (kok: HTMLElement) => {
    const s: Durum = { odemeler: [], borclar: new Map(), hesaplar: new Map(), kisiler: new Map(), yukleniyor: true, hata: '', goster: 'bekleyen' };
    const kart = el('section', 'card icra');
    kok.replaceChildren(kart);
    const ozet = el('div', 'icra-ozet');
    const bar = el('div', 'tbar');
    const sec = el('select'); sec.id = 'odeme-goster'; sec.setAttribute('aria-label', 'Göster');
    [['bekleyen', 'Bekleyenler'], ['odenen', 'Ödenenler'], ['hepsi', 'Hepsi']].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; sec.appendChild(o); });
    const say = el('span', 'tbar-count');
    const yeni = el('button', 'btn primary sm', '+ Yeni ödeme'); yeni.type = 'button'; yeni.id = 'odeme-yeni';
    const taksit = el('button', 'btn ghost sm', '+ Taksit planı'); taksit.type = 'button'; taksit.id = 'odeme-taksit';
    bar.append(sec, el('span', 'tbar-sp'), say, taksit, yeni);
    const icerik = el('div', 'icra-icerik');
    kart.append(ozet, bar, icerik);

    const turdeMi = (o: Odeme) => !tur || s.borclar.get(o.borc_id)?.tur === tur;
    const gorunen = () => s.odemeler.filter(o => o.durum !== 'iptal' && turdeMi(o)
      && (s.goster === 'hepsi' || (s.goster === 'bekleyen' ? o.durum === 'bekliyor' : o.durum === 'odendi')));
    const acikBorclar = () => [...s.borclar.values()].filter(b => b.yon === 'borclu' && b.durum !== 'kapandi' && (!tur || b.tur === tur));

    function ozetCiz() {
      ozet.replaceChildren();
      if (s.yukleniyor || s.hata) return;
      const bugun = bugunStr(), ay = bugun.slice(0, 7);
      const tum = s.odemeler.filter(o => o.durum !== 'iptal' && turdeMi(o));
      const bek = tum.filter(o => o.durum === 'bekliyor');
      const topla = (l: Odeme[]) => l.reduce((t, o) => t + Number(o.tutar), 0);
      const geciken = bek.filter(o => o.vade_tarihi < bugun);
      const buAy = bek.filter(o => o.vade_tarihi.slice(0, 7) === ay);
      const odenen = tum.filter(o => o.durum === 'odendi' && (o.odeme_tarihi ?? '').slice(0, 7) === ay);
      const h = (et: string, d: string, not: string, sinif = '') => {
        const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x);
      };
      h('Bekleyen toplam', tl(topla(bek)), `${bek.length} ödeme`, 'vurgu');
      h('Bu ay ödenecek', tl(topla(buAy)), `${buAy.length} ödeme`);
      h('Geciken', tl(topla(geciken)), `${geciken.length} ödeme`, geciken.length ? 'uyari' : '');
      h('Bu ay ödenen', tl(topla(odenen)), `${odenen.length} ödeme`);
    }

    function ciz() {
      const liste = gorunen();
      say.textContent = s.yukleniyor ? '' : String(liste.length);
      ozetCiz();
      icerik.replaceChildren();
      if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
      if (s.hata) {
        const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
        icerik.append(el('p', 'bos hata', s.hata), b); return;
      }
      if (!liste.length) {
        icerik.appendChild(el('p', 'bos', s.goster === 'odenen' ? 'Ödenmiş kayıt yok.' : 'Bekleyen ödeme yok. "Yeni ödeme" ya da "Taksit planı" ile ekleyebilirsin.'));
        return;
      }
      const bugun = bugunStr();
      const sarma = el('div', 'tablo-sarma'), tablo = el('table'), bs = el('tr');
      ['Vade', 'Borç', 'Alacaklı', 'Tutar', 'Durum', 'Hesap', ''].forEach(h => bs.appendChild(el('th', '', h)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const govde = el('tbody');
      liste.forEach(o => {
        const b = s.borclar.get(o.borc_id);
        const tr = el('tr', 'satir'); tr.tabIndex = 0; tr.dataset.id = o.id;
        const gecikmis = o.durum === 'bekliyor' && o.vade_tarihi < bugun;
        const durum = el('td'); durum.appendChild(el('span', 'pill', o.durum === 'odendi' ? 'Ödendi' : gecikmis ? 'Gecikmiş' : 'Bekliyor'));
        const islem = el('td', 'islem');
        const dugme = el('button', 'btn ghost xs', o.durum === 'bekliyor' ? 'Ödendi' : 'Geri al'); dugme.type = 'button';
        dugme.addEventListener('click', e => { e.stopPropagation(); if (o.durum === 'bekliyor') odendiForm(o); else geriAl(o, dugme); });
        islem.appendChild(dugme);
        tr.append(el('td', gecikmis ? 'eski' : '', gun(o.durum === 'odendi' ? o.odeme_tarihi : o.vade_tarihi)), el('td', '', b?.ad ?? '—'),
          el('td', '', s.kisiler.get(b?.alacakli_id ?? '') ?? '—'), el('td', 'sayi gz', tl(Number(o.tutar))), durum,
          el('td', '', s.hesaplar.get(o.hesap_id ?? '') ?? '—'), islem);
        const ac = () => { if (o.durum === 'bekliyor') duzenleForm(o); };
        tr.addEventListener('click', ac);
        tr.addEventListener('keydown', e => { if (e.key === 'Enter') ac(); });
        govde.appendChild(tr);
      });
      tablo.appendChild(govde); sarma.appendChild(tablo); icerik.appendChild(sarma);
    }

    async function yukle() {
      s.yukleniyor = true; s.hata = ''; ciz();
      try {
        const [od, br, ki, he] = await Promise.all([odemeleriGetir(), odemeBorclariniGetir(), kisileriGetir(),
          istemciAl().from('hesaplar').select('id,ad').is('silindi_at', null).order('ad')]);
        if (he.error) throw he.error;
        s.odemeler = od; s.borclar = new Map(br.map(b => [b.id, b]));
        s.kisiler = new Map(ki.map(k => [k.id, k.ad]));
        s.hesaplar = new Map((he.data ?? []).map(h => [h.id as string, h.ad as string]));
      } catch (e) { s.hata = hataMetni(e); }
      s.yukleniyor = false; ciz();
    }

    /* ---- küçük form yardımcıları ---- */
    const kutu = (baslik: string) => {
      const dlg = el('dialog', 'kutu'); dlg.setAttribute('aria-label', baslik);
      const f = el('form'); f.noValidate = true; f.method = 'dialog'; f.appendChild(el('h2', '', baslik));
      const hata = el('p', 'form-hata'); hata.hidden = true; hata.setAttribute('role', 'alert');
      const alan = (et: string, g: HTMLElement, ip?: string) => {
        const l = el('label', 'alan'); l.append(el('span', '', et), g); if (ip) l.appendChild(el('small', '', ip)); f.appendChild(l);
      };
      const dugmeler = el('div', 'form-dugmeler');
      const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
      const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
      dugmeler.append(kaydet, vazgec);
      const bitir = () => { f.append(hata, dugmeler); dlg.appendChild(f); dlg.addEventListener('close', () => dlg.remove()); document.body.appendChild(dlg); dlg.showModal(); f.querySelector<HTMLElement>('input,select')?.focus(); };
      const hatayaz = (m: string) => { hata.textContent = m; hata.hidden = false; };
      return { dlg, f, alan, kaydet, dugmeler, bitir, hatayaz };
    };
    const secim = (id: string, secenek: [string, string][], deger = '') => {
      const x = el('select'); x.id = id; const b = el('option', '', '—'); b.value = ''; x.appendChild(b);
      secenek.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; x.appendChild(o); }); x.value = deger; return x;
    };
    const girdi = (id: string, tip: string, deger = '') => { const i = el('input'); i.id = id; i.type = tip; i.value = deger; if (tip === 'number') i.step = '0.01'; return i; };
    const borcSecenekleri = (): [string, string][] => acikBorclar().map(b => [b.id, `${b.ad} · ${tl(Number(b.guncel_borc))}`]);
    const hesapSecenekleri = (): [string, string][] => [...s.hesaplar.entries()].map(([id, ad]) => [id, ad]);

    function odendiForm(o: Odeme) {
      const b = s.borclar.get(o.borc_id);
      const k = kutu('Ödendi olarak işaretle');
      k.f.appendChild(el('p', 'alt', `${b?.ad ?? ''} · ${tl(Number(o.tutar))}`));
      const hesap = secim('of-hesap', hesapSecenekleri(), o.hesap_id ?? b?.hesap_id ?? '');
      const tarih = girdi('of-tarih', 'date', bugunStr());
      k.alan('Ödenen hesap', hesap, hesapSecenekleri().length ? 'Tutar bu hesaptan düşer' : 'Önce Rehber › Banka Hesaplarım\'dan hesap ekle');
      k.alan('Ödeme tarihi', tarih);
      k.f.addEventListener('submit', async e => {
        e.preventDefault();
        if (!hesap.value) { k.hatayaz('Hesap seç.'); return; }
        if (!tarih.value) { k.hatayaz('Tarih seç.'); return; }
        k.kaydet.disabled = true;
        try { await odemeIsaretle(o.id, hesap.value, tarih.value); k.dlg.close(); bildir('Ödendi olarak işaretlendi'); await yukle(); }
        catch (err) { k.kaydet.disabled = false; k.hatayaz(hataMetni(err)); }
      });
      k.bitir();
    }

    async function geriAl(o: Odeme, d: HTMLButtonElement) {
      if (!(await onayla({ baslik: 'Ödeme geri alınsın mı?', metin: 'Ödeme yeniden "bekliyor" olur, hesaba işlenen hareket geri alınır.', evet: 'Geri al' }))) return;
      d.disabled = true;
      odemeGeriAl(o.id).then(() => { bildir('Ödeme geri alındı'); return yukle(); }).catch(e => { d.disabled = false; bildir(hataMetni(e), undefined, true); });
    }

    function duzenleForm(o: Odeme) {
      const k = kutu('Ödemeyi düzenle');
      const vade = girdi('df-vade', 'date', o.vade_tarihi), tutar = girdi('df-tutar', 'number', String(o.tutar));
      const hesap = secim('df-hesap', hesapSecenekleri(), o.hesap_id ?? ''), not = el('textarea'); not.id = 'df-not'; not.rows = 2; not.value = o.notlar ?? '';
      k.alan('Vade tarihi', vade); k.alan('Tutar (TL)', tutar); k.alan('Ödenecek hesap', hesap); k.alan('Not', not);
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; sil.id = 'df-sil';
      sil.addEventListener('click', async () => {
        if (!(await onayla({ baslik: 'Silinsin mi?', metin: 'Bu kayıt silinecek.', evet: 'Sil' }))) return;
        sil.disabled = true;
        try {
          const g = await odemeGuncelle(o.id, o.surum, { silindi_at: new Date().toISOString() });
          s.odemeler = s.odemeler.filter(x => x.id !== o.id); k.dlg.close(); ciz();
          bildir('Ödeme silindi', async () => {
            try { s.odemeler.push(await odemeGuncelle(g.id, g.surum, { silindi_at: null })); ciz(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
          });
        } catch (err) { sil.disabled = false; if (err instanceof CakismaHatasi) { k.dlg.close(); void yukle(); } k.hatayaz(hataMetni(err)); }
      });
      k.dugmeler.appendChild(sil);
      k.f.addEventListener('submit', async e => {
        e.preventDefault();
        const t = Number(tutar.value.replace(',', '.'));
        if (!vade.value || !(t > 0)) { k.hatayaz('Vade tarihi ve sıfırdan büyük tutar gerekli.'); return; }
        k.kaydet.disabled = true;
        try {
          const g = await odemeGuncelle(o.id, o.surum, { vade_tarihi: vade.value, tutar: t, hesap_id: hesap.value || null, notlar: not.value.trim() || null });
          s.odemeler = s.odemeler.map(x => (x.id === g.id ? g : x)); k.dlg.close(); ciz(); bildir('Kaydedildi');
        } catch (err) {
          k.kaydet.disabled = false;
          if (err instanceof CakismaHatasi) { k.dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
          k.hatayaz(hataMetni(err));
        }
      });
      k.bitir();
    }

    function yeniForm(taksitli: boolean) {
      const k = kutu(taksitli ? 'Taksit planı oluştur' : 'Yeni ödeme');
      const borc = secim('yf-borc', borcSecenekleri());
      const vade = girdi('yf-vade', 'date', bugunStr()), tutar = girdi('yf-tutar', 'number');
      const adet = girdi('yf-adet', 'number', '12'); adet.step = '1'; adet.min = '1'; adet.max = '120';
      const hesap = secim('yf-hesap', hesapSecenekleri()), not = el('textarea'); not.id = 'yf-not'; not.rows = 2;
      k.alan('Borç', borc, borcSecenekleri().length ? undefined : 'Önce Borçlar menüsünden bir borç ekle');
      if (taksitli) { k.alan('Taksit sayısı', adet); k.alan('İlk vade', vade); k.alan('Taksit tutarı (TL)', tutar, 'Her ay aynı gün, aynı tutar'); }
      else { k.alan('Vade tarihi', vade); k.alan('Tutar (TL)', tutar); }
      k.alan('Ödenecek hesap', hesap); k.alan('Not', not);
      borc.addEventListener('change', () => { const b = s.borclar.get(borc.value); if (b?.hesap_id && !hesap.value) hesap.value = b.hesap_id; });
      k.f.addEventListener('submit', async e => {
        e.preventDefault();
        const t = Number(tutar.value.replace(',', '.')), n = taksitli ? Number(adet.value) : 1;
        if (!borc.value || !vade.value || !(t > 0)) { k.hatayaz('Borç, vade tarihi ve sıfırdan büyük tutar gerekli.'); return; }
        if (!Number.isInteger(n) || n < 1 || n > 120) { k.hatayaz('Taksit sayısı 1 ile 120 arasında olmalı.'); return; }
        k.kaydet.disabled = true;
        try {
          const yeniler = await odemeleriEkle(Array.from({ length: n }, (_, i) => ({
            borc_id: borc.value, hesap_id: hesap.value || null, vade_tarihi: ayEkle(vade.value, i), tutar: t, notlar: not.value.trim() || null,
          })));
          s.odemeler = [...s.odemeler, ...yeniler].sort((a, b) => a.vade_tarihi.localeCompare(b.vade_tarihi));
          k.dlg.close(); ciz(); bildir(n > 1 ? `${n} taksit eklendi` : 'Ödeme eklendi');
        } catch (err) { k.kaydet.disabled = false; k.hatayaz(hataMetni(err)); }
      });
      k.bitir();
    }

    sec.addEventListener('change', () => { s.goster = sec.value as Durum['goster']; ciz(); });
    yeni.addEventListener('click', () => yeniForm(false));
    taksit.addEventListener('click', () => yeniForm(true));
    void yukle();
  };
}

