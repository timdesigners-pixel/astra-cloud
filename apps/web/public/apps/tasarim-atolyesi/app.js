/* Tasarım Atölyesi Pro — Astra APPS modülü
 *
 * Google Flow'daki "Tasarım Atölyesi Pro" aracının yeniden yazımı: React ve
 * flow-sdk yerine bağımsız, derleme istemeyen tek modül. Flow'a özgü üç şey
 * karşılığıyla değişti:
 *   Flow.media.selectMultiple → dosya seçici + sürükle-bırak + yapıştır
 *   Flow.generate.text        → /api/tasarim (Gemini vekili) ya da bu cihaza
 *                               girilmiş kendi Gemini anahtarı
 *   Flow.download             → Blob + <a download>
 * Kütüphane, geçmiş ve ayarlar localStorage'da; Astra bunları apps-durum.js
 * ile Supabase kasasına şifreli eşitler. Gemini anahtarı EŞİTLENMEZ. */

const K = {
  kutuphane: 'tasarim-atolyesi-kutuphane',
  gecmis:    'tasarim-atolyesi-gecmis',
  ayar:      'tasarim-atolyesi-ayar',
  anahtar:   'tasarim-atolyesi-anahtar',   // yalnız bu cihaz
};
const oku = (k, v) => { try{ const x = JSON.parse(localStorage.getItem(k)); return x ?? v; }catch(e){ return v; } };
const yaz = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ hataGoster('Tarayıcı deposu dolu — geçmişten eski kayıtları silin.'); } };

const MODELLER = [
  {id: 'low',    ad: 'Lite',     not: 'Hızlı, temel analizler için.',   ikon: 'bolt'},
  {id: 'medium', ad: 'Balanced', not: 'Hız ve doğruluk dengesi.',       ikon: 'balance'},
  {id: 'high',   ad: 'Ultra',    not: 'En yüksek kalite ve detay.',     ikon: 'diamond'},
];
const GEMINI = {
  high:   {model: 'gemini-3.1-pro-preview', thinkingLevel: 'high'},
  medium: {model: 'gemini-3.5-flash',       thinkingLevel: 'high'},
  low:    {model: 'gemini-3.5-flash',       thinkingLevel: 'low'},
};

const ayar = Object.assign({seviye: 'high', introGoruldu: false}, oku(K.ayar, {}));
const D = {
  sekme: 'editor',
  gorseller: [],               // {id, ad, mimeType, base64}
  uretilen: [],
  kutuphane: oku(K.kutuphane, []),
  gecmis: oku(K.gecmis, []),
  analiz: false,
  varyasyon: null,             // üretilen bileşen id'si
  hata: null,
  modelMenu: false,
  katman: ayar.introGoruldu ? null : {tur: 'intro'},
  kart: new Map(),             // id → {gorunum, mobil, mobilKod, mobilUret, kopya}
};

/* ---------- yardımcılar ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kimlik = on => `${on}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const ikon = (ad, cls = '') => `<span class="material-symbols-outlined ${cls}">${ad}</span>`;
const kartDurum = id => { if(!D.kart.has(id)) D.kart.set(id, {gorunum: 'preview', mobil: false, mobilKod: null, mobilUret: false, kopya: null}); return D.kart.get(id); };
const tumBilesenler = () => [...D.uretilen, ...D.uretilen.flatMap(c => c.variations || []), ...D.kutuphane];
const bilesenBul = id => tumBilesenler().find(c => c.id === id);
function hataGoster(m){ D.hata = m; ciz(); }
function ayarKaydet(){ yaz(K.ayar, ayar); }
function kutuphaneKaydet(){ yaz(K.kutuphane, D.kutuphane); }
function gecmisKaydet(){ yaz(K.gecmis, D.gecmis); }

async function kopyala(metin, kartId, anahtar){
  try{ await navigator.clipboard.writeText(metin); }catch(e){ return; }
  if(kartId){ const d = kartDurum(kartId); d.kopya = anahtar; ciz(); setTimeout(() => { d.kopya = null; ciz(); }, 2000); }
}
function indir(metin, ad, tur = 'text/html'){
  const url = URL.createObjectURL(new Blob([metin], {type: tur + ';charset=utf-8'}));
  const a = Object.assign(document.createElement('a'), {href: url, download: ad});
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dosyaAdi = ad => String(ad || 'bilesen').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_ğüşıöç-]/gi, '') + '.html';

/* Görseli küçült: hem istek gövdesi (Vercel 4,5 MB sınırı) hem depo için. */
function gorselKucult(kaynak, azami, kalite = 0.88){
  return new Promise((ok, red) => {
    const img = new Image();
    img.onload = () => {
      const o = Math.min(1, azami / Math.max(img.naturalWidth, img.naturalHeight));
      const c = Object.assign(document.createElement('canvas'), {width: Math.round(img.naturalWidth * o), height: Math.round(img.naturalHeight * o)});
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', kalite).split(',')[1]);
    };
    img.onerror = red;
    img.src = kaynak;
  });
}
async function dosyalariEkle(dosyalar){
  for(const f of dosyalar){
    if(!f.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(f);
    try{
      const base64 = await gorselKucult(url, 1600);
      D.gorseller.push({id: kimlik('img'), ad: f.name || 'yapistirilan.png', mimeType: 'image/jpeg', base64});
    }catch(e){ hataGoster(`${f.name} okunamadı.`); }
    finally{ URL.revokeObjectURL(url); }
  }
  D.hata = null; ciz();
}

/* ---------- yapay zekâ ---------- */
async function uret({prompt, system, images = []}){
  const istek = {prompt, system, images: images.map(g => ({base64: g.base64, mimeType: g.mimeType})), level: ayar.seviye};
  let r = null;
  try{
    r = await fetch(new URL('../../api/tasarim', location.href), {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(istek)});
  }catch(e){ r = null; }
  if(r && r.ok) return (await r.json()).text;
  const sunucuYok = !r || r.status === 404 || r.status === 405 || r.status === 503;
  if(!sunucuYok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  const anahtar = localStorage.getItem(K.anahtar);
  if(!anahtar) throw new Error('ANAHTAR_YOK');
  const m = GEMINI[ayar.seviye] || GEMINI.high;
  const parcalar = istek.images.map(g => ({inlineData: {mimeType: g.mimeType, data: g.base64}}));
  parcalar.push({text: prompt});
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.model}:generateContent`, {
    method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': anahtar},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: system}]},
      contents: [{role: 'user', parts: parcalar}],
      generationConfig: {responseMimeType: 'application/json', thinkingConfig: {thinkingLevel: m.thinkingLevel}},
    })});
  const v = await g.json().catch(() => ({}));
  if(!g.ok) throw new Error(v?.error?.message || `Gemini HTTP ${g.status}`);
  return (v.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
}
function jsonAyikla(metin){
  const m = String(metin || '').match(/\{[\s\S]*\}/);
  if(!m) throw new Error('Yapay zekâ geçerli bir tasarım yanıtı üretemedi.');
  return JSON.parse(m[0]);
}
const bilesenlestir = (liste, on) => (liste || []).map((c, i) => ({
  name: c.name || 'Bileşen', description: c.description || '', code: c.code || '',
  mobileCode: c.mobileCode || undefined, colors: c.colors || [], fonts: c.fonts || [],
  ...{id: kimlik(`${on}${i}`)},
  parts: (c.parts || []).map((p, j) => ({name: p.name || `Parça ${j + 1}`, code: p.code || '', id: kimlik(`part${i}-${j}`)})),
}));

async function bilesenUret(gorseller, yeniden){
  const yaklasim = yeniden
    ? 'STRATEGY CHANGE: The previous attempt was insufficient. Use a completely fresh perspective. Focus on high-end SaaS aesthetics, extreme attention to whitespace, and complex Tailwind v4 utility combinations.'
    : 'MISSION: Convert these UI screenshots into production-ready, high-fidelity HTML and Tailwind CSS (v4) code.';
  const prompt = `${yaklasim}

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
  const veri = jsonAyikla(await uret({prompt, system: 'You are a Lead Frontend Engineer. Output ONLY valid JSON.', images: gorseller}));
  return bilesenlestir(veri.components, 'comp');
}
async function mobilUret(c){
  const prompt = `TASK: Convert the following HTML/Tailwind component into a specialized MOBILE version.

COMPONENT NAME: ${c.name}
CODE:
${c.code}

### INSTRUCTIONS:
1. Focus on a 375px wide viewport.
2. Stack horizontal elements vertically.
3. Optimize font sizes and padding for touch devices.
4. Ensure the navigation (if any) uses a mobile-friendly pattern (e.g., hamburger or bottom nav).
5. Return ONLY the HTML code inside a JSON field.

### RESPONSE STRUCTURE (STRICT JSON):
{"mobileCode":"<!-- Full Mobile HTML -->"}`;
  return jsonAyikla(await uret({prompt, system: "You are a Senior Mobile Developer. Output ONLY valid JSON with the field 'mobileCode'."})).mobileCode;
}
async function varyasyonUret(c){
  const prompt = `TASK: Generate 3 highly distinct design variations of the following HTML/Tailwind component.

ORIGINAL COMPONENT NAME: ${c.name}
ORIGINAL CODE:
${c.code}

### INSTRUCTIONS:
1. Overhaul the visual language for each variation while keeping the functional elements.
2. Use Tailwind v4 exclusively.
3. Variation 1: CLEAN MINIMALIST (Focus on space, subtle grays, Inter font).
4. Variation 2: DARK GLASSMORPHIC (Vibrant blurs, glowing accents, Plus Jakarta font).
5. Variation 3: PLAYFUL NEUBRUTALIST (Bold borders, high saturation, sharp shadows).
6. Write names and descriptions in Turkish.

### RESPONSE STRUCTURE (STRICT JSON):
{"components":[{"name":"Variation Title","description":"Brief style description.","code":"<!-- Full HTML -->","colors":["#hex1","#hex2"],"fonts":["Font Name"],"parts":[{"name":"Main","code":"<!-- Full HTML -->"}]}]}`;
  const veri = jsonAyikla(await uret({prompt, system: 'You are a UI System Architect. Create exactly 3 distinct variations in JSON format. Do not add markdown commentary.'}));
  return bilesenlestir(veri.components, 'var');
}
function yzHatasi(e, varsayilan){
  console.error(e);
  if(e.message === 'ANAHTAR_YOK'){ D.katman = {tur: 'ayar'}; return 'Üretim için Gemini anahtarı gerekli: sunucuda tanımlı değil. Ayarlardan bu cihaza kendi anahtarınızı girin.'; }
  return varsayilan;
}

/* ---------- eylemler ---------- */
async function analizEt(yeniden = false, ozelGorsel = null){
  const kullan = ozelGorsel ? [ozelGorsel] : D.gorseller;
  if(!kullan.length || D.analiz) return;
  D.analiz = true; D.hata = null; D.sekme = 'editor'; D.katman = null;
  if(yeniden) D.uretilen = [];
  ciz();
  try{
    const bilesenler = await bilesenUret(kullan, yeniden);
    if(bilesenler.length){
      D.uretilen = [...bilesenler, ...D.uretilen];
      const onizleme = await gorselKucult(`data:${kullan[0].mimeType};base64,${kullan[0].base64}`, 240, 0.7).catch(() => '');
      D.gecmis = [{id: String(Date.now()), timestamp: Date.now(), images: [onizleme], components: bilesenler}, ...D.gecmis].slice(0, 10);
      gecmisKaydet();
      setTimeout(() => document.getElementById('sonuclar')?.scrollIntoView({behavior: 'smooth', block: 'start'}), 300);
    }
  }catch(e){
    D.hata = yzHatasi(e, 'Tasarım analiz edilemedi. Lütfen daha net bir görsel seçip tekrar deneyin.');
  }finally{ D.analiz = false; ciz(); }
}
async function varyasyonlar(id){
  const c = D.uretilen.find(x => x.id === id);
  if(!c || D.varyasyon) return;
  D.varyasyon = id; D.hata = null; ciz();
  try{
    const v = await varyasyonUret(c);
    if(!v.length) throw new Error('Boş varyasyon seti döndü.');
    c.variations = [...(c.variations || []), ...v];
  }catch(e){
    D.hata = yzHatasi(e, 'Varyasyonlar üretilemedi. Model yoğunluğu nedeniyle olabilir, lütfen birazdan tekrar deneyin.');
  }finally{ D.varyasyon = null; ciz(); }
}
async function mobilDegistir(id){
  const d = kartDurum(id), c = bilesenBul(id);
  if(!c) return;
  if(d.mobil){ d.mobil = false; return ciz(); }
  if(d.mobilKod || c.mobileCode){ d.mobilKod = d.mobilKod || c.mobileCode; d.mobil = true; return ciz(); }
  d.mobilUret = true; ciz();
  try{ d.mobilKod = await mobilUret(c); d.mobil = true; }
  catch(e){ D.hata = yzHatasi(e, 'Mobil sürüm üretilemedi.'); }
  finally{ d.mobilUret = false; ciz(); }
}
function kutuphaneyeEkle(id){
  const c = bilesenBul(id);
  if(!c || D.kutuphane.some(x => x.id === id)) return;
  const d = kartDurum(id);
  const {variations, ...temiz} = c;
  D.kutuphane = [{...temiz, mobileCode: d.mobilKod || c.mobileCode || undefined, savedAt: Date.now()}, ...D.kutuphane];
  kutuphaneKaydet(); ciz();
}
function kutuphanedenSil(id){ D.kutuphane = D.kutuphane.filter(x => x.id !== id); kutuphaneKaydet(); ciz(); }
const etkinKod = c => { const d = kartDurum(c.id); return d.mobil ? (d.mobilKod || c.code) : c.code; };

/* ---------- görünümler ---------- */
function onizlemeDoc(kod, mobil){
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
<style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#020617;color:#f1f5f9;font-family:'Plus Jakarta Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden}
#k{width:100%;min-height:100vh;display:flex;flex-direction:column;padding:${mobil ? '0' : '1.5rem'}}
.f{animation:f .6s cubic-bezier(.16,1,.3,1) forwards}@keyframes f{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}</style>
</head><body class="dark"><div id="k"><div class="f">${kod}</div></div></body></html>`;
}
/* Üretilen kod güvenilmez: sandbox yalnız betiğe izin verir, kaynak opak
   kalır — Astra'nın localStorage'ına ve kasasına erişemez. */
function onizlemeCercevesi(kod, mobil){
  return `<div class="w-full h-full relative bg-[#020617] flex items-center justify-center overflow-hidden">
    <div class="relative flex items-center justify-center ${mobil ? 'w-[375px] h-[667px] shadow-2xl rounded-[40px] border-[8px] border-slate-800 bg-[#020617]' : 'w-full h-full'}">
      ${mobil ? '<div class="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-800 rounded-b-xl z-30 flex items-center justify-center"><div class="w-6 h-0.5 bg-slate-700 rounded-full"></div></div>' : ''}
      <iframe class="w-full h-full border-none ${mobil ? 'rounded-[32px]' : ''}" title="Tasarım önizleme" sandbox="allow-scripts" srcdoc="${esc(onizlemeDoc(kod, mobil))}"></iframe>
    </div></div>`;
}

function ustBaslik(){
  const m = MODELLER.find(x => x.id === ayar.seviye) || MODELLER[2];
  return `<header class="sticky top-0 z-40 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">${ikon('architecture', 'text-white text-xl')}</div>
        <div><h1 class="font-bold text-lg text-white leading-none">Tasarım Atölyesi</h1>
          <span class="text-[9px] text-indigo-400 font-mono tracking-widest uppercase">Pro Edition</span></div>
      </div>
      <div class="flex items-center gap-2 sm:gap-4">
        <div class="relative">
          <button data-a="modelMenu" class="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all">
            ${ikon(m.ikon, 'text-indigo-400 text-sm')}<span class="text-[10px] font-black text-white uppercase">${m.ad}</span>${ikon('expand_more', 'text-slate-500 text-xs')}
          </button>
          ${D.modelMenu ? `<div class="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50">
            <div class="p-3 bg-slate-950 border-b border-slate-800"><span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Model Seçimi</span></div>
            <div class="p-2 space-y-1">${MODELLER.map(x => `
              <button data-a="seviye" data-v="${x.id}" class="w-full flex items-start gap-3 p-3 rounded-lg transition-all text-left ${ayar.seviye === x.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}">
                ${ikon(x.ikon, `text-lg mt-0.5 ${ayar.seviye === x.id ? 'text-white' : 'text-indigo-400'}`)}
                <div><div class="text-[11px] font-black uppercase">${x.ad}</div>
                <div class="text-[10px] leading-tight ${ayar.seviye === x.id ? 'text-indigo-100' : 'text-slate-500'}">${x.not}</div></div>
              </button>`).join('')}</div></div>` : ''}
        </div>
        <button data-a="sifirla" class="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Temizle">${ikon('restart_alt', 'text-xl')}</button>
        <button data-a="ayarAc" class="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Gemini anahtarı">${ikon('key', 'text-xl')}</button>
        <button data-a="introAc" class="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" title="Bilgi">${ikon('info', 'text-xl')}</button>
      </div>
    </div>
  </header>`;
}

const sekmeDugme = (id, ik, etiket) => `<button data-a="sekme" data-v="${id}" class="px-4 sm:px-8 py-3.5 rounded-xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest transition-all ${D.sekme === id ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">${ikon(ik, 'text-[20px]')}${etiket}</button>`;
const bosDurum = (ik, baslik, aciklama) => `<div class="flex flex-col items-center justify-center py-32 px-12 text-center bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-3xl space-y-4">
  <div class="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center shadow-2xl border border-slate-800">${ikon(ik, 'text-4xl text-slate-600')}</div>
  <div class="max-w-md"><h3 class="text-xl font-bold text-white">${baslik}</h3><p class="text-slate-500 text-sm mt-2 leading-relaxed">${aciklama}</p></div></div>`;

function gorselIzgara(){
  if(!D.gorseller.length) return `<div data-a="gorselSec" class="cursor-pointer h-48 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 gap-3 hover:border-indigo-500/30 transition-colors bg-black/20">
    ${ikon('add_photo_alternate', 'text-3xl')}
    <div class="text-center"><p class="font-bold text-sm text-slate-400">Görsel Havuzu Boş</p>
    <p class="text-[10px] uppercase tracking-widest">Seçin, sürükleyip bırakın ya da yapıştırın (Ctrl+V)</p></div></div>`;
  return `<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">${D.gorseller.map(g => `
    <div class="group relative aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md">
      <img src="data:${g.mimeType};base64,${g.base64}" alt="${esc(g.ad)}" class="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300">
      <div class="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button data-a="incele" data-v="${g.id}" class="p-2.5 bg-white text-black rounded-lg shadow-xl hover:scale-105" title="İncele / bölge seç">${ikon('zoom_in', 'text-base')}</button>
        <button data-a="gorselSil" data-v="${g.id}" class="p-2.5 bg-red-600 text-white rounded-lg shadow-xl hover:scale-105" title="Kaldır">${ikon('close', 'text-base')}</button>
      </div>
      <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950 to-transparent"><p class="text-[9px] text-slate-400 truncate font-mono">${esc(g.ad)}</p></div>
    </div>`).join('')}</div>`;
}

const kartSekme = (id, v, ik, etiket, aktif) => `<button data-a="kartGorunum" data-id="${id}" data-v="${v}" class="px-3 py-1.5 text-[9px] font-black rounded-md transition-all flex items-center gap-2 uppercase tracking-wider ${aktif ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">${ikon(ik, 'text-[16px]')}<span class="hidden sm:inline">${etiket}</span></button>`;

function bilesenKarti(c, {kayitli, silinebilir, tutamac, varyasyonlu, kompakt}){
  const d = kartDurum(c.id), kod = etkinKod(c), vUret = D.varyasyon === c.id;
  return `<div class="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl transition-all hover:border-indigo-500/30 w-full" data-kart="${c.id}">
    <div class="px-6 py-4 border-b border-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60">
      <div class="flex-1 min-w-0 flex items-center gap-3">
        ${tutamac ? `<div class="tutamac cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400" draggable="true" data-surukle="${c.id}" title="Sürükleyerek sırala">${ikon('drag_indicator', 'text-xl')}</div>` : ''}
        <div class="min-w-0">
          <div class="flex items-center gap-3"><h3 class="font-bold text-white truncate tracking-tight ${kompakt ? 'text-base' : 'text-lg'}">${esc(c.name)}</h3>
            ${kayitli && !silinebilir ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold border border-emerald-500/20 uppercase">KAYITLI</span>' : ''}</div>
          <p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1 italic">${esc(c.description)}</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex bg-black/40 p-1 rounded-lg border border-slate-800">
          ${kartSekme(c.id, 'preview', 'visibility', 'Önizleme', d.gorunum === 'preview')}
          ${kartSekme(c.id, 'code', 'code', 'Kod', d.gorunum === 'code')}
          ${kartSekme(c.id, 'parts', 'account_tree', 'Parçalar', d.gorunum === 'parts')}
        </div>
        <div class="h-6 w-px bg-slate-800 mx-1 hidden sm:block"></div>
        <button data-a="mobil" data-id="${c.id}" ${d.mobilUret ? 'disabled' : ''} title="Mobil Görünüm" class="p-2 rounded-lg border transition-all flex items-center gap-2 ${d.mobil ? 'bg-indigo-600 border-indigo-500 text-white px-3' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'} ${d.mobilUret ? 'animate-pulse' : ''}">
          ${ikon(d.mobilUret ? 'sync' : 'smartphone', `text-lg ${d.mobilUret ? 'animate-spin' : ''}`)}${d.mobil || d.mobilUret ? `<span class="text-[10px] font-bold uppercase">${d.mobilUret ? '...' : 'MOBİL'}</span>` : ''}</button>
        ${varyasyonlu && !kompakt ? `<button data-a="varyasyon" data-id="${c.id}" ${vUret ? 'disabled' : ''} title="Varyasyon Oluştur" class="p-2 rounded-lg border transition-all flex items-center gap-2 ${vUret ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 px-3' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'}">
          ${ikon(vUret ? 'sync' : 'auto_fix_high', `text-lg ${vUret ? 'animate-spin' : ''}`)}${vUret ? '<span class="text-[10px] font-bold">...</span>' : ''}</button>` : ''}
        <button data-a="figma" data-id="${c.id}" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700" title="Figma Export">${ikon('design_services', 'text-lg')}</button>
        ${!silinebilir ? `<button data-a="kaydet" data-id="${c.id}" ${kayitli ? 'disabled' : ''} title="${kayitli ? 'Kaydedildi' : 'Kütüphaneye Ekle'}" class="p-2 rounded-lg border transition-all ${kayitli ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}">${ikon(kayitli ? 'bookmark_added' : 'bookmark_add', 'text-lg')}</button>` : ''}
        ${silinebilir ? `<button data-a="kSil" data-id="${c.id}" class="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg border border-red-500/20" title="Kütüphaneden Sil">${ikon('delete', 'text-lg')}</button>` : ''}
      </div>
    </div>
    <div class="px-6 py-4 border-b border-slate-800/50 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex flex-col md:flex-row md:items-center gap-6">
        ${c.colors?.length ? `<div class="flex items-center gap-4"><span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Renk Paleti:</span>
          <div class="flex gap-1.5">${c.colors.map((r, i) => `<button data-a="kopyala" data-id="${c.id}" data-k="renk-${i}" data-metin="${esc(r)}" title="${d.kopya === `renk-${i}` ? 'Kopyalandı!' : esc(String(r).toUpperCase())}" class="w-6 h-6 rounded border border-white/10 shadow-lg hover:scale-110 ${d.kopya === `renk-${i}` ? 'ring-2 ring-emerald-400' : ''}" style="background:${esc(r)}"></button>`).join('')}</div>
          ${c.colors.length > 1 ? `<div class="h-2 w-12 rounded-full border border-white/10 opacity-40 hover:opacity-100" style="background:linear-gradient(to right, ${c.colors.map(esc).join(', ')})" title="Palet Gradyanı"></div>` : ''}</div>` : ''}
        ${c.fonts?.length ? `<div class="flex items-center gap-3"><span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Font:</span>
          <div class="flex flex-wrap gap-1.5">${c.fonts.map((f, i) => `<button data-a="kopyala" data-id="${c.id}" data-k="font-${i}" data-metin="${esc(f)}" class="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[9px] font-bold ${d.kopya === `font-${i}` ? 'text-emerald-400' : 'text-slate-400 hover:text-indigo-400'}">${esc(f)}</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button data-a="indir" data-id="${c.id}" class="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700" title="HTML indir">${ikon('download', 'text-lg')}</button>
        <button data-a="kopyala" data-id="${c.id}" data-k="kod" data-kod="1" class="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-black shadow-lg ${d.kopya === 'kod' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}">${ikon(d.kopya === 'kod' ? 'done' : 'content_copy', 'text-lg')}KODU KOPYALA</button>
      </div>
    </div>
    <div class="relative bg-[#020610] h-[560px] sm:h-[700px] overflow-hidden">
      ${d.gorunum === 'preview' ? onizlemeCercevesi(kod, d.mobil) : ''}
      ${d.gorunum === 'code' ? `<div class="absolute inset-0 p-6 overflow-auto bg-[#050505]"><pre class="text-xs font-mono text-indigo-400/90 whitespace-pre-wrap leading-relaxed">${esc(kod)}</pre></div>` : ''}
      ${d.gorunum === 'parts' ? `<div class="absolute inset-0 p-6 overflow-auto bg-[#050505]"><div class="grid gap-4 ${kompakt ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}">${(c.parts || []).map(p => `
        <div class="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between"><h4 class="font-bold text-white text-[10px] uppercase tracking-wider flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>${esc(p.name)}</h4>
            <button data-a="kopyala" data-id="${c.id}" data-k="${p.id}" data-parca="${p.id}" class="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500">${ikon(d.kopya === p.id ? 'check' : 'content_copy', 'text-base')}</button></div>
          <div class="h-28 overflow-auto bg-black/40 rounded-lg p-3 text-[10px] font-mono text-slate-500 border border-white/5 whitespace-pre-wrap">${esc(p.code)}</div>
        </div>`).join('') || '<p class="text-slate-500 text-sm">Parça yok.</p>'}</div></div>` : ''}
    </div>
  </div>`;
}

function galeri(){
  if(D.analiz && !D.uretilen.length) return '<div class="h-[500px] bg-slate-800/20 rounded-xl animate-shimmer border border-slate-800/50"></div>';
  const kayitli = new Set(D.kutuphane.map(x => x.id));
  return `<div class="grid grid-cols-1 gap-16 pb-20">${D.uretilen.map(c => `
    <div class="space-y-10">
      ${bilesenKarti(c, {kayitli: kayitli.has(c.id), varyasyonlu: true})}
      ${c.variations?.length ? `<div class="space-y-8 pl-4 border-l-2 border-indigo-500/20">
        <div class="flex items-center gap-3"><div class="w-7 h-7 bg-amber-500/10 rounded flex items-center justify-center">${ikon('temp_preferences_custom', 'text-amber-500 text-base')}</div>
          <h4 class="text-lg font-bold text-white tracking-tight">Tasarım Varyasyonları</h4></div>
        <div class="grid grid-cols-1 gap-8">${c.variations.map(v => bilesenKarti(v, {kayitli: kayitli.has(v.id), kompakt: true})).join('')}</div>
      </div>` : ''}
    </div>`).join('')}</div>`;
}

function atolye(){
  return `<section class="space-y-10">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-8">
      <div class="space-y-3">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
          <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>AI Engine Active</div>
        <h2 class="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-none">Tasarım <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">Atölyesi</span></h2>
        <p class="text-slate-400 text-sm max-w-xl leading-relaxed">Tasarımınızı yükleyin, tüm sayfa veya spesifik bir bölgeyi seçerek <span class="text-white font-bold">Pixel-Perfect</span> koda dönüştürün.</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-4 shrink-0">
        <button data-a="gorselSec" class="flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl active:scale-95 shadow-lg">${ikon('add_photo_alternate', 'text-indigo-400')}<span class="font-bold text-white text-sm">Görsel Seç</span></button>
        <button data-a="analiz" ${!D.gorseller.length || D.analiz ? 'disabled' : ''} class="flex items-center justify-center gap-4 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl active:scale-95 disabled:opacity-30 text-sm shadow-xl shadow-indigo-600/20">
          ${ikon(D.analiz ? 'sync' : 'bolt', D.analiz ? 'animate-spin' : '')}${D.analiz ? 'İŞLENİYOR...' : 'KODA DÖNÜŞTÜR'}</button>
      </div>
    </div>
    <div id="havuz" class="bg-slate-900/40 rounded-2xl p-4 sm:p-8 border border-slate-800/60 backdrop-blur-xl shadow-inner">${gorselIzgara()}</div>
  </section>
  ${D.hata ? `<div class="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-200 flex items-center justify-between gap-4 shadow-lg">
    <div class="flex items-center gap-4">${ikon('error', 'text-red-500 text-3xl')}<div><p class="font-black text-xs uppercase tracking-widest text-red-400">Analiz Hatası</p><p class="text-sm mt-1">${esc(D.hata)}</p></div></div>
    <button data-a="hataKapat" class="p-2 hover:bg-white/5 rounded-full">${ikon('close', 'text-sm')}</button></div>` : ''}
  ${D.uretilen.length || D.analiz ? `<section id="sonuclar" class="pt-20 border-t border-slate-800/50 space-y-12">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4"><div class="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">${ikon('terminal', 'text-emerald-500')}</div>
        <div><h2 class="text-2xl font-bold text-white tracking-tight">Üretilen Çıktılar</h2><p class="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">AI Output Stream</p></div></div>
      ${D.uretilen.length && !D.analiz ? `<button data-a="yeniden" class="flex items-center gap-3 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs font-bold shadow-lg">${ikon('refresh', 'text-base')}Yeniden Dene</button>` : ''}
    </div>${galeri()}</section>` : ''}`;
}

function kutuphane(){
  return `<section class="space-y-12">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div><h2 class="text-4xl font-extrabold text-white tracking-tight">Kütüphanem</h2>
        <div class="flex items-center gap-3 mt-2">${ikon('drag_pan', 'text-indigo-400 text-sm')}<p class="text-slate-500 text-xs font-medium">Bileşenleri sıralamak için simgeden tutarak sürükleyin.</p></div></div>
      ${D.kutuphane.length ? `<p class="text-indigo-400 font-black bg-indigo-500/10 px-5 py-2.5 rounded-xl border border-indigo-500/20 text-[10px] tracking-widest uppercase shadow-lg">${D.kutuphane.length} MODÜL HAZIR</p>` : ''}
    </div>
    ${D.kutuphane.length ? `<div id="kutuphaneListe" class="space-y-10">${D.kutuphane.map(c => `<div data-sira="${c.id}">${bilesenKarti(c, {kayitli: true, silinebilir: true, tutamac: true})}</div>`).join('')}</div>`
      : bosDurum('bookmark', 'Kütüphane Henüz Boş', 'Atölye sekmesinde ürettiğiniz bileşenleri kaydederek burada biriktirebilir ve tek bir siteye dönüştürebilirsiniz.')}
  </section>`;
}

function gecmis(){
  return `<section class="space-y-12">
    <div class="flex items-center gap-4"><div class="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">${ikon('history', 'text-amber-500')}</div>
      <h2 class="text-4xl font-extrabold text-white tracking-tight">Geçmiş</h2></div>
    ${D.gecmis.length ? `<div class="grid grid-cols-1 gap-4">${D.gecmis.map(g => `
      <button data-a="gecmisAc" data-v="${g.id}" class="flex items-center gap-4 sm:gap-8 p-6 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/30 rounded-2xl transition-all text-left group shadow-lg">
        <div class="w-20 h-20 rounded-xl overflow-hidden border border-slate-700 shrink-0 shadow-2xl bg-slate-800">${g.images?.[0] ? `<img src="data:image/jpeg;base64,${g.images[0]}" class="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700" alt="">` : ''}</div>
        <div class="flex-1"><div class="flex items-center gap-3 flex-wrap"><h4 class="font-black text-white text-sm tracking-widest uppercase">Oturum #${esc(g.id.slice(-4))}</h4>
          <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-500 text-[9px] font-bold">${g.components.length} Bileşen</span></div>
          <p class="text-slate-500 text-xs mt-2 font-mono">${new Date(g.timestamp).toLocaleString('tr-TR')}</p></div>
        <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">${ikon('arrow_forward', 'text-slate-500 group-hover:text-white')}</div>
      </button>`).join('')}</div>` : bosDurum('history', 'Üretim Kaydı Yok', 'Son yaptığınız tasarımlar ve kodları burada saklanır.')}
  </section>`;
}

/* ---------- katmanlar (modal) ---------- */
const ozellik = (ik, baslik, not, renk) => `<div class="flex items-center gap-4 text-left"><div class="w-10 h-10 shrink-0 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center">${ikon(ik, `${renk} text-xl`)}</div>
  <div class="space-y-0.5"><h4 class="font-bold text-slate-100 text-xs">${baslik}</h4><p class="text-slate-500 text-[10px] leading-relaxed">${not}</p></div></div>`;
function introKatman(){
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#020610]/95 backdrop-blur-md">
    <div class="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center">
      <div class="w-full bg-slate-900 p-10 flex flex-col items-center relative overflow-hidden border-b border-slate-800">
        <svg class="absolute inset-0 opacity-10" width="100%" height="100%"><defs><pattern id="izgara" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" stroke-width="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#izgara)"/></svg>
        <div class="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center shadow-2xl z-10 rotate-3">${ikon('architecture', 'text-4xl text-white')}</div>
        <h2 class="mt-6 z-10 text-2xl font-bold text-white tracking-tight">Tasarım Atölyesi Pro</h2>
        <p class="z-10 text-indigo-400 font-bold mt-1 uppercase text-[9px] tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Astra APPS Sürümü</p>
      </div>
      <div class="p-8 w-full space-y-6">
        <div class="space-y-4">
          ${ozellik('crop_free', 'Bölge Analizi', 'Görselin yalnız bir bölgesini seçip koda dönüştür.', 'text-indigo-400')}
          ${ozellik('drag_pan', 'Sürükle-Taşı Hiyerarşisi', 'Kütüphanedeki bileşenleri saniyeler içinde sırala.', 'text-indigo-400')}
          ${ozellik('web', 'Site Şablonu Export', 'Tüm tasarımı tek bir HTML dosyası olarak indir.', 'text-emerald-400')}
          ${ozellik('cloud_sync', 'Bulut Kütüphane', 'Kütüphane ve geçmiş Astra kasasına şifreli eşitlenir.', 'text-amber-400')}
        </div>
        <button data-a="introKapat" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-600/20 active:scale-[0.98] mt-4 text-sm flex items-center justify-center gap-3">PRO ATÖLYEYE GİRİŞ YAP ${ikon('arrow_forward', 'text-lg')}</button>
      </div>
    </div></div>`;
}
function ayarKatman(){
  const var_ = !!localStorage.getItem(K.anahtar);
  return `<div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
    <div class="max-w-lg w-full bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl p-6 space-y-5">
      <div class="flex items-center justify-between"><h3 class="text-white font-bold flex items-center gap-2">${ikon('key', 'text-indigo-400')}Gemini Anahtarı</h3>
        <button data-a="katmanKapat" class="p-2 hover:bg-slate-800 rounded-lg text-slate-500">${ikon('close')}</button></div>
      <p class="text-xs text-slate-400 leading-relaxed">Üretim önce Astra sunucusundaki anahtarla (<code class="text-indigo-300">GEMINI_API_KEY</code>) denenir. Sunucuda anahtar yoksa buraya kendi anahtarınızı girebilirsiniz: <b class="text-slate-200">yalnız bu cihazda</b> saklanır, bulut senkronuna ve yedeklere girmez, istekler doğrudan Google'a gider.</p>
      <input id="anahtarGir" type="password" autocomplete="off" placeholder="${var_ ? 'Kayıtlı — değiştirmek için yeni anahtar girin' : 'AIza…'}" class="w-full px-4 py-3 bg-black/40 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-indigo-500">
      <div class="flex justify-end gap-3">
        ${var_ ? `<button data-a="anahtarSil" class="px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-bold text-xs">Anahtarı Sil</button>` : ''}
        <button data-a="anahtarKaydet" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs">Kaydet</button>
      </div>
    </div></div>`;
}
function figmaJson(c){
  return JSON.stringify({name: c.name, type: 'FRAME', styles: {colors: c.colors, fonts: c.fonts}, htmlContent: c.code,
    description: c.description, source: 'Tasarım Atölyesi Pro', version: '1.0'}, null, 2);
}
function figmaKatman(c){
  return `<div class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
    <div class="max-w-xl w-full bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
      <div class="p-6 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3"><div class="w-8 h-8 bg-[#1e1e1e] rounded-md flex items-center justify-center">
          <svg width="12" height="18" viewBox="0 0 16 24" fill="none"><path d="M4 0C1.8 0 0 1.8 0 4s1.8 4 4 4h4V0H4Z" fill="#F24E1E"/><path d="M12 0c-2.2 0-4 1.8-4 4v4h4c2.2 0 4-1.8 4-4s-1.8-4-4-4Z" fill="#FF7262"/><path d="M4 8C1.8 8 0 9.8 0 12s1.8 4 4 4 4-1.8 4-4V8H4Z" fill="#A259FF"/><path d="M12 8c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4V8h4Z" fill="#1ABCFE"/><path d="M4 16c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4v-4H4Z" fill="#0ACF83"/></svg></div>
          <div><h3 class="text-white font-bold">Figma Export</h3><p class="text-[10px] text-slate-500 uppercase tracking-widest font-black">JSON Layer Definition</p></div></div>
        <button data-a="katmanKapat" class="p-2 hover:bg-slate-800 rounded-lg text-slate-500">${ikon('close')}</button>
      </div>
      <div class="p-8 space-y-6">
        <div class="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg space-y-2"><h4 class="text-xs font-bold text-indigo-400">Nasıl Kullanılır?</h4>
          <ul class="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed"><li>Aşağıdaki JSON verisini kopyalayın.</li>
          <li>Figma'da <b>"HTML to Design"</b> veya benzeri JSON tabanlı eklentileri kullanın.</li>
          <li>Veri, bileşenin renk, font ve HTML yapısını eklentilere aktarmak için düzenlenmiştir.</li></ul></div>
        <div class="relative"><pre class="h-48 overflow-auto bg-black p-4 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-500 whitespace-pre-wrap">${esc(figmaJson(c))}</pre>
          <button data-a="figmaKopya" data-id="${c.id}" class="absolute top-3 right-3 px-4 py-2 rounded-lg font-bold text-[10px] flex items-center gap-2 shadow-xl ${D.katman.kopya ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}">${ikon(D.katman.kopya ? 'done' : 'content_copy', 'text-sm')}${D.katman.kopya ? 'KOPYALANDI' : 'JSON KOPYALA'}</button></div>
        <div class="flex justify-end"><button data-a="katmanKapat" class="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs">Kapat</button></div>
      </div>
    </div></div>`;
}
function siteKodu(){
  const icerik = D.kutuphane.map(c => `<!-- Component: ${c.name} -->\n${c.code}`).join('\n\n');
  return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tasarım Atölyesi Export</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <style>body { font-family: 'Plus Jakarta Sans', sans-serif; scroll-behavior: smooth; }</style>
</head>
<body class="bg-white text-slate-900">
    ${icerik}
</body>
</html>`;
}
function disaAktarKatman(){
  return `<div class="fixed inset-0 z-[100] bg-[#020610] flex flex-col">
    <div class="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0a0c10] gap-2 flex-wrap">
      <div class="flex items-center gap-3"><div class="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center">${ikon('web', 'text-white text-base')}</div>
        <div><h3 class="text-white font-bold text-base leading-none">Web Sitesi Export</h3><p class="text-slate-500 text-[9px] uppercase tracking-widest font-black mt-1">${D.kutuphane.length} Bileşen Birleştirildi</p></div></div>
      <div class="flex items-center gap-2">
        <button data-a="siteKopya" class="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs ${D.katman.kopya ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}">${ikon(D.katman.kopya ? 'done' : 'content_copy', 'text-base')}KODU KOPYALA</button>
        <button data-a="siteIndir" class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-lg shadow-indigo-600/20">${ikon('download', 'text-base')}DOSYA OLARAK İNDİR</button>
        <div class="w-px h-6 bg-slate-800 mx-2"></div>
        <button data-a="katmanKapat" class="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white">${ikon('close', 'text-xl')}</button>
      </div>
    </div>
    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <div class="w-full lg:w-72 border-r border-slate-800 bg-slate-900/30 overflow-auto p-4 space-y-3 max-h-48 lg:max-h-none">
        <h4 class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Export Sırası</h4>
        ${D.kutuphane.map((c, i) => `<div class="p-3 bg-slate-800/40 border border-slate-700 rounded-lg flex items-center gap-3"><span class="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400">${i + 1}</span><span class="text-xs font-bold text-slate-300 truncate">${esc(c.name)}</span></div>`).join('')}
      </div>
      <div class="flex-1 bg-black relative">${onizlemeCercevesi(D.kutuphane.map(c => c.code).join('\n'), false)}</div>
    </div></div>`;
}
function inceleKatman(){
  const k = D.katman, g = k.gorsel;
  const src = `data:${g.mimeType};base64,${g.base64}`;
  return `<div class="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col">
    <div class="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-black/50 gap-3 flex-wrap">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-3">${ikon('zoom_in', 'text-indigo-400')}<h3 class="text-white font-bold truncate max-w-[200px]">${esc(g.ad)}</h3></div>
        <div class="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          <button data-a="inceleMod" data-v="inspect" class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${k.mod === 'inspect' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">${ikon('visibility', 'text-sm')}GÖZLEM</button>
          <button data-a="inceleMod" data-v="region" class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${k.mod === 'region' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">${ikon('crop_free', 'text-sm')}BÖLGE ANALİZİ</button>
        </div>
      </div>
      <div class="flex items-center gap-4">
        ${k.mod === 'inspect' ? `<div class="flex items-center gap-2 pr-4 border-r border-white/10">
          <button data-a="zoom" data-v="-0.25" class="p-2 hover:bg-white/10 rounded-full text-white">${ikon('zoom_out')}</button>
          <span class="text-xs text-slate-500 font-mono w-12 text-center">${Math.round(k.zoom * 100)}%</span>
          <button data-a="zoom" data-v="0.25" class="p-2 hover:bg-white/10 rounded-full text-white">${ikon('zoom_in')}</button></div>` : ''}
        ${k.mod === 'region' && k.kirpik ? `<button data-a="bolgeAnaliz" class="flex items-center gap-3 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-600/20">${ikon('bolt', 'text-sm')}SEÇİLİ BÖLGEYİ ANALİZ ET</button>` : ''}
        <button data-a="katmanKapat" class="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs">${ikon('close', 'text-sm')}KAPAT</button>
      </div>
    </div>
    <div class="flex-1 overflow-auto p-6 sm:p-12 relative flex items-center justify-center">
      ${k.mod === 'inspect'
        ? `<div class="transition-transform duration-200 ease-out shadow-2xl" style="transform:scale(${k.zoom})"><img src="${src}" alt="${esc(g.ad)}" class="max-w-none rounded-lg border border-white/5"></div>`
        : `<div id="bolgeKutu" class="relative cursor-crosshair select-none shadow-2xl overflow-hidden rounded-lg bg-slate-900 border border-white/10 w-fit h-fit touch-none">
            <img id="bolgeGorsel" src="${src}" alt="Seçim hedefi" class="max-h-[75vh] block object-contain" draggable="false">
            <div id="bolgeKarart" class="absolute inset-0 bg-black/50 pointer-events-none ${k.secim ? '' : 'hidden'}"></div>
            <div id="bolgeCerceve" class="absolute border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.6)] pointer-events-none ${k.secim ? '' : 'hidden'}" style="${k.secim ? `left:${k.secim.x}px;top:${k.secim.y}px;width:${k.secim.w}px;height:${k.secim.h}px` : ''}">
              <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></div><div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></div>
              <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></div><div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></div>
              <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl flex items-center gap-2">${ikon('target', 'text-xs')}ANALİZ BÖLGESİ</div>
            </div></div>`}
    </div>
    <div class="p-4 text-center bg-black/50 border-t border-white/5"><p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">${k.mod === 'inspect' ? 'Detayları incelemek için zoom araçlarını kullanın' : 'Analiz etmek istediğiniz bölgeyi görsel üzerinde seçin'}</p></div>
  </div>`;
}
function katman(){
  const k = D.katman;
  if(!k) return '';
  if(k.tur === 'intro') return introKatman();
  if(k.tur === 'ayar') return ayarKatman();
  if(k.tur === 'figma'){ const c = bilesenBul(k.id); return c ? figmaKatman(c) : ''; }
  if(k.tur === 'disa') return disaAktarKatman();
  if(k.tur === 'incele') return inceleKatman();
  return '';
}

/* ---------- çizim ---------- */
function ciz(){
  const y = scrollY;
  document.getElementById('kok').innerHTML = `${ustBaslik()}
    <div class="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="inline-flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 backdrop-blur-xl shrink-0 shadow-2xl flex-wrap">
        ${sekmeDugme('editor', 'edit_square', 'Atölye')}${sekmeDugme('library', 'library_books', `Kütüphane (${D.kutuphane.length})`)}${sekmeDugme('history', 'history', 'Geçmiş')}
      </div>
      ${D.kutuphane.length ? `<button data-a="disaAc" class="flex items-center gap-4 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-xl shadow-emerald-600/20 active:scale-95 border border-emerald-400/20 uppercase tracking-widest">${ikon('web', 'text-lg')}SİTE ŞABLONUNA DÖNÜŞTÜR</button>` : ''}
    </div>
    <main class="max-w-7xl mx-auto px-4 pb-32 space-y-12">${D.sekme === 'editor' ? atolye() : D.sekme === 'library' ? kutuphane() : gecmis()}</main>
    ${D.modelMenu ? '<div data-a="modelKapat" class="fixed inset-0 z-30"></div>' : ''}`;
  document.getElementById('katman').innerHTML = katman();
  scrollTo(0, y);
  bolgeBagla();
}

/* ---------- bölge seçimi ---------- */
function bolgeBagla(){
  const kutu = document.getElementById('bolgeKutu'), img = document.getElementById('bolgeGorsel');
  if(!kutu || !img) return;
  const cer = document.getElementById('bolgeCerceve'), kar = document.getElementById('bolgeKarart');
  let bas = null, son = null;
  const nokta = e => { const r = img.getBoundingClientRect();
    return {x: Math.max(0, Math.min(e.clientX - r.left, r.width)), y: Math.max(0, Math.min(e.clientY - r.top, r.height))}; };
  const kutuHesap = () => ({x: Math.min(bas.x, son.x), y: Math.min(bas.y, son.y), w: Math.abs(bas.x - son.x), h: Math.abs(bas.y - son.y)});
  const goster = s => { cer.classList.remove('hidden'); kar.classList.remove('hidden');
    Object.assign(cer.style, {left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px'}); };
  kutu.addEventListener('pointerdown', e => { bas = son = nokta(e); kutu.setPointerCapture(e.pointerId); });
  kutu.addEventListener('pointermove', e => { if(!bas) return; son = nokta(e); goster(kutuHesap()); });
  kutu.addEventListener('pointerup', () => {
    if(!bas) return;
    const s = kutuHesap(); bas = null;
    if(s.w <= 10 || s.h <= 10) return;
    const oX = img.naturalWidth / img.clientWidth, oY = img.naturalHeight / img.clientHeight;
    const c = Object.assign(document.createElement('canvas'), {width: Math.round(s.w * oX), height: Math.round(s.h * oY)});
    c.getContext('2d').drawImage(img, s.x * oX, s.y * oY, s.w * oX, s.h * oY, 0, 0, c.width, c.height);
    D.katman.secim = s;
    D.katman.kirpik = c.toDataURL('image/jpeg', 0.9).split(',')[1];
    ciz();
  });
}

/* ---------- sürükle-taşı (kütüphane sırası) ---------- */
let surulen = null;
document.addEventListener('dragstart', e => {
  const t = e.target.closest?.('[data-surukle]');
  if(!t) return;
  surulen = t.dataset.surukle;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', surulen);
  const sat = document.querySelector(`[data-sira="${surulen}"]`);
  if(sat){ e.dataTransfer.setDragImage(sat, 40, 40); setTimeout(() => sat.classList.add('suruklenen'), 0); }
});
document.addEventListener('dragover', e => {
  if(surulen){
    const hedef = e.target.closest?.('[data-sira]');
    if(!hedef) return;
    e.preventDefault();
    document.querySelectorAll('.birak-hedef').forEach(x => x.classList.remove('birak-hedef'));
    if(hedef.dataset.sira !== surulen) hedef.classList.add('birak-hedef');
    return;
  }
  if(e.dataTransfer?.types?.includes('Files') && D.sekme === 'editor') e.preventDefault();
});
document.addEventListener('drop', e => {
  if(surulen){
    e.preventDefault();
    const hedef = e.target.closest?.('[data-sira]');
    if(hedef && hedef.dataset.sira !== surulen){
      const i = D.kutuphane.findIndex(x => x.id === surulen), j = D.kutuphane.findIndex(x => x.id === hedef.dataset.sira);
      const r = hedef.getBoundingClientRect(), sonra = e.clientY > r.top + r.height / 2;
      const [oge] = D.kutuphane.splice(i, 1);
      let yeni = D.kutuphane.findIndex(x => x.id === hedef.dataset.sira) + (sonra ? 1 : 0);
      if(j < 0) yeni = D.kutuphane.length;
      D.kutuphane.splice(yeni, 0, oge);
      kutuphaneKaydet();
    }
    surulen = null; ciz();
    return;
  }
  if(e.dataTransfer?.files?.length && D.sekme === 'editor'){ e.preventDefault(); dosyalariEkle([...e.dataTransfer.files]); }
});
document.addEventListener('dragend', () => { if(surulen){ surulen = null; ciz(); } });
document.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith('image/'));
  if(f.length && D.sekme === 'editor'){ e.preventDefault(); dosyalariEkle(f); }
});
document.getElementById('dosya').addEventListener('change', e => { dosyalariEkle([...e.target.files]); e.target.value = ''; });

/* ---------- tıklamalar ---------- */
const EYLEM = {
  modelMenu: () => { D.modelMenu = !D.modelMenu; },
  modelKapat: () => { D.modelMenu = false; },
  seviye: v => { ayar.seviye = v; D.modelMenu = false; ayarKaydet(); },
  sifirla: () => { D.uretilen = []; D.gorseller = []; D.hata = null; D.kart.clear(); },
  introAc: () => { D.katman = {tur: 'intro'}; },
  introKapat: () => { D.katman = null; ayar.introGoruldu = true; ayarKaydet(); },
  ayarAc: () => { D.katman = {tur: 'ayar'}; },
  anahtarKaydet: () => { const v = document.getElementById('anahtarGir')?.value.trim(); if(v) try{ localStorage.setItem(K.anahtar, v); }catch(e){} D.katman = null; D.hata = null; },
  anahtarSil: () => { try{ localStorage.removeItem(K.anahtar); }catch(e){} D.katman = null; },
  katmanKapat: () => { D.katman = null; },
  sekme: v => { D.sekme = v; },
  gorselSec: () => { document.getElementById('dosya').click(); return false; },
  gorselSil: v => { D.gorseller = D.gorseller.filter(g => g.id !== v); },
  incele: v => { const g = D.gorseller.find(x => x.id === v); if(g) D.katman = {tur: 'incele', gorsel: g, mod: 'inspect', zoom: 1}; },
  inceleMod: v => { D.katman.mod = v; D.katman.secim = null; D.katman.kirpik = null; },
  zoom: v => { D.katman.zoom = Math.max(0.5, Math.min(3, D.katman.zoom + Number(v))); },
  bolgeAnaliz: () => { const k = D.katman; analizEt(false, {...k.gorsel, id: kimlik('kirpik'), base64: k.kirpik, mimeType: 'image/jpeg'}); return false; },
  analiz: () => { analizEt(false); return false; },
  yeniden: () => { analizEt(true); return false; },
  hataKapat: () => { D.hata = null; },
  kartGorunum: (v, el) => { kartDurum(el.dataset.id).gorunum = v; },
  mobil: (v, el) => { mobilDegistir(el.dataset.id); return false; },
  varyasyon: (v, el) => { varyasyonlar(el.dataset.id); return false; },
  figma: (v, el) => { D.katman = {tur: 'figma', id: el.dataset.id}; },
  figmaKopya: (v, el) => { const c = bilesenBul(el.dataset.id); if(c) navigator.clipboard.writeText(figmaJson(c)).then(() => { D.katman.kopya = true; ciz(); setTimeout(() => { if(D.katman) { D.katman.kopya = false; ciz(); } }, 2000); }); return false; },
  kaydet: (v, el) => { kutuphaneyeEkle(el.dataset.id); return false; },
  kSil: (v, el) => { kutuphanedenSil(el.dataset.id); return false; },
  kopyala: (v, el) => {
    const c = bilesenBul(el.dataset.id);
    const metin = el.dataset.kod ? etkinKod(c) : el.dataset.parca ? c.parts.find(p => p.id === el.dataset.parca)?.code : el.dataset.metin;
    kopyala(metin || '', el.dataset.id, el.dataset.k); return false;
  },
  indir: (v, el) => { const c = bilesenBul(el.dataset.id); if(c) indir(etkinKod(c), dosyaAdi(c.name)); return false; },
  gecmisAc: v => { const g = D.gecmis.find(x => x.id === v); if(g){ D.uretilen = g.components; D.sekme = 'editor'; } },
  disaAc: () => { D.katman = {tur: 'disa'}; },
  siteKopya: () => { navigator.clipboard.writeText(siteKodu()).then(() => { D.katman.kopya = true; ciz(); setTimeout(() => { if(D.katman){ D.katman.kopya = false; ciz(); } }, 2000); }); return false; },
  siteIndir: () => { indir(siteKodu(), 'tasarim_atolyesi_pro_web_sitesi.html'); return false; },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if(!el || el.disabled) return;
  const f = EYLEM[el.dataset.a];
  if(!f) return;
  if(f(el.dataset.v, el) !== false) ciz();
});
addEventListener('keydown', e => { if(e.key === 'Escape' && D.katman && D.katman.tur !== 'intro'){ D.katman = null; ciz(); } });
/* Astra başka cihazdan gelen durumu yazınca çerçeveyi yeniden yükler; aynı
   sekmede başka pencere yazarsa burada yakalanır. */
addEventListener('storage', e => {
  if(e.key === K.kutuphane){ D.kutuphane = oku(K.kutuphane, []); ciz(); }
  if(e.key === K.gecmis){ D.gecmis = oku(K.gecmis, []); ciz(); }
});

ciz();
