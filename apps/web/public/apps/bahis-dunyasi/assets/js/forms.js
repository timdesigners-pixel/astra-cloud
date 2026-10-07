/* Form ve modal iş akışları */
(function (global) {
  'use strict';

  function siteOptions() {
    return U.sortBy(Store.collection('sites'), function (site) { return site.name; })
      .map(function (site) { return { id: site.id, name: site.name }; });
  }

  function refreshSelects() {
    var options = siteOptions();
    UI.fillSelect(U.qs('#txForm [name="siteId"]'), options, 'id', 'name', 'Site seçin');
    UI.fillSelect(U.qs('#bonusForm [name="siteId"]'), options, 'id', 'name', 'Site seçin');
    UI.fillSelect(U.qs('#accountForm [name="siteId"]'), options, 'id', 'name', 'Site seçin');
    UI.fillSelect(U.qs('#txSiteFilter'), options, 'id', 'name', 'Tüm siteler');
  }

  function requireSite() {
    if (Store.collection('sites').length) return true;
    UI.toast('Önce en az bir site eklemelisiniz', 'err');
    return false;
  }

  /* ---------- Site ---------- */

  function openSite(id) {
    var form = U.qs('#siteForm');
    var site = id ? Store.find('sites', id) : null;
    var values = site ? Object.assign({}, site, {
      openingDeposit: U.minorToInput(site.openingDeposit),
      openingWithdraw: U.minorToInput(site.openingWithdraw)
    }) : {};
    UI.fillForm(form, values);
    U.qs('#siteModalTitle').textContent = site ? 'Siteyi Düzenle' : 'Yeni Site';
    UI.openModal('siteModal');
  }

  function saveSite(event) {
    event.preventDefault();
    var form = event.target;
    var data = UI.formValues(form);
    if (!data.name) { UI.toast('Site adı zorunludur', 'err'); return; }

    var payload = {
      id: data.id || '',
      name: data.name,
      url: U.normalizeUrl(data.url),
      telegram: data.telegram,
      minDeposit: data.minDeposit,
      minWithdraw: data.minWithdraw,
      methods: data.methods,
      providers: data.providers,
      account: data.account,
      openingDeposit: U.toMinor(data.openingDeposit),
      openingWithdraw: U.toMinor(data.openingWithdraw),
      note: data.note
    };
    if (!data.id) payload.createdAt = U.todayISO();

    Store.upsert('sites', payload, 'site');

    UI.closeModal();
    UI.toast(data.id ? 'Site güncellendi' : 'Site eklendi');
  }

  /* ---------- Toplu site ekleme ---------- */

  function bulkNames() {
    return U.qs('#bulkSiteText').value.split(/\r?\n/);
  }

  function updateBulkSummary() {
    var plan = Store.planSites(bulkNames());
    U.qs('#bulkSiteSummary').textContent = plan.fresh.length + ' yeni site eklenecek · ' + plan.skipped + ' zaten kayıtlı (atlanacak)';
    U.qs('#bulkSiteSubmit').disabled = !plan.fresh.length;
  }

  function openBulkSites() {
    U.qs('#bulkSiteText').value = '';
    updateBulkSummary();
    UI.openModal('bulkSiteModal');
  }

  function loadSiteList() {
    U.qs('#bulkSiteText').value = (global.SITE_LISTESI || []).join('\n');
    updateBulkSummary();
  }

  function saveBulkSites(event) {
    event.preventDefault();
    var plan = Store.addSites(bulkNames());
    UI.closeModal();
    UI.toast(plan.fresh.length + ' site eklendi' + (plan.skipped ? ', ' + plan.skipped + ' tanesi zaten kayıtlıydı' : ''));
  }

  /* ---------- Hesap Yöneticisi kaydını düzeltme ---------- */

  var hyDraft = null;

  function drawHyRows() {
    U.qs('#hyRows').innerHTML = hyDraft.rows.map(function (row, i) {
      return '<div class="hy-row" style="display:flex;gap:8px;margin-bottom:6px">' +
        '<input class="input" data-hy-row="' + i + '" value="' + U.escapeHtml(row.k) + '" maxlength="120" placeholder="kullanıcı adı" aria-label="kullanıcı adı ' + (i + 1) + '">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="hy-row-del" data-i="' + i + '" aria-label="satırı sil">Sil</button>' +
      '</div>';
    }).join('') || '<p class="muted sm">Kullanıcı adı yok.</p>';
  }

  function openHyEdit(id) {
    var item = global.HesapEsles && global.HesapEsles.find(id);
    if (!item) { UI.toast('Kayıt bulunamadı', 'err'); return; }
    var form = U.qs('#hyForm');
    form.elements.id.value = item.id;
    form.elements.marka.value = item.marka || '';
    form.elements.giris.value = global.HesapEsles.currentUrl(item);
    hyDraft = { rows: (item.hesaplar || []).map(function (h, i) { return { idx: i, k: typeof h === 'string' ? h : String((h && h.k) || '') }; }) };
    drawHyRows();
    UI.openModal('hyModal');
  }

  function syncHyDraft() {
    U.qsa('#hyRows [data-hy-row]').forEach(function (input) {
      var i = Number(input.getAttribute('data-hy-row'));
      if (hyDraft.rows[i]) hyDraft.rows[i].k = input.value;
    });
  }

  function addHyRow() { if (!hyDraft) return; syncHyDraft(); hyDraft.rows.push({ idx: null, k: '' }); drawHyRows(); }
  function delHyRow(i) { if (!hyDraft) return; syncHyDraft(); hyDraft.rows.splice(i, 1); drawHyRows(); }

  function saveHy(event) {
    event.preventDefault();
    if (!hyDraft) return;
    syncHyDraft();
    var form = event.target;
    var marka = form.elements.marka.value.trim();
    if (!marka) { UI.toast('Platform adı zorunludur', 'err'); return; }
    var ok = global.HesapEsles.save(form.elements.id.value, { marka: marka, giris: form.elements.giris.value, hesaplar: hyDraft.rows });
    UI.closeModal();
    hyDraft = null;
    if (!ok) { UI.toast('Kayıt güncellenemedi', 'err'); return; }
    Views.renderHyAccounts();
    UI.toast('Hesap Yöneticisi kaydı güncellendi');
  }

  /* ---------- İşlem ---------- */

  function openTx(id, presetSiteId) {
    if (!requireSite()) return;
    var tx = id ? Store.find('transactions', id) : null;
    var form = U.qs('#txForm');
    UI.fillForm(form, tx ? Object.assign({}, tx, { amount: U.minorToInput(tx.amount) }) : {
      type: 'deposit',
      date: U.todayISO(),
      siteId: presetSiteId || ''
    });
    U.qs('#txModalTitle').textContent = tx ? 'İşlemi Düzenle' : 'Yeni İşlem';
    UI.openModal('txModal');
  }

  function saveTx(event) {
    event.preventDefault();
    var data = UI.formValues(event.target);
    if (!data.siteId) { UI.toast('Site seçmelisiniz', 'err'); return; }
    var amount = U.toMinor(data.amount);
    if (amount <= 0) { UI.toast('Tutar sıfırdan büyük olmalı', 'err'); return; }

    Store.upsert('transactions', {
      id: data.id || '',
      siteId: data.siteId,
      type: data.type === 'withdraw' ? 'withdraw' : 'deposit',
      amount: amount,
      date: data.date || U.todayISO(),
      method: data.method,
      note: data.note
    }, 'tx');

    UI.closeModal();
    UI.toast(data.id ? 'İşlem güncellendi' : 'İşlem kaydedildi');
  }

  /* ---------- Bonus ---------- */

  function openBonus(id, presetType) {
    if (!requireSite()) return;
    var bonus = id ? Store.find('bonuses', id) : null;
    UI.fillForm(U.qs('#bonusForm'), bonus || {
      type: presetType || 'deneme',
      phoneVerify: 'Gerekli',
      status: 'Aktif'
    });
    U.qs('#bonusModalTitle').textContent = bonus ? 'Bonusu Düzenle' : 'Yeni Bonus';
    UI.openModal('bonusModal');
  }

  function saveBonus(event) {
    event.preventDefault();
    var data = UI.formValues(event.target);
    if (!data.siteId) { UI.toast('Site seçmelisiniz', 'err'); return; }
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      UI.toast('Bitiş tarihi başlangıçtan önce olamaz', 'err');
      return;
    }

    Store.upsert('bonuses', {
      id: data.id || '',
      siteId: data.siteId,
      type: data.type,
      name: data.name,
      amount: data.amount,
      depositReq: data.depositReq,
      withdrawLimit: data.withdrawLimit,
      wager: data.wager,
      providers: data.providers,
      startDate: data.startDate,
      endDate: data.endDate,
      phoneVerify: data.phoneVerify,
      status: data.status,
      terms: data.terms
    }, 'bn');

    UI.closeModal();
    UI.toast(data.id ? 'Bonus güncellendi' : 'Bonus eklendi');
  }

  /* ---------- Oyun ---------- */

  function renderGameSiteList(selected) {
    var host = U.qs('#gameSiteList');
    var sites = siteOptions();
    if (!sites.length) {
      host.innerHTML = '<span class="empty-note">Önce site ekleyin, ardından oyunu sitelerle eşleştirebilirsiniz.</span>';
      return;
    }
    host.innerHTML = sites.map(function (site) {
      var checked = (selected || []).indexOf(site.id) !== -1 ? ' checked' : '';
      return '<label><input type="checkbox" name="siteIds" value="' + U.escapeHtml(site.id) + '"' + checked + '>' +
        U.escapeHtml(site.name) + '</label>';
    }).join('');
  }

  function openGame(id) {
    var game = id ? Store.find('games', id) : null;
    UI.fillForm(U.qs('#gameForm'), game || {});
    renderGameSiteList(game ? game.siteIds : []);
    U.qs('#gameModalTitle').textContent = game ? 'Oyunu Düzenle' : 'Favori Oyun Ekle';
    UI.openModal('gameModal');
  }

  function saveGame(event) {
    event.preventDefault();
    var data = UI.formValues(event.target);
    if (!data.name) { UI.toast('Oyun adı zorunludur', 'err'); return; }

    Store.upsert('games', {
      id: data.id || '',
      name: data.name,
      provider: data.provider,
      minBet: data.minBet,
      maxWin: data.maxWin,
      features: data.features,
      siteIds: Array.isArray(data.siteIds) ? data.siteIds : []
    }, 'gm');

    UI.closeModal();
    UI.toast(data.id ? 'Oyun güncellendi' : 'Oyun eklendi');
  }

  /* ---------- Hesap ---------- */

  function openAccount(id) {
    if (!requireSite()) return;
    if (Vault.enabled() && !Vault.unlocked()) {
      UI.toast('Önce kasanın kilidini açın', 'err');
      openSecurity();
      return;
    }
    var account = id ? Store.find('accounts', id) : null;
    var values = account ? Object.assign({}, account, {
      password: Store.accountField(account, 'password') || '',
      finances: Store.accountField(account, 'finances') || ''
    }) : {};
    UI.fillForm(U.qs('#accountForm'), values);
    U.qs('#accountModalTitle').textContent = account ? 'Hesabı Düzenle' : 'Kullanıcı Hesabı Ekle';
    UI.openModal('accountModal');
  }

  function saveAccount(event) {
    event.preventDefault();
    var data = UI.formValues(event.target);
    if (!data.siteId) { UI.toast('Site seçmelisiniz', 'err'); return; }
    if (!data.username) { UI.toast('Kullanıcı adı zorunludur', 'err'); return; }

    Store.upsert('accounts', {
      id: data.id || '',
      siteId: data.siteId,
      username: data.username,
      password: data.password,
      contact: data.contact,
      finances: data.finances,
      note: data.note
    }, 'ac');

    UI.closeModal();
    UI.toast(data.id ? 'Hesap güncellendi' : 'Hesap eklendi');
  }

  /* ---------- Silme ---------- */

  var DELETE_TEXT = {
    sites: {
      title: 'Site silinsin mi?',
      message: 'Siteye bağlı tüm işlemler, bonuslar ve hesap kayıtları da silinir.'
    },
    transactions: { title: 'İşlem silinsin mi?', message: 'Silinen işlem toplamlardan düşülür.' },
    bonuses: { title: 'Bonus silinsin mi?', message: 'Bonus kaydı kalıcı olarak kaldırılır.' },
    games: { title: 'Oyun silinsin mi?', message: 'Favori oyun kaydı kalıcı olarak kaldırılır.' },
    accounts: { title: 'Hesap silinsin mi?', message: 'Kullanıcı ve finansal bilgi kaydı kalıcı olarak kaldırılır.' }
  };

  function confirmDelete(collection, id) {
    var text = DELETE_TEXT[collection];
    UI.confirm({
      title: text.title,
      message: text.message,
      onConfirm: function () {
        Store.remove(collection, id);
        UI.toast('Kayıt silindi');
      }
    });
  }

  /* ---------- Güvenlik (kasa) ---------- */

  function openSecurity() {
    var enabled = Vault.enabled();
    var unlocked = Vault.unlocked();

    U.qs('#secUnsupported').hidden = Vault.available();
    U.qs('#secSetup').hidden = enabled || !Vault.available();
    U.qs('#secUnlock').hidden = !enabled || unlocked;
    U.qs('#secManage').hidden = !enabled || !unlocked;
    U.qs('#securityTitle').textContent = !enabled ? 'Hassas Alanları Şifrele' : (unlocked ? 'Kasa Açık' : 'Kasa Kilitli');

    U.qs('#secSetupForm').reset();
    U.qs('#secUnlockForm').reset();
    UI.openModal('securityModal');
  }

  function submitSecuritySetup(event) {
    event.preventDefault();
    var data = UI.formValues(event.target);
    if (data.password.length < 6) { UI.toast('Parola en az 6 karakter olmalı', 'err'); return; }
    if (data.password !== data.password2) { UI.toast('Parolalar eşleşmiyor', 'err'); return; }

    Store.enableEncryption(data.password).then(function () {
      UI.closeModal();
      UI.toast('Hassas alanlar şifrelendi');
    }).catch(function () {
      UI.toast('Şifreleme başlatılamadı', 'err');
    });
  }

  function submitSecurityUnlock(event) {
    event.preventDefault();
    var data = UI.formValues(event.target);
    Store.unlock(data.password).then(function () {
      UI.closeModal();
      UI.toast('Kasa açıldı');
    }).catch(function () {
      UI.toast('Parola hatalı', 'err');
    });
  }

  function lockVault() {
    Store.lock();
    UI.closeModal();
    UI.toast('Kasa kilitlendi');
  }

  function disableVault() {
    UI.confirm({
      title: 'Şifreleme kaldırılsın mı?',
      message: 'Şifre ve finansal hesap bilgileri bundan sonra cihazda düz metin olarak saklanır.',
      okText: 'Kaldır',
      onConfirm: function () {
        Store.disableEncryption().then(function () {
          UI.toast('Şifreleme kaldırıldı');
        }).catch(function () {
          UI.toast('İşlem tamamlanamadı', 'err');
        });
      }
    });
  }

  /* ---------- Rapor ---------- */

  function shiftDays(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function openReport() {
    var form = U.qs('#reportForm');
    form.reset();
    form.elements.from.value = shiftDays(-90);
    form.elements.to.value = U.todayISO();

    var sensitive = form.elements.includeSensitive;
    var locked = Vault.enabled() && !Vault.unlocked();
    sensitive.checked = false;
    sensitive.disabled = locked;
    sensitive.parentElement.classList.toggle('is-disabled', locked);

    UI.openModal('reportModal');
  }

  function reportOptions() {
    var data = UI.formValues(U.qs('#reportForm'));
    return {
      from: data.from,
      to: data.to,
      sections: Array.isArray(data.sections) ? data.sections : [],
      includeSensitive: Array.isArray(data.includeSensitive) && data.includeSensitive.length > 0
    };
  }

  function submitReport(event) {
    event.preventDefault();
    var options = reportOptions();
    if (!options.sections.length) { UI.toast('En az bir bölüm seçin', 'err'); return; }
    if (options.from && options.to && options.from > options.to) {
      UI.toast('Bitiş tarihi başlangıçtan önce olamaz', 'err');
      return;
    }
    UI.closeModal();
    Report.print(options);
  }

  function downloadReportCsv() {
    var options = reportOptions();
    var blob = new Blob([Report.csv(options)], { type: 'text/csv;charset=utf-8' });
    U.downloadBlob('bahis-islemler-' + U.todayISO() + '.csv', blob);
    UI.closeModal();
    UI.toast('CSV dosyası indirildi');
  }

  global.Forms = {
    refreshSelects: refreshSelects,
    openSite: openSite,
    saveSite: saveSite,
    openBulkSites: openBulkSites,
    openHyEdit: openHyEdit,
    addHyRow: addHyRow,
    delHyRow: delHyRow,
    saveHy: saveHy,
    loadSiteList: loadSiteList,
    updateBulkSummary: updateBulkSummary,
    saveBulkSites: saveBulkSites,
    openTx: openTx,
    saveTx: saveTx,
    openBonus: openBonus,
    saveBonus: saveBonus,
    openGame: openGame,
    saveGame: saveGame,
    openAccount: openAccount,
    saveAccount: saveAccount,
    confirmDelete: confirmDelete,
    openSecurity: openSecurity,
    submitSecuritySetup: submitSecuritySetup,
    submitSecurityUnlock: submitSecurityUnlock,
    lockVault: lockVault,
    disableVault: disableVault,
    openReport: openReport,
    submitReport: submitReport,
    downloadReportCsv: downloadReportCsv
  };
})(window);
