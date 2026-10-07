/* Sözdizimi renklendirme. Dış kütüphane yok: her dil için yorum/dize/anahtar sözcük kuralları
   tek bir birleşik düzenli ifadeyle taranır, çıktı kaçışlanmış span'lerdir. */
import { esc } from './temiz-html';

export const DILLER: Record<string, string> = {
  js: 'JavaScript', ts: 'TypeScript', python: 'Python', html: 'HTML', css: 'CSS', json: 'JSON',
  sql: 'SQL', bash: 'Bash', php: 'PHP', java: 'Java', c: 'C / C++ / C#', go: 'Go', text: 'Düz metin',
};
const KELIME: Record<string, string> = {
  js: 'await async break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield',
  python: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self',
  sql: 'select from where and or not insert into values update set delete create table alter drop index join left right inner outer full on as group by order having limit offset distinct union all case when then else end null is in like between primary key foreign references default exists count sum avg min max',
  bash: 'if then else elif fi for while do done case esac function return in export local echo cd ls rm cp mv mkdir sudo git npm node',
  php: 'abstract and array as break case catch class clone const continue declare default do echo else elseif empty endif extends final finally for foreach function global if implements include instanceof interface isset list namespace new or print private protected public require return static switch throw trait try unset use var while',
  java: 'abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws try void volatile while var record',
  c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class namespace public private protected using new delete template typename virtual override bool string var include define',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
};
KELIME.ts = KELIME.js + ' interface type enum implements private public protected readonly declare namespace abstract as keyof';
const SABIT = /^(true|false|null|undefined|None|True|False|NULL|nil|NaN|Infinity)$/;
const DIZE = [/`(?:\\[\s\S]|[^`\\])*`/, /"(?:\\.|[^"\\\n])*"/, /'(?:\\.|[^'\\\n])*'/];
const C_YORUM = [/\/\/[^\n]*/, /\/\*[\s\S]*?\*\//];
const YORUM: Record<string, RegExp[]> = {
  js: C_YORUM, ts: C_YORUM, java: C_YORUM, c: C_YORUM, go: C_YORUM, php: [/\/\/[^\n]*/, /#[^\n]*/, /\/\*[\s\S]*?\*\//],
  python: [/#[^\n]*/], bash: [/#[^\n]*/], sql: [/--[^\n]*/, /\/\*[\s\S]*?\*\//],
};
const kaynak = (L: RegExp[]) => L.map(r => r.source).join('|');
const span = (s: string, k: string) => `<span class="hl-${k}">${esc(s)}</span>`;

function genel(kod: string, dil: string): string {
  const kel = new Set((KELIME[dil] || '').split(' '));
  const sql = dil === 'sql';
  const dize = dil === 'python' ? [/"""[\s\S]*?"""/, /'''[\s\S]*?'''/, ...DIZE] : DIZE;
  const re = new RegExp(`(${kaynak(YORUM[dil] || []) || '(?!)'})|(${kaynak(dize)})|(\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b|\\b0x[\\da-f]+\\b)|(@[\\w.]+)|([A-Za-z_$][\\w$]*)`, 'gi');
  let o = '', son = 0, m: RegExpExecArray | null;
  while ((m = re.exec(kod))) {
    if (m.index === re.lastIndex) { re.lastIndex++; continue; }
    o += esc(kod.slice(son, m.index)); son = re.lastIndex;
    const [t, yorum, dz, sayi, dek, ad] = m as unknown as string[];
    if (yorum) o += span(t!, 'c');
    else if (dz) o += span(t!, 's');
    else if (sayi) o += span(t!, 'n');
    else if (dek) o += span(t!, 'a');
    else if (ad) {
      if (kel.has(sql ? ad.toLowerCase() : ad)) o += span(t!, 'k');
      else if (SABIT.test(ad)) o += span(t!, 'n');
      else if (/^\s*\(/.test(kod.slice(re.lastIndex))) o += span(t!, 'f');
      else if (/^[A-Z]/.test(ad) && !sql) o += span(t!, 't');
      else o += esc(t);
    }
  }
  return o + esc(kod.slice(son));
}
function html(kod: string): string {
  const re = /(<!--[\s\S]*?-->)|(<\/?)([\w:-]+)|("[^"]*"|'[^']*')|([\w:@.-]+)(?==)|(\/?>)/g;
  let o = '', son = 0, m: RegExpExecArray | null, etiket = false;
  while ((m = re.exec(kod))) {
    o += esc(kod.slice(son, m.index)); son = re.lastIndex;
    if (m[1]) o += span(m[1], 'c');
    else if (m[2]) { o += span(m[2], 'p') + span(m[3]!, 'k'); etiket = true; }
    else if (m[4]) o += etiket ? span(m[4], 's') : esc(m[4]);
    else if (m[5]) o += etiket ? span(m[5], 'a') : esc(m[5]);
    else if (m[6]) { o += span(m[6], 'p'); etiket = false; }
  }
  return o + esc(kod.slice(son));
}
function css(kod: string): string {
  const re = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[\da-f]{3,8}\b)|(-?\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\b)|([\w-]+)(?=\s*:[^;{}]*[;}])|(@[\w-]+)|([.#][\w-]+)/gi;
  let o = '', son = 0, m: RegExpExecArray | null;
  while ((m = re.exec(kod))) {
    o += esc(kod.slice(son, m.index)); son = re.lastIndex;
    o += m[1] ? span(m[0], 'c') : m[2] ? span(m[0], 's') : m[3] || m[4] ? span(m[0], 'n') : m[5] ? span(m[0], 'a') : m[6] ? span(m[0], 'k') : span(m[0], 'f');
  }
  return o + esc(kod.slice(son));
}
function json(kod: string): string {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|\b(true|false|null)\b/g;
  let o = '', son = 0, m: RegExpExecArray | null;
  while ((m = re.exec(kod))) {
    o += esc(kod.slice(son, m.index)); son = re.lastIndex;
    o += m[1] ? (m[2] ? span(m[1], 'a') + esc(m[2]) : span(m[1], 's')) : m[3] ? span(m[0], 'n') : span(m[0], 'k');
  }
  return o + esc(kod.slice(son));
}
export function renklendir(kod: unknown, dil: string): string {
  const k = String(kod ?? '');
  if (k.length > 60000 || dil === 'text' || !DILLER[dil]) return esc(k);
  if (dil === 'html') return html(k);
  if (dil === 'css') return css(k);
  if (dil === 'json') return json(k);
  return genel(k, dil);
}
