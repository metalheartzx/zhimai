/* 档案：诊断记录、档案管理与导出 */
(function () {
  'use strict';

  function profileName(id) {
    var p = App.getProfiles().find(function (x) { return x.id === id; });
    return p ? p.name : '未命名档案';
  }

  function newProfileSheet(onDone) {
    App.openSheet(
      '<div class="sheet-head"><h2>新建档案</h2><button class="sheet-close" aria-label="关闭">×</button></div>' +
      '<div class="sheet-body">' +
      '<p class="small muted">可以按孩子、班级或自己分档保存诊断记录。</p>' +
      '<label class="label mt12">档案名称</label>' +
      '<input class="field" id="np-name" maxlength="20" placeholder="如：小明 / 三年二班 / 我自己">' +
      '<div class="sheet-actions"><button class="btn btn-ghost" data-close>取消</button>' +
      '<button class="btn btn-primary" id="np-save">创建</button></div></div>'
    );
    var root = document.getElementById('sheet-root');
    var input = root.querySelector('#np-name');
    setTimeout(function () { input.focus(); }, 80);
    function save() {
      var name = input.value.trim();
      if (!name) { App.toast('请输入档案名称'); return; }
      App.addProfile(name);
      App.closeSheet();
      App.toast('已创建档案「' + name + '」');
      App.render();
      if (onDone) onDone();
    }
    root.querySelector('#np-save').addEventListener('click', save);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
  }

  App.routes.profile = function () {
    var profiles = App.getProfiles();
    var records = App.getRecords();
    var html = '';

    html += '<div class="between"><div><h1 class="page-title">学习档案</h1>' +
      '<p class="page-sub">' + (records.length ? '共 ' + records.length + ' 条诊断记录 · ' + profiles.length + ' 个档案' : '还没有诊断记录') +
      '</p></div><button class="btn btn-sm btn-soft" id="new-profile">新建档案</button></div>';

    if (!profiles.length) {
      html += '<div class="empty mt12"><strong>先建一个档案</strong>' +
        '<p class="small">档案用来区分不同的孩子或班级，诊断结果会自动存进第一个档案。</p>' +
        '<div class="btn-row mt12" style="max-width:260px;margin-left:auto;margin-right:auto">' +
        '<button class="btn btn-primary" id="new-profile-2">新建档案</button>' +
        '<a class="btn btn-ghost" href="' + App.href('/diagnose') + '">直接诊断</a></div></div>';
    } else {
      html += '<section class="section"><div class="section-head"><h2>档案</h2>' +
        '<button class="link-btn" id="export">导出数据</button></div>';
      profiles.forEach(function (p) {
        var count = records.filter(function (r) { return r.profileId === p.id; }).length;
        html += '<div class="card tight profile-card" style="margin-bottom:8px">';
        html += '<div class="avatar">' + App.esc(Array.from(p.name)[0] || '档') + '</div>';
        html += '<div class="grow"><div class="record-title">' + App.esc(p.name) + '</div>' +
          '<div class="record-sub">' + count + ' 条记录 · 创建于 ' + App.fmtDay(p.createdAt) + '</div></div>';
        html += '<button class="btn btn-sm btn-ghost" data-profile-del="' + App.esc(p.id) + '">删除</button>';
        html += '</div>';
      });
      html += '</section>';
    }

    html += '<section class="section"><div class="section-head"><h2>诊断记录</h2></div>';
    if (!records.length) {
      html += '<div class="empty"><strong>暂无诊断记录</strong><p class="small">完成一次诊断后，结果会自动保存在这里。</p>' +
        '<a class="btn btn-primary mt12" href="' + App.href('/diagnose') + '">开始诊断</a></div>';
    } else {
      html += '<div class="card">' + records.map(function (r) {
        var snap = r.snap || {};
        var date = App.fmtDate(r.createdAt);
        return '<a class="record-row" href="' + App.href('/record/' + r.id) + '">' +
          '<div class="grow"><div class="record-title truncate">' + App.esc(r.label || (r.targetNames || []).join('、') || '诊断记录') + '</div>' +
          '<div class="record-sub">' + App.esc(App.subjectLabel(r.subject)) + ' · ' + App.esc(date) + ' · ' +
          App.esc(profileName(r.profileId)) + ' · ' + App.esc(App.MODE_LABEL[r.mode] || '诊断') + '</div></div>' +
          '<div class="record-mini">' +
          (snap.weak ? '<span class="badge bad">薄 ' + snap.weak + '</span>' : '') +
          (snap.mastered ? '<span class="badge good">掌握 ' + snap.mastered + '</span>' : '') +
          '</div>' +
          '<svg class="go" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>' +
          '</a>';
      }).join('') + '</div>';
    }
    html += '</section>';

    html += '<p class="footer-note">档案数据只保存在本机浏览器中，不会上传到任何服务器。</p>';

    App.setView(html);

    var np = document.getElementById('new-profile');
    if (np) np.addEventListener('click', function () { newProfileSheet(); });
    var np2 = document.getElementById('new-profile-2');
    if (np2) np2.addEventListener('click', function () { newProfileSheet(); });

    document.querySelectorAll('[data-profile-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-profile-del');
        var name = profileName(id);
        var count = App.getRecords(id).length;
        if (!window.confirm('删除档案「' + name + '」及其 ' + count + ' 条记录？此操作不可恢复。')) return;
        App.removeProfile(id);
        App.toast('已删除档案');
        App.render();
      });
    });

    var exportBtn = document.getElementById('export');
    if (exportBtn) exportBtn.addEventListener('click', exportAll);
  };

  function exportAll() {
    var profiles = App.getProfiles();
    var records = App.getRecords();
    if (!records.length) { App.toast('还没有可导出的记录'); return; }
    var payload = {
      app: '知脉 · 知识点诊断',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profiles: profiles,
      records: records
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '知脉档案-' + App.fmtDay() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    App.toast('已导出 ' + records.length + ' 条记录');
  }

  /* ---------------------------------------------------------- 记录详情 */

  App.routes.record = function (route) {
    var id = route.segs[1];
    var rec = App.getRecord(id);
    if (!rec) {
      App.setView('<div class="empty"><strong>记录不存在</strong><p class="small">它可能已经被删除。</p>' +
        '<a class="btn btn-primary mt12" href="' + App.href('/profile') + '">返回档案</a></div>');
      return;
    }
    if (rec.subject && rec.subject !== App.state.subject) App.setSubject(rec.subject);
    if (!Array.isArray(rec.answers) || !rec.answers.length) {
      App.setView('<div class="empty"><strong>这条记录缺少作答数据</strong><p class="small">无法还原诊断结果。</p>' +
        '<a class="btn btn-primary mt12" href="' + App.href('/profile') + '">返回档案</a></div>');
      return;
    }
    return App.renderResult(rec.subject, rec.targets || [], rec.answers, rec.opts || {}, { readonly: true })
      .then(function () {
        var view = document.getElementById('view');
        var banner = document.createElement('div');
        banner.className = 'card tight';
        banner.style.marginBottom = '12px';
        banner.innerHTML = '<div class="between"><div class="grow">' +
          '<div class="record-title truncate">' + App.esc(rec.label || '诊断记录') + '</div>' +
          '<div class="record-sub">' + App.esc(App.subjectLabel(rec.subject)) + ' · ' + App.esc(App.fmtDate(rec.createdAt)) +
          ' · ' + App.esc(profileName(rec.profileId)) + '</div></div>' +
          '<button class="btn btn-sm btn-ghost" id="rec-del">删除</button></div>';
        view.insertBefore(banner, view.firstChild);
        document.getElementById('rec-del').addEventListener('click', function () {
          if (!window.confirm('删除这条诊断记录？')) return;
          App.removeRecord(rec.id);
          App.toast('记录已删除');
          App.go('/profile');
        });
      });
  };

  App.exportAll = exportAll;
})();
