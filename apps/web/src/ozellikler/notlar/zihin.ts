import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from '../../veri/kayit';

const SUTUN = ['baslik', 'ust_id', 'icerik', 'sira'];
const BEKLEME_MS = 800;

/* Sayfaları üst–alt sırasıyla, girinti derinliğiyle düzleştirir. Döngü olursa kopan kayıtlar en sona kök olarak eklenir. */
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
    [...(cocuklar.get(u) ?? [])].sort((a, b) => Number(a.sira) - Number(b.sira) || String(a.baslik).localeCompare(String(b.baslik), 'tr'))
      .forEach(k => { if (gorulen.has(k.id)) return; gorulen.add(k.id); sonuc.push({ k, derinlik: d }); gez(k.id, d + 1); });
  };
  gez(null, 0);
  liste.filter(k => !gorulen.has(k.id)).forEach(k => sonuc.push({ k, derinlik: 0 }));
  return sonuc;
}

export function zihinSayfasi(kok: HTMLElement) {
  const s = { liste: [] as Kayit[], secili: '' as string, yukleniyor: true, hata: '', ara: '' };
  const kart = el('section', 'card zihin');
  kok.replaceChildren(kart);
  const sol = el('div', 'zihin-sol'), sag = el('div', 'zihin-sag');
  kart.append(sol, sag);
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Sayfalarda ara'; ara.setAttribute('aria-label', 'Ara');
  const yeni = el('button', 'btn primary sm', '+ Sayfa'); yeni.type = 'button'; yeni.id = 'zihin-yeni';
  const ust = el('div', 'tbar'); ust.append(ara, yeni);
  const agac = el('div', 'zihin-agac');
  sol.append(ust, agac);

  let zaman: number | undefined;
  let bekleyen: { id: string; g: Record<string, unknown> } | null = null;
  let durumYazi: HTMLElement | null = null;
  const yerles = (k: Kayit) => { const i = s.liste.findIndex(x => x.id === k.id); if (i >= 0) s.liste[i] = k; else s.liste.push(k); };
  const mevcut = () => s.liste.find(k => k.id === s.secili);

  async function bosalt() {
    clearTimeout(zaman);
    const b = bekleyen; bekleyen = null;
    if (!b) return;
    const k = s.liste.find(x => x.id === b.id);
    if (!k) return;
    if (durumYazi) durumYazi.textContent = 'Kaydediliyor…';
    try { yerles(await kayitGuncelle('zihin_sayfalari', SUTUN, k.id, k.surum, b.g)); if (durumYazi) durumYazi.textContent = 'Kaydedildi'; agacCiz(); }
    catch (e) {
      if (durumYazi) durumYazi.textContent = e instanceof CakismaHatasi ? 'Başka yerde değişmiş, sayfayı yenile' : 'Kaydedilemedi';
      bildir(hataMetni(e), undefined, true);
    }
  }
  const planla = (id: string, g: Record<string, unknown>) => {
    bekleyen = { id, g: { ...(bekleyen?.id === id ? bekleyen.g : {}), ...g } };
    if (durumYazi) durumYazi.textContent = 'Yazıyor…';
    clearTimeout(zaman); zaman = window.setTimeout(() => void bosalt(), BEKLEME_MS);
  };

  function agacCiz() {
    agac.replaceChildren();
    if (s.yukleniyor) { agac.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const t = el('button', 'btn ghost sm', 'Tekrar dene'); t.type = 'button'; t.addEventListener('click', () => void yukle());
      agac.append(el('p', 'bos hata', s.hata), t); return;
    }
    const q = katla(s.ara.trim());
    const sirali = agacSirala(s.liste).filter(({ k }) => !q || katla(`${k.baslik} ${k.icerik}`).includes(q));
    if (!sirali.length) { agac.appendChild(el('p', 'bos', s.liste.length ? 'Aramana uyan sayfa yok.' : 'Henüz sayfa yok. "+ Sayfa" ile ilkini aç.')); return; }
    sirali.forEach(({ k, derinlik }) => {
      const b = el('button', 'zihin-oge' + (k.id === s.secili ? ' secili' : ''), String(k.baslik));
      b.type = 'button'; b.style.paddingLeft = 10 + derinlik * 16 + 'px'; b.dataset.id = k.id;
      b.addEventListener('click', async () => { await bosalt(); s.secili = k.id; agacCiz(); editorCiz(); });
      agac.appendChild(b);
    });
  }

  function editorCiz() {
    sag.replaceChildren(); durumYazi = null;
    const k = mevcut();
    if (!k) { sag.appendChild(el('p', 'bos', 'Soldan bir sayfa seç ya da yeni sayfa aç.')); return; }
    const ad = el('input', 'zihin-baslik'); ad.id = 'zihin-baslik'; ad.value = String(k.baslik); ad.maxLength = 200; ad.setAttribute('aria-label', 'Sayfa başlığı');
    const metin = el('textarea', 'zihin-metin'); metin.id = 'zihin-metin'; metin.value = String(k.icerik ?? ''); metin.setAttribute('aria-label', 'Sayfa içeriği');
    metin.placeholder = 'Yazmaya başla…';
    const araclar = el('div', 'tbar');
    const alt = el('button', 'btn ghost sm', '+ Alt sayfa'); alt.type = 'button'; alt.id = 'zihin-alt';
    const sil = el('button', 'btn danger sm', 'Sil'); sil.type = 'button'; sil.id = 'zihin-sil';
    const yazi = el('span', 'tbar-count'); durumYazi = yazi;
    araclar.append(alt, sil, el('span', 'tbar-sp'), yazi);
    ad.addEventListener('input', () => { if (ad.value.trim()) planla(k.id, { baslik: ad.value.trim() }); });
    metin.addEventListener('input', () => planla(k.id, { icerik: metin.value }));
    alt.addEventListener('click', () => void sayfaAc(k.id));
    let emin = false;
    sil.addEventListener('click', async () => {
      if (s.liste.some(x => x.ust_id === k.id)) { bildir('Önce alt sayfaları sil ya da taşı', undefined, true); return; }
      if (!emin) { emin = true; sil.textContent = 'Emin misin? Tekrar bas'; return; }
      await bosalt();
      const son = s.liste.find(x => x.id === k.id)!;
      try {
        const silinen = await kayitGuncelle('zihin_sayfalari', SUTUN, son.id, son.surum, { silindi_at: new Date().toISOString() });
        s.liste = s.liste.filter(x => x.id !== k.id); s.secili = ''; agacCiz(); editorCiz();
        bildir('Sayfa silindi', async () => { try { yerles(await kayitGuncelle('zihin_sayfalari', SUTUN, silinen.id, silinen.surum, { silindi_at: null })); s.secili = silinen.id; agacCiz(); editorCiz(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
      } catch (e) { bildir(hataMetni(e), undefined, true); }
    });
    sag.append(ad, araclar, metin);
  }

  async function sayfaAc(ustId: string | null) {
    try {
      await bosalt();
      const k = await kayitEkle('zihin_sayfalari', SUTUN, { baslik: 'Adsız sayfa', ust_id: ustId, icerik: '', sira: s.liste.filter(x => (x.ust_id ?? null) === ustId).length });
      yerles(k); s.secili = k.id; agacCiz(); editorCiz();
      const a = document.getElementById('zihin-baslik') as HTMLInputElement | null; a?.focus(); a?.select();
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; agacCiz();
    try { s.liste = await kayitlariGetir('zihin_sayfalari', SUTUN, {}, 'sira'); if (!mevcut()) s.secili = ''; } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; agacCiz(); editorCiz();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; agacCiz(); });
  yeni.addEventListener('click', () => void sayfaAc(null));
  addEventListener('pagehide', () => void bosalt());
  void yukle();
}
