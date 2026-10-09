import './sureler.css';
import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { gun as tarihYaz } from '../../ortak/bicim';
import { bugunAnahtari, AYLAR } from '../../ortak/zaman';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { icraDosyalariniGetir, icraKaydet, type IcraDosyasi } from '../../veri/icra';
import { denetimGetir, denetimYaz, imzaGetir, imzaYaz, sabitleriGetir, sabitleriYaz } from '../../veri/sabitler';
import {
  ONEM_ADI, SURE_TABLO, YUKUMLULUK_TUR_ADI, denetimDurumu, imzaAylari, imzaDurumu, siradakiYukumluluk, sureTuru, sureler, zamanasimi,
  type DenetimSuresi, type Imza, type Onem, type Yukumluluk, type YukumlulukTuru,
} from '../../veri/sureler';
import { girdi, kutu, secim } from '../notlar/ortak';

/* Süreler ve İmza: icra yasal süreleri, zamanaşımı, karakol imzası, sabit tarihli yükümlülükler ve denetim süresi. */
const ayAdi = (ay: string) => `${AYLAR[Number(ay.slice(5, 7)) - 1]} ${ay.slice(0, 4)}`;
const kalanMetni = (k: number) => (k < 0 ? `${-k} gün geçti` : k === 0 ? 'bugün' : `${k} gün kaldı`);
const kalanSinif = (k: number) => (k < 0 ? 'kirmizi' : k <= 3 ? 'kirmizi' : k <= 7 ? 'sari' : 'yesil');
const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export function surelerSayfasi(kok: HTMLElement) {
  const bugun = bugunAnahtari();
  const s = { icra: [] as IcraDosyasi[], sabit: [] as Yukumluluk[], imza: { gun: 15, aktif: true, log: {} } as Imza, denetim: null as DenetimSuresi | null, yukleniyor: true, hata: '' };
  const sayfa = el('div', 'hs');
  kok.replaceChildren(sayfa);

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { [s.icra, s.sabit, s.imza, s.denetim] = await Promise.all([icraDosyalariniGetir(), sabitleriGetir(), imzaGetir(), denetimGetir()]); }
    catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  const kutuUret = (baslik: string, ...cocuk: (Node | string)[]) => {
    const k = el('section', 'card hs-kart'); k.appendChild(el('h2', '', baslik));
    cocuk.forEach(c => k.append(typeof c === 'string' ? el('p', 'hs-not', c) : c));
    return k;
  };
  const tablo = (basliklar: string[], satirlar: HTMLElement[]) => {
    const sarma = el('div', 'tablo-sarma'), t = el('table'), bs = el('tr');
    basliklar.forEach(b => bs.appendChild(el('th', '', b)));
    t.appendChild(el('thead')).appendChild(bs);
    const g = el('tbody'); satirlar.forEach(x => g.appendChild(x)); t.appendChild(g); sarma.appendChild(t);
    return sarma;
  };
  const hucre = (metin: string, sinif = '') => el('td', sinif, metin);
  const acik = () => s.icra.filter(d => d.durum === 'acik');
  const dosyaAdi = (d: IcraDosyasi) => d.karsi_taraf || d.icra_dairesi || 'İcra dosyası';

  async function icraAlanYaz(d: IcraDosyasi, alan: Record<string, string | null>) {
    try {
      const yeni = await icraKaydet(d, null, alan);
      const i = s.icra.findIndex(x => x.id === d.id); if (i >= 0) s.icra[i] = yeni;
      ciz();
    } catch (e) {
      if (e instanceof CakismaHatasi) { bildir(hataMetni(e), undefined, true); void yukle(); } else bildir(hataMetni(e), undefined, true);
    }
  }

  /* ——— Sabit tarihler ——— */
  function sabitForm(m?: Yukumluluk) {
    const d = kutu(m ? 'Sabit tarihi düzenle' : 'Yeni sabit tarih');
    const ad = girdi('sy-ad', 'text', m?.ad ?? ''); ad.maxLength = 120; ad.placeholder = 'Örn. Ödemeler günü';
    const gunG = girdi('sy-gun', 'number', String(m?.gun ?? 1)); gunG.min = '1'; gunG.max = '31';
    const tur = secim('sy-tur', Object.entries(YUKUMLULUK_TUR_ADI) as [string, string][], m?.tur ?? 'odeme');
    const onem = secim('sy-onem', Object.entries(ONEM_ADI) as [string, string][], m?.onem ?? 'normal');
    d.alan('Başlık', ad); d.alan('Ayın kaçıncı günü', gunG, 'Her ay otomatik tekrarlanır; ay kısaysa son güne çekilir'); d.alan('Tür', tur); d.alan('Önem', onem);
    if (m) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button';
      sil.addEventListener('click', async () => {
        if (!(await onayla({ baslik: 'Silinsin mi?', metin: `"${m.ad}" her ay tekrarlanmayacak.`, evet: 'Sil' }))) return;
        try { await sabitleriYaz(s.sabit.filter(x => x.id !== m.id)); d.dlg.close(); bildir('Silindi'); void yukle(); } catch (e) { d.hatayaz(hataMetni(e)); }
      });
      d.dugmeler.appendChild(sil);
    }
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      const g = Number(gunG.value);
      if (!ad.value.trim()) { d.hatayaz('Başlık boş olamaz.'); return; }
      if (!Number.isInteger(g) || g < 1 || g > 31) { d.hatayaz('Gün 1 ile 31 arasında olmalı.'); return; }
      const yeni: Yukumluluk = { id: m?.id ?? yeniId(), ad: ad.value.trim(), gun: g, tur: tur.value as YukumlulukTuru, onem: onem.value as Onem, aktif: m?.aktif ?? true };
      d.kaydet.disabled = true;
      try { await sabitleriYaz(m ? s.sabit.map(x => (x.id === m.id ? yeni : x)) : [...s.sabit, yeni]); d.dlg.close(); bildir('Kaydedildi'); void yukle(); }
      catch (err) { d.kaydet.disabled = false; d.hatayaz(hataMetni(err)); }
    });
    d.bitir();
  }

  function sabitBolumu() {
    const yeni = el('button', 'btn primary sm', '+ Yeni sabit tarih'); yeni.type = 'button'; yeni.addEventListener('click', () => sabitForm());
    const sirali = [...s.sabit].map(y => ({ y, n: siradakiYukumluluk(y, bugun) })).sort((a, b) => a.n.kalan - b.n.kalan);
    const k = kutuUret('Sabit tarihler', 'Her ay aynı günde tekrarlanan yükümlülükler (ödeme günü, imza, duruşma, taksit...). Ajanda ve bildirimlerde otomatik görünür.');
    k.firstElementChild!.after(yeni);
    if (!sirali.length) { k.appendChild(el('p', 'bos', 'Henüz sabit tarih yok.')); return k; }
    k.appendChild(tablo(['Başlık', 'Gün', 'Tür', 'Önem', 'Sıradaki', 'Kalan', ''], sirali.map(({ y, n }) => {
      const tr = el('tr', 'satir'); tr.tabIndex = 0;
      const ac = el('td', 'hs-ucuk'); const b = el('button', 'btn ghost sm', y.aktif ? 'Kapat' : 'Aç'); b.type = 'button';
      b.title = y.aktif ? 'Bu yükümlülüğü şimdilik gizle' : 'Yeniden göster';
      b.addEventListener('click', async ev => { ev.stopPropagation(); try { await sabitleriYaz(s.sabit.map(x => (x.id === y.id ? { ...x, aktif: !x.aktif } : x))); void yukle(); } catch (e) { bildir(hataMetni(e), undefined, true); } });
      ac.appendChild(b);
      tr.className = 'satir' + (y.aktif ? '' : ' pasif');
      tr.append(hucre(y.ad), hucre(`Ayın ${y.gun}'i`), hucre(YUKUMLULUK_TUR_ADI[y.tur]), hucre(ONEM_ADI[y.onem], `hs-onem-${y.onem}`), hucre(tarihYaz(n.tarih)), hucre(y.aktif ? kalanMetni(n.kalan) : 'kapalı', y.aktif ? `hs-${kalanSinif(n.kalan)}` : ''), ac);
      tr.addEventListener('click', () => sabitForm(y)); tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) sabitForm(y); });
      return tr;
    })));
    return k;
  }

  /* ——— Karakol imzası ——— */
  async function imzaKaydet(yeni: Imza) {
    try { await imzaYaz(yeni); s.imza = yeni; ciz(); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
  }
  function imzaBolumu() {
    const k = kutuUret('Karakol imza takvimi', 'İmza gününü gir, her ay imza attıkça işaretle. Kaçırılan ay kırmızı kalır.');
    const gunG = girdi('imza-gun', 'number', String(s.imza.gun)); gunG.min = '1'; gunG.max = '31'; gunG.setAttribute('aria-label', 'İmza günü');
    gunG.addEventListener('change', () => { const g = Number(gunG.value); if (Number.isInteger(g) && g >= 1 && g <= 31) void imzaKaydet({ ...s.imza, gun: g }); });
    const aktif = el('input'); aktif.type = 'checkbox'; aktif.checked = s.imza.aktif; aktif.id = 'imza-aktif';
    aktif.addEventListener('change', () => void imzaKaydet({ ...s.imza, aktif: aktif.checked }));
    const ayar = el('div', 'hs-satir');
    const l1 = el('label', 'hs-etiket'); l1.append('İmza günü ', gunG);
    const l2 = el('label', 'hs-etiket'); l2.append(aktif, ' yükümlülük sürüyor');
    ayar.append(l1, l2); k.appendChild(ayar);
    if (!s.imza.aktif) return k;
    const liste = el('div', 'hs-imza-liste');
    imzaAylari(bugun).forEach(ay => {
      const d = imzaDurumu(s.imza, ay, bugun);
      const sat = el('label', `hs-imza ${d.durum}`);
      const c = el('input'); c.type = 'checkbox'; c.checked = d.durum === 'imzalandi'; c.setAttribute('aria-label', `${ayAdi(ay)} imza`);
      c.addEventListener('change', () => {
        const log = { ...s.imza.log };
        if (c.checked) log[ay] = bugun; else delete log[ay];
        void imzaKaydet({ ...s.imza, log });
      });
      const durumYazi = d.durum === 'imzalandi' ? `✓ ${tarihYaz(s.imza.log[ay]!)}` : d.durum === 'kacirildi' ? 'KAÇIRILDI' : d.durum === 'bugun' ? 'BUGÜN' : kalanMetni(d.kalan);
      sat.append(c, el('span', '', `${ayAdi(ay)} · ${tarihYaz(d.tarih)}`), el('b', '', durumYazi));
      liste.appendChild(sat);
    });
    k.appendChild(liste);
    return k;
  }

  /* ——— İcra süreleri ——— */
  function sureBolumu() {
    const k = kutuUret('Süre sayacı', 'Tebliğ tarihi girilen açık dosyaların itiraz ve ödeme süreleri (adli tatile denk gelen süre, tatilin bitiminden bir hafta sonrasına uzar). Kesin süreyi avukatınla teyit et.');
    const sat = acik().map(d => ({ d, l: sureler(d.takip_turu, d.tebligat_tarihi, bugun) })).filter(x => x.l.length).sort((a, b) => Math.min(...a.l.map(y => y.kalan)) - Math.min(...b.l.map(y => y.kalan)));
    if (!sat.length) { k.appendChild(el('p', 'bos', 'Tebliğ tarihi girilmiş açık dosya yok. Aşağıdan tebliğ tarihlerini gir.')); return k; }
    k.appendChild(tablo(['Dosya', 'Tür', 'Tebliğ', 'Süre', 'Son gün', 'Kalan'], sat.flatMap(({ d, l }) => l.map((y, i) => {
      const tr = el('tr');
      tr.append(hucre(i === 0 ? `${dosyaAdi(d)} · ${d.dosya_no ?? ''}` : '', 'gz'), hucre(i === 0 ? d.takip_turu ?? '' : ''), hucre(i === 0 ? tarihYaz(d.tebligat_tarihi) : ''), hucre(`${y.ad} (${y.gun} gün)`), hucre(tarihYaz(y.son)), hucre(kalanMetni(y.kalan), `hs-${kalanSinif(y.kalan)}`));
      return tr;
    }))));
    return k;
  }

  function tebligBolumu() {
    const bekleyen = acik().filter(d => !d.tebligat_tarihi && (() => { const t = sureTuru(d.takip_turu); return !!t && (SURE_TABLO[t].itiraz > 0 || SURE_TABLO[t].odeme > 0); })());
    if (!bekleyen.length) return null;
    const k = kutuUret(`Tebliğ tarihi bekleyen dosyalar (${bekleyen.length})`, 'Süre hesaplanabilmesi için tebliğ tarihi gerekir. e-Devlet › İcra Dosyalarım ya da dosya evrakından bakılabilir.');
    k.appendChild(tablo(['Dosya', 'Tür', 'Tebliğ tarihi'], bekleyen.map(d => {
      const tr = el('tr');
      const girdiH = el('input'); girdiH.type = 'date'; girdiH.max = bugun; girdiH.setAttribute('aria-label', `${dosyaAdi(d)} tebliğ tarihi`);
      girdiH.addEventListener('change', () => { if (girdiH.value) void icraAlanYaz(d, { tebligat_tarihi: girdiH.value }); });
      const td = el('td'); td.appendChild(girdiH);
      tr.append(hucre(`${dosyaAdi(d)} · ${d.dosya_no ?? ''}`, 'gz'), hucre(d.takip_turu ?? ''), td);
      return tr;
    })));
    return k;
  }

  function zamanBolumu() {
    const k = kutuUret('Zamanaşımı takibi', 'Kambiyo 3 yıl · ilamsız ve tahliye 5 yıl · ilam 10 yıl. Süre son işlem tarihinden (yoksa açılıştan) işler; haciz gibi işlemler süreyi keser. Süresi dolmuş görünmesi otomatik sonuç doğurmaz; zamanaşımı itirazı mahkemede ileri sürülür.');
    const sat = acik().map(d => ({ d, z: zamanasimi(d.takip_turu, d.son_islem_tarihi, d.acilis_tarihi, bugun) })).filter((x): x is { d: IcraDosyasi; z: NonNullable<ReturnType<typeof zamanasimi>> } => !!x.z).sort((a, b) => a.z.kalan - b.z.kalan);
    if (!sat.length) { k.appendChild(el('p', 'bos', 'Zamanaşımı hesaplanabilen açık dosya yok.')); return k; }
    k.appendChild(tablo(['Dosya', 'Tür', 'Son işlem', 'Süre', 'Bitiş', 'Durum'], sat.map(({ d, z }) => {
      const tr = el('tr');
      const durum = z.gecti ? 'Süresi dolmuş görünüyor' : z.kalan < 365 ? `${Math.max(1, Math.round(z.kalan / 30))} ay kaldı` : `${z.bitis.slice(0, 4)} yılında dolar`;
      tr.append(hucre(`${dosyaAdi(d)} · ${d.dosya_no ?? ''}`, 'gz'), hucre(d.takip_turu ?? ''), hucre(tarihYaz(z.bas)), hucre(`${z.yil} yıl`), hucre(tarihYaz(z.bitis)), hucre(durum, z.gecti ? 'hs-yesil' : z.kalan < 365 ? 'hs-sari' : ''));
      return tr;
    })));
    if (sat.some(x => x.z.gecti)) k.appendChild(el('p', 'hs-uyari', 'Zamanaşımı dolmuş görünen dosyalar var. Bu durumu avukatınla teyit et; itiraz yapılmazsa takip sürebilir.'));
    return k;
  }

  /* ——— Denetim süresi ——— */
  function denetimBolumu() {
    const k = kutuUret('Denetim süresi', 'Dava açılmasının ertelenmesi gibi, belirli bir süre boyunca izlenen durumlar için kalan süre sayacı.');
    const duzenle = el('button', 'btn ghost sm', s.denetim ? 'Düzenle' : '+ Ekle'); duzenle.type = 'button';
    duzenle.addEventListener('click', () => {
      const d = kutu('Denetim süresi');
      const bas = girdi('ds-bas', 'date', s.denetim?.bas ?? ''); const yil = girdi('ds-yil', 'number', String(s.denetim?.yil ?? 5)); yil.min = '1'; yil.max = '30';
      const not = girdi('ds-not', 'text', s.denetim?.not ?? ''); not.maxLength = 200; not.placeholder = 'Örn. TCK 191 — dava açılmasının ertelenmesi';
      d.alan('Başlangıç tarihi', bas); d.alan('Süre (yıl)', yil); d.alan('Açıklama', not);
      d.f.addEventListener('submit', async e => {
        e.preventDefault();
        if (!bas.value || !(Number(yil.value) >= 1)) { d.hatayaz('Başlangıç tarihi ve süre gerekli.'); return; }
        d.kaydet.disabled = true;
        try { await denetimYaz({ bas: bas.value, yil: Number(yil.value), not: not.value.trim() }); d.dlg.close(); void yukle(); } catch (err) { d.kaydet.disabled = false; d.hatayaz(hataMetni(err)); }
      });
      d.bitir();
    });
    k.firstElementChild!.after(duzenle);
    const dd = s.denetim ? denetimDurumu(s.denetim, bugun) : null;
    if (!s.denetim || !dd) { k.appendChild(el('p', 'bos', 'Henüz denetim süresi yok.')); return k; }
    const bar = el('div', 'hs-bar'); const ic = el('i'); ic.style.width = `${dd.yuzde}%`; bar.appendChild(ic);
    k.append(el('p', 'hs-ds', `${s.denetim.not || 'Denetim süresi'}`), bar,
      el('p', 'hs-not', `${tarihYaz(s.denetim.bas)} → ${tarihYaz(dd.bitis)} · ${s.denetim.yil} yıl · %${dd.yuzde}${dd.bitti ? ` · süre ${-dd.kalan} gün önce doldu` : ` · ${dd.kalan} gün kaldı`}`));
    return k;
  }

  function ciz() {
    sayfa.replaceChildren();
    if (s.yukleniyor) { sayfa.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      sayfa.append(el('p', 'bos hata', s.hata), b); return;
    }
    sayfa.append(sabitBolumu(), imzaBolumu(), sureBolumu());
    const teb = tebligBolumu(); if (teb) sayfa.appendChild(teb);
    sayfa.append(zamanBolumu(), denetimBolumu());
  }

  ciz();
  void yukle();
}
