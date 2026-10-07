import { ALT_CUBUK, HUBLAR, OBEKLER, kisayolNo, sekmeBul } from './sekmeler';
import { duzMenu, duzMenuYaz, hepsiniAyarla, hubAcik, hubCevir, sekmeMerkeziniAc } from './menu-durum';
import { menuIkon } from './ikonlar';
import { donem, donemDurumu, donemEtiketi, donemKaydir, donemeGit, buAy, donemDinle } from './donem';
import { temaAd, temaCevir, temaSimge, temaUygula } from './tema';
import { aktifSekme, git, kisayolHedefi, yonlendiriciBaslat, yonlendiriciDinle } from './yonlendirici';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const gizlilik = { acik: false };

const ZIL = '<svg class="zil" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
  + '<path d="M8 1.6a3.4 3.4 0 0 0-3.4 3.4v2.3c0 .9-.35 1.75-.98 2.38L3 10.3h10l-.62-.62A3.36 3.36 0 0 1 11.4 7.3V5A3.4 3.4 0 0 0 8 1.6Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
  + '<path d="M6.5 12.2a1.6 1.6 0 0 0 3 0" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

const ayrik = (s: string) => {
  const i = s.indexOf(' ');
  return i < 0 ? ['', s] : [s.slice(0, i), s.slice(i + 1)];
};

/* ---------- sol menü ---------- */
function menuCiz() {
  const k = aktifSekme();
  const pk = donem();
  const d = donemDurumu(pk);
  const simdi = new Date();
  const satir = (sa: string, glif: string, ad: string) => {
    const no = kisayolNo(sa);
    return `<button class="sb-item ${k === sa ? 'on active' : ''}" data-tab="${sa}" title="${ad}">`
      + `<span class="sb-icon-box nb">${menuIkon(sa) || glif}</span><span class="label nl">${ad}</span>`
      + (no ? `<span class="shortcut nk" aria-hidden="true">${no}</span>` : '') + '</button>';
  };
  const obekler = duzMenu()
    ? OBEKLER.map(o => `<div class="navsec sb-section-title">${o.ad}</div>`
      + o.sekmeler.map(x => satir(x.anahtar, x.glif, x.ad)).join('')).join('')
    : `<div class="sb-menu-araclar"><button type="button" class="sb-btn" data-islem="hub-ac">Hepsini aç</button>`
      + `<button type="button" class="sb-btn" data-islem="hub-kapat">Hepsini kapat</button></div>`
      + HUBLAR.map(h => {
        const acik = hubAcik(h.id);
        const say = h.gruplar.reduce((t, g) => t + g.sekmeler.length, 0);
        return `<button type="button" class="sb-item sb-hub" data-hub="${h.id}" aria-expanded="${acik}" title="${h.ad}">`
          + `<span class="sb-chev" aria-hidden="true">▶</span><span class="sb-hub-ic" aria-hidden="true">${h.glif}</span>`
          + `<span class="label nl">${h.ad}</span><span class="sb-say">${say}</span></button>`
          + `<div class="sb-hub-govde"${acik ? '' : ' hidden'}>`
          + h.gruplar.map(g => (g.ad ? `<div class="sb-grp">${g.ad}</div>` : '')
            + g.sekmeler.map(x => satir(x.anahtar, x.glif, x.ad)).join('')).join('') + '</div>';
      }).join('');

  $('nav').innerHTML = `<div class="sb-header"><div class="sb-brand" data-tab="genel" style="cursor:pointer" title="Genel Bakış'a Dön">`
    + `<div class="sb-logo-box">${menuIkon('karar')}</div><div class="sb-brand-info"><h2>ASTRA</h2><p>Finans komuta merkezi</p></div></div></div>`
    + `<div class="sb-donem${pk !== buAy() ? ' uzak' : ''}"><span class="sb-donem-et">DÖNEM</span>`
    + `<div class="sb-donem-sat"><button class="sb-donem-ok" data-donem="-1" aria-label="Önceki ay" title="önceki ay">‹</button>`
    + `<b class="mono">${donemEtiketi(pk)}</b>`
    + `<button class="sb-donem-ok" data-donem="1" aria-label="Sonraki ay" title="sonraki ay">›</button></div>`
    + `<div class="sb-donem-alt"><span>${d === 'bugun' ? 'açık dönem' : d === 'gelecek' ? 'gelecek · plan' : 'geçmiş dönem'}</span>`
    + (d !== 'bugun' ? '<button class="sb-donem-bugun" data-donem="bugun">Bu aya dön</button>' : '') + '</div></div>'
    + obekler
    + `<div class="sb-footer"><div class="sb-kisi"><span class="sb-avatar" aria-hidden="true">A</span>`
    + `<div class="sb-kisi-ad"><b>ASTRA</b><span>${simdi.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>`
    + `<b class="sb-saat mono" id="sbsaat">${simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b></div>`
    + `<div class="sb-search navfoot"><input id="qbox" placeholder="⌕  Hızlı ara veya komut gir..." aria-label="Menüde ve tablolarda ara"><kbd title="Komut Paleti (Ctrl+K · Ctrl+M)">⌘K</kbd></div>`
    + `<div class="sb-quick-actions">`
    + `<button class="sb-btn nfb${gizlilik.acik ? ' acik' : ''}" data-islem="gizlilik" aria-pressed="${gizlilik.acik}" title="Gizlilik modu — tutarları gizle" aria-label="Gizlilik modu"><span>◉</span> Gizlilik</button>`
    + `<button class="sb-btn nfb" data-islem="geri-al" title="Son işlemi geri al" aria-label="Son işlemi geri al"><span>↶</span> Geri Al</button>`
    + `<button class="sb-btn nfb" data-islem="tema" title="${temaAd()}" aria-label="${temaAd()}"><span>${temaSimge()}</span> Tema</button>`
    + '</div></div>';
}

/* ---------- üst çubuk ve mini şerit ---------- */
function ustCiz() {
  const pk = donem();
  const d = donemDurumu(pk);
  const renk = d === 'bugun' ? 'var(--green)' : d === 'gelecek' ? 'var(--cyan)' : 'var(--dim)';
  const zemin = d === 'bugun' ? 'rgba(84,195,152,.12)' : d === 'gelecek' ? 'rgba(42,191,212,.12)' : 'var(--yuzey-3)';
  $('perbar').innerHTML = `<span class="mono pdonem" style="font-size:10px;letter-spacing:.18em;color:var(--dim);margin-right:2px">DÖNEM</span>`
    + `<button class="pbtn adim" data-donem="-1" title="önceki ay">‹</button>`
    + `<span class="mono" style="min-width:118px;text-align:center;color:var(--txt);font-size:13.5px;letter-spacing:.04em;white-space:nowrap">${donemEtiketi(pk)}</span>`
    + `<button class="pbtn adim" data-donem="1" title="sonraki ay">›</button>`
    + `<span class="mono" style="font-size:10px;padding:var(--sp-0) 8px;border-radius:var(--r-pill);white-space:nowrap;background:${zemin};color:${renk}">${d === 'bugun' ? 'bu ay' : d === 'gelecek' ? 'gelecek' : 'geçmiş'}</span>`
    + (d !== 'bugun' ? `<button class="pbtn adim" style="color:var(--cyan)" data-donem="bugun">⟳ bugün</button>` : '')
    + `<span style="flex:1;min-width:8px"></span>`
    + `<div style="position:relative"><button class="bell" aria-label="0 okunmamış bildirim — Bildirim Merkezi (N)" title="Bildirim Merkezi (N tuşu)">${ZIL}</button></div>`;

  const h = (l: string, v: string, tab: string, ipucu: string) =>
    `<div class="ms" data-tab="${tab}" title="${ipucu}"><i>${l}</i><b>${v}</b></div>`;
  const kartta = aktifSekme() === 'genel';
  $('ministrip').innerHTML =
    (kartta ? '' : h('SERBEST BÜTÇE', '—', 'gider', 'gelir − gider − birikim − taksit')
      + h('TOPLAM BORÇ', '—', 'borc', 'tüm borçların karşılığı')
      + h('SAĞLIK', '—', 'sistem', 'finansal sağlık skoru'))
    + h('ANAPARA', '—', 'mevduat', 'faiz motorundaki anapara')
    + h('BORÇ BİTİŞ', '—', 'sim', 'borç kapatma simülasyonu')
    + h('UYARI', '—', 'genel', 'uyarı merkezi')
    + h('YEDEK', '—', 'sistem', 'son yedek')
    + h('BÜTÜNLÜK', '—', 'gider', 'veri tutarlılık denetimi');
}

/* ---------- sayfa başlığı ve gövde ---------- */
function sayfaCiz() {
  const s = sekmeBul(aktifSekme());
  const ad = s?.ad ?? '';
  const yuva = $('sayfabasi');
  if (!ad || matchMedia('(max-width: 1000px)').matches) {
    yuva.replaceChildren();
    yuva.hidden = true;
  } else {
    yuva.innerHTML = `<div class="hubhead sayfaadi"><h2 aria-hidden="true">${ad}</h2></div>`;
    yuva.hidden = false;
  }
  $('main').innerHTML = `<section class="card" style="padding:28px"><h2 style="margin:0 0 6px">${ad}</h2>`
    + `<p style="margin:0;color:var(--dim)">Bu ekran sonraki fazda doldurulacak.</p></section>`
    + (aktifSekme() === 'sistem'
      ? `<section class="card" style="padding:28px;margin-top:16px"><h2 style="margin:0 0 6px">Menü görünümü</h2>`
        + `<p style="margin:0 0 14px;color:var(--dim)">Gruplu menü merkezlere ayrılmıştır. Alışana kadar eski düz listeye dönebilirsin.</p>`
        + `<button type="button" class="btn" data-islem="menu-tur" aria-pressed="${duzMenu()}">${duzMenu() ? 'Gruplu menüye geç' : 'Eski düz menüye dön'}</button></section>`
      : '');
  document.title = `${ad} · ASTRA FİNANS OS`;
  $('duyuru').textContent = `${ad} sayfası açıldı`;
}

/* ---------- alt çubuk ve çekmece ---------- */
function altCubukCiz() {
  const k = aktifSekme();
  $('mobnav').innerHTML = ALT_CUBUK.map(([a, ic, lb]) =>
    `<button class="${a === k || (a === 'gider' && k === 'aylik') ? 'on' : ''}" data-tab="${a}" aria-label="${lb}"><i aria-hidden="true">${ic}</i>${lb}</button>`).join('');
}

function cekmeceAc() {
  const d = $('mobdrawer');
  if (d.classList.contains('acik')) { d.classList.remove('acik'); return; }
  const k = aktifSekme();
  d.innerHTML = `<div class="mdhead"><b style="font-size:15.5px">Tüm Modüller</b><button class="btn ghost" data-islem="cekmece-kapat">Kapat ✕</button></div>`
    + `<input class="mdara" type="search" placeholder="sayfa ara…" aria-label="Modüllerde ara" autocomplete="off">`
    + (duzMenu()
      ? OBEKLER.map(o => ({ ad: o.ad, sekmeler: o.sekmeler }))
      : HUBLAR.map(h => ({ ad: h.ad.toLocaleUpperCase('tr'), sekmeler: h.gruplar.flatMap(g => g.sekmeler) })))
      .map(o => `<div class="mdsec">${o.ad}</div><div class="mdgrid">`
        + o.sekmeler.map(x => `<button class="${x.anahtar === k ? 'on' : ''}" data-tab="${x.anahtar}">${x.glif} ${x.ad}</button>`).join('') + '</div>').join('');
  d.classList.add('acik');
}
const kat = (s: string) => s.toLocaleLowerCase('tr').replace(/[ıİI]/g, 'i');
function cekmeceSuz(q: string) {
  const t = kat(q.trim());
  $('mobdrawer').querySelectorAll<HTMLElement>('.mdgrid').forEach(g => {
    let n = 0;
    g.querySelectorAll<HTMLElement>('button').forEach(b => {
      const uydu = !t || kat(b.textContent ?? '').includes(t);
      b.hidden = !uydu;
      if (uydu) n++;
    });
    g.hidden = n === 0;
    (g.previousElementSibling as HTMLElement | null)?.toggleAttribute('hidden', n === 0);
  });
}

function hepsiniCiz() {
  menuCiz(); ustCiz(); sayfaCiz(); altCubukCiz();
  document.documentElement.style.setProperty('--ust', `${$('perbarwrap').getBoundingClientRect().height}px`);
}

function saatTazele() {
  const el = document.getElementById('sbsaat');
  if (el) el.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- olaylar ---------- */
function olaylariBagla() {
  document.addEventListener('click', e => {
    const hedef = e.target as HTMLElement;
    const sekme = hedef.closest<HTMLElement>('[data-tab]');
    if (sekme?.dataset.tab) {
      $('mobdrawer').classList.remove('acik');
      git(sekme.dataset.tab);
      return;
    }
    const hub = hedef.closest<HTMLElement>('[data-hub]')?.dataset.hub;
    if (hub) { hubCevir(hub); menuCiz(); return; }
    const dn = hedef.closest<HTMLElement>('[data-donem]')?.dataset.donem;
    if (dn) { if (dn === 'bugun') donemeGit(buAy()); else donemKaydir(Number(dn)); return; }
    const kapat = hedef.closest<HTMLElement>('[data-kapat]')?.dataset.kapat;
    if (kapat) { $(kapat).classList.remove('acik'); return; }
    const islem = hedef.closest<HTMLElement>('[data-islem]')?.dataset.islem;
    if (islem === 'tema') { temaCevir(); menuCiz(); }
    else if (islem === 'gizlilik') { gizlilik.acik = !gizlilik.acik; document.body.classList.toggle('gizli', gizlilik.acik); menuCiz(); }
    else if (islem === 'hub-ac' || islem === 'hub-kapat') { hepsiniAyarla(islem === 'hub-ac'); menuCiz(); }
    else if (islem === 'menu-tur') { duzMenuYaz(!duzMenu()); menuCiz(); sayfaCiz(); }
    else if (islem === 'cekmece-kapat') $('mobdrawer').classList.remove('acik');
    else if (hedef.closest('#mobnav [data-tab="__more"]')) cekmeceAc();
  });
  $('mobnav').addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('[data-tab="__more"]')) { e.stopPropagation(); cekmeceAc(); }
  }, true);
  document.addEventListener('input', e => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('mdara')) cekmeceSuz((t as HTMLInputElement).value);
  });
  addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) { const h = kisayolHedefi(Number(e.key)); if (h) git(h); }
    else if (e.key === 'ArrowLeft') donemKaydir(-1);
    else if (e.key === 'ArrowRight') donemKaydir(1);
    else if (e.key === 't' || e.key === 'T') donemeGit(buAy());
    else if (e.key === 'p' || e.key === 'P') { gizlilik.acik = !gizlilik.acik; document.body.classList.toggle('gizli', gizlilik.acik); menuCiz(); }
    else if (e.key === '?') $('kbdhelp').classList.add('acik');
    else if (e.key === 'Escape') { $('kbdhelp').classList.remove('acik'); $('mobdrawer').classList.remove('acik'); }
  });
}

export function kabuguBaslat() {
  temaUygula();
  yonlendiriciBaslat();
  yonlendiriciDinle(k => { sekmeMerkeziniAc(k); hepsiniCiz(); });
  donemDinle(hepsiniCiz);
  olaylariBagla();
  sekmeMerkeziniAc(aktifSekme());
  hepsiniCiz();
  setInterval(saatTazele, 30000);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() =>
    document.documentElement.style.setProperty('--ust', `${$('perbarwrap').getBoundingClientRect().height}px`)).observe($('perbarwrap'));
  matchMedia('(max-width: 1000px)').addEventListener('change', sayfaCiz);
}
