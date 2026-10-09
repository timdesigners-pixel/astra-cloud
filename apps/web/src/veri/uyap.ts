import { icraKaydet, type IcraAlanlari, type IcraDosyasi } from './icra';

/* UYAP icra özeti (JSON) içe aktarma: saf planlama + sırayla yazma.
   Eşleşme dosya numarası ve icra dairesiyle yapılır; bulunan dosya güncellenir, bulunmayan eklenir, hiçbiri silinmez.
   UYAP'ın vermediği alanlar (faiz oranı, tebliğ tarihi, öncelik, bağlı kayıtlar) olduğu gibi korunur.
   Talimat dosyalarının hesabı UYAP'ta boş gelir: tutarlara dokunulmaz. */
export type UyapDosya = {
  no: string; dr?: string; rol?: string; durum?: string; acik?: boolean; ac?: string; kapanis?: string; turu?: string; yolu?: string;
  al?: string; av?: string; as?: number | null; faiz?: number; vekalet?: number; masraf?: number; vergi?: number; harc?: number;
  toplam?: number; yatan?: number; gn?: number | null; tahsilat?: { toplam?: number; reddiyat?: number; kalan?: number } | null;
  sonIslem?: string; olaylar?: string[]; ucuncu?: string[]; digerHaciz?: number;
};
export type UyapPaket = { kaynak?: string; tarih?: string; dosyalar: UyapDosya[] };

const noNorm = (s: unknown) => String(s ?? '').replace(/\s/g, '').replace(/^(\d{4})\/0*(\d+)$/, '$1/$2');
const drNorm = (s: unknown) => String(s ?? '').toLocaleLowerCase('tr').replace(/\(kapatılan\)/g, '')
  .replace(/icra dairesi|icra müdürlüğü|genel/g, '').replace(/[^a-zçğıöşü0-9]/g, '');
const r2 = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
/* "12.03.2024" ya da "2024-03-12" → "2024-03-12"; anlaşılmazsa null. */
const tarihIso = (t: unknown): string | null => {
  const s = String(t ?? '').trim();
  const a = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (a) return `${a[1]}-${a[2]}-${a[3]}`;
  const b = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (b) return `${b[3]}-${b[2]!.padStart(2, '0')}-${b[1]!.padStart(2, '0')}`;
  return null;
};

export function uyapTuru(k: UyapDosya): string {
  if (!k.turu && (k.as === null || k.as === undefined)) return 'Talimat';
  if (/tahliye/i.test(k.yolu ?? '')) return 'Tahliye';
  if (/kambiyo/i.test(k.yolu ?? '')) return 'Kambiyo';
  if (/[İi]lamlı/.test(k.turu ?? '')) return 'İlamlı';
  return 'İlamsız';
}
export function uyapDurumu(k: UyapDosya): 'kapali' | 'itiraz' | 'acik' {
  if (!k.acik) return 'kapali';
  if (/[İi]tiraz/.test(k.durum ?? '')) return 'itiraz';
  return 'acik';
}

export function eslesen(liste: IcraDosyasi[], k: UyapDosya): IcraDosyasi | null {
  const no = noNorm(k.no), dr = drNorm(k.dr);
  const ayni = liste.filter(x => noNorm(x.dosya_no) === no);
  return ayni.find(x => drNorm(x.icra_dairesi) === dr)
    ?? ayni.find(x => !x.icra_dairesi || drNorm(x.icra_dairesi).startsWith(dr.slice(0, 5)) || dr.startsWith(drNorm(x.icra_dairesi).slice(0, 5)))
    ?? null;
}

export function uyapAyristir(metin: string): UyapPaket {
  const v = JSON.parse(metin) as UyapPaket | UyapDosya[];
  const dosyalar = Array.isArray(v) ? v : v?.dosyalar;
  if (!Array.isArray(dosyalar) || !dosyalar.length || !dosyalar.every(k => k && typeof k.no === 'string' && k.no.trim()))
    throw new Error('Dosya UYAP icra özeti değil (dosyalar listesi bulunamadı).');
  return { tarih: (Array.isArray(v) ? undefined : v.tarih), dosyalar };
}

export type UyapPlan = {
  tarih: string; paket: UyapDosya[]; borc: UyapDosya[]; alacak: UyapDosya[];
  guncel: UyapDosya[]; yeni: UyapDosya[]; oncekiToplam: number; yeniAcikToplam: number;
};
export function uyapPlanla(p: UyapPaket, mevcut: IcraDosyasi[], bugun: string): UyapPlan {
  const borc = p.dosyalar.filter(k => k.rol !== 'Alacaklı'), alacak = p.dosyalar.filter(k => k.rol === 'Alacaklı');
  const tumu = [...borc, ...alacak];
  const guncel = tumu.filter(k => eslesen(mevcut, k)), yeni = tumu.filter(k => !eslesen(mevcut, k));
  const acikMi = (d: IcraDosyasi) => d.durum === 'acik' && d.taraf_rolu !== 'Alacaklı';
  return {
    tarih: tarihIso(p.tarih) ?? bugun, paket: p.dosyalar, borc, alacak, guncel, yeni,
    oncekiToplam: mevcut.filter(acikMi).reduce((t, d) => t + (d.guncel_toplam_borc ?? 0), 0),
    yeniAcikToplam: borc.filter(k => uyapDurumu(k) === 'acik' && k.gn !== null && k.gn !== undefined).reduce((t, k) => t + r2(k.gn), 0),
  };
}

/* Bir UYAP dosyasından yazılacak alanlar. Talimatta tutarlara dokunulmaz. */
export function uyapAlanlari(k: UyapDosya, tarih: string, mevcut: IcraDosyasi | null): IcraAlanlari {
  const hesapVar = k.as !== null && k.as !== undefined;
  const dur = uyapDurumu(k);
  const a: IcraAlanlari = {
    icra_dairesi: k.dr ?? null, taraf_rolu: k.rol === 'Alacaklı' ? 'Alacaklı' : 'Borçlu',
    durum: dur === 'kapali' ? 'kapandi' : 'acik', uyap_durum: k.durum ?? null, uyap_tarihi: tarih, dogrulama_tarihi: tarih,
    takip_turu: mevcut?.takip_turu === 'Mükerrer' ? 'Mükerrer' : uyapTuru(k), takip_yolu: [k.turu, k.yolu].filter(Boolean).join(' · ') || null,
    diger_haciz_sayisi: k.digerHaciz ?? 0, ucuncu_sahislar: k.ucuncu ?? [], son_islemler: (k.olaylar ?? []).slice(0, 6),
  };
  if (k.al) a.karsi_taraf = k.al;
  if (!mevcut) a.oncelik = dur !== 'acik' ? 4 : ['İlamlı', 'Kambiyo', 'Tahliye'].includes(uyapTuru(k)) ? 1 : 2;
  const ac = tarihIso(k.ac), kap = tarihIso(k.kapanis), son = tarihIso(k.sonIslem);
  if (ac) a.acilis_tarihi = ac;
  if (kap) a.kapanis_tarihi = kap;
  if (son && (!mevcut?.son_islem_tarihi || son > mevcut.son_islem_tarihi)) a.son_islem_tarihi = son;
  if (hesapVar) {
    const ekle = (anahtar: keyof IcraAlanlari, v: unknown) => { if (v !== undefined && v !== null) (a as Record<string, unknown>)[anahtar] = r2(v); };
    ekle('gercek_asil_alacak', k.as); ekle('guncel_toplam_borc', k.gn); ekle('faiz_tutari', k.faiz); ekle('vekalet_ucreti', k.vekalet);
    ekle('masraf', k.masraf); ekle('vergi', k.vergi); ekle('tahsil_harci', k.harc); ekle('toplam_alacak', k.toplam); ekle('yatan_para', k.yatan);
    if (k.tahsilat) { ekle('tahsilat', k.tahsilat.toplam); ekle('reddiyat', k.tahsilat.reddiyat); }
  }
  return a;
}

export type Degisim = { tur: 'yeni' | 'guncel'; no: string; dr: string; eskiGn: number; yeniGn: number; eskiDur: string | null; yeniDur: string };
export function uyapDegisimOzeti(l: Degisim[]) {
  const fark = (x: Degisim) => x.yeniGn - x.eskiGn;
  const acikFark = (x: Degisim) => (x.yeniDur === 'acik' ? x.yeniGn : 0) - (x.eskiDur === 'acik' ? x.eskiGn : 0);
  return {
    toplam: l.length,
    yeni: l.filter(x => x.tur === 'yeni').length,
    artan: l.filter(x => x.tur === 'guncel' && fark(x) > 0.5).length,
    azalan: l.filter(x => x.tur === 'guncel' && fark(x) < -0.5).length,
    degismeyen: l.filter(x => x.tur === 'guncel' && Math.abs(fark(x)) <= 0.5 && x.eskiDur === x.yeniDur).length,
    kapanan: l.filter(x => x.tur === 'guncel' && x.eskiDur === 'acik' && x.yeniDur !== 'acik').length,
    yenidenAcilan: l.filter(x => x.tur === 'guncel' && x.eskiDur !== 'acik' && x.yeniDur === 'acik').length,
    acikBorcFarki: l.reduce((t, x) => t + acikFark(x), 0),
    satirlar: l.filter(x => x.tur === 'yeni' || Math.abs(fark(x)) > 0.5 || x.eskiDur !== x.yeniDur).sort((a, b) => Math.abs(fark(b)) - Math.abs(fark(a))),
  };
}

/* Planı sırayla yazar. Bir dosya hata verirse diğerlerine devam edilir; hatalar listelenir. */
export async function uyapUygula(plan: UyapPlan, mevcut: IcraDosyasi[], ilerleme?: (yapilan: number, toplam: number) => void) {
  const degisimler: Degisim[] = [], hatalar: string[] = [];
  const tumu = [...plan.borc, ...plan.alacak];
  let guncellenen = 0, eklenen = 0;
  for (const [i, k] of tumu.entries()) {
    const m = eslesen(mevcut, k);
    try {
      const sonuc = await icraKaydet(m ? { id: m.id, surum: m.surum } : null, m ? null : k.no.trim(), uyapAlanlari(k, plan.tarih, m));
      const dur = uyapDurumu(k);
      if (k.rol !== 'Alacaklı') {
        degisimler.push({ tur: m ? 'guncel' : 'yeni', no: k.no, dr: k.dr ?? '', eskiGn: m?.guncel_toplam_borc ?? 0, yeniGn: sonuc.guncel_toplam_borc ?? 0, eskiDur: m ? (m.durum === 'acik' ? 'acik' : 'kapali') : null, yeniDur: dur });
      }
      if (m) guncellenen++; else eklenen++;
      mevcut.push(sonuc);
      if (m) mevcut.splice(mevcut.indexOf(m), 1);
    } catch (e) { hatalar.push(`${k.no}: ${e instanceof Error ? e.message : String(e)}`); }
    ilerleme?.(i + 1, tumu.length);
  }
  return { guncellenen, eklenen, alacakli: plan.alacak.length, degisimler, hatalar };
}
