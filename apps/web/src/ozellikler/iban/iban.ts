import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { ibanEkle, ibanGeriAl, ibanGuncelle, ibanSil, ibanlariGetir, type Iban } from '../../veri/iban';
import { kisileriGetir, type Kisi } from '../../veri/kisiler';
import { girdi, kutu, secim } from '../notlar/ortak';

const bicimle = (i: string) => i.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
const temizle = (i: string) => i.replace(/\s+/g, '').toUpperCase();

async function kopyala(m: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(m); return true; } catch { return false; }
}

export function ibanSayfasi(kok: HTMLElement) {
  const s = { liste: [] as Iban[], kisiler: [] as Kisi[], yukleniyor: true, hata: '', ara: '' };
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  const bar = el('div', 'tbar');
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Kişi, banka, etiket ya da IBAN ara'; ara.setAttribute('aria-label', 'Ara');
  const say = el('span', 'tbar-count');
  const yeni = el('button', 'btn primary sm', '+ Yeni IBAN'); yeni.type = 'button'; yeni.id = 'iban-yeni';
  bar.append(ara, el('span', 'tbar-sp'), say, yeni);
  const icerik = el('div', 'icra-icerik');
  kart.append(bar, el('p', 'sifre-not', 'IBAN numaraları şifreli saklanır. Aynı IBAN iki kez eklenemez.'), icerik);

  const sahipAdi = (x: Iban) => x.sahip_turu === 'kendim' ? 'Kendim' : (s.kisiler.find(k => k.id === x.kisi_id)?.ad ?? '—');
  const gorunen = () => {
    const t = katla(s.ara.trim().replace(/\s+/g, ' '));
    const tc = t.replace(/\s+/g, '');
    return s.liste.filter(x => !t || katla([sahipAdi(x), x.banka ?? '', x.etiket ?? ''].join(' ')).includes(t) || (tc.length >= 4 && x.iban.toLowerCase().includes(tc)));
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
    if (!s.liste.length) { icerik.appendChild(el('p', 'bos', 'Henüz IBAN yok. Kendi IBAN\'ını ya da ödeme yapacağın kişilerin IBAN\'larını ekle.')); return; }
    if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan IBAN yok.')); return; }
    const sarma = el('div', 'tablo-sarma'), tablo = el('table'), bs = el('tr');
    ['Sahibi', 'Banka', 'IBAN', ''].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const govde = el('tbody');
    [...liste].sort((p, q) => sahipAdi(p).localeCompare(sahipAdi(q), 'tr')).forEach(x => {
      const tr = el('tr', 'satir'); tr.dataset.id = x.id;
      const sahip = el('td'); sahip.appendChild(el('b', 'gz', sahipAdi(x)));
      if (x.etiket) sahip.appendChild(el('small', 'takma', x.etiket));
      const no = el('td'); no.appendChild(el('code', 'sifre-metin', bicimle(x.iban)));
      const islem = el('td');
      const k = el('button', 'btn ghost sm iban-kopya', 'Kopyala'); k.type = 'button';
      k.addEventListener('click', async () => { bildir(await kopyala(x.iban) ? 'IBAN kopyalandı' : 'Kopyalanamadı'); });
      const d = el('button', 'btn ghost sm iban-duzenle', 'Düzenle'); d.type = 'button';
      d.addEventListener('click', () => form(x));
      islem.append(k, d);
      tr.append(sahip, el('td', '', x.banka ?? '—'), no, islem); govde.appendChild(tr);
    });
    tablo.appendChild(govde); sarma.appendChild(tablo); icerik.appendChild(sarma);
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { [s.liste, s.kisiler] = await Promise.all([ibanlariGetir(), kisileriGetir()]); } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  function form(m?: Iban) {
    const d = kutu(m ? 'IBAN\'ı düzenle' : 'Yeni IBAN');
    const sahip = secim('ib-sahip', [['kendim', 'Kendim'], ['kisi', 'Başka biri']], m?.sahip_turu ?? 'kisi');
    const kisi = secim('ib-kisi', [['', '—'], ...s.kisiler.map(k => [k.id, k.ad] as [string, string])], m?.kisi_id ?? '');
    const banka = girdi('ib-banka', 'text', m?.banka ?? ''); banka.maxLength = 120;
    const etiket = girdi('ib-etiket', 'text', m?.etiket ?? ''); etiket.maxLength = 120; etiket.placeholder = 'Örnek: Maaş hesabı';
    const iban = girdi('ib-iban', 'text', m ? bicimle(m.iban) : ''); iban.maxLength = 40; iban.placeholder = 'TR00 0000 0000 0000 0000 0000 00'; iban.autocomplete = 'off';
    if (m) { iban.readOnly = true; }
    const kisiAlan = () => { kisi.disabled = sahip.value === 'kendim'; };
    d.alan('IBAN kimin?', sahip); d.alan('Kişi ya da kurum', kisi, 'Rehber\'de kayıtlı olmalı'); d.alan('Banka', banka); d.alan('Etiket', etiket);
    d.alan('IBAN', iban, m ? 'IBAN numarası değiştirilemez. Yanlışsa silip yenisini ekle.' : 'Boşluklu ya da boşluksuz yazabilirsin');
    if (m) { sahip.disabled = true; kisi.disabled = true; } else { sahip.addEventListener('change', kisiAlan); kisiAlan(); }
    if (m) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; let emin = false;
      sil.addEventListener('click', async () => {
        if (!emin) { emin = true; sil.textContent = 'Emin misin? Tekrar bas'; return; }
        sil.disabled = true;
        try {
          const silinen = await ibanSil(m.id, m.surum);
          s.liste = s.liste.filter(x => x.id !== m.id); d.dlg.close(); ciz();
          bildir('IBAN silindi', async () => { try { await ibanGeriAl(silinen.id, silinen.surum); await yukle(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
        } catch (err) { sil.disabled = false; if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); } d.hatayaz(hataMetni(err)); }
      });
      d.dugmeler.appendChild(sil);
    }
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      d.kaydet.disabled = true; d.hata.hidden = true;
      try {
        if (m) {
          await ibanGuncelle(m.id, m.surum, { etiket: etiket.value.trim() || null, banka: banka.value.trim() || null });
        } else {
          if (sahip.value === 'kisi' && !kisi.value) { d.hatayaz('Bir kişi ya da kurum seç.'); d.kaydet.disabled = false; return; }
          await ibanEkle(sahip.value as 'kendim' | 'kisi', sahip.value === 'kisi' ? kisi.value : null, etiket.value, banka.value, temizle(iban.value));
        }
        d.dlg.close(); bildir('Kaydedildi'); await yukle();
      } catch (err) {
        d.kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
        d.hatayaz((err as { code?: string }).code === '23505' ? 'Bu IBAN zaten kayıtlı.' : hataMetni(err));
      }
    });
    d.bitir();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
  yeni.addEventListener('click', () => form());
  void yukle();
}
