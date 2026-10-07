/* Dosya Yöneticisi — belge önizleyicileri (Markdown, DOCX, PPTX, HTML sunum).
 *
 * Dış kütüphane yok: DOCX/PPTX birer ZIP; merkez dizin burada okunur,
 * sıkıştırılmış girdiler tarayıcının DecompressionStream('deflate-raw')
 * akışıyla açılır. Belgeler hiçbir yere gönderilmez — her şey bu sekmede.
 *
 * Güvenlik: üretilen HTML yalnız kaçışlanmış metinden ve bu modülün kendi
 * etiketlerinden kurulur; belgedeki bağlantılardan yalnız http(s)/mailto
 * adresleri tıklanabilir kalır, görseller data: adresiyle gömülür. */

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const guvenliAdres = u => /^(https?:|mailto:)/i.test(String(u || '').trim()) ? String(u).trim() : '';

/* ---------- ZIP ---------- */
export async function zipAc(buf){
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let eocd = -1;
  for(let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--){
    if(v.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('Dosya bir ZIP/Office belgesi değil ya da bozuk.');
  const adet = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const girdi = new Map();
  const cozucu = new TextDecoder();
  for(let i = 0; i < adet; i++){
    if(v.getUint32(p, true) !== 0x02014b50) break;
    const yontem = v.getUint16(p + 10, true);
    const sikisik = v.getUint32(p + 20, true);
    const adUz = v.getUint16(p + 28, true), ekUz = v.getUint16(p + 30, true), notUz = v.getUint16(p + 32, true);
    const yerel = v.getUint32(p + 42, true);
    const ad = cozucu.decode(u8.subarray(p + 46, p + 46 + adUz));
    girdi.set(ad, {yontem, sikisik, yerel});
    p += 46 + adUz + ekUz + notUz;
  }
  async function bayt(ad){
    const g = girdi.get(ad.replace(/^\//, ''));
    if(!g) return null;
    const bas = g.yerel + 30 + v.getUint16(g.yerel + 26, true) + v.getUint16(g.yerel + 28, true);
    const ham = u8.subarray(bas, bas + g.sikisik);
    if(g.yontem === 0) return ham;
    if(g.yontem !== 8) throw new Error('Desteklenmeyen sıkıştırma: ' + g.yontem);
    const akis = new Blob([ham]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(akis).arrayBuffer());
  }
  return {
    adlar: () => [...girdi.keys()],
    var: ad => girdi.has(ad.replace(/^\//, '')),
    bayt,
    metin: async ad => { const b = await bayt(ad); return b ? new TextDecoder().decode(b) : null; },
    xml: async ad => { const b = await bayt(ad); return b ? new DOMParser().parseFromString(new TextDecoder().decode(b), 'application/xml') : null; },
  };
}

const MIME = {png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', emf: '', wmf: ''};
const uzantisi = ad => (String(ad).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
function dataURL(bayt, mime){
  let s = '';
  for(let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode.apply(null, bayt.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(s)}`;
}
/* "word/document.xml" + "media/a.png" → "word/media/a.png"; "../media/x" çözülür. */
function yolBirlestir(taban, hedef){
  if(hedef.startsWith('/')) return hedef.slice(1);
  const p = taban.split('/').slice(0, -1);
  for(const s of hedef.split('/')){ if(s === '..') p.pop(); else if(s && s !== '.') p.push(s); }
  return p.join('/');
}
async function iliskiler(zip, parca){
  const i = parca.lastIndexOf('/');
  const x = await zip.xml(parca.slice(0, i + 1) + '_rels/' + parca.slice(i + 1) + '.rels');
  const m = new Map();
  if(!x) return m;
  for(const r of x.getElementsByTagName('Relationship')){
    const harici = r.getAttribute('TargetMode') === 'External';
    const hedef = r.getAttribute('Target') || '';
    m.set(r.getAttribute('Id'), {tur: (r.getAttribute('Type') || '').split('/').pop(), hedef: harici ? hedef : yolBirlestir(parca, hedef), harici});
  }
  return m;
}
async function gorselGom(zip, yol){
  const mime = MIME[uzantisi(yol)];
  if(!mime) return '';
  const b = await zip.bayt(yol);
  return b ? dataURL(b, mime) : '';
}

/* XML yardımcıları — önek yerine yerel ad (w:p → p). */
const cocuklar = (el, ad) => el ? [...el.children].filter(c => !ad || c.localName === ad) : [];
const cocuk = (el, ad) => el ? [...el.children].find(c => c.localName === ad) || null : null;
const torunlar = (el, ad) => el ? [...el.getElementsByTagName('*')].filter(c => c.localName === ad) : [];
const nit = (el, ad) => {
  if(!el) return null;
  for(const a of el.attributes) if(a.localName === ad) return a.value;
  return null;
};

/* ---------- Markdown ---------- */
function satirIci(t){
  const kod = [];
  let s = esc(t).replace(/`([^`]+)`/g, (_, k) => { kod.push(k); return `\u0000${kod.length - 1}\u0000`; });
  const ADR = '((?:[^()\\s]|\\([^()\\s]*\\))+)(?:\\s+&quot;[^&]*&quot;)?\\)';
  s = s.replace(new RegExp('!\\[([^\\]]*)\\]\\(' + ADR, 'g'), (_, a, u) => {
    const g = guvenliAdres(u.replace(/&amp;/g, '&'));
    return g ? `<img alt="${a}" src="${esc(g)}" loading="lazy">` : `<span class="md-gorsel" title="${u}">🖼 ${a || u}</span>`;
  });
  s = s.replace(new RegExp('\\[([^\\]]+)\\]\\(' + ADR, 'g'), (_, m, u) => {
    const g = guvenliAdres(u.replace(/&amp;/g, '&'));
    return g ? `<a href="${esc(g)}" target="_blank" rel="noopener noreferrer">${m}</a>` : `<span class="md-bag" title="${u}">${m}</span>`;
  });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, o, u) => `${o}<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${kod[+i]}</code>`);
}
const tabloHucre = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'));

export function markdown(metin){
  const s = String(metin || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  const cik = [];
  let i = 0;
  /* YAML ön bilgisi (--- ... ---) tablo olarak */
  if(s[0] === '---'){
    const son = s.indexOf('---', 1);
    if(son > 0){
      const satir = s.slice(1, son).filter(x => /^[\w-]+\s*:/.test(x));
      if(satir.length) cik.push(`<table class="md-on"><tbody>${satir.map(x => { const k = x.indexOf(':'); return `<tr><th>${esc(x.slice(0, k))}</th><td>${satirIci(x.slice(k + 1).trim())}</td></tr>`; }).join('')}</tbody></table>`);
      i = son + 1;
    }
  }
  const listeBas = x => x.match(/^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/);
  while(i < s.length){
    const l = s[i];
    if(!l.trim()){ i++; continue; }
    let m;
    if((m = l.match(/^\s*(```|~~~)\s*([\w+-]*)/))){
      const son = m[1], kod = [];
      i++;
      while(i < s.length && !s[i].trim().startsWith(son)) kod.push(s[i++]);
      i++;
      cik.push(`<pre class="md-kod"${m[2] ? ` data-dil="${esc(m[2])}"` : ''}><code>${esc(kod.join('\n'))}</code></pre>`);
      continue;
    }
    if((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))){
      const n = m[1].length;
      cik.push(`<h${n}>${satirIci(m[2])}</h${n}>`);
      i++; continue;
    }
    if(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)){ cik.push('<hr>'); i++; continue; }
    if(/^\s*>/.test(l)){
      const q = [];
      while(i < s.length && /^\s*>/.test(s[i])) q.push(s[i++].replace(/^\s*>\s?/, ''));
      cik.push(`<blockquote>${markdown(q.join('\n'))}</blockquote>`);
      continue;
    }
    if(l.includes('|') && i + 1 < s.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s[i + 1])){
      const bas = tabloHucre(l);
      const hiza = tabloHucre(s[i + 1]).map(h => /^:-+:$/.test(h) ? 'center' : /-:$/.test(h) ? 'right' : '');
      i += 2;
      const govde = [];
      while(i < s.length && s[i].includes('|') && s[i].trim()) govde.push(tabloHucre(s[i++]));
      const st = k => hiza[k] ? ` style="text-align:${hiza[k]}"` : '';
      cik.push(`<div class="md-tablo"><table><thead><tr>${bas.map((h, k) => `<th${st(k)}>${satirIci(h)}</th>`).join('')}</tr></thead><tbody>${govde.map(r => `<tr>${bas.map((_, k) => `<td${st(k)}>${satirIci(r[k] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if(listeBas(l)){
      /* Girintiye göre iç içe liste: yığın [{girinti, etiket}] */
      const yigin = [];
      let html = '';
      while(i < s.length){
        const x = s[i];
        const lm = listeBas(x);
        if(!lm){
          if(!x.trim()){
            const sonraki = s.slice(i + 1).find(y => y.trim());
            if(sonraki && listeBas(sonraki)){ i++; continue; }
            break;
          }
          if(/^\s{2,}\S/.test(x) && yigin.length){ html = html.replace(/<\/li>$/, '') + ' ' + satirIci(x.trim()) + '</li>'; i++; continue; }
          break;
        }
        const girinti = lm[1].replace(/\t/g, '    ').length;
        const etiket = /\d/.test(lm[2]) ? 'ol' : 'ul';
        while(yigin.length && girinti < yigin[yigin.length - 1].girinti){ const y = yigin.pop(); html += `</${y.etiket}>` + (y.ic ? '</li>' : ''); }
        if(yigin.length && girinti === yigin[yigin.length - 1].girinti && yigin[yigin.length - 1].etiket !== etiket){ const y = yigin.pop(); html += `</${y.etiket}>` + (y.ic ? '</li>' : ''); }
        if(!yigin.length || girinti > yigin[yigin.length - 1].girinti){
          const bas = etiket === 'ol' && parseInt(lm[2], 10) !== 1 ? ` start="${parseInt(lm[2], 10)}"` : '';
          if(yigin.length) html = html.replace(/<\/li>$/, '');
          html += `<${etiket}${bas}>`;
          yigin.push({girinti, etiket, ic: yigin.length > 0});
        }
        let ic = lm[3];
        const kutu = ic.match(/^\[([ xX])\]\s+(.*)$/);
        if(kutu) ic = `<span class="md-kutu${kutu[1] === ' ' ? '' : ' tamam'}">${kutu[1] === ' ' ? '☐' : '☑'}</span> ${satirIci(kutu[2])}`;
        else ic = satirIci(ic);
        html += `<li${kutu ? ' class="md-gorev"' : ''}>${ic}</li>`;
        i++;
      }
      while(yigin.length){ const y = yigin.pop(); html += `</${y.etiket}>` + (y.ic ? '</li>' : ''); }
      cik.push(html);
      continue;
    }
    const p = [];
    while(i < s.length && s[i].trim() && !/^(#{1,6}\s|```|~~~|\s*>)/.test(s[i]) && !listeBas(s[i])
      && !(s[i].includes('|') && i + 1 < s.length && /^\s*\|?\s*:?-{2,}/.test(s[i + 1]))
      && !/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(s[i])){
      p.push(satirIci(s[i].trim()) + (/ {2}$|\\$/.test(s[i]) ? '<br>' : ''));
      i++;
    }
    if(p.length) cik.push(`<p>${p.join(' ').replace(/\\<br>/g, '<br>')}</p>`);
    else i++;
  }
  return cik.join('\n');
}

/* ---------- DOCX ---------- */
export async function docx(buf){
  const zip = await zipAc(buf);
  const ana = 'word/document.xml';
  const x = await zip.xml(ana);
  if(!x) throw new Error('word/document.xml bulunamadı — geçerli bir DOCX değil.');
  const rel = await iliskiler(zip, ana);

  /* Stil adları: stil kimliği → {ad, seviye}. Türkçe Word "Başlık 1" kimliğini "Balk1" yazar. */
  const stil = new Map();
  const sx = await zip.xml('word/styles.xml');
  for(const st of torunlar(sx, 'style')){
    const id = nit(st, 'styleId');
    const ad = nit(cocuk(st, 'name'), 'val') || '';
    const ol = nit(torunlar(st, 'outlineLvl')[0], 'val');
    let seviye = null;
    const m = ad.match(/^(heading|başlık|baslik)\s*(\d)/i);
    if(m) seviye = +m[2];
    else if(ol != null && +ol < 6) seviye = +ol + 1;
    if(/^(title|konu başlığı|başlık)$/i.test(ad)) seviye = 1;
    stil.set(id, {ad, seviye, kod: /code|kod|html preformatted/i.test(ad), alinti: /quote|alıntı/i.test(ad)});
  }
  /* Numaralandırma: numId → ilvl → biçim */
  const num = new Map();
  const nx = await zip.xml('word/numbering.xml');
  if(nx){
    const soyut = new Map();
    for(const a of torunlar(nx, 'abstractNum')){
      const d = new Map();
      for(const lv of cocuklar(a, 'lvl')) d.set(+nit(lv, 'ilvl'), {bicim: nit(cocuk(lv, 'numFmt'), 'val') || 'bullet', metin: nit(cocuk(lv, 'lvlText'), 'val') || '', bas: +(nit(cocuk(lv, 'start'), 'val') || 1)});
      soyut.set(nit(a, 'abstractNumId'), d);
    }
    for(const n of cocuklar(nx.documentElement, 'num')) num.set(nit(n, 'numId'), soyut.get(nit(cocuk(n, 'abstractNumId'), 'val')) || new Map());
  }
  const sayac = new Map();
  const romen = n => { const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for(const [v, h] of t) while(n >= v){ s += h; n -= v; } return s; };
  const harf = n => { let s = ''; while(n > 0){ n--; s = String.fromCharCode(97 + n % 26) + s; n = Math.floor(n / 26); } return s; };
  function isaret(numId, ilvl){
    const d = num.get(numId);
    const lv = d && d.get(ilvl) || {bicim: 'bullet', metin: '•', bas: 1};
    if(lv.bicim === 'bullet' || lv.bicim === 'none') return lv.bicim === 'none' ? '' : (/[]/.test(lv.metin) || !lv.metin ? '•' : lv.metin.replace(/[-]/g, '•'));
    const s = sayac.get(numId) || [];
    s[ilvl] = (s[ilvl] || lv.bas - 1) + 1;
    s.length = ilvl + 1;
    sayac.set(numId, s);
    return lv.metin.replace(/%(\d)/g, (_, k) => {
      const l = +k - 1, deger = s[l] || 1, b = (d && d.get(l) || {}).bicim;
      return b === 'lowerLetter' ? harf(deger) : b === 'upperLetter' ? harf(deger).toUpperCase() : b === 'lowerRoman' ? romen(deger).toLowerCase() : b === 'upperRoman' ? romen(deger) : String(deger);
    });
  }

  async function kosu(r){
    const pr = cocuk(r, 'rPr');
    const acik = ad => { const e = cocuk(pr, ad); return e && !/^(0|false|none)$/.test(nit(e, 'val') || ''); };
    let ic = '';
    for(const c of r.children){
      const n = c.localName;
      if(n === 't') ic += esc(c.textContent);
      else if(n === 'tab') ic += '<span class="dx-tab"></span>';
      else if(n === 'br') ic += nit(c, 'type') === 'page' ? '<hr class="dx-sayfa">' : '<br>';
      else if(n === 'noBreakHyphen') ic += '‑';
      else if(n === 'sym') ic += '•';
      else if(n === 'drawing' || n === 'pict'){
        for(const b of [...torunlar(c, 'blip'), ...torunlar(c, 'imagedata')]){
          const id = nit(b, 'embed') || nit(b, 'id');
          const r2 = rel.get(id);
          if(r2 && !r2.harici){
            const u = await gorselGom(zip, r2.hedef);
            ic += u ? `<img src="${u}" alt="">` : '<span class="dx-yok">[görsel]</span>';
          }
        }
      }
    }
    if(!ic) return '';
    if(acik('b')) ic = `<strong>${ic}</strong>`;
    if(acik('i')) ic = `<em>${ic}</em>`;
    if(acik('u')) ic = `<u>${ic}</u>`;
    if(acik('strike') || acik('dstrike')) ic = `<del>${ic}</del>`;
    const dik = nit(cocuk(pr, 'vertAlign'), 'val');
    if(dik === 'superscript') ic = `<sup>${ic}</sup>`;
    if(dik === 'subscript') ic = `<sub>${ic}</sub>`;
    const vurgu = nit(cocuk(pr, 'highlight'), 'val');
    if(vurgu && vurgu !== 'none') ic = `<mark>${ic}</mark>`;
    const renk = nit(cocuk(pr, 'color'), 'val');
    if(renk && /^[0-9a-f]{6}$/i.test(renk) && !/^(000000|auto)$/i.test(renk)) ic = `<span style="color:#${renk}">${ic}</span>`;
    return ic;
  }
  async function satirIciler(el){
    let s = '';
    for(const c of el.children){
      const n = c.localName;
      if(n === 'r') s += await kosu(c);
      else if(n === 'hyperlink'){
        const r2 = rel.get(nit(c, 'id'));
        const u = guvenliAdres(r2 && r2.harici ? r2.hedef : '');
        const ic = await satirIciler(c);
        s += u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic}</a>` : ic;
      }else if(n === 'ins' || n === 'smartTag' || n === 'fldSimple' || n === 'customXml' || n === 'sdt') s += await satirIciler(n === 'sdt' ? cocuk(c, 'sdtContent') || c : c);
    }
    return s;
  }
  async function paragraf(p){
    const pr = cocuk(p, 'pPr');
    const st = stil.get(nit(cocuk(pr, 'pStyle'), 'val')) || {};
    const ic = await satirIciler(p);
    const hiza = {center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify'}[nit(cocuk(pr, 'jc'), 'val')];
    const stl = hiza ? ` style="text-align:${hiza}"` : '';
    const np = cocuk(pr, 'numPr');
    const numId = nit(cocuk(np, 'numId'), 'val');
    if(np && numId && numId !== '0' && !st.seviye){
      const ilvl = +(nit(cocuk(np, 'ilvl'), 'val') || 0);
      return `<p class="dx-li" style="--l:${ilvl}${hiza ? ';text-align:' + hiza : ''}"><span class="dx-isaret">${esc(isaret(numId, ilvl))}</span>${ic || '&nbsp;'}</p>`;
    }
    if(st.seviye) return ic ? `<h${Math.min(st.seviye, 6)}${stl}>${ic}</h${Math.min(st.seviye, 6)}>` : '';
    if(st.alinti) return `<blockquote${stl}>${ic}</blockquote>`;
    if(st.kod) return `<pre class="md-kod">${ic}</pre>`;
    return ic ? `<p${stl}>${ic}</p>` : '<p class="dx-bos">&nbsp;</p>';
  }
  async function tablo(t){
    const satirlar = cocuklar(t, 'tr');
    let h = '<div class="md-tablo"><table class="dx-tablo"><tbody>';
    for(const tr of satirlar){
      h += '<tr>';
      for(const tc of cocuklar(tr, 'tc')){
        const pr = cocuk(tc, 'tcPr');
        const vm = cocuk(pr, 'vMerge');
        const devam = vm && (nit(vm, 'val') || 'continue') === 'continue';
        const span = +(nit(cocuk(pr, 'gridSpan'), 'val') || 1);
        const golge = nit(cocuk(pr, 'shd'), 'fill');
        const arka = golge && /^[0-9a-f]{6}$/i.test(golge) && !/^(auto|FFFFFF)$/i.test(golge) ? ` style="background:#${golge}"` : '';
        h += `<td${span > 1 ? ` colspan="${span}"` : ''}${devam ? ' class="dx-birlesik"' : ''}${arka}>${devam ? '' : await govde(tc)}</td>`;
      }
      h += '</tr>';
    }
    return h + '</tbody></table></div>';
  }
  async function govde(el){
    let s = '';
    for(const c of el.children){
      const n = c.localName;
      if(n === 'p') s += await paragraf(c);
      else if(n === 'tbl') s += await tablo(c);
      else if(n === 'sdt') s += await govde(cocuk(c, 'sdtContent') || c);
      else if(n === 'customXml' || n === 'ins') s += await govde(c);
    }
    return s;
  }
  const body = torunlar(x, 'body')[0];
  let html = await govde(body);
  /* Dipnotlar */
  const dn = await zip.xml('word/footnotes.xml');
  if(dn){
    const notlar = [];
    for(const f of cocuklar(dn.documentElement, 'footnote')){
      if(+nit(f, 'id') <= 0) continue;
      const m = await govde(f);
      if(m.replace(/<[^>]+>|&nbsp;/g, '').trim()) notlar.push(m);
    }
    if(notlar.length) html += `<section class="dx-dipnot"><h4>Dipnotlar</h4><ol>${notlar.map(n => `<li>${n}</li>`).join('')}</ol></section>`;
  }
  return html.replace(/(<p class="dx-bos">&nbsp;<\/p>\s*){2,}/g, '<p class="dx-bos">&nbsp;</p>');
}

/* ---------- PPTX ---------- */
const EMU = 12700;   // 1 pt
export async function pptx(buf){
  const zip = await zipAc(buf);
  const sunum = 'ppt/presentation.xml';
  const px = await zip.xml(sunum);
  if(!px) throw new Error('ppt/presentation.xml bulunamadı — geçerli bir PPTX değil.');
  const prel = await iliskiler(zip, sunum);
  const boy = torunlar(px, 'sldSz')[0];
  const G = +(nit(boy, 'cx') || 12192000), Y = +(nit(boy, 'cy') || 6858000);
  const sirali = torunlar(px, 'sldId').map(s => prel.get(nit(s, 'id'))).filter(r => r && r.tur === 'slide').map(r => r.hedef);
  const slaytlar = sirali.length ? sirali : zip.adlar().filter(a => /^ppt\/slides\/slide\d+\.xml$/.test(a)).sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));

  /* Yer tutucu konumu yerleşim ya da ana slayttan kalıtılır. */
  const yerlesimOnbellek = new Map();
  async function yerTutucular(parca){
    if(yerlesimOnbellek.has(parca)) return yerlesimOnbellek.get(parca);
    const x = await zip.xml(parca);
    const m = new Map();
    for(const sp of torunlar(x, 'sp')){
      const ph = torunlar(sp, 'ph')[0];
      const xf = torunlar(cocuk(sp, 'spPr'), 'xfrm')[0];
      if(!ph || !xf) continue;
      const k = konum(xf);
      m.set('t:' + (nit(ph, 'type') || 'body'), m.get('t:' + (nit(ph, 'type') || 'body')) || k);
      if(nit(ph, 'idx')) m.set('i:' + nit(ph, 'idx'), k);
    }
    const r = await iliskiler(zip, parca);
    const ust = [...r.values()].find(v => v.tur === 'slideLayout' || v.tur === 'slideMaster');
    const sonuc = {m, ust: ust ? ust.hedef : null};
    yerlesimOnbellek.set(parca, sonuc);
    return sonuc;
  }
  function konum(xf){
    const off = cocuk(xf, 'off'), ext = cocuk(xf, 'ext');
    return {x: +(nit(off, 'x') || 0), y: +(nit(off, 'y') || 0), w: +(nit(ext, 'cx') || 0), h: +(nit(ext, 'cy') || 0)};
  }
  async function kalitimKonum(ph, ilkParca){
    const tur = nit(ph, 'type') || 'body', idx = nit(ph, 'idx');
    let parca = ilkParca;
    for(let d = 0; parca && d < 3; d++){
      const {m, ust} = await yerTutucular(parca);
      const k = (idx && m.get('i:' + idx)) || m.get('t:' + tur) || (tur === 'ctrTitle' && m.get('t:title')) || (tur === 'subTitle' && m.get('t:body'));
      if(k) return k;
      parca = ust;
    }
    return null;
  }
  const renk = el => {
    const s = el && torunlar(el, 'srgbClr')[0];
    const v = s && nit(s, 'val');
    return v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v : null;
  };

  const cikti = [];
  for(let no = 0; no < slaytlar.length; no++){
    const parca = slaytlar[no];
    const x = await zip.xml(parca);
    if(!x) continue;
    const rel = await iliskiler(zip, parca);
    const yerlesim = [...rel.values()].find(v => v.tur === 'slideLayout');
    const oge = [];
    let baslik = '';
    const cs = torunlar(x, 'cSld')[0];
    const bg = renk(cocuk(cs, 'bg'));

    async function metinGovde(tx, ph){
      let h = '';
      for(const p of cocuklar(tx, 'p')){
        const ppr = cocuk(p, 'pPr');
        const lvl = +(nit(ppr, 'lvl') || 0);
        const hiza = {ctr: 'center', r: 'right', just: 'justify'}[nit(ppr, 'algn')];
        const madde = cocuk(ppr, 'buChar') ? (nit(cocuk(ppr, 'buChar'), 'char') || '•') : cocuk(ppr, 'buAutoNum') ? '•' : '';
        const bulletYok = !!cocuk(ppr, 'buNone');
        let ic = '';
        for(const r of p.children){
          if(r.localName === 'br'){ ic += '<br>'; continue; }
          if(r.localName !== 'r' && r.localName !== 'fld') continue;
          const rpr = cocuk(r, 'rPr');
          let t = esc(cocuk(r, 't') ? cocuk(r, 't').textContent : '');
          if(!t) continue;
          if(nit(rpr, 'b') === '1') t = `<strong>${t}</strong>`;
          if(nit(rpr, 'i') === '1') t = `<em>${t}</em>`;
          if(nit(rpr, 'u') && nit(rpr, 'u') !== 'none') t = `<u>${t}</u>`;
          const st = [];
          const sz = +(nit(rpr, 'sz') || 0);
          if(sz) st.push(`font-size:${(sz / 100 / (G / EMU) * 100).toFixed(3)}cqw`);
          const c = renk(cocuk(rpr, 'solidFill'));
          if(c) st.push('color:' + c);
          ic += st.length ? `<span style="${st.join(';')}">${t}</span>` : t;
        }
        if(!ic){ h += '<p class="px-bos">&nbsp;</p>'; continue; }
        const govdeMi = !ph || /body|obj/.test(nit(ph, 'type') || 'body') && nit(ph, 'type') !== 'title';
        const isaret = madde || (govdeMi && ph && !bulletYok && !/title|ctrTitle|subTitle/.test(nit(ph, 'type') || '') ? '•' : '');
        h += `<p style="--l:${lvl}${hiza ? ';text-align:' + hiza : ''}">${isaret && !bulletYok ? `<span class="px-madde">${esc(isaret)}</span>` : ''}${ic}</p>`;
      }
      return h;
    }
    /* Grup dönüşümü: çocuk koordinatları grubun çocuk uzayından slayta */
    async function agac(el, donustur){
      for(const c of el.children){
        const n = c.localName;
        if(n === 'grpSp'){
          const xf = torunlar(cocuk(c, 'grpSpPr'), 'xfrm')[0];
          if(!xf){ await agac(c, donustur); continue; }
          const k = konum(xf);
          const co = cocuk(xf, 'chOff'), ce = cocuk(xf, 'chExt');
          const cx = +(nit(co, 'x') || 0), cy = +(nit(co, 'y') || 0), cw = +(nit(ce, 'cx') || k.w) || 1, ch = +(nit(ce, 'cy') || k.h) || 1;
          await agac(c, p => donustur({x: k.x + (p.x - cx) * k.w / cw, y: k.y + (p.y - cy) * k.h / ch, w: p.w * k.w / cw, h: p.h * k.h / ch}));
          continue;
        }
        if(n === 'sp'){
          const ph = torunlar(cocuk(c, 'nvSpPr'), 'ph')[0];
          const xf = torunlar(cocuk(c, 'spPr'), 'xfrm')[0];
          let k = xf ? konum(xf) : ph ? await kalitimKonum(ph, yerlesim && yerlesim.hedef) : null;
          const tx = cocuk(c, 'txBody');
          const metin = tx ? await metinGovde(tx, ph) : '';
          const dolgu = renk(cocuk(cocuk(c, 'spPr'), 'solidFill'));
          if(!metin.replace(/<[^>]+>|&nbsp;/g, '').trim() && !dolgu) continue;
          const tur = ph ? nit(ph, 'type') || 'body' : '';
          if(/title|ctrTitle/.test(tur) && !baslik) baslik = (tx ? tx.textContent : '').trim();
          if(!k) k = /title|ctrTitle/.test(tur) ? {x: G * .06, y: Y * .05, w: G * .88, h: Y * .16} : {x: G * .06, y: Y * .24, w: G * .88, h: Y * .68};
          oge.push({k: donustur(k), html: metin, sinif: /title|ctrTitle/.test(tur) ? 'px-baslik' : tur === 'subTitle' ? 'px-alt' : '', dolgu,
            dikey: {ctr: 'center', b: 'flex-end'}[nit(cocuk(tx, 'bodyPr'), 'anchor')] || (/ctrTitle|subTitle/.test(tur) ? 'center' : '')});
          continue;
        }
        if(n === 'pic'){
          const xf = torunlar(cocuk(c, 'spPr'), 'xfrm')[0];
          const b = torunlar(c, 'blip')[0];
          const r = b && rel.get(nit(b, 'embed'));
          if(!xf || !r || r.harici) continue;
          const u = await gorselGom(zip, r.hedef);
          if(u) oge.push({k: donustur(konum(xf)), html: `<img src="${u}" alt="">`, sinif: 'px-gorsel'});
          continue;
        }
        if(n === 'graphicFrame'){
          const xf = cocuk(c, 'xfrm');
          const tbl = torunlar(c, 'tbl')[0];
          if(!xf || !tbl) continue;
          const satir = cocuklar(tbl, 'tr').map(tr => `<tr>${cocuklar(tr, 'tc').filter(tc => nit(tc, 'hMerge') !== '1' && nit(tc, 'vMerge') !== '1').map(tc => {
            const span = +(nit(tc, 'gridSpan') || 1);
            return `<td${span > 1 ? ` colspan="${span}"` : ''}>${esc(torunlar(tc, 't').map(t => t.textContent).join(' '))}</td>`;
          }).join('')}</tr>`).join('');
          oge.push({k: donustur(konum(xf)), html: `<table>${satir}</table>`, sinif: 'px-tablo'});
        }
      }
    }
    await agac(torunlar(cs, 'spTree')[0] || cs, k => k);

    /* Konuşmacı notu */
    let not = '';
    const nr = [...rel.values()].find(v => v.tur === 'notesSlide');
    if(nr){
      const nx = await zip.xml(nr.hedef);
      for(const sp of torunlar(nx, 'sp')){
        const ph = torunlar(sp, 'ph')[0];
        if(ph && nit(ph, 'type') === 'body') not += cocuklar(cocuk(sp, 'txBody'), 'p').map(p => esc(torunlar(p, 't').map(t => t.textContent).join(''))).filter(Boolean).map(t => `<p>${t}</p>`).join('');
      }
    }
    const yuzde = (a, b) => (a / b * 100).toFixed(3) + '%';
    const html = oge.map(o => `<div class="px-oge ${o.sinif}" style="left:${yuzde(o.k.x, G)};top:${yuzde(o.k.y, Y)};width:${yuzde(o.k.w, G)};height:${yuzde(o.k.h, Y)}${o.dolgu ? ';background:' + o.dolgu : ''}${o.dikey ? ';justify-content:' + o.dikey : ''}">${o.html}</div>`).join('');
    cikti.push({no: no + 1, baslik, html, not, bg});
  }
  return {oran: G / Y, slaytlar: cikti};
}

/* ---------- HTML sunum: göreli kaynakları aynı klasörden gömme ----------
   cozucu(yol) → {tur:'metin'|'veri', deger} ya da null. Çerçeve opak kökende
   çalıştığı için blob: adresleri kullanılamaz; görseller data: olarak,
   stil ve betikler satır içi olarak gömülür. */
export async function htmlGom(html, cozucu, sinir = 25 * 1048576){
  const d = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const goreli = u => !!u && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(String(u).trim());
  const temiz = yol => { try{ return decodeURIComponent(String(yol).trim().split(/[?#]/)[0]); }catch(e){ return String(yol).trim().split(/[?#]/)[0]; } };
  /* Göreli yol, onu anan dosyanın klasörüne göre çözülür ("assets/a.css" +
     "../img/b.png" → "img/b.png"); HTML'in kendisi kökte ("sayfa.html"). */
  const coz = (taban, hedef) => {
    /* Baştaki ".." korunur: HTML bir alt klasördeyse üst klasöre çıkabilir. */
    const p = taban.split('/').slice(0, -1);
    for(const k of temiz(hedef).split('/')){
      if(k === '..'){ if(p.length && p[p.length - 1] !== '..') p.pop(); else p.push('..'); }
      else if(k && k !== '.') p.push(k);
    }
    return p.join('/');
  };
  let toplam = 0, gomulen = 0, eksik = 0;
  const onbellek = new Map();
  const al = async (yol, tur) => {
    const k = tur + ':' + yol;
    if(onbellek.has(k)) return onbellek.get(k);
    let r = null;
    if(toplam <= sinir){
      try{ r = await cozucu(yol, tur); }catch(e){ r = null; }
      if(r){ toplam += r.boyut || 0; gomulen++; } else eksik++;
    }
    onbellek.set(k, r);
    return r;
  };
  const b64 = t => { const u8 = new TextEncoder().encode(t); let s = ''; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  /* CSS: url(...) ve @import aynı klasörden gömülür (yazı tipi, arka plan). */
  async function cssGom(css, taban, derinlik = 0){
    let t = String(css || '');
    if(derinlik < 4){
      const ic = [];
      t = t.replace(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?\s*([^;]*);/gi, (m, u, medya) => { if(!goreli(u)) return m; ic.push([m, coz(taban, u), medya]); return m; });
      for(const [m, yol, medya] of ic){
        const r = await al(yol, 'metin');
        if(r){ const g = await cssGom(r.deger, yol, derinlik + 1); t = t.replace(m, medya && medya.trim() ? `@media ${medya}{${g}}` : g); }
      }
    }
    const urller = [...new Set([...t.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)].map(m => m[2]).filter(goreli))];
    for(const u of urller){
      const r = await al(coz(taban, u), 'veri');
      if(r) t = t.split(u).join(r.deger);
    }
    return t;
  }
  /* ES modülü: göreli import/export ... from ve import() data: adresine
     çevrilir (özyinelemeli). Çerçeve opak kökende; aynı sunucudan betik
     çekemez, data: modülleri ise çalışır. */
  const modulOnbellek = new Map();
  async function modulGom(kod, taban, derinlik = 0){
    let t = String(kod || '');
    if(derinlik > 8) return t;
    const re = /(\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]*\s*from\s*|\bimport\s*\(\s*)(["'])([^"']+)\2/g;
    const bul = [...t.matchAll(re)].filter(m => /^\.{1,2}\//.test(m[3]) || (goreli(m[3]) && /\.m?js$/i.test(m[3])));
    for(const m of bul){
      const yol = coz(taban, m[3]);
      let adres = modulOnbellek.get(yol);
      if(!adres){
        const r = await al(yol, 'metin');
        if(!r) continue;
        adres = 'data:text/javascript;base64,' + b64(await modulGom(r.deger, yol, derinlik + 1));
        modulOnbellek.set(yol, adres);
      }
      t = t.split(m[0]).join(m[1] + m[2] + adres + m[2]);
    }
    return t;
  }

  const kok = '';
  for(const l of [...d.querySelectorAll('link[rel~="stylesheet"][href]')]){
    if(!goreli(l.getAttribute('href'))) continue;
    const yol = coz(kok, l.getAttribute('href'));
    const r = await al(yol, 'metin');
    if(r){ const st = d.createElement('style'); if(l.media) st.media = l.media; st.textContent = await cssGom(r.deger, yol); l.replaceWith(st); }
  }
  for(const st of [...d.querySelectorAll('style')]) if(/url\(|@import/i.test(st.textContent)) st.textContent = await cssGom(st.textContent, kok);
  for(const el of [...d.querySelectorAll('[style*="url("]')]) el.setAttribute('style', await cssGom(el.getAttribute('style'), kok));
  for(const sc of [...d.querySelectorAll('script')]){
    const modul = (sc.getAttribute('type') || '').toLowerCase() === 'module';
    if(sc.hasAttribute('src')){
      if(!goreli(sc.getAttribute('src'))) continue;
      const yol = coz(kok, sc.getAttribute('src'));
      const r = await al(yol, 'metin');
      if(r){ sc.removeAttribute('src'); sc.textContent = modul ? await modulGom(r.deger, yol) : r.deger; }
    }else if(modul && /\bimport\b|\bfrom\b/.test(sc.textContent)){
      sc.textContent = await modulGom(sc.textContent, kok);
    }
  }
  for(const el of [...d.querySelectorAll('img[src], source[src], video[src], audio[src], video[poster], image[href], input[type="image"][src], link[rel~="icon"][href]')]){
    const at = el.hasAttribute('poster') && !el.hasAttribute('src') ? 'poster' : el.hasAttribute('src') ? 'src' : 'href';
    if(!goreli(el.getAttribute(at))) continue;
    const r = await al(coz(kok, el.getAttribute(at)), 'veri');
    if(r) el.setAttribute(at, r.deger);
  }
  for(const el of [...d.querySelectorAll('img[srcset], source[srcset]')]){
    if(String(el.getAttribute('srcset')).split(',').some(p => goreli(p.trim().split(/\s+/)[0]))) el.removeAttribute('srcset');
  }
  return {html: '<!DOCTYPE html>\n' + d.documentElement.outerHTML, gomulen, eksik};
}

/* ---------- belge sınıflandırma (arşiv / kanonik) ---------- */
export const arsivMi = ad => /(^|[\s_\-.(])(arsiv|arşiv|onceki[-_ ]?surum|önceki[-_ ]?sürüm)([\s_\-.)]|$)/i.test(String(ad));
export const govdeAdi = ad => String(ad).replace(/\.[a-z0-9]+$/i, '').toLocaleLowerCase('tr');
/* Aynı adlı .docx/.md/.pdf üçlüsünden en az ikisi varsa kanonik sayılır. */
export function kanonikKume(liste){
  const say = new Map();
  for(const d of liste){
    if(d.tur === 'klasor') continue;
    const u = uzantisi(d.ad);
    if(!['docx', 'md', 'pdf'].includes(u)) continue;
    const g = govdeAdi(d.ad);
    say.set(g, (say.get(g) || new Set()).add(u));
  }
  return new Set([...say].filter(([, s]) => s.size >= 2).map(([g]) => g));
}
