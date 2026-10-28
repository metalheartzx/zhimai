/* 知识图谱浏览：搜索 + 学段/年级/领域筛选 + 章节分组 */
App.routes.explore = function (route) {
  var subject = App.state.subject;
  return Promise.all([App.loadMeta(), App.loadTopics(subject)]).then(function (arr) {
    var meta = arr[0];
    var data = arr[1];
    var sm = meta.subjects[subject];
    var grades = sm.grades || [];

    var filter = {
      q: route.params.get('q') || '',
      stage: route.params.get('stage') || '',
      grade: route.params.get('grade') || '',
      domain: route.params.get('domain') || ''
    };
    var openKeys = null;

    var html = '';
    html += '<div><h1 class="page-title">' + App.esc(App.subjectLabel(subject)) + '知识图谱</h1>';
    html += '<p class="page-sub">' + App.fmtNum(sm.topics) + ' 个知识点 · ' + App.fmtNum(sm.edges) + ' 条先修关系</p></div>';

    html += '<div class="card toolbar mt12">';
    html += '<div class="search-wrap"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>';
    html += '<input class="field" id="f-q" type="search" placeholder="搜索知识点、章节，如「分数」「一元二次」" value="' + App.esc(filter.q) + '" autocomplete="off"></div>';
    html += '<div class="filter-row"><select class="field" id="f-stage"><option value="">全部学段</option>';
    ['小学', '初中', '高中'].forEach(function (st) {
      html += '<option value="' + st + '"' + (filter.stage === st ? ' selected' : '') + '>' + st + '</option>';
    });
    html += '</select><select class="field" id="f-grade"><option value="">全部年级</option>';
    grades.forEach(function (g) {
      html += '<option value="' + g.grade + '"' + (String(g.grade) === String(filter.grade) ? ' selected' : '') + '>' +
        App.esc(g.label) + '</option>';
    });
    html += '</select></div>';
    html += '<div class="filter-row"><select class="field" id="f-domain"><option value="">全部领域</option>';
    sm.domains.forEach(function (d) {
      html += '<option value="' + App.esc(d.name) + '"' + (filter.domain === d.name ? ' selected' : '') + '>' +
        App.esc(d.name) + '（' + d.count + '）</option>';
    });
    html += '</select><button class="btn btn-sm btn-ghost" id="f-reset" type="button">重置</button></div>';
    html += '</div>';

    html += '<div class="list-meta"><span id="list-count"></span><span>点击查看详情与先修</span></div>';
    html += '<div id="groups"></div>';

    App.setView(html);

    var groupsEl = document.getElementById('groups');
    var countEl = document.getElementById('list-count');

    function stageOfGrade(grade) {
      var list = grades;
      for (var i = 0; i < list.length; i++) if (list[i].grade === grade) return list[i].stage;
      return '';
    }

    function filtered() {
      var q = filter.q.trim().toLowerCase();
      return data.topics.filter(function (t) {
        if (filter.grade && String(t.grade) !== String(filter.grade)) return false;
        if (filter.stage && stageOfGrade(t.grade) !== filter.stage) return false;
        if (filter.domain && (t.domain || '') !== filter.domain) return false;
        if (q) {
          var hay = (t.name + ' ' + (t.chapter || '') + ' ' + (t.description || '') + ' ' + (t.domain || '')).toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
    }

    function chapterNum(no) {
      var m = /(\d+)/.exec(no || '');
      if (m) return parseInt(m[1], 10);
      var cn = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
      var c = /^第(.)章/.exec(no || '');
      return c && cn[c[1]] ? cn[c[1]] : 99;
    }

    function groupList(list) {
      var map = Object.create(null);
      var groups = [];
      list.forEach(function (t, idx) {
        var ch = App.chapterOf(t);
        var key = [t.grade, ch.volume, ch.chapterNo, ch.chapterName].join('|');
        var g = map[key];
        if (!g) {
          g = map[key] = {
            key: key, grade: t.grade, volume: ch.volume, chapterNo: ch.chapterNo,
            chapterName: ch.chapterName || (t.chapter || '未分章'), label: ch.label || ch.chapterName || (t.chapter || '未分章'),
            topics: [], order: idx
          };
          groups.push(g);
        }
        g.topics.push(t);
      });
      groups.sort(function (a, b) {
        return (a.grade - b.grade) || (chapterNum(a.chapterNo) - chapterNum(b.chapterNo)) || (a.order - b.order);
      });
      return groups;
    }

    function draw() {
      var list = filtered();
      var groups = groupList(list);
      countEl.textContent = list.length === data.topics.length
        ? '共 ' + App.fmtNum(list.length) + ' 个知识点 · ' + groups.length + ' 章'
        : '筛选出 ' + App.fmtNum(list.length) + ' 个知识点 · ' + groups.length + ' 章';

      if (!list.length) {
        groupsEl.innerHTML = '<div class="empty"><strong>没有匹配的知识点</strong><p class="small">试试放宽筛选条件或换一个关键词。</p></div>';
        return;
      }
      if (!openKeys) {
        openKeys = new Set();
        if (list.length <= 60) groups.forEach(function (g) { openKeys.add(g.key); });
      }
      var showGrade = !filter.grade;
      var out = '';
      groups.forEach(function (g) {
        var open = openKeys.has(g.key);
        out += '<details class="chapter"' + (open ? ' open' : '') + ' data-key="' + App.esc(g.key) + '">';
        out += '<summary><span>' + App.esc(g.label) + '</span><span class="cnt">' + g.topics.length + ' 个</span>' +
          '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></summary>';
        out += '<div class="rows">';
        g.topics.forEach(function (t) {
          out += '<button type="button" class="topic-row" data-topic="' + App.esc(t.id) + '">';
          out += '<span class="name">' + App.esc(t.name) + '</span>';
          out += '<span class="badges">';
          if (showGrade) out += '<span class="badge">' + App.esc(App.gradeLabel(subject, t.grade)) + '</span>';
          if (t.type) out += '<span class="badge ghost">' + App.esc(App.TYPE_LABEL[t.type] || t.type) + '</span>';
          out += '</span>';
          out += '<svg class="go" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>';
          out += '</button>';
        });
        out += '</div></details>';
      });
      groupsEl.innerHTML = out;
    }

    groupsEl.addEventListener('click', function (e) {
      var row = e.target.closest('[data-topic]');
      if (row) App.showTopicSheet(subject, row.getAttribute('data-topic'));
    });
    groupsEl.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d.matches || !d.matches('details[data-key]')) return;
      var key = d.getAttribute('data-key');
      if (d.open) openKeys.add(key); else openKeys.delete(key);
    }, true);

    var searchTimer = null;
    document.getElementById('f-q').addEventListener('input', function (e) {
      filter.q = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(draw, 140);
    });
    document.getElementById('f-stage').addEventListener('change', function (e) {
      filter.stage = e.target.value;
      openKeys = null;
      draw();
    });
    document.getElementById('f-grade').addEventListener('change', function (e) {
      filter.grade = e.target.value;
      openKeys = null;
      draw();
    });
    document.getElementById('f-domain').addEventListener('change', function (e) {
      filter.domain = e.target.value;
      openKeys = null;
      draw();
    });
    document.getElementById('f-reset').addEventListener('click', function () {
      filter = { q: '', stage: '', grade: '', domain: '' };
      document.getElementById('f-q').value = '';
      document.getElementById('f-stage').value = '';
      document.getElementById('f-grade').value = '';
      document.getElementById('f-domain').value = '';
      openKeys = null;
      draw();
    });

    draw();
  });
};
