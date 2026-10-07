/* Hassas alanların WebCrypto (PBKDF2 + AES-GCM) ile şifrelenmesi */
(function (global) {
  'use strict';

  var SENSITIVE = ['password', 'finances'];
  var ITERATIONS = 250000;
  var VERIFY_TEXT = 'bahis-takip-dogrulama';

  var subtle = (global.crypto && global.crypto.subtle) || null;
  var key = null;           // çözülmüş oturum anahtarı
  var settings = null;      // { enabled, salt, iterations, verifier }
  var plainCache = {};      // "kayitId:alan" -> düz metin

  function available() { return !!subtle; }

  function toBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return global.btoa(binary);
  }

  function fromBase64(text) {
    var binary = global.atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomBytes(length) {
    return global.crypto.getRandomValues(new Uint8Array(length));
  }

  function deriveKey(password, saltB64, iterations) {
    return subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (baseKey) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: fromBase64(saltB64), iterations: iterations, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      });
  }

  function encryptWith(cryptoKey, text) {
    var iv = randomBytes(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, new TextEncoder().encode(text))
      .then(function (buffer) {
        return { __enc: 1, iv: toBase64(iv), data: toBase64(buffer) };
      });
  }

  function decryptWith(cryptoKey, payload) {
    return subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, cryptoKey, fromBase64(payload.data))
      .then(function (buffer) { return new TextDecoder().decode(buffer); });
  }

  function isEncrypted(value) {
    return !!value && typeof value === 'object' && value.__enc === 1 && value.iv && value.data;
  }

  function setSettings(value) {
    settings = value || null;
    if (!settings || !settings.enabled) {
      key = null;
      plainCache = {};
    }
  }

  function enabled() { return !!(settings && settings.enabled); }
  function unlocked() { return !!key; }

  /* Parola ile yeni kasa kurulumu; mevcut kayıtlar çağıran tarafından yeniden şifrelenir. */
  function setup(password) {
    if (!available()) return Promise.reject(new Error('Tarayıcı şifreleme desteklemiyor'));
    var salt = toBase64(randomBytes(16));
    return deriveKey(password, salt, ITERATIONS).then(function (cryptoKey) {
      return encryptWith(cryptoKey, VERIFY_TEXT).then(function (verifier) {
        key = cryptoKey;
        settings = { id: 'security', enabled: true, salt: salt, iterations: ITERATIONS, verifier: verifier };
        plainCache = {};
        return settings;
      });
    });
  }

  function unlock(password) {
    if (!enabled()) return Promise.resolve(true);
    if (!available()) return Promise.reject(new Error('Tarayıcı şifreleme desteklemiyor'));
    return deriveKey(password, settings.salt, settings.iterations || ITERATIONS)
      .then(function (cryptoKey) {
        return decryptWith(cryptoKey, settings.verifier).then(function (text) {
          if (text !== VERIFY_TEXT) throw new Error('Parola hatalı');
          key = cryptoKey;
          return true;
        });
      })
      .catch(function () { throw new Error('Parola hatalı'); });
  }

  function lock() {
    key = null;
    plainCache = {};
  }

  function cacheKey(id, field) { return id + ':' + field; }

  /* Kayıttaki hassas alanları şifreler (kasa kapalıysa olduğu gibi bırakır). */
  function encryptRecord(record) {
    if (!enabled() || !unlocked()) return Promise.resolve(record);
    var copy = Object.assign({}, record);
    var jobs = SENSITIVE.map(function (field) {
      var value = copy[field];
      if (isEncrypted(value)) return Promise.resolve();
      var text = value === undefined || value === null ? '' : String(value);
      plainCache[cacheKey(copy.id, field)] = text;
      if (!text) { copy[field] = ''; return Promise.resolve(); }
      return encryptWith(key, text).then(function (payload) { copy[field] = payload; });
    });
    return Promise.all(jobs).then(function () { return copy; });
  }

  /* Şifreli alanları düz metne çevirir. */
  function decryptRecord(record) {
    if (!unlocked()) return Promise.resolve(record);
    var copy = Object.assign({}, record);
    var jobs = SENSITIVE.map(function (field) {
      if (!isEncrypted(copy[field])) return Promise.resolve();
      return decryptWith(key, copy[field])
        .then(function (text) { copy[field] = text; })
        .catch(function () { copy[field] = ''; });
    });
    return Promise.all(jobs).then(function () { return copy; });
  }

  /* Kilit açıldıktan sonra tüm kayıtları önbelleğe çözer. */
  function cacheRecords(records) {
    plainCache = {};
    if (!unlocked()) return Promise.resolve(false);
    var jobs = [];
    records.forEach(function (record) {
      SENSITIVE.forEach(function (field) {
        var value = record[field];
        if (isEncrypted(value)) {
          jobs.push(decryptWith(key, value)
            .then(function (text) { plainCache[cacheKey(record.id, field)] = text; })
            .catch(function () { plainCache[cacheKey(record.id, field)] = ''; }));
        } else {
          plainCache[cacheKey(record.id, field)] = value === undefined || value === null ? '' : String(value);
        }
      });
    });
    return Promise.all(jobs).then(function () { return true; });
  }

  /* Render sırasında senkron okuma: kilitliyse null döner. */
  function plain(record, field) {
    var value = record ? record[field] : '';
    if (!isEncrypted(value)) return value === undefined || value === null ? '' : String(value);
    if (!unlocked()) return null;
    var cached = plainCache[cacheKey(record.id, field)];
    return cached === undefined ? null : cached;
  }

  function hasEncrypted(record) {
    return SENSITIVE.some(function (field) { return isEncrypted(record[field]); });
  }

  global.Vault = {
    SENSITIVE: SENSITIVE,
    available: available,
    enabled: enabled,
    unlocked: unlocked,
    setSettings: setSettings,
    settings: function () { return settings; },
    setup: setup,
    unlock: unlock,
    lock: lock,
    encryptRecord: encryptRecord,
    decryptRecord: decryptRecord,
    cacheRecords: cacheRecords,
    plain: plain,
    isEncrypted: isEncrypted,
    hasEncrypted: hasEncrypted
  };
})(window);
