/* Rapor üretimi: yazdırma/PDF sayfası ve CSV dışa aktarma */
(function (global) {
  'use strict';

  var TYPE_LABEL = { deneme: 'Deneme', dogumgunu: 'Doğum Günü', favori: 'Favori' };
  var MASK = '•••••';

  function esc(value) { return U.escapeHtml(value); }

  function inRange(date, from, to) {
    var value = String(date || '');
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  }

  function table(headers, rows, aligns) {
    if (!rows.length) return '<p class="rp-empty">Bu bölümde kayıt yok.</p>';
    var head = headers.map(function (header, i) {
      return '<th' + (aligns && aligns[i] === 'r' ? ' class="r"' : '') + '>' + esc(header) + '</th>';
    }).join('');
    var body = rows.map(function (row) {
      return '<tr>' + row.map(function (cell, i) {
        return '<td' + (aligns && aligns[i] === 'r' ? ' class="r"' : '') + '>' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="rp-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function summarySection(from, to) {
    var t = Store.totals(from, to);
    var cards = [
      ['Toplam Yatırım', U.money(t.deposit)],
      ['Toplam Çekim', U.money(t.withdraw)],
      ['Net Durum', U.money(t.net)],
      ['İşlem Sayısı', String(t.depositCount + t.withdrawCount)],
      ['Kayıtlı Site', String(Store.collection('sites').length)],
      ['Kayıtlı Bonus', String(Store.collection('bonuses').length)]
    ];
    return '<section class="rp-section"><h2>Özet</h2><div class="rp-cards">' +
      cards.map(function (card) {
        return '<div class="rp-card"><span>' + esc(card[0]) + '</span><strong>' + esc(card[1]) + '</strong></div>';
      }).join('') + '</div></section>';
  }

  function sitesSection(from, to) {
    var rows = U.sortBy(Store.collection('sites'), function (site) { return site.name; }).map(function (site) {
      var t = Store.siteTotals(site.id, from, to);
      return [
        esc(site.name),
        U.money(t.deposit),
        U.money(t.withdraw),
        U.money(t.net),
        String(t.count),
        t.lastDate ? U.formatDate(t.lastDate) : '-'
      ];
    });
    return '<section class="rp-section"><h2>Siteler</h2>' +
      table(['Site', 'Yatırım', 'Çekim', 'Net', 'İşlem', 'Son İşlem'], rows, ['', 'r', 'r', 'r', 'r', '']) +
      '</section>';
  }

  function transactionRows(from, to) {
    return U.sortBy(Store.collection('transactions').filter(function (tx) {
      return inRange(tx.date, from, to);
    }), function (tx) { return String(tx.date || ''); }, true);
  }

  function transactionsSection(from, to) {
    var list = transactionRows(from, to);
    var rows = list.map(function (tx) {
      return [
        U.formatDate(tx.date),
        esc(Store.siteName(tx.siteId)),
        tx.type === 'withdraw' ? 'Çekim' : 'Yatırım',
        U.money(tx.amount),
        esc(tx.method || '-'),
        esc(tx.note || '')
      ];
    });
    return '<section class="rp-section"><h2>İşlem Geçmişi</h2>' +
      table(['Tarih', 'Site', 'Tür', 'Tutar', 'Yöntem', 'Not'], rows, ['', '', '', 'r', '', '']) +
      '</section>';
  }

  function bonusesSection() {
    var rows = Store.collection('bonuses').map(function (bonus) {
      var period = (bonus.startDate || bonus.endDate)
        ? U.formatDate(bonus.startDate) + ' - ' + U.formatDate(bonus.endDate)
        : 'Süresiz';
      return [
        esc(Store.siteName(bonus.siteId)),
        esc(TYPE_LABEL[bonus.type] || bonus.type),
        esc(bonus.name || '-'),
        esc(bonus.amount || '-'),
        esc(bonus.depositReq || '-'),
        esc(bonus.withdrawLimit || '-'),
        esc(period),
        esc(bonus.status || '-')
      ];
    });
    return '<section class="rp-section"><h2>Bonuslar</h2>' +
      table(['Site', 'Tür', 'Bonus', 'Miktar', 'Yatırım Şartı', 'Çekim Limiti', 'Geçerlilik', 'Durum'], rows) +
      '</section>';
  }

  function gamesSection() {
    var rows = U.sortBy(Store.collection('games'), function (game) { return game.name; }).map(function (game) {
      var sites = (game.siteIds || []).map(function (id) { return Store.siteName(id); }).join(', ');
      return [
        esc(game.name),
        esc(game.provider || '-'),
        esc(game.minBet || '-'),
        esc(game.maxWin || '-'),
        esc(game.features || '-'),
        esc(sites || '-')
      ];
    });
    return '<section class="rp-section"><h2>Favori Oyunlar</h2>' +
      table(['Oyun', 'Sağlayıcı', 'Min Bet', 'En Yüksek Kazanç', 'Özellikler', 'Siteler'], rows) +
      '</section>';
  }

  function accountsSection(includeSensitive) {
    var rows = Store.collection('accounts').map(function (account) {
      var password = Store.accountField(account, 'password');
      var finances = Store.accountField(account, 'finances');
      return [
        esc(Store.siteName(account.siteId)),
        esc(account.username),
        esc(account.contact || '-'),
        includeSensitive && password !== null ? esc(password || '-') : MASK,
        includeSensitive && finances !== null ? esc(finances || '-').replace(/\n/g, '<br>') : MASK
      ];
    });
    return '<section class="rp-section"><h2>Hesap Bilgileri</h2>' +
      table(['Site', 'Kullanıcı', 'İletişim', 'Şifre / İpucu', 'Finansal Hesaplar'], rows) +
      '</section>';
  }

  function buildHtml(options) {
    var from = options.from;
    var to = options.to;
    var period = (from || to)
      ? U.formatDate(from || '') + ' - ' + U.formatDate(to || '')
      : 'Tüm kayıtlar';

    var parts = [
      '<header class="rp-head">' +
      '<h1>Bahis Takip Raporu</h1>' +
      '<p>Dönem: ' + esc(period) + ' · Rapor tarihi: ' + esc(U.formatDate(U.todayISO())) + '</p>' +
      '</header>'
    ];

    if (options.sections.indexOf('ozet') !== -1) parts.push(summarySection(from, to));
    if (options.sections.indexOf('siteler') !== -1) parts.push(sitesSection(from, to));
    if (options.sections.indexOf('islemler') !== -1) parts.push(transactionsSection(from, to));
    if (options.sections.indexOf('bonuslar') !== -1) parts.push(bonusesSection());
    if (options.sections.indexOf('oyunlar') !== -1) parts.push(gamesSection());
    if (options.sections.indexOf('hesaplar') !== -1) parts.push(accountsSection(options.includeSensitive));

    return parts.join('');
  }

  function printReport(options) {
    var sheet = U.qs('#reportSheet');
    sheet.innerHTML = buildHtml(options);
    document.body.classList.add('is-printing');

    var cleanup = function () {
      document.body.classList.remove('is-printing');
      global.removeEventListener('afterprint', cleanup);
    };
    global.addEventListener('afterprint', cleanup);
    setTimeout(function () {
      global.print();
      setTimeout(cleanup, 1500);
    }, 60);
  }

  function csvReport(options) {
    var rows = [['Tarih', 'Site', 'Tür', 'Tutar (TL)', 'Yöntem', 'Not']];
    transactionRows(options.from, options.to).forEach(function (tx) {
      rows.push([
        U.formatDate(tx.date),
        Store.siteName(tx.siteId),
        tx.type === 'withdraw' ? 'Çekim' : 'Yatırım',
        U.fromMinor(tx.amount).toFixed(2).replace('.', ','),
        tx.method || '',
        tx.note || ''
      ]);
    });
    return U.csvRows(rows);
  }

  global.Report = {
    buildHtml: buildHtml,
    print: printReport,
    csv: csvReport
  };
})(window);
