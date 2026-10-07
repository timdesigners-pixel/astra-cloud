import { bildir } from '../../ortak/bildirim';
import { uygulamaDurumuSil, uygulamaDurumuYaz } from '../../veri/uygulamalar';

/* Çerçeveli uygulamalar sandbox içinde (allow-same-origin YOK) çalışır; depolama ve servis istekleri bu köprüden geçer.
   Uygulama tarafı: public/apps/_ortak/kopru.js */

export const SANDBOX = 'allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads';
const AZAMI_DEGER = 8 * 1024 * 1024;
const AZAMI_ANAHTAR = 300;
const BEKLEME_MS = 400;

/* Bahis, sitelerini Hesap Yöneticisi kaydıyla eşleştirir: o kayıt okunur, yalnız geçerli biçimde yazılır. */
export const ORTAK: Record<string, { uygulama: string; anahtar: string }> = {
  bahis: { uygulama: 'hesapyon', anahtar: 'hesap-yoneticisi-v1' },
};
const ortakGecerli = (v: string) => {
  try {
    const o = JSON.parse(v);
    return !!o && typeof o === 'object' && Array.isArray(o.siteler) && o.siteler.every((x: unknown) => !!x && typeof x === 'object' && 'id' in (x as object));
  } catch { return false; }
};

type Bekleyen = { uygulama: string; anahtar: string; deger: string | null };
const bekleyen = new Map<string, Bekleyen>();
const sayac = new Map<string, Set<string>>();
let zaman: number | undefined;
let kuyruk: Promise<void> = Promise.resolve();

function planla() {
  clearTimeout(zaman);
  zaman = window.setTimeout(bosalt, BEKLEME_MS);
}

export function bosalt(): Promise<void> {
  clearTimeout(zaman);
  const isler = [...bekleyen.values()];
  bekleyen.clear();
  kuyruk = kuyruk.then(async () => {
    for (const i of isler) {
      try {
        if (i.deger === null) await uygulamaDurumuSil(i.uygulama, i.anahtar === '' ? null : i.anahtar);
        else await uygulamaDurumuYaz(i.uygulama, i.anahtar, i.deger);
      } catch {
        bildir('Uygulama verisi kaydedilemedi, bağlantını kontrol et', undefined, true);
      }
    }
  });
  return kuyruk;
}

function yaz(uygulama: string, anahtar: string, deger: string | null) {
  bekleyen.set(uygulama + '\u0000' + anahtar, { uygulama, anahtar, deger });
  planla();
}

export function cerceveBul(kaynak: MessageEventSource | null): HTMLIFrameElement | null {
  if (!kaynak) return null;
  for (const f of document.querySelectorAll<HTMLIFrameElement>('iframe.app-cerceve[data-sandbox]')) {
    try { if (f.contentWindow === kaynak) return f; } catch { /* kaldırılmış */ }
  }
  return null;
}

function depo(kod: string, m: Record<string, unknown>) {
  const ortak = ORTAK[kod];
  if (m.op === 'clear') {
    yaz(kod, '', null);
    for (const x of bekleyen.values()) if (x.uygulama === kod && x.anahtar !== '') bekleyen.delete(x.uygulama + '\u0000' + x.anahtar);
    sayac.delete(kod);
    return;
  }
  const anahtar = typeof m.k === 'string' ? m.k : '';
  if (!anahtar || anahtar.length > 200) return;
  const hedef = ortak && anahtar === ortak.anahtar ? ortak.uygulama : kod;
  if (hedef !== kod) {
    if (m.op !== 'set' || typeof m.v !== 'string' || !ortakGecerli(m.v)) return;
  }
  if (m.op === 'del') { yaz(hedef, anahtar, null); sayac.get(hedef)?.delete(anahtar); return; }
  if (m.op !== 'set' || typeof m.v !== 'string' || m.v.length > AZAMI_DEGER) return;
  const s = sayac.get(hedef) ?? new Set<string>();
  if (!s.has(anahtar) && s.size >= AZAMI_ANAHTAR) return;
  s.add(anahtar); sayac.set(hedef, s);
  yaz(hedef, anahtar, m.v);
}

/* Servis uçları (market fiyatı, Gemini) henüz yeni sunucuda yok. */
function apiVekil(f: HTMLIFrameElement, m: Record<string, unknown>) {
  const yanit = (d: object) => { try { f.contentWindow?.postMessage({ astra: 'api-yanit', id: m.id, ...d }, '*'); } catch { /* çerçeve gitti */ } };
  yanit({ durum: 503, metin: JSON.stringify({ hata: 'Bu servis henüz bağlı değil' }), basliklar: { 'content-type': 'application/json' } });
}

function dilimYay() {
  document.querySelectorAll<HTMLIFrameElement>('iframe.app-cerceve[data-sandbox]').forEach(f => {
    const r = f.getBoundingClientRect();
    const ust = Math.max(0, -r.top);
    const yuk = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
    try { f.contentWindow?.postMessage({ astra: 'gorunur', ust, yuk: Math.max(yuk, 200), boy: f.clientHeight }, '*'); } catch { /* yoksay */ }
  });
}
let dilimBekliyor = false;
const dilimIste = () => {
  if (dilimBekliyor) return;
  dilimBekliyor = true;
  requestAnimationFrame(() => { dilimBekliyor = false; dilimYay(); });
};

let bagli = false;
export function kopruBagla() {
  if (bagli) return;
  bagli = true;
  addEventListener('message', e => {
    const m = e.data as Record<string, unknown> | null;
    if (!m || typeof m !== 'object' || typeof m.astra !== 'string') return;
    const f = cerceveBul(e.source);
    if (!f) return;
    const kod = f.dataset.app ?? '';
    if (m.astra === 'depo') depo(kod, m);
    else if (m.astra === 'api') apiVekil(f, m);
    else if (m.astra === 'boy') {
      const asgari = Number(f.dataset.asgari) || 320;
      const h = Math.max(asgari, Math.min(60000, Math.round(Number(m.h) || 0)));
      if (f.style.height !== h + 'px') f.style.height = h + 'px';
      f.dataset.hazir = '1';
      dilimIste();
    } else if (m.astra === 'hazir') { f.dataset.hazir = '1'; dilimIste(); }
  });
  addEventListener('scroll', dilimIste, { passive: true });
  addEventListener('resize', dilimIste);
  addEventListener('pagehide', () => void bosalt());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void bosalt(); });
}
