/* Küçük SVG grafikleri: zaman ekseni orantılı çizgi/çubuk grafik, isteğe bağlı referans bandı. Dış kütüphane yok. */
const NS = 'http://www.w3.org/2000/svg';
const e = (ad: string, nitelik: Record<string, string | number> = {}, metin?: string) => {
  const x = document.createElementNS(NS, ad);
  for (const [k, v] of Object.entries(nitelik)) x.setAttribute(k, String(v));
  if (metin !== undefined) x.textContent = metin;
  return x;
};
const kisaTarih = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
const gunNo = (s: string) => Math.round(Date.parse(s.slice(0, 10)) / 86400000);

export type Nokta = { x: string; y: number; etiket?: string; disarida?: boolean };
export type GrafikAyar = {
  ondalik?: number; alt?: number | null; ust?: number | null; yukseklik?: number; renk?: string;
  cubuk?: boolean; noktaGoster?: boolean; aralikAdi?: string; hedef?: number | null;
};

const sayiYaz = (n: number, o: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: o, maximumFractionDigits: o });

export function grafikCiz(noktalar: Nokta[], a: GrafikAyar = {}): SVGSVGElement {
  const G = 600, Y = a.yukseklik ?? 200, SOL = 46, SAG = 12, UST = 12, ALT = 24;
  const svg = e('svg', { viewBox: `0 0 ${G} ${Y}`, class: 'sg-grafik', role: 'img' }) as SVGSVGElement;
  svg.style.width = '100%';
  svg.style.height = 'auto';
  if (!noktalar.length) { svg.appendChild(e('text', { x: G / 2, y: Y / 2, 'text-anchor': 'middle', class: 'sg-bos' }, 'Veri yok')); return svg; }
  const o = a.ondalik ?? 0;
  const ys = noktalar.map(n => n.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  for (const s of [a.alt, a.ust, a.hedef]) if (s !== null && s !== undefined) { lo = Math.min(lo, s); hi = Math.max(hi, s); }
  if (a.cubuk) lo = Math.min(0, lo);
  if (hi === lo) { hi += 1; lo -= 1; }
  const pay = (hi - lo) * 0.08;
  if (!a.cubuk || lo !== 0) lo -= pay;
  hi += pay;
  const x0 = gunNo(noktalar[0]!.x), x1 = gunNo(noktalar[noktalar.length - 1]!.x);
  const aralik = Math.max(1, x1 - x0);
  const px = (s: string) => noktalar.length === 1 ? SOL + (G - SOL - SAG) / 2 : SOL + ((gunNo(s) - x0) / aralik) * (G - SOL - SAG);
  const py = (v: number) => UST + (1 - (v - lo) / (hi - lo)) * (Y - UST - ALT);

  // yatay ızgara + eksen yazıları
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) * i) / 3, yy = py(v);
    svg.appendChild(e('line', { x1: SOL, x2: G - SAG, y1: yy, y2: yy, class: 'sg-izgara' }));
    svg.appendChild(e('text', { x: SOL - 6, y: yy + 4, 'text-anchor': 'end', class: 'sg-eksen' }, sayiYaz(v, hi - lo > 20 ? 0 : o)));
  }
  // referans bandı
  if ((a.alt !== null && a.alt !== undefined) || (a.ust !== null && a.ust !== undefined)) {
    const ust = a.ust ?? hi, alt = a.alt ?? lo;
    const band = e('rect', { x: SOL, width: G - SOL - SAG, y: py(Math.min(ust, hi)), height: Math.max(1, py(Math.max(alt, lo)) - py(Math.min(ust, hi))), class: 'sg-band' });
    band.appendChild(e('title', {}, `${a.aralikAdi ?? 'Referans'}: ${a.alt !== null && a.alt !== undefined ? sayiYaz(a.alt, o) : '…'} – ${a.ust !== null && a.ust !== undefined ? sayiYaz(a.ust, o) : '…'}`));
    svg.appendChild(band);
  }
  if (a.hedef !== null && a.hedef !== undefined) {
    svg.appendChild(e('line', { x1: SOL, x2: G - SAG, y1: py(a.hedef), y2: py(a.hedef), class: 'sg-hedef' }));
    svg.appendChild(e('text', { x: G - SAG, y: py(a.hedef) - 4, 'text-anchor': 'end', class: 'sg-eksen' }, `hedef ${sayiYaz(a.hedef, o)}`));
  }
  const renk = a.renk ?? 'var(--cyan)';
  if (a.cubuk) {
    const w = Math.max(2, Math.min(24, ((G - SOL - SAG) / (aralik + 1)) * 0.7));
    noktalar.forEach(n => {
      const r = e('rect', { x: px(n.x) - w / 2, width: w, y: py(Math.max(n.y, lo)), height: Math.max(1, py(lo > 0 ? lo : 0) - py(n.y)), fill: renk, class: 'sg-cubuk', rx: 2 });
      r.appendChild(e('title', {}, n.etiket ?? `${kisaTarih(n.x)}: ${sayiYaz(n.y, o)}`));
      svg.appendChild(r);
    });
  } else {
    const yol = noktalar.map((n, i) => `${i ? 'L' : 'M'}${px(n.x).toFixed(1)} ${py(n.y).toFixed(1)}`).join(' ');
    if (noktalar.length > 1) {
      svg.appendChild(e('path', { d: `${yol} L${px(noktalar[noktalar.length - 1]!.x).toFixed(1)} ${Y - ALT} L${px(noktalar[0]!.x).toFixed(1)} ${Y - ALT} Z`, fill: renk, class: 'sg-dolgu' }));
      svg.appendChild(e('path', { d: yol, stroke: renk, class: 'sg-cizgi' }));
    }
    if (a.noktaGoster !== false && noktalar.length <= 60) {
      noktalar.forEach(n => {
        const c = e('circle', { cx: px(n.x), cy: py(n.y), r: n.disarida ? 4.5 : 3.5, class: 'sg-nokta' + (n.disarida ? ' disarida' : ''), fill: n.disarida ? 'var(--red)' : renk });
        c.appendChild(e('title', {}, n.etiket ?? `${kisaTarih(n.x)}: ${sayiYaz(n.y, o)}`));
        svg.appendChild(c);
      });
    }
  }
  // tarih ekseni
  const etiketler = noktalar.length === 1 ? [noktalar[0]!] : [noktalar[0]!, noktalar[Math.floor((noktalar.length - 1) / 2)]!, noktalar[noktalar.length - 1]!];
  etiketler.forEach((n, i) => svg.appendChild(e('text', { x: px(n.x), y: Y - 6, 'text-anchor': noktalar.length === 1 ? 'middle' : i === 0 ? 'start' : i === etiketler.length - 1 ? 'end' : 'middle', class: 'sg-eksen' }, kisaTarih(n.x) + (n.x.slice(0, 4) !== new Date().getFullYear().toString() ? '.' + n.x.slice(2, 4) : ''))));
  return svg;
}

/** Yalnız çizgi: kartların içinde küçük eğilim göstermek için. */
export function minikCiz(noktalar: Nokta[], renk = 'var(--cyan)'): SVGSVGElement {
  const G = 120, Y = 32;
  const svg = e('svg', { viewBox: `0 0 ${G} ${Y}`, class: 'sg-minik', 'aria-hidden': 'true' }) as SVGSVGElement;
  if (noktalar.length < 2) return svg;
  const lo = Math.min(...noktalar.map(n => n.y)), hi = Math.max(...noktalar.map(n => n.y));
  const x0 = gunNo(noktalar[0]!.x), x1 = gunNo(noktalar[noktalar.length - 1]!.x);
  const px = (s: string) => 2 + ((gunNo(s) - x0) / Math.max(1, x1 - x0)) * (G - 4);
  const py = (v: number) => (hi === lo ? Y / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (Y - 6));
  svg.appendChild(e('path', { d: noktalar.map((n, i) => `${i ? 'L' : 'M'}${px(n.x).toFixed(1)} ${py(n.y).toFixed(1)}`).join(' '), stroke: renk, class: 'sg-cizgi', 'stroke-width': 1.6 }));
  const son = noktalar[noktalar.length - 1]!;
  svg.appendChild(e('circle', { cx: px(son.x), cy: py(son.y), r: 2.4, fill: renk }));
  return svg;
}
