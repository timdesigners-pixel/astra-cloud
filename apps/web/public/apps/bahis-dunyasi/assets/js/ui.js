/* Arayüz yardımcıları: tema, kenar çubuğu, modallar, bildirimler */
(function (global) {
  'use strict';

  var openModalEl = null;
  var lastFocused = null;
  var confirmHandler = null;

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    var use = U.qs('#themeIcon use');
    if (use) use.setAttribute('href', mode === 'dark' ? '#i-sun' : '#i-moon');
  }

  function initTheme() {
    var saved = Store.theme();
    /* ASTRA: varsayılan tema koyu; yalnız kullanıcının kaydettiği seçim geçerli. */
    applyTheme(saved || 'dark');
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    Store.setTheme(next);
  }

  function toggleSidebar(force) {
    var sidebar = U.qs('#sidebar');
    var backdrop = U.qs('.backdrop');
    var open = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
  }

  function openModal(id) {
    closeModal();
    var el = U.qs('#' + id);
    if (!el) return null;
    lastFocused = document.activeElement;
    el.hidden = false;
    openModalEl = el;
    var focusable = el.querySelector('input:not([type=hidden]):not([disabled]), select, textarea, button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 30);
    return el;
  }

  function closeModal() {
    if (!openModalEl) return;
    openModalEl.hidden = true;
    openModalEl = null;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  function confirm(options) {
    var opts = options || {};
    U.qs('#confirmTitle').textContent = opts.title || 'Emin misiniz?';
    U.qs('#confirmMessage').textContent = opts.message || 'Bu işlem geri alınamaz.';
    var okBtn = U.qs('#confirmOk');
    okBtn.textContent = opts.okText || 'Sil';
    confirmHandler = opts.onConfirm || null;
    openModal('confirmModal');
  }

  function runConfirm() {
    var handler = confirmHandler;
    confirmHandler = null;
    closeModal();
    if (handler) handler();
  }

  function toast(message, kind) {
    var wrap = U.qs('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (kind === 'err' ? 'err' : 'ok');
    el.innerHTML = U.icon(kind === 'err' ? 'warn' : 'check') + '<span>' + U.escapeHtml(message) + '</span>';
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  }

  function fillSelect(select, items, valueKey, labelKey, placeholder) {
    if (!select) return;
    var current = select.value;
    var html = placeholder ? '<option value="">' + U.escapeHtml(placeholder) + '</option>' : '';
    html += items.map(function (item) {
      return '<option value="' + U.escapeHtml(item[valueKey]) + '">' + U.escapeHtml(item[labelKey]) + '</option>';
    }).join('');
    select.innerHTML = html;
    if (current) select.value = current;
  }

  function formValues(form) {
    var data = {};
    U.qsa('input, select, textarea', form).forEach(function (field) {
      if (!field.name) return;
      if (field.type === 'checkbox') {
        if (!Array.isArray(data[field.name])) data[field.name] = [];
        if (field.checked) data[field.name].push(field.value);
        return;
      }
      data[field.name] = field.value.trim();
    });
    return data;
  }

  function fillForm(form, values) {
    form.reset();
    U.qsa('input, select, textarea', form).forEach(function (field) {
      if (!field.name) return;
      var value = values ? values[field.name] : undefined;
      if (field.type === 'checkbox') {
        field.checked = Array.isArray(value) && value.indexOf(field.value) !== -1;
        return;
      }
      field.value = (value === undefined || value === null) ? '' : value;
    });
  }

  function emptyRow(colspan, title, hint) {
    return '<tr><td colspan="' + colspan + '"><div class="empty"><strong>' + U.escapeHtml(title) + '</strong>' +
      U.escapeHtml(hint || '') + '</div></td></tr>';
  }

  global.UI = {
    initTheme: initTheme,
    toggleTheme: toggleTheme,
    toggleSidebar: toggleSidebar,
    openModal: openModal,
    closeModal: closeModal,
    confirm: confirm,
    runConfirm: runConfirm,
    toast: toast,
    fillSelect: fillSelect,
    formValues: formValues,
    fillForm: fillForm,
    emptyRow: emptyRow
  };
})(window);
