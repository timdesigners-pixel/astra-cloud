/* Veri katmanı: IndexedDB kalıcılığı, bellek içi durum, CRUD ve türetilmiş özetler.
   Parasal alanlar kuruş (tam sayı) olarak saklanır. */
(function (global) {
  'use strict';

  var LEGACY_KEY = 'bahis_takip_v1';
  var THEME_KEY = 'bahis_takip_theme';
  var VERSION = 2;
  var COLLECTIONS = ['sites', 'transactions', 'bonuses', 'games', 'accounts'];

  var listeners = [];
  var state = emptyState();
  var writeChain = Promise.resolve();
  var initMarker = null;

  function emptyState() {
    return { version: VERSION, sites: [], transactions: [], bonuses: [], games: [], accounts: [] };
  }

  /* ASTRA: örnek kayıtlar kaldırıldı — gerçek veri Astra aktarım paketiyle gelir. */
  function seed() {
    return emptyState();
  }

  /* --- Sürüm dönüşümleri --- */

  /* v1 tutarları TL (ondalıklı) idi; v2 kuruş tam sayısı kullanır. */
  function migrateToMinorUnits(data) {
    (data.transactions || []).forEach(function (tx) { tx.amount = U.toMinor(tx.amount); });
    (data.sites || []).forEach(function (site) {
      site.openingDeposit = U.toMinor(site.openingDeposit);
      site.openingWithdraw = U.toMinor(site.openingWithdraw);
    });
    data.version = VERSION;
    return data;
  }

  function normalize(raw) {
    var base = emptyState();
    if (!raw || typeof raw !== 'object') return base;
    COLLECTIONS.forEach(function (name) {
      if (Array.isArray(raw[name])) base[name] = raw[name];
    });
    if ((Number(raw.version) || 0) < VERSION) migrateToMinorUnits(base);
    return base;
  }

  function readLegacy() {
    try {
      var raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var hasData = COLLECTIONS.some(function (name) {
        return Array.isArray(parsed[name]) && parsed[name].length;
      });
      return hasData ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  /* --- Başlangıç --- */

  function init() {
    return DB.readAll().then(function (data) {
      var security = (data.meta || []).filter(function (item) { return item.id === 'security'; })[0] || null;
      Vault.setSettings(security);

      initMarker = (data.meta || []).filter(function (item) { return item.id === 'initialized'; })[0] || null;
      var hasStored = COLLECTIONS.some(function (name) { return (data[name] || []).length; });

      if (initMarker || hasStored) {
        if (!initMarker) initMarker = { id: 'initialized', at: new Date().toISOString() };
        COLLECTIONS.forEach(function (name) { state[name] = data[name] || []; });
        return false;
      }

      initMarker = { id: 'initialized', at: new Date().toISOString() };

      var legacy = readLegacy();
      var initial = legacy ? normalize(Object.assign({ version: 1 }, legacy)) : normalize(seed());
      COLLECTIONS.forEach(function (name) { state[name] = initial[name]; });

      return persistAll().then(function () {
        if (legacy) {
          try { localStorage.removeItem(LEGACY_KEY); } catch (err) { /* yok sayılır */ }
        }
        return !!legacy;
      });
    }).then(function (migrated) {
      emit();
      return migrated;
    });
  }

  /* --- Kalıcılık --- */

  function queue(task) {
    writeChain = writeChain.then(task, task).catch(function () { return null; });
    return writeChain;
  }

  function metaRecords() {
    var records = [];
    if (initMarker) records.push(initMarker);
    if (Vault.settings()) records.push(Vault.settings());
    return records;
  }

  function persistAll() {
    var map = {};
    COLLECTIONS.forEach(function (name) { map[name] = state[name]; });
    map.meta = metaRecords();
    return queue(function () { return DB.replaceMany(map); });
  }

  function persistCollections(names) {
    var map = {};
    names.forEach(function (name) { map[name] = state[name]; });
    return queue(function () { return DB.replaceMany(map); });
  }

  function persistMeta() {
    return queue(function () { return DB.replaceAll('meta', metaRecords()); });
  }

  function emit() {
    listeners.forEach(function (fn) { fn(state); });
  }

  /* --- CRUD --- */

  function collection(name) { return state[name] || []; }

  function find(name, id) {
    return collection(name).filter(function (item) { return item.id === id; })[0] || null;
  }

  function writeRecord(name, record) {
    var list = state[name];
    var index = list.findIndex(function (item) { return item.id === record.id; });
    if (index !== -1) list[index] = record;
    else list.unshift(record);
    emit();
    return queue(function () { return DB.put(name, record); }).then(function () { return record; });
  }

  function upsert(name, data, prefix) {
    var existing = data.id ? find(name, data.id) : null;
    var record = Object.assign({}, existing || {}, data, { id: data.id || U.uid(prefix) });

    if (name === 'accounts') {
      return Vault.encryptRecord(record).then(function (secured) {
        return writeRecord(name, secured);
      });
    }
    return writeRecord(name, record);
  }

  /* Toplu site ekleme: tek çizim, tek yazma. Aynı ada sahip olanlar (büyük/küçük harf ve boşluk farkı yok sayılır) atlanır. */
  function siteKey(name) {
    return String(name || '').toLocaleLowerCase('tr').replace(/[^0-9a-zçğıöşü]+/g, '');
  }

  function planSites(names) {
    var seen = {};
    collection('sites').forEach(function (site) { seen[siteKey(site.name)] = true; });
    var fresh = [];
    var skipped = 0;
    names.forEach(function (raw) {
      var name = String(raw || '').trim().replace(/,+$/, '').trim();
      var key = siteKey(name);
      if (!key) return;
      if (seen[key]) { skipped += 1; return; }
      seen[key] = true;
      fresh.push(name.slice(0, 60));
    });
    return { fresh: fresh, skipped: skipped };
  }

  function addSites(names) {
    var plan = planSites(names);
    var today = U.todayISO();
    plan.fresh.slice().reverse().forEach(function (name) {
      state.sites.unshift({ id: U.uid('site'), name: name, createdAt: today });
    });
    if (plan.fresh.length) {
      emit();
      persistCollections(['sites']);
    }
    return plan;
  }

  function remove(name, id) {
    state[name] = state[name].filter(function (item) { return item.id !== id; });

    if (name !== 'sites') {
      emit();
      return queue(function () { return DB.remove(name, id); });
    }

    state.transactions = state.transactions.filter(function (tx) { return tx.siteId !== id; });
    state.bonuses = state.bonuses.filter(function (bonus) { return bonus.siteId !== id; });
    state.accounts = state.accounts.filter(function (account) { return account.siteId !== id; });
    state.games = state.games.map(function (game) {
      return Object.assign({}, game, {
        siteIds: (game.siteIds || []).filter(function (siteId) { return siteId !== id; })
      });
    });
    emit();
    return persistCollections(COLLECTIONS);
  }

  /* --- Şifreleme --- */

  function enableEncryption(password) {
    return Vault.setup(password).then(function () {
      var jobs = state.accounts.map(function (account) { return Vault.encryptRecord(account); });
      return Promise.all(jobs);
    }).then(function (secured) {
      state.accounts = secured;
      return Promise.all([persistCollections(['accounts']), persistMeta()]);
    }).then(function () {
      return Vault.cacheRecords(state.accounts);
    }).then(function () {
      emit();
      return true;
    });
  }

  function disableEncryption(password) {
    var verify = (!password && Vault.unlocked()) ? Promise.resolve(true) : Vault.unlock(password);
    return verify.then(function () {
      var jobs = state.accounts.map(function (account) { return Vault.decryptRecord(account); });
      return Promise.all(jobs);
    }).then(function (plainRecords) {
      state.accounts = plainRecords;
      Vault.setSettings(null);
      return Promise.all([persistCollections(['accounts']), persistMeta()]);
    }).then(function () {
      emit();
      return true;
    });
  }

  function unlock(password) {
    return Vault.unlock(password).then(function () {
      return Vault.cacheRecords(state.accounts);
    }).then(function () {
      emit();
      return true;
    });
  }

  function lock() {
    Vault.lock();
    emit();
  }

  function accountField(account, field) {
    return Vault.plain(account, field);
  }

  /* --- Türetilmiş veriler --- */

  function inRange(date, from, to) {
    var value = String(date || '');
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  }

  function siteTotals(siteId, from, to) {
    var site = find('sites', siteId);
    var useOpening = !from && !to;
    var deposit = site && useOpening ? Number(site.openingDeposit) || 0 : 0;
    var withdraw = site && useOpening ? Number(site.openingWithdraw) || 0 : 0;
    var lastDeposit = null;
    var lastWithdraw = null;
    var count = 0;

    collection('transactions').forEach(function (tx) {
      if (tx.siteId !== siteId || !inRange(tx.date, from, to)) return;
      count++;
      var amount = Number(tx.amount) || 0;
      if (tx.type === 'withdraw') {
        withdraw += amount;
        if (!lastWithdraw || String(tx.date) > String(lastWithdraw.date)) lastWithdraw = tx;
      } else {
        deposit += amount;
        if (!lastDeposit || String(tx.date) > String(lastDeposit.date)) lastDeposit = tx;
      }
    });

    var lastDate = '';
    [lastDeposit, lastWithdraw].forEach(function (tx) {
      if (tx && String(tx.date) > lastDate) lastDate = String(tx.date);
    });

    return {
      deposit: deposit,
      withdraw: withdraw,
      net: withdraw - deposit,
      count: count,
      lastDeposit: lastDeposit,
      lastWithdraw: lastWithdraw,
      lastDate: lastDate
    };
  }

  function totals(from, to) {
    var deposit = 0;
    var withdraw = 0;
    var depositCount = 0;
    var withdrawCount = 0;

    if (!from && !to) {
      collection('sites').forEach(function (site) {
        deposit += Number(site.openingDeposit) || 0;
        withdraw += Number(site.openingWithdraw) || 0;
      });
    }

    collection('transactions').forEach(function (tx) {
      if (!inRange(tx.date, from, to)) return;
      var amount = Number(tx.amount) || 0;
      if (tx.type === 'withdraw') { withdraw += amount; withdrawCount++; }
      else { deposit += amount; depositCount++; }
    });

    return {
      deposit: deposit,
      withdraw: withdraw,
      net: withdraw - deposit,
      depositCount: depositCount,
      withdrawCount: withdrawCount
    };
  }

  function monthlyFlow(months) {
    var keys = U.lastMonths(months || 6);
    var map = {};
    keys.forEach(function (key) { map[key] = { key: key, deposit: 0, withdraw: 0 }; });
    collection('transactions').forEach(function (tx) {
      var bucket = map[U.monthKey(tx.date)];
      if (!bucket) return;
      var amount = Number(tx.amount) || 0;
      if (tx.type === 'withdraw') bucket.withdraw += amount;
      else bucket.deposit += amount;
    });
    return keys.map(function (key) { return map[key]; });
  }

  function siteName(siteId) {
    var site = find('sites', siteId);
    return site ? site.name : 'Bilinmeyen site';
  }

  function bonusesOf(siteId) {
    return collection('bonuses').filter(function (bonus) { return bonus.siteId === siteId; });
  }

  function storageSize() {
    return DB.estimateSize(state);
  }

  /* --- Yedekleme --- */

  function exportData() {
    var payload = { version: VERSION, exportedAt: new Date().toISOString() };
    COLLECTIONS.forEach(function (name) { payload[name] = state[name]; });
    if (Vault.settings()) payload.security = Vault.settings();
    return JSON.stringify(payload, null, 2);
  }

  function importData(json) {
    var parsed = JSON.parse(json);
    var hasCollection = COLLECTIONS.some(function (name) { return Array.isArray(parsed[name]); });
    if (!hasCollection) throw new Error('Geçersiz yedek dosyası');

    var next = normalize(parsed);
    COLLECTIONS.forEach(function (name) { state[name] = next[name]; });

    Vault.lock();
    Vault.setSettings(parsed.security && parsed.security.enabled ? parsed.security : null);

    emit();
    return persistAll();
  }

  function reset() {
    COLLECTIONS.forEach(function (name) { state[name] = []; });
    Vault.setSettings(null);
    emit();
    return persistAll();
  }

  function theme() {
    try { return localStorage.getItem(THEME_KEY) || ''; } catch (err) { return ''; }
  }

  function setTheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (err) { /* depolama kapalı */ }
  }

  global.Store = {
    get state() { return state; },
    init: init,
    subscribe: function (fn) { listeners.push(fn); },
    collection: collection,
    find: find,
    upsert: upsert,
    remove: remove,
    siteTotals: siteTotals,
    totals: totals,
    monthlyFlow: monthlyFlow,
    siteName: siteName,
    planSites: planSites,
    addSites: addSites,
    bonusesOf: bonusesOf,
    storageSize: storageSize,
    exportData: exportData,
    importData: importData,
    reset: reset,
    enableEncryption: enableEncryption,
    disableEncryption: disableEncryption,
    unlock: unlock,
    lock: lock,
    accountField: accountField,
    theme: theme,
    setTheme: setTheme
  };
})(window);
