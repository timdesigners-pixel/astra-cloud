/* Hesap Yöneticisi eşleşmesi.
   Hesap Yöneticisi kaydı (hesap-yoneticisi-v1) Astra köprüsünden gelir; köprü bu uygulamaya yalnız o anahtarı
   yazma izni verir (geçerli biçimde). Burada Bahis Dünyası sitelerinin adı veya adresiyle eşleşen platformlar bulunur
   ve düzeltilebilir. Parolalar gösterilmez; düzenlemede satırın parolası olduğu gibi korunur. */
(function (global) {
  'use strict';

  var ANAHTAR = 'hesap-yoneticisi-v1';

  function key(text) {
    return String(text || '').toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]+/g, '');
  }

  /* "betnano1740direct" -> "betnano": sondaki alan uzantısı sözcükleri ve sayılar atılır (adres her değiştiğinde sayı artar). */
  function base(text) {
    var k = key(text);
    var prev;
    do {
      prev = k;
      k = k.replace(/(direct|pro|top|com|net|org|app|vip)$/, '').replace(/\d+$/, '');
    } while (k !== prev);
    /* "Xvapp" -> "xv": çok kısalırsa sonek atılmaz (kısa adlar yanlış tabana düşmesin). */
    return k.length < 3 ? key(text) : k;
  }

  function hostLabel(url) {
    var text = String(url || '').trim();
    if (!text) return '';
    try {
      var host = new URL(/^[a-z]+:\/\//i.test(text) ? text : 'https://' + text).hostname.replace(/^www\./, '');
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
      var parts = host.split('.');
      if (parts.length >= 3 && /^(com|net|org|gov|edu)$/.test(parts[parts.length - 2])) return parts[parts.length - 3];
      return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    } catch (err) {
      return '';
    }
  }

  function read() {
    try {
      var raw = global.localStorage.getItem(ANAHTAR);
      var data = raw ? JSON.parse(raw) : null;
      return data && Array.isArray(data.siteler) ? data.siteler : [];
    } catch (err) {
      return [];
    }
  }

  /* Hesap Yöneticisi'ndeki "güncel giriş" kuralı: elle girilmişse o; değilse sayısı en büyük alan adı. */
  function currentUrl(item) {
    if (item.giris) return String(item.giris);
    var list = Array.isArray(item.adresler) ? item.adresler : [];
    if (!list.length) return '';
    var domains = list.filter(function (a) { return !/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(a); });
    var pool = domains.length ? domains : list;
    var best = pool[0];
    var bestScore = -1;
    pool.forEach(function (a) {
      var score = Math.max.apply(null, [0].concat((String(a).match(/\d+/g) || []).map(Number)));
      if (score >= bestScore) { best = a; bestScore = score; }
    });
    return String(best);
  }

  function indexOf(items) {
    var map = {};
    items.forEach(function (item) {
      var keys = {};
      [item.marka, hostLabel(item.giris)].concat((item.adresler || []).map(hostLabel)).forEach(function (t) {
        var b = base(t);
        if (b.length >= 3) keys[b] = true;
      });
      Object.keys(keys).forEach(function (b) { (map[b] = map[b] || []).push(item); });
    });
    return map;
  }

  /* Bahis Dünyası siteleri için eşleşen Hesap Yöneticisi platformları: [{site, items:[…]}] */
  function match(sites) {
    var items = read();
    if (!items.length) return { total: 0, rows: [] };
    var map = indexOf(items);
    var rows = [];
    sites.forEach(function (site) {
      var seen = {};
      var found = [];
      [site.name, hostLabel(site.url)].forEach(function (t) {
        var b = base(t);
        (map[b] || []).forEach(function (item) {
          if (!seen[item.id]) { seen[item.id] = true; found.push(item); }
        });
      });
      if (found.length) {
        rows.push({
          site: site,
          items: found.map(function (item) {
            return {
              id: item.id,
              marka: String(item.marka || ''),
              url: currentUrl(item),
              users: (item.hesaplar || []).map(function (h) { return typeof h === 'string' ? h : String((h && h.k) || ''); }).filter(Boolean)
            };
          })
        });
      }
    });
    /* Aynı platformlara düşen siteler (ör. Betnano1740…1792.Direct) tek satırda toplanır. */
    var merged = [];
    var byIds = {};
    rows.forEach(function (row) {
      var ids = row.items.map(function (i) { return i.id; }).sort().join('|');
      if (byIds[ids]) { byIds[ids].names.push(row.site.name); return; }
      row.names = [row.site.name];
      byIds[ids] = row;
      merged.push(row);
    });
    merged.forEach(function (row) { row.label = row.names.join(', '); });
    return { total: items.length, rows: merged, siteCount: rows.length };
  }

  /* Bir platformu günceller. hesaplar: [{idx, k}] — idx özgün satır sırası (parolası korunur), null ise yeni satır.
     Kaydın geri kalanı (diğer platformlar, etiketler, adresler) olduğu gibi yazılır. */
  function save(id, changes) {
    var raw;
    try { raw = global.localStorage.getItem(ANAHTAR); } catch (err) { return false; }
    var data;
    try { data = raw ? JSON.parse(raw) : null; } catch (err) { return false; }
    if (!data || !Array.isArray(data.siteler)) return false;
    var item = data.siteler.filter(function (x) { return x && x.id === id; })[0];
    if (!item) return false;
    var oldRows = Array.isArray(item.hesaplar) ? item.hesaplar.map(function (h) { return typeof h === 'string' ? { k: h, p: '' } : h; }) : [];
    item.marka = String(changes.marka || '').trim() || item.marka;
    item.giris = String(changes.giris || '').trim();
    item.hesaplar = (changes.hesaplar || []).map(function (row) {
      var old = row.idx !== null && row.idx !== undefined ? oldRows[row.idx] : null;
      return Object.assign({}, old || {}, { k: String(row.k || '').trim(), p: old ? String(old.p || '') : '' });
    }).filter(function (h) { return h.k; });
    try { global.localStorage.setItem(ANAHTAR, JSON.stringify(data)); } catch (err) { return false; }
    return true;
  }

  function find(id) {
    var list = read();
    return list.filter(function (x) { return x && x.id === id; })[0] || null;
  }

  global.HesapEsles = { match: match, base: base, hostLabel: hostLabel, save: save, find: find, currentUrl: currentUrl };
})(window);
