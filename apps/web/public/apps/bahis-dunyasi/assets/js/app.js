/* Uygulama başlangıcı: sekme yönlendirmesi, olay dinleyicileri, yedekleme */
(function (global) {
  'use strict';

  var TABS = {
    panel: { title: 'Genel Bakış', subtitle: 'Tüm arşivin finansal özeti, akış grafiği ve son hareketler', add: 'add-site', addText: 'Site Ekle' },
    siteler: { title: 'Siteler', subtitle: 'Site detayları, güncel girişler ve finansal toplamlar', add: 'add-site', addText: 'Site Ekle' },
    islemler: { title: 'İşlem Geçmişi', subtitle: 'Yatırım ve çekim hareketleri; toplamlar buradan hesaplanır', add: 'add-tx', addText: 'İşlem Ekle' },
    deneme: { title: 'Deneme Bonusları', subtitle: 'Yatırımsız veya şartlı deneme bonusları ve çevrim durumları', add: 'add-bonus', addText: 'Bonus Ekle', type: 'deneme' },
    dogumgunu: { title: 'Doğum Günü Bonusları', subtitle: 'Doğum gününde verilen hediyeler, şartlar ve geçerlilik süreleri', add: 'add-bonus', addText: 'Bonus Ekle', type: 'dogumgunu' },
    favori: { title: 'Favori Bonuslar', subtitle: 'Yatırım bonusları ve takip edilen özel kampanyalar', add: 'add-bonus', addText: 'Bonus Ekle', type: 'favori' },
    oyunlar: { title: 'Favori Oyunlar', subtitle: 'Oynanan oyunlar, sağlayıcılar, rekor kazançlar ve bulunduğu siteler', add: 'add-game', addText: 'Oyun Ekle' },
    kullanici: { title: 'Hesap Bilgileri', subtitle: 'Kullanıcı adları, şifre ipuçları ve kayıtlı finansal hesaplar', add: 'add-account', addText: 'Hesap Ekle' }
  };

  var currentTab = 'panel';

  function render() {
    Forms.refreshSelects();
    Views.renderAll(currentTab);
  }

  function switchTab(tab) {
    if (!TABS[tab]) tab = 'panel';
    currentTab = tab;

    U.qsa('.view').forEach(function (view) {
      view.classList.toggle('is-active', view.id === 'view-' + tab);
    });
    U.qsa('.nav-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
    });

    var meta = TABS[tab];
    U.qs('#pageTitle').textContent = meta.title;
    U.qs('#pageSubtitle').textContent = meta.subtitle;

    var addBtn = U.qs('#primaryAdd');
    addBtn.setAttribute('data-action', meta.add);
    if (meta.type) addBtn.setAttribute('data-type', meta.type);
    else addBtn.removeAttribute('data-type');
    U.qs('#primaryAddText').textContent = meta.addText;

    if (global.location.hash.slice(1) !== tab) {
      global.history.replaceState(null, '', '#' + tab);
    }

    if (global.innerWidth <= 860) UI.toggleSidebar(false);
    U.qs('.content').scrollTop = 0;
    render();
  }

  /* ---------- Yedekleme ---------- */

  function exportBackup() {
    try {
      var blob = new Blob([Store.exportData()], { type: 'application/json' });
      U.downloadBlob('bahis-takip-yedek-' + U.todayISO() + '.json', blob);
      UI.toast('Yedek dosyası indirildi');
    } catch (err) {
      UI.toast('Yedek alınamadı', 'err');
    }
  }

  function importBackup(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        Store.importData(e.target.result).then(function () {
          UI.toast(Vault.enabled() ? 'Yedek geri yüklendi · hassas alanlar kilitli' : 'Yedek geri yüklendi');
        });
      } catch (err) {
        UI.toast('Dosya okunamadı veya biçim geçersiz', 'err');
      }
      event.target.value = '';
    };
    reader.onerror = function () {
      UI.toast('Dosya okunamadı', 'err');
      event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  }

  function wipeAll() {
    UI.confirm({
      title: 'Tüm veriler silinsin mi?',
      message: 'Siteler, işlemler, bonuslar, oyunlar ve hesaplar dahil her şey kaldırılır. Öncesinde yedek almanız önerilir.',
      okText: 'Hepsini sil',
      onConfirm: function () {
        Store.reset();
        UI.toast('Tüm veriler silindi');
      }
    });
  }

  /* ---------- Olaylar ---------- */

  var ACTIONS = {
    'tab': function (el) { switchTab(el.getAttribute('data-tab')); },
    'theme': function () { UI.toggleTheme(); },
    'toggle-sidebar': function () { UI.toggleSidebar(); },
    'close-modal': function () { UI.closeModal(); },
    'export': exportBackup,
    'wipe': wipeAll,
    'clear-filters': function () {
      U.qs('#globalSearch').value = '';
      U.qs('#siteSort').value = 'name';
      U.qs('#txSiteFilter').value = '';
      U.qs('#txTypeFilter').value = '';
      Views.setQuery('');
      render();
    },
    'add-site': function () { Forms.openSite(); },
    'bulk-sites': function () { Forms.openBulkSites(); },
    'hy-more': function () { Views.moreHyAccounts(); },
    'hy-edit': function (el) { Forms.openHyEdit(el.getAttribute('data-id')); },
    'hy-row-add': function () { Forms.addHyRow(); },
    'hy-row-del': function (el) { Forms.delHyRow(Number(el.getAttribute('data-i'))); },
    'bulk-load': function () { Forms.loadSiteList(); },
    'edit-site': function (el) { Forms.openSite(el.getAttribute('data-id')); },
    'delete-site': function (el) { Forms.confirmDelete('sites', el.getAttribute('data-id')); },
    'add-tx': function (el) { Forms.openTx(null, el.getAttribute('data-site')); },
    'edit-tx': function (el) { Forms.openTx(el.getAttribute('data-id')); },
    'delete-tx': function (el) { Forms.confirmDelete('transactions', el.getAttribute('data-id')); },
    'add-bonus': function (el) { Forms.openBonus(null, el.getAttribute('data-type') || TABS[currentTab].type); },
    'edit-bonus': function (el) { Forms.openBonus(el.getAttribute('data-id')); },
    'delete-bonus': function (el) { Forms.confirmDelete('bonuses', el.getAttribute('data-id')); },
    'add-game': function () { Forms.openGame(); },
    'edit-game': function (el) { Forms.openGame(el.getAttribute('data-id')); },
    'delete-game': function (el) { Forms.confirmDelete('games', el.getAttribute('data-id')); },
    'game-sites': function (el) {
      Views.renderGameSites(el.getAttribute('data-id'));
      UI.openModal('gameSitesModal');
    },
    'add-account': function () { Forms.openAccount(); },
    'report': function () { Forms.openReport(); },
    'report-csv': function () { Forms.downloadReportCsv(); },
    'security': function () { Forms.openSecurity(); },
    'lock-vault': function () { Forms.lockVault(); },
    'disable-vault': function () { Forms.disableVault(); },
    'edit-account': function (el) { Forms.openAccount(el.getAttribute('data-id')); },
    'delete-account': function (el) { Forms.confirmDelete('accounts', el.getAttribute('data-id')); }
  };

  function onClick(event) {
    var trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    var action = ACTIONS[trigger.getAttribute('data-action')];
    if (!action) return;
    event.preventDefault();
    action(trigger);
  }

  function bind() {
    document.addEventListener('click', onClick);

    U.qs('#globalSearch').addEventListener('input', U.debounce(function (event) {
      Views.setQuery(event.target.value);
      render();
    }, 140));

    U.qs('#siteSort').addEventListener('change', render);
    U.qs('#txSiteFilter').addEventListener('change', render);
    U.qs('#txTypeFilter').addEventListener('change', render);
    U.qs('#importFile').addEventListener('change', importBackup);
    U.qs('#confirmOk').addEventListener('click', UI.runConfirm);

    U.qs('#siteForm').addEventListener('submit', Forms.saveSite);
    U.qs('#bulkSiteForm').addEventListener('submit', Forms.saveBulkSites);
    U.qs('#hyForm').addEventListener('submit', Forms.saveHy);
    U.qs('#bulkSiteText').addEventListener('input', Forms.updateBulkSummary);
    U.qs('#txForm').addEventListener('submit', Forms.saveTx);
    U.qs('#bonusForm').addEventListener('submit', Forms.saveBonus);
    U.qs('#gameForm').addEventListener('submit', Forms.saveGame);
    U.qs('#accountForm').addEventListener('submit', Forms.saveAccount);
    U.qs('#reportForm').addEventListener('submit', Forms.submitReport);
    U.qs('#secSetupForm').addEventListener('submit', Forms.submitSecuritySetup);
    U.qs('#secUnlockForm').addEventListener('submit', Forms.submitSecurityUnlock);

    U.qsa('.modal').forEach(function (modal) {
      modal.addEventListener('mousedown', function (event) {
        if (event.target === modal) UI.closeModal();
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { UI.closeModal(); return; }
      if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
        event.preventDefault();
        U.qs('#globalSearch').focus();
      }
    });

    global.addEventListener('hashchange', function () {
      var tab = global.location.hash.slice(1);
      if (TABS[tab] && tab !== currentTab) switchTab(tab);
    });

    Store.subscribe(render);
  }

  function init() {
    UI.initTheme();
    bind();

    Store.init().then(function (migrated) {
      switchTab(global.location.hash.slice(1) || 'panel');
      if (migrated) UI.toast('Kayıtlar yeni depolama biçimine taşındı');
    }).catch(function () {
      switchTab(global.location.hash.slice(1) || 'panel');
      UI.toast('Veriler yüklenemedi', 'err');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
