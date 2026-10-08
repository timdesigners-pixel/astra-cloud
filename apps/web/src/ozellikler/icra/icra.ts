import { el, katla } from '../../ortak/dom';
import { gun, gunFarki, tl } from '../../ortak/bicim';
import { hataMetni } from '../../veri/hata';
import { bakiyeGecerliMi, gecerliBakiye, icraDosyalariniGetir, type IcraDosyasi } from '../../veri/icra';
import { kisileriGetir, type Kisi } from '../../veri/kisiler';
import { icraDogrulaSihirbazi, icraFormu } from './icra-form';
import { dosyaKlasoruAc } from '../dosyalar/dosyalar';

const ONCELIK: Record<number, string> = { 1: 'ACİL', 2: 'BÜYÜK', 3: 'KÜÇÜK', 4: 'BAĞLI' };
/* Doğrulama tarihi bu günden eskiyse uyarı çıkar (sistem kuralı: 30 gün). */
const ESKI_GUN = 30;

type Durum = {
  dosyalar: IcraDosyasi[];
  adlar: Map<string, string>;
  kisiler: Kisi[];
  yukleniyor: boolean;
  hata: string;
  ara: string;
  durum: '' | 'acik' | 'kapandi';
  rol: '' | 'Borçlu' | 'Alacaklı';
};

const acikMi = (d: IcraDosyasi) => d.durum === 'acik';

export function icraBorclariSayfasi(kok: HTMLElement) {
  const s: Durum = { dosyalar: [], adlar: new Map(), kisiler: [], yukleniyor: true, hata: '', ara: '', durum: '', rol: '' };
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);

  const ozet = el('div', 'icra-ozet');
  const bar = el('div', 'tbar');
  const ara = el('input'); ara.type = 'search'; ara.id = 'icra-ara'; ara.placeholder = 'Dosya no, daire ya da alacaklı ara';
  ara.setAttribute('aria-label', 'İcra dosyası ara');
  const durumSec = el('select'); durumSec.id = 'icra-durum'; durumSec.setAttribute('aria-label', 'Duruma göre süz');
  [['', 'Tüm durumlar'], ['acik', 'Açık'], ['kapandi', 'Kapalı']].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; durumSec.appendChild(o); });
  const rolSec = el('select'); rolSec.id = 'icra-rol'; rolSec.setAttribute('aria-label', 'Role göre süz');
  [['', 'Her iki rol'], ['Borçlu', 'Borçlu olduğum'], ['Alacaklı', 'Alacaklı olduğum']].forEach(([v, a]) => { const o = el('option', '', a); o.value = v!; rolSec.appendChild(o); });
  const say = el('span', 'tbar-count');
  const yeniD = el('button', 'btn primary sm', '+ Yeni icra dosyası'); yeniD.type = 'button'; yeniD.id = 'icra-yeni';
  const dogrulaD = el('button', 'btn ghost sm', 'Sırayla doğrula'); dogrulaD.type = 'button'; dogrulaD.id = 'icra-dogrula'; dogrulaD.hidden = true;
  bar.append(ara, durumSec, rolSec, el('span', 'tbar-sp'), say, dogrulaD, yeniD);
  const icerik = el('div', 'icra-icerik');
  kart.append(ozet, bar, icerik);

  const gorunen = () => {
    const t = katla(s.ara.trim());
    return s.dosyalar.filter(d => (!s.durum || d.durum === s.durum) && (!s.rol || d.taraf_rolu === s.rol)
      && (!t || [d.dosya_no ?? '', d.icra_dairesi ?? '', s.adlar.get(d.alacakli_id ?? '') ?? '', d.karsi_taraf ?? ''].some(x => katla(x).includes(t))));
  };

  const bayatlar = () => s.dosyalar.filter(d => acikMi(d) && d.taraf_rolu !== 'Alacaklı' && (() => { const f = gunFarki(d.dogrulama_tarihi); return f === null || f > ESKI_GUN; })())
    .sort((a, b) => (b.guncel_toplam_borc ?? 0) - (a.guncel_toplam_borc ?? 0));
  const kayitGuncelle = (d: IcraDosyasi) => { const i = s.dosyalar.findIndex(x => x.id === d.id); if (i >= 0) s.dosyalar[i] = d; else s.dosyalar.push(d); ciz(); };
  const formAc = (mevcut?: IcraDosyasi) => icraFormu({
    mevcut, kisiler: s.kisiler,
    kaydedildi: (d, yeni) => { if (yeni) kayitGuncelle(d); else void yukle(); },
    silindi: d => { s.dosyalar = s.dosyalar.filter(x => x.id !== d.id); ciz(); },
  });
  yeniD.addEventListener('click', () => formAc());
  dogrulaD.addEventListener('click', () => { const l = bayatlar(); if (l.length) icraDogrulaSihirbazi({ liste: l, guncellendi: kayitGuncelle }); });

  function ozetCiz() {
    ozet.replaceChildren();
    if (s.yukleniyor || s.hata) return;
    const borclu = s.dosyalar.filter(d => acikMi(d) && d.taraf_rolu !== 'Alacaklı');
    const alacakli = s.dosyalar.filter(d => acikMi(d) && d.taraf_rolu === 'Alacaklı');
    const topla = (l: IcraDosyasi[]) => l.reduce((t, d) => t + gecerliBakiye(d), 0);
    const sayilmayan = [...borclu, ...alacakli].filter(d => !bakiyeGecerliMi(d) && (d.guncel_toplam_borc ?? 0) > 0).length;
    const eski = borclu.filter(d => { const f = gunFarki(d.dogrulama_tarihi); return f === null || f > ESKI_GUN; }).length;
    const hucre = (etiket: string, deger: string, not: string, sinif = '') => {
      const h = el('div', 'icra-hucre ' + sinif);
      h.append(el('span', 'et', etiket), el('b', 'gz', deger), el('small', '', not));
      return h;
    };
    ozet.append(
      hucre('Açık borç dosyası', String(borclu.length), `${s.dosyalar.length} dosyanın ${borclu.length}'i açık ve borçlu olduğun`),
      hucre('Güncel toplam borç', tl(topla(borclu)), sayilmayan ? `durdurulmuş / itiraz edilmiş ${sayilmayan} dosyanın bakiyesi 0 sayıldı` : 'yalnız açık, borçlu olduğun dosyalar', 'vurgu'),
      hucre('Alacaklı olduğum dosyalar', tl(topla(alacakli)), `${alacakli.length} açık dosya; borç toplamına karışmaz`),
      hucre('Doğrulaması eski', String(eski), `${ESKI_GUN} günden eski ya da hiç doğrulanmamış`, eski ? 'uyari' : ''),
    );
  }

  function ciz() {
    const liste = gorunen();
    say.textContent = s.yukleniyor ? '' : `${liste.length} / ${s.dosyalar.length}`;
    const nBayat = s.yukleniyor ? 0 : bayatlar().length;
    dogrulaD.hidden = !nBayat; dogrulaD.textContent = `Sırayla doğrula (${nBayat})`;
    ozetCiz();
    icerik.replaceChildren();
    if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      icerik.append(el('p', 'bos hata', s.hata), b);
      return;
    }
    if (!s.dosyalar.length) { icerik.appendChild(el('p', 'bos', 'Henüz icra dosyası yok.')); return; }
    if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan dosya yok.')); return; }

    const sarma = el('div', 'tablo-sarma');
    const tablo = el('table');
    const bas = el('tr');
    ['Öncelik', 'Dosya', 'Alacaklı / karşı taraf', 'Güncel borç', 'Doğrulama', 'Durum'].forEach(h => bas.appendChild(el('th', '', h)));
    tablo.appendChild(el('thead')).appendChild(bas);
    const govde = el('tbody');
    liste.forEach(d => {
      const tr = el('tr', 'satir'); tr.tabIndex = 0; tr.dataset.id = d.id;
      const ok = el('td'); ok.appendChild(el('span', 'pill p' + Math.min(d.oncelik ?? 3, 3), d.oncelik ? (ONCELIK[d.oncelik] ?? String(d.oncelik)) : '—'));
      const dosya = el('td');
      dosya.appendChild(el('b', 'gz', d.dosya_no ?? '—'));
      dosya.appendChild(el('small', 'takma', d.icra_dairesi ?? ''));
      const taraf = el('td');
      const alacakliAd = d.taraf_rolu === 'Alacaklı' ? (d.karsi_taraf ?? '—') : (s.adlar.get(d.alacakli_id ?? '') ?? '—');
      taraf.appendChild(el('span', '', alacakliAd));
      if (d.taraf_rolu === 'Alacaklı') taraf.appendChild(el('small', 'takma', 'alacaklı olduğun dosya · borçlu'));
      const gecerli = bakiyeGecerliMi(d);
      const borc = el('td', 'sayi gz', tl(gecerliBakiye(d)));
      if (!gecerli && (d.guncel_toplam_borc ?? 0) > 0) { borc.append(document.createElement('br'), el('small', 'takma', `bakiye 0 sayılır · dosya rakamı ${tl(d.guncel_toplam_borc)}`)); }
      const f = gunFarki(d.dogrulama_tarihi);
      const dog = el('td', f !== null && f > ESKI_GUN ? 'eski' : '', d.dogrulama_tarihi ? `${gun(d.dogrulama_tarihi)} (${f} gün)` : 'yok');
      const dur = el('td'); dur.appendChild(el('span', 'pill', acikMi(d) ? 'Açık' : 'Kapalı'));
      tr.append(ok, dosya, taraf, borc, dog, dur);
      const ac = () => detay(d);
      tr.addEventListener('click', ac);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') ac(); });
      govde.appendChild(tr);
    });
    tablo.appendChild(govde);
    sarma.appendChild(tablo);
    icerik.appendChild(sarma);
  }

  function detay(d: IcraDosyasi) {
    const dlg = el('dialog', 'kutu genis');
    dlg.setAttribute('aria-label', 'İcra dosyası ayrıntısı');
    dlg.appendChild(el('h2', 'gz', `${d.dosya_no ?? '—'} · ${d.icra_dairesi ?? ''}`));
    const bolum = (baslik: string, satirlar: [string, string, boolean?][]) => {
      const b = el('section', 'bolum');
      b.appendChild(el('h3', '', baslik));
      const dl = el('dl');
      satirlar.filter(([, v]) => v && v !== '—').forEach(([k, v, g]) => { dl.appendChild(el('dt', '', k)); dl.appendChild(el('dd', g ? 'gz' : '', v)); });
      if (dl.children.length) b.appendChild(dl);
      return b;
    };
    dlg.append(
      bolum('Takip', [['Rol', d.taraf_rolu ?? ''], ['Takip türü', d.takip_turu ?? ''], ['Takip yolu', d.takip_yolu ?? ''],
        ['Durum', d.uyap_durum ?? ''], ['Alacaklı', s.adlar.get(d.alacakli_id ?? '') ?? ''], ['Avukat', s.adlar.get(d.avukat_id ?? '') ?? ''],
        ['Karşı taraf', d.karsi_taraf ?? ''], ['Özel durum', d.ozel_durum ?? ''], ['Diğer haciz sayısı', d.diger_haciz_sayisi ? String(d.diger_haciz_sayisi) : '']]),
      bolum('Tutarlar', [['Asıl alacak', tl(d.gercek_asil_alacak), true], ['Faiz', tl(d.faiz_tutari), true], ['Vekâlet ücreti', tl(d.vekalet_ucreti), true],
        ['Masraf', tl(d.masraf), true], ['Vergi', tl(d.vergi), true], ['Tahsil harcı', tl(d.tahsil_harci), true], ['Toplam alacak', tl(d.toplam_alacak), true],
        ['Yatan para', tl(d.yatan_para), true], ['Tahsilat', tl(d.tahsilat), true], ['Reddiyat', tl(d.reddiyat), true], ['Güncel toplam borç (dosya rakamı)', tl(d.guncel_toplam_borc), true], ['Sayılan bakiye', bakiyeGecerliMi(d) ? tl(d.guncel_toplam_borc) : `${tl(0)} (durum: ${d.uyap_durum ?? 'kapalı'})`, true]]),
      bolum('Tarihler', [['Açılış', gun(d.acilis_tarihi)], ['Kapanış', gun(d.kapanis_tarihi)], ['Son işlem', gun(d.son_islem_tarihi)],
        ['Doğrulama', gun(d.dogrulama_tarihi)], ['Tebligat', gun(d.tebligat_tarihi)], ['UYAP', gun(d.uyap_tarihi)]]),
    );
    if (d.ucuncu_sahislar.length) {
      const b = el('section', 'bolum'); b.appendChild(el('h3', '', 'Üçüncü şahıslar'));
      const ul = el('ul'); d.ucuncu_sahislar.forEach(x => ul.appendChild(el('li', '', x))); b.appendChild(ul); dlg.appendChild(b);
    }
    if (d.son_islemler.length) {
      const b = el('section', 'bolum'); b.appendChild(el('h3', '', 'Son işlemler'));
      const ul = el('ul'); d.son_islemler.forEach(x => ul.appendChild(el('li', '', x))); b.appendChild(ul); dlg.appendChild(b);
    }
    const belge = el('button', 'btn', '📂 Belgeler'); belge.type = 'button';
    belge.addEventListener('click', () => { dlg.close(); void dosyaKlasoruAc('icra', d.id); });
    const kapat = el('button', 'btn ghost', 'Kapat'); kapat.type = 'button';
    kapat.addEventListener('click', () => dlg.close());
    const duzenle = el('button', 'btn', 'Düzenle'); duzenle.type = 'button';
    duzenle.addEventListener('click', () => { dlg.close(); formAc(d); });
    dlg.append(duzenle, belge, kapat);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try {
      const [dosyalar, kisiler] = await Promise.all([icraDosyalariniGetir(), kisileriGetir()]);
      s.dosyalar = dosyalar;
      s.kisiler = kisiler;
      s.adlar = new Map(kisiler.map(k => [k.id, k.ad]));
    } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
  durumSec.addEventListener('change', () => { s.durum = durumSec.value as Durum['durum']; ciz(); });
  rolSec.addEventListener('change', () => { s.rol = rolSec.value as Durum['rol']; ciz(); });
  void yukle();
}
