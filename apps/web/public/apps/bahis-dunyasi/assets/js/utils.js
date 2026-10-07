/* Ortak yardımcı fonksiyonlar */
(function (global) {
  'use strict';

  var TRY = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var NUM = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Tutarlar kuruş (tam sayı) olarak saklanır; biçimlendirme TL'ye çevirir. */
  function money(minor) {
    return TRY.format(fromMinor(minor)) + ' ₺';
  }

  function fromMinor(minor) {
    var n = Number(minor);
    return isFinite(n) ? n / 100 : 0;
  }

  /* "1.234,56" / "1234.56" / 1234.56 -> 123456 kuruş */
  function toMinor(value) {
    if (typeof value === 'number') return isFinite(value) ? Math.round(value * 100) : 0;
    var text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return 0;
    text = text.replace(/[^0-9.,-]/g, '');
    var hasComma = text.indexOf(',') !== -1;
    var hasDot = text.indexOf('.') !== -1;
    if (hasComma && hasDot) {
      text = text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (hasComma) {
      text = text.replace(',', '.');
    }
    var n = parseFloat(text);
    return isFinite(n) ? Math.round(n * 100) : 0;
  }

  /* Form alanlarında gösterilecek TL değeri (virgüllü) */
  function minorToInput(minor) {
    var n = Number(minor);
    if (!isFinite(n) || n === 0) return '';
    return (n / 100).toFixed(2).replace('.', ',');
  }

  function number(value) {
    var n = Number(value);
    return NUM.format(isFinite(n) ? n : 0);
  }

  function toNumber(value) {
    var n = parseFloat(String(value === undefined || value === null ? '' : value).replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  /* ISO (yyyy-mm-dd) -> gg.aa.yyyy */
  function formatDate(iso) {
    if (!iso) return '-';
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length !== 3) return String(iso);
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function monthKey(iso) {
    return String(iso || '').slice(0, 7);
  }

  function monthLabel(key) {
    var parts = String(key).split('-');
    if (parts.length < 2) return key;
    return MONTHS[Number(parts[1]) - 1] + ' ' + String(parts[0]).slice(2);
  }

  /* Son n ayın anahtarları, eskiden yeniye */
  function lastMonths(n) {
    var out = [];
    var d = new Date();
    d.setDate(1);
    for (var i = n - 1; i >= 0; i--) {
      var c = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(c.getFullYear() + '-' + String(c.getMonth() + 1).padStart(2, '0'));
    }
    return out;
  }

  function daysBetween(iso) {
    if (!iso) return null;
    var target = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    if (isNaN(target.getTime())) return null;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function splitList(value) {
    return String(value || '')
      .split(',')
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function normalizeUrl(value) {
    var url = String(value || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
  }

  /* Sadece http/https bağlantılarına izin verilir */
  function safeUrl(value) {
    var url = normalizeUrl(value);
    if (!url) return '';
    try {
      var parsed = new URL(url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch (err) {
      return '';
    }
  }

  function telegramUrl(handle) {
    var clean = String(handle || '').trim().replace(/^@/, '');
    if (!clean) return '';
    if (/^https?:\/\//i.test(handle)) return safeUrl(handle);
    if (!/^[A-Za-z0-9_]{3,64}$/.test(clean)) return '';
    return 'https://t.me/' + clean;
  }

  function sortBy(list, getter, desc) {
    return list.slice().sort(function (a, b) {
      var av = getter(a);
      var bv = getter(b);
      if (typeof av === 'string' || typeof bv === 'string') {
        var cmp = String(av || '').localeCompare(String(bv || ''), 'tr');
        return desc ? -cmp : cmp;
      }
      return desc ? (bv - av) : (av - bv);
    });
  }

  function matches(query, fields) {
    if (!query) return true;
    var q = query.toLocaleLowerCase('tr');
    return fields.some(function (field) {
      return String(field === null || field === undefined ? '' : field).toLocaleLowerCase('tr').indexOf(q) !== -1;
    });
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 120);
    };
  }

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function csvCell(value) {
    var text = String(value === undefined || value === null ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function csvRows(rows) {
    return '\ufeff' + rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');
  }

  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '"><use href="#i-' + name + '"></use></svg>';
  }

  global.U = {
    escapeHtml: escapeHtml,
    money: money,
    fromMinor: fromMinor,
    toMinor: toMinor,
    minorToInput: minorToInput,
    number: number,
    toNumber: toNumber,
    formatDate: formatDate,
    todayISO: todayISO,
    monthKey: monthKey,
    monthLabel: monthLabel,
    lastMonths: lastMonths,
    daysBetween: daysBetween,
    uid: uid,
    splitList: splitList,
    normalizeUrl: normalizeUrl,
    safeUrl: safeUrl,
    telegramUrl: telegramUrl,
    sortBy: sortBy,
    matches: matches,
    debounce: debounce,
    qs: qs,
    qsa: qsa,
    icon: icon,
    csvRows: csvRows,
    downloadBlob: downloadBlob
  };
})(window);
