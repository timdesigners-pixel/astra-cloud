import './saglik.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { bugunAnahtari } from '../../ortak/zaman';
import { git } from '../../kabuk/yonlendirici';
import { hataMetni } from '../../veri/hata';
import { hedefGetir, VARSAYILAN_HEDEF, type Hedefler } from '../../veri/karsilama';
import {
  KAYNAK_ADI, TUR_BILGI, anahtarlariGetir, degerYaz, gosterimDegeri, olcumSil, olcumleriKaydet, sagligiGetir, uykuMetni,
  type Anahtar, type Birlesik, type Olcum, type OlcumTuru,
} from '../../veri/saglik';
import { degerDurumu, degerleriGetir, type Deger } from '../../veri/tahlil';
import { girdi, kutu, secim } from '../notlar/ortak';
import { grafikCiz, minikCiz, type Nokta } from './grafik';

/* Sağlık Özeti: bugünün değerleri, eğilimler, elle ölçüm girişi ve cihaz/tahlil durumu. */
const SIRA: OlcumTuru[] = ['adim', 'uyku_dk', 'nabiz', 'dinlenme_nabzi', 'kilo', 'tansiyon_sis', 'su_ml', 'kalori_aktif', 'egzersiz_dk', 'mesafe_m', 'spo2', 'hrv', 'glukoz', 'yag_orani', 'ates'];
const ARALIKLAR = [[7, '7 gün'], [30, '30 gün'], [90, '90 gün']] as const;
const GIRIS_TURLERI: OlcumTuru[] = ['kilo', 'tansiyon_sis', 'nabiz', 'dinlenme_nabzi', 'glukoz', 'ates', 'spo2', 'yag_orani', 'uyku_dk', 'su_ml', 'adim', 'kalori_aktif', 'egzersiz_dk'];

const gunFarki = (gun: string, bugun: string) => Math.round((Date.parse(bugun) - Date.parse(gun)) / 86400000);
const gunAdi = (gun: string, bugun: string) => { const f = gunFarki(gun, bugun); return f === 0 ? 'bugün' : f === 1 ? 'dün' : `${gun.slice(8, 10)}.${gun.slice(5, 7)}.${gun.slice(0, 4)}`; };
const ortalama = (l: number[]) => (l.length ? l.reduce((t, x) => t + x, 0) / l.length : null);
const goreli = (iso: string) => {
  const dk = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return dk < 1 ? 'az önce' : dk < 60 ? `${dk} dk önce` : dk < 1440 ? `${Math.round(dk / 60)} saat önce` : `${Math.round(dk / 1440)} gün önce`;
};

export function saglikOzetiSayfasi(kok: HTMLElement) {
  const s = {
    gun: 30, veri: [] as Birlesik[], hedef: VARSAYILAN_HEDEF as Hedefler, anahtarlar: [] as Anahtar[], tahlil: [] as Deger[],
    yukleniyor: true, hata: '',
  };
  const kart = el('section', 'card sg');
  kok.replaceChildren(kart);

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try {
      const [v, h, a, t] = await Promise.all([sagligiGetir(90), hedefGetir(), anahtarlariGetir().catch(() => []), degerleriGetir().catch(() => [])]);
      s.veri = v; s.hedef = h; s.anahtarlar = a; s.tahlil = t;
    } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  const bugun = bugunAnahtari();
  const aralikta = (tur: OlcumTuru, gun = s.gun) => s.veri.filter(b => b.tur === tur && gunFarki(b.gun, bugun) < gun);

  function durumSeridi(): HTMLElement {
    const sr = el('div', 'sg-serit');
    const aktif = s.anahtarlar.filter(a => !a.iptal_at);
    const son = aktif.map(a => a.son_kullanim).filter((x): x is string => !!x).sort().pop();
    const cihaz = el('button', 'sg-chip'); cihaz.type = 'button';
    cihaz.textContent = son ? `⌚ Son cihaz verisi ${goreli(son)}` : aktif.length ? '⌚ Anahtar hazır, henüz veri gelmedi' : '⌚ Cihaz bağlı değil — bağla';
    cihaz.addEventListener('click', () => git('s-cihaz'));
    sr.appendChild(cihaz);
    const son_t = s.tahlil.length ? s.tahlil.reduce((m, d) => (d.tarih > m ? d.tarih : m), '') : '';
    const t = el('button', 'sg-chip'); t.type = 'button';
    if (son_t) {
      const disi = s.tahlil.filter(d => d.tarih === son_t && ['dusuk', 'yuksek'].includes(degerDurumu(d))).length;
      t.textContent = disi ? `⚗ Son tahlil (${gunAdi(son_t, bugun)}): ${disi} değer referans dışı` : `⚗ Son tahlil (${gunAdi(son_t, bugun)}): hepsi normal`;
      if (disi) t.classList.add('uyari');
    } else t.textContent = '⚗ Tahlil yükle ve değerlerini takip et';
    t.addEventListener('click', () => git('s-tahlil'));
    sr.appendChild(t);
    return sr;
  }

  function kartUret(tur: OlcumTuru): HTMLElement | null {
    const b = TUR_BILGI[tur];
    const seri = aralikta(tur);
    if (!seri.length) return null;
    const son = seri[seri.length - 1]!;
    const oncekiOrt = ortalama(seri.slice(0, -1).map(x => x.deger));
    const k = el('button', 'sg-kart'); k.type = 'button';
    k.appendChild(el('div', 'sg-kart-ust', `${b.simge} ${b.etiket}`));
    let buyuk: string;
    let disarida = false;
    if (tur === 'tansiyon_sis') {
      const dia = s.veri.find(x => x.tur === 'tansiyon_dia' && x.gun === son.gun);
      buyuk = `${Math.round(son.deger)}${dia ? '/' + Math.round(dia.deger) : ''}`;
      disarida = !!b.aralik && (son.deger > b.aralik[1] || son.deger < b.aralik[0]);
    } else if (tur === 'uyku_dk') {
      buyuk = uykuMetni(son.deger);
      disarida = !!b.aralik && (son.deger < 360);
    } else {
      buyuk = degerYaz(tur, son.deger, false);
      disarida = !!b.aralik && (son.deger > b.aralik[1] || son.deger < b.aralik[0]);
    }
    const deger = el('div', 'sg-kart-deger' + (disarida ? ' disarida' : ''));
    deger.append(el('span', '', buyuk), el('small', '', tur === 'tansiyon_sis' ? 'mmHg' : tur === 'uyku_dk' ? '' : b.birim));
    k.appendChild(deger);
    k.appendChild(el('div', 'sg-kart-alt', `${gunAdi(son.gun, bugun)} · ${KAYNAK_ADI[son.kaynak] ?? son.kaynak}`));
    if (son.en_az !== null && son.en_cok !== null && tur === 'nabiz') k.appendChild(el('div', 'sg-kart-alt', `gün içinde ${Math.round(son.en_az)}–${Math.round(son.en_cok)}`));
    const hedef = tur === 'adim' ? s.hedef.adim : tur === 'su_ml' ? s.hedef.su : null;
    if (hedef) {
      const oran = Math.min(1, son.deger / hedef);
      const cubuk = el('div', 'sg-hedef-cubuk'); const ic = el('i'); ic.style.width = `${Math.round(oran * 100)}%`; cubuk.appendChild(ic);
      k.append(cubuk, el('div', 'sg-kart-alt', `hedef ${hedef.toLocaleString('tr-TR')} · %${Math.round(oran * 100)}`));
    }
    const ort = ortalama(seri.map(x => x.deger));
    if (ort !== null && seri.length > 1) {
      const fark = oncekiOrt !== null && oncekiOrt > 0 ? ((son.deger - oncekiOrt) / oncekiOrt) * 100 : null;
      k.appendChild(el('div', 'sg-kart-alt', `${s.gun} gün ort. ${degerYaz(tur, ort)}${fark !== null && Math.abs(fark) >= 1 ? ` · ${fark > 0 ? '↑' : '↓'}%${Math.abs(Math.round(fark))}` : ''}`));
    }
    k.appendChild(minikCiz(seri.map(x => ({ x: x.gun, y: x.deger })), disarida ? 'var(--red)' : 'var(--cyan)'));
    k.addEventListener('click', () => detay(tur));
    return k;
  }

  function detay(tur: OlcumTuru) {
    const b = TUR_BILGI[tur];
    const dlg = el('dialog', 'kutu genis'); dlg.setAttribute('aria-label', b.etiket);
    dlg.appendChild(el('h2', '', `${b.simge} ${b.etiket}`));
    const seri = aralikta(tur, 90);
    const tamam = (t: OlcumTuru) => TUR_BILGI[t];
    const noktalar = (t: OlcumTuru): Nokta[] => aralikta(t, 90).map(x => ({ x: x.gun, y: gosterimDegeri(t, x.deger), etiket: `${x.gun.slice(8, 10)}.${x.gun.slice(5, 7)}: ${degerYaz(t, x.deger)}` }));
    const a = tamam(tur).aralik;
    dlg.appendChild(grafikCiz(noktalar(tur), {
      ondalik: b.ondalik, alt: a ? gosterimDegeri(tur, a[0]) : null, ust: a ? gosterimDegeri(tur, a[1]) : null, aralikAdi: 'Sağlıklı aralık',
      cubuk: b.tur === 'toplam' && tur !== 'uyku_dk', hedef: tur === 'adim' ? s.hedef.adim : tur === 'su_ml' ? s.hedef.su : null,
    }));
    if (tur === 'tansiyon_sis') {
      dlg.appendChild(el('p', 'sg-not', 'Küçük tansiyon:'));
      const a2 = TUR_BILGI.tansiyon_dia.aralik!;
      dlg.appendChild(grafikCiz(noktalar('tansiyon_dia'), { alt: a2[0], ust: a2[1], aralikAdi: 'Sağlıklı aralık', renk: 'var(--violet)', yukseklik: 150 }));
    }
    const sarma = el('div', 'tablo-sarma sg-tablo-kisa'), tablo = el('table'), bs = el('tr');
    ['Gün', 'Değer', 'Kaynak', ''].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const govde = el('tbody');
    [...seri].reverse().slice(0, 60).forEach(x => {
      const tr = el('tr');
      tr.append(el('td', '', gunAdi(x.gun, bugun)), el('td', 'sayi', degerYaz(tur, x.deger)), el('td', '', KAYNAK_ADI[x.kaynak] ?? x.kaynak));
      const td = el('td');
      if (x.id && x.kaynak !== 'gunluk') {
        const sil = el('button', 'btn ghost sm', 'Sil'); sil.type = 'button';
        sil.addEventListener('click', async () => {
          if (!(await onayla({ baslik: 'Ölçüm silinsin mi?', metin: `${gunAdi(x.gun, bugun)} · ${degerYaz(tur, x.deger)}`, evet: 'Sil' }))) return;
          try { await olcumSil(x.id!); dlg.close(); bildir('Ölçüm silindi'); void yukle(); } catch (e) { bildir(hataMetni(e), undefined, true); }
        });
        td.appendChild(sil);
      }
      tr.appendChild(td); govde.appendChild(tr);
    });
    tablo.appendChild(govde); sarma.appendChild(tablo); dlg.appendChild(sarma);
    const kapat = el('button', 'btn ghost', 'Kapat'); kapat.type = 'button'; kapat.addEventListener('click', () => dlg.close());
    dlg.appendChild(kapat);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg); dlg.showModal();
  }

  function olcumEkle() {
    const d = kutu('Ölçüm ekle');
    const tur = secim('sg-tur', GIRIS_TURLERI.map(t => [t, `${TUR_BILGI[t].etiket}${t === 'tansiyon_sis' ? ' (tansiyon)' : ''}`] as [string, string]), 'kilo');
    const gun = girdi('sg-gun', 'date', bugun); gun.max = bugun;
    const deger = girdi('sg-deger', 'text'); deger.inputMode = 'decimal';
    const deger2 = girdi('sg-deger2', 'text'); deger2.inputMode = 'decimal'; deger2.placeholder = 'örn. 78';
    d.alan('Ne ölçtün?', tur); d.alan('Gün', gun); d.alan('Değer', deger);
    const ikinci = el('label', 'alan'); ikinci.append(el('span', '', 'Küçük tansiyon'), deger2);
    d.f.appendChild(ikinci);
    const guncelle = () => {
      const t = tur.value as OlcumTuru;
      deger.placeholder = t === 'tansiyon_sis' ? 'büyük tansiyon, örn. 118' : t === 'uyku_dk' ? 'saat, örn. 7,5' : TUR_BILGI[t].birim;
      ikinci.hidden = t !== 'tansiyon_sis';
    };
    tur.addEventListener('change', guncelle); guncelle();
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      const t = tur.value as OlcumTuru;
      const n = (x: string) => Number(x.trim().replace(',', '.'));
      const v = n(deger.value);
      if (!deger.value.trim() || !Number.isFinite(v) || v < 0) { d.hatayaz('Değeri sayı olarak yaz.'); return; }
      if (!gun.value || gun.value > bugun) { d.hatayaz('Geçerli bir gün seç.'); return; }
      const satirlar: Olcum[] = [{ gun: gun.value, tur: t, kaynak: 'elle', deger: t === 'uyku_dk' ? v * 60 : v }];
      if (t === 'tansiyon_sis') {
        const v2 = n(deger2.value);
        if (!deger2.value.trim() || !Number.isFinite(v2) || v2 <= 0) { d.hatayaz('Küçük tansiyonu da yaz.'); return; }
        satirlar.push({ gun: gun.value, tur: 'tansiyon_dia', kaynak: 'elle', deger: v2 });
      }
      d.kaydet.disabled = true; d.hata.hidden = true;
      try { await olcumleriKaydet(satirlar); d.dlg.close(); bildir('Ölçüm kaydedildi'); void yukle(); }
      catch (err) { d.kaydet.disabled = false; d.hatayaz(hataMetni(err)); }
    });
    d.bitir();
  }

  function ciz() {
    kart.replaceChildren();
    const ust = el('div', 'sg-ust');
    ust.append(el('h2', '', 'Sağlık Özeti'), el('span', 'tbar-sp'));
    const aralik = el('div', 'sg-aralik');
    ARALIKLAR.forEach(([g, ad]) => {
      const b = el('button', 'btn ghost sm' + (g === s.gun ? ' acik' : ''), ad); b.type = 'button';
      b.addEventListener('click', () => { s.gun = g; ciz(); });
      aralik.appendChild(b);
    });
    const ekle = el('button', 'btn primary sm', '＋ Ölçüm ekle'); ekle.type = 'button'; ekle.addEventListener('click', olcumEkle);
    ust.append(aralik, ekle);
    kart.appendChild(ust);
    if (s.yukleniyor) { kart.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      kart.append(el('p', 'bos hata', s.hata), b); return;
    }
    kart.appendChild(durumSeridi());
    const kartlar = SIRA.map(kartUret).filter((x): x is HTMLElement => !!x);
    if (!kartlar.length) {
      const bos = el('div', 'sg-bos-kutu');
      bos.append(el('p', 'bos', 'Henüz sağlık verisi yok.'), el('p', 'sg-not', 'Elle ölçüm ekleyebilir, telefon ya da akıllı saatini bağlayabilir veya dosyadan içe aktarabilirsin.'));
      const b = el('button', 'btn primary', 'Cihaz Senkronu'); b.type = 'button'; b.addEventListener('click', () => git('s-cihaz'));
      bos.appendChild(b); kart.appendChild(bos); return;
    }
    const izgara = el('div', 'sg-izgara-kartlar');
    kartlar.forEach(k => izgara.appendChild(k));
    kart.appendChild(izgara);
    kart.appendChild(el('p', 'sg-not', 'Kartlara basınca grafik ve geçmiş açılır. Nabız, tansiyon ve kan şekeri için gösterilen aralıklar genel yetişkin değerleridir; bu sayfa tıbbi tavsiye yerine geçmez.'));
  }

  ciz();
  void yukle();
}
