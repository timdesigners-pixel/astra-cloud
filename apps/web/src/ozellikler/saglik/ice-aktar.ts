import { cevir, type Satir, type Tur } from '../../../../../supabase/functions/saglik-esitle/cevir';
import type { Olcum } from '../../veri/saglik';
import { bugunAnahtari } from '../../ortak/zaman';

/* Dosyadan içe aktarma: Apple Sağlık dışa aktarımı (export.zip ya da export.xml), CSV (Garmin, Fitbit, Samsung vb. dışa aktarımları) ve JSON
   (Health Auto Export dosyaları). Her şey tarayıcıda okunur; ham dosya hiçbir yere gönderilmez, yalnız günlük özetler kaydedilir. */
export type Sonuc = { satirlar: Olcum[]; ozet: string };
type Ilerleme = (metin: string) => void;

const gunOnce = (n: number) => new Date(Date.parse(bugunAnahtari()) - n * 86400000).toISOString().slice(0, 10);

/* ——— Zip: yalnız gereken dosyayı okur (büyük arşivi belleğe almaz) ——— */
const u32 = (d: DataView, o: number) => d.getUint32(o, true);
const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u64 = (d: DataView, o: number) => Number(d.getBigUint64(o, true));
type ZipGirdisi = { ad: string; yontem: number; sikisik: number; acik: number; konum: number };

async function zipGirdileri(f: File): Promise<ZipGirdisi[]> {
  const kuyruk = Math.min(f.size, 65557 + 22);
  const son = new DataView(await f.slice(f.size - kuyruk).arrayBuffer());
  let e = -1;
  for (let i = kuyruk - 22; i >= 0; i--) if (u32(son, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Bu dosya geçerli bir zip arşivi değil.');
  let sayi = u16(son, e + 10), boyut = u32(son, e + 12), konum = u32(son, e + 16);
  if (sayi === 0xffff || boyut === 0xffffffff || konum === 0xffffffff) {
    const yer = e - 20;
    if (yer < 0 || u32(son, yer) !== 0x07064b50) throw new Error('Zip64 yapısı okunamadı.');
    const z64 = new DataView(await f.slice(u64(son, yer + 8), u64(son, yer + 8) + 56).arrayBuffer());
    if (u32(z64, 0) !== 0x06064b50) throw new Error('Zip64 yapısı okunamadı.');
    sayi = u64(z64, 32); boyut = u64(z64, 40); konum = u64(z64, 48);
  }
  const cd = new DataView(await f.slice(konum, konum + boyut).arrayBuffer());
  const metin = new TextDecoder();
  const liste: ZipGirdisi[] = [];
  let o = 0;
  for (let i = 0; i < sayi && o + 46 <= cd.byteLength; i++) {
    if (u32(cd, o) !== 0x02014b50) break;
    const yontem = u16(cd, o + 10);
    let sikisik = u32(cd, o + 20), acik = u32(cd, o + 24), yerel = u32(cd, o + 42);
    const adUz = u16(cd, o + 28), ekUz = u16(cd, o + 30), yorumUz = u16(cd, o + 32);
    const ad = metin.decode(new Uint8Array(cd.buffer, o + 46, adUz));
    let ek = o + 46 + adUz;
    const ekSon = ek + ekUz;
    while (ek + 4 <= ekSon) {
      const kimlik = u16(cd, ek), uz = u16(cd, ek + 2);
      if (kimlik === 1) {
        let p = ek + 4;
        if (acik === 0xffffffff) { acik = u64(cd, p); p += 8; }
        if (sikisik === 0xffffffff) { sikisik = u64(cd, p); p += 8; }
        if (yerel === 0xffffffff) { yerel = u64(cd, p); }
      }
      ek += 4 + uz;
    }
    liste.push({ ad, yontem, sikisik, acik, konum: yerel });
    o += 46 + adUz + ekUz + yorumUz;
  }
  return liste;
}

async function zipAkimi(f: File, g: ZipGirdisi): Promise<ReadableStream<Uint8Array>> {
  const yerel = new DataView(await f.slice(g.konum, g.konum + 30).arrayBuffer());
  if (u32(yerel, 0) !== 0x04034b50) throw new Error('Zip kaydı okunamadı.');
  const bas = g.konum + 30 + u16(yerel, 26) + u16(yerel, 28);
  const ham = f.slice(bas, bas + g.sikisik).stream() as ReadableStream<Uint8Array>;
  if (g.yontem === 0) return ham;
  if (g.yontem !== 8) throw new Error('Desteklenmeyen zip sıkıştırması.');
  return ham.pipeThrough(new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
}

/* ——— Apple Sağlık XML ——— */
type TurAyar = { tur: Tur; mod: 'toplam' | 'ortalama' | 'son'; birim?: (v: number, b: string) => number };
const APPLE: Record<string, TurAyar> = {
  StepCount: { tur: 'adim', mod: 'toplam' },
  DistanceWalkingRunning: { tur: 'mesafe_m', mod: 'toplam', birim: (v, b) => (/^km/i.test(b) ? v * 1000 : /^mi/i.test(b) ? v * 1609.344 : v) },
  ActiveEnergyBurned: { tur: 'kalori_aktif', mod: 'toplam', birim: (v, b) => (/kj/i.test(b) ? v / 4.184 : v) },
  AppleExerciseTime: { tur: 'egzersiz_dk', mod: 'toplam' },
  HeartRate: { tur: 'nabiz', mod: 'ortalama' },
  RestingHeartRate: { tur: 'dinlenme_nabzi', mod: 'ortalama' },
  HeartRateVariabilitySDNN: { tur: 'hrv', mod: 'ortalama' },
  OxygenSaturation: { tur: 'spo2', mod: 'ortalama', birim: v => (v <= 1 ? v * 100 : v) },
  BodyMass: { tur: 'kilo', mod: 'son', birim: (v, b) => (/^lb/i.test(b) ? v * 0.45359237 : v) },
  BodyFatPercentage: { tur: 'yag_orani', mod: 'son', birim: v => (v <= 1 ? v * 100 : v) },
  BloodPressureSystolic: { tur: 'tansiyon_sis', mod: 'ortalama' },
  BloodPressureDiastolic: { tur: 'tansiyon_dia', mod: 'ortalama' },
  BloodGlucose: { tur: 'glukoz', mod: 'ortalama', birim: (v, b) => (/mmol/i.test(b) ? v * 18.016 : v) },
  BodyTemperature: { tur: 'ates', mod: 'ortalama', birim: (v, b) => (/f/i.test(b) ? (v - 32) / 1.8 : v) },
  DietaryWater: { tur: 'su_ml', mod: 'toplam', birim: (v, b) => (/^l$/i.test(b) ? v * 1000 : /fl/i.test(b) ? v * 29.5735 : v) },
};
const SINIR: Partial<Record<Tur, [number, number]>> = {
  adim: [0, 200000], nabiz: [20, 250], dinlenme_nabzi: [20, 200], spo2: [50, 100], kilo: [20, 400], yag_orani: [1, 80], tansiyon_sis: [50, 260],
  tansiyon_dia: [30, 160], glukoz: [20, 800], ates: [30, 45], hrv: [0, 500],
};

class AppleToplayici {
  kesim: string;
  kayit = 0;
  private toplam = new Map<string, Map<string, number>>();
  private ort = new Map<string, { t: number; n: number; min: number; max: number }>();
  private son = new Map<string, { v: number; z: string }>();
  private uyku = new Map<string, Map<string, number>>();
  constructor(kesim: string) { this.kesim = kesim; }

  isle(a: Record<string, string>) {
    const baslangic = a.startDate ?? '';
    const bitis = a.endDate ?? baslangic;
    const ad = (a.type ?? '').replace(/^HK(Quantity|Category)TypeIdentifier/, '');
    if (bitis.slice(0, 10) < this.kesim) return;
    this.kayit++;
    const kaynak = a.sourceName ?? '?';
    if (ad === 'SleepAnalysis') {
      if (!/Asleep/.test(a.value ?? '')) return;
      const dk = (Date.parse(bitis.replace(' ', 'T').replace(' ', '')) - Date.parse(baslangic.replace(' ', 'T').replace(' ', ''))) / 60000;
      if (!(dk > 0 && dk < 1440)) return;
      const gun = bitis.slice(0, 10);
      const m = this.uyku.get(gun) ?? new Map<string, number>();
      m.set(kaynak, (m.get(kaynak) ?? 0) + dk);
      this.uyku.set(gun, m);
      return;
    }
    const ayar = APPLE[ad];
    if (!ayar) return;
    let v = Number(a.value);
    if (!Number.isFinite(v)) return;
    if (ayar.birim) v = ayar.birim(v, a.unit ?? '');
    const gun = baslangic.slice(0, 10);
    const k = gun + '|' + ayar.tur;
    if (ayar.mod === 'toplam') {
      const m = this.toplam.get(k) ?? new Map<string, number>();
      m.set(kaynak, (m.get(kaynak) ?? 0) + v);
      this.toplam.set(k, m);
    } else if (ayar.mod === 'ortalama') {
      const o = this.ort.get(k) ?? { t: 0, n: 0, min: Infinity, max: -Infinity };
      o.t += v; o.n++; o.min = Math.min(o.min, v); o.max = Math.max(o.max, v);
      this.ort.set(k, o);
    } else {
      const s = this.son.get(k);
      if (!s || bitis >= s.z) this.son.set(k, { v, z: bitis });
    }
  }

  satirlar(): Satir[] {
    const cikti: Satir[] = [];
    const r = (x: number) => Math.round(x * 100) / 100;
    const uygun = (tur: Tur, v: number) => { const s = SINIR[tur]; return !s || (v >= s[0] && v <= s[1]); };
    // Aynı veriyi hem iPhone hem saat yazdığı için en çok veri toplayan kaynak alınır (toplamlar çift sayılmaz).
    for (const [k, m] of this.toplam) {
      const [gun, tur] = k.split('|') as [string, Tur];
      const v = Math.max(...m.values());
      if (v > 0 && uygun(tur, v)) cikti.push({ gun, tur, deger: r(v) });
    }
    for (const [k, o] of this.ort) {
      const [gun, tur] = k.split('|') as [string, Tur];
      const v = o.t / o.n;
      if (!uygun(tur, v)) continue;
      cikti.push(o.n > 1 && o.min !== o.max ? { gun, tur, deger: r(v), en_az: r(o.min), en_cok: r(o.max), ornek: o.n } : { gun, tur, deger: r(v), ornek: o.n });
    }
    for (const [k, s] of this.son) {
      const [gun, tur] = k.split('|') as [string, Tur];
      if (uygun(tur, s.v)) cikti.push({ gun, tur, deger: r(s.v) });
    }
    for (const [gun, m] of this.uyku) {
      const dk = Math.max(...m.values());
      if (dk > 0 && dk <= 1440) cikti.push({ gun, tur: 'uyku_dk', deger: r(dk) });
    }
    return cikti;
  }
}

async function appleXml(akim: ReadableStream<Uint8Array>, kesim: string, ilerleme: Ilerleme): Promise<Satir[]> {
  const t = new AppleToplayici(kesim);
  const okuyucu = akim.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
  let tampon = '';
  let okunan = 0;
  const OZNITELIK = /([A-Za-z]+)="([^"]*)"/g;
  for (;;) {
    const { value, done } = await okuyucu.read();
    if (done) break;
    okunan += value.length;
    tampon += value;
    let bas = 0;
    for (;;) {
      const a = tampon.indexOf('<Record ', bas);
      if (a < 0) { bas = Math.max(bas, tampon.length - 8); break; }
      const b = tampon.indexOf('>', a);
      if (b < 0) { bas = a; break; }
      const nitelik: Record<string, string> = {};
      const govde = tampon.slice(a + 8, b);
      OZNITELIK.lastIndex = 0;
      for (let m = OZNITELIK.exec(govde); m; m = OZNITELIK.exec(govde)) nitelik[m[1]!] = m[2]!;
      t.isle(nitelik);
      bas = b + 1;
    }
    tampon = tampon.slice(bas);
    ilerleme(`Okunuyor… ${(okunan / 1048576).toFixed(0)} MB, ${t.kayit.toLocaleString('tr-TR')} kayıt`);
  }
  return t.satirlar();
}

/* ——— CSV ——— */
function csvSatirlari(metin: string): Record<string, string>[] {
  const satirlar = metin.replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
  if (satirlar.length < 2) return [];
  const ilk = satirlar[0]!;
  const ayrac = [';', '\t', ','].map(a => [a, ilk.split(a).length] as const).sort((x, y) => y[1] - x[1])[0]![0];
  const bol = (s: string) => {
    const hucre: string[] = []; let k = '', tirnak = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i]!;
      if (c === '"') { if (tirnak && s[i + 1] === '"') { k += '"'; i++; } else tirnak = !tirnak; } else if (c === ayrac && !tirnak) { hucre.push(k); k = ''; } else k += c;
    }
    hucre.push(k);
    return hucre.map(x => x.trim());
  };
  const baslik = bol(ilk);
  return satirlar.slice(1).map(s => { const h = bol(s); return Object.fromEntries(baslik.map((b, i) => [b, h[i] ?? ''])); });
}

function sonucYap(satirlar: Satir[], kesim: string, kaynakAdi: string): Sonuc {
  const s = satirlar.filter(x => x.gun >= kesim);
  const gunler = [...new Set(s.map(x => x.gun))].sort();
  const ozet = s.length
    ? `${kaynakAdi}: ${s.length} günlük ölçüm, ${gunler.length} gün (${gunler[0]} – ${gunler[gunler.length - 1]})`
    : `${kaynakAdi}: seçilen aralıkta tanınan ölçüm bulunamadı`;
  return { satirlar: s.map(x => ({ gun: x.gun, tur: x.tur, kaynak: 'dosya' as const, deger: x.deger, en_az: x.en_az ?? null, en_cok: x.en_cok ?? null, ornek: x.ornek ?? null })), ozet };
}

/** gunSayisi: son kaç günün alınacağı (0 = hepsi). */
export async function dosyadanOku(f: File, gunSayisi: number, ilerleme: Ilerleme): Promise<Sonuc> {
  const ad = f.name.toLowerCase();
  const kesim = gunSayisi > 0 ? gunOnce(gunSayisi) : '2000-01-01';
  if (ad.endsWith('.zip')) {
    ilerleme('Arşiv açılıyor…');
    const girdiler = (await zipGirdileri(f)).filter(g => /\.xml$/i.test(g.ad) && !/_cda\.xml$/i.test(g.ad) && !/electrocardiograms|workout-routes/i.test(g.ad));
    const xml = girdiler.sort((a, b) => b.acik - a.acik)[0];
    if (!xml) throw new Error('Arşivde Apple Sağlık dışa aktarım dosyası (export.xml) bulunamadı.');
    return sonucYap(await appleXml(await zipAkimi(f, xml), kesim, ilerleme), kesim, 'Apple Sağlık');
  }
  if (ad.endsWith('.xml')) return sonucYap(await appleXml(f.stream() as ReadableStream<Uint8Array>, kesim, ilerleme), kesim, 'Apple Sağlık');
  if (f.size > 60 * 1024 * 1024) throw new Error('Dosya çok büyük (en fazla 60 MB).');
  const metin = await f.text();
  const bugun = bugunAnahtari();
  if (ad.endsWith('.json')) {
    let govde: unknown;
    try { govde = JSON.parse(metin); } catch { throw new Error('JSON dosyası okunamadı.'); }
    const { satirlar, sorun } = cevir(govde, bugun);
    if (sorun) throw new Error(sorun);
    return sonucYap(satirlar, kesim, 'JSON dosyası');
  }
  if (ad.endsWith('.csv') || ad.endsWith('.txt') || ad.endsWith('.tsv')) {
    const { satirlar, sorun } = cevir(csvSatirlari(metin), bugun);
    if (sorun) throw new Error(sorun + '. İlk satırda "Tarih" ile "Adım", "Nabız", "Uyku", "Kilo" gibi sütun adları olmalı.');
    return sonucYap(satirlar, kesim, 'CSV dosyası');
  }
  throw new Error('Desteklenen dosyalar: export.zip, export.xml (Apple Sağlık), .csv ve .json.');
}
