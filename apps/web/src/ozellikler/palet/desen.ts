/* Komut paleti · hızlı ekleme desenleri.
   "1 bardak su içtim", "Ahmet'e 500 tl borç ekle", "yarın 10:00 vergi dairesini hatırlat" gibi cümleleri
   parametreli komuta çevirir. Saf mantık: veriye dokunmaz, yalnız cümleyi çözer; kaydı palet/islem.ts yazar.
   Örnek cümle aynı zamanda paletteki ipucu metnidir. */
import { kat, type Komut } from './eslestir';

export type Param = Record<string, any>;

const SAYI_SOZ: Record<string, number> = { bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, yarim: 0.5 };

/* "1.250,50" · "1250" · "1,5" · "1.5" · "bir" → sayı */
export function sayiCoz(s: unknown): number {
  if (s == null) return NaN;
  const m = String(s).trim();
  const soz = SAYI_SOZ[kat(m)];
  if (soz !== undefined) return soz;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(m)) return parseFloat(m.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+$/.test(m) && !/,\d{1,2}$/.test(m)) return parseFloat(m.replace(/,/g, ''));
  return parseFloat(m.replace(',', '.'));
}

/* Tutar: 450 · 450 tl · ₺450 · 1.250,50 lira · 2 bin */
const TUTAR_RE = new RegExp(String.raw`(?:₺\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(bin\b)?\s*(?:tl\b|₺|lira\b|try\b)?`);
export function tutarBul(t: string): { v: number; i: number; son: number } | null {
  const m = TUTAR_RE.exec(t);
  if (!m) return null;
  let v = sayiCoz(m[1]);
  if (m[2]) v *= 1000;
  return Number.isFinite(v) ? { v, i: m.index, son: m.index + m[0].length } : null;
}

/* Katlanmış metindeki konumu özgün metne taşır (uzunluk korunuyorsa). */
const ozgun = (q: string, t: string, a: number, b: number) => (q.length === t.length ? q.slice(a, b) : t.slice(a, b)).trim();
const temizle = (s: unknown) => String(s || '').replace(/\s+/g, ' ').replace(/^[\s:,-]+|[\s:,.-]+$/g, '').trim();
const buyukBas = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : s);

/* "Ahmet'e" · "Ayşeye" · "Mehmet Bey kişisine" → aday adlar */
export function kisiAdaylari(ham: string): string[] {
  const s = temizle(ham).replace(/\s+(kisisine|kişisine|kisiye|kişiye|adina|adına)$/i, '');
  if (!s) return [];
  if (/['’]/.test(s)) return [temizle(s.split(/['’]/)[0])];
  /* Sesliyle biten ad yönelmeyi "-ya/-ye" ile alır (Baba → Babaya). Tek "-a/-e" belirsizdir, önce yazıldığı hali denenir. */
  const kesin = /^(.*?[aeıioöuü])(ya|ye|nın|nin|nun|nün)$/i.exec(s) || /^(.*?)(ya|ye|nın|nin|nun|nün)$/i.exec(s);
  if (kesin && kesin[1]!.length >= 3) return [...new Set([kesin[1]!, s])];
  const m = /^(.*?[^aeıioöuü\s])(e|a)$/i.exec(s);
  const kirpik = m && m[1]!.length >= 3 ? m[1]! : '';
  return [...new Set([s, kirpik].filter(Boolean))];
}

const AYLAR = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
export const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];

const GUNCELLE_RE = /\btoplam\b|\bolsun\b|\byap\b|\bodenecek\b|\bguncelle\w*/;
const KISI_DOLGU = /^(borc\w*|kayd\w*|kayit\w*|gir|giris|olustur\w*|ekle\w*|kaydet\w*|yaz|toplam|olsun|yap|odenecek|guncelle\w*|tl|lira|try|₺|bin|olarak|icin|kisisine|kisiye|adina|ayina|ayi|ay|aya|ayin|ayinda)$/;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* Cümledeki dönem ifadesini bulur; ifadeyi aynı uzunlukta boşlukla maskeler (konumlar korunur). */
export function donemCoz(t: string, simdi = new Date()): { donem: string; var: boolean; maske: string } {
  const ay = (k: number) => { const d = new Date(simdi.getFullYear(), simdi.getMonth() + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const bosalt = (s: string, m: RegExpExecArray) => s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length);
  let m: RegExpExecArray | null;
  if ((m = /\b(gelecek|onumuzdeki|sonraki|ertesi)\s+ay(a|in|inda|da|i)?\b/.exec(t))) return { donem: ay(1), var: true, maske: bosalt(t, m) };
  if ((m = /\b(gecen|onceki)\s+ay(a|in|inda|da|i)?\b/.exec(t))) return { donem: ay(-1), var: true, maske: bosalt(t, m) };
  if ((m = /\bbu\s+ay(a|in|inda|da|i)?\b/.exec(t))) return { donem: ay(0), var: true, maske: bosalt(t, m) };
  if ((m = new RegExp(`\\b(${AYLAR.join('|')})(\\s+(20\\d\\d))?(\\s+ay\\w*|\\w*)?\\b`).exec(t))) {
    let y = m[3] ? +m[3] : simdi.getFullYear();
    const a = AYLAR.indexOf(m[1]!);
    if (!m[3] && (y * 12 + a) < (simdi.getFullYear() * 12 + simdi.getMonth())) y++;
    return { donem: `${y}-${String(a + 1).padStart(2, '0')}`, var: true, maske: bosalt(t, m) };
  }
  return { donem: ay(0), var: false, maske: t };
}

/* Cümledeki tarih/saat ifadesini çözer; bulunanı metinden çıkarır. */
export function tarihCoz(t: string, simdi = new Date()): { gun: string | null; saat: string | null; kalan: string } {
  let gun: string | null = null, saat: string | null = null, kalan = t;
  const b = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  const sil = (re: string) => { kalan = kalan.replace(re, ' '); };
  let m: RegExpExecArray | null;
  if ((m = /\b(?:saat\s*)?(\d{1,2}):(\d{2})\b/.exec(kalan)) || (m = /\bsaat\s*(\d{1,2})(?:[.:](\d{2}))?\b/.exec(kalan))) {
    const sa = +m[1]!, dk = +(m[2] || 0);
    if (sa < 24 && dk < 60) { saat = `${String(sa).padStart(2, '0')}:${String(dk).padStart(2, '0')}`; sil(m[0]); }
  }
  if ((m = /\b(bugun|yarin|obur gun|ertesi gun|haftaya)\b/.exec(kalan))) {
    const ek = ({ bugun: 0, yarin: 1, 'obur gun': 2, 'ertesi gun': 2, haftaya: 7 } as Record<string, number>)[m[1]!]!;
    const d = new Date(b); d.setDate(d.getDate() + ek); gun = iso(d); sil(m[0]);
  } else if ((m = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b/.exec(kalan)) && +m[2]! >= 1 && +m[2]! <= 12) {
    const y = m[3] ? +m[3] : b.getFullYear();
    const d = new Date(y, +m[2]! - 1, +m[1]!);
    if (!m[3] && d < b) d.setFullYear(y + 1);
    gun = iso(d); sil(m[0]);
  } else if ((m = new RegExp(`\\b(\\d{1,2})\\s+(${AYLAR.join('|')})\\w*(?:\\s+(\\d{4}))?`).exec(kalan))) {
    const y = m[3] ? +m[3] : b.getFullYear();
    const d = new Date(y, AYLAR.indexOf(m[2]!), +m[1]!);
    if (!m[3] && d < b) d.setFullYear(y + 1);
    gun = iso(d); sil(m[0]);
  } else if ((m = new RegExp(`\\b(${GUNLER.join('|')})\\b`).exec(kalan))) {
    const hedef = GUNLER.indexOf(m[1]!);
    const d = new Date(b); let ek = (hedef - d.getDay() + 7) % 7; if (ek === 0) ek = 7;
    d.setDate(d.getDate() + ek); gun = iso(d); sil(m[0]);
  }
  return { gun, saat, kalan: kalan.replace(/\s+/g, ' ').trim() };
}

const gunEtiketi = (g: string) => { if (!g) return ''; const [y, a, d] = g.split('-').map(Number); return `${d} ${AY_ADLARI[a! - 1]} ${y}`; };
const tl = (v: number) => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

/* Aritmetik ifadeyi güvenle hesaplar: yalnız rakam, + - * / % ( ) . , ve boşluk. */
export function hesapla(ifade: string): number | null {
  const s = String(ifade).replace(/×|x/gi, '*').replace(/÷/g, '/').replace(/(\d),(\d)/g, '$1.$2');
  if (!/^[\d\s+\-*/%().]+$/.test(s) || !/\d/.test(s)) return null;
  let i = 0;
  const bos = () => { while (s[i] === ' ') i++; };
  const sayi = (): number => {
    bos();
    if (s[i] === '(') { i++; const v = toplam(); bos(); if (s[i] !== ')') throw new Error('parantez'); i++; return v; }
    if (s[i] === '-') { i++; return -sayi(); }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i)); if (!m) throw new Error('sayı');
    i += m[0].length; return parseFloat(m[0]);
  };
  const carpim = (): number => {
    let v = sayi();
    for (;;) {
      bos(); const o = s[i];
      if (o === '*' || o === '/' || o === '%') { i++; const r = sayi(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } else return v;
    }
  };
  const toplam = (): number => {
    let v = carpim();
    for (;;) {
      bos(); const o = s[i];
      if (o === '+' || o === '-') { i++; const r = carpim(); v = o === '+' ? v + r : v - r; } else return v;
    }
  };
  try { const v = toplam(); bos(); return i === s.length && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null; } catch { return null; }
}

/* Özgün metinden, katlanmış `kalan` metnin sözcüklerini (sırasıyla) seçer. */
function kalanOzgun(q: string, kalan: string): string {
  const kq = kat(q);
  const out: string[] = []; let i = 0;
  for (const s of kalan.split(' ').filter(Boolean)) {
    const j = kq.indexOf(s, i);
    if (j < 0) { out.push(s); continue; }
    out.push(q.slice(j, j + s.length)); i = j + s.length;
  }
  return out.join(' ');
}

const ML: Record<string, number> = { bardak: 200, sise: 500, litre: 1000, lt: 1000, l: 1000, ml: 1, cl: 10 };

export type Desen = {
  id: string; grup: string; sim: string; ornek: string;
  coz: (t: string, q: string, simdi: Date) => Param | null;
  ad: (p: Param) => string; ac: (p: Param) => string;
};

export const DESENLER: Desen[] = [
  /* ===== SAĞLIK ===== */
  { id: 'su', grup: 'Sağlık', sim: '💧', ornek: '1 bardak su içtim',
    coz(t) {
      if (!/\bsu\b/.test(t) || /hedef|fatura|borc|abonelik/.test(t)) return null;
      const m = /(\d+(?:[.,]\d+)?|bir|iki|uc|dort|bes|yarim)\s*(bardak|sise|litre|lt|l|ml|cl)\b/.exec(t);
      if (m) return { ml: Math.round(sayiCoz(m[1]) * ML[m[2]!]!) };
      if (/\bsu\b.*\b(ictim|icildi|ic)\b/.test(t)) return { ml: 200 };
      return null;
    },
    ad: p => `Su ekle: +${p.ml} ml`, ac: () => 'Bugünkü su sayacına eklenir (Günlük Karşılama › Sağlık).' },
  { id: 'adim', grup: 'Sağlık', sim: '👣', ornek: '8500 adım attım',
    coz(t) { const m = /(\d[\d.]*)\s*adim\b/.exec(t); return m && !/hedef/.test(t) ? { v: Math.round(sayiCoz(m[1])) } : null; },
    ad: p => `Adım ekle: +${p.v.toLocaleString('tr-TR')}`, ac: () => 'Bugünkü adım sayısına eklenir.' },
  { id: 'kalori', grup: 'Sağlık', sim: '🔥', ornek: '350 kalori yaktım',
    coz(t) { const m = /(\d[\d.]*)\s*(kalori|kcal|kal)\b/.exec(t); return m ? { v: Math.round(sayiCoz(m[1])) } : null; },
    ad: p => `Yakılan kalori: +${p.v} kcal`, ac: () => 'Bugünkü kalori sayacına eklenir.' },
  { id: 'uyku', grup: 'Sağlık', sim: '☾', ornek: '7,5 saat uyudum',
    coz(t) { const m = /(\d+(?:[.,]\d+)?)\s*saat\s*(uyu|uyku)/.exec(t); return m ? { v: sayiCoz(m[1]) } : null; },
    ad: p => `Uyku: ${String(p.v).replace('.', ',')} saat`, ac: () => 'Bugünkü uyku süresi kaydedilir.' },
  { id: 'tansiyon', grup: 'Sağlık', sim: '♥', ornek: 'tansiyon 12/8',
    coz(t) { const m = /tansiyon\w*\s*(\d{1,3}(?:[.,]\d)?)\s*[/-]\s*(\d{1,3}(?:[.,]\d)?)/.exec(t); return m ? { v: `${m[1]}/${m[2]}` } : null; },
    ad: p => `Tansiyon: ${p.v}`, ac: () => 'Bugünkü tansiyon ölçümü kaydedilir.' },
  { id: 'nabiz', grup: 'Sağlık', sim: '♥', ornek: 'nabız 72',
    coz(t) { const m = /nabiz\w*\s*(\d{2,3})\b/.exec(t); return m ? { v: Number(m[1]) } : null; },
    ad: p => `Nabız: ${p.v}`, ac: () => 'Bugünkü nabız ölçümü kaydedilir.' },

  /* ===== PARA ===== */
  { id: 'kisi-borc', grup: 'Para', sim: '⇄', ornek: 'Gelecek aya Ali Bey 5 bin borç kaydı gir',
    coz(t, q, simdi) {
      const guncelle = GUNCELLE_RE.test(t);
      if (!(/\bborc/.test(t) || (guncelle && /\bodenecek\b/.test(t)))) return null;
      if (/\bode(dim|me|meyi|mesi)?\b|odeme yaptim|kapat|\bsil\b/.test(t)) return null;
      const zd = donemCoz(t, simdi);
      const maske = zd.maske;
      const tt = tutarBul(maske); if (!tt || tt.v <= 0) return null;
      const kq = q.length === t.length ? q : t;
      const sozler: string[] = [];
      const re = /\S+/g; let m: RegExpExecArray | null;
      while ((m = re.exec(maske))) {
        if (m.index >= tt.i && m.index < tt.son) continue;
        const w = m[0].replace(/[.,:;!?]+$/, '');
        if (!w || /^[\d.,]+$/.test(w) || KISI_DOLGU.test(w)) continue;
        sozler.push(kq.slice(m.index, m.index + w.length));
      }
      const ad = kisiAdaylari(sozler.join(' '));
      if (!ad.length || /^(borc|gider|kisi)$/.test(kat(ad[0]))) return null;
      return { ad, tutar: tt.v, donem: zd.donem, zamanVar: zd.var, mod: guncelle ? 'ayarla' : 'ekle' };
    },
    ad: p => `${p.ad[0]} — ${p.mod === 'ayarla' ? 'borç toplamı ' + tl(p.tutar) : 'borç +' + tl(p.tutar)}`,
    ac: p => (p.mod === 'ayarla'
      ? 'Kişinin açık borcu bu tutara ayarlanır (yoksa yeni borç açılır).'
      : 'Kişinin açık borcunun üzerine eklenir; açık borcu yoksa yeni borç açılır. Kişi kayıtlı değilse Kişiler\'e eklenir.') },
  { id: 'gider', grup: 'Para', sim: '↓', ornek: 'market 450 tl gider',
    coz(t, q) {
      if (!/\b(gider|harcadim|harcama|masraf|odedim)\b/.test(t) || /\bborc|sabit|her ay|abonelik|\w+'?(e|a|ye|ya)\s+\d/.test(t)) return null;
      const tt = tutarBul(t); if (!tt || tt.v <= 0) return null;
      const ad = temizle(ozgun(q, t, 0, tt.i) + ' ' + ozgun(q, t, tt.son, t.length))
        .replace(/\b(gider\w*|ekle|harcadım|harcadim|harcama|masraf|ödedim|odedim|için|icin)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      return { ad: buyukBas(ad) || 'Harcama', tutar: tt.v };
    },
    ad: p => `Gider ekle: ${p.ad} · ${tl(p.tutar)}`, ac: () => 'Tek seferlik gider olarak eklenir (Giderler › Gider Özeti\'nde görünür).' },
  { id: 'sabit-gider', grup: 'Para', sim: '⟳', ornek: 'kira 15.000 tl sabit gider',
    coz(t, q) {
      if (!/(sabit|her ay|aylik)\s*(gider|odeme)|abonelik/.test(t)) return null;
      const tt = tutarBul(t); if (!tt || tt.v <= 0) return null;
      const ad = temizle(ozgun(q, t, 0, tt.i) + ' ' + ozgun(q, t, tt.son, t.length))
        .replace(/\b(sabit|her ay|aylık|aylik|gider\w*|ödeme|odeme|abonelik|ekle)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      return { ad: buyukBas(ad) || 'Sabit gider', tutar: tt.v, abonelik: /abonelik/.test(t) };
    },
    ad: p => `${p.abonelik ? 'Abonelik' : 'Sabit gider'}: ${p.ad} · ${tl(p.tutar)}/ay`, ac: () => 'Her ay tekrarlanan gider olarak eklenir.' },
  { id: 'gelir', grup: 'Para', sim: '↗', ornek: 'maaş 40.000 tl gelir',
    coz(t, q) {
      if (!/\b(gelir|maas|kazandim|kazanc|tahsil|tahsilat)\b/.test(t)) return null;
      const tt = tutarBul(t); if (!tt || tt.v <= 0) return null;
      const ad = temizle(ozgun(q, t, 0, tt.i) + ' ' + ozgun(q, t, tt.son, t.length))
        .replace(/\b(gelir\w*|ekle|kazandım|kazandim|tahsil\w*)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      return { ad: buyukBas(ad) || 'Gelir', tutar: tt.v, tek: !/maas|her ay|aylik/.test(t) };
    },
    ad: p => `Gelir ekle: ${p.ad} · ${tl(p.tutar)}${p.tek ? '' : '/ay'}`, ac: p => (p.tek ? 'Tek seferlik gelir olarak eklenir.' : 'Her ay tekrarlanan sabit gelir olarak eklenir.') },
  { id: 'alinacak', grup: 'Para', sim: '☰', ornek: 'alınacak kulaklık 1.500 tl',
    coz(t, q) {
      if (!/alinacak|almak istiyorum|alacagim|istek listesi|wishlist/.test(t)) return null;
      const tt = tutarBul(t);
      const kes = tt ? ozgun(q, t, 0, tt.i) + ' ' + ozgun(q, t, tt.son, t.length) : q;
      const ad = temizle(kes.replace(/alınacaklar\w*|alinacaklar\w*|alınacak|alinacak|almak istiyorum|alacağım|alacagim|istek listesi\w*|wishlist|ekle|:/gi, ' ').replace(/\s+/g, ' '));
      return ad ? { ad: buyukBas(ad), tutar: tt ? tt.v : 0 } : null;
    },
    ad: p => `Alınacaklara ekle: ${p.ad}${p.tutar ? ' · ' + tl(p.tutar) : ''}`, ac: () => 'Hayaller ve Hedefler › Alınacaklar listesine eklenir.' },
  { id: 'kiler', grup: 'Para', sim: '⊞', ornek: 'kilere 2 süt ekle',
    coz(t, q) {
      const m = /^kiler\w*\s+(?:(\d+(?:[.,]\d+)?)\s*(adet|kg|lt|paket)?\s+)?(.+?)(\s+ekle)?$/.exec(t);
      if (!m) return null;
      const ad = temizle(ozgun(q, t, t.length - m[3]!.length - (m[4] || '').length, t.length - (m[4] || '').length));
      return ad ? { ad: buyukBas(ad), adet: m[1] ? sayiCoz(m[1]) : 1, birim: m[2] || 'adet' } : null;
    },
    ad: p => `Kilere ekle: ${p.adet} ${p.birim} ${p.ad}`, ac: () => 'Market Stok\'a eklenir; ürün varsa miktarı artar.' },

  /* ===== GÖREV & NOT ===== */
  { id: 'gorev', grup: 'Görev & Not', sim: '✓', ornek: 'görev: avukatı ara yarın',
    coz(t, q, simdi) {
      const m = /^(acil\s+)?(gorev|yapilacak|todo|is)\s*:?\s+(.+)$/.exec(t) || /^(acil\s+)?()(.+?)\s+gorev\w*\s+ekle$/.exec(t);
      if (!m) return null;
      const bas = t.length - m[3]!.length;
      const tc = tarihCoz(t.slice(bas), simdi);
      const metin = tc.gun || tc.saat ? tc.kalan : t.slice(bas);
      const ad = temizle(q.length === t.length ? (tc.gun || tc.saat ? kalanOzgun(q.slice(bas), metin) : q.slice(bas)) : metin);
      return ad ? { ad: buyukBas(ad), acil: !!m[1] || /\bacil\b/.test(t), due: tc.gun || '' } : null;
    },
    ad: p => `${p.acil ? 'Acil görev' : 'Görev'}: ${p.ad}${p.due ? ' · ' + gunEtiketi(p.due) : ''}`, ac: () => 'Notlar › Todo\'s listesine eklenir.' },
  { id: 'hatirlat', grup: 'Görev & Not', sim: '⏰', ornek: 'yarın 10:00 vergi dairesini hatırlat',
    coz(t, q, simdi) {
      if (!/hatirlat/.test(t)) return null;
      const tc = tarihCoz(t, simdi);
      let ad = (q.length === t.length ? kalanOzgun(q, tc.kalan) : tc.kalan)
        .replace(/\b(hatırlatıcı|hatirlatici|hatırlat\w*|hatirlat\w*|bana|kur|ekle)\b/gi, ' ');
      ad = temizle(ad.replace(/\s+/g, ' '));
      return ad ? { ad: buyukBas(ad), gun: tc.gun || iso(new Date(simdi.getTime() + 86400000)), saat: tc.saat || '09:00', gunVar: !!tc.gun } : null;
    },
    ad: p => `Hatırlatıcı: ${p.ad} · ${gunEtiketi(p.gun)} ${p.saat}`, ac: p => (p.gunVar ? 'Ajandaya saatli kayıt olarak eklenir; vakti yaklaşınca Bildirim Merkezi\'nde görünür.' : 'Gün yazılmadığı için yarına eklenir.') },
  { id: 'not', grup: 'Görev & Not', sim: '✎', ornek: 'not: kombi servisi perşembe gelecek',
    coz(t, q) { const m = /^(hizli\s+)?not\s*:?\s+(.+)$/.exec(t); return m ? { ad: temizle(q.slice(q.length - m[2]!.length)) } : null; },
    ad: p => `Hızlı not: ${p.ad}`, ac: () => 'Genel Bakış\'taki hızlı notlara eklenir.' },
  { id: 'hedef', grup: 'Görev & Not', sim: '◎', ornek: 'hedef: tatil 50.000 tl',
    coz(t, q) {
      const m = /^hedef\s*:?\s+(.+)$/.exec(t);
      if (!m) return null;
      const tt = tutarBul(m[1]!);
      const ham = q.slice(q.length - m[1]!.length);
      const ad = temizle(tt ? ham.slice(0, tt.i) + ' ' + ham.slice(tt.son) : ham);
      return ad ? { ad: buyukBas(ad), tutar: tt ? tt.v : 0 } : null;
    },
    ad: p => `Hedef ekle: ${p.ad}${p.tutar ? ' · ' + tl(p.tutar) : ''}`, ac: () => 'Hayaller ve Hedefler › Hedefler sayfasına eklenir.' },

  /* ===== GEZİNME & AYAR ===== */
  { id: 'donem', grup: 'Gezinme', sim: '◷', ornek: 'mart ayına git',
    coz(t, _q, simdi) {
      const ay = AYLAR.findIndex(a => new RegExp(`\\b${a}`).test(t));
      if (ay >= 0 && !/hatirlat|gorev/.test(t) && !/\b\d{1,2}\s+\w/.test(t.replace(/20\d\d/, ''))) {
        const y = +((t.match(/\b(20\d\d)\b/) || [])[1] || simdi.getFullYear());
        return { donem: `${y}-${String(ay + 1).padStart(2, '0')}` };
      }
      const kay = /\b(gecen|onceki)\s+ay\b/.test(t) ? -1 : /\b(gelecek|sonraki)\s+ay\b/.test(t) ? 1 : /\bbu\s+ay(a|in)?\b/.test(t) && /don|git|ac/.test(t) ? 0 : null;
      if (kay === null) return null;
      const d = new Date(simdi.getFullYear(), simdi.getMonth() + kay, 1);
      return { donem: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
    },
    ad: p => `Döneme git: ${AY_ADLARI[+p.donem.slice(5) - 1]} ${p.donem.slice(0, 4)}`, ac: () => 'Bütün sayfalar bu döneme göre gösterilir.' },
  { id: 'hesap', grup: 'Araç', sim: '=', ornek: '= 1250 * 12',
    coz(t) {
      const m = /^(?:=|hesapla\s*:?)\s*(.+)$/.exec(t) || (/[+*/]/.test(t) && /^[\d\s+\-*/%().,x×÷]+$/.test(t) ? [t, t] : null);
      if (!m) return null;
      const v = hesapla(m[1]!);
      return v === null ? null : { ifade: m[1]!.trim(), v };
    },
    ad: p => `${p.ifade} = ${p.v.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}`, ac: () => 'Sonuç panoya kopyalanır.' },
  { id: 'tema', grup: 'Ayar', sim: '◐', ornek: 'temayı açık yap',
    coz(t) {
      if (!/tema|mod\b|modu/.test(t)) return null;
      const v = /koyu|karanlik|gece|dark/.test(t) ? 'koyu' : /acik|aydinlik|gunduz|light|beyaz/.test(t) ? 'acik' : /sistem|otomatik/.test(t) ? 'sistem' : null;
      return v ? { v } : null;
    },
    ad: p => `Tema: ${({ koyu: 'koyu', acik: 'açık', sistem: 'sistemi izle' } as Record<string, string>)[p.v]}`, ac: () => 'Uygulamanın renk teması değişir.' },
  { id: 'gizlilik', grup: 'Ayar', sim: '◌', ornek: 'gizlilik modunu aç',
    coz(t) {
      if (!/gizlilik|tutarlari\s*(gizle|goster)|gizli\s*mod/.test(t)) return null;
      return { v: !/kapat|goster/.test(t) };
    },
    ad: p => `Gizlilik modu: ${p.v ? 'aç' : 'kapat'}`, ac: () => 'Tutarlar ekranda bulanıklaşır ya da yeniden görünür.' },
];

/* Cümleyi bütün desenlerden geçirir. */
export function hizliCoz(q: string, simdi = new Date()): Komut[] {
  q = String(q || '').trim();
  if (q.length < 2) return [];
  const t = kat(q);
  const out: Komut[] = [];
  for (const d of DESENLER) {
    let p: Param | null = null;
    try { p = d.coz(t, q, simdi); } catch { p = null; }
    if (p) out.push({ id: 'hizli:' + d.id, desen: d.id, grup: d.grup, sim: d.sim, ad: d.ad(p), ac: d.ac(p), p, tur: 'hızlı' });
  }
  return out;
}
