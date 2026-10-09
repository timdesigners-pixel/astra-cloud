import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';

/* Gmail'den fatura bulma: yalnız okuma izni. Google ile bağlanma, kullanıcının kendi OAuth istemci kimliğiyle yapılır;
   erişim jetonu yalnız bellekte tutulur (saklanmaz). */
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const KAPSAM = 'https://www.googleapis.com/auth/gmail.readonly';
const GSI = 'https://accounts.google.com/gsi/client';

type TokenIstemci = { requestAccessToken: (o?: { prompt?: string }) => void };
type GoogleKutuphane = { accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: { access_token?: string; error?: string; expires_in?: number }) => void; error_callback?: (e: { type?: string }) => void }) => TokenIstemci } } };
declare global { interface Window { google?: GoogleKutuphane } }

let jeton: { deger: string; bitis: number } | null = null;
export const baglimi = () => !!jeton && jeton.bitis > Date.now() + 30000;
export function baglantiKes() { jeton = null; }

function gsiYukle(): Promise<GoogleKutuphane> {
  if (window.google?.accounts) return Promise.resolve(window.google);
  return new Promise((coz, red) => {
    const s = document.createElement('script'); s.src = GSI; s.async = true;
    s.onload = () => (window.google ? coz(window.google) : red(new Error('Google kitaplığı yüklenemedi')));
    s.onerror = () => red(new Error('Google kitaplığı yüklenemedi'));
    document.head.appendChild(s);
  });
}

export async function gmailBaglan(istemciKimligi: string): Promise<void> {
  const g = await gsiYukle();
  await new Promise<void>((coz, red) => {
    g.accounts.oauth2.initTokenClient({
      client_id: istemciKimligi, scope: KAPSAM,
      callback: r => {
        if (r.access_token) { jeton = { deger: r.access_token, bitis: Date.now() + (r.expires_in ?? 3600) * 1000 }; coz(); }
        else red(new Error(r.error === 'access_denied' ? 'İzin verilmedi' : `Google bağlantısı kurulamadı${r.error ? ` (${r.error})` : ''}`));
      },
      error_callback: e => red(new Error(e.type === 'popup_closed' ? 'Pencere kapatıldı' : 'Google penceresi açılamadı')),
    }).requestAccessToken({ prompt: '' });
  });
}

async function istek<T>(yol: string): Promise<T> {
  if (!baglimi()) throw new Error('Gmail bağlı değil');
  const r = await fetch(`${API}${yol}`, { headers: { Authorization: `Bearer ${jeton!.deger}` } });
  if (r.status === 401) { jeton = null; throw new Error('Gmail oturumu doldu, yeniden bağlan'); }
  if (!r.ok) { const e = await r.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(e.error?.message ?? `Gmail isteği başarısız (${r.status})`); }
  return r.json() as Promise<T>;
}

type Parca = { mimeType?: string; body?: { data?: string }; parts?: Parca[]; headers?: { name: string; value: string }[] };
const b64 = (d: string) => { try { const b = atob(d.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); } catch { return ''; } };
const duzMetin = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function govde(p: Parca | undefined): string {
  if (!p) return '';
  if (p.body?.data) return p.mimeType === 'text/html' ? duzMetin(b64(p.body.data)) : b64(p.body.data);
  if (p.parts) {
    const duz = p.parts.find(x => x.mimeType === 'text/plain'), html = p.parts.find(x => x.mimeType === 'text/html');
    for (const x of [duz, html, ...p.parts]) { const m = govde(x); if (m) return m; }
  }
  return '';
}

/* ——— Çözümleme (saf) ——— */
export type FaturaAdayi = {
  id: string; konu: string; gonderen: string; tarih: string; tutar: number | null; paraBirimi: string; faturaNo: string; vade: string | null; kategori: string;
};
const sayiYap = (ham: string) => {
  let t = ham.replace(/\s+/g, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.'); else if (t.includes(',')) t = t.replace(',', '.');
  return parseFloat(t);
};
export function faturaCoz(metin: string, konu = '', gonderen = ''): Pick<FaturaAdayi, 'tutar' | 'paraBirimi' | 'faturaNo' | 'vade' | 'kategori'> {
  const b = `${konu} ${gonderen} ${metin}`;
  const para = /(?:₺|TL|USD|\$|EUR|€)\s*([\d.,]{2,12})|([\d.,]{2,12})\s*(?:₺|TL|USD|\$|EUR|€)/gi;
  let tutar: number | null = null, paraBirimi = 'TRY', m: RegExpExecArray | null;
  const odenecek = /(?:[öo]denecek|toplam|[öo]deme)\s*tutar[ıi]?\s*[:\-]?\s*(?:₺|TL)?\s*([\d.,]{2,12})/i.exec(b);
  if (odenecek) { const v = sayiYap(odenecek[1]!); if (v > 0 && v < 5e7) tutar = v; }
  while (tutar === null && (m = para.exec(b)) !== null) {
    const v = sayiYap(m[1] ?? m[2] ?? '');
    if (!Number.isNaN(v) && v > 0 && v < 5e7) { tutar = v; if (/USD|\$/i.test(m[0])) paraBirimi = 'USD'; else if (/EUR|€/i.test(m[0])) paraBirimi = 'EUR'; }
  }
  const fn = /(?:fatura|belge|makbuz)\s*(?:no|numarası)?\s*[:#]?\s*([A-Z0-9-]{6,24})/i.exec(b);
  const v = /son\s*[öo]deme(?:\s*tarihi)?\s*[:\-]?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i.exec(b);
  const vade = v ? `${v[3]}-${v[2]!.padStart(2, '0')}-${v[1]!.padStart(2, '0')}` : null;
  const kategori = /ekstre|kredi kart[ıi]|asgari/i.test(b) ? 'Kredi kartı' : /icra|uyap|haciz|tebligat/i.test(b) ? 'İcra / hukuk'
    : /dekont|havale|eft\b|fast\b/i.test(b) ? 'Dekont' : /fatura|abone/i.test(b) ? 'Fatura' : 'Diğer';
  return { tutar, paraBirimi, faturaNo: fn?.[1] ?? '', vade, kategori };
}
export const gonderenAdi = (g: string) => (g.match(/^"?([^"<]+?)"?\s*</)?.[1] ?? g.replace(/[<>].*$/, '')).trim() || g;

export const FATURA_SORGUSU = '(fatura OR e-fatura OR "son ödeme" OR ekstre OR "ödenecek tutar") -in:sent -in:trash';

export async function faturaAdaylariniBul(gun: number, enCok = 40): Promise<FaturaAdayi[]> {
  const liste = await istek<{ messages?: { id: string }[] }>(`/messages?${new URLSearchParams({ q: `newer_than:${gun}d ${FATURA_SORGUSU}`, maxResults: String(enCok) })}`);
  const sonuc = await Promise.all((liste.messages ?? []).map(async x => {
    try {
      const d = await istek<{ id: string; internalDate?: string; payload?: Parca }>(`/messages/${x.id}?format=full`);
      const baslik = (n: string) => d.payload?.headers?.find(h => h.name.toLowerCase() === n)?.value ?? '';
      const konu = baslik('subject') || '(Konusuz)', gonderen = baslik('from');
      const c = faturaCoz(govde(d.payload), konu, gonderen);
      return { id: d.id, konu, gonderen: gonderenAdi(gonderen), tarih: new Date(Number(d.internalDate ?? Date.now())).toISOString().slice(0, 10), ...c } as FaturaAdayi;
    } catch { return null; }
  }));
  return sonuc.filter((x): x is FaturaAdayi => !!x);
}

/* ——— ayarlar: istemci kimliği ve işlenmiş iletiler ——— */
async function yaz<T extends object>(anahtar: string, deger: T): Promise<void> {
  try { await ayarYaz(anahtar, deger); } catch (e) { if (e instanceof CakismaHatasi) await ayarYaz(anahtar, deger); else throw e; }
}
export const istemciKimligiGetir = async () => (await ayarOku<{ id?: string }>('gmail_istemci'))?.deger?.id ?? '';
export const istemciKimligiYaz = (id: string) => yaz('gmail_istemci', { id: id.trim() });
export const islenenleriGetir = async () => (await ayarOku<{ idler?: string[] }>('gmail_islenen'))?.deger?.idler ?? [];
export const islenenleriYaz = (idler: string[]) => yaz('gmail_islenen', { idler: idler.slice(-500) });
