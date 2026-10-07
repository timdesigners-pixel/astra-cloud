/* Görünüm katmanı: tablolar, kartlar ve grafikler */
(function (global) {
  'use strict';

  var STATUS_BADGE = {
    'Aktif': 'badge-emerald',
    'Beklemede': 'badge-amber',
    'Çekildi': 'badge-blue',
    'Bitti': 'badge-rose'
  };

  var PHONE_BADGE = {
    'Gerekli': 'badge-amber',
    'Gerekmiyor': 'badge-slate',
    'Yapıldı': 'badge-emerald'
  };

  var BONUS_LABEL = {
    deneme: 'Deneme',
    dogumgunu: 'Doğum Günü',
    favori: 'Favori'
  };

  var query = '';

  function setQuery(value) { query = String(value || '').trim(); }

  function badge(text, cls) {
    if (!text) return '<span class="muted">-</span>';
    return '<span class="badge ' + (cls || 'badge-slate') + '">' + U.escapeHtml(text) + '</span>';
  }

  function tags(value) {
    var list = U.splitList(value);
    if (!list.length) return '<span class="muted">-</span>';
    return '<div class="tags">' + list.map(function (item) {
      return '<span class="tag">' + U.escapeHtml(item) + '</span>';
    }).join('') + '</div>';
  }

  function siteCell(site) {
    if (!site) return '<span class="muted">Site silinmiş</span>';
    var url = U.safeUrl(site.url);
    var link = url
      ? '<a class="cell-link" href="' + U.escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + U.icon('link') + 'Güncel giriş</a>'
      : '<span class="cell-sub">Giriş adresi yok</span>';
    return '<div class="cell-title"><span class="strong">' + U.escapeHtml(site.name) + '</span>' + link + '</div>';
  }

  function rowActions(kind, id) {
    return '<button class="row-btn" data-action="edit-' + kind + '" data-id="' + U.escapeHtml(id) + '" title="Düzenle">' + U.icon('edit') + '</button>' +
      '<button class="row-btn danger" data-action="delete-' + kind + '" data-id="' + U.escapeHtml(id) + '" title="Sil">' + U.icon('trash') + '</button>';
  }

  function clip(value) {
    var text = String(value || '').trim();
    if (!text) return '<span class="muted">-</span>';
    return '<span class="clip" title="' + U.escapeHtml(text) + '">' + U.escapeHtml(text) + '</span>';
  }

  function validity(bonus) {
    if (!bonus.startDate && !bonus.endDate) return '<span class="muted">Süresiz</span>';
    var text = U.formatDate(bonus.startDate) + ' → ' + U.formatDate(bonus.endDate);
    var left = U.daysBetween(bonus.endDate);
    var note = '';
    if (left !== null) {
      if (left < 0) note = '<div class="cell-sub c-rose">Süresi doldu</div>';
      else if (left <= 7) note = '<div class="cell-sub c-amber">' + left + ' gün kaldı</div>';
    }
    return '<div class="cell-title"><span class="nowrap">' + U.escapeHtml(text) + '</span>' + note + '</div>';
  }

  /* ---------- Üst özet ---------- */

  function renderStats(tab) {
    var t = Store.totals();
    U.qs('#statDeposit').textContent = U.money(t.deposit);
    U.qs('#statWithdraw').textContent = U.money(t.withdraw);
    U.qs('#statDepositSub').textContent = t.depositCount + ' yatırım işlemi';
    U.qs('#statWithdrawSub').textContent = t.withdrawCount + ' çekim işlemi';

    var net = U.qs('#statNet');
    net.textContent = U.money(t.net);
    net.className = t.net >= 0 ? 'c-emerald' : 'c-rose';

    var label = U.qs('#statFourthLabel');
    var value = U.qs('#statFourth');
    var sub = U.qs('#statFourthSub');
    var iconUse = U.qs('#statFourthIcon use');

    if (tab === 'oyunlar') {
      label.textContent = 'Favori Oyun';
      value.textContent = Store.collection('games').length;
      sub.textContent = 'Kayıtlı oyun';
      iconUse.setAttribute('href', '#i-dice');
    } else if (tab === 'deneme' || tab === 'dogumgunu' || tab === 'favori') {
      var list = Store.collection('bonuses').filter(function (b) { return b.type === tab; });
      label.textContent = BONUS_LABEL[tab] + ' Bonusu';
      value.textContent = list.length;
      sub.textContent = list.filter(function (b) { return b.status === 'Aktif'; }).length + ' tanesi aktif';
      iconUse.setAttribute('href', tab === 'dogumgunu' ? '#i-cake' : (tab === 'favori' ? '#i-star' : '#i-gift'));
    } else if (tab === 'kullanici') {
      label.textContent = 'Kayıtlı Hesap';
      value.textContent = Store.collection('accounts').length;
      sub.textContent = 'Kullanıcı kaydı';
      iconUse.setAttribute('href', '#i-id');
    } else if (tab === 'islemler') {
      label.textContent = 'Toplam İşlem';
      value.textContent = Store.collection('transactions').length;
      sub.textContent = 'Yatırım + çekim';
      iconUse.setAttribute('href', '#i-swap');
    } else {
      label.textContent = 'Kayıtlı Site';
      value.textContent = Store.collection('sites').length;
      sub.textContent = 'Aktif arşiv';
      iconUse.setAttribute('href', '#i-globe');
    }
  }

  function renderCounts() {
    var map = {
      sites: Store.collection('sites').length,
      transactions: Store.collection('transactions').length,
      games: Store.collection('games').length,
      accounts: Store.collection('accounts').length,
      deneme: 0,
      dogumgunu: 0,
      favori: 0
    };
    Store.collection('bonuses').forEach(function (b) {
      if (map[b.type] !== undefined) map[b.type]++;
    });
    U.qsa('[data-count]').forEach(function (el) {
      el.textContent = map[el.getAttribute('data-count')] || 0;
    });

    var size = Store.storageSize();
    var label = DB.isFallback() ? 'Yerel depolama' : 'IndexedDB';
    U.qs('#storageInfo').textContent = label + ' · ' + (size < 1024 ? size + ' B' : (size / 1024).toFixed(1) + ' KB');

    var lockBtn = U.qs('#lockBtn');
    lockBtn.hidden = !Vault.enabled();
    if (Vault.enabled()) {
      var unlocked = Vault.unlocked();
      U.qs('#lockIcon use').setAttribute('href', unlocked ? '#i-unlock' : '#i-lock');
      lockBtn.classList.toggle('is-locked', !unlocked);
      lockBtn.setAttribute('title', unlocked ? 'Kasa açık' : 'Kasa kilitli');
    }
  }

  /* ---------- Genel bakış ---------- */

  function renderFlowChart() {
    var data = Store.monthlyFlow(6);
    var host = U.qs('#flowChart');
    var max = data.reduce(function (acc, item) { return Math.max(acc, item.deposit, item.withdraw); }, 0);

    if (!max) {
      host.innerHTML = '<div class="empty"><strong>Grafik için veri yok</strong>İşlem geçmişine yatırım veya çekim ekleyin.</div>';
      return;
    }

    var w = 300;
    var h = 120;
    var base = 98;
    var maxBar = 84;
    var slot = w / data.length;
    var barW = Math.min(14, slot * 0.28);
    var gap = 4;
    var bars = '';
    var labels = '';

    data.forEach(function (item, index) {
      var center = slot * index + slot / 2;
      var dh = Math.max((item.deposit / max) * maxBar, item.deposit ? 2 : 0.8);
      var wh = Math.max((item.withdraw / max) * maxBar, item.withdraw ? 2 : 0.8);
      bars += '<rect x="' + (center - barW - gap / 2) + '" y="' + (base - dh) + '" width="' + barW + '" height="' + dh + '" rx="3" fill="var(--accent)"></rect>';
      bars += '<rect x="' + (center + gap / 2) + '" y="' + (base - wh) + '" width="' + barW + '" height="' + wh + '" rx="3" fill="var(--blue)"></rect>';
      labels += '<text x="' + center + '" y="112" text-anchor="middle" font-size="9" font-weight="600" fill="var(--muted)">' + U.escapeHtml(U.monthLabel(item.key)) + '</text>';
    });

    host.innerHTML =
      '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Aylık para akışı">' +
      '<line x1="0" y1="' + base + '" x2="' + w + '" y2="' + base + '" stroke="var(--border)" stroke-width="1"></line>' +
      bars + labels +
      '</svg>' +
      '<div class="chart-legend"><span><i style="background:var(--accent)"></i>Yatırım</span>' +
      '<span><i style="background:var(--blue)"></i>Çekim</span>' +
      '<span>En yüksek: ' + U.money(max) + '</span></div>';
  }

  function renderSiteRanking() {
    var host = U.qs('#siteRanking');
    var rows = Store.collection('sites').map(function (site) {
      var t = Store.siteTotals(site.id);
      return { name: site.name, net: t.net, deposit: t.deposit, withdraw: t.withdraw };
    }).filter(function (row) { return row.deposit || row.withdraw; });

    if (!rows.length) {
      host.innerHTML = '<div class="empty"><strong>Henüz finansal veri yok</strong>Sitelere işlem ekleyerek sıralamayı görün.</div>';
      return;
    }

    rows = U.sortBy(rows, function (row) { return Math.abs(row.net); }, true).slice(0, 6);
    var max = rows.reduce(function (acc, row) { return Math.max(acc, Math.abs(row.net)); }, 0) || 1;

    host.innerHTML = '<div class="rank-list">' + rows.map(function (row) {
      var ratio = Math.max(Math.abs(row.net) / max, 0.03) * 100;
      var color = row.net >= 0 ? 'var(--accent)' : 'var(--rose)';
      return '<div class="rank-item">' +
        '<div class="rank-top"><strong>' + U.escapeHtml(row.name) + '</strong>' +
        '<span class="' + (row.net >= 0 ? 'c-emerald' : 'c-rose') + '">' + U.money(row.net) + '</span></div>' +
        '<div class="rank-bar"><i style="width:' + ratio.toFixed(1) + '%;background:' + color + '"></i></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function renderRecentTransactions() {
    var host = U.qs('#recentTransactions');
    var rows = U.sortBy(Store.collection('transactions'), function (tx) { return String(tx.date || ''); }, true).slice(0, 6);

    if (!rows.length) {
      host.innerHTML = '<div class="empty"><strong>Hareket yok</strong>İlk yatırım veya çekim kaydınızı ekleyin.</div>';
      return;
    }

    host.innerHTML = rows.map(function (tx) {
      var isDeposit = tx.type !== 'withdraw';
      return '<div class="list-row">' +
        '<div class="dot ' + (isDeposit ? 'bg-emerald' : 'bg-blue') + '">' + U.icon(isDeposit ? 'download' : 'upload') + '</div>' +
        '<div class="list-main"><strong>' + U.escapeHtml(Store.siteName(tx.siteId)) + '</strong>' +
        '<span>' + U.formatDate(tx.date) + (tx.method ? ' · ' + U.escapeHtml(tx.method) : '') + '</span></div>' +
        '<div class="list-amount ' + (isDeposit ? 'c-emerald' : 'c-blue') + '">' + (isDeposit ? '+' : '−') + ' ' + U.money(tx.amount) + '</div>' +
        '</div>';
    }).join('');
  }

  function renderActiveBonuses() {
    var host = U.qs('#activeBonuses');
    var rows = Store.collection('bonuses').filter(function (b) {
      return b.status === 'Aktif' || b.status === 'Beklemede';
    });

    rows = U.sortBy(rows, function (b) {
      var left = U.daysBetween(b.endDate);
      return left === null ? 9999 : left;
    }).slice(0, 6);

    if (!rows.length) {
      host.innerHTML = '<div class="empty"><strong>Takipte bonus yok</strong>Aktif veya beklemedeki bonuslar burada listelenir.</div>';
      return;
    }

    host.innerHTML = rows.map(function (bonus) {
      var left = U.daysBetween(bonus.endDate);
      var note = left === null ? 'Süresiz' : (left < 0 ? 'Süresi doldu' : left + ' gün kaldı');
      return '<div class="list-row">' +
        '<div class="dot bg-amber">' + U.icon(bonus.type === 'dogumgunu' ? 'cake' : (bonus.type === 'favori' ? 'star' : 'gift')) + '</div>' +
        '<div class="list-main"><strong>' + U.escapeHtml(Store.siteName(bonus.siteId)) + ' · ' + U.escapeHtml(bonus.name || BONUS_LABEL[bonus.type] || '') + '</strong>' +
        '<span>' + U.escapeHtml(bonus.amount || '-') + ' · ' + U.escapeHtml(note) + '</span></div>' +
        badge(bonus.status, STATUS_BADGE[bonus.status]) +
        '</div>';
    }).join('');
  }

  /* ---------- Tablolar ---------- */

  function renderSites() {
    var tbody = U.qs('#tbody-siteler');
    var sortKey = U.qs('#siteSort').value;

    var rows = Store.collection('sites').filter(function (site) {
      return U.matches(query, [site.name, site.url, site.methods, site.providers, site.telegram, site.account, site.note]);
    }).map(function (site) {
      return { site: site, totals: Store.siteTotals(site.id) };
    });

    if (sortKey === 'net') rows = U.sortBy(rows, function (r) { return r.totals.net; }, true);
    else if (sortKey === 'deposit') rows = U.sortBy(rows, function (r) { return r.totals.deposit; }, true);
    else if (sortKey === 'withdraw') rows = U.sortBy(rows, function (r) { return r.totals.withdraw; }, true);
    else if (sortKey === 'recent') rows = U.sortBy(rows, function (r) { return r.totals.lastDate || ''; }, true);
    else rows = U.sortBy(rows, function (r) { return r.site.name; });

    if (!rows.length) {
      tbody.innerHTML = UI.emptyRow(9, 'Site bulunamadı', query ? 'Arama kriterine uyan kayıt yok.' : 'Sağ üstteki “Site Ekle” ile ilk kaydınızı oluşturun.');
      return;
    }

    tbody.innerHTML = rows.map(function (row) {
      var site = row.site;
      var t = row.totals;
      var tg = U.telegramUrl(site.telegram);
      var bonusCount = Store.bonusesOf(site.id).length;

      return '<tr>' +
        '<td>' + siteCell(site) +
          (tg ? '<a class="cell-link" href="' + U.escapeHtml(tg) + '" target="_blank" rel="noopener noreferrer">' + U.icon('tg') + U.escapeHtml(site.telegram) + '</a>' : '') +
        '</td>' +
        '<td class="nowrap c-emerald strong">' + U.money(t.deposit) + '</td>' +
        '<td class="nowrap c-blue strong">' + U.money(t.withdraw) + '</td>' +
        '<td class="nowrap strong ' + (t.net >= 0 ? 'c-emerald' : 'c-rose') + '">' + U.money(t.net) + '</td>' +
        '<td class="nowrap"><div class="cell-title">' +
          '<span>Y: ' + (t.lastDeposit ? U.formatDate(t.lastDeposit.date) + ' · ' + U.money(t.lastDeposit.amount) : '-') + '</span>' +
          '<span class="cell-sub">Ç: ' + (t.lastWithdraw ? U.formatDate(t.lastWithdraw.date) + ' · ' + U.money(t.lastWithdraw.amount) : '-') + '</span>' +
        '</div></td>' +
        '<td class="nowrap"><div class="cell-title"><span>Min Y: ' + U.escapeHtml(site.minDeposit || '-') + '</span>' +
          '<span class="cell-sub">Min Ç: ' + U.escapeHtml(site.minWithdraw || '-') + '</span></div></td>' +
        '<td>' + tags(site.providers) + '<div class="cell-sub">' + U.escapeHtml(site.methods || '-') + '</div></td>' +
        '<td>' + (bonusCount ? badge(bonusCount + ' bonus', 'badge-violet') : '<span class="muted">-</span>') + '</td>' +
        '<td class="actions">' +
          '<button class="row-btn" data-action="add-tx" data-site="' + U.escapeHtml(site.id) + '" title="İşlem ekle">' + U.icon('plus') + '</button> ' +
          rowActions('site', site.id) +
        '</td>' +
        '</tr>';
    }).join('');
  }

  function renderTransactions() {
    var tbody = U.qs('#tbody-islemler');
    var siteFilter = U.qs('#txSiteFilter').value;
    var typeFilter = U.qs('#txTypeFilter').value;

    var rows = Store.collection('transactions').filter(function (tx) {
      if (siteFilter && tx.siteId !== siteFilter) return false;
      if (typeFilter && tx.type !== typeFilter) return false;
      return U.matches(query, [Store.siteName(tx.siteId), tx.method, tx.note, tx.date, tx.amount]);
    });

    rows = U.sortBy(rows, function (tx) { return String(tx.date || ''); }, true);

    if (!rows.length) {
      tbody.innerHTML = UI.emptyRow(7, 'İşlem bulunamadı', 'Yatırım ve çekimlerinizi ekledikçe tüm toplamlar otomatik hesaplanır.');
      return;
    }

    tbody.innerHTML = rows.map(function (tx) {
      var isDeposit = tx.type !== 'withdraw';
      return '<tr>' +
        '<td class="nowrap strong">' + U.formatDate(tx.date) + '</td>' +
        '<td class="strong">' + U.escapeHtml(Store.siteName(tx.siteId)) + '</td>' +
        '<td>' + badge(isDeposit ? 'Yatırım' : 'Çekim', isDeposit ? 'badge-emerald' : 'badge-blue') + '</td>' +
        '<td class="nowrap strong ' + (isDeposit ? 'c-emerald' : 'c-blue') + '">' + (isDeposit ? '+' : '−') + ' ' + U.money(tx.amount) + '</td>' +
        '<td>' + U.escapeHtml(tx.method || '-') + '</td>' +
        '<td>' + clip(tx.note) + '</td>' +
        '<td class="actions">' + rowActions('tx', tx.id) + '</td>' +
        '</tr>';
    }).join('');
  }

  function bonusRows(type) {
    return Store.collection('bonuses').filter(function (bonus) {
      if (bonus.type !== type) return false;
      return U.matches(query, [Store.siteName(bonus.siteId), bonus.name, bonus.amount, bonus.terms, bonus.status, bonus.depositReq]);
    });
  }

  function renderDeneme() {
    var tbody = U.qs('#tbody-deneme');
    var rows = bonusRows('deneme');

    if (!rows.length) {
      tbody.innerHTML = UI.emptyRow(10, 'Deneme bonusu yok', 'Yatırımsız veya şartlı deneme bonuslarınızı buraya ekleyin.');
      return;
    }

    tbody.innerHTML = rows.map(function (bonus) {
      var site = Store.find('sites', bonus.siteId);
      var account = Store.collection('accounts').filter(function (a) { return a.siteId === bonus.siteId; })[0];
      return '<tr>' +
        '<td>' + siteCell(site) + '</td>' +
        '<td class="strong c-emerald nowrap">' + U.escapeHtml(bonus.amount || '-') + '</td>' +
        '<td>' + U.escapeHtml(bonus.depositReq || '-') + '</td>' +
        '<td>' + U.escapeHtml(bonus.withdrawLimit || '-') + '</td>' +
        '<td>' + U.escapeHtml(bonus.wager || '-') + '</td>' +
        '<td>' + clip(bonus.terms) + '</td>' +
        '<td>' + badge(bonus.phoneVerify, PHONE_BADGE[bonus.phoneVerify]) + '</td>' +
        '<td>' + U.escapeHtml((account && account.username) || (site && site.account) || '-') + '</td>' +
        '<td>' + badge(bonus.status, STATUS_BADGE[bonus.status]) + '</td>' +
        '<td class="actions">' + rowActions('bonus', bonus.id) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderDogumGunu() {
    var tbody = U.qs('#tbody-dogumgunu');
    var rows = bonusRows('dogumgunu');

    if (!rows.length) {
      tbody.innerHTML = UI.emptyRow(8, 'Doğum günü bonusu yok', 'Sitelerin doğum gününde verdiği hediyeleri kaydedin.');
      return;
    }

    tbody.innerHTML = rows.map(function (bonus) {
      return '<tr>' +
        '<td>' + siteCell(Store.find('sites', bonus.siteId)) + '</td>' +
        '<td class="strong c-emerald nowrap">' + U.escapeHtml(bonus.amount || '-') + '</td>' +
        '<td>' + clip(bonus.terms) + '</td>' +
        '<td>' + U.escapeHtml(bonus.depositReq || '-') + '</td>' +
        '<td>' + U.escapeHtml(bonus.withdrawLimit || '-') + '</td>' +
        '<td>' + validity(bonus) + '</td>' +
        '<td>' + badge(bonus.status, STATUS_BADGE[bonus.status]) + '</td>' +
        '<td class="actions">' + rowActions('bonus', bonus.id) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderFavori() {
    var tbody = U.qs('#tbody-favori');
    var rows = bonusRows('favori');

    if (!rows.length) {
      tbody.innerHTML = UI.emptyRow(9, 'Favori bonus yok', 'Yatırım bonuslarını ve özel kampanyaları buradan takip edin.');
      return;
    }

    tbody.innerHTML = rows.map(function (bonus) {
      return '<tr>' +
        '<td>' + siteCell(Store.find('sites', bonus.siteId)) + '</td>' +
        '<td class="strong">' + U.escapeHtml(bonus.name || 'Özel bonus') + '</td>' +
        '<td class="c-emerald strong nowrap">' + U.escapeHtml(bonus.amount || '-') + '</td>' +
        '<td>' + U.escapeHtml(bonus.depositReq || '-') + '</td>' +
        '<td>' + U.escapeHtml(bonus.withdrawLimit || '-') + '</td>' +
        '<td>' + tags(bonus.providers) + '</td>' +
        '<td>' + validity(bonus) + '</td>' +
        '<td>' + badge(bonus.status, STATUS_BADGE[bonus.status]) + '</td>' +
        '<td class="actions">' + rowActions('bonus', bonus.id) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderGames() {
    var tbody = U.qs('#tbody-oyunlar');
    var rows = Store.collection('games').filter(function (game) {
      return U.matches(query, [game.name, game.provider, game.features, game.maxWin]);
    });

    if (!rows.length) {
      tbody.innerHTML = UI.emptyRow(7, 'Favori oyun yok', 'Sık oynadığınız oyunları ve rekor kazançlarınızı kaydedin.');
      return;
    }

    tbody.innerHTML = U.sortBy(rows, function (game) { return game.name; }).map(function (game) {
      var count = (game.siteIds || []).length;
      return '<tr>' +
        '<td class="strong">' + U.escapeHtml(game.name) + '</td>' +
        '<td>' + badge(game.provider, 'badge-slate') + '</td>' +
        '<td class="nowrap c-emerald strong">' + U.escapeHtml(game.minBet || '-') + '</td>' +
        '<td class="nowrap c-amber strong">' + U.escapeHtml(game.maxWin || '-') + '</td>' +
        '<td>' + clip(game.features) + '</td>' +
        '<td><button class="btn btn-ghost btn-sm" data-action="game-sites" data-id="' + U.escapeHtml(game.id) + '">' +
          U.icon('eye') + 'Siteleri gör (' + count + ')</button></td>' +
        '<td class="actions">' + rowActions('game', game.id) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderAccounts() {
    var host = U.qs('#accountCards');
    var rows = Store.collection('accounts').filter(function (account) {
      return U.matches(query, [Store.siteName(account.siteId), account.username, account.contact, account.note]);
    });

    if (!rows.length) {
      host.innerHTML = '<div class="empty"><strong>Kayıtlı hesap yok</strong>Sitelerdeki kullanıcı adı ve finansal bilgilerinizi ekleyin.</div>';
      return;
    }

    host.innerHTML = rows.map(function (account) {
      var site = Store.find('sites', account.siteId);
      var url = site ? U.safeUrl(site.url) : '';
      var password = Store.accountField(account, 'password');
      var finances = Store.accountField(account, 'finances');
      var locked = password === null || finances === null;

      return '<article class="acc-card' + (locked ? ' is-locked' : '') + '">' +
        '<div class="acc-head">' +
          '<h4>' + U.escapeHtml(Store.siteName(account.siteId)) +
            (Vault.hasEncrypted(account) ? '<span class="lock-chip" title="Şifreli">' + U.icon(locked ? 'lock' : 'unlock') + '</span>' : '') +
          '</h4>' +
          '<div>' + rowActions('account', account.id) + '</div>' +
        '</div>' +
        '<div class="acc-row"><b>Kullanıcı</b><code>' + U.escapeHtml(account.username) + '</code></div>' +
        '<div class="acc-row"><b>Şifre / ipucu</b><code>' + (password === null ? '••••••••' : U.escapeHtml(password || '-')) + '</code></div>' +
        '<div class="acc-row"><b>İletişim</b><span>' + U.escapeHtml(account.contact || '-') + '</span></div>' +
        (account.note ? '<div class="acc-row"><b>Not</b><span>' + U.escapeHtml(account.note) + '</span></div>' : '') +
        '<pre class="acc-fin">' + (finances === null ? '•••••••••••••••' : U.escapeHtml(finances || 'Finansal hesap kaydı yok')) + '</pre>' +
        (locked
          ? '<button class="btn btn-ghost btn-sm" data-action="security">' + U.icon('lock') + 'Kilidi aç</button>'
          : (url ? '<a class="cell-link" href="' + U.escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + U.icon('link') + 'Siteye git</a>' : '')) +
        '</article>';
    }).join('');
  }

  /* Hesap Yöneticisi'nde sitelerimizle eşleşen platformlar (salt okunur). */
  var hyLimit = 60;

  function renderHyAccounts() {
    var card = U.qs('#hyCard');
    var result = global.HesapEsles ? global.HesapEsles.match(Store.collection('sites')) : { total: 0, rows: [] };
    if (!result.total) { card.hidden = true; return; }
    card.hidden = false;

    var rows = result.rows.filter(function (row) {
      var fields = [row.label];
      row.items.forEach(function (item) { fields.push(item.marka, item.url, item.users.join(' ')); });
      return U.matches(query, fields);
    });
    U.qs('#hySummary').textContent = result.siteCount + ' sitenizin Hesap Yöneticisi\u2019nde karşılığı var (' + result.total + ' platform arasında) · düzeltip güncelleyebilirsiniz, parolalar gösterilmez';

    var host = U.qs('#hyCards');
    var more = U.qs('#hyMore');
    if (!rows.length) {
      host.innerHTML = '<div class="empty"><strong>Eşleşen kayıt yok</strong>' + (query ? 'Arama kriterine uyan kayıt bulunamadı.' : 'Sitelerinizin adı veya adresi Hesap Yöneticisi platformlarıyla eşleşmedi.') + '</div>';
      more.hidden = true;
      return;
    }

    host.innerHTML = rows.slice(0, hyLimit).map(function (row) {
      return '<article class="acc-card">' +
        '<div class="acc-head"><h4>' + U.escapeHtml(row.label) + '</h4></div>' +
        row.items.map(function (item) {
          var url = U.safeUrl(item.url);
          return '<div class="acc-row"><b>Platform</b><span>' + U.escapeHtml(item.marka || '-') + '</span></div>' +
            '<div class="acc-row"><b>Kullanıcı</b><code>' + (item.users.length ? U.escapeHtml(item.users.join(', ')) : '-') + '</code></div>' +
            '<button class="btn btn-ghost btn-sm" data-action="hy-edit" data-id="' + U.escapeHtml(item.id) + '">Düzelt</button> ' +
            (url ? '<a class="cell-link" href="' + U.escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + U.icon('link') + 'Güncel girişe git</a>' : '');
        }).join('') +
        '</article>';
    }).join('');
    more.hidden = rows.length <= hyLimit;
    more.textContent = 'Daha fazla göster (' + (rows.length - hyLimit) + ' kayıt daha)';
  }

  function moreHyAccounts() {
    hyLimit += 60;
    renderHyAccounts();
  }

  function renderGameSites(gameId) {
    var game = Store.find('games', gameId);
    if (!game) return;
    U.qs('#gameSitesTitle').textContent = game.name + ' — Bulunduğu Siteler';
    var body = U.qs('#gameSitesBody');
    var ids = game.siteIds || [];

    if (!ids.length) {
      body.innerHTML = '<div class="empty"><strong>Site seçilmemiş</strong>Oyunu düzenleyerek bulunduğu siteleri işaretleyin.</div>';
      return;
    }

    body.innerHTML = ids.map(function (id) {
      var site = Store.find('sites', id);
      if (!site) return '';
      var url = U.safeUrl(site.url);
      return '<div class="site-line"><span>' + U.escapeHtml(site.name) + '</span>' +
        (url ? '<a class="btn btn-primary btn-sm" href="' + U.escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + U.icon('link') + 'Git</a>'
             : '<span class="muted">Adres yok</span>') +
        '</div>';
    }).join('');
  }

  function renderAll(tab) {
    renderStats(tab);
    renderCounts();
    renderFlowChart();
    renderSiteRanking();
    renderRecentTransactions();
    renderActiveBonuses();
    renderSites();
    renderTransactions();
    renderDeneme();
    renderDogumGunu();
    renderFavori();
    renderGames();
    renderAccounts();
    renderHyAccounts();
  }

  global.Views = {
    setQuery: setQuery,
    renderAll: renderAll,
    renderGameSites: renderGameSites,
    moreHyAccounts: moreHyAccounts,
    renderHyAccounts: renderHyAccounts,
    BONUS_LABEL: BONUS_LABEL
  };
})(window);
