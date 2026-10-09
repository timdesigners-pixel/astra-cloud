import { ayarOku, ayarYaz } from './karsilama';
import { CakismaHatasi } from './hata';
import { baglananHesaplar, gmailIstek } from './gmail';
import type { Kural, Mektup } from './gmail-etiketleyici';

/* Gmail iletileri: listeleme (süzgeçli), etiketler ve etiket uygulama. İletiler silinmez, taşınmaz ya da gönderilmez; yalnız etiket eklenir/kaldırılır. */
export type Posta = Mektup & {
  id: string; hesap: string; tarih: string; etiketIds: string[]; ekli: boolean; okunmamis: boolean;
};
export type GmailEtiket = { id: string; name: string; type?: string };
export type Suzgec = { metin: string; gonderen: string; konu: string; gun: number; okunmamis: boolean; ekli: boolean; etiket: string };
export const BOS_SUZGEC: Suzgec = { metin: '', gonderen: '', konu: '', gun: 0, okunmamis: false, ekli: false, etiket: '' };

const tirnak = (s: string) => (/\s/.test(s) ? `"${s.replace(/"/g, '')}"` : s);
/* Gmail arama sorgusu: alanlar boş olanlar atlanır. etiketAdi, Gmail etiket adıdır ("label:" için boşluklar tireye çevrilir). */
export function sorguKur(s: Suzgec, etiketAdi = ''): string {
  const p: string[] = [];
  if (s.metin.trim()) p.push(s.metin.trim());
  if (s.gonderen.trim()) p.push(`from:${tirnak(s.gonderen.trim())}`);
  if (s.konu.trim()) p.push(`subject:${tirnak(s.konu.trim())}`);
  if (s.gun > 0) p.push(`newer_than:${Math.round(s.gun)}d`);
  if (s.okunmamis) p.push('is:unread');
  if (s.ekli) p.push('has:attachment');
  if (etiketAdi) p.push(`label:${etiketAdi.replace(/\s+/g, '-')}`);
  return p.join(' ');
}

type Baslik = { name: string; value: string };
const adres = (g: string) => (g.match(/<([^>]+)>/)?.[1] ?? g).trim().toLowerCase();
const gorunenAd = (g: string) => (g.match(/^"?([^"<]+?)"?\s*</)?.[1] ?? g.replace(/[<>].*$/, '')).trim() || g;

type Ham = { id: string; threadId?: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: { headers?: Baslik[]; mimeType?: string; parts?: { filename?: string; parts?: unknown[] }[] } };
function postayaCevir(h: Ham, hesap: string): Posta {
  const b = (n: string) => h.payload?.headers?.find(x => x.name.toLowerCase() === n)?.value ?? '';
  const g = b('from');
  const toplu = !!(b('list-unsubscribe') || b('list-id') || /bulk|list/i.test(b('precedence')));
  const ekVar = (parcalar: unknown[] | undefined): boolean => (parcalar ?? []).some(x => { const p = x as { filename?: string; parts?: unknown[] }; return !!p.filename || ekVar(p.parts); });
  return {
    id: h.id, hesap, gonderen: gorunenAd(g), gonderenAdres: adres(g), konu: b('subject') || '(Konusuz)', snippet: h.snippet ?? '', toplu,
    tarih: new Date(Number(h.internalDate ?? Date.now())).toISOString(), etiketIds: h.labelIds ?? [], ekli: ekVar(h.payload?.parts), okunmamis: (h.labelIds ?? []).includes('UNREAD'),
  };
}

/* Bir hesaptan iletileri bulur: önce kimlik listesi, sonra başlık bilgisi (ve istenirse gövde ilk parçası) paralel alınır. */
export async function postaListele(hesap: string, sorgu: string, enCok = 30, etiketIds: string[] = [], sayfa = ''): Promise<{ postalar: Posta[]; sonraki: string }> {
  const q = new URLSearchParams({ maxResults: String(enCok) });
  if (sorgu) q.set('q', sorgu);
  etiketIds.forEach(e => q.append('labelIds', e));
  if (sayfa) q.set('pageToken', sayfa);
  const liste = await gmailIstek<{ messages?: { id: string }[]; nextPageToken?: string }>(hesap, `/messages?${q}`);
  const postalar = (await Promise.all((liste.messages ?? []).map(async m => {
    try {
      const meta = new URLSearchParams({ format: 'metadata' });
      ['From', 'Subject', 'List-Unsubscribe', 'List-Id', 'Precedence'].forEach(x => meta.append('metadataHeaders', x));
      return postayaCevir(await gmailIstek<Ham>(hesap, `/messages/${m.id}?${meta}`), hesap);
    } catch { return null; }
  }))).filter((x): x is Posta => !!x);
  return { postalar, sonraki: liste.nextPageToken ?? '' };
}

/* Tüm bağlı hesaplarda ara; sonuçlar tarihe göre birleştirilir. Bir hesap hata verirse diğerleri sürer, hata ayrıca döner. */
export async function tumHesaplardaListele(hesaplar: string[], sorgu: string, hesapBasina = 30): Promise<{ postalar: Posta[]; hatalar: string[] }> {
  const hatalar: string[] = [], postalar: Posta[] = [];
  await Promise.all(hesaplar.filter(h => baglananHesaplar().includes(h)).map(async h => {
    try { postalar.push(...(await postaListele(h, sorgu, hesapBasina)).postalar); } catch (e) { hatalar.push(`${h}: ${e instanceof Error ? e.message : String(e)}`); }
  }));
  return { postalar: postalar.sort((a, b) => b.tarih.localeCompare(a.tarih)), hatalar };
}

/* Gövdenin ilk parçası (etiketleyici için): metin/plain varsa o, yoksa kısaltılmış html metni. */
export async function govdeOnizleme(hesap: string, id: string): Promise<string> {
  type P = { mimeType?: string; body?: { data?: string }; parts?: P[] };
  const d = await gmailIstek<{ payload?: P }>(hesap, `/messages/${id}?format=full`);
  const coz = (x: string) => { try { return new TextDecoder().decode(Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch { return ''; } };
  const bul = (p: P | undefined): string => {
    if (!p) return '';
    if (p.body?.data) return p.mimeType === 'text/html' ? coz(p.body.data).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/gi, ' ').replace(/\s+/g, ' ') : coz(p.body.data);
    for (const x of [p.parts?.find(y => y.mimeType === 'text/plain'), p.parts?.find(y => y.mimeType === 'text/html'), ...(p.parts ?? [])]) { const m = bul(x); if (m) return m; }
    return '';
  };
  return bul(d.payload).slice(0, 2500);
}

/* ——— etiketler ——— */
export const etiketleriGetir = async (hesap: string) => (await gmailIstek<{ labels?: GmailEtiket[] }>(hesap, '/labels')).labels ?? [];
export const etiketOlustur = (hesap: string, ad: string) => gmailIstek<GmailEtiket>(hesap, '/labels', { method: 'POST', govde: { name: ad, labelListVisibility: 'labelShow', messageListVisibility: 'show' } });
/* Etiketi bulur, yoksa oluşturur; aynı çağrıda tekrar aramamak için önbellek (hesap → ad → kimlik) kullanılır. */
export async function etiketKimligi(hesap: string, ad: string, onbellek: Map<string, GmailEtiket[]>): Promise<string> {
  let liste = onbellek.get(hesap);
  if (!liste) { liste = await etiketleriGetir(hesap); onbellek.set(hesap, liste); }
  const var_ = liste.find(x => x.name.toLowerCase() === ad.toLowerCase());
  if (var_) return var_.id;
  const yeni = await etiketOlustur(hesap, ad);
  liste.push(yeni);
  return yeni.id;
}
/* Etiket ekler/kaldırır (en çok 1000 ileti/çağrı). İletiler yalnız etiketlenir; silinmez. */
export async function etiketUygula(hesap: string, mesajIds: string[], ekle: string[], cikar: string[] = []): Promise<void> {
  for (let i = 0; i < mesajIds.length; i += 500) {
    await gmailIstek(hesap, '/messages/batchModify', { method: 'POST', govde: { ids: mesajIds.slice(i, i + 500), addLabelIds: ekle, removeLabelIds: cikar } });
  }
}

/* ——— ayarlar ——— */
async function yaz<T extends object>(anahtar: string, deger: T): Promise<void> {
  try { await ayarYaz(anahtar, deger); } catch (e) { if (e instanceof CakismaHatasi) await ayarYaz(anahtar, deger); else throw e; }
}
export const kurallariGetir = async () => ((await ayarOku<{ liste?: Kural[] }>('gmail_kurallar'))?.deger?.liste ?? []).filter(k => k && typeof k.etiket === 'string');
export const kurallariYaz = (liste: Kural[]) => yaz('gmail_kurallar', { liste });
export type EtiketleyiciAyar = { gun: number; gmailaYaz: boolean; otomatik: boolean; enCok: number };
export const VARSAYILAN_AYAR: EtiketleyiciAyar = { gun: 14, gmailaYaz: true, otomatik: false, enCok: 60 };
export const etiketleyiciAyarGetir = async (): Promise<EtiketleyiciAyar> => ({ ...VARSAYILAN_AYAR, ...((await ayarOku<Partial<EtiketleyiciAyar>>('gmail_etiketleyici'))?.deger ?? {}) });
export const etiketleyiciAyarYaz = (a: EtiketleyiciAyar) => yaz('gmail_etiketleyici', a);
export const etiketlenenleriGetir = async () => (await ayarOku<{ idler?: string[] }>('gmail_etiketlenen'))?.deger?.idler ?? [];
export const etiketlenenleriYaz = (idler: string[]) => yaz('gmail_etiketlenen', { idler: idler.slice(-3000) });
