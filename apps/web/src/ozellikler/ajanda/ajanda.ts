import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun, tl } from '../../ortak/bicim';
import { ayGunu, ayaDenk } from '../kayit/tekrar';
import { git } from '../../kabuk/yonlendirici';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from '../../veri/kayit';
import { onayla } from '../../ortak/uyari';
import { sabitleriGetir, imzaGetir } from '../../veri/sabitler';
import { yukumlulukTarihi, type Imza, type Yukumluluk } from '../../veri/sureler';

type Tur = 'odeme' | 'gelir' | 'gider' | 'alinacak' | 'hedef' | 'todo' | 'durusma' | 'etkinlik' | 'sabit';
type Olay = { tarih: string; baslik: string; tur: Tur; saat?: string; tutar?: number; sayfa: string; kayit?: Kayit; bitti?: boolean };

const TUR_AD: Record<Tur, string> = { odeme: 'Ödeme', gelir: 'Gelir', gider: 'Gider', alinacak: 'Alınacak', hedef: 'Hedef', todo: 'Görev', durusma: 'Duruşma', etkinlik: 'Etkinlik', sabit: 'Sabit tarih' };
const GIDER_SAYFA: Record<string, string> = { fatura: 'e-fatura', abonelik: 'e-abone', sabit: 'e-sabit', tek_sefer: 'e-sabit' };
const AY_ADI = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const GUN_ADI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const SOZ = ['odeme', 'gelir', 'gider', 'alinacak', 'hedef', 'todo', 'durusma', 'etkinlik', 'sabit'] as Tur[];

const bugunStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const iki = (n: number) => String(n).padStart(2, '0');
const tarihYaz = (y: number, a: number, g: number) => `${y}-${iki(a + 1)}-${iki(g)}`;
const ayinGunSayisi = (y: number, a: number) => new Date(y, a + 1, 0).getDate();
const sayi = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));

/* Ayın her gününe düşen olaylar. Aylık, 3 aylık ve yıllık tekrarlar ile tek seferlik giderler kendi aylarında görünür; ayın kısa olduğu aylarda son güne çekilir. */
export function olaylariUret(y: number, a: number, k: {
  odemeler: Kayit[]; borclar: Map<string, string>; gelirler: Kayit[]; giderler: Kayit[]; alinacaklar: Kayit[]; hedefler: Kayit[]; todolar: Kayit[]; davalar: Kayit[]; olaylar: Kayit[]; sabitler?: Yukumluluk[]; imza?: Imza;
}): Olay[] {
  const ay = `${y}-${iki(a + 1)}`;
  const o: Olay[] = [];
  const gunYaz = (g: unknown) => tarihYaz(y, a, Math.min(sayi(g), ayinGunSayisi(y, a)));
  const aralikta = (t: string, bas: unknown, bit: unknown) => (!bas || t >= String(bas)) && (!bit || t <= String(bit));

  k.odemeler.filter(x => x.durum !== 'iptal' && String(x.vade_tarihi).startsWith(ay)).forEach(x =>
    o.push({ tarih: String(x.vade_tarihi), baslik: k.borclar.get(String(x.borc_id)) ?? 'Borç ödemesi', tur: 'odeme', tutar: sayi(x.tutar), sayfa: 'o-takvim', bitti: x.durum === 'odendi' }));
  k.gelirler.filter(x => x.aktif !== false).forEach(x => {
    if (x.sabit) {
      const g = ayGunu(x);
      if (!g || !ayaDenk(x, ay)) return;
      const t = gunYaz(g);
      if (aralikta(t, x.baslangic, x.bitis)) o.push({ tarih: t, baslik: String(x.ad), tur: 'gelir', tutar: sayi(x.tutar), sayfa: 'g-sabit' });
    } else if (String(x.baslangic ?? '').startsWith(ay)) {
      o.push({ tarih: String(x.baslangic), baslik: String(x.ad), tur: 'gelir', tutar: sayi(x.tutar), sayfa: 'g-ekstra', bitti: true });
    }
  });
  k.giderler.filter(x => x.aktif !== false).forEach(x => {
    const g = ayGunu(x);
    if (!g || !ayaDenk(x, ay)) return;
    const t = x.periyot === 'tek_sefer' ? String(x.baslangic) : gunYaz(g);
    if (aralikta(t, x.baslangic, x.bitis)) o.push({ tarih: t, baslik: String(x.ad), tur: 'gider', tutar: sayi(x.tutar), sayfa: GIDER_SAYFA[String(x.tur)] ?? 'e-ozet' });
  });
  k.alinacaklar.filter(x => x.durum === 'karar' && String(x.hedef_tarih ?? '').startsWith(ay)).forEach(x =>
    o.push({ tarih: String(x.hedef_tarih), baslik: String(x.ad), tur: 'alinacak', tutar: x.tahmini_tutar === null ? undefined : sayi(x.tahmini_tutar), sayfa: 'e-alinacak' }));
  k.hedefler.filter(x => x.durum === 'aktif' && String(x.hedef_tarihi ?? '').startsWith(ay)).forEach(x =>
    o.push({ tarih: String(x.hedef_tarihi), baslik: String(x.ad), tur: 'hedef', sayfa: 'h-hedef' }));
  k.todolar.filter(x => String(x.tarih ?? '').startsWith(ay)).forEach(x =>
    o.push({ tarih: String(x.tarih), baslik: String(x.baslik), tur: 'todo', sayfa: 'n-todo', bitti: !!x.tamamlandi }));
  k.davalar.filter(x => x.durum !== 'kapandi' && String(x.sonraki_durusma ?? '').startsWith(ay)).forEach(x =>
    o.push({ tarih: String(x.sonraki_durusma), baslik: `${x.konu ?? x.mahkeme ?? 'Dosya'} duruşması`, tur: 'durusma', sayfa: ({ ceza: 'k-ceza', hukuk: 'k-hukuk', cbs: 'k-cbs' } as Record<string, string>)[String(x.tur)] ?? 'k-hukuk' }));
  k.olaylar.filter(x => String(x.tarih).startsWith(ay)).forEach(x =>
    o.push({ tarih: String(x.tarih), baslik: String(x.baslik), tur: 'etkinlik', saat: (x.saat as string | null) ?? undefined, sayfa: 'a-ajanda', kayit: x, bitti: !!x.tamamlandi }));
  (k.sabitler ?? []).filter(x => x.aktif).forEach(x =>
    o.push({ tarih: yukumlulukTarihi(x, ay), baslik: x.ad, tur: 'sabit', sayfa: 'k-sure' }));
  if (k.imza?.aktif) {
    const t = yukumlulukTarihi({ gun: k.imza.gun }, ay);
    o.push({ tarih: t, baslik: 'Karakol imzası', tur: 'sabit', sayfa: 'k-sure', bitti: !!k.imza.log[ay] });
  }
  return o.sort((p, q) => p.tarih.localeCompare(q.tarih) || (p.saat ?? '').localeCompare(q.saat ?? ''));
}

const OLAY_SUTUN = ['baslik', 'tarih', 'saat', 'notlar', 'tamamlandi'];

export function ajandaSayfasi(kok: HTMLElement) {
  const simdi = new Date();
  const s = {
    y: simdi.getFullYear(), a: simdi.getMonth(), secili: bugunStr(), yukleniyor: true, uyari: [] as string[],
    veri: { odemeler: [] as Kayit[], borclar: new Map<string, string>(), gelirler: [] as Kayit[], giderler: [] as Kayit[], alinacaklar: [] as Kayit[], hedefler: [] as Kayit[], todolar: [] as Kayit[], davalar: [] as Kayit[], olaylar: [] as Kayit[], sabitler: [] as Yukumluluk[], imza: undefined as Imza | undefined },
    acik: new Set<Tur>(SOZ),
  };
  const kart = el('section', 'card ajanda');
  kok.replaceChildren(kart);
  const bar = el('div', 'tbar');
  const geri = el('button', 'btn ghost sm', '‹'); geri.type = 'button'; geri.setAttribute('aria-label', 'Önceki ay');
  const ileri = el('button', 'btn ghost sm', '›'); ileri.type = 'button'; ileri.setAttribute('aria-label', 'Sonraki ay');
  const bugun = el('button', 'btn ghost sm', 'Bugün'); bugun.type = 'button';
  const baslik = el('b', 'ajanda-ay');
  const yeni = el('button', 'btn primary sm', '+ Yeni etkinlik'); yeni.type = 'button'; yeni.id = 'ajanda-yeni';
  bar.append(geri, baslik, ileri, bugun, el('span', 'tbar-sp'), yeni);
  const suz = el('div', 'ajanda-suz');
  const uyari = el('p', 'bos hata'); uyari.hidden = true;
  const izgara = el('div', 'ajanda-izgara');
  const gunDetay = el('div', 'ajanda-detay');
  kart.append(bar, suz, uyari, izgara, gunDetay);

  SOZ.forEach(t => {
    const l = el('label', `ajanda-etiket t-${t}`);
    const c = el('input'); c.type = 'checkbox'; c.checked = true; c.id = 'ajanda-suz-' + t;
    c.addEventListener('change', () => { if (c.checked) s.acik.add(t); else s.acik.delete(t); ciz(); });
    l.append(c, document.createTextNode(TUR_AD[t]));
    suz.appendChild(l);
  });

  const olaylar = () => olaylariUret(s.y, s.a, s.veri).filter(x => s.acik.has(x.tur));

  function chip(x: Olay) {
    const c = el('span', `ajanda-chip t-${x.tur}${x.bitti ? ' bitti' : ''}`);
    c.textContent = (x.saat ? x.saat + ' ' : '') + x.baslik;
    return c;
  }

  function ciz() {
    baslik.textContent = AY_ADI.format(new Date(s.y, s.a, 1));
    uyari.hidden = !s.uyari.length;
    uyari.textContent = s.uyari.length ? `Bazı kaynaklar yüklenemedi: ${s.uyari.join(', ')}. Sayfayı yenile ya da veritabanı güncellemelerini kontrol et.` : '';
    izgara.replaceChildren();
    GUN_ADI.forEach(g => izgara.appendChild(el('div', 'ajanda-gun-ad', g)));
    const liste = olaylar();
    const ilk = (new Date(s.y, s.a, 1).getDay() + 6) % 7;
    for (let i = 0; i < ilk; i++) izgara.appendChild(el('div', 'ajanda-hucre bos-hucre'));
    const bg = bugunStr();
    for (let g = 1; g <= ayinGunSayisi(s.y, s.a); g++) {
      const t = tarihYaz(s.y, s.a, g);
      const gunOlay = liste.filter(x => x.tarih === t);
      const h = el('button', 'ajanda-hucre' + (t === bg ? ' bugun' : '') + (t === s.secili ? ' secili' : ''));
      h.type = 'button'; h.dataset.tarih = t;
      h.appendChild(el('span', 'ajanda-no', String(g)));
      gunOlay.slice(0, 3).forEach(x => h.appendChild(chip(x)));
      if (gunOlay.length > 3) h.appendChild(el('span', 'ajanda-diger', `+${gunOlay.length - 3} daha`));
      h.addEventListener('click', () => { s.secili = t; ciz(); });
      izgara.appendChild(h);
    }
    detayCiz(liste);
  }

  function detayCiz(liste: Olay[]) {
    gunDetay.replaceChildren();
    gunDetay.appendChild(el('h3', '', gun(s.secili)));
    const gunOlay = s.yukleniyor ? [] : liste.filter(x => x.tarih === s.secili);
    if (s.yukleniyor) { gunDetay.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (!gunOlay.length) { gunDetay.appendChild(el('p', 'bos', 'Bu gün için kayıt yok.')); return; }
    const ul = el('ul', 'ajanda-liste');
    gunOlay.forEach(x => {
      const li = el('li', 'ajanda-satir');
      li.appendChild(chip({ ...x, baslik: TUR_AD[x.tur], saat: undefined }));
      const d = el('button', 'ajanda-baslik', `${x.saat ? x.saat + ' · ' : ''}${x.baslik}${x.tutar !== undefined ? ' · ' + tl(x.tutar) : ''}${x.bitti ? ' (tamam)' : ''}`);
      d.type = 'button';
      d.addEventListener('click', () => { if (x.kayit) form(x.kayit); else git(x.sayfa); });
      li.appendChild(d);
      ul.appendChild(li);
    });
    gunDetay.appendChild(ul);
  }

  async function yukle() {
    s.yukleniyor = true; ciz();
    const kaynaklar: [string, string, string[], Record<string, string | number | boolean>, string][] = [
      ['odemeler', 'odemeler', ['borc_id', 'vade_tarihi', 'tutar', 'durum'], {}, 'vade_tarihi'],
      ['borclar', 'borçlar', ['ad'], {}, 'ad'],
      ['gelirler', 'gelirler', ['ad', 'tur', 'sabit', 'periyot', 'tutar', 'gun', 'baslangic', 'bitis', 'aktif'], {}, 'ad'],
      ['giderler', 'giderler', ['ad', 'tur', 'periyot', 'tutar', 'gun', 'baslangic', 'bitis', 'aktif'], {}, 'ad'],
      ['alinacaklar', 'alınacaklar', ['ad', 'hedef_tarih', 'durum', 'tahmini_tutar'], {}, 'ad'],
      ['hedefler', 'hedefler', ['ad', 'hedef_tarihi', 'durum'], {}, 'ad'],
      ['todolar', 'görevler', ['baslik', 'tarih', 'tamamlandi'], {}, 'tarih'],
      ['davalar', 'duruşmalar', ['tur', 'konu', 'mahkeme', 'durum', 'sonraki_durusma'], {}, 'sonraki_durusma'],
      ['ajanda_olaylari', 'etkinlikler', OLAY_SUTUN, {}, 'tarih'],
    ];
    const [sabitSonuc, imzaSonuc] = await Promise.allSettled([sabitleriGetir(), imzaGetir()]);
    const sonuc = await Promise.allSettled(kaynaklar.map(([t, , c, f, o]) => kayitlariGetir(t, c, f, o)));
    s.uyari = [];
    const al = (i: number) => { const r = sonuc[i]!; if (r.status === 'fulfilled') return r.value; s.uyari.push(kaynaklar[i]![1]); return [] as Kayit[]; };
    s.veri = {
      odemeler: al(0), borclar: new Map(al(1).map(b => [b.id, String(b.ad)])), gelirler: al(2), giderler: al(3), alinacaklar: al(4), hedefler: al(5), todolar: al(6), davalar: al(7), olaylar: al(8),
      sabitler: sabitSonuc.status === 'fulfilled' ? sabitSonuc.value : [], imza: imzaSonuc.status === 'fulfilled' ? imzaSonuc.value : undefined,
    };
    if (sabitSonuc.status === 'rejected' || imzaSonuc.status === 'rejected') s.uyari.push('sabit tarihler');
    s.yukleniyor = false; ciz();
  }

  function form(mevcut?: Kayit) {
    const dlg = el('dialog', 'kutu'); dlg.setAttribute('aria-label', mevcut ? 'Etkinliği düzenle' : 'Yeni etkinlik');
    const f = el('form'); f.noValidate = true; f.method = 'dialog'; f.appendChild(el('h2', '', mevcut ? 'Etkinliği düzenle' : 'Yeni etkinlik'));
    const alan = (et: string, g: HTMLElement) => { const l = el('label', 'alan'); l.append(el('span', '', et), g); f.appendChild(l); };
    const ad = el('input'); ad.id = 'af-baslik'; ad.maxLength = 160; ad.value = mevcut ? String(mevcut.baslik) : '';
    const tarih = el('input'); tarih.id = 'af-tarih'; tarih.type = 'date'; tarih.value = mevcut ? String(mevcut.tarih) : s.secili;
    const saat = el('input'); saat.id = 'af-saat'; saat.type = 'time'; saat.value = mevcut?.saat ? String(mevcut.saat) : '';
    const not = el('textarea'); not.id = 'af-not'; not.rows = 3; not.value = mevcut?.notlar ? String(mevcut.notlar) : '';
    const tam = el('input'); tam.id = 'af-tam'; tam.type = 'checkbox'; tam.checked = !!mevcut?.tamamlandi;
    alan('Başlık', ad); alan('Tarih', tarih); alan('Saat', saat); alan('Not', not);
    if (mevcut) alan('Tamamlandı', tam);
    const hata = el('p', 'form-hata'); hata.hidden = true; hata.setAttribute('role', 'alert'); f.appendChild(hata);
    const d = el('div', 'form-dugmeler');
    const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
    const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
    d.append(kaydet, vazgec);
    if (mevcut) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button';
      sil.addEventListener('click', async () => {
        if (!(await onayla({ baslik: 'Silinsin mi?', metin: 'Bu kayıt silinecek.', evet: 'Sil' }))) return;
        sil.disabled = true;
        try {
          const silinen = await kayitGuncelle('ajanda_olaylari', OLAY_SUTUN, mevcut.id, mevcut.surum, { silindi_at: new Date().toISOString() });
          s.veri.olaylar = s.veri.olaylar.filter(x => x.id !== mevcut.id); dlg.close(); ciz();
          bildir('Etkinlik silindi', async () => {
            try { s.veri.olaylar.push(await kayitGuncelle('ajanda_olaylari', OLAY_SUTUN, silinen.id, silinen.surum, { silindi_at: null })); ciz(); bildir('Geri alındı'); }
            catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
          });
        } catch (err) { sil.disabled = false; hata.textContent = hataMetni(err); hata.hidden = false; }
      });
      d.appendChild(sil);
    }
    f.appendChild(d);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!ad.value.trim() || !tarih.value) { hata.textContent = 'Başlık ve tarih gerekli.'; hata.hidden = false; return; }
      const g = { baslik: ad.value.trim(), tarih: tarih.value, saat: saat.value || null, notlar: not.value.trim() || null, tamamlandi: tam.checked };
      kaydet.disabled = true; hata.hidden = true;
      try {
        const k = mevcut ? await kayitGuncelle('ajanda_olaylari', OLAY_SUTUN, mevcut.id, mevcut.surum, g) : await kayitEkle('ajanda_olaylari', OLAY_SUTUN, g);
        s.veri.olaylar = [...s.veri.olaylar.filter(x => x.id !== k.id), k];
        s.secili = String(k.tarih);
        const [y, m] = s.secili.split('-').map(Number); s.y = y!; s.a = m! - 1;
        dlg.close(); ciz(); bildir('Kaydedildi');
      } catch (err) {
        kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
        hata.textContent = hataMetni(err); hata.hidden = false;
      }
    });
    dlg.appendChild(f); dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg); dlg.showModal(); ad.focus();
  }

  const ayGit = (k: number) => { const d = new Date(s.y, s.a + k, 1); s.y = d.getFullYear(); s.a = d.getMonth(); ciz(); };
  geri.addEventListener('click', () => ayGit(-1));
  ileri.addEventListener('click', () => ayGit(1));
  bugun.addEventListener('click', () => { const n = new Date(); s.y = n.getFullYear(); s.a = n.getMonth(); s.secili = bugunStr(); ciz(); });
  yeni.addEventListener('click', () => form());
  void yukle();
}
