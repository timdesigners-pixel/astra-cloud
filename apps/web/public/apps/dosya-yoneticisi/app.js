/* Dosya Yöneticisi — Astra APPS
 *
 * İki kaynak:
 *  · Astra Bulut — Supabase Storage 'dosyalar' kovası. Ağaç kökteki index.json'dan
 *    okunur (görünen Türkçe adlar orada; listeleme politikası gerekmez). Dosyalar
 *    herkese açık adresten çekilir. Yükleme scripts/dosya-yukle.mjs ile.
 *  · Bu Bilgisayar — File System Access API ile kullanıcının seçtiği klasör
 *    (yalnız okuma; Chromium tarayıcılar). Son açılan klasörün ve sabitlenen
 *    klasörlerin tutaçları IndexedDB'de durur; tarayıcı izni yeniden sorarsa
 *    tek tıkla yenilenir. Bu klasörlerdeki hiçbir dosya buluta gönderilmez.
 *
 * Önizleme: HTML dosyaları sandbox'lı çerçevede (yalnız betik; kaynak opak —
 * Astra'nın deposuna erişemez; yereldeki göreli görsel/stil/betikler aynı
 * klasörden gömülür), görsel, PDF, metin/kod; Markdown biçimli, DOCX ve PPTX
 * tarayıcıda çözülerek (belge.js). Pinterest bileşenleri için yan .json'daki
 * bileşenler Tasarım Atölyesi kütüphanesine aktarılabilir.
 *
 * Görünüm tercihleri ve sık kullanılanlar 'dosya-yoneticisi-ui' anahtarında;
 * Astra bunu şifreli kasaya eşitler. */

const SB = 'https://mwrbfayhfyvttmhpfawz.supabase.co/storage/v1/object/public/dosyalar/';
const UI = 'dosya-yoneticisi-ui';
const ATOLYE = 'tasarim-atolyesi-kutuphane';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const oku = (k, v) => { try{ const x = JSON.parse(localStorage.getItem(k)); return x ?? v; }catch(e){ return v; } };
const yaz = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

const ui = Object.assign({gorunum: 'izgara', sirala: 'ad', yildiz: [], sonYol: null}, oku(UI, {}));
const uiKaydet = () => yaz(UI, ui);

const D = {
  kaynak: 'bulut',          // 'bulut' | 'yerel'
  bulut: {ad: 'Astra Bulut', tur: 'klasor', cocuk: []},   // index.json kökü
  bulutDurum: 'yükleniyor', // 'yükleniyor' | 'hazir' | 'yok' | 'hata'
  yerel: null,              // {ad, tutac} kök
  yigin: [],                // açık klasör zinciri (düğümler) — başlangıçta bulut kökü
  ara: '',
  oz: null,                 // açık önizleme {dugum, sekme}
};

/* ---------- dosya türleri ---------- */
const uzanti = ad => (String(ad).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
const TUR = {
  html: ['html', 'html-renk', 'HTML'], htm: ['html', 'html-renk', 'HTML'],
  json: ['data_object', 'json-renk', 'JSON'],
  png: ['image', 'resim-renk', 'Görsel'], jpg: ['image', 'resim-renk', 'Görsel'], jpeg: ['image', 'resim-renk', 'Görsel'],
  webp: ['image', 'resim-renk', 'Görsel'], gif: ['image', 'resim-renk', 'Görsel'], svg: ['image', 'resim-renk', 'Görsel'],
  pdf: ['picture_as_pdf', 'pdf-renk', 'PDF'],
  docx: ['description', 'word-renk', 'Word'], doc: ['description', 'word-renk', 'Word'],
  pptx: ['slideshow', 'sunum-renk', 'PowerPoint'], ppt: ['slideshow', 'sunum-renk', 'PowerPoint'],
  txt: ['article', 'metin-renk', 'Metin'], md: ['article', 'metin-renk', 'Markdown'], csv: ['table_chart', 'json-renk', 'CSV'],
  js: ['code', 'kod-renk', 'JavaScript'], mjs: ['code', 'kod-renk', 'JavaScript'], ts: ['code', 'kod-renk', 'TypeScript'],
  css: ['code', 'kod-renk', 'CSS'], py: ['code', 'kod-renk', 'Python'], sql: ['code', 'kod-renk', 'SQL'],
  xml: ['code', 'kod-renk', 'XML'], yml: ['code', 'kod-renk', 'YAML'], yaml: ['code', 'kod-renk', 'YAML'],
};
const turu = d => d.tur === 'klasor' ? ['folder', 'klasor-renk', 'Klasör'] : (TUR[uzanti(d.ad)] || ['draft', 'metin-renk', (uzanti(d.ad) || 'dosya').toUpperCase()]);
const METIN = new Set(['txt', 'md', 'csv', 'js', 'mjs', 'ts', 'css', 'py', 'sql', 'xml', 'yml', 'yaml', 'json', 'html', 'htm', 'log', 'ini', 'env']);
const RESIM = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

const boyutYaz = b => b == null ? '' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1).replace('.', ',') + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
const tarihYaz = t => { if(!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('tr-TR', {day: '2-digit', month: 'short', year: 'numeric'}); };

/* Belge önizleyicileri gerektiğinde yüklenir (Markdown, DOCX, PPTX, HTML gömme). */
let belgeModul;
const belgeMod = () => belgeModul || (belgeModul = import(new URL('belge.js', location.href).href));

/* ---------- IndexedDB: klasör tutaçları ----------
   'son' → son açılan kök klasör; 'sabit' → [{ad, tutac}] sık kullanılan
   yerel klasörler. Tutaç yalnız erişim yetkisidir, dosya içeriği saklanmaz. */
const IDB = {ad: 'dosya-yoneticisi', depo: 'tutac'};
function idbAc(){
  return new Promise((ok, red) => {
    if(!window.indexedDB) return red(new Error('IndexedDB yok'));
    const r = indexedDB.open(IDB.ad, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB.depo);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => red(r.error);
  });
}
async function idb(islem, anahtar, deger){
  try{
    const db = await idbAc();
    return await new Promise((ok, red) => {
      const t = db.transaction(IDB.depo, islem === 'al' ? 'readonly' : 'readwrite');
      const d = t.objectStore(IDB.depo);
      const r = islem === 'al' ? d.get(anahtar) : islem === 'sil' ? d.delete(anahtar) : d.put(deger, anahtar);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => red(r.error);
    });
  }catch(e){ return undefined; }
}
/* İzin: 'granted' değilse kullanıcı hareketiyle istenir (buton tıklaması). */
async function izinVar(t, iste){
  try{
    if(!t.queryPermission) return true;
    if(await t.queryPermission({mode: 'read'}) === 'granted') return true;
    return iste ? await t.requestPermission({mode: 'read'}) === 'granted' : false;
  }catch(e){ return false; }
}

let bildirimZ;
function bildir(m){ const b = $('bildirim'); b.textContent = m; b.classList.add('acik'); clearTimeout(bildirimZ); bildirimZ = setTimeout(() => b.classList.remove('acik'), 2600); }

/* ---------- kaynaklar ---------- */
async function bulutYukle(){
  D.bulutDurum = 'yükleniyor';
  try{
    const r = await fetch(SB + 'index.json', {cache: 'no-cache'});
    if(r.status === 400 || r.status === 404){ D.bulut = {ad: 'Astra Bulut', tur: 'klasor', cocuk: []}; D.bulutDurum = 'yok'; return; }
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    D.bulut = j.kok || {ad: 'Astra Bulut', tur: 'klasor', cocuk: []};
    D.bulut.ad = 'Astra Bulut';
    D.bulutTarih = j.olusturuldu;
    D.bulutDurum = 'hazir';
  }catch(e){
    D.bulut = {ad: 'Astra Bulut', tur: 'klasor', cocuk: []};
    D.bulutDurum = 'hata';
  }
}

/* Yerel klasör düğümleri tembel doldurulur: tutac → cocuk. */
async function yerelDoldur(dugum){
  if(dugum.cocuk) return dugum.cocuk;
  const liste = [];
  for await (const t of dugum.tutac.values()){
    if(t.kind === 'directory') liste.push({ad: t.name, tur: 'klasor', tutac: t, yerel: true, ust: dugum});
    else{
      let boyut = null, tarih = null;
      try{ const f = await t.getFile(); boyut = f.size; tarih = f.lastModified; }catch(e){}
      liste.push({ad: t.name, tur: 'dosya', tutac: t, boyut, tarih, yerel: true, ust: dugum});
    }
  }
  dugum.cocuk = liste;
  return liste;
}

async function klasorSec(){
  if(!window.showDirectoryPicker){
    bildir('Bu tarayıcı klasör erişimini desteklemiyor — Chrome ya da Edge kullanın.');
    return;
  }
  try{
    const t = await window.showDirectoryPicker({id: 'astra-dosya', mode: 'read'});
    await yerelAc(t);
  }catch(e){ if(e.name !== 'AbortError') bildir('Klasör açılamadı: ' + e.message); }
}
/* Bir klasör tutacını kök olarak aç; son açılan olarak hatırla. */
async function yerelAc(t){
  if(!await izinVar(t, true)){ bildir('Klasör izni verilmedi.'); return false; }
  D.yerel = {ad: t.name, tur: 'klasor', tutac: t, yerel: true};
  D.yerelIzin = true;
  D.kaynak = 'yerel';
  D.yigin = [D.yerel];
  D.ara = ''; $('ara').value = '';
  idb('yaz', 'son', t);
  await ciz();
  return true;
}
/* Sabitlenen yerel klasörler (Duruşma Hazırlık gibi) — sık kullanılanlarda. */
async function sabitYukle(){ D.sabit = (await idb('al', 'sabit')) || []; }
async function sabitBul(t){
  for(let i = 0; i < D.sabit.length; i++){
    try{ if(await D.sabit[i].tutac.isSameEntry(t)) return i; }catch(e){}
  }
  return -1;
}
async function sabitDegistir(){
  const k = acikKlasor();
  if(!k || !k.tutac) return;
  const i = await sabitBul(k.tutac);
  if(i >= 0){ D.sabit.splice(i, 1); bildir('Sık kullanılanlardan çıkarıldı.'); }
  else{ D.sabit.push({ad: k.ad, tutac: k.tutac}); bildir(`"${k.ad}" sık kullanılanlara sabitlendi.`); }
  await idb('yaz', 'sabit', D.sabit);
  await ciz();
}
/* #ara=2026-94 gibi bir bağlantıyla gelindiğinde: adı eşleşen sabit klasörü aç. */
function hashAra(){
  const m = String(location.hash || '').match(/ara=([^&]+)/);
  return m ? decodeURIComponent(m[1]).trim() : '';
}
const adEsles = (ad, q) => {
  const sade = x => String(x).toLocaleLowerCase('tr').replace(/[\/_.\s]+/g, '-');
  return sade(ad).includes(sade(q));
};

/* ---------- gezinme ---------- */
const acikKlasor = () => D.yigin[D.yigin.length - 1];
const yolMetni = () => D.yigin.map(d => d.ad).join(' / ');

async function klasoreGir(d){
  if(d.yerel) await yerelDoldur(d);
  D.yigin.push(d);
  D.ara = ''; $('ara').value = '';
  if(D.kaynak === 'bulut'){ ui.sonYol = D.yigin.slice(1).map(x => x.ad); uiKaydet(); }
  await ciz();
  const bas = document.body.getBoundingClientRect().top + scrollY;
  if(scrollY > bas) scrollTo(0, Math.max(0, bas - 80));
}
async function yukari(n = 1){
  if(D.yigin.length <= 1) return;
  D.yigin.splice(Math.max(1, D.yigin.length - n));
  D.ara = ''; $('ara').value = '';
  if(D.kaynak === 'bulut'){ ui.sonYol = D.yigin.slice(1).map(x => x.ad); uiKaydet(); }
  await ciz();
}
async function kaynagaGec(k){
  if(k === 'yerel' && !D.yerel) return klasorSec();
  if(k === 'yerel' && !D.yerelIzin){
    if(!await izinVar(D.yerel.tutac, true)) return bildir('Klasör izni verilmedi — "Başka klasör aç…" ile yeniden seç.');
    D.yerelIzin = true;
  }
  D.kaynak = k;
  D.yigin = [k === 'bulut' ? D.bulut : D.yerel];
  D.ara = ''; $('ara').value = '';
  await ciz();
}
/* Yıldızlı yol (yalnız bulut) — ad zinciriyle saklanır. */
async function yolaGit(adlar){
  D.kaynak = 'bulut';
  D.yigin = [D.bulut];
  for(const ad of adlar || []){
    const k = (acikKlasor().cocuk || []).find(x => x.tur === 'klasor' && x.ad === ad);
    if(!k) break;
    D.yigin.push(k);
  }
  D.ara = ''; $('ara').value = '';
  await ciz();
}

/* ---------- liste ---------- */
function sayac(d){
  if(d.tur !== 'klasor' || !d.cocuk) return {dosya: 0, klasor: 0};
  let dosya = 0, klasor = 0;
  for(const c of d.cocuk){ if(c.tur === 'klasor'){ klasor++; const s = sayac(c); dosya += s.dosya; klasor += s.klasor; } else dosya++; }
  return {dosya, klasor};
}
/* Aramada alt klasörlere de inilir (bulut; yerelde yalnız yüklenmiş düğümler). */
function ara(d, q, yol = [], cikti = []){
  for(const c of d.cocuk || []){
    if(c.ad.toLocaleLowerCase('tr').includes(q) || (c.meta && String(c.meta.baslik || '').toLocaleLowerCase('tr').includes(q))) cikti.push({...c, _yol: yol.map(x => x.ad), _yolDugum: yol, _asil: c});
    if(c.tur === 'klasor' && c.cocuk) ara(c, q, [...yol, c], cikti);
    if(cikti.length > 500) break;
  }
  return cikti;
}
function sirala(liste){
  const s = ui.sirala;
  return [...liste].sort((a, b) => {
    if(a.tur !== b.tur) return a.tur === 'klasor' ? -1 : 1;
    if(s === 'tarih') return (new Date(b.tarih || 0)) - (new Date(a.tarih || 0));
    if(s === 'boyut') return (b.boyut || 0) - (a.boyut || 0);
    if(s === 'tur') return uzanti(a.ad).localeCompare(uzanti(b.ad)) || a.ad.localeCompare(b.ad, 'tr', {numeric: true});
    return a.ad.localeCompare(b.ad, 'tr', {numeric: true});
  });
}

const yildizAnahtar = () => D.yigin.slice(1).map(x => x.ad).join('/');

async function ciz(){
  const k = acikKlasor();
  if(k && k.yerel){
    let izin = D.yerelIzin;
    if(izin){ try{ await yerelDoldur(k); }catch(e){ izin = D.yerelIzin = false; } }
    if(!izin){
      bildir('Klasör izni yenilenmeli — soldaki klasör satırına dokun.');
      D.kaynak = 'bulut'; D.yigin = [D.bulut];
      return ciz();
    }
    D.acikSabit = (await sabitBul(k.tutac)) >= 0;
  }

  /* kaynaklar */
  const toplam = D.bulut ? sayac(D.bulut) : {dosya: 0};
  $('kaynaklar').innerHTML = `
    <button class="kaynak" data-kaynak="bulut" aria-current="${D.kaynak === 'bulut'}"><span class="ms">cloud</span><span class="ad">Astra Bulut</span><small>${D.bulutDurum === 'hazir' ? toplam.dosya : ''}</small></button>
    <button class="kaynak" data-kaynak="yerel" aria-current="${D.kaynak === 'yerel'}"><span class="ms">computer</span><span class="ad">${D.yerel ? esc(D.yerel.ad) : 'Bu Bilgisayar'}</span><small>${D.yerel ? '' : 'klasör seç'}</small></button>
    ${D.yerel && !D.yerelIzin ? `<div class="izin-not">Tarayıcı bu klasör için izni yeniden soruyor — "${esc(D.yerel.ad)}" satırına dokun.</div>` : ''}
    ${D.yerel ? `<button class="kaynak" data-a="klasorSec"><span class="ms">create_new_folder</span><span class="ad">Başka klasör aç…</span></button>` : ''}`;
  const sabitler = (D.sabit || []).map((y, i) => `<button class="kaynak" data-sabit="${i}" title="Bu bilgisayar · ${esc(y.ad)}"><span class="ms dolu" style="color:var(--sari)">folder_special</span><span class="ad">${esc(y.ad)}</span><small>yerel</small></button>`).join('');
  $('yildizlar').innerHTML = ui.yildiz.length || sabitler
    ? ui.yildiz.map(y => `<button class="kaynak" data-yildiz="${esc(y)}"><span class="ms dolu" style="color:var(--sari)">star</span><span class="ad">${esc(y.split('/').pop() || 'Astra Bulut')}</span></button>`).join('') + sabitler
    : `<div style="padding:4px 10px;font-size:12px;color:var(--silik)">Klasörü ☆ ile işaretle</div>`;
  $('yanNot').innerHTML = D.kaynak === 'bulut'
    ? `Astra Bulut: Supabase <code>dosyalar</code> kovası.${D.bulutTarih ? '<br>Ağaç: ' + tarihYaz(D.bulutTarih) : ''}`
    : 'Bu Bilgisayar: seçtiğin klasör yalnız okunur, hiçbir yere yüklenmez. Son klasör ve ☆ ile sabitlenenler bu tarayıcıda hatırlanır.';

  /* konum */
  $('yol').innerHTML = D.yigin.map((d, i) => `${i ? '<span class="ms ayrac">chevron_right</span>' : ''}<button data-yol="${i}">${esc(d.ad)}</button>`).join('')
    + (D.kaynak === 'bulut' ? ` <button class="ikon-dugme" data-a="yildizla" title="Sık kullanılanlara ekle" style="margin-left:6px"><span class="ms ${ui.yildiz.includes(yildizAnahtar()) ? 'dolu' : ''}" style="${ui.yildiz.includes(yildizAnahtar()) ? 'color:var(--sari)' : ''}">star</span></button>` : '')
    + (D.kaynak === 'yerel' && k && k.tutac ? ` <button class="ikon-dugme" data-a="sabitle" title="Bu klasörü sık kullanılanlara sabitle" style="margin-left:6px"><span class="ms ${D.acikSabit ? 'dolu' : ''}" style="${D.acikSabit ? 'color:var(--sari)' : ''}">star</span></button>` : '');
  $('geri').disabled = D.yigin.length <= 1;
  document.querySelectorAll('[data-gorunum]').forEach(b => b.setAttribute('aria-pressed', b.dataset.gorunum === ui.gorunum));
  $('sirala').value = ui.sirala;

  /* içerik */
  const el = $('icerik');
  el.className = 'icerik ' + ui.gorunum;
  if(!k){ el.innerHTML = bosKutu('computer', 'Klasör seçilmedi', 'Bu bilgisayardan bir klasör seç.', '<button class="dugme ana-d" data-a="klasorSec"><span class="ms">folder_open</span>Klasör seç</button>'); $('ozet').innerHTML = ''; return; }
  if(D.kaynak === 'bulut' && D.bulutDurum === 'yükleniyor'){ el.innerHTML = bosKutu('hourglass_top', 'Yükleniyor…', 'Astra Bulut ağacı okunuyor.'); return; }

  const q = D.ara.trim().toLocaleLowerCase('tr');
  const liste = sirala(q ? ara(k, q) : (k.cocuk || []));
  const s = sayac(k);
  $('ozet').innerHTML = q
    ? `<span class="rozet">"${esc(D.ara)}" · ${liste.length} sonuç</span>`
    : `<span class="rozet">${(k.cocuk || []).filter(x => x.tur === 'klasor').length} klasör</span><span class="rozet">${(k.cocuk || []).filter(x => x.tur !== 'klasor').length} dosya</span>${s.dosya ? `<span class="rozet">altlarıyla ${s.dosya} dosya</span>` : ''}`;

  if(!liste.length){
    el.innerHTML = q ? bosKutu('search_off', 'Sonuç yok', 'Aramayı değiştir.')
      : D.kaynak === 'bulut' && D.bulutDurum === 'yok' ? bosKutu('cloud_off', 'Bulut henüz boş', 'Pinterest bileşenleri üretilip yüklendiğinde burada klasör klasör görünecek.')
      : D.kaynak === 'bulut' && D.bulutDurum === 'hata' ? bosKutu('wifi_off', 'Buluta ulaşılamadı', 'Bağlantıyı kontrol edip yeniden dene.', '<button class="dugme" data-a="yenile"><span class="ms">refresh</span>Yeniden dene</button>')
      : bosKutu('folder_off', 'Klasör boş', '');
    return;
  }
  if(k.yerel){
    const b = await belgeMod().catch(() => null);
    if(b){
      const kanon = b.kanonikKume(liste);
      liste.forEach(d => { d._arsiv = b.arsivMi(d.ad) || (d._yol || []).some(b.arsivMi); d._kanonik = d.tur !== 'klasor' && kanon.has(b.govdeAdi(d.ad)); });
    }
  }
  el.innerHTML = liste.map((d, i) => ogeHTML(d, i)).join('');
  D.gorunen = liste;
  if(ui.gorunum === 'izgara') kapaklariYukle();
}

const bosKutu = (ikon, b, m, ek = '') => `<div class="bos"><span class="ms">${ikon}</span><b>${esc(b)}</b>${esc(m)}${ek ? '<div>' + ek + '</div>' : ''}</div>`;

function ogeHTML(d, i){
  const [ikon, renk, ad] = turu(d);
  const alt = d.tur === 'klasor'
    ? (d.cocuk ? (() => { const s = sayac(d); return `${s.dosya} dosya${s.klasor ? ' · ' + s.klasor + ' klasör' : ''}`; })() : 'Klasör')
    : [ad, boyutYaz(d.boyut), tarihYaz(d.tarih)].filter(Boolean).join(' · ');
  const yol = d._yol && d._yol.length ? `<span class="alt">${esc(d._yol.join(' / '))}</span>` : '';
  const etiket = d._arsiv ? '<span class="etiket arsiv">Arşiv</span>' : d._kanonik ? '<span class="etiket kanonik">Kanonik</span>' : '';
  return `<button class="oge${d._arsiv ? ' arsiv' : ''}${d._kanonik ? ' kanonik' : ''}" data-i="${i}" title="${esc(d.ad)}">
    <div class="kapak" data-kapak="${i}"><span class="ms ${renk} ${d.tur === 'klasor' ? 'dolu' : ''}">${ikon}</span>${etiket}</div>
    <div class="bilgi"><span class="ad">${esc(d.ad)}</span><span class="alt">${esc(alt)}</span>${yol}</div>
  </button>`;
}

/* Izgarada HTML bileşenleri ve görseller küçük önizlemeyle — görünür olunca. */
let kapakGozcu;
function kapaklariYukle(){
  if(kapakGozcu) kapakGozcu.disconnect();
  kapakGozcu = new IntersectionObserver(async girisler => {
    for(const g of girisler){
      if(!g.isIntersecting) continue;
      kapakGozcu.unobserve(g.target);
      const d = D.gorunen[+g.target.dataset.kapak];
      if(!d || d.tur === 'klasor') continue;
      const u = uzanti(d.ad);
      try{
        if(RESIM.has(u)) g.target.innerHTML = `<img alt="" loading="lazy" src="${esc(await dosyaURL(d))}">`;
        else if(u === 'html' || u === 'htm'){
          const f = document.createElement('iframe');
          f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('loading', 'lazy'); f.tabIndex = -1;
          onizlemeYaz(f, guvenli(await htmlHazirla(d, {kucuk: true})));
          g.target.replaceChildren(f);
        }
      }catch(e){}
    }
  }, {rootMargin: '200px'});
  document.querySelectorAll('[data-kapak]').forEach(k => kapakGozcu.observe(k));
}

/* ---------- güvenli önizleme belgesi ----------
   Üretilen bileşenlerde href="/" ya da "index.html" gibi göreli bağlantılar
   srcdoc çerçevesinde BU sayfanın adresine çözülüyor ve tıklayınca çerçevenin
   içine Dosya Yöneticisi açılıyordu. Önizlemede bağlantı ve form gezinmesi
   kapatılır (dış bağlantı gerekiyorsa "Aç" ile yeni sekmede). */
const KALKAN = '<script>(function(){addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href],area[href]");if(a)e.preventDefault()},true);addEventListener("submit",function(e){e.preventDefault()},true);window.open=function(){return null}})();</script>';
/* Önizleme çerçevesi (sandbox="allow-scripts": opak köken, kasa/depo/çerez yok). İki yol:
   1) ASIL: ayrı aktarıcı belge (apps/onizleme.html) + postMessage. Bu belge KENDİ içerik politikasıyla
      sunulur (config/csp.mjs › ONIZLEME): önizlenen içerik satır içi betik, CDN ve görsel kullanabilir.
      blob:/srcdoc belgeleri ise Astra'nın SIKI politikasını miras alır (satır içi betik ve CDN ölürdü).
   2) YEDEK: aktarıcı bazı tarayıcılarda / eklentilerde "ERR_BLOCKED_BY_CLIENT" ile engelleniyor (önizleme
      beyaz kalıyordu). Aktarıcı 2,5 sn içinde "hazırım" demezse blob: adresine düşülür ve sonraki
      önizlemeler doğrudan blob kullanır (blob, kendi sayfasının politikasını — geliştirmede hiçbirini —
      miras alır). */
const ONIZLEME = new URL('../onizleme.html', location.href).href;
let onizlemeAktarici = true;
function onizlemeBlob(f, html){
  const u = URL.createObjectURL(new Blob([String(html || '')], {type: 'text/html'}));
  f.addEventListener('load', () => setTimeout(() => URL.revokeObjectURL(u), 5000), {once: true});
  f.src = u;
}
function onizlemeYaz(f, html){
  if(!onizlemeAktarici) return onizlemeBlob(f, html);
  const kimlik = Math.random().toString(36).slice(2);
  let bitti = false;
  const dinle = e => {
    if(bitti || e.source !== f.contentWindow || !e.data || e.data.tur !== 'astra-onizleme-hazir' || e.data.kimlik !== kimlik) return;
    bitti = true; clearTimeout(zaman); removeEventListener('message', dinle);
    try{ f.contentWindow.postMessage({tur: 'astra-onizleme', html}, '*'); }catch(err){ onizlemeAktarici = false; onizlemeBlob(f, html); }
  };
  const zaman = setTimeout(() => {
    if(bitti) return;
    bitti = true; removeEventListener('message', dinle);
    onizlemeAktarici = false;                      // bu ortamda aktarıcı çalışmıyor: bir daha deneme
    onizlemeBlob(f, html);
  }, 2500);
  addEventListener('message', dinle);
  f.src = ONIZLEME + '#' + kimlik;
}
function guvenli(html){
  const h = String(html || '');
  if(/<head[^>]*>/i.test(h)) return h.replace(/<head[^>]*>/i, m => m + KALKAN);
  if(/<html[^>]*>/i.test(h)) return h.replace(/<html[^>]*>/i, m => m + '<head>' + KALKAN + '</head>');
  return KALKAN + h;
}
/* Tasarım Atölyesi'nin önizleme belgesi — üretilen bileşenler bununla gösterilir. */
const belge = (kod, baslik = 'Bileşen') => `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(baslik)}</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
<style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#020617;color:#f1f5f9;font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}#k{width:100%;display:flex;flex-direction:column;padding:1.5rem}</style>
</head><body class="dark"><div id="k">${kod}</div></body></html>`;

/* ---------- dosya içeriği ---------- */
const onbellek = new Map();
async function dosyaBlob(d){
  if(onbellek.has(d)) return onbellek.get(d);
  let b;
  if(d.yerel) b = await d.tutac.getFile();
  else{
    const r = await fetch(SB + d.yol.split('/').map(encodeURIComponent).join('/'));
    if(!r.ok) throw new Error('HTTP ' + r.status);
    b = await r.blob();
  }
  onbellek.set(d, b);
  return b;
}
const dosyaMetni = async d => (await dosyaBlob(d)).text();
const nesneURL = new Map();
async function dosyaURL(d, mime){
  if(nesneURL.has(d)) return nesneURL.get(d);
  let b = await dosyaBlob(d);
  if(mime && b.type !== mime) b = new Blob([b], {type: mime});
  const u = URL.createObjectURL(b);
  nesneURL.set(d, u);
  return u;
}
/* Yerel HTML: göreli görsel/stil/betik/yazı tiplerini aynı klasörden çözüp
   göm. Önizleme çerçevesi opak kökende çalıştığı için göreli adresler
   dosyanın klasörüne değil Astra'ya gider; bu yüzden her şey gömülür. */
async function yerelYol(d, yol){
  /* Kökten dosyanın klasörüne kadar klasör tutaçları; ".." bir üste çıkar. */
  const zincir = [];
  for(let k = d.ust; k; k = k.ust) zincir.unshift(k.tutac);
  if(!zincir.length) return null;
  const parca = String(yol).split('/').filter(x => x && x !== '.');
  const ad = parca.pop();
  if(!ad) return null;
  for(const p of parca){
    if(p === '..'){ if(zincir.length > 1) zincir.pop(); else return null; }
    else zincir.push(await zincir[zincir.length - 1].getDirectoryHandle(p));
  }
  return (await zincir[zincir.length - 1].getFileHandle(ad)).getFile();
}
const MIME = {woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', json: 'application/json'};
async function htmlHazirla(d, {kucuk} = {}){
  const metin = await dosyaMetni(d);
  if(!d.yerel){
    /* Bulut: göreli adresler dosyanın kendi klasörüne (herkese açık kova). */
    const klasor = SB + String(d.yol || '').split('/').slice(0, -1).map(encodeURIComponent).join('/') + '/';
    const base = `<base href="${esc(klasor)}">`;
    return /<head[^>]*>/i.test(metin) ? metin.replace(/<head[^>]*>/i, m => m + base) : base + metin;
  }
  if(!d.ust) return metin;
  const b = await belgeMod();
  const azami = kucuk ? 2 * 1048576 : 12 * 1048576;
  const {html} = await b.htmlGom(metin, async (yol, tur) => {
    const f = await yerelYol(d, yol);
    if(!f) return null;
    if(tur === 'metin') return {deger: await f.text(), boyut: f.size};
    if(f.size > azami) return null;
    const u8 = new Uint8Array(await f.arrayBuffer());
    let s = '';
    for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return {deger: `data:${f.type || MIME[uzanti(f.name)] || 'application/octet-stream'};base64,${btoa(s)}`, boyut: f.size};
  }, kucuk ? 4 * 1048576 : 40 * 1048576);
  return html;
}
async function metaOku(d){
  if(!d.meta || !d.meta.yol) return null;
  if(d._meta) return d._meta;
  const r = await fetch(SB + d.meta.yol.split('/').map(encodeURIComponent).join('/'));
  if(!r.ok) return null;
  return (d._meta = await r.json());
}

/* ---------- önizleme ---------- */
async function onizle(d, sekme){
  const u = uzanti(d.ad);
  const [ikon, renk, turAd] = turu(d);
  const html = u === 'html' || u === 'htm';
  const belgeTur = u === 'md' || u === 'markdown' ? 'md' : u === 'docx' ? 'docx' : u === 'pptx' ? 'pptx' : '';
  sekme = sekme || (html || belgeTur ? 'gorunum' : 'icerik');
  D.oz = {d, sekme};
  $('onizleme').hidden = false;
  $('ozIkon').textContent = ikon; $('ozIkon').className = 'ms ' + renk;
  $('ozBaslik').textContent = d.ad;
  $('ozAlt').textContent = [turAd, boyutYaz(d.boyut), tarihYaz(d.tarih), d.yerel ? 'Bu Bilgisayar' : 'Astra Bulut'].filter(Boolean).join(' · ');
  const uretilenSay = (uretilen[anahtar(d)] || []).length;
  const sekmeler = html ? [['gorunum', 'Görünüm'], ['kod', 'Kaynak kod']].concat(d.meta ? [['bilgi', 'Bileşen bilgisi']] : [])
    .concat([['uretilen', 'Üretilenler' + (uretilenSay ? ' (' + uretilenSay + ')' : '')]])
    : belgeTur === 'md' ? [['gorunum', 'Biçimli'], ['kod', 'Düz metin']]
    : belgeTur === 'pptx' ? [['gorunum', 'Slaytlar'], ['notlar', 'Slaytlar + notlar']] : [];
  $('ozSekme').innerHTML = sekmeler.map(([k, a]) => `<button data-sekme="${k}" aria-pressed="${k === sekme}">${a}</button>`).join('');
  $('ozEylem').innerHTML = `
    ${d.meta ? '<button class="dugme" data-a="yenidenDene" title="Pinin görselinden yeni bir yaklaşımla yeniden üret"><span class="ms">refresh</span>Yeniden dene</button>' : ''}
    ${html ? '<button class="dugme" data-a="varyasyon" title="3 farklı tasarım dilinde varyasyon"><span class="ms">auto_awesome_mosaic</span>Varyasyon oluştur</button>' : ''}
    ${html ? '<button class="dugme" data-a="kopyala"><span class="ms">content_copy</span>Kodu kopyala</button>' : ''}
    ${html || belgeTur || u === 'pdf' ? '<button class="dugme" data-a="tamEkran" title="Tam ekran"><span class="ms">fullscreen</span>Tam ekran</button>' : ''}
    ${d.meta ? '<button class="dugme ana-d" data-a="atolyeye"><span class="ms">auto_awesome</span>Tasarım Atölyesi\'ne ekle</button>' : ''}
    <button class="dugme" data-a="yeniSekme"><span class="ms">open_in_new</span>Aç</button>
    <button class="dugme" data-a="indir"><span class="ms">download</span>İndir</button>`;
  const g = $('ozGovde');
  g.innerHTML = '<pre>Yükleniyor…</pre>';
  try{
    if(html && sekme === 'gorunum'){
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts');
      f.title = d.ad;
      onizlemeYaz(f, guvenli(await htmlHazirla(d)));
      g.replaceChildren(f);
    }else if(belgeTur === 'md' && sekme === 'gorunum'){
      const b = await belgeMod();
      g.innerHTML = `<article class="belge md-belge">${b.markdown(await dosyaMetni(d))}</article>`;
    }else if(belgeTur === 'docx'){
      const b = await belgeMod();
      g.innerHTML = `<div class="belge-zemin"><article class="belge dx-belge">${await b.docx(await (await dosyaBlob(d)).arrayBuffer()) || '<p>Belgede metin yok.</p>'}</article></div>`;
    }else if(belgeTur === 'pptx'){
      const b = await belgeMod();
      const {oran, slaytlar} = await b.pptx(await (await dosyaBlob(d)).arrayBuffer());
      const notlu = sekme === 'notlar';
      g.innerHTML = slaytlar.length ? `<div class="sunum">${slaytlar.map(s => `
        <section class="slayt-sira">
          <div class="slayt-no">${s.no} / ${slaytlar.length}${s.baslik ? ' · ' + esc(s.baslik) : ''}</div>
          <div class="slayt" style="aspect-ratio:${oran.toFixed(4)}${s.bg ? ';background:' + s.bg : ''}">${s.html}</div>
          ${notlu && s.not ? `<div class="slayt-not"><b>Konuşmacı notu</b>${s.not}</div>` : ''}
        </section>`).join('')}</div>` : bosKutu('slideshow', 'Slayt bulunamadı', 'Sunum boş ya da okunamadı.');
    }else if(sekme === 'uretilen'){
      uretilenCiz(d);
    }else if(sekme === 'bilgi'){
      const m = await metaOku(d);
      const k = m && m.kaynak || {};
      g.innerHTML = `<div class="meta">${k.pin ? '<figure class="pin-gorsel" id="pinGorsel"><span>Pin görseli yükleniyor…</span></figure>' : ''}<dl>
        <dt>Bileşen</dt><dd>${esc((m && m.components || []).map(c => c.name).join(', ') || '—')}</dd>
        <dt>Açıklama</dt><dd>${esc((m && m.components && m.components[0] && m.components[0].description) || '—')}</dd>
        <dt>Pin</dt><dd>${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener noreferrer">${esc(k.baslik || k.pin)}</a>` : '—'}</dd>
        <dt>Pano</dt><dd>${esc([k.ust, k.pano].filter(Boolean).join(' › ') || '—')}</dd>
        <dt>Renkler</dt><dd>${(m && m.components && m.components[0] && m.components[0].colors || []).map(c => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:10px"><i style="width:14px;height:14px;border-radius:4px;background:${esc(c)};display:inline-block;border:1px solid #334155"></i><code>${esc(c)}</code></span>`).join('') || '—'}</dd>
        <dt>Yazı tipleri</dt><dd>${esc((m && m.components && m.components[0] && m.components[0].fonts || []).join(', ') || '—')}</dd>
        <dt>Üretim</dt><dd>${esc(m ? tarihYaz(m.uretildi) + ' · Tasarım Atölyesi · ' + (m.seviye || '') : '—')}</dd>
      </dl></div>`;
      /* Kaynak pinin görseli — Pinterest Panolarım'ın detay dosyasından. */
      if(k.pin){
        pinGorseli(k.pin).then(b64 => {
          const f = $('pinGorsel');
          if(f) f.innerHTML = `<img alt="Kaynak pin: ${esc(k.baslik || k.pin)}" src="data:image/webp;base64,${b64}"><figcaption>Kaynak pin · ${esc(k.baslik || k.pin)}</figcaption>`;
        }).catch(() => { const f = $('pinGorsel'); if(f) f.innerHTML = '<span>Pin görseli bulunamadı.</span>'; });
      }
    }else if(RESIM.has(u)){
      g.innerHTML = `<div class="resim-kutu"><img alt="${esc(d.ad)}" src="${esc(await dosyaURL(d))}"></div>`;
    }else if(u === 'pdf'){
      const f = document.createElement('iframe');
      f.title = d.ad; f.src = await dosyaURL(d, 'application/pdf');
      g.replaceChildren(f);
    }else if(html || METIN.has(u) || (d.boyut != null && d.boyut < 400000)){
      let t = await dosyaMetni(d);
      if(u === 'json'){ try{ t = JSON.stringify(JSON.parse(t), null, 2); }catch(e){} }
      if(t.length > 400000) t = t.slice(0, 400000) + '\n\n… (ilk 400 KB gösteriliyor)';
      g.innerHTML = `<pre>${esc(t)}</pre>`;
    }else{
      g.innerHTML = bosKutu('visibility_off', 'Önizleme yok', 'Bu dosya türü burada gösterilemiyor — indirip açabilirsin.');
    }
  }catch(e){
    g.innerHTML = bosKutu('error', 'Dosya okunamadı', e.message);
  }
}
function onizlemeKapat(){ $('onizleme').hidden = true; $('ozGovde').innerHTML = ''; D.oz = null; }

async function atolyeyeEkle(d){
  const m = await metaOku(d);
  if(!m || !m.components) return bildir('Bileşen bilgisi okunamadı.');
  const kutuphane = oku(ATOLYE, []);
  let n = 0;
  m.components.forEach((c, i) => {
    const id = `pin-${m.kaynak.pin}-${i}`;
    if(kutuphane.some(x => x.id === id)) return;
    kutuphane.unshift({id, name: c.name || 'Bileşen', description: c.description || '', code: c.code || '',
      mobileCode: c.mobileCode || undefined, colors: c.colors || [], fonts: c.fonts || [],
      parts: (c.parts || []).map((p, j) => ({name: p.name || `Parça ${j + 1}`, code: p.code || '', id: `${id}-p${j}`})),
      savedAt: Date.now()});
    n++;
  });
  yaz(ATOLYE, kutuphane);
  bildir(n ? `${n} bileşen Tasarım Atölyesi kütüphanesine eklendi.` : 'Bu bileşen kütüphanede zaten var.');
}

/* ---------- Tasarım Atölyesi: yeniden dene · varyasyon ----------
   İstemler Tasarım Atölyesi'nin bilesenUret(yeniden) ve varyasyonUret'iyle
   aynı; üretim yayındaki /api/tasarim vekilinden (anahtar yalnız sunucuda).
   Sonuçlar bu dosyaya bağlı olarak 'dosya-yoneticisi-uretilen' anahtarında
   durur (Astra şifreli kasaya eşitler); istenen Tasarım Atölyesi'ne eklenir. */
const URETILEN = 'dosya-yoneticisi-uretilen';
let uretilen = oku(URETILEN, {});
const uretilenKaydet = () => yaz(URETILEN, uretilen);
const anahtar = d => d.yerel ? 'yerel:' + d.ad : d.yol;
const calisan = new Set();                 // üretimi süren dosyalar

const YENIDEN = `STRATEGY CHANGE: The previous attempt was insufficient. Use a completely fresh perspective. Focus on high-end SaaS aesthetics, extreme attention to whitespace, and complex Tailwind v4 utility combinations.

### Engineering Requirements:
1. **Full Component Logic**: The "code" field must contain a self-contained, valid HTML block.
2. **Mobile Awareness**: If any of the provided images look like a mobile app or mobile layout, prioritize that as the primary design.
3. **Tailwind v4 Power**: Use the latest Tailwind v4 capabilities.
4. **Responsive Design**: Ensure mobile-first responsiveness.
5. **Typography Extraction**: Identify the exact font families.
6. **Icons**: Use Material Symbols Outlined exclusively.
7. Write all visible descriptions in Turkish.

### Response Format (STRICT JSON):
{"components":[{"name":"Component Name","description":"Design rationale.","code":"<!-- Full HTML -->","mobileCode":"<!-- Mobile optimized HTML if applicable -->","colors":["#hex1","#hex2"],"fonts":["Font Name"],"parts":[{"name":"Part Name","code":"<!-- HTML -->"}]}]}`;
const varyasyonIstemi = (ad, kod) => `TASK: Generate 3 highly distinct design variations of the following HTML/Tailwind component.

ORIGINAL COMPONENT NAME: ${ad}
ORIGINAL CODE:
${kod}

### INSTRUCTIONS:
1. Overhaul the visual language for each variation while keeping the functional elements.
2. Use Tailwind v4 exclusively.
3. Variation 1: CLEAN MINIMALIST (Focus on space, subtle grays, Inter font).
4. Variation 2: DARK GLASSMORPHIC (Vibrant blurs, glowing accents, Plus Jakarta font).
5. Variation 3: PLAYFUL NEUBRUTALIST (Bold borders, high saturation, sharp shadows).
6. Write names and descriptions in Turkish.

### RESPONSE STRUCTURE (STRICT JSON):
{"components":[{"name":"Variation Title","description":"Brief style description.","code":"<!-- Full HTML -->","colors":["#hex1","#hex2"],"fonts":["Font Name"],"parts":[{"name":"Main","code":"<!-- Full HTML -->"}]}]}`;

async function tasarimUret(istek){
  /* Tasarım Atölyesi'nde seçili seviye; ücretsiz katmanda Ultra kotası yoksa Balanced'a düşülür. */
  const secili = (oku('tasarim-atolyesi-ayar', {}) || {}).seviye || 'medium';
  for(const level of secili === 'high' ? ['high', 'medium'] : [secili]){
    const r = await fetch(new URL('../../api/tasarim', location.href), {method: 'POST',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...istek, level})});
    const v = await r.json().catch(() => ({}));
    if(r.ok){
      const m = String(v.text || '').match(/\{[\s\S]*\}/);
      if(!m) throw new Error('Yapay zekâ geçerli bir tasarım yanıtı üretemedi.');
      return (JSON.parse(m[0]).components || []).filter(c => c && c.code);
    }
    const hata = v.error || 'HTTP ' + r.status;
    if(level === 'high' && /quota|429|RESOURCE_EXHAUSTED/i.test(hata)) continue;
    if(/high demand|overloaded|UNAVAILABLE/i.test(hata)) throw new Error('Gemini şu an yoğun — biraz sonra yeniden dene.');
    if(/quota|429/i.test(hata)) throw new Error('Gemini kotası doldu — bir süre sonra yeniden dene.');
    throw new Error(hata);
  }
  return [];
}

/* Pinterest pininin görseli: Pinterest Panolarım'ın detay dosyalarından (aynı CRC kovası). */
const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = s => { let c = 0xFFFFFFFF; for(const x of new TextEncoder().encode(s)) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
let pinMeta = null;
async function pinGorseli(id){
  if(!pinMeta){
    const h = await (await fetch(new URL('../pinterest-panolarim/index.html', location.href))).text();
    const m = h.match(/<script type="application\/json" id="d">([\s\S]*?)<\/script>/);
    pinMeta = m ? JSON.parse(m[1]).meta : {};
  }
  const kova = pinMeta.B || 24;
  const r = await fetch(new URL(`../pinterest-panolarim/detay/${String(crc32(id) % kova).padStart(2, '0')}.json`, location.href));
  if(r.ok){ const j = await r.json(); if(j[id] && j[id].b) return j[id].b; }
  const k = await (await fetch(new URL('../pinterest-panolarim/kucuk.json', location.href))).json();
  if(k[id]) return k[id];
  throw new Error('Pinin görseli bulunamadı.');
}

async function kaynakKod(d){
  const m = await metaOku(d);
  if(m && m.components && m.components[0]) return {ad: m.components[0].name, kod: m.components[0].code};
  const t = await dosyaMetni(d);
  const g = new DOMParser().parseFromString(t, 'text/html');
  const k = g.getElementById('k');
  return {ad: d.ad.replace(/^\d{4} · /, '').replace(/\.html?$/i, ''), kod: (k || g.body).innerHTML.trim()};
}

async function uretVeEkle(d, tur, is){
  const a = anahtar(d);
  if(calisan.has(a)) return bildir('Bu dosya için üretim zaten sürüyor.');
  calisan.add(a);
  if(D.oz && D.oz.d === d) onizle(d, 'uretilen');
  try{
    const liste = await is();
    if(!liste.length) throw new Error('Bileşen üretilemedi.');
    const yeni = liste.map((c, i) => ({id: `${tur}-${Date.now()}-${i}`, tur, name: c.name || 'Bileşen', description: c.description || '',
      code: c.code, mobileCode: c.mobileCode, colors: c.colors || [], fonts: c.fonts || [], parts: c.parts || [], tarih: Date.now()}));
    uretilen[a] = [...yeni, ...(uretilen[a] || [])];
    uretilenKaydet();
    bildir(tur === 'yeniden' ? 'Yeni sürüm üretildi.' : `${yeni.length} varyasyon üretildi.`);
  }catch(e){
    bildir(e.message || 'Üretim başarısız.');
  }finally{
    calisan.delete(a);
    if(D.oz && D.oz.d === d) onizle(d, 'uretilen');
  }
}
function yenidenDene(d){
  return uretVeEkle(d, 'yeniden', async () => {
    const m = await metaOku(d);
    if(!m || !m.kaynak || !m.kaynak.pin) throw new Error('Kaynak pin bilgisi yok.');
    const b64 = await pinGorseli(m.kaynak.pin);
    return tasarimUret({prompt: YENIDEN, system: 'You are a Lead Frontend Engineer. Output ONLY valid JSON.', images: [{base64: b64, mimeType: 'image/webp'}]});
  });
}
function varyasyonUret(d){
  return uretVeEkle(d, 'varyasyon', async () => {
    const {ad, kod} = await kaynakKod(d);
    return tasarimUret({prompt: varyasyonIstemi(ad, kod), system: 'You are a UI System Architect. Create exactly 3 distinct variations in JSON format. Do not add markdown commentary.'});
  });
}

function uretilenCiz(d){
  const a = anahtar(d), liste = uretilen[a] || [];
  const g = $('ozGovde');
  const durum = calisan.has(a)
    ? '<div class="uretim-durum"><span class="ms donen">progress_activity</span>Tasarım Atölyesi üretiyor… (30–90 sn)</div>' : '';
  g.innerHTML = `<div class="uretilen">
    <div class="uretilen-ust">
      ${d.meta ? '<button class="dugme" data-a="yenidenDene"><span class="ms">refresh</span>Yeniden dene</button>' : ''}
      <button class="dugme" data-a="varyasyon"><span class="ms">auto_awesome_mosaic</span>Varyasyon oluştur</button>
      <span class="uretilen-not">${d.meta ? 'Yeniden dene: pinin görselinden yeni bir yaklaşımla. ' : ''}Varyasyon: minimalist · cam · neubrutalist.</span>
    </div>
    ${durum}
    ${liste.length ? `<div class="uretilen-izgara">${liste.map(c => `
      <article class="uretilen-kart">
        <div class="uk-onizleme" data-uk="${esc(c.id)}"></div>
        <div class="uk-bilgi">
          <span class="uk-tur">${c.tur === 'yeniden' ? 'Yeniden' : 'Varyasyon'} · ${tarihYaz(c.tarih)}</span>
          <b>${esc(c.name)}</b><small>${esc(c.description)}</small>
        </div>
        <div class="uk-eylem">
          <button class="ikon-dugme" data-ua="buyut" data-uid="${esc(c.id)}" title="Büyüt"><span class="ms">open_in_full</span></button>
          <button class="ikon-dugme" data-ua="ekle" data-uid="${esc(c.id)}" title="Tasarım Atölyesi'ne ekle"><span class="ms">library_add</span></button>
          <button class="ikon-dugme" data-ua="kopyala" data-uid="${esc(c.id)}" title="Kodu kopyala"><span class="ms">content_copy</span></button>
          <button class="ikon-dugme" data-ua="indir" data-uid="${esc(c.id)}" title="İndir"><span class="ms">download</span></button>
          <button class="ikon-dugme" data-ua="sil" data-uid="${esc(c.id)}" title="Sil"><span class="ms">delete</span></button>
        </div>
      </article>`).join('')}</div>`
      : (calisan.has(a) ? '' : bosKutu('auto_awesome', 'Henüz üretim yok', 'Yeniden dene ya da varyasyon oluştur — sonuçlar burada birikir.'))}
  </div>`;
  g.querySelectorAll('[data-uk]').forEach(k => {
    const c = liste.find(x => x.id === k.dataset.uk);
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('loading', 'lazy'); f.tabIndex = -1;
    onizlemeYaz(f, guvenli(belge(c.code, c.name)));
    k.replaceChildren(f);
  });
}

const dosyaAdi = s => String(s || 'bilesen').replace(/[\\/:*?"<>|]+/g, '-');
async function uretilenEylem(ua, uid){
  const d = D.oz && D.oz.d;
  if(!d) return;
  const a = anahtar(d), c = (uretilen[a] || []).find(x => x.id === uid);
  if(!c) return;
  if(ua === 'buyut'){
    const g = $('ozGovde');
    g.innerHTML = `<div class="buyuk-ust"><button class="dugme" data-sekme="uretilen"><span class="ms">arrow_back</span>Üretilenler</button><b>${esc(c.name)}</b></div>`;
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts'); f.className = 'buyuk-cerceve';
    onizlemeYaz(f, guvenli(belge(c.code, c.name)));
    g.appendChild(f);
  }
  if(ua === 'kopyala'){ try{ await navigator.clipboard.writeText(c.code); bildir('Kod panoya kopyalandı.'); }catch(e){ bildir('Kopyalanamadı.'); } }
  if(ua === 'indir'){
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([belge(c.code, c.name)], {type: 'text/html'}));
    l.download = dosyaAdi(c.name) + '.html'; l.click();
  }
  if(ua === 'ekle'){
    const kutuphane = oku(ATOLYE, []);
    if(kutuphane.some(x => x.id === c.id)) return bildir('Kütüphanede zaten var.');
    kutuphane.unshift({id: c.id, name: c.name, description: c.description, code: c.code, mobileCode: c.mobileCode || undefined,
      colors: c.colors, fonts: c.fonts, parts: (c.parts || []).map((p, j) => ({name: p.name || `Parça ${j + 1}`, code: p.code || '', id: `${c.id}-p${j}`})), savedAt: Date.now()});
    yaz(ATOLYE, kutuphane);
    bildir('Tasarım Atölyesi kütüphanesine eklendi.');
  }
  if(ua === 'sil'){
    uretilen[a] = (uretilen[a] || []).filter(x => x.id !== uid);
    if(!uretilen[a].length) delete uretilen[a];
    uretilenKaydet(); onizle(d, 'uretilen');
  }
}

/* ---------- olaylar ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button, a');
  if(!t) return;
  if(t.dataset.kaynak) return kaynagaGec(t.dataset.kaynak);
  if(t.dataset.yildiz !== undefined){ return yolaGit(t.dataset.yildiz ? t.dataset.yildiz.split('/') : []); }
  if(t.dataset.sabit !== undefined){ const y = D.sabit[+t.dataset.sabit]; if(y) await yerelAc(y.tutac); return; }
  if(t.dataset.yol !== undefined) return yukari(D.yigin.length - 1 - (+t.dataset.yol));
  if(t.dataset.gorunum){ ui.gorunum = t.dataset.gorunum; uiKaydet(); return ciz(); }
  if(t.dataset.sekme && D.oz) return onizle(D.oz.d, t.dataset.sekme);
  if(t.dataset.ua) return uretilenEylem(t.dataset.ua, t.dataset.uid);
  if(t.dataset.i !== undefined){
    const d = D.gorunen[+t.dataset.i];
    if(!d) return;
    if(d.tur === 'klasor'){
      if(d._asil){ D.yigin.push(...d._yolDugum); return klasoreGir(d._asil); }
      return klasoreGir(d);
    }
    return onizle(d._asil || d);
  }
  const a = t.dataset.a;
  if(!a) return;
  if(a === 'klasorSec') return klasorSec();
  if(a === 'yenile'){ await bulutYukle(); if(D.kaynak === 'bulut') D.yigin = [D.bulut]; return ciz(); }
  if(a === 'sabitle') return sabitDegistir();
  if(a === 'yildizla'){
    const y = yildizAnahtar();
    ui.yildiz = ui.yildiz.includes(y) ? ui.yildiz.filter(x => x !== y) : [...ui.yildiz, y];
    uiKaydet(); return ciz();
  }
  const d = D.oz && D.oz.d;
  if(!d) return;
  if(a === 'kopyala'){ try{ await navigator.clipboard.writeText(await dosyaMetni(d)); bildir('Kod panoya kopyalandı.'); }catch(err){ bildir('Kopyalanamadı.'); } }
  if(a === 'indir'){ const l = document.createElement('a'); l.href = await dosyaURL(d); l.download = d.ad.replace(/^\d{4} · /, ''); l.click(); }
  if(a === 'yeniSekme'){
    const u = uzanti(d.ad);
    if(u === 'html' || u === 'htm') window.open(URL.createObjectURL(new Blob([guvenli(await htmlHazirla(d))], {type: 'text/html'})), '_blank', 'noopener');
    else window.open(await dosyaURL(d), '_blank', 'noopener');
  }
  if(a === 'tamEkran'){
    const g = $('ozGovde');
    try{ if(window.document.fullscreenElement) await window.document.exitFullscreen(); else await g.requestFullscreen(); }catch(err){ bildir('Tam ekran açılamadı.'); }
    return;
  }
  if(a === 'yenidenDene') return yenidenDene(d);
  if(a === 'varyasyon') return varyasyonUret(d);
  if(a === 'atolyeye') atolyeyeEkle(d);
});
$('geri').addEventListener('click', () => yukari());
$('ozKapat').addEventListener('click', onizlemeKapat);
$('onizleme').addEventListener('click', e => { if(e.target === $('onizleme')) onizlemeKapat(); });
$('sirala').addEventListener('change', e => { ui.sirala = e.target.value; uiKaydet(); ciz(); });
let araZ;
$('ara').addEventListener('input', e => { clearTimeout(araZ); araZ = setTimeout(() => { D.ara = e.target.value; ciz(); }, 150); });
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && D.oz){ onizlemeKapat(); return; }
  const yaziyor = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
  if(e.key === 'Backspace' && !yaziyor && !D.oz){ e.preventDefault(); yukari(); }
  if(e.key === '/' && !yaziyor && !D.oz){ e.preventDefault(); $('ara').focus(); }
});
/* Başka cihazdan gelen tercih (Astra eşitlemesi) */
addEventListener('storage', e => {
  if(e.key === UI){ Object.assign(ui, oku(UI, {})); ciz(); }
  if(e.key === URETILEN){ uretilen = oku(URETILEN, {}); if(D.oz && D.oz.sekme === 'uretilen') onizle(D.oz.d, 'uretilen'); }
});

/* #ara=… — Hukuk kartından "Belgeleri aç": adı eşleşen sabit klasörü aç. */
async function hashIsle(){
  const q = hashAra();
  if(!q) return false;
  const y = D.sabit.find(x => adEsles(x.ad, q)) || (D.yerel && adEsles(D.yerel.ad, q) ? {tutac: D.yerel.tutac, ad: D.yerel.ad} : null);
  if(y && await izinVar(y.tutac, false)){ await yerelAc(y.tutac); return true; }
  D.kaynak = 'bulut'; D.yigin = [D.bulut];
  await ciz();
  $('icerik').innerHTML = y
    ? bosKutu('lock', `"${y.ad}"`, 'Klasör bulundu; tarayıcı erişimi yeniden onaylamanı istiyor.', `<button class="dugme ana-d" data-sabit="${D.sabit.indexOf(y)}"${D.sabit.includes(y) ? '' : ' data-kaynak="yerel"'}><span class="ms">lock_open</span>Klasörü aç</button>`)
    : bosKutu('folder_special', `"${q}" klasörü sabitlenmemiş`, 'Bu bilgisayardan ilgili klasörü seç, sonra konum satırındaki ☆ ile sabitle — bir dahaki sefere doğrudan açılır.', '<button class="dugme ana-d" data-a="klasorSec"><span class="ms">folder_open</span>Klasör seç</button>');
  return true;
}
addEventListener('hashchange', () => { hashIsle(); });

/* ---------- başlangıç ---------- */
(async () => {
  D.yigin = [D.bulut];
  D.sabit = [];
  await ciz();
  await sabitYukle();
  const son = await idb('al', 'son');
  if(son){
    D.yerel = {ad: son.name, tur: 'klasor', tutac: son, yerel: true};
    D.yerelIzin = await izinVar(son, false);
  }
  await bulutYukle();
  D.yigin = [D.bulut];
  if(await hashIsle()) return;
  if(ui.sonYol && ui.sonYol.length) await yolaGit(ui.sonYol); else await ciz();
})();
