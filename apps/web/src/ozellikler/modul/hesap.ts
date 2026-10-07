/* Modül Merkezi sayfalarının saf hesapları (ekrandan bağımsız, test edilebilir). */
export type Satir = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const iki = (x: number) => String(x).padStart(2, '0');

/* ---------- aylık rapor ---------- */
export type Rapor = {
  gelir: number; alinanBorc: number; birikimdenCekme: number; gider: number; borcOdemesi: number; birikimeAyrilan: number;
  net: number; giderKirilimi: [string, number][]; gelirKirilimi: [string, number][];
};

export function raporHesapla(hareketler: Satir[], ay: string): Rapor {
  const r: Rapor = { gelir: 0, alinanBorc: 0, birikimdenCekme: 0, gider: 0, borcOdemesi: 0, birikimeAyrilan: 0, net: 0, giderKirilimi: [], gelirKirilimi: [] };
  const gk = new Map<string, number>(), ik = new Map<string, number>();
  for (const h of hareketler) {
    if (!String(h.tarih ?? '').startsWith(ay) || h.tur === 'transfer') continue;
    const t = n(h.tutar), kat = String(h.kategori ?? 'Diğer');
    if (h.yon === 'giris') {
      r.net += t;
      if (h.tur === 'alinan_borc') r.alinanBorc += t;
      else if (h.tur === 'birikim') r.birikimdenCekme += t;
      else if (h.gelir_sayilir !== false) { r.gelir += t; ik.set(kat, (ik.get(kat) ?? 0) + t); }
    } else {
      r.net -= t;
      if (h.tur === 'odeme') r.borcOdemesi += t;
      else if (h.tur === 'birikim') r.birikimeAyrilan += t;
      else { r.gider += t; gk.set(kat, (gk.get(kat) ?? 0) + t); }
    }
  }
  const sirala = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  r.giderKirilimi = sirala(gk); r.gelirKirilimi = sirala(ik);
  return r;
}

export const ayEkle = (ay: string, k: number) => {
  const [y, m] = ay.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + k, 1));
  return `${d.getUTCFullYear()}-${iki(d.getUTCMonth() + 1)}`;
};

/* ---------- planlayıcı: 12 aylık nakit akışı ---------- */
export type PlanGirdi = {
  bugun: string; baslangicBakiye: number; gelirler: Satir[]; giderler: Satir[]; odemeler: Satir[]; alinacaklar: Satir[]; hedefler: Satir[];
};
export type PlanSatiri = { ay: string; giris: number; gider: number; odeme: number; alinacak: number; hedef: number; fark: number; bakiye: number };

export function planHesapla(g: PlanGirdi, aySayisi = 12): PlanSatiri[] {
  const bas = g.bugun.slice(0, 7);
  const sat: PlanSatiri[] = [];
  let bakiye = g.baslangicBakiye;
  const ayAdedi = (a: string, b: string) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2! - y1!) * 12 + (m2! - m1!); };
  for (let i = 0; i < aySayisi; i++) {
    const ay = ayEkle(bas, i);
    const giris = g.gelirler.filter(x => x.aktif !== false && x.sabit && x.periyot === 'aylik'
      && (!x.baslangic || String(x.baslangic).slice(0, 7) <= ay) && (!x.bitis || String(x.bitis).slice(0, 7) >= ay)).reduce((t, x) => t + n(x.tutar), 0);
    const gider = g.giderler.filter(x => x.aktif !== false && x.periyot === 'aylik' && (x.para_birimi ?? 'TRY') === 'TRY'
      && (x.bitis ? String(x.bitis).slice(0, 7) >= ay : true)
      && (x.taksit_kalan === null || x.taksit_kalan === undefined || i < n(x.taksit_kalan))).reduce((t, x) => t + n(x.tutar), 0);
    const odeme = g.odemeler.filter(x => x.durum === 'bekliyor').filter(x => { const a = String(x.vade_tarihi).slice(0, 7); return i === 0 ? a <= ay : a === ay; }).reduce((t, x) => t + n(x.tutar), 0);
    const alinacak = g.alinacaklar.filter(x => x.durum === 'karar' && x.hedef_tarih).filter(x => { const a = String(x.hedef_tarih).slice(0, 7); return i === 0 ? a <= ay : a === ay; }).reduce((t, x) => t + n(x.tahmini_tutar), 0);
    const hedef = g.hedefler.filter(x => x.durum === 'aktif' && x.hedef_tarihi).reduce((t, x) => {
      const kalan = n(x.hedef_tutar) - n(x.biriken);
      const hedefAy = String(x.hedef_tarihi).slice(0, 7);
      if (kalan <= 0 || ay > hedefAy) return t;
      return t + kalan / Math.max(1, ayAdedi(bas, hedefAy) + 1);
    }, 0);
    const fark = giris - gider - odeme - alinacak - hedef;
    bakiye += fark;
    sat.push({ ay, giris, gider, odeme, alinacak, hedef, fark, bakiye });
  }
  return sat;
}

/* ---------- simülasyon: borç kapatma ---------- */
export type SimBorc = { id: string; ad: string; bakiye: number; faizYillik: number; min: number };
export type SimSonuc = { ay: number | null; toplamFaiz: number; toplamOdeme: number; kapanis: Map<string, number>; neden?: string };

/* Çığ: faizi en yüksek borca öncelik. Kartopu: bakiyesi en küçük borca öncelik. Kapanan borcun taksiti diğerlerine akar. */
export function simule(borclar: SimBorc[], ek: number, strateji: 'cig' | 'kartopu', enCokAy = 600): SimSonuc {
  const b = borclar.filter(x => x.bakiye > 0.005).map(x => ({ ...x }));
  const kapanis = new Map<string, number>();
  if (!b.length) return { ay: 0, toplamFaiz: 0, toplamOdeme: 0, kapanis };
  const butce = b.reduce((t, x) => t + Math.max(0, x.min), 0) + Math.max(0, ek);
  if (butce <= 0) return { ay: null, toplamFaiz: 0, toplamOdeme: 0, kapanis, neden: 'Aylık ödeme tutarı girilmedi.' };
  let faizToplam = 0, odemeToplam = 0;
  for (let ay = 1; ay <= enCokAy; ay++) {
    for (const x of b) if (x.bakiye > 0.005) { const f = x.bakiye * (x.faizYillik / 100) / 12; x.bakiye += f; faizToplam += f; }
    let kalanButce = butce;
    for (const x of b) if (x.bakiye > 0.005) { const p = Math.min(x.bakiye, Math.max(0, x.min), kalanButce); x.bakiye -= p; kalanButce -= p; odemeToplam += p; }
    const sirali = b.filter(x => x.bakiye > 0.005).sort((p, q) => (strateji === 'cig' ? q.faizYillik - p.faizYillik || p.bakiye - q.bakiye : p.bakiye - q.bakiye || q.faizYillik - p.faizYillik));
    for (const x of sirali) { if (kalanButce <= 0) break; const p = Math.min(x.bakiye, kalanButce); x.bakiye -= p; kalanButce -= p; odemeToplam += p; }
    for (const x of b) if (x.bakiye <= 0.005 && !kapanis.has(x.id)) kapanis.set(x.id, ay);
    if (b.every(x => x.bakiye <= 0.005)) return { ay, toplamFaiz: faizToplam, toplamOdeme: odemeToplam, kapanis };
  }
  return { ay: null, toplamFaiz: faizToplam, toplamOdeme: odemeToplam, kapanis, neden: `${enCokAy} ayda kapanmıyor. Aylık ödeme faizi karşılamıyor olabilir.` };
}
