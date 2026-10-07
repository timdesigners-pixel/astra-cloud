/* Ödeme Raporu — Astra APPS modülü
 *
 * Tek durum nesnesi `odeme-raporu-v1` anahtarında; Astra onu apps-durum.js
 * ile Supabase kasasına şifreli eşitler. Akış listesi ödeme kartlarıyla
 * to-do kartlarını AYNI sırada tutar: sürükle-taşı ile ikisi de araya girer.
 *
 * Harici kitaplıklar yalnız gerektiğinde yüklenir:
 *   pdf.js      → PDF içe aktarma (metin çıkarımı)
 *   html2pdf.js → PDF dışa aktarma (Türkçe karakterler görüntü olarak korunur) */

const ANAHTAR = 'odeme-raporu-v1';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_ISCI = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const HTML2PDF = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';

/* ---------- durum ---------- */
const bos = () => ({
  v: 1,
  butce: {gelir: 0, not: ''},
  kasalar: [],
  akis: [],
  notlar: [],
  karar: yeniDugum('Bu ay bütçe tüm ödemeleri karşılıyor mu?'),
  cozum: '',
  sim: {tutar: null, kaynak: 'kasa', strateji: 'sira'},
});
function yeniDugum(soru = 'Yeni karar'){
  return {id: kimlik(), soru, a: {etiket: 'Evet', sonuc: '', alt: null}, b: {etiket: 'Hayır', sonuc: '', alt: null}};
}
function kimlik(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function yukle(){
  try{ const d = JSON.parse(localStorage.getItem(ANAHTAR)); if(d && d.v === 1) return {...bos(), ...d, sim: {...bos().sim, ...(d.sim || {})}}; }catch(e){}
  return bos();
}
let S = yukle();
let kayitZamani = null;
function kaydet(){
  clearTimeout(kayitZamani);
  kayitZamani = setTimeout(() => { try{ localStorage.setItem(ANAHTAR, JSON.stringify(S)); }catch(e){ uyari('Depo dolu: kayıt yazılamadı.'); } }, 150);
}
function degisti(){ kaydet(); ciz(); }
/* Astra başka cihazdan gelen durumu yazarsa (çerçeve yeniden yüklenmeden) */
addEventListener('storage', e => { if(e.key === ANAHTAR){ S = yukle(); ciz(); } });

/* ---------- biçim ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TL = new Intl.NumberFormat('tr-TR', {style: 'currency', currency: 'TRY', maximumFractionDigits: 2});
const tl = x => TL.format(+x || 0);
const sayi = x => { const n = typeof x === 'number' ? x : parseFloat(String(x).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
/* Kuruş duyarlı yuvarlama (src/core/para.js ile aynı): 1,005 → 1,01; yarım kuruş sıfırdan uzağa. */
const yuvarla = x => { const v = Number(x); if(!Number.isFinite(v)) return 0; const m = Math.round(Math.abs(Number((v * 100).toPrecision(15)))); return m === 0 ? 0 : (v < 0 ? -m : m) / 100; };
const bugun = () => new Date().toISOString().slice(0, 10);
const tarihTR = t => t ? new Date(t + 'T00:00:00').toLocaleDateString('tr-TR', {day: '2-digit', month: 'short', year: 'numeric'}) : '—';
const gunFark = t => t ? Math.round((new Date(t + 'T00:00:00') - new Date(bugun() + 'T00:00:00')) / 864e5) : null;
const ikon = (ad, cls = '') => `<span class="material-symbols-outlined ${cls}">${ad}</span>`;
/* Tarih sorusu: prompt() masaüstü uygulamasının gömülü tarayıcısında ve sandbox'lı çerçevelerde
   çalışmıyor (hemen boş dönüyor, "Ötele" hiçbir şey yapmıyordu). Sayfa içi pencere kullanılır.
   Döner: 'YYYY-AA-GG' | '' (tarihsiz öteleme) | null (vazgeçildi). */
function tarihSor(baslik, varsayilan){
  return new Promise(coz => {
    const kap = document.createElement('div');
    kap.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    kap.innerHTML = `<div class="kart" role="dialog" aria-modal="true" aria-label="Öteleme tarihi" style="max-width:380px;width:100%;padding:18px;display:flex;flex-direction:column;gap:12px">
      <div style="font-weight:800">${esc(baslik)}</div>
      <label style="font-size:13px;color:var(--soluk);display:flex;flex-direction:column;gap:6px">Yeni ödeme tarihi (boş bırakılabilir)
        <input class="giris" type="date" value="${esc(varsayilan)}"></label>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="dugme" type="button" data-ot="iptal">Vazgeç</button>
        <button class="dugme ana" type="button" data-ot="tamam">Ötele</button></div></div>`;
    const bitir = v => { kap.remove(); document.removeEventListener('keydown', tus, true); coz(v); };
    const tus = e => { if(e.key === 'Escape'){ e.stopPropagation(); bitir(null); } else if(e.key === 'Enter'){ e.preventDefault(); bitir(kap.querySelector('input').value); } };
    kap.addEventListener('click', e => {
      if(e.target === kap || e.target.closest('[data-ot="iptal"]')) bitir(null);
      else if(e.target.closest('[data-ot="tamam"]')) bitir(kap.querySelector('input').value);
    });
    document.addEventListener('keydown', tus, true);
    document.body.append(kap);
    kap.querySelector('input').focus();
  });
}
function uyari(m){ const k = document.createElement('div'); k.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[99] kart px-4 py-3 text-sm'; k.textContent = m; document.body.append(k); setTimeout(() => k.remove(), 3200); }

/* ---------- hesaplar ---------- */
/* Ötelenen kalemler (o.otele) toplamdan, kalandan ve simülasyondan çıkar; ayrı
   tutulur. Limitten ödenen kalem (o.limit = kaynak kalemin id'si) toplama ayrıca
   eklenmez: ödemeleri kaynak kalemin kullanımına sayılır, kaynağın kalanı düşer. */
const tumOdemeler = () => S.akis.filter(x => x.tur === 'odeme');
const odemeler = () => tumOdemeler().filter(x => !x.otele);
const otelenenler = () => tumOdemeler().filter(x => x.otele);
const todolar = () => S.akis.filter(x => x.tur === 'todo');
const kendiOdenen = o => yuvarla((o.odemeler || []).reduce((a, p) => a + sayi(p.tutar), 0));
/* Geçerli limit kaynağı: etkin (ötelenmemiş), kendisi başka limite bağlı olmayan ödeme. */
const ebeveyn = x => x && x.limit ? S.akis.find(y => y.id === x.limit && y.id !== x.id && y.tur === 'odeme' && !y.otele && !y.limit) || null : null;
const cocuklar = o => o.limit ? [] : S.akis.filter(c => c.tur === 'odeme' && !c.otele && c.limit === o.id && c.id !== o.id);
const limitKullanim = o => yuvarla(cocuklar(o).reduce((a, c) => a + kendiOdenen(c), 0));
/* Limitten kullanılan toplam: bağlı kalemlerin tutarları (ödenmese de limitten ayrılmış sayılır). */
const limitAyrilan = o => yuvarla(cocuklar(o).reduce((a, c) => a + Math.max(sayi(c.tutar), kendiOdenen(c)), 0));
const odenen = o => yuvarla(kendiOdenen(o) + limitKullanim(o));
const anaOdemeler = () => odemeler().filter(x => !ebeveyn(x));
const kalan = o => Math.max(0, yuvarla(sayi(o.tutar) - odenen(o)));
const yuzde = o => sayi(o.tutar) > 0 ? Math.min(100, Math.round(odenen(o) / sayi(o.tutar) * 100)) : 0;
const altToplam = o => yuvarla((o.alt || []).reduce((a, x) => a + sayi(x.tutar), 0));
const kasaToplam = () => yuvarla(S.kasalar.reduce((a, k) => a + sayi(k.bakiye), 0));
function ozet(){
  const o = anaOdemeler();
  const toplam = yuvarla(o.reduce((a, x) => a + sayi(x.tutar), 0));
  const od = yuvarla(o.reduce((a, x) => a + odenen(x), 0));
  const kal = yuvarla(o.reduce((a, x) => a + kalan(x), 0));
  const geciken = o.filter(x => kalan(x) > 0 && gunFark(x.sonOdeme) !== null && gunFark(x.sonOdeme) < 0);
  const yakin = o.filter(x => kalan(x) > 0 && gunFark(x.sonOdeme) !== null && gunFark(x.sonOdeme) >= 0 && gunFark(x.sonOdeme) <= 7);
  const kilitli = yuvarla(o.filter(x => x.kilit).reduce((a, x) => a + kalan(x), 0));
  const t = todolar();
  const ot = otelenenler();
  return {toplam, od, kal, geciken, yakin, kilitli, adet: o.length,
    otelenen: yuvarla(ot.reduce((a, x) => a + kalan(x), 0)), otelenenAdet: ot.length,
    limittenAdet: odemeler().filter(x => ebeveyn(x)).length,
    todoTamam: t.filter(x => x.tamam).length, todoAdet: t.length,
    tamamlanan: o.filter(x => sayi(x.tutar) > 0 && kalan(x) === 0).length};
}
const kaynakTutar = () => S.sim.tutar != null && S.sim.tutar !== '' ? sayi(S.sim.tutar)
  : S.sim.kaynak === 'butce' ? sayi(S.butce.gelir) : S.sim.kaynak === 'toplam' ? sayi(S.butce.gelir) + kasaToplam() : kasaToplam();

/* Simülasyon: bütçe → ödeme dağıtımı. "Eksiltilemez" işaretli kalemler önce
   ve TAM karşılanır; kalan tutar seçilen stratejiyle kilitsizlere dağılır. */
function simule(){
  let kaynak = kaynakTutar();
  const liste = anaOdemeler().filter(x => kalan(x) > 0).map(x => ({o: x, kalan: kalan(x), pay: 0}));
  for(const s of liste.filter(s => s.o.kilit)){ s.pay = Math.min(s.kalan, kaynak); kaynak = yuvarla(kaynak - s.pay); }
  const kilitsiz = liste.filter(s => !s.o.kilit);
  const st = S.sim.strateji;
  if(st === 'oransal'){
    const top = kilitsiz.reduce((a, s) => a + s.kalan, 0);
    const oran = top > 0 ? Math.min(1, kaynak / top) : 0;
    for(const s of kilitsiz){ s.pay = yuvarla(Math.floor(s.kalan * oran * 100) / 100); }
    kaynak = yuvarla(kaynak - kilitsiz.reduce((a, s) => a + s.pay, 0));
  }else{
    const sirali = [...kilitsiz];
    if(st === 'vade') sirali.sort((x, y) => (x.o.sonOdeme || '9999') < (y.o.sonOdeme || '9999') ? -1 : 1);
    if(st === 'kucuk') sirali.sort((x, y) => x.kalan - y.kalan);
    if(st === 'buyuk') sirali.sort((x, y) => y.kalan - x.kalan);
    for(const s of sirali){ s.pay = Math.min(s.kalan, kaynak); kaynak = yuvarla(kaynak - s.pay); }
  }
  const kilitAcik = yuvarla(liste.filter(s => s.o.kilit).reduce((a, s) => a + s.kalan - s.pay, 0));
  return {satirlar: liste, artan: kaynak, kilitAcik, kaynak: kaynakTutar(),
    acik: yuvarla(liste.reduce((a, s) => a + s.kalan - s.pay, 0))};
}

/* Bütçe aşımı çözüm önerileri — kurallarla üretilir, kullanıcı notuyla birlikte. */
function oneriler(){
  const oz = ozet(), kaynak = kaynakTutar(), asim = yuvarla(oz.kal - kaynak);
  if(asim <= 0) return {asim, liste: []};
  const l = [];
  const kilitsiz = anaOdemeler().filter(x => !x.kilit && kalan(x) > 0);
  if(oz.kilitli > kaynak) l.push(`Eksiltilemez kalemler (${tl(oz.kilitli)}) tek başına kaynağı (${tl(kaynak)}) aşıyor: ${tl(oz.kilitli - kaynak)} ek nakit bulunmadan bu ay kapanmaz. Kilitlerden en az birini gözden geçirin.`);
  const ertelenecek = [...kilitsiz].sort((x, y) => (y.sonOdeme || '0000') < (x.sonOdeme || '0000') ? -1 : 1);
  let t = 0; const sec = [];
  for(const x of ertelenecek){ if(t >= asim) break; sec.push(x); t += kalan(x); }
  if(sec.length) l.push(`Vadesi en uzak kilitsiz kalemleri öteleyin (karttaki Ötele düğmesi): ${sec.map(x => `${x.ad || 'adsız'} (${tl(kalan(x))}, ${tarihTR(x.sonOdeme)})`).join(', ')} — toplam ${tl(t)}.`);
  const kTop = kilitsiz.reduce((a, x) => a + kalan(x), 0);
  if(kTop > 0) l.push(`Kilitsiz kalemlerin her birini %${Math.min(100, Math.ceil(asim / kTop * 100))} oranında kısmi ödeyin (Simülasyon › Oransal).`);
  const enBuyuk = [...kilitsiz].sort((x, y) => kalan(y) - kalan(x))[0];
  if(enBuyuk) l.push(`En büyük kilitsiz kalem "${enBuyuk.ad || 'adsız'}" (${tl(kalan(enBuyuk))}) için taksitlendirme / yapılandırma talep edin.`);
  if(S.sim.kaynak === 'kasa' && sayi(S.butce.gelir) > 0) l.push(`Kaynağa aylık bütçeyi de ekleyin (Simülasyon › Kasa + bütçe): ${tl(sayi(S.butce.gelir))} ek kaynak.`);
  if(oz.geciken.length) l.push(`Geciken ${oz.geciken.length} kalem önce ödenmeli — gecikme faizi/cezası aşımı büyütür.`);
  return {asim, liste: l};
}

/* ---------- görünümler ---------- */
function ozetKartlari(){
  const oz = ozet(), kaynak = kaynakTutar(), fark = yuvarla(kaynak - oz.kal);
  const k = (baslik, deger, alt, renk, ik) => `<div class="kart p-4">
    <div class="flex items-center justify-between"><span class="etiket" style="margin:0">${baslik}</span>${ikon(ik, 'text-[18px]')}</div>
    <div class="text-xl font-extrabold mt-2 mono" style="color:${renk}">${deger}</div>
    <div class="text-[11px] mt-1" style="color:var(--soluk)">${alt}</div></div>`;
  return `<section class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
    ${k('Toplam Ödeme', tl(oz.toplam), `${oz.adet} kalem`, 'var(--metin)', 'receipt_long')}
    ${k('Ödenen', tl(oz.od), `${oz.tamamlanan} kalem kapandı`, 'var(--yesil)', 'check_circle')}
    ${k('Kalan', tl(oz.kal), oz.toplam ? `%${Math.round(oz.od / oz.toplam * 100)} tamamlandı` : '—', 'var(--altin)', 'hourglass_top')}
    ${k('Geciken', String(oz.geciken.length), oz.geciken.length ? tl(oz.geciken.reduce((a, x) => a + kalan(x), 0)) : 'gecikme yok', oz.geciken.length ? 'var(--kirmizi)' : 'var(--yesil)', 'warning')}
    ${k('7 Gün İçinde', String(oz.yakin.length), oz.yakin.length ? tl(oz.yakin.reduce((a, x) => a + kalan(x), 0)) : 'yakın vade yok', 'var(--mavi)', 'event_upcoming')}
    ${k('Kaynak − Kalan', tl(fark), fark < 0 ? 'bütçe aşımı' : 'kaynak yeterli', fark < 0 ? 'var(--kirmizi)' : 'var(--yesil)', 'account_balance_wallet')}
    ${k('Ötelenen', tl(oz.otelenen), oz.otelenenAdet ? `${oz.otelenenAdet} kalem · toplam dışı` : 'ötelenen yok', 'var(--mor)', 'event_repeat')}
  </section>
  <div class="kart p-4 mt-3">
    <div class="flex items-center justify-between text-xs mb-2"><span class="etiket" style="margin:0">Genel ilerleme</span>
      <span class="mono">${tl(oz.od)} / ${tl(oz.toplam)} · to-do ${oz.todoTamam}/${oz.todoAdet}</span></div>
    <div class="ilerleme"><i style="width:${oz.toplam ? Math.min(100, oz.od / oz.toplam * 100) : 0}%"></i></div>
  </div>`;
}

const alan = (etiket, id, f, deger, tur = 'text', ek = '') => `<label class="block"><span class="etiket">${etiket}</span>
  <input class="giris ${tur === 'number' ? 'mono' : ''}" type="${tur === 'number' ? 'text' : tur}" data-f="${f}" data-id="${id}" value="${esc(deger ?? '')}" ${tur === 'number' ? 'inputmode="decimal" data-sayi="1"' : ''} ${ek}></label>`;

function altOgeler(x){
  const para = x.tur === 'odeme';
  return `<div class="mt-3 space-y-1.5">
    ${(x.alt || []).map(a => `<div class="flex items-center gap-2">
      <input type="checkbox" data-alt-tamam="${a.id}" data-id="${x.id}" ${a.tamam ? 'checked' : ''} class="accent-amber-400">
      <input class="giris ${a.tamam ? 'tamam-metin' : ''}" style="padding:5px 8px" data-alt-f="ad" data-alt="${a.id}" data-id="${x.id}" value="${esc(a.ad)}" placeholder="Alt öğe">
      ${para ? `<input class="giris mono" style="padding:5px 8px;max-width:120px" type="text" inputmode="decimal" data-alt-f="tutar" data-alt="${a.id}" data-id="${x.id}" value="${esc(a.tutar ?? '')}" placeholder="Tutar">` : ''}
      <button class="dugme kucuk tehlike" data-a="altSil" data-id="${x.id}" data-v="${a.id}" title="Sil">${ikon('close')}</button></div>`).join('')}
    <div class="flex gap-2 flex-wrap">
      <button class="dugme kucuk" data-a="altEkle" data-id="${x.id}">${ikon('add')}Alt öğe</button>
      ${para && (x.alt || []).some(a => sayi(a.tutar)) ? `<button class="dugme kucuk" data-a="altTutar" data-id="${x.id}" title="Tutarı alt öğelerin toplamı yap">${ikon('functions')}Tutar = ${tl(altToplam(x))}</button>` : ''}
    </div></div>`;
}

function odemeKarti(o, sira){
  if(o.otele) return oteleKarti(o, sira);
  const kal = kalan(o), g = gunFark(o.sonOdeme), gec = kal > 0 && g !== null && g < 0;
  const ata = ebeveyn(o), cc = cocuklar(o), kul = limitKullanim(o);
  const vade = g === null ? '' : kal === 0 ? '<span class="cip" style="color:var(--yesil);border-color:#065f46">ÖDENDİ</span>'
    : g < 0 ? `<span class="cip" style="color:var(--kirmizi);border-color:#7f1d1d">${-g} GÜN GECİKTİ</span>`
    : g === 0 ? '<span class="cip" style="color:var(--turuncu)">BUGÜN</span>' : `<span class="cip">${g} GÜN</span>`;
  return `<article class="kart p-4 ${gec ? 'gecikti' : ''}" data-kart="${o.id}">
    <div class="flex items-start gap-3">
      <div class="flex flex-col items-center gap-1 pt-1">
        <span class="tutamac" draggable="true" data-surukle="${o.id}" title="Sürükleyerek sırala">${ikon('drag_indicator')}</span>
        <span class="mono text-[10px]" style="color:var(--soluk)">${sira}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          ${ikon('payments', 'text-[18px]')}
          <input class="giris font-bold" style="flex:1;min-width:160px;background:transparent;border-color:transparent;font-size:15px;padding:4px 6px" data-f="ad" data-id="${o.id}" value="${esc(o.ad)}" placeholder="Ödeme adı">
          ${o.kategori ? `<span class="cip">${esc(o.kategori)}</span>` : ''}
          ${vade}
          ${o.kilit ? `<span class="cip" style="color:var(--mor);border-color:#4c1d95" title="Simülasyonda eksiltilemez">${ikon('lock', 'text-[12px] align-middle')} KİLİTLİ</span>` : ''}
          ${ata ? `<span class="cip" style="color:var(--mavi);border-color:#1e3a8a" title="Bu kalem toplama ayrıca eklenmez; ödemeleri kaynak kalemin limitinden düşer">${ikon('subdirectory_arrow_right', 'text-[12px] align-middle')} ${esc(ata.ad || 'adsız')} LİMİTİNDEN</span>` : ''}
          ${cc.length ? `<span class="cip" style="color:var(--mavi);border-color:#1e3a8a" title="${esc(cc.map(c => `${c.ad || 'adsız'}: ${tl(c.tutar)} (ödenen ${tl(kendiOdenen(c))})`).join(' · '))}">${ikon('account_tree', 'text-[12px] align-middle')} LİMİT · ${cc.length} kalem · ${tl(limitAyrilan(o))} kullanım${kul > 0 ? ` · ${tl(kul)} ödendi` : ''}</span>` : ''}
          ${cc.length && limitAyrilan(o) > sayi(o.tutar) + 0.001 ? `<span class="cip" style="color:var(--kirmizi);border-color:#7f1d1d">LİMİT AŞILDI</span>` : ''}
        </div>
        ${ata ? `<div class="text-[11px] mt-1" style="color:var(--soluk)">Toplama yansıtılmıyor — ${esc(ata.ad || 'adsız')} kaleminin ${tl(ata.tutar)} limitinden ödeniyor.</div>` : ''}
        <div class="grid grid-cols-3 gap-2 mt-3 text-center">
          <div><div class="etiket">Tutar</div><div class="mono font-bold">${tl(o.tutar)}</div></div>
          <div><div class="etiket">${cc.length ? 'Ödenen + limitten' : 'Ödenen'}</div><div class="mono font-bold" style="color:var(--yesil)">${tl(odenen(o))}</div>${cc.length ? `<div class="text-[10px] mono" style="color:var(--soluk)">kendi ${tl(kendiOdenen(o))} · limitten ${tl(kul)} / ${tl(limitAyrilan(o))} kullanım</div>` : ''}</div>
          <div><div class="etiket">Kalan</div><div class="mono font-bold" style="color:${kal ? 'var(--altin)' : 'var(--yesil)'}">${tl(kal)}</div></div>
        </div>
        <div class="flex items-center gap-2 mt-2"><div class="ilerleme flex-1"><i style="width:${yuzde(o)}%"></i></div><span class="mono text-[11px]">%${yuzde(o)}</span></div>
        <div class="flex gap-2 mt-3 flex-wrap items-center">
          <input class="giris mono" style="max-width:150px;padding:6px 8px" type="text" inputmode="decimal" id="kismi-${o.id}" placeholder="Kısmi ödeme ₺">
          <button class="dugme kucuk ana" data-a="kismi" data-id="${o.id}">${ikon('add_card')}Öde</button>
          <button class="dugme kucuk" data-a="tamOde" data-id="${o.id}" ${kal ? '' : 'disabled'}>${ikon('done_all')}Kalanı öde</button>
          <label class="dugme kucuk" title="Simülasyonda bu kalem eksiltilemez — önce ve tam karşılanır"><input type="checkbox" data-kilit="${o.id}" ${o.kilit ? 'checked' : ''} class="accent-violet-400"> Simülasyonda eksiltilemez</label>
          <button class="dugme kucuk" data-a="otele" data-id="${o.id}" title="Ödemeyi / borcu ötele — toplamdan ayrı tutulur">${ikon('event_repeat')}Ötele</button>
          <span class="flex-1"></span>
          <button class="dugme kucuk" data-a="yukari" data-id="${o.id}" title="Yukarı">${ikon('arrow_upward')}</button>
          <button class="dugme kucuk" data-a="asagi" data-id="${o.id}" title="Aşağı">${ikon('arrow_downward')}</button>
          <button class="dugme kucuk" data-a="ac" data-id="${o.id}">${ikon(o.acik ? 'expand_less' : 'expand_more')}${o.acik ? 'Kapat' : 'Ödeme bilgileri'}</button>
          <button class="dugme kucuk tehlike" data-a="sil" data-id="${o.id}" title="Sil">${ikon('delete')}</button>
        </div>
        ${o.acik ? `<div class="mt-4 pt-4 border-t" style="border-color:var(--cizgi)">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${alan('Tutar (₺)', o.id, 'tutar', o.tutar, 'number')}
            ${alan('Son ödeme tarihi', o.id, 'sonOdeme', o.sonOdeme, 'date')}
            ${alan('Kategori', o.id, 'kategori', o.kategori, 'text', 'list="kategoriler"')}
            ${alan('Alıcı / kurum', o.id, 'alici', o.alici)}
            ${alan('IBAN', o.id, 'iban', o.iban, 'text', 'class="mono" placeholder="TR.."')}
            ${alan('Abone / tesisat no', o.id, 'aboneNo', o.aboneNo)}
            ${alan('Fatura no', o.id, 'faturaNo', o.faturaNo)}
            ${alan('Fatura dönemi', o.id, 'faturaDonem', o.faturaDonem, 'text', 'placeholder="Eylül 2026"')}
            ${alan('Fatura tarihi', o.id, 'faturaTarih', o.faturaTarih, 'date')}
            ${limitSecici(o)}
          </div>
          <label class="block mt-3"><span class="etiket">Fatura bilgisi / açıklama</span>
            <textarea class="giris" data-f="fatura" data-id="${o.id}" placeholder="Fatura detayları, ödeme kanalı, referans…">${esc(o.fatura)}</textarea></label>
          ${o.iban ? `<button class="dugme kucuk mt-2" data-a="ibanKopya" data-id="${o.id}">${ikon('content_copy')}IBAN kopyala</button>` : ''}
          <div class="mt-4"><span class="etiket">Ödeme geçmişi</span>
            ${(o.odemeler || []).length ? `<div class="space-y-1">${o.odemeler.map(p => `<div class="flex items-center gap-2 text-xs mono">
              <span style="color:var(--soluk)">${tarihTR(p.tarih)}</span><span class="font-bold" style="color:var(--yesil)">${tl(p.tutar)}</span>
              <span style="color:var(--soluk)">${esc(p.not || '')}</span><span class="flex-1"></span>
              <button class="dugme kucuk tehlike" data-a="odemeSil" data-id="${o.id}" data-v="${p.id}" title="Kaydı geri al">${ikon('undo')}</button></div>`).join('')}</div>`
              : '<div class="text-xs" style="color:var(--soluk)">Henüz ödeme yok.</div>'}
          </div>
          <span class="etiket mt-4">Alt öğeler (kalemler)</span>${altOgeler(o)}
        </div>` : ''}
      </div>
    </div>
  </article>`;
}

/* Limit kaynağı seçimi: başka bir etkin ödemenin limitinden öde (toplama yansıtmadan). */
function limitSecici(o){
  if(cocuklar(o).length) return `<div class="block"><span class="etiket">Limit</span><div class="text-xs py-2" style="color:var(--soluk)">Bu kalem ${cocuklar(o).length} kalem için limit kaynağı.</div></div>`;
  const adaylar = odemeler().filter(y => y.id !== o.id && !y.limit);
  return `<label class="block"><span class="etiket">Limit kaynağı (toplama yansıtmadan öde)</span>
    <select class="giris" data-f="limit" data-id="${o.id}"><option value="">— Yok · kendi tutarıyla toplama girer —</option>
      ${adaylar.map(y => `<option value="${y.id}" ${o.limit === y.id ? 'selected' : ''}>${esc(y.ad || 'adsız')} · kalan ${tl(kalan(y))}</option>`).join('')}</select></label>`;
}
/* Ötelenmiş kalem: sönük kart, yeni tarih, Geri al. */
function oteleKarti(o, sira){
  const t = o.otele || {};
  return `<article class="kart p-3" style="opacity:.72;border-style:dashed;border-color:#4c1d95" data-kart="${o.id}">
    <div class="flex items-center gap-3 flex-wrap">
      <span class="tutamac" draggable="true" data-surukle="${o.id}" title="Sürükleyerek sırala">${ikon('drag_indicator')}</span>
      <span class="mono text-[10px]" style="color:var(--soluk)">${sira}</span>
      ${ikon('event_repeat', 'text-[18px]')}
      <b class="flex-1 min-w-[160px]">${esc(o.ad || 'adsız')}</b>
      <span class="cip" style="color:var(--mor);border-color:#4c1d95">ÖTELENDİ${t.tarih ? ' → ' + tarihTR(t.tarih) : ''}</span>
      ${o.kategori ? `<span class="cip">${esc(o.kategori)}</span>` : ''}
      <span class="mono font-bold">${tl(kalan(o))}</span>
      <input class="giris" style="max-width:150px;padding:5px 8px" type="date" data-otele-tarih="${o.id}" value="${esc(t.tarih || '')}" title="Yeni tarih">
      <button class="dugme kucuk ana" data-a="oteleGeri" data-id="${o.id}">${ikon('undo')}Geri al</button>
      <button class="dugme kucuk tehlike" data-a="sil" data-id="${o.id}" title="Sil">${ikon('delete')}</button>
    </div>
    <div class="text-[11px] mt-1 pl-8" style="color:var(--soluk)">Toplamdan, kalandan ve simülasyondan ayrı tutuluyor${t.ts ? ' · ötelendi ' + new Date(t.ts).toLocaleDateString('tr-TR') : ''}.</div>
  </article>`;
}

function todoKarti(t, sira){
  const g = gunFark(t.tarih);
  return `<article class="kart p-3" style="border-style:dashed" data-kart="${t.id}">
    <div class="flex items-start gap-3">
      <div class="flex flex-col items-center gap-1 pt-1">
        <span class="tutamac" draggable="true" data-surukle="${t.id}" title="Sürükleyerek taşı">${ikon('drag_indicator')}</span>
        <span class="mono text-[10px]" style="color:var(--soluk)">${sira}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <input type="checkbox" data-todo-tamam="${t.id}" ${t.tamam ? 'checked' : ''} class="accent-emerald-400 w-4 h-4">
          <span class="cip" style="color:var(--mavi)">TO-DO</span>
          <input class="giris ${t.tamam ? 'tamam-metin' : ''}" style="flex:1;min-width:160px;background:transparent;border-color:transparent;padding:4px 6px;font-weight:600" data-f="metin" data-id="${t.id}" value="${esc(t.metin)}" placeholder="Yapılacak iş">
          <input class="giris" style="max-width:150px;padding:5px 8px" type="date" data-f="tarih" data-id="${t.id}" value="${esc(t.tarih || '')}">
          ${g !== null && !t.tamam ? `<span class="cip" style="${g < 0 ? 'color:var(--kirmizi)' : ''}">${g < 0 ? -g + ' gün geçti' : g === 0 ? 'bugün' : g + ' gün'}</span>` : ''}
          <button class="dugme kucuk" data-a="yukari" data-id="${t.id}">${ikon('arrow_upward')}</button>
          <button class="dugme kucuk" data-a="asagi" data-id="${t.id}">${ikon('arrow_downward')}</button>
          <button class="dugme kucuk tehlike" data-a="sil" data-id="${t.id}">${ikon('delete')}</button>
        </div>
        ${(t.alt || []).length ? `<div class="mt-2 text-[11px]" style="color:var(--soluk)">${t.alt.filter(a => a.tamam).length}/${t.alt.length} alt öğe</div>` : ''}
        ${altOgeler(t)}
      </div>
    </div>
  </article>`;
}

function akisListesi(){
  const bosluk = i => `<div class="bosluk" data-konum="${i}"></div>`;
  return `<section class="kart p-4">
    <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
      <div><h2 class="text-lg font-extrabold flex items-center gap-2">${ikon('swap_vert')}İşlem Sırası</h2>
        <p class="text-xs" style="color:var(--soluk)">Kartları tutamaçtan sürükleyerek sıralayın. Aşağıdaki çipleri kartların arasına bırakarak yeni to-do / ödeme ekleyin.</p></div>
      <div class="flex gap-2 flex-wrap">
        <span class="dugme palet" draggable="true" data-yeni="todo" title="Sürükleyip kartların arasına bırakın">${ikon('add_task')}To-do sürükle</span>
        <span class="dugme palet" draggable="true" data-yeni="odeme" title="Sürükleyip kartların arasına bırakın">${ikon('add_card')}Ödeme sürükle</span>
      </div>
    </div>
    ${S.akis.length ? S.akis.map((x, i) => bosluk(i) + (x.tur === 'odeme' ? odemeKarti(x, i + 1) : todoKarti(x, i + 1))).join('') + bosluk(S.akis.length)
      : `${bosluk(0)}<div class="text-center py-12 border-2 border-dashed rounded-2xl" style="border-color:var(--cizgi);color:var(--soluk)">
          ${ikon('inbox', 'text-4xl')}<p class="mt-2 font-bold">Henüz kalem yok</p>
          <p class="text-xs mt-1">Yeni ödeme ekleyin, CSV / PDF içe aktarın ya da örnek veriyle başlayın.</p>
          <button class="dugme mt-4" data-a="ornek">${ikon('auto_awesome')}Örnek veri yükle</button></div>`}
    <div class="flex gap-2 mt-3 flex-wrap">
      <button class="dugme ana" data-a="yeniOdeme">${ikon('add')}Ödeme ekle</button>
      <button class="dugme" data-a="yeniTodo">${ikon('add_task')}To-do ekle</button>
    </div>
    <datalist id="kategoriler">${['Fatura', 'Kira', 'Kredi', 'Kredi kartı', 'Vergi', 'Sigorta', 'Abonelik', 'İcra', 'Aidat', 'Eğitim', 'Diğer'].map(k => `<option value="${k}">`).join('')}</datalist>
  </section>`;
}

function butceKart(){
  const oz = ozet(), gelir = sayi(S.butce.gelir), fark = yuvarla(gelir - oz.kal);
  return `<section class="kart p-4">
    <h3 class="font-extrabold flex items-center gap-2 mb-3">${ikon('pie_chart')}Bütçe Özeti</h3>
    ${alan('Bu dönemin ödeme bütçesi (₺)', 'butce', 'gelir', S.butce.gelir || '', 'number')}
    <div class="space-y-1.5 mt-3 text-sm">
      <div class="flex justify-between"><span style="color:var(--soluk)">Planlanan ödemeler</span><b class="mono">${tl(oz.toplam)}</b></div>
      <div class="flex justify-between"><span style="color:var(--soluk)">Ödenen</span><b class="mono" style="color:var(--yesil)">${tl(oz.od)}</b></div>
      <div class="flex justify-between"><span style="color:var(--soluk)">Kalan ödemeler</span><b class="mono" style="color:var(--altin)">${tl(oz.kal)}</b></div>
      <div class="flex justify-between"><span style="color:var(--soluk)">Eksiltilemez kalan</span><b class="mono" style="color:var(--mor)">${tl(oz.kilitli)}</b></div>
      ${oz.otelenenAdet ? `<div class="flex justify-between"><span style="color:var(--soluk)">Ötelenen (toplam dışı)</span><b class="mono" style="color:var(--mor)">${tl(oz.otelenen)}</b></div>` : ''}
      <div class="flex justify-between pt-2 border-t" style="border-color:var(--cizgi)"><span>Bütçe − kalan</span><b class="mono" style="color:${fark < 0 ? 'var(--kirmizi)' : 'var(--yesil)'}">${tl(fark)}</b></div>
    </div>
    ${gelir ? `<div class="ilerleme mt-3"><i style="width:${Math.min(100, oz.kal / gelir * 100)}%;${oz.kal > gelir ? 'background:var(--kirmizi)' : ''}"></i></div>
      <div class="text-[11px] mt-1" style="color:var(--soluk)">Kalan ödemeler bütçenin %${Math.round(oz.kal / gelir * 100)}'i</div>` : ''}
    <label class="block mt-3"><span class="etiket">Bütçe notu</span><textarea class="giris" data-f="not" data-id="butce" placeholder="Gelir kaynakları, beklenen tahsilatlar…">${esc(S.butce.not)}</textarea></label>
  </section>`;
}

function otelenenKart(){
  const l = otelenenler();
  if(!l.length) return '';
  const top = yuvarla(l.reduce((a, x) => a + kalan(x), 0));
  return `<section class="kart p-4" style="border-color:#4c1d95">
    <h3 class="font-extrabold flex items-center gap-2 mb-1">${ikon('event_repeat')}Ötelenenler</h3>
    <p class="text-[11px] mb-3" style="color:var(--soluk)">Toplamdan ve simülasyondan ayrı tutulur. Geri aldığınızda kalem akışa döner.</p>
    <div class="space-y-1.5 text-sm">${l.map(x => `<div class="flex items-center gap-2">
      <span class="flex-1 min-w-0 truncate">${esc(x.ad || 'adsız')}</span>
      <span class="mono text-[11px]" style="color:var(--soluk)">${x.otele.tarih ? tarihTR(x.otele.tarih) : 'tarihsiz'}</span>
      <b class="mono">${tl(kalan(x))}</b>
      <button class="dugme kucuk" data-a="oteleGeri" data-id="${x.id}" title="Geri al">${ikon('undo')}</button></div>`).join('')}</div>
    <div class="flex justify-between pt-2 mt-2 border-t text-sm" style="border-color:var(--cizgi)"><span>Toplam ötelenen</span><b class="mono" style="color:var(--mor)">${tl(top)}</b></div>
  </section>`;
}

function kasaKart(){
  const top = kasaToplam(), oz = ozet();
  return `<section class="kart p-4">
    <h3 class="font-extrabold flex items-center gap-2 mb-3">${ikon('account_balance')}Kasa Durumu</h3>
    <div class="space-y-2">${S.kasalar.map(k => `<div class="flex gap-2 items-center">
      <input class="giris" data-kasa-f="ad" data-kasa="${k.id}" value="${esc(k.ad)}" placeholder="Hesap / kasa">
      <input class="giris mono" style="max-width:130px" type="text" inputmode="decimal" data-kasa-f="bakiye" data-kasa="${k.id}" value="${esc(k.bakiye ?? '')}" placeholder="Bakiye">
      <button class="dugme kucuk tehlike" data-a="kasaSil" data-v="${k.id}">${ikon('close')}</button></div>`).join('')}</div>
    <button class="dugme kucuk mt-2" data-a="kasaEkle">${ikon('add')}Kasa / hesap ekle</button>
    <div class="space-y-1.5 mt-3 text-sm">
      <div class="flex justify-between"><span style="color:var(--soluk)">Toplam kasa</span><b class="mono">${tl(top)}</b></div>
      <div class="flex justify-between"><span style="color:var(--soluk)">Tüm kalan ödemeler sonrası</span><b class="mono" style="color:${top - oz.kal < 0 ? 'var(--kirmizi)' : 'var(--yesil)'}">${tl(top - oz.kal)}</b></div>
      <div class="flex justify-between"><span style="color:var(--soluk)">Eksiltilemezler sonrası</span><b class="mono" style="color:${top - oz.kilitli < 0 ? 'var(--kirmizi)' : 'var(--yesil)'}">${tl(top - oz.kilitli)}</b></div>
    </div>
  </section>`;
}

function cozumKart(){
  const {asim, liste} = oneriler();
  return `<section class="kart p-4" style="${asim > 0 ? 'border-color:#7f1d1d' : ''}">
    <h3 class="font-extrabold flex items-center gap-2 mb-2">${ikon(asim > 0 ? 'crisis_alert' : 'verified', asim > 0 ? '' : '')}Bütçe Aşımı Çözüm Önerisi</h3>
    ${asim > 0 ? `<div class="text-sm mb-2">Kaynak (${tl(kaynakTutar())}) kalan ödemeleri <b class="mono" style="color:var(--kirmizi)">${tl(asim)}</b> aşağıda kalıyor.</div>
      <ol class="list-decimal pl-5 space-y-1.5 text-[13px]">${liste.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`
      : `<div class="text-sm" style="color:var(--yesil)">Kaynak kalan ödemeleri karşılıyor — aşım yok.</div>`}
    <label class="block mt-3"><span class="etiket">Çözüm planım</span>
      <textarea class="giris" data-f="cozum" data-id="kok" placeholder="Aşımı nasıl kapatacağınızı yazın: erteleme, ek gelir, yapılandırma…">${esc(S.cozum)}</textarea></label>
  </section>`;
}

function notlarKart(){
  return `<section class="kart p-4">
    <h3 class="font-extrabold flex items-center gap-2 mb-3">${ikon('sticky_note_2')}Notlar</h3>
    <div class="flex gap-2"><textarea class="giris" id="yeniNot" placeholder="Not yazın…" style="min-height:44px"></textarea>
      <button class="dugme ana" data-a="notEkle">${ikon('add')}</button></div>
    <div class="space-y-2 mt-3">${S.notlar.map(n => `<div class="p-3 rounded-xl" style="background:#0a0e16;border:1px solid var(--cizgi)">
      <div class="flex justify-between items-center"><span class="mono text-[10px]" style="color:var(--soluk)">${new Date(n.ts).toLocaleString('tr-TR')}</span>
        <button class="dugme kucuk tehlike" data-a="notSil" data-v="${n.id}">${ikon('close')}</button></div>
      <textarea class="giris mt-1" style="background:transparent;border-color:transparent;min-height:40px" data-not="${n.id}">${esc(n.metin)}</textarea></div>`).join('')
      || '<div class="text-xs" style="color:var(--soluk)">Not yok.</div>'}</div>
  </section>`;
}

/* Simülasyon › Limitten ödeme: bir kalemi başka bir kalemin limitinden, toplama
   yansıtmadan öde. Kayıt ödenen kaleme düşer; kaynağın kalanı azalır, toplam değişmez. */
let LIMIT_FORM = {kalem: '', kaynak: '', tutar: ''};
function limittenPanel(){
  const et = odemeler();
  const kalemler = et.filter(x => !cocuklar(x).length);
  const kaynaklar = et.filter(x => !x.limit && x.id !== LIMIT_FORM.kalem);
  const secK = et.find(x => x.id === LIMIT_FORM.kalem), secY = et.find(x => x.id === LIMIT_FORM.kaynak);
  const bagli = et.filter(x => ebeveyn(x));
  return `<div class="mt-3 p-3 rounded-xl" style="background:#0b1220;border:1px solid #1e3a8a">
    <div class="flex items-center gap-2 font-bold text-sm">${ikon('account_tree', 'text-[16px]')}Limitten ödeme <span class="text-[11px] font-normal" style="color:var(--soluk)">— bir ödemeyi başka bir ödemenin limitinden, toplama yansıtmadan öde</span></div>
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2 items-end">
      <label class="block"><span class="etiket">Ödenecek kalem</span><select class="giris" data-limitform="kalem"><option value="">Seçin…</option>
        ${kalemler.map(x => `<option value="${x.id}" ${LIMIT_FORM.kalem === x.id ? 'selected' : ''}>${esc(x.ad || 'adsız')} · ${tl(kalan(x))}</option>`).join('')}</select></label>
      <label class="block"><span class="etiket">Limit kaynağı</span><select class="giris" data-limitform="kaynak"><option value="">Seçin…</option>
        ${kaynaklar.map(x => `<option value="${x.id}" ${LIMIT_FORM.kaynak === x.id ? 'selected' : ''}>${esc(x.ad || 'adsız')} · kalan ${tl(kalan(x))}</option>`).join('')}</select></label>
      <label class="block"><span class="etiket">Tutar (boş = kalemin kalanı)</span><input class="giris mono" type="text" inputmode="decimal" data-limitform="tutar" value="${esc(LIMIT_FORM.tutar)}" placeholder="${secK ? esc(tl(kalan(secK))) : '₺'}"></label>
      <button class="dugme ana" data-a="limittenOde" ${secK && secY ? '' : 'disabled'}>${ikon('subdirectory_arrow_right')}Limitten öde</button>
    </div>
    ${secK && secY ? `<div class="text-[11px] mt-2" style="color:var(--soluk)">${esc(secK.ad || 'adsız')} toplama ayrıca eklenmeyecek; ödeme ${esc(secY.ad || 'adsız')} limitinden düşecek (kalan ${tl(kalan(secY))} → ${tl(Math.max(0, kalan(secY) - (sayi(LIMIT_FORM.tutar) || kalan(secK))))}).</div>` : ''}
    ${bagli.length ? `<div class="mt-2 space-y-1">${bagli.map(x => `<div class="flex items-center gap-2 text-xs"><span class="mono" style="color:var(--mavi)">↳</span>
      <span class="flex-1 min-w-0 truncate">${esc(x.ad || 'adsız')} <span style="color:var(--soluk)">→ ${esc(ebeveyn(x).ad || 'adsız')} limitinden · kullanım ${tl(Math.max(sayi(x.tutar), kendiOdenen(x)))} · ödenen ${tl(kendiOdenen(x))}</span></span>
      <button class="dugme kucuk" data-a="limitBagKaldir" data-id="${x.id}" title="Bağı kaldır — kalem kendi tutarıyla toplama döner">${ikon('link_off')}</button></div>`).join('')}</div>` : ''}
  </div>`;
}

function simulasyonKart(){
  const r = simule();
  return `<section class="kart p-4">
    <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
      <div><h2 class="text-lg font-extrabold flex items-center gap-2">${ikon('science')}Simülasyon · Bütçe → Ödeme Dağıtımı</h2>
        <p class="text-xs" style="color:var(--soluk)">Kilitli ("eksiltilemez") kalemler önce ve tam karşılanır; kalan kaynak seçilen stratejiyle dağılır.</p></div>
      <button class="dugme ana" data-a="simUygula" ${r.satirlar.some(s => s.pay > 0) ? '' : 'disabled'}>${ikon('task_alt')}Dağıtımı ödeme olarak kaydet</button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label class="block"><span class="etiket">Kaynak</span><select class="giris" data-sim="kaynak">
        ${[['kasa', `Kasa toplamı (${tl(kasaToplam())})`], ['butce', `Bütçe (${tl(S.butce.gelir)})`], ['toplam', `Kasa + bütçe (${tl(kasaToplam() + sayi(S.butce.gelir))})`]].map(([v, t]) => `<option value="${v}" ${S.sim.kaynak === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="block"><span class="etiket">Elle tutar (boş = kaynak)</span><input class="giris mono" type="text" inputmode="decimal" data-sim="tutar" value="${esc(S.sim.tutar ?? '')}" placeholder="${esc(tl(kaynakTutar()))}"></label>
      <label class="block"><span class="etiket">Strateji</span><select class="giris" data-sim="strateji">
        ${[['sira', 'İşlem sırasına göre'], ['vade', 'Son ödeme tarihine göre'], ['kucuk', 'Küçükten büyüğe (kartopu)'], ['buyuk', 'Büyükten küçüğe'], ['oransal', 'Oransal (herkese aynı %)']].map(([v, t]) => `<option value="${v}" ${S.sim.strateji === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    ${limittenPanel()}
    ${r.kilitAcik > 0 ? `<div class="mt-3 p-3 rounded-xl text-sm" style="background:#2a0f14;border:1px solid #7f1d1d">${ikon('lock', 'text-[14px] align-middle')} Eksiltilemez kalemler için kaynak yetmiyor: <b class="mono">${tl(r.kilitAcik)}</b> eksik.</div>` : ''}
    <div class="overflow-x-auto mt-3"><table class="w-full text-sm">
      <thead><tr class="text-left" style="color:var(--soluk)"><th class="py-2 pr-2 etiket">Kalem</th><th class="etiket">Vade</th><th class="etiket text-right">Kalan</th><th class="etiket text-right">Dağıtılan</th><th class="etiket text-right">Açık</th><th class="etiket" style="width:22%">Karşılanma</th></tr></thead>
      <tbody>${r.satirlar.map(s => `<tr class="border-t" style="border-color:var(--cizgi)">
        <td class="py-2 pr-2">${s.o.kilit ? ikon('lock', 'text-[13px] align-middle') + ' ' : ''}${esc(s.o.ad || 'adsız')}</td>
        <td class="mono text-xs">${tarihTR(s.o.sonOdeme)}</td>
        <td class="mono text-right">${tl(s.kalan)}</td>
        <td class="mono text-right" style="color:var(--yesil)">${tl(s.pay)}</td>
        <td class="mono text-right" style="color:${s.kalan - s.pay > 0 ? 'var(--kirmizi)' : 'var(--soluk)'}">${tl(s.kalan - s.pay)}</td>
        <td><div class="ilerleme"><i style="width:${s.kalan ? s.pay / s.kalan * 100 : 100}%"></i></div></td></tr>`).join('')
        || '<tr><td colspan="6" class="py-4 text-center" style="color:var(--soluk)">Kalan ödeme yok.</td></tr>'}</tbody>
      <tfoot><tr class="border-t font-bold" style="border-color:var(--cizgi)"><td class="py-2">Kaynak ${tl(r.kaynak)}</td><td></td>
        <td class="mono text-right">${tl(r.satirlar.reduce((a, s) => a + s.kalan, 0))}</td>
        <td class="mono text-right" style="color:var(--yesil)">${tl(r.satirlar.reduce((a, s) => a + s.pay, 0))}</td>
        <td class="mono text-right" style="color:var(--kirmizi)">${tl(r.acik)}</td>
        <td class="mono text-xs">artan ${tl(r.artan)}</td></tr></tfoot>
    </table></div>
  </section>`;
}

function dugumHTML(d, yol, derinlik){
  const dal = (k) => {
    const b = d[k];
    return `<div class="dal"><div class="kart p-3 dugum" style="border-color:${k === 'a' ? '#065f46' : '#7f1d1d'}">
      <input class="giris font-bold" style="padding:5px 8px;color:${k === 'a' ? 'var(--yesil)' : 'var(--kirmizi)'}" data-karar="${yol}.${k}.etiket" value="${esc(b.etiket)}" placeholder="Seçenek">
      <textarea class="giris mt-2" style="min-height:52px" data-karar="${yol}.${k}.sonuc" placeholder="Senaryo / sonuç: bu seçenekte ne olur?">${esc(b.sonuc)}</textarea>
      <div class="flex gap-1 mt-2 flex-wrap">
        ${b.alt ? `<button class="dugme kucuk tehlike" data-a="kararAltSil" data-v="${yol}.${k}">${ikon('content_cut')}Dalı kaldır</button>`
          : derinlik < 5 ? `<button class="dugme kucuk" data-a="kararAltEkle" data-v="${yol}.${k}">${ikon('call_split')}Alt karar ekle</button>` : ''}
      </div></div>
      ${b.alt ? dugumHTML(b.alt, `${yol}.${k}.alt`, derinlik + 1) : ''}</div>`;
  };
  return `<div class="agac"><div class="kart p-3 dugum text-center" style="border-color:var(--altin)">
      <span class="etiket">${ikon('help', 'text-[12px] align-middle')} Karar</span>
      <textarea class="giris text-center font-bold" style="min-height:44px" data-karar="${yol}.soru" placeholder="Karar sorusu">${esc(d.soru)}</textarea>
    </div><div class="dallar">${dal('a')}${dal('b')}</div></div>`;
}
function kararKart(){
  return `<section class="kart p-4">
    <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
      <div><h2 class="text-lg font-extrabold flex items-center gap-2">${ikon('account_tree')}Karar Diyagramı</h2>
        <p class="text-xs" style="color:var(--soluk)">Her karar iki seçeneğe dallanır; her dala senaryo yazın, gerekirse alt karar ekleyin.</p></div>
      <button class="dugme tehlike" data-a="kararSifirla">${ikon('restart_alt')}Sıfırla</button>
    </div>
    <div class="overflow-x-auto pb-2"><div class="min-w-max mx-auto px-2">${dugumHTML(S.karar, 'k', 1)}</div></div>
  </section>`;
}

function ustBar(){
  return `<header class="sticky top-0 z-30 border-b" style="background:color-mix(in srgb, var(--zemin) 92%, transparent);backdrop-filter:blur(8px);border-color:var(--cizgi)">
    <div class="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-3 mr-auto">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:var(--altin);color:#1a1405">${ikon('request_quote')}</div>
        <div><h1 class="font-extrabold leading-none">Ödeme Raporu</h1><span class="mono text-[10px]" style="color:var(--soluk)">${new Date().toLocaleDateString('tr-TR', {dateStyle: 'full'})}</span></div>
      </div>
      <button class="dugme" data-a="yazdir">${ikon('print')}Yazdır</button>
      <button class="dugme" data-a="pdfDisa">${ikon('picture_as_pdf')}PDF dışa</button>
      <button class="dugme" data-a="pdfIce">${ikon('upload_file')}PDF içe</button>
      <button class="dugme" data-a="csvDisa">${ikon('download')}CSV dışa</button>
      <button class="dugme" data-a="csvIce">${ikon('upload')}CSV içe</button>
      <button class="dugme" data-a="menu" title="Diğer">${ikon('more_horiz')}</button>
    </div>
    ${ACIK_MENU ? `<div class="max-w-[1400px] mx-auto px-4 pb-3 flex gap-2 flex-wrap justify-end">
      <button class="dugme kucuk" data-a="jsonDisa">${ikon('data_object')}Tam yedek (JSON) indir</button>
      <button class="dugme kucuk" data-a="jsonIce">${ikon('restore')}Yedekten geri yükle</button>
      <button class="dugme kucuk tehlike" data-a="hepsiniSil">${ikon('delete_forever')}Tüm veriyi sil</button></div>` : ''}
  </header>`;
}
let ACIK_MENU = false;

function ciz(){
  const odak = document.activeElement, odakSec = odak && odak.id ? '#' + odak.id : null;
  const y = scrollY;
  document.getElementById('kok').innerHTML = `${ustBar()}
    <main class="max-w-[1400px] mx-auto px-4 py-5 space-y-5 pb-24">
      ${ozetKartlari()}
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div class="space-y-5">${akisListesi()}${simulasyonKart()}</div>
        <aside class="space-y-5">${butceKart()}${otelenenKart()}${kasaKart()}${cozumKart()}${notlarKart()}</aside>
      </div>
      ${kararKart()}
    </main>`;
  scrollTo(0, y);
  if(odakSec) document.querySelector(odakSec)?.focus();
}

/* ---------- akış işlemleri ---------- */
const bul = id => S.akis.find(x => x.id === id);
const yeniOdeme = () => ({id: kimlik(), tur: 'odeme', ad: '', kategori: '', tutar: 0, odemeler: [], sonOdeme: '', fatura: '',
  faturaNo: '', faturaDonem: '', faturaTarih: '', iban: '', aboneNo: '', alici: '', kilit: false, alt: [], acik: true});
const yeniTodo = () => ({id: kimlik(), tur: 'todo', metin: '', tamam: false, tarih: '', alt: []});
function tasi(id, konum){
  const i = S.akis.findIndex(x => x.id === id);
  if(i < 0) return;
  const [x] = S.akis.splice(i, 1);
  S.akis.splice(konum > i ? konum - 1 : konum, 0, x);
}
function yolIle(yol){           // "k.a.alt.b" → {ebeveyn, anahtar}
  const p = yol.split('.').slice(1);
  let o = S.karar;
  for(let i = 0; i < p.length - 1; i++) o = o[p[i]];
  return {o, k: p[p.length - 1]};
}
function ornekVeri(){
  const g = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const o = (ad, kategori, tutar, gun, ek = {}) => ({...yeniOdeme(), acik: false, ad, kategori, tutar, sonOdeme: g(gun), ...ek});
  S.akis = [
    o('Kira', 'Kira', 18000, 3, {kilit: true, alici: 'Ev sahibi'}),
    o('Elektrik faturası', 'Fatura', 1240.5, 6, {aboneNo: '0000000', faturaDonem: 'Bu ay', alt: [{id: kimlik(), ad: 'Tüketim', tutar: 1010.5, tamam: false}, {id: kimlik(), ad: 'Vergi & fon', tutar: 230, tamam: false}]}),
    {...yeniTodo(), metin: 'Doğalgaz sayacını fotoğrafla, endeks bildir', tarih: g(2)},
    o('Kredi kartı asgari', 'Kredi kartı', 7500, 10, {kilit: true}),
    o('İnternet', 'Abonelik', 649.9, 12),
    o('Araç sigortası taksiti', 'Sigorta', 2300, -2, {odemeler: [{id: kimlik(), tutar: 800, tarih: bugun(), not: 'kısmi'}]}),
    {...yeniTodo(), metin: 'Bankadan yapılandırma teklifi iste', alt: [{id: kimlik(), ad: 'Son 3 ay ekstresi', tamam: false}, {id: kimlik(), ad: 'Gelir belgesi', tamam: true}]},
  ];
  S.butce.gelir = 25000;
  S.kasalar = [{id: kimlik(), ad: 'Vadesiz hesap', bakiye: 21000}, {id: kimlik(), ad: 'Nakit', bakiye: 3500}];
}

/* ---------- CSV ---------- */
const CSV_ALAN = ['tur', 'ad', 'kategori', 'tutar', 'odenen', 'sonOdeme', 'alici', 'iban', 'aboneNo', 'faturaNo', 'faturaDonem', 'faturaTarih', 'fatura', 'kilit', 'tamam', 'altOgeler', 'otelendi', 'limit'];
const csvHucre = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function csvUret(){
  const satir = S.akis.map(x => x.tur === 'odeme'
    ? ['odeme', x.ad, x.kategori, sayi(x.tutar).toFixed(2).replace('.', ','), kendiOdenen(x).toFixed(2).replace('.', ','), x.sonOdeme, x.alici, x.iban, x.aboneNo, x.faturaNo, x.faturaDonem, x.faturaTarih, x.fatura, x.kilit ? 'evet' : '', '',
       (x.alt || []).map(a => `${a.ad}:${sayi(a.tutar).toFixed(2).replace('.', ',')}${a.tamam ? ':+' : ''}`).join('|'),
       x.otele ? (x.otele.tarih || 'evet') : '', ebeveyn(x) ? ebeveyn(x).ad : '']
    : ['todo', x.metin, '', '', '', x.tarih, '', '', '', '', '', '', '', '', x.tamam ? 'evet' : '', (x.alt || []).map(a => `${a.ad}${a.tamam ? '::+' : ''}`).join('|')]);
  return '﻿' + [CSV_ALAN, ...satir].map(r => r.map(csvHucre).join(';')).join('\r\n');
}
function csvAyristir(metin){
  metin = metin.replace(/^﻿/, '');
  const ayrac = (metin.split('\n')[0].match(/;/g) || []).length >= (metin.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const satirlar = []; let r = [], h = '', t = false;
  for(let i = 0; i < metin.length; i++){
    const c = metin[i];
    if(t){ if(c === '"' && metin[i + 1] === '"'){ h += '"'; i++; } else if(c === '"') t = false; else h += c; }
    else if(c === '"') t = true;
    else if(c === ayrac){ r.push(h); h = ''; }
    else if(c === '\n' || c === '\r'){ if(c === '\r' && metin[i + 1] === '\n') i++; r.push(h); satirlar.push(r); r = []; h = ''; }
    else h += c;
  }
  if(h || r.length){ r.push(h); satirlar.push(r); }
  return satirlar.filter(x => x.some(v => v.trim()));
}
function csvIceAktar(metin){
  const [bas, ...govde] = csvAyristir(metin);
  if(!bas) throw new Error('CSV boş.');
  const ad = bas.map(x => x.trim().toLocaleLowerCase('tr'));
  const col = (...adlar) => ad.findIndex(a => adlar.some(n => a === n.toLocaleLowerCase('tr')));
  const c = {tur: col('tur', 'tür', 'type'), ad: col('ad', 'kalem', 'açıklama', 'name', 'metin'), kategori: col('kategori', 'category'),
    tutar: col('tutar', 'amount'), odenen: col('odenen', 'ödenen', 'paid'), son: col('sonodeme', 'son ödeme', 'vade', 'due'),
    alici: col('alici', 'alıcı'), iban: col('iban'), abone: col('abone', 'aboneno', 'abone no'), fno: col('faturano', 'fatura no'),
    fdon: col('faturadonem', 'fatura dönemi'), ftar: col('faturatarih', 'fatura tarihi'), fatura: col('fatura', 'not'),
    kilit: col('kilit', 'eksiltilemez'), tamam: col('tamam', 'done'), alt: col('altogeler', 'alt öğeler'),
    otele: col('otelendi', 'ötelendi', 'otele', 'ertelendi'), limit: col('limit', 'limitten', 'limit kaynağı')};
  const limitAdlari = [];
  const al = (r, i) => i >= 0 ? (r[i] ?? '').trim() : '';
  const tarih = s => { const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s; };
  const evet = s => /^(evet|1|true|x|yes)$/i.test(s);
  let n = 0;
  for(const r of govde){
    const tur = al(r, c.tur).toLowerCase();
    const alt = al(r, c.alt).split('|').filter(Boolean).map(p => { const [a, t, d] = p.split(':'); return {id: kimlik(), ad: a, tutar: sayi(t || 0), tamam: d === '+'}; });
    if(tur === 'todo'){ S.akis.push({...yeniTodo(), metin: al(r, c.ad), tarih: tarih(al(r, c.son)), tamam: evet(al(r, c.tamam)), alt}); n++; continue; }
    const o = {...yeniOdeme(), acik: false, ad: al(r, c.ad), kategori: al(r, c.kategori), tutar: sayi(al(r, c.tutar)), sonOdeme: tarih(al(r, c.son)),
      alici: al(r, c.alici), iban: al(r, c.iban).replace(/\s/g, ''), aboneNo: al(r, c.abone), faturaNo: al(r, c.fno), faturaDonem: al(r, c.fdon),
      faturaTarih: tarih(al(r, c.ftar)), fatura: al(r, c.fatura), kilit: evet(al(r, c.kilit)), alt};
    const od = sayi(al(r, c.odenen));
    if(od > 0) o.odemeler = [{id: kimlik(), tutar: od, tarih: bugun(), not: 'CSV içe aktarma'}];
    const ot = al(r, c.otele);
    if(ot) o.otele = {tarih: /^\d{4}-\d{2}-\d{2}$/.test(tarih(ot)) ? tarih(ot) : '', ts: Date.now()};
    if(al(r, c.limit)) limitAdlari.push([o, al(r, c.limit)]);
    S.akis.push(o); n++;
  }
  /* Limit kaynağı adla verilir: içe aktarma bittikten sonra eşlenir. */
  for(const [o, ad] of limitAdlari){
    const y = S.akis.find(x => x.tur === 'odeme' && x !== o && (x.ad || '').toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
    if(y) o.limit = y.id;
  }
  return n;
}

/* ---------- rapor (yazdırma + PDF) ---------- */
function raporHTML(){
  const oz = ozet(), r = simule(), on = oneriler();
  const kararListe = (d) => `<li><b>${esc(d.soru)}</b><ul>${['a', 'b'].map(k => `<li><b>${esc(d[k].etiket)}:</b> ${esc(d[k].sonuc || '—')}${d[k].alt ? `<ul>${kararListe(d[k].alt)}</ul>` : ''}</li>`).join('')}</ul></li>`;
  return `<div class="r">
  <style>.r{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:11px;padding:8px}.r h1{font-size:20px;margin:0}.r h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
  .r table{width:100%;border-collapse:collapse}.r th,.r td{border:1px solid #ccc;padding:4px 5px;text-align:left;vertical-align:top}.r th{background:#f2f2f2;font-size:9px;text-transform:uppercase}
  .r .s{text-align:right;font-family:'JetBrains Mono',monospace;white-space:nowrap}.r .ozet{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.r .ozet div{border:1px solid #ccc;padding:6px;border-radius:6px}
  .r .bar{height:6px;background:#eee;border-radius:3px;overflow:hidden}.r .bar i{display:block;height:100%;background:#16a34a}.r ul{margin:2px 0;padding-left:16px}.r tr{page-break-inside:avoid}</style>
  <div style="display:flex;justify-content:space-between;align-items:flex-end"><div><h1>ASTRA · Ödeme Raporu</h1><div>${new Date().toLocaleString('tr-TR')}</div></div>
    <div class="s">Kalan ${tl(oz.kal)} / ${tl(oz.toplam)}</div></div>
  <h2>Özet</h2><div class="ozet">
    <div>Toplam ödeme<br><b>${tl(oz.toplam)}</b></div><div>Ödenen<br><b>${tl(oz.od)}</b></div><div>Kalan<br><b>${tl(oz.kal)}</b></div>
    <div>Bütçe<br><b>${tl(S.butce.gelir)}</b></div><div>Kasa<br><b>${tl(kasaToplam())}</b></div><div>Geciken / 7 gün<br><b>${oz.geciken.length} / ${oz.yakin.length}</b></div>
    ${oz.otelenenAdet ? `<div>Ötelenen (toplam dışı)<br><b>${tl(oz.otelenen)}</b> · ${oz.otelenenAdet} kalem</div>` : ''}${oz.limittenAdet ? `<div>Limitten ödenen<br><b>${oz.limittenAdet} kalem</b> · toplama yansımaz</div>` : ''}</div>
  <h2>İşlem Sırası</h2><table><thead><tr><th>#</th><th>Kalem</th><th>Son ödeme</th><th class="s">Tutar</th><th class="s">Ödenen</th><th class="s">Kalan</th><th>İlerleme</th><th>Ödeme bilgileri</th></tr></thead><tbody>
  ${S.akis.map((x, i) => x.tur === 'odeme' ? `<tr${x.otele ? ' style="color:#888"' : ''}><td>${i + 1}</td><td><b>${esc(x.ad)}</b>${x.kilit ? ' 🔒' : ''}${x.otele ? ` <i>(ötelendi${x.otele.tarih ? ' → ' + tarihTR(x.otele.tarih) : ''} · toplam dışı)</i>` : ''}${ebeveyn(x) ? ` <i>(↳ ${esc(ebeveyn(x).ad)} limitinden · toplama yansımaz)</i>` : ''}<br>${esc(x.kategori)}${(x.alt || []).length ? `<ul>${x.alt.map(a => `<li>${a.tamam ? '✓ ' : ''}${esc(a.ad)} ${a.tutar ? tl(a.tutar) : ''}</li>`).join('')}</ul>` : ''}</td>
    <td>${tarihTR(x.sonOdeme)}</td><td class="s">${tl(x.tutar)}</td><td class="s">${tl(odenen(x))}</td><td class="s">${tl(kalan(x))}</td>
    <td style="width:70px"><div class="bar"><i style="width:${yuzde(x)}%"></i></div>%${yuzde(x)}</td>
    <td>${[x.alici && 'Alıcı: ' + esc(x.alici), x.iban && 'IBAN: ' + esc(x.iban), x.aboneNo && 'Abone: ' + esc(x.aboneNo), x.faturaNo && 'Fatura: ' + esc(x.faturaNo), x.faturaDonem && 'Dönem: ' + esc(x.faturaDonem), x.fatura && esc(x.fatura)].filter(Boolean).join('<br>')}</td></tr>`
    : `<tr><td>${i + 1}</td><td colspan="7">${x.tamam ? '☑' : '☐'} <b>To-do:</b> ${esc(x.metin)} ${x.tarih ? '· ' + tarihTR(x.tarih) : ''}${(x.alt || []).length ? `<ul>${x.alt.map(a => `<li>${a.tamam ? '☑' : '☐'} ${esc(a.ad)}</li>`).join('')}</ul>` : ''}</td></tr>`).join('')}
  </tbody></table>
  <h2>Kasa</h2><table><tbody>${S.kasalar.map(k => `<tr><td>${esc(k.ad)}</td><td class="s">${tl(k.bakiye)}</td></tr>`).join('')}<tr><th>Toplam</th><th class="s">${tl(kasaToplam())}</th></tr></tbody></table>
  <h2>Simülasyon (${esc({sira: 'işlem sırası', vade: 'vade', kucuk: 'küçükten büyüğe', buyuk: 'büyükten küçüğe', oransal: 'oransal'}[S.sim.strateji])} · kaynak ${tl(r.kaynak)})</h2>
  <table><thead><tr><th>Kalem</th><th class="s">Kalan</th><th class="s">Dağıtılan</th><th class="s">Açık</th></tr></thead><tbody>
  ${r.satirlar.map(s => `<tr><td>${s.o.kilit ? '🔒 ' : ''}${esc(s.o.ad)}</td><td class="s">${tl(s.kalan)}</td><td class="s">${tl(s.pay)}</td><td class="s">${tl(s.kalan - s.pay)}</td></tr>`).join('')}
  <tr><th>Toplam açık / artan</th><th></th><th></th><th class="s">${tl(r.acik)} / ${tl(r.artan)}</th></tr></tbody></table>
  ${on.asim > 0 || S.cozum ? `<h2>Bütçe Aşımı Çözümü${on.asim > 0 ? ` — aşım ${tl(on.asim)}` : ''}</h2>${on.liste.length ? `<ol>${on.liste.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${S.cozum ? `<p><b>Plan:</b> ${esc(S.cozum)}</p>` : ''}` : ''}
  <h2>Karar Diyagramı</h2><ul>${kararListe(S.karar)}</ul>
  ${S.notlar.length ? `<h2>Notlar</h2><ul>${S.notlar.map(n => `<li>${esc(n.metin)}</li>`).join('')}</ul>` : ''}
  ${S.butce.not ? `<h2>Bütçe Notu</h2><p>${esc(S.butce.not)}</p>` : ''}
  </div>`;
}
function yazdir(){
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.append(f);
  f.srcdoc = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Ödeme Raporu</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>@page{size:A4;margin:12mm}body{margin:0}</style></head><body>${raporHTML()}</body></html>`;
  f.onload = () => { setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 400); };
}
function betikYukle(src){
  return new Promise((ok, red) => {
    if(document.querySelector(`script[src="${src}"]`)) return ok();
    const s = Object.assign(document.createElement('script'), {src, onload: ok, onerror: () => red(new Error('Kitaplık yüklenemedi: ' + src))});
    document.head.append(s);
  });
}
async function pdfDisa(){
  uyari('PDF hazırlanıyor…');
  await betikYukle(HTML2PDF);
  const k = document.createElement('div');
  k.style.cssText = 'position:fixed;left:-10000px;top:0;width:780px;background:#fff';
  k.innerHTML = raporHTML();
  document.body.append(k);
  try{
    await window.html2pdf().set({margin: 8, filename: `odeme-raporu-${bugun()}.pdf`, image: {type: 'jpeg', quality: 0.95},
      html2canvas: {scale: 2, backgroundColor: '#ffffff'}, jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'},
      pagebreak: {mode: ['css', 'legacy'], avoid: 'tr'}}).from(k).save();
  }finally{ k.remove(); }
}
function indir(metin, ad, tur){
  const url = URL.createObjectURL(new Blob([metin], {type: tur}));
  const a = Object.assign(document.createElement('a'), {href: url, download: ad});
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PDF içe aktarma: faturadan ödeme kartı ---------- */
async function pdfMetni(dosya){
  const pdfjs = await import(PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_ISCI;
  const doc = await pdfjs.getDocument({data: await dosya.arrayBuffer()}).promise;
  let metin = '';
  for(let i = 1; i <= Math.min(doc.numPages, 20); i++){
    const s = await (await doc.getPage(i)).getTextContent();
    let sonY = null;
    for(const it of s.items){ const y = it.transform?.[5]; metin += (sonY !== null && Math.abs(y - sonY) > 2 ? '\n' : ' ') + it.str; sonY = y; }
    metin += '\n';
  }
  return metin;
}
/* Türkçe harfleri ASCII'ye katlar — BİRE BİR (uzunluk değişmez), böylece
   katlanmış metinde bulunan konum özgün metinde de geçerli kalır. PDF'lerde
   "Son Ödeme" kimi zaman "Son Odeme" olarak gömülü geliyor. */
const KAT = {'ç':'c','Ç':'C','ğ':'g','Ğ':'G','ı':'i','İ':'I','ö':'o','Ö':'O','ş':'s','Ş':'S','ü':'u','Ü':'U'};
const katla = s => s.replace(/[çÇğĞıİöÖşŞüÜ]/g, c => KAT[c]);
function faturaAyikla(metin, dosyaAdi){
  const ozgun = metin.replace(/[ \t]+/g, ' ');
  const tek = katla(ozgun);
  const tutarlar = [...tek.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:TL|₺|TRY)?/g)].map(m => sayi(m[1])).filter(x => x > 0);
  const tarihDon = s => { const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
  /* Katlanmış metinde ara, değeri özgün metinden al ('d' bayrağı grup konumunu verir). */
  const yakala = (re) => { const m = new RegExp(re.source, re.flags + 'd').exec(tek); return m ? ozgun.slice(...m.indices[1]).trim() : ''; };
  const sonOdeme = tarihDon(yakala(/son\s*odeme\s*tarihi\s*[:\-]?\s*([\d./]{8,10})/i) || yakala(/vade\s*tarihi\s*[:\-]?\s*([\d./]{8,10})/i));
  const odenecek = yakala(/(?:odenecek|fatura|genel)\s*(?:toplam\s*)?tutar[i]?\s*[:\-]?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  return {
    ad: yakala(/(?:firma|kurum|sirket)\s*(?:adi|unvani)?\s*[:\-]\s*([^\n]{3,60})/i) || dosyaAdi.replace(/\.pdf$/i, ''),
    tutar: odenecek ? sayi(odenecek) : (tutarlar.length ? Math.max(...tutarlar) : 0),
    sonOdeme,
    iban: (tek.replace(/\s/g, '').match(/TR\d{24}/) || [''])[0],
    aboneNo: yakala(/(?:abone|tesisat|musteri|sozlesme\s*hesap)\s*(?:no|numarasi)\s*[:\-]?\s*([A-Z0-9\-]{4,24})/i),
    faturaNo: yakala(/fatura\s*(?:no|numarasi|seri\s*sira\s*no)\s*[:\-]?\s*([A-Z0-9\-]{4,24})/i),
    faturaTarih: tarihDon(yakala(/fatura\s*tarihi\s*[:\-]?\s*([\d./]{8,10})/i)),
    faturaDonem: yakala(/(?:fatura\s*)?donem[i]?\s*[:\-]\s*([^\n]{3,30})/i),
    adaylar: [...new Set(tutarlar)].sort((a, b) => b - a).slice(0, 8),
    ozet: metin.trim().slice(0, 600),
  };
}
let PDF_ADAY = null;
function pdfKatman(){
  const a = PDF_ADAY;
  const g = (et, f, tur = 'text') => `<label class="block"><span class="etiket">${et}</span><input class="giris ${tur === 'number' ? 'mono' : ''}" type="${tur}" ${tur === 'number' ? 'step="0.01"' : ''} data-pdf="${f}" value="${esc(a[f] ?? '')}"></label>`;
  return `<div class="katman-ort"><div class="katman-ic kart p-5">
    <div class="flex items-center justify-between mb-3"><h3 class="font-extrabold flex items-center gap-2">${ikon('upload_file')}PDF'ten ödeme kartı</h3>
      <button class="dugme kucuk" data-a="pdfKapat">${ikon('close')}</button></div>
    <p class="text-xs mb-3" style="color:var(--soluk)">Faturadan bulunan alanlar aşağıda. Kontrol edip düzeltin, sonra ekleyin.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${g('Ödeme adı', 'ad')}${g('Tutar (₺)', 'tutar', 'number')}${g('Son ödeme', 'sonOdeme', 'date')}${g('IBAN', 'iban')}${g('Abone / tesisat no', 'aboneNo')}${g('Fatura no', 'faturaNo')}${g('Fatura tarihi', 'faturaTarih', 'date')}${g('Fatura dönemi', 'faturaDonem')}</div>
    ${a.adaylar.length ? `<div class="mt-3"><span class="etiket">Belgede bulunan tutarlar — seçmek için tıklayın</span><div class="flex gap-2 flex-wrap">${a.adaylar.map(t => `<button class="dugme kucuk mono" data-a="pdfTutar" data-v="${t}">${tl(t)}</button>`).join('')}</div></div>` : ''}
    <details class="mt-3"><summary class="text-xs cursor-pointer" style="color:var(--soluk)">Çıkarılan metin</summary><pre class="text-[10px] mono whitespace-pre-wrap mt-2 p-2 rounded" style="background:#0a0e16">${esc(a.ozet)}</pre></details>
    <div class="flex justify-end gap-2 mt-4"><button class="dugme" data-a="pdfKapat">Vazgeç</button><button class="dugme ana" data-a="pdfEkle">${ikon('add_card')}Kart olarak ekle</button></div>
  </div></div>`;
}
function katmanCiz(){ document.getElementById('katman').innerHTML = PDF_ADAY ? pdfKatman() : ''; }

/* ---------- olaylar ---------- */
const EYLEM = {
  menu: () => { ACIK_MENU = !ACIK_MENU; ciz(); },
  yeniOdeme: () => { S.akis.push(yeniOdeme()); degisti(); },
  yeniTodo: () => { S.akis.push(yeniTodo()); degisti(); },
  ornek: () => { ornekVeri(); degisti(); },
  sil: async (el) => { const x = bul(el.dataset.id); if(x && confirm(`"${x.ad || x.metin || 'adsız'}" silinsin mi?`)){ S.akis = S.akis.filter(y => y !== x); degisti(); } },
  ac: el => { const x = bul(el.dataset.id); x.acik = !x.acik; degisti(); },
  yukari: el => { const i = S.akis.findIndex(x => x.id === el.dataset.id); if(i > 0){ tasi(el.dataset.id, i - 1); degisti(); } },
  asagi: el => { const i = S.akis.findIndex(x => x.id === el.dataset.id); if(i < S.akis.length - 1){ tasi(el.dataset.id, i + 2); degisti(); } },
  kismi: el => {
    const x = bul(el.dataset.id), inp = document.getElementById('kismi-' + x.id), t = sayi(inp.value);
    if(!(t > 0)) return uyari('Geçerli bir tutar girin.');
    if(t > kalan(x) + 0.001 && !confirm(`Girilen tutar kalanı (${tl(kalan(x))}) aşıyor. Yine de kaydedilsin mi?`)) return;
    (x.odemeler ||= []).push({id: kimlik(), tutar: yuvarla(t), tarih: bugun(), not: 'kısmi ödeme'}); degisti();
  },
  tamOde: el => { const x = bul(el.dataset.id), k = kalan(x); if(k > 0){ (x.odemeler ||= []).push({id: kimlik(), tutar: k, tarih: bugun(), not: 'kalan ödendi'}); degisti(); } },
  odemeSil: el => { const x = bul(el.dataset.id); x.odemeler = x.odemeler.filter(p => p.id !== el.dataset.v); degisti(); },
  ibanKopya: el => { navigator.clipboard.writeText(bul(el.dataset.id).iban).then(() => uyari('IBAN kopyalandı.')); },
  altEkle: el => { const x = bul(el.dataset.id); (x.alt ||= []).push({id: kimlik(), ad: '', tutar: '', tamam: false}); degisti(); },
  altSil: el => { const x = bul(el.dataset.id); x.alt = x.alt.filter(a => a.id !== el.dataset.v); degisti(); },
  altTutar: el => { const x = bul(el.dataset.id); x.tutar = altToplam(x); degisti(); },
  kasaEkle: () => { S.kasalar.push({id: kimlik(), ad: '', bakiye: ''}); degisti(); },
  kasaSil: el => { S.kasalar = S.kasalar.filter(k => k.id !== el.dataset.v); degisti(); },
  notEkle: () => { const t = document.getElementById('yeniNot').value.trim(); if(t){ S.notlar.unshift({id: kimlik(), metin: t, ts: Date.now()}); degisti(); } },
  notSil: el => { S.notlar = S.notlar.filter(n => n.id !== el.dataset.v); degisti(); },
  otele: async el => {
    const x = bul(el.dataset.id); if(!x) return;
    const tarih = await tarihSor(`"${x.ad || 'adsız'}" ötelensin`, x.sonOdeme || '');
    if(tarih === null) return;
    x.otele = {tarih, ts: Date.now()};
    if(tarih) x.sonOdeme = tarih;
    const bag = S.akis.filter(c => c.limit === x.id);
    if(bag.length) uyari(`${bag.length} kalem bu kalemin limitine bağlıydı; artık kendi tutarlarıyla toplama girer.`);
    degisti();
  },
  oteleGeri: el => { const x = bul(el.dataset.id); if(x){ x.otele = null; degisti(); uyari('Kalem akışa geri alındı.'); } },
  limittenOde: () => {
    const k = bul(LIMIT_FORM.kalem), y = bul(LIMIT_FORM.kaynak);
    if(!k || !y || k === y) return uyari('Kalem ve limit kaynağını seçin.');
    const t = yuvarla(sayi(LIMIT_FORM.tutar) || kalan(k));
    if(!(t > 0)) return uyari('Ödenecek tutar yok.');
    if(t > kalan(y) + 0.001 && !confirm(`${tl(t)} kaynağın kalan limitini (${tl(kalan(y))}) aşıyor. Yine de kaydedilsin mi?`)) return;
    k.limit = y.id;
    (k.odemeler ||= []).push({id: kimlik(), tutar: t, tarih: bugun(), not: `${y.ad || 'adsız'} limitinden`});
    LIMIT_FORM = {kalem: '', kaynak: '', tutar: ''};
    degisti(); uyari(`${tl(t)} ${y.ad || 'adsız'} limitinden ödendi — toplam değişmedi.`);
  },
  limitBagKaldir: el => { const x = bul(el.dataset.id); if(x && confirm(`"${x.ad || 'adsız'}" limit bağı kaldırılsın mı? Kalem kendi tutarıyla toplama döner.`)){ x.limit = ''; degisti(); } },
  simUygula: () => {
    const r = simule(), sat = r.satirlar.filter(s => s.pay > 0);
    if(!confirm(`${sat.length} kaleme toplam ${tl(sat.reduce((a, s) => a + s.pay, 0))} ödeme kaydedilsin mi?`)) return;
    for(const s of sat) (s.o.odemeler ||= []).push({id: kimlik(), tutar: s.pay, tarih: bugun(), not: 'simülasyon dağıtımı'});
    degisti();
  },
  kararAltEkle: el => { const {o, k} = yolIle(el.dataset.v); o[k].alt = yeniDugum(); degisti(); },
  kararAltSil: el => { const {o, k} = yolIle(el.dataset.v); if(confirm('Bu dal ve altındaki kararlar kaldırılsın mı?')){ o[k].alt = null; degisti(); } },
  kararSifirla: () => { if(confirm('Karar diyagramı sıfırlansın mı?')){ S.karar = bos().karar; degisti(); } },
  yazdir: () => yazdir(),
  pdfDisa: () => pdfDisa().catch(e => uyari(e.message)),
  pdfIce: () => document.getElementById('pdfDosya').click(),
  csvDisa: () => indir(csvUret(), `odeme-raporu-${bugun()}.csv`, 'text/csv;charset=utf-8'),
  csvIce: () => document.getElementById('csvDosya').click(),
  jsonDisa: () => indir(JSON.stringify(S, null, 1), `odeme-raporu-yedek-${bugun()}.json`, 'application/json'),
  jsonIce: () => document.getElementById('jsonDosya').click(),
  hepsiniSil: () => { if(confirm('Ödeme Raporu\'ndaki TÜM veri silinsin mi? (Önce JSON yedeği almanız önerilir.)')){ S = bos(); ACIK_MENU = false; degisti(); } },
  pdfKapat: () => { PDF_ADAY = null; katmanCiz(); },
  pdfTutar: el => { PDF_ADAY.tutar = +el.dataset.v; katmanCiz(); },
  pdfEkle: () => {
    const a = PDF_ADAY;
    S.akis.push({...yeniOdeme(), acik: true, kategori: 'Fatura', ad: a.ad, tutar: sayi(a.tutar), sonOdeme: a.sonOdeme, iban: a.iban,
      aboneNo: a.aboneNo, faturaNo: a.faturaNo, faturaTarih: a.faturaTarih, faturaDonem: a.faturaDonem, fatura: 'PDF içe aktarma'});
    PDF_ADAY = null; katmanCiz(); degisti(); uyari('Ödeme kartı eklendi.');
  },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if(!el || el.disabled) return;
  EYLEM[el.dataset.a]?.(el);
});

/* Alan değişiklikleri: `change` ile (odak kaybında) tüm görünüm yeniden çizilir. */
document.addEventListener('change', e => {
  const el = e.target, d = el.dataset;
  if(d.f && d.id){
    const v = d.sayi ? (el.value === '' ? '' : sayi(el.value)) : el.value;
    if(d.id === 'butce') S.butce[d.f] = v;
    else if(d.id === 'kok') S[d.f] = v;
    else { const x = bul(d.id); if(x) x[d.f] = d.f === 'iban' ? String(v).replace(/\s/g, '').toUpperCase() : v; }
    return degisti();
  }
  if(d.kilit){ bul(d.kilit).kilit = el.checked; return degisti(); }
  if(d.limitform){ LIMIT_FORM[d.limitform] = el.value; if(d.limitform === 'kalem' && LIMIT_FORM.kaynak === el.value) LIMIT_FORM.kaynak = ''; return ciz(); }
  if(d.oteleTarih){ const x = bul(d.oteleTarih); x.otele = {...(x.otele || {}), tarih: el.value}; if(el.value) x.sonOdeme = el.value; return degisti(); }
  if(d.todoTamam){ bul(d.todoTamam).tamam = el.checked; return degisti(); }
  if(d.altTamam){ const a = bul(d.id).alt.find(a => a.id === d.altTamam); a.tamam = el.checked; return degisti(); }
  if(d.altF){ const a = bul(d.id).alt.find(a => a.id === d.alt); a[d.altF] = d.altF === 'tutar' ? sayi(el.value) : el.value; return degisti(); }
  if(d.kasaF){ const k = S.kasalar.find(k => k.id === d.kasa); k[d.kasaF] = d.kasaF === 'bakiye' ? sayi(el.value) : el.value; return degisti(); }
  if(d.not){ const n = S.notlar.find(n => n.id === d.not); n.metin = el.value; return degisti(); }
  if(d.sim){ S.sim[d.sim] = d.sim === 'tutar' ? (el.value === '' ? null : sayi(el.value)) : el.value; return degisti(); }
  if(d.karar){ const {o, k} = yolIle(d.karar); o[k] = el.value; return degisti(); }
  if(d.pdf){ PDF_ADAY[d.pdf] = el.type === 'number' ? sayi(el.value) : el.value; return; }
});
document.addEventListener('keydown', e => {
  if(e.key === 'Enter' && e.target.id?.startsWith('kismi-')){ EYLEM.kismi({dataset: {id: e.target.id.slice(6)}}); }
  if(e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'yeniNot') EYLEM.notEkle();
  if(e.key === 'Escape' && PDF_ADAY) EYLEM.pdfKapat();
});

/* Dosya girişleri */
document.getElementById('csvDosya').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  try{ const n = csvIceAktar(await f.text()); degisti(); uyari(`${n} satır içe aktarıldı.`); }catch(err){ uyari('CSV okunamadı: ' + err.message); }
});
document.getElementById('jsonDosya').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  try{ const d = JSON.parse(await f.text()); if(d.v !== 1 || !Array.isArray(d.akis)) throw new Error('Ödeme Raporu yedeği değil.');
    if(confirm('Mevcut veri yedektekiyle değiştirilsin mi?')){ S = {...bos(), ...d}; ACIK_MENU = false; degisti(); } }catch(err){ uyari(err.message); }
});
document.getElementById('pdfDosya').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  uyari('PDF okunuyor…');
  try{ PDF_ADAY = faturaAyikla(await pdfMetni(f), f.name); katmanCiz(); }
  catch(err){ uyari('PDF okunamadı: ' + err.message); }
});

/* ---------- sürükle-taşı ---------- */
let surulen = null;   // {id} mevcut kart ya da {yeni:'todo'|'odeme'}
const hedefTemizle = () => document.querySelectorAll('.bosluk.hedef').forEach(x => x.classList.remove('hedef'));
function enYakinBosluk(y){
  let en = null, fark = Infinity;
  for(const b of document.querySelectorAll('.bosluk')){ const r = b.getBoundingClientRect(), f = Math.abs(r.top + r.height / 2 - y); if(f < fark){ fark = f; en = b; } }
  return en;
}
document.addEventListener('dragstart', e => {
  const t = e.target.closest?.('[data-surukle],[data-yeni]');
  if(!t) return;
  surulen = t.dataset.surukle ? {id: t.dataset.surukle} : {yeni: t.dataset.yeni};
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', t.dataset.surukle || t.dataset.yeni);
  if(surulen.id){ const k = document.querySelector(`[data-kart="${surulen.id}"]`); if(k){ e.dataTransfer.setDragImage(k, 30, 30); setTimeout(() => k.classList.add('suruklenen'), 0); } }
});
document.addEventListener('dragover', e => {
  if(!surulen) return;
  if(!e.target.closest?.('section')) return;
  e.preventDefault();
  const b = enYakinBosluk(e.clientY);
  hedefTemizle(); b?.classList.add('hedef');
});
document.addEventListener('drop', e => {
  if(!surulen) return;
  e.preventDefault();
  const b = document.querySelector('.bosluk.hedef') || enYakinBosluk(e.clientY);
  const konum = b ? +b.dataset.konum : S.akis.length;
  if(surulen.id) tasi(surulen.id, konum);
  else S.akis.splice(konum, 0, surulen.yeni === 'todo' ? yeniTodo() : yeniOdeme());
  surulen = null; hedefTemizle(); degisti();
});
document.addEventListener('dragend', () => { if(surulen){ surulen = null; hedefTemizle(); ciz(); } });

ciz();
