import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from '../../veri/kayit';
import { onayla } from '../../ortak/uyari';
import { editorAc, type Editor, type Sayfa } from '../zihin/editor';
import { bloklarOf } from '../zihin/bloklar';

const SUTUN = ['baslik', 'ust_id', 'icerik', 'sira', 'ikon', 'bloklar', 'one', 'onemli', 'onemli_not', 'onemli_renk', 'alan', 'kategori', 'etiketler'];
const BEKLEME_MS = 800;
const KAYIT_ALANLARI = ['baslik', 'ikon', 'bloklar', 'icerik', 'one', 'onemli', 'onemli_not', 'onemli_renk', 'kategori', 'etiketler'] as const;
export const KUTUPHANE_KATEGORILERI = ['AI Notları', 'Proje ve İşler', 'İlham Panosu', 'Recall Center'];

export type NotAyar = { alan: 'zihin' | 'kutuphane'; ad: string; kategoriler?: string[] };

/* Sayfaları üst–alt sırasıyla, girinti derinliğiyle düzleştirir. Döngü olursa kopan kayıtlar en sona kök olarak eklenir.
   Aynı düzeyde öne çıkarılanlar en üsttedir. */
export function agacSirala(liste: Kayit[]): { k: Kayit; derinlik: number }[] {
  const cocuklar = new Map<string | null, Kayit[]>();
  const idler = new Set(liste.map(k => k.id));
  liste.forEach(k => {
    const u = k.ust_id && idler.has(String(k.ust_id)) ? String(k.ust_id) : null;
    cocuklar.set(u, [...(cocuklar.get(u) ?? []), k]);
  });
  const sonuc: { k: Kayit; derinlik: number }[] = [];
  const gorulen = new Set<string>();
  const gez = (u: string | null, d: number) => {
    [...(cocuklar.get(u) ?? [])].sort((a, b) => Number(!!b.one) - Number(!!a.one) || Number(a.sira) - Number(b.sira) || String(a.baslik).localeCompare(String(b.baslik), 'tr'))
      .forEach(k => { if (gorulen.has(k.id)) return; gorulen.add(k.id); sonuc.push({ k, derinlik: d }); gez(k.id, d + 1); });
  };
  gez(null, 0);
  liste.filter(k => !gorulen.has(k.id)).forEach(k => sonuc.push({ k, derinlik: 0 }));
  return sonuc;
}

export const zihinSayfasi = (kok: HTMLElement) => notSayfasi({ alan: 'zihin', ad: 'Zihin Sarayı' })(kok);
export const kutuphaneSayfasi = (kok: HTMLElement) => notSayfasi({ alan: 'kutuphane', ad: 'Bilgi Kütüphanesi', kategoriler: KUTUPHANE_KATEGORILERI })(kok);

function notSayfasi(ayar: NotAyar) {
  return (kok: HTMLElement) => {
  const kutup = ayar.alan === 'kutuphane';
  const s = { liste: [] as Kayit[], secili: '' as string, yukleniyor: true, hata: '', ara: '', kat: '' };
  const kart = el('section', 'card zihin');
  kok.replaceChildren(kart);
  const sol = el('div', 'zihin-sol'), sag = el('div', 'zihin-sag');
  kart.append(sol, sag);
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Sayfalarda ara'; ara.setAttribute('aria-label', 'Ara');
  const yeni = el('button', 'btn primary sm', '+ Sayfa'); yeni.type = 'button'; yeni.id = 'zihin-yeni';
  const ust = el('div', 'tbar'); ust.append(ara, yeni);
  const agac = el('div', 'zihin-agac');
  const katSerit = el('div', 'zihin-kat');
  sol.append(ust, ...(kutup ? [katSerit] : []), agac);

  let editor: Editor | null = null;
  let icerde = false;
  let zaman: number | undefined;
  let kuyruk: Promise<void> = Promise.resolve();
  /* Son kaydedilen değerler: yalnız değişen alanlar sunucuya yazılır (içerik büyük olabilir). */
  const sonKayit = new Map<string, Record<string, string>>();
  const imza = (k: Kayit): Record<string, string> => Object.fromEntries(KAYIT_ALANLARI.map(a => [a, JSON.stringify(k[a] ?? null)]));
  const hatirla = (k: Kayit) => sonKayit.set(k.id, imza(k));
  const yerles = (k: Kayit) => { const i = s.liste.findIndex(x => x.id === k.id); if (i >= 0) s.liste[i] = k; else s.liste.push(k); hatirla(k); };
  const mevcut = () => s.liste.find(k => k.id === s.secili);
  let durumYazi: HTMLElement | null = null;
  const yaz = (m: string) => { if (durumYazi) durumYazi.textContent = m; };

  /* Kayıtlar tek tek, sırayla yazılır; sürüm yalnız sayı olarak güncellenir (düzenleyicinin elindeki içerik ezilmez). */
  function bosalt(): Promise<void> {
    clearTimeout(zaman);
    icerde = true; editor?.bosalt(); icerde = false;
    kuyruk = kuyruk.then(async () => {
      for (const k of s.liste) {
        const eski = sonKayit.get(k.id); if (!eski) continue;
        const simdi = imza(k);
        const g: Record<string, unknown> = {};
        let fark = false;
        for (const a of KAYIT_ALANLARI) if (simdi[a] !== eski[a]) { g[a] = k[a] ?? null; fark = true; }
        if (!fark) continue;
        if ('baslik' in g && !String(g.baslik ?? '').trim()) continue;
        yaz('Kaydediliyor…');
        try {
          const y = await kayitGuncelle('zihin_sayfalari', ['baslik'], k.id, k.surum, g);
          k.surum = y.surum; sonKayit.set(k.id, { ...(sonKayit.get(k.id) ?? {}), ...Object.fromEntries(Object.keys(g).map(a => [a, simdi[a]!])) });
          yaz('Kaydedildi');
        } catch (e) {
          yaz(e instanceof CakismaHatasi ? 'Başka yerde değişmiş, sayfayı yenile' : 'Kaydedilemedi');
          bildir(hataMetni(e), undefined, true);
        }
      }
    });
    return kuyruk;
  }
  const planla = () => { yaz('Yazıyor…'); clearTimeout(zaman); zaman = window.setTimeout(() => void bosalt(), BEKLEME_MS); };

  function yolMetni(k: Kayit): string {
    const parcalar: string[] = [];
    let u = k.ust_id ? s.liste.find(x => x.id === k.ust_id) : undefined;
    for (let n = 0; u && n < 20; n++) { parcalar.unshift(String(u.baslik)); u = u.ust_id ? s.liste.find(x => x.id === u!.ust_id) : undefined; }
    return [ayar.ad, ...parcalar].join(' / ');
  }

  const kategoriOf = (k: Kayit) => String(k.kategori || '') || (ayar.kategoriler?.[0] ?? '');
  const kokKategori = (k: Kayit): string => {
    let g = k;
    for (let n = 0; g.ust_id && n < 20; n++) { const u = s.liste.find(x => x.id === g.ust_id); if (!u) break; g = u; }
    return kategoriOf(g);
  };
  const kategoriler = () => [...new Set([...(ayar.kategoriler ?? []), ...s.liste.map(kategoriOf)])].filter(Boolean);
  function katCiz() {
    if (!kutup) return;
    katSerit.replaceChildren();
    ['', ...kategoriler()].forEach(c => {
      const b = el('button', 'zihin-kat-dugme' + (s.kat === c ? ' secili' : ''), c || 'Tümü'); b.type = 'button';
      b.addEventListener('click', () => { s.kat = c; agacCiz(); });
      katSerit.appendChild(b);
    });
  }

  function agacCiz() {
    agac.replaceChildren();
    if (s.yukleniyor) { agac.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const t = el('button', 'btn ghost sm', 'Tekrar dene'); t.type = 'button'; t.addEventListener('click', () => void yukle());
      agac.append(el('p', 'bos hata', s.hata), t); return;
    }
    const q = katla(s.ara.trim());
    katCiz();
    const sirali = agacSirala(s.liste).filter(({ k }) => (!kutup || !s.kat || kategoriOf(k) === s.kat || (k.ust_id && s.liste.some(x => x.id === k.ust_id) && kokKategori(k) === s.kat))
      && (!q || katla(`${k.baslik} ${k.icerik} ${(k.etiketler as string[] | undefined ?? []).join(' ')}`).includes(q)));
    if (!sirali.length) { agac.appendChild(el('p', 'bos', s.liste.length ? 'Aramana uyan sayfa yok.' : 'Henüz sayfa yok. "+ Sayfa" ile ilkini aç.')); return; }
    sirali.forEach(({ k, derinlik }) => {
      const b = el('button', 'zihin-oge' + (k.id === s.secili ? ' secili' : ''));
      b.type = 'button'; b.style.paddingLeft = 10 + derinlik * 16 + 'px'; b.dataset.id = k.id;
      b.append(el('span', 'zihin-oge-ad', `${k.ikon ? k.ikon + ' ' : ''}${k.one ? '★ ' : ''}${k.onemli ? '‼︎ ' : ''}${k.baslik}`));
      b.addEventListener('click', () => void sec(k.id));
      agac.appendChild(b);
    });
  }

  async function sec(id: string) {
    await bosalt();
    s.secili = id; agacCiz(); editorCiz();
  }

  function editorCiz() {
    editor?.kapat(); editor = null; durumYazi = null;
    sag.replaceChildren();
    const k = mevcut();
    if (!k) { sag.appendChild(el('p', 'bos', 'Soldan bir sayfa seç ya da yeni sayfa aç.')); return; }
    const kap = el('div', 'zihin-editor');
    if (kutup) sag.appendChild(ozellikBar(k));
    const yazi = el('span', 'tbar-count zihin-durum'); durumYazi = yazi;
    sag.append(kap, yazi);
    editor = editorAc({
      kok: kap,
      al: () => (mevcut() as unknown as Sayfa | undefined),
      degisti: () => { if (!icerde) planla(); agacCiz(); },
      yol: g => yolMetni(g as unknown as Kayit),
      sayfalar: () => s.liste.map(x => ({ id: x.id, ad: String(x.baslik), ikon: String(x.ikon || '▤'), yol: yolMetni(x) })),
      sayfaAc: id => { if (s.liste.some(x => x.id === id)) void sec(id); else bildir('Bağlanan sayfa bulunamadı.', undefined, true); },
      eylemler: () => [
        { etiket: '+ Alt sayfa', id: 'zihin-alt', tikla: () => void sayfaAc(k.id) },
        { etiket: 'Sil', id: 'zihin-sil', sinif: 'danger sm', tikla: () => void sil(k) },
      ],
    });
  }

  /* Kütüphane sayfalarının kategori ve etiketleri. */
  function ozellikBar(k: Kayit): HTMLElement {
    const bar = el('div', 'zihin-ozellik');
    if (k.ust_id) { bar.append(el('span', 'tbar-count', `Kategori: ${kokKategori(k)} (üst sayfadan)`)); return bar; }
    const sec = el('select'); sec.id = 'kut-kat'; sec.setAttribute('aria-label', 'Kategori');
    const secenekler = kategoriler();
    secenekler.forEach(c => sec.append(new Option(c, c)));
    sec.append(new Option('+ Yeni kategori…', '__yeni'));
    sec.value = kategoriOf(k);
    sec.addEventListener('change', () => {
      let v = sec.value;
      if (v === '__yeni') { v = (window.prompt('Yeni kategori adı') ?? '').trim().slice(0, 60); if (!v) { sec.value = kategoriOf(k); return; } }
      k.kategori = v; planla(); agacCiz(); editorCiz();
    });
    const et = el('input'); et.id = 'kut-etiket'; et.placeholder = 'Etiketler (virgülle)'; et.setAttribute('aria-label', 'Etiketler');
    et.value = (k.etiketler as string[] | undefined ?? []).join(', ');
    et.addEventListener('change', () => {
      k.etiketler = [...new Set(et.value.split(',').map(x => x.trim()).filter(Boolean))].slice(0, 20).map(x => x.slice(0, 40));
      planla(); agacCiz();
    });
    bar.append(sec, et);
    return bar;
  }

  async function sil(k: Kayit) {
    if (s.liste.some(x => x.ust_id === k.id)) { bildir('Önce alt sayfaları sil ya da taşı', undefined, true); return; }
    if (!(await onayla({ baslik: 'Sayfa silinsin mi?', metin: String(k.baslik), evet: 'Sil' }))) return;
    await bosalt();
    try {
      const silinen = await kayitGuncelle('zihin_sayfalari', SUTUN, k.id, k.surum, { silindi_at: new Date().toISOString() });
      s.liste = s.liste.filter(x => x.id !== k.id); sonKayit.delete(k.id); s.secili = ''; agacCiz(); editorCiz();
      bildir('Sayfa silindi', async () => {
        try { yerles(await kayitGuncelle('zihin_sayfalari', SUTUN, silinen.id, silinen.surum, { silindi_at: null })); s.secili = silinen.id; agacCiz(); editorCiz(); bildir('Geri alındı'); }
        catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
      });
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function sayfaAc(ustId: string | null) {
    try {
      await bosalt();
      const k = await kayitEkle('zihin_sayfalari', SUTUN, { baslik: 'Adsız sayfa', ust_id: ustId, alan: ayar.alan, ...(kutup && !ustId ? { kategori: s.kat || ayar.kategoriler![0] } : {}), icerik: '', bloklar: [], sira: s.liste.filter(x => (x.ust_id ?? null) === ustId).length });
      yerles(k); s.secili = k.id; agacCiz(); editorCiz();
      const a = document.getElementById('ze-baslik') as HTMLInputElement | null; a?.focus(); a?.select();
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; agacCiz();
    try {
      s.liste = await kayitlariGetir('zihin_sayfalari', SUTUN, { alan: ayar.alan }, 'sira');
      s.liste.forEach(k => { if (!Array.isArray(k.bloklar)) k.bloklar = []; hatirla(k); });
      if (!mevcut()) s.secili = '';
    } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; agacCiz(); editorCiz();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; agacCiz(); });
  yeni.addEventListener('click', () => void sayfaAc(null));
  addEventListener('pagehide', () => void bosalt());
  void bloklarOf;
  void yukle();
  };
}
