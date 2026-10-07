/* IndexedDB sarmalayıcı; kullanılamadığında localStorage'a düşer */
(function (global) {
  'use strict';

  var DB_NAME = 'bahis_takip';
  var DB_VERSION = 1;
  var FALLBACK_KEY = 'bahis_takip_v2';
  var STORES = ['sites', 'transactions', 'bonuses', 'games', 'accounts', 'meta'];

  var dbPromise = null;
  var usingFallback = false;

  /* ASTRA: kayıtlar localStorage'da (bahis_takip_v2) tutulur; Astra bu anahtarı
     şifreli kasaya eşitler. IndexedDB kapalı — tasarım ve arayüz değişmedi. */
  function supported() {
    return false;
  }

  function request(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function open() {
    if (dbPromise) return dbPromise;

    if (!supported()) {
      usingFallback = true;
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }

    dbPromise = new Promise(function (resolve, reject) {
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('IndexedDB engellendi')); };
    }).catch(function () {
      usingFallback = true;
      return null;
    });

    return dbPromise;
  }

  /* --- localStorage yedeği --- */

  function fallbackRead() {
    try {
      var raw = localStorage.getItem(FALLBACK_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function fallbackWrite(data) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  function fallbackStore(name) {
    var data = fallbackRead();
    return Array.isArray(data[name]) ? data[name] : [];
  }

  function fallbackSet(name, records) {
    var data = fallbackRead();
    data[name] = records;
    return fallbackWrite(data);
  }

  /* --- Genel API --- */

  function getAll(name) {
    return open().then(function (db) {
      if (!db) return fallbackStore(name);
      return request(db.transaction(name, 'readonly').objectStore(name).getAll());
    }).catch(function () {
      return fallbackStore(name);
    });
  }

  function readAll() {
    return Promise.all(STORES.map(getAll)).then(function (lists) {
      var out = {};
      STORES.forEach(function (name, index) { out[name] = lists[index] || []; });
      return out;
    });
  }

  function put(name, record) {
    return open().then(function (db) {
      if (!db) {
        var list = fallbackStore(name).filter(function (item) { return item.id !== record.id; });
        list.push(record);
        return fallbackSet(name, list);
      }
      var tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).put(record);
      return txDone(tx);
    });
  }

  function remove(name, id) {
    return open().then(function (db) {
      if (!db) {
        return fallbackSet(name, fallbackStore(name).filter(function (item) { return item.id !== id; }));
      }
      var tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).delete(id);
      return txDone(tx);
    });
  }

  function replaceAll(name, records) {
    return open().then(function (db) {
      if (!db) return fallbackSet(name, records.slice());
      var tx = db.transaction(name, 'readwrite');
      var store = tx.objectStore(name);
      store.clear();
      records.forEach(function (record) { store.put(record); });
      return txDone(tx);
    });
  }

  function replaceMany(map) {
    var names = Object.keys(map);
    return open().then(function (db) {
      if (!db) {
        names.forEach(function (name) { fallbackSet(name, map[name].slice()); });
        return true;
      }
      var tx = db.transaction(names, 'readwrite');
      names.forEach(function (name) {
        var store = tx.objectStore(name);
        store.clear();
        map[name].forEach(function (record) { store.put(record); });
      });
      return txDone(tx);
    });
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  function estimateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (err) {
      return JSON.stringify(data).length;
    }
  }

  global.DB = {
    STORES: STORES,
    open: open,
    readAll: readAll,
    getAll: getAll,
    put: put,
    remove: remove,
    replaceAll: replaceAll,
    replaceMany: replaceMany,
    estimateSize: estimateSize,
    isFallback: function () { return usingFallback; }
  };
})(window);
