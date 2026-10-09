/* Kurumdan alınan tecil / yapılandırma ödeme planı (PDF ya da yapıştırılan metin) satırlarını çözer.
   Her satırda vade tarihi ve bir ya da birkaç tutar sütunu aranır; taksit sütunu değerleri en az dalgalanan sütun olarak önerilir
   (eşit taksitli planlarda "Toplam" sütunu), önizlemede değiştirilebilir. */
export const TECIL_NO = /\b(\d{10}[A-Za-zÇĞİÖŞÜçğıöşü]{2,3}\d{7})\b/;
const TUTAR = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?![\d])/g;
const TARIH = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/;
const sayi = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0;

export type PlanSatiri = { tarih: string; tutarlar: number[]; satir: string };
export type PlanCozum = { rows: PlanSatiri[]; genislik: number; sutun: number; tecil: string; daire: string };

export function planCoz(metin: string): PlanCozum {
  const satirlar = String(metin || '').split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const rows: PlanSatiri[] = [];
  satirlar.forEach(s => {
    const t = s.match(TARIH); if (!t) return;
    const kalan = s.slice(t.index! + t[0].length);
    const tutarlar = [...kalan.matchAll(TUTAR)].map(m => sayi(m[1]!)).filter(v => v > 0);
    if (!tutarlar.length) return;
    rows.push({ tarih: `${t[3]}-${t[2]!.padStart(2, '0')}-${t[1]!.padStart(2, '0')}`, tutarlar, satir: s });
  });
  const sik: Record<number, number> = {};
  rows.forEach(r => { sik[r.tutarlar.length] = (sik[r.tutarlar.length] ?? 0) + 1; });
  const genislik = Number(Object.keys(sik).sort((a, b) => sik[Number(b)]! - sik[Number(a)]!)[0]) || 1;
  let sutun = genislik - 1, enIyi = Infinity;
  for (let i = 0; i < genislik; i++) {
    const v = rows.filter(r => r.tutarlar.length === genislik).map(r => r.tutarlar[i]!);
    if (!v.length) continue;
    const ort = v.reduce((a, b) => a + b, 0) / v.length;
    const cv = ort ? Math.sqrt(v.reduce((a, b) => a + (b - ort) ** 2, 0) / v.length) / ort : Infinity;
    if (cv <= enIyi + 1e-9) { enIyi = cv; sutun = i; }
  }
  const tam = rows.filter(r => r.tutarlar.length === genislik);
  if (genislik >= 3 && tam.length) {
    const toplamMi = tam.filter(r => {
      const son = r.tutarlar[genislik - 1]!, digerleri = r.tutarlar.slice(0, -1).reduce((a, b) => a + b, 0);
      return Math.abs(son - digerleri) <= Math.max(0.05, son * 0.005);
    }).length;
    if (toplamMi >= tam.length * 0.8) sutun = genislik - 1;
  }
  const tecil = metin.match(TECIL_NO)?.[1] ?? '';
  const dm = metin.match(/([A-Za-zÇĞİÖŞÜçğıöşü]+(?: [A-Za-zÇĞİÖŞÜçğıöşü]+)?)\s+(?:VERG[İI]|Vergi)\s+(?:DA[İI]RES[İI]|Dairesi)/);
  const daire = dm ? dm[1]!.toLocaleLowerCase('tr').replace(/(^|\s)\S/g, h => h.toLocaleUpperCase('tr')) : '';
  return { rows, genislik, sutun, tecil, daire };
}

/* Seçilen sütunla vade günü başına taksit listesi (aynı güne düşenler toplanır). */
export function planKur(c: PlanCozum, sutun: number): { tarih: string; tutar: number }[] {
  const gunler = new Map<string, number>();
  c.rows.forEach(r => {
    const i = r.tutarlar.length === c.genislik ? sutun : r.tutarlar.length - 1;
    const v = r.tutarlar[Math.min(i, r.tutarlar.length - 1)]!;
    gunler.set(r.tarih, (gunler.get(r.tarih) ?? 0) + v);
  });
  return [...gunler.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tarih, v]) => ({ tarih, tutar: Math.round(v * 100) / 100 }));
}

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_ISCI = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

/* PDF metni: aynı yükseklikteki parçalar tek satır, soldan sağa. */
export async function pdfMetni(dosya: File): Promise<string> {
  const pdfjs = await import(/* @vite-ignore */ PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_ISCI;
  const doc = await pdfjs.getDocument({ data: await dosya.arrayBuffer() }).promise;
  const satirlar: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const icerik = await (await doc.getPage(i)).getTextContent();
    const gr = new Map<number, { x: number; t: string }[]>();
    for (const it of icerik.items as { str: string; transform?: number[] }[]) {
      const y = Math.round(it.transform?.[5] ?? 0), x = it.transform?.[4] ?? 0;
      const k = [...gr.keys()].find(a => Math.abs(a - y) <= 2) ?? y;
      (gr.get(k) ?? gr.set(k, []).get(k)!).push({ x, t: it.str });
    }
    [...gr.keys()].sort((a, b) => b - a).forEach(k => satirlar.push(gr.get(k)!.sort((a, b) => a.x - b.x).map(p => p.t).join(' ')));
  }
  return satirlar.join('\n');
}
