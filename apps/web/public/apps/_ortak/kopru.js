/* APPS — sandbox köprüsü (uygulama tarafı)
 *
 * Gömülü uygulamalar Astra içinde sandbox="allow-scripts …" (allow-same-origin YOK) çerçevesinde çalışır:
 * opak köken — Astra'nın depolamasına, kasa anahtarına, çerezlerine ve belgesine erişemezler. Bu dosya her
 * uygulamanın <head>'inde İLK betik olarak yüklenir ve çerçeve içinde çalıştığını anlarsa şunları üstlenir:
 *
 *   1) localStorage / sessionStorage: sandbox'ta localStorage hata fırlatır. Uygulamanın erişebileceği anahtarların
 *      anlık görüntüsü çerçeve adıyla (window.name — eşzamanlı okunur, hemen silinir) gelir; yazma/silme Astra'ya
 *      postMessage ile gider, Astra yalnız bu uygulamaya ait anahtarları yazar.
 *   2) fetch('/api/…'): Origin "null" olduğu için sunucu uçları doğrudan reddeder; istek Astra'ya iletilir, Astra
 *      yalnız izinli uçlara (/api/market, /api/tasarim) yapar.
 *   3) Boy ve sabit konumlu öğeler: eskiden üst sayfa çerçevenin belgesine uzanıp yapıyordu (app-boy.js); sandbox'ta
 *      bu işi uygulamanın kendi tarafı yapar, üst sayfa yalnız görünen dilimi bildirir.
 *
 * Bağımsız açılışta (yeni sekme, çerçevesiz ya da sandbox'sız) hiçbir şey yapmaz. */
(function(){
  'use strict';
  var cerceve = window.parent !== window, sandbox = false;
  try{ void window.localStorage; }catch(e){ sandbox = true; }
  if(!cerceve || !sandbox) return;

  var KOK = '*';                                   // alıcı (Astra) gerçek kökende; gönderirken hedef '*' (opak çerçeveden)
  function yolla(m){ try{ parent.postMessage(m, KOK); }catch(e){} }

  /* ---------- 1) depolama ---------- */
  var veri = {};
  try{
    if(String(window.name).indexOf('astra-depo:') === 0) veri = JSON.parse(window.name.slice(11)).v || {};
  }catch(e){ veri = {}; }
  try{ window.name = ''; }catch(e){}                // sonradan başka adrese gidilse bile anlık görüntü sızmaz

  function DepoNesnesi(yaz){
    var d = {}; Object.keys(veri).forEach(function(k){ d[k] = veri[k]; });
    var yontemler = {
      getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function(k, v){ k = String(k); v = String(v); var o = yontemler.getItem(k); d[k] = v; if(yaz) yaz('set', k, v); olay(k, o, v); },
      removeItem: function(k){ k = String(k); var o = yontemler.getItem(k); if(o === null) return; delete d[k]; if(yaz) yaz('del', k); olay(k, o, null); },
      clear: function(){ d = {}; if(yaz) yaz('clear'); olay(null, null, null); },
      key: function(i){ var a = Object.keys(d); return i >= 0 && i < a.length ? a[i] : null; }
    };
    var nesne = new Proxy(yontemler, {
      get: function(h, p){
        if(p === 'length') return Object.keys(d).length;
        if(typeof p === 'symbol') return undefined;
        if(p in yontemler) return yontemler[p];
        return Object.prototype.hasOwnProperty.call(d, p) ? d[p] : undefined;
      },
      set: function(h, p, v){ yontemler.setItem(p, v); return true; },
      deleteProperty: function(h, p){ yontemler.removeItem(p); return true; },
      has: function(h, p){ return p in yontemler || Object.prototype.hasOwnProperty.call(d, p); },
      ownKeys: function(){ return Object.keys(d); },
      getOwnPropertyDescriptor: function(h, p){ return Object.prototype.hasOwnProperty.call(d, p) ? {value: d[p], enumerable: true, configurable: true, writable: true} : undefined; }
    });
    function olay(k, eski, yeni){
      try{ window.dispatchEvent(new StorageEvent('storage', {key: k, oldValue: eski, newValue: yeni, storageArea: nesne})); }catch(e){}
    }
    nesne.__ice = function(k, v){ var o = yontemler.getItem(k); if(v === null) delete d[k]; else d[k] = v; olay(k, o, v); };
    return nesne;
  }
  var yerel = DepoNesnesi(function(op, k, v){ yolla({astra: 'depo', op: op, k: k, v: v}); });
  var oturum = DepoNesnesi(null);
  try{ Object.defineProperty(window, 'localStorage', {configurable: true, get: function(){ return yerel; }}); }catch(e){}
  try{ Object.defineProperty(window, 'sessionStorage', {configurable: true, get: function(){ return oturum; }}); }catch(e){}

  /* ---------- 2) /api/ istekleri Astra üzerinden ---------- */
  var asilFetch = window.fetch ? window.fetch.bind(window) : null;
  var sayac = 0, bekleyen = {};
  window.fetch = function(girdi, secenek){
    var u;
    try{ u = new URL(typeof girdi === 'string' ? girdi : (girdi && girdi.url) || String(girdi), location.href); }catch(e){ return asilFetch(girdi, secenek); }
    if(u.origin !== location.origin || u.pathname.indexOf('/api/') !== 0) return asilFetch(girdi, secenek);
    secenek = secenek || {};
    var id = ++sayac;
    return new Promise(function(coz, red){
      var h = {}; try{ new Headers(secenek.headers || {}).forEach(function(v, k){ h[k] = v; }); }catch(e){}
      bekleyen[id] = {coz: coz, red: red};
      yolla({astra: 'api', id: id, yol: u.pathname + u.search, yontem: String(secenek.method || 'GET').toUpperCase(),
             basliklar: h, govde: typeof secenek.body === 'string' ? secenek.body : null});
      setTimeout(function(){ if(bekleyen[id]){ delete bekleyen[id]; red(new TypeError('Astra köprüsü yanıt vermedi')); } }, 30000);
    });
  };

  /* ---------- 3) boy ve sabit konumlu öğeler ---------- */
  var ISARET = 'data-astra-sabit', EN_AZ = 320;
  var dilim = {ust: 0, yuk: Math.max(innerHeight, 200), boy: innerHeight};
  var sabitler = new Set(), olcBekliyor = false, yerBekliyor = false, sonBoy = 0;

  function stilEkle(){
    var st = document.createElement('style');
    st.textContent = 'html{overflow:hidden!important}html,body{overscroll-behavior:auto!important}';
    (document.head || document.documentElement).appendChild(st);
  }
  function px(v){ var x = parseFloat(v); return isNaN(x) ? 0 : x; }

  function olc(){
    olcBekliyor = false;
    if(!document.body) return;
    /* 100vh kullanan kökler çerçeve uzayınca küçülmez: ölçüm sırasında min-height geçici sıfırlanır
       (aynı görevde, boyama olmadan) ve içeriğin doğal alt kenarı okunur. */
    var gecici = document.createElement('style');
    gecici.textContent = '*{min-height:0!important}';
    (document.head || document.documentElement).appendChild(gecici);
    var h = 0;
    try{
      var cs = getComputedStyle(document.body), alt = 0;
      for(var c = document.body.firstElementChild; c; c = c.nextElementSibling){
        var s = getComputedStyle(c);
        if(s.position === 'fixed' || s.display === 'none' || c.tagName === 'SCRIPT' || c.tagName === 'STYLE') continue;
        var r = c.getBoundingClientRect();
        if(r.height === 0 && r.width === 0) continue;
        alt = Math.max(alt, r.bottom + scrollY + px(s.marginBottom));
      }
      h = Math.ceil(alt + px(cs.paddingBottom) + px(cs.borderBottomWidth) + px(cs.marginBottom) + px(getComputedStyle(document.documentElement).paddingBottom));
      if(!h) h = document.documentElement.scrollHeight;
    }catch(e){ h = document.documentElement.scrollHeight; }
    gecici.remove();
    h = Math.max(h, EN_AZ);
    if(h !== sonBoy){ sonBoy = h; yolla({astra: 'boy', h: h}); }
    yerIste();
  }
  function olcIste(){ if(!olcBekliyor){ olcBekliyor = true; requestAnimationFrame(olc); } }

  function ozgun(el){
    if(el.__astraSabit) return el.__astraSabit;
    var cs = getComputedStyle(el);
    var pp = function(v){ return v === 'auto' || v === '' ? null : (parseFloat(v) || 0); };
    var top = pp(cs.top), bottom = pp(cs.bottom);
    var r = el.getBoundingClientRect();
    if(cs.display !== 'none' && r.height > 0 && top !== null && bottom !== null && r.height < innerHeight * 0.9){
      if(bottom < top) top = null; else bottom = null;
    }
    return (el.__astraSabit = {top: top, bottom: bottom});
  }
  function yerlestir(){
    yerBekliyor = false;
    if(!sabitler.size) return;
    var ust = dilim.ust, yuk = dilim.yuk, boy = dilim.boy || innerHeight;
    sabitler.forEach(function(el){
      if(!el.isConnected){ sabitler.delete(el); return; }
      var s = el.style, o = el.__astraSabit;
      if(el.tagName === 'DIALOG'){
        s.setProperty('max-height', (yuk - 16) + 'px', 'important');
        s.setProperty('overflow', 'auto', 'important');
        s.setProperty('margin-top', '0', 'important');
        s.setProperty('margin-bottom', '0', 'important');
        s.setProperty('bottom', 'auto', 'important');
        var hh = Math.min(el.offsetHeight || 0, yuk - 16);
        s.setProperty('top', (ust + Math.max(8, (yuk - hh) / 2)) + 'px', 'important');
      }else if(o.top !== null && o.bottom !== null){
        s.setProperty('top', (ust + o.top) + 'px', 'important');
        s.setProperty('bottom', 'auto', 'important');
        s.setProperty('height', Math.max(0, yuk - o.top - o.bottom) + 'px', 'important');
        s.setProperty('overflow-y', 'auto', 'important');
      }else if(o.bottom !== null){
        s.setProperty('bottom', Math.max(0, boy - ust - yuk + o.bottom) + 'px', 'important');
      }else{
        s.setProperty('top', (ust + (o.top || 0)) + 'px', 'important');
      }
    });
  }
  function yerIste(){ if(!yerBekliyor){ yerBekliyor = true; requestAnimationFrame(yerlestir); } }

  function tara(kok){
    var liste = kok === document.body ? document.body.querySelectorAll('*') : [kok].concat(kok.querySelectorAll ? Array.prototype.slice.call(kok.querySelectorAll('*')) : []);
    var yeni = false;
    for(var i = 0; i < liste.length; i++){
      var el = liste[i];
      if(el.nodeType !== 1 || el.hasAttribute(ISARET)) continue;
      if(el.tagName === 'DIALOG' || getComputedStyle(el).position === 'fixed'){
        ozgun(el); el.setAttribute(ISARET, ''); sabitler.add(el); yeni = true;
      }
    }
    if(yeni) yerIste();
  }

  function basla(){
    stilEkle();
    var ro = new ResizeObserver(olcIste); ro.observe(document.body);
    var mo = new MutationObserver(function(kayitlar){
      for(var i = 0; i < kayitlar.length; i++){
        var k = kayitlar[i];
        if(k.type === 'childList') k.addedNodes.forEach(function(n){ if(n.nodeType === 1 && (n.childElementCount || 0) < 400) tara(n); });
        else if(k.target.nodeType === 1 && !k.target.hasAttribute(ISARET)) tara(k.target);
      }
      olcIste(); yerIste();
    });
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden']});
    addEventListener('resize', olcIste);
    addEventListener('load', olcIste);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(olcIste);
    tara(document.body); olc();
    yolla({astra: 'hazir'});
  }
  if(document.body) basla(); else document.addEventListener('DOMContentLoaded', basla);

  /* ---------- Astra'dan gelenler ---------- */
  addEventListener('message', function(e){
    if(e.source !== parent || !e.data || typeof e.data !== 'object') return;
    var m = e.data;
    if(m.astra === 'gorunur'){ dilim = {ust: m.ust || 0, yuk: Math.max(m.yuk || 0, 200), boy: m.boy || innerHeight}; yerIste(); }
    else if(m.astra === 'depo-guncel' && typeof m.k === 'string'){ yerel.__ice(m.k, m.v === null || m.v === undefined ? null : String(m.v)); }
    else if(m.astra === 'api-yanit' && bekleyen[m.id]){
      var b = bekleyen[m.id]; delete bekleyen[m.id];
      if(m.hata) b.red(new TypeError(m.hata));
      else b.coz(new Response(m.metin, {status: m.durum, headers: m.basliklar || {}}));
    }
  });
})();
