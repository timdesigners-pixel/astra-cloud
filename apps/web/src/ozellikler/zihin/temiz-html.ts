/* Zengin metin temizleyici: düzenleyicideki biçimli metin HTML parçası olarak saklanır.
   Veri başka cihazdan, yedekten ya da yapıştırılan bir sayfadan gelebilir; çizilmeden ve
   kaydedilmeden önce izin listesinden geçer.
   İzinli: b i u s mark code br span a — öznitelik olarak yalnız a[href] (güvenli şema),
   mark/span[data-renk] (sabit palet) ve anma çipleri için span[data-sayfa] / a[data-anma].
   Diğer etiketler açılır (içindeki metin kalır); script/style/iframe gibileri içeriğiyle atılır. */

const IZINLI = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'MARK', 'CODE', 'BR', 'SPAN', 'A']);
const AT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'LINK', 'META', 'TITLE', 'HEAD', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'VIDEO', 'AUDIO', 'IMG', 'PICTURE', 'SOURCE', 'CANVAS']);
export const VURGU_RENK = ['sari', 'yesil', 'mavi', 'pembe', 'kirmizi', 'mor'];
const KACIS: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => KACIS[c]!);
const BLOK = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'BLOCKQUOTE', 'PRE']);

/* Adres yalnız http(s), mailto ve tel olabilir; aksi halde "#". */
export function guvenliUrl(u: unknown): string {
  const s = String(u ?? '').trim();
  return /^(https?:\/\/\S+|mailto:\S+|tel:\S+)$/i.test(s) ? s : '#';
}

function dugum(d: Node, derinlik: number): string {
  if (derinlik > 20) return '';
  if (d.nodeType === 3) return esc(d.nodeValue);
  if (d.nodeType !== 1) return '';
  const e0 = d as Element;
  const ad = e0.nodeName.toUpperCase();
  if (AT.has(ad)) return '';
  const ic = [...e0.childNodes].map(c => dugum(c, derinlik + 1)).join('');
  if (!IZINLI.has(ad)) return BLOK.has(ad) && ic && !/<br>$/.test(ic) ? ic + '<br>' : ic;
  if (ad === 'BR') return '<br>';
  const e = ad === 'STRONG' ? 'b' : ad === 'EM' ? 'i' : ad === 'STRIKE' ? 's' : ad.toLowerCase();
  if (e === 'a') {
    const href = guvenliUrl(e0.getAttribute('href') || '');
    if (href === '#') return ic;
    const anma = e0.hasAttribute('data-anma') ? ' data-anma="1" class="zm"' : '';
    return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow"${anma}>${ic}</a>`;
  }
  if (e === 'span') {
    const g = e0.getAttribute('data-sayfa');
    if (g && /^[\w-]{1,40}$/.test(g)) return `<span class="zm" data-sayfa="${esc(g)}" contenteditable="false">${ic}</span>`;
    const r = e0.getAttribute('data-renk');
    return r && VURGU_RENK.includes(r) ? `<span data-renk="${r}">${ic}</span>` : ic;
  }
  if (e === 'mark') {
    const r = e0.getAttribute('data-renk');
    return `<mark${r && VURGU_RENK.includes(r) ? ` data-renk="${r}"` : ''}>${ic}</mark>`;
  }
  return ic ? `<${e}>${ic}</${e}>` : '';
}

/** Güvenli HTML parçası döndürür (tarayıcı gerekir). */
export function temizHTML(html: unknown): string {
  const s = String(html ?? '');
  if (!s) return '';
  if (!/[<&]/.test(s)) return esc(s);
  if (typeof DOMParser === 'undefined') return esc(s.replace(/<[^>]*>/g, ''));
  /* DOMParser'la ayrıştırılan belge etkisizdir: betik çalışmaz, görsel yüklenmez. */
  const doc = new DOMParser().parseFromString('<body>' + s + '</body>', 'text/html');
  return [...doc.body.childNodes].map(c => dugum(c, 0)).join('').replace(/(<br>)+$/, '');
}

/** Düz metin (arama ve özet için). */
export function duzMetin(html: unknown): string {
  const s = String(html ?? '');
  if (!/[<&]/.test(s)) return s;
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
