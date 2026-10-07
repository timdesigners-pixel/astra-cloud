import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { davaGeriAl, davaKaydet, davaSil, davalariGetir, type Dava, type DavaGirdisi, type DavaTuru } from '../../veri/davalar';
import { icraDosyalariniGetir, type IcraDosyasi } from '../../veri/icra';
import { kisileriGetir, type Kisi } from '../../veri/kisiler';
import { girdi, kutu, secim } from '../notlar/ortak';
import { onayla } from '../../ortak/uyari';

type Ayar = {
  tur: DavaTuru; yeni: string; baslik: string; bos: string; mahkeme: string; konu: string; konuIpucu: string;
  asamalar: [string, string][]; degerVar: boolean; icraBagi: boolean;
};

const AYARLAR: Record<DavaTuru, Ayar> = {
  ceza: { tur: 'ceza', yeni: '+ Yeni ceza davası', baslik: 'Yeni ceza davası', bos: 'Henüz ceza davası yok.', mahkeme: 'Mahkeme', konu: 'Suç / konu',
    konuIpucu: 'Kısa bir ad yaz', asamalar: [['sorusturma', 'Soruşturma'], ['kovusturma', 'Kovuşturma'], ['istinaf', 'İstinaf'], ['temyiz', 'Temyiz'], ['kesinlesti', 'Kesinleşti']],
    degerVar: false, icraBagi: false },
  hukuk: { tur: 'hukuk', yeni: '+ Yeni hukuk davası', baslik: 'Yeni hukuk davası', bos: 'Henüz hukuk davası yok.', mahkeme: 'Mahkeme', konu: 'Dava konusu',
    konuIpucu: 'Örnek: alacak, tazminat, kira', asamalar: [['ilk_derece', 'İlk derece'], ['istinaf', 'İstinaf'], ['temyiz', 'Temyiz'], ['kesinlesti', 'Kesinleşti']],
    degerVar: true, icraBagi: true },
  cbs: { tur: 'cbs', yeni: '+ Yeni CBS dosyası', baslik: 'Yeni CBS dosyası', bos: 'Henüz CBS dosyası yok.', mahkeme: 'Başsavcılık', konu: 'Suç türü',
    konuIpucu: 'Kısa bir ad yaz', asamalar: [['sorusturma', 'Soruşturma'], ['iddianame', 'İddianame hazırlandı'], ['takipsizlik', 'Takipsizlik'], ['dava', 'Davaya dönüştü']],
    degerVar: false, icraBagi: false },
};

const sayiyaCevir = (v: string) => { const t = v.trim().replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };

export function davaSayfasi(tur: DavaTuru) {
  const a = AYARLAR[tur];
  return (kok: HTMLElement) => {
    const s = { liste: [] as Dava[], kisiler: [] as Kisi[], icralar: [] as IcraDosyasi[], yukleniyor: true, hata: '', ara: '', durum: '' as '' | 'acik' | 'kapandi' };
    const kart = el('section', 'card icra');
    kok.replaceChildren(kart);
    const ozet = el('div', 'icra-ozet');
    const bar = el('div', 'tbar');
    const ara = el('input'); ara.type = 'search'; ara.placeholder = `Dosya no, ${a.mahkeme.toLowerCase()} ya da ${a.konu.toLowerCase()} ara`; ara.setAttribute('aria-label', 'Ara');
    const durum = el('select'); durum.id = 'dava-durum'; durum.setAttribute('aria-label', 'Duruma göre süz');
    [['', 'Tüm durumlar'], ['acik', 'Açık'], ['kapandi', 'Kapalı']].forEach(([v, t]) => { const o = el('option', '', t); o.value = v!; durum.appendChild(o); });
    const say = el('span', 'tbar-count');
    const yeni = el('button', 'btn primary sm', a.yeni); yeni.type = 'button'; yeni.id = 'dava-yeni';
    bar.append(ara, durum, el('span', 'tbar-sp'), say, yeni);
    const icerik = el('div', 'icra-icerik');
    kart.append(ozet, bar, icerik);

    const asamaAdi = (v: string | null) => a.asamalar.find(x => x[0] === v)?.[1] ?? (v ?? '—');
    const avukatAdi = (id: string | null) => s.kisiler.find(k => k.id === id)?.ad ?? '—';
    const gorunen = () => {
      const t = katla(s.ara.trim());
      return s.liste.filter(d => (!s.durum || d.durum === s.durum) && (!t || katla([d.dosya_no, d.mahkeme ?? '', d.konu ?? '', d.karsi_taraf ?? ''].join(' ')).includes(t)));
    };

    function ozetCiz() {
      ozet.replaceChildren();
      if (s.yukleniyor || s.hata) return;
      const acik = s.liste.filter(d => d.durum === 'acik');
      const bugun = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
      const gelecek = acik.filter(d => d.sonraki_durusma && d.sonraki_durusma >= bugun).sort((p, q) => String(p.sonraki_durusma).localeCompare(String(q.sonraki_durusma)));
      const otuzGun = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const otuz = gelecek.filter(d => String(d.sonraki_durusma) <= otuzGun);
      const h = (et: string, d: string, not: string, sinif = '') => { const x = el('div', 'icra-hucre ' + sinif); x.append(el('span', 'et', et), el('b', 'gz', d), el('small', '', not)); ozet.appendChild(x); };
      h('Açık dosya', String(acik.length), `${s.liste.length - acik.length} kapalı`, 'vurgu');
      h('Sonraki duruşma', gelecek[0] ? gun(gelecek[0].sonraki_durusma) : '—', gelecek[0] ? (gelecek[0].konu ?? gelecek[0].mahkeme ?? '') : 'planlanmış duruşma yok');
      h('30 gün içinde', String(otuz.length), 'duruşma ya da işlem', otuz.length ? 'uyari' : '');
      if (a.degerVar) h('Toplam dava değeri', tl(acik.reduce((t, d) => t + (d.dava_degeri ?? 0), 0)), 'yalnız açık dosyalar');
    }

    function ciz() {
      const liste = gorunen();
      say.textContent = s.yukleniyor ? '' : `${liste.length} / ${s.liste.length}`;
      ozetCiz();
      icerik.replaceChildren();
      if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
      if (s.hata) {
        const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
        icerik.append(el('p', 'bos hata', s.hata), b); return;
      }
      if (!s.liste.length) { icerik.appendChild(el('p', 'bos', a.bos)); return; }
      if (!liste.length) { icerik.appendChild(el('p', 'bos', 'Aramana uyan dosya yok.')); return; }
      const sarma = el('div', 'tablo-sarma'), tablo = el('table'), bs = el('tr');
      ['Dosya', a.mahkeme, a.konu, 'Aşama', ...(a.degerVar ? ['Dava değeri'] : []), 'Sonraki duruşma', 'Durum'].forEach(x => bs.appendChild(el('th', '', x)));
      tablo.appendChild(el('thead')).appendChild(bs);
      const govde = el('tbody');
      liste.forEach(d => {
        const tr = el('tr', 'satir'); tr.tabIndex = 0; tr.dataset.id = d.id;
        const dosya = el('td'); dosya.append(el('b', 'gz', d.dosya_no), el('small', 'takma', d.karsi_taraf ?? ''));
        tr.append(dosya, el('td', '', d.mahkeme ?? '—'), el('td', '', d.konu ?? '—'), el('td', '', asamaAdi(d.asama)));
        if (a.degerVar) tr.appendChild(el('td', 'sayi gz', d.dava_degeri === null ? '—' : tl(d.dava_degeri)));
        const dd = el('td'); dd.appendChild(el('span', 'pill', d.durum === 'acik' ? 'Açık' : 'Kapalı'));
        tr.append(el('td', '', gun(d.sonraki_durusma)), dd);
        const ac = () => form(d);
        tr.addEventListener('click', ac); tr.addEventListener('keydown', e => { if (e.key === 'Enter') ac(); });
        govde.appendChild(tr);
      });
      tablo.appendChild(govde); sarma.appendChild(tablo); icerik.appendChild(sarma);
    }

    async function yukle() {
      s.yukleniyor = true; s.hata = ''; ciz();
      try {
        const [l, k, i] = await Promise.all([davalariGetir(tur), kisileriGetir(), a.icraBagi ? icraDosyalariniGetir() : Promise.resolve([] as IcraDosyasi[])]);
        s.liste = l; s.kisiler = k; s.icralar = i;
      } catch (e) { s.hata = hataMetni(e); }
      s.yukleniyor = false; ciz();
    }

    function form(m?: Dava) {
      const d = kutu(m ? 'Dosyayı düzenle' : a.baslik);
      const no = girdi('df-no', 'text', m?.dosya_no ?? ''); no.maxLength = 80; no.placeholder = '2024/123';
      const mah = girdi('df-mahkeme', 'text', m?.mahkeme ?? ''); mah.maxLength = 160;
      const konu = girdi('df-konu', 'text', m?.konu ?? ''); konu.maxLength = 300;
      const asama = secim('df-asama', [['', '—'], ...a.asamalar], m?.asama ?? '');
      const dur = secim('df-durum', [['acik', 'Açık'], ['kapandi', 'Kapalı']], m?.durum ?? 'acik');
      const deger = girdi('df-deger', 'number', m?.dava_degeri === null || m?.dava_degeri === undefined ? '' : String(m.dava_degeri)); deger.step = '0.01';
      const durusma = girdi('df-durusma', 'date', m?.sonraki_durusma ?? '');
      const acilis = girdi('df-acilis', 'date', m?.acilis_tarihi ?? '');
      const avukat = secim('df-avukat', [['', '—'], ...s.kisiler.filter(k => k.alt_tur === 'avukat').concat(s.kisiler.filter(k => k.alt_tur !== 'avukat')).map(k => [k.id, k.alt_tur === 'avukat' ? `${k.ad} (avukat)` : k.ad] as [string, string])], m?.avukat_id ?? '');
      const taraf = girdi('df-taraf', 'text', m?.karsi_taraf ?? ''); taraf.maxLength = 300;
      const icra = secim('df-icra', [['', '—'], ...s.icralar.map(i => [i.id, `${i.dosya_no ?? '—'} · ${i.icra_dairesi ?? ''}`] as [string, string])], m?.icra_id ?? '');
      const not = el('textarea'); not.id = 'df-not'; not.rows = 3; not.maxLength = 4000; not.value = m?.notlar ?? '';
      d.alan('Dosya numarası', no, 'Şifreli saklanır');
      d.alan(a.mahkeme, mah); d.alan(a.konu, konu, a.konuIpucu); d.alan('Aşama', asama); d.alan('Durum', dur);
      if (a.degerVar) d.alan('Dava değeri (TL)', deger);
      d.alan('Sonraki duruşma', durusma, 'Ajanda\'da görünür'); d.alan('Açılış tarihi', acilis); d.alan('Avukat', avukat); d.alan('Karşı taraf', taraf);
      if (a.icraBagi) d.alan('Bağlı icra dosyası', icra);
      d.alan('Not', not);
      if (m) {
        const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button';
        sil.addEventListener('click', async () => {
          if (!(await onayla({ baslik: 'Silinsin mi?', metin: 'Bu kayıt silinecek.', evet: 'Sil' }))) return;
          sil.disabled = true;
          try {
            const silinen = await davaSil(m.id, m.surum);
            s.liste = s.liste.filter(x => x.id !== m.id); d.dlg.close(); ciz();
            bildir('Dosya silindi', async () => { try { await davaGeriAl(silinen.id, silinen.surum); await yukle(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
          } catch (err) { sil.disabled = false; if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); } d.hatayaz(hataMetni(err)); }
        });
        d.dugmeler.appendChild(sil);
      }
      d.f.addEventListener('submit', async e => {
        e.preventDefault();
        if (!no.value.trim()) { d.hatayaz('Dosya numarası boş olamaz.'); no.focus(); return; }
        const dv = sayiyaCevir(deger.value);
        if (a.degerVar && Number.isNaN(dv)) { d.hatayaz('Dava değeri sayı olmalı.'); return; }
        const g: DavaGirdisi = {
          mahkeme: mah.value.trim() || null, konu: konu.value.trim() || null, asama: asama.value || null, durum: dur.value as 'acik' | 'kapandi',
          dava_degeri: a.degerVar ? dv : null, sonraki_durusma: durusma.value || null, avukat_id: avukat.value || null,
          karsi_taraf: taraf.value.trim() || null, icra_id: a.icraBagi ? icra.value || null : null, acilis_tarihi: acilis.value || null, notlar: not.value.trim() || null,
        };
        d.kaydet.disabled = true; d.hata.hidden = true;
        try {
          const k = await davaKaydet(tur, no.value.trim(), g, m);
          const i = s.liste.findIndex(x => x.id === k.id); if (i >= 0) s.liste[i] = k; else s.liste.push(k);
          s.liste.sort((p, q) => String(p.sonraki_durusma ?? '9999').localeCompare(String(q.sonraki_durusma ?? '9999')));
          d.dlg.close(); ciz(); bildir('Kaydedildi');
        } catch (err) {
          d.kaydet.disabled = false;
          if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
          d.hatayaz((err as { code?: string }).code === '23505' ? 'Bu dosya numarası aynı yerde zaten kayıtlı.' : hataMetni(err));
        }
      });
      d.bitir();
    }

    ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
    durum.addEventListener('change', () => { s.durum = durum.value as typeof s.durum; ciz(); });
    yeni.addEventListener('click', () => form());
    void yukle();
  };
}
