/* 知脉 · 应用核心：路由、学科切换、数据缓存、档案存储、通用组件 */
window.App = (function () {
  'use strict';

  var SUBJECTS = {
    math: { label: '数学' },
    chinese: { label: '语文' },
    english: { label: '英语' },
    physics: { label: '物理' }
  };
  var SUBJECT_ORDER = ['math', 'chinese', 'english', 'physics'];

  var TYPE_LABEL = {
    conceptual: '概念', procedural: '方法', application: '应用',
    reasoning: '推理', modeling: '建模'
  };
  var DIFF_LABEL = { basic: '基础', standard: '标准', advanced: '进阶', challenge: '挑战' };
  var QTYPE_LABEL = { choice: '选择题', numeric: '填空题', short: '简答题', self: '自评题', legacy: '简答题' };
  var STATUS_LABEL = { mastered: '已掌握', shaky: '不稳', weak: '薄弱', unknown: '未测' };
  var STATUS_CLASS = { mastered: 'good', shaky: 'warn', weak: 'bad', unknown: 'ghost' };
  var MODE_LABEL = { target: '单点诊断', screen: '整册筛查' };

  var KEY_SUBJECT = 'kg_subject_v1';
  var KEY_PROFILES = 'kg_profiles_v1';
  var KEY_DRAFT = 'kg_draft_v1';

  var state = {
    subject: 'math',
    meta: null,
    topics: {},      // subject -> { topics, deps, byId }
    questions: {},   // subject -> questions
    graphs: {},      // subject -> { plain, full }
    metaPromise: null
  };

  var routes = Object.create(null);
  var currentRoute = null;
  var renderToken = 0;
  var view = null;

  /* ---------------------------------------------------------------- 存储 */

  function storeGet(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? dflt : JSON.parse(raw);
    } catch (e) {
      return dflt;
    }
  }

  function storeSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      toast('本地存储不可用，数据无法保存');
      return false;
    }
  }

  function storeDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  /* ---------------------------------------------------------------- 工具 */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtNum(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('zh-CN');
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtDate(value) {
    var d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtDay(value) {
    var d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function subjectLabel(s) { return (SUBJECTS[s] || {}).label || '数学'; }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function truncateLabel(text, max) {
    var arr = Array.from(String(text || ''));
    var limit = max || 9;
    if (arr.length <= limit) return arr.join('');
    return arr.slice(0, limit - 1).join('') + '…';
  }

  function toast(msg, ms) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .22s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 240);
    }, ms || 2200);
  }

  function go(hash) {
    if (location.hash === '#' + hash) render();
    else location.hash = hash;
  }

  function href(path) { return '#' + path; }

  /* ---------------------------------------------------------------- 数据 */

  function fetchJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('加载失败：' + url + '（HTTP ' + res.status + '）');
      return res.json();
    });
  }

  function loadMeta() {
    if (state.meta) return Promise.resolve(state.meta);
    if (!state.metaPromise) {
      state.metaPromise = fetchJSON('data/meta.json').then(function (m) {
        state.meta = m;
        return m;
      }).catch(function (err) {
        state.metaPromise = null;
        throw err;
      });
    }
    return state.metaPromise;
  }

  function loadTopics(subject) {
    var c = state.topics[subject];
    if (c) return Promise.resolve(c);
    return Promise.all([
      fetchJSON('data/' + subject + '/topics.json'),
      fetchJSON('data/' + subject + '/dependencies.json')
    ]).then(function (arr) {
      var topics = arr[0], deps = arr[1];
      var byId = Object.create(null);
      topics.forEach(function (t) { byId[t.id] = t; });
      var data = { topics: topics, deps: deps, byId: byId };
      state.topics[subject] = data;
      return data;
    });
  }

  function loadQuestions(subject) {
    if (state.questions[subject]) return Promise.resolve(state.questions[subject]);
    return fetchJSON('data/' + subject + '/questions.json').then(function (qs) {
      state.questions[subject] = qs;
      return qs;
    });
  }

  function loadFull(subject) {
    return Promise.all([loadTopics(subject), loadQuestions(subject)]).then(function (arr) {
      return { topics: arr[0].topics, deps: arr[0].deps, byId: arr[0].byId, questions: arr[1] };
    });
  }

  /** 构建（并缓存）诊断图；withQuestions=false 时用 diagnostic_question 兜底，供浏览使用。 */
  function graph(subject, withQuestions) {
    var full = withQuestions !== false;
    var slot = state.graphs[subject] || (state.graphs[subject] = {});
    var key = full ? 'full' : 'plain';
    if (slot[key]) return Promise.resolve(slot[key]);
    var ready = full ? loadFull(subject) : loadTopics(subject);
    return ready.then(function (d) {
      var g = DiagEngine.buildGraph(d.topics, d.deps, d.questions);
      slot[key] = g;
      return g;
    });
  }

  function gradesOf(subject) {
    var sm = state.meta && state.meta.subjects && state.meta.subjects[subject];
    return (sm && sm.grades) || [];
  }

  function gradeLabel(subject, grade) {
    var list = gradesOf(subject);
    for (var i = 0; i < list.length; i++) if (list[i].grade === grade) return list[i].label;
    return grade + '年级';
  }

  function chapterOf(topic) {
    try { return DiagEngine.parseChapter(topic.chapter || ''); }
    catch (e) { return { volume: '', chapterNo: '', chapterName: topic.chapter || '', section: '' }; }
  }

  /* ---------------------------------------------------------------- 草稿 */

  function getDraft() {
    var d = storeGet(KEY_DRAFT, null);
    if (d && SUBJECTS[d.subject]) return d;
    return null;
  }

  function saveDraft(draft) {
    draft.updatedAt = new Date().toISOString();
    storeSet(KEY_DRAFT, draft);
    return draft;
  }

  function clearDraft() { storeDel(KEY_DRAFT); }

  function draftOpts(draft) {
    return { mode: draft.mode, limit: draft.limit, confirm: draft.confirm, seed: draft.seed };
  }

  /* ---------------------------------------------------------------- 档案 */

  function getProfileStore() {
    var s = storeGet(KEY_PROFILES, null);
    if (!s || !Array.isArray(s.profiles) || !Array.isArray(s.records)) {
      s = { profiles: [], records: [] };
    }
    return s;
  }

  function saveProfileStore(s) { storeSet(KEY_PROFILES, s); }

  function getProfiles() { return getProfileStore().profiles; }

  function getRecords(profileId) {
    var list = getProfileStore().records.slice();
    if (profileId) list = list.filter(function (r) { return r.profileId === profileId; });
    return list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }

  function getRecord(id) {
    return getProfileStore().records.find(function (r) { return r.id === id; }) || null;
  }

  function addProfile(name) {
    var s = getProfileStore();
    var profile = { id: uid('pf'), name: String(name || '').trim() || '我的档案', createdAt: new Date().toISOString() };
    s.profiles.push(profile);
    saveProfileStore(s);
    return profile;
  }

  function ensureProfile() {
    var list = getProfiles();
    if (list.length) return list[0];
    return addProfile('我的档案');
  }

  function addRecord(record) {
    var s = getProfileStore();
    var rec = Object.assign({ id: uid('rec'), createdAt: new Date().toISOString() }, record);
    s.records.push(rec);
    saveProfileStore(s);
    return rec;
  }

  function removeRecord(id) {
    var s = getProfileStore();
    s.records = s.records.filter(function (r) { return r.id !== id; });
    saveProfileStore(s);
  }

  function removeProfile(id) {
    var s = getProfileStore();
    s.profiles = s.profiles.filter(function (p) { return p.id !== id; });
    s.records = s.records.filter(function (r) { return r.profileId !== id; });
    saveProfileStore(s);
  }

  function lastRecord() {
    var list = getRecords();
    return list.length ? list[0] : null;
  }

  /* ---------------------------------------------------------------- 抽屉 */

  function closeSheet() {
    var root = document.getElementById('sheet-root');
    if (root) root.innerHTML = '';
    document.body.style.overflow = '';
  }

  function mountSheet(inner) {
    var root = document.getElementById('sheet-root');
    root.innerHTML = '<div class="sheet-backdrop" data-close></div><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>' + inner + '</section>';
    document.body.style.overflow = 'hidden';
    root.onclick = function (e) {
      if (e.target.closest('[data-close]')) closeSheet();
    };
    var closeBtn = root.querySelector('.sheet-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSheet);
  }

  /** 知识点详情抽屉：说明、掌握标准、先修/后续，并可一键发起诊断。 */
  function showTopicSheet(subject, id, opts) {
    opts = opts || {};
    return Promise.all([loadMeta(), loadTopics(subject)]).then(function (arr) {
      var data = arr[1];
      var t = data.byId[id];
      if (!t) { toast('未找到该知识点'); return; }
      var subLabel = subjectLabel(subject);
      var ch = chapterOf(t);
      var grade = gradeLabel(subject, t.grade);
      var badges = [
        '<span class="badge accent">' + esc(subLabel) + '</span>',
        '<span class="badge">' + esc(grade) + '</span>'
      ];
      if (ch.chapterName) badges.push('<span class="badge ghost">' + esc(ch.label || ch.chapterName) + '</span>');
      if (t.type) badges.push('<span class="badge ghost">' + esc(TYPE_LABEL[t.type] || t.type) + '</span>');
      if (t.external) badges.push('<span class="badge ghost">先修外部节点</span>');

      var prereqs = data.deps.filter(function (d) { return d.topicId === id; });
      var dependents = data.deps.filter(function (d) { return d.prerequisiteId === id; });

      function relList(list, isPre) {
        if (!list.length) {
          return '<p class="small muted">' + (isPre ? '暂无先修要求，可作为起点。' : '暂无后续知识点。') + '</p>';
        }
        return '<div class="row wrap" style="gap:6px">' + list.map(function (d) {
          var otherId = isPre ? d.prerequisiteId : d.topicId;
          var other = data.byId[otherId];
          if (!other) return '';
          var strength = d.strength === 'soft' ? 'soft' : 'hard';
          var label = strength === 'soft' ? '弱先修' : '强先修';
          return '<span class="rel-link ' + strength + '" data-topic="' + esc(otherId) + '">' +
            esc(truncateLabel(other.name, 12)) +
            '<em class="tiny muted" style="font-style:normal">·' + label + '</em></span>';
        }).join('') + '</div>';
      }

      var criteria = Array.isArray(t.mastery_criteria) ? t.mastery_criteria : [];
      var standards = Array.isArray(t.standards) ? t.standards : [];

      var html = '';
      html += '<div class="sheet-head">';
      html += '<h2>' + esc(t.name) + '</h2>';
      html += '<button class="sheet-close" aria-label="关闭">×</button>';
      html += '</div>';
      html += '<div class="sheet-badges">' + badges.join('') + '</div>';
      html += '<div class="sheet-body">';

      if (t.description) {
        html += '<div class="sheet-sec"><h3>说明</h3><p>' + esc(t.description) + '</p></div>';
      }
      if (criteria.length) {
        html += '<div class="sheet-sec"><h3>掌握标准</h3><ul class="criteria">' +
          criteria.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
      }
      html += '<div class="sheet-sec"><h3>先修知识</h3>' + relList(prereqs, true) + '</div>';
      if (prereqs.length) {
        var reasons = prereqs.filter(function (d) { return d.reason; }).slice(0, 3);
        if (reasons.length) {
          html += '<div class="sheet-sec"><h3>为什么需要</h3>' +
            reasons.map(function (d) {
              var other = data.byId[d.prerequisiteId];
              return '<p class="small muted" style="margin-bottom:5px">' +
                (other ? '<b>' + esc(other.name) + '</b>：' : '') + esc(d.reason) + '</p>';
            }).join('') + '</div>';
        }
      }
      html += '<div class="sheet-sec"><h3>后续知识</h3>' + relList(dependents, false) + '</div>';
      if (standards.length) {
        html += '<div class="sheet-sec"><h3>课标对应</h3><p class="small muted">关联 ' +
          standards.length + ' 条课程标准条目</p></div>';
      }
      html += '</div>';

      html += '<div class="sheet-actions">';
      html += '<button class="btn btn-ghost" data-close>关闭</button>';
      if (!t.external) {
        html += '<button class="btn btn-primary" data-diagnose>诊断这个知识点</button>';
      }
      html += '</div>';

      mountSheet(html);

      var root = document.getElementById('sheet-root');
      root.addEventListener('click', function (e) {
        var rel = e.target.closest('[data-topic]');
        if (rel) {
          e.preventDefault();
          var nextId = rel.getAttribute('data-topic');
          closeSheet();
          setTimeout(function () { showTopicSheet(subject, nextId); }, 60);
          return;
        }
        if (e.target.closest('[data-diagnose]')) {
          closeSheet();
          if (opts.onDiagnose) opts.onDiagnose(id);
          else go('/diagnose?target=' + encodeURIComponent(id));
        }
      });
    });
  }

  /** 结果页/记录页使用的分层路径图（SVG）。 */
  function pathGraphSVG(graph, layout, opts) {
    opts = opts || {};
    var NW = 112, NH = 30, GX = 12, GY = 30, PAD = 14;
    var maxCols = Math.max(1, layout.maxCols || 1);
    var rowW = maxCols * (NW + GX) - GX;
    var width = Math.max(280, rowW + PAD * 2);
    var height = Math.max(1, layout.layers) * (NH + GY) - GY + PAD * 2;
    var pos = Object.create(null);

    layout.nodes.forEach(function (n) {
      var rowWidth = n.cols * (NW + GX) - GX;
      var x = PAD + (rowW - rowWidth) / 2 + n.col * (NW + GX);
      var y = PAD + n.layer * (NH + GY);
      pos[n.id] = { x: x, y: y, w: NW, h: NH };
    });

    var defs = '<defs><marker id="kg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M0 0 L8 4 L0 8 z" fill="#b9c6c2"></path></marker></defs>';

    var edgeHTML = layout.edges.map(function (e) {
      var a = pos[e.from], b = pos[e.to];
      if (!a || !b) return '';
      var x1 = a.x + a.w / 2, y1 = a.y + a.h;
      var x2 = b.x + b.w / 2, y2 = b.y;
      var mid = (y1 + y2) / 2;
      var d = 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + mid + ', ' + x2 + ' ' + mid + ', ' + x2 + ' ' + y2;
      var cls = e.direct ? (e.strength === 'soft' ? 'edge soft' : 'edge') : 'edge indirect';
      var dash = e.direct && e.strength !== 'soft' ? '' : ' stroke-dasharray="4 4"';
      var op = e.direct ? '0.9' : '0.45';
      return '<path class="' + cls + '" d="' + d + '" fill="none" stroke="#b9c6c2" stroke-width="1.2" stroke-opacity="' + op + '"' + dash + ' marker-end="url(#kg-arrow)"></path>';
    }).join('');

    var style = {
      mastered: { fill: '#e6f4ec', stroke: '#17784a', text: '#135c39' },
      shaky: { fill: '#fdf2e0', stroke: '#a9660a', text: '#7a4c08' },
      weak: { fill: '#fbecea', stroke: '#ad3c2d', text: '#8a2e22' },
      unknown: { fill: '#f4f7f6', stroke: '#cfd8d5', text: '#51605d' }
    };

    var nodeHTML = layout.nodes.map(function (n) {
      var p = pos[n.id];
      if (!p) return '';
      var topic = graph.byId[n.id] || { name: n.id };
      var st = style[n.status] || style.unknown;
      var stroke = st.stroke;
      var sw = 1;
      if (n.isRoot) { stroke = '#ad3c2d'; sw = 2.2; }
      else if (n.isTarget) { stroke = '#0f6e62'; sw = 2; }
      var dashAttr = n.status === 'unknown' ? ' stroke-dasharray="3 3"' : '';
      var label = truncateLabel(topic.name, 9);
      return '<g class="gnode" data-topic="' + esc(n.id) + '">' +
        '<title>' + esc(topic.name) + '（' + (STATUS_LABEL[n.status] || '未测') + (n.isRoot ? '，根因' : '') + '）</title>' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="8" ' +
        'fill="' + st.fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + '></rect>' +
        '<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 + 4) + '" text-anchor="middle" ' +
        'font-size="11.5" fill="' + st.text + '">' + esc(label) + '</text>' +
        '</g>';
    }).join('');

    return '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="学习路径图">' +
      defs + edgeHTML + nodeHTML + '</svg>';
  }

  /* ---------------------------------------------------------------- 路由 */

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var qIdx = raw.indexOf('?');
    var path = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    var query = qIdx >= 0 ? raw.slice(qIdx + 1) : '';
    var segs = path.split('/').filter(Boolean);
    return { segs: segs, params: new URLSearchParams(query) };
  }

  function buildSubjectSwitch() {
    var el = document.getElementById('subject-switch');
    el.innerHTML = SUBJECT_ORDER.map(function (s) {
      return '<button role="tab" data-subject="' + s + '" aria-selected="' +
        (s === state.subject ? 'true' : 'false') + '">' + SUBJECTS[s].label + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-subject]');
      if (!btn) return;
      var next = btn.getAttribute('data-subject');
      if (next === state.subject) return;
      var seg = currentRoute && currentRoute.segs[0];
      var draft = getDraft();
      if ((seg === 'quiz' || seg === 'result') && draft && draft.subject !== next) {
        toast('请先结束当前诊断，再切换学科');
        return;
      }
      setSubject(next);
      render();
    });
  }

  function setSubject(subject) {
    if (!SUBJECTS[subject]) return;
    state.subject = subject;
    document.body.setAttribute('data-subject', subject);
    storeSet(KEY_SUBJECT, subject);
    var el = document.getElementById('subject-switch');
    if (el) {
      Array.prototype.forEach.call(el.querySelectorAll('button[data-subject]'), function (b) {
        b.setAttribute('aria-selected', b.getAttribute('data-subject') === subject ? 'true' : 'false');
      });
    }
  }

  var TABS = [
    { key: 'home', label: '首页', icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>' },
    { key: 'explore', label: '图谱', icon: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8 7.5l2.8 8M16 7.5l-2.8 8M8.4 6h7.2"/>' },
    { key: 'diagnose', label: '诊断', icon: '<path d="M4 12h4l2-6 4 12 2-6h4"/>' },
    { key: 'profile', label: '档案', icon: '<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>' },
    { key: 'about', label: '关于', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/>' }
  ];

  function buildTabbar() {
    var el = document.getElementById('tabbar');
    el.innerHTML = TABS.map(function (t) {
      return '<a href="#/' + t.key + '" data-tab="' + t.key + '">' +
        '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t.icon + '</svg>' +
        '<span>' + t.label + '</span></a>';
    }).join('');
  }

  function activeTabOf(segs) {
    var head = segs[0] || 'home';
    if (head === 'quiz' || head === 'result') return 'diagnose';
    if (head === 'record') return 'profile';
    if (['home', 'explore', 'diagnose', 'profile', 'about'].indexOf(head) < 0) return 'home';
    return head;
  }

  function updateTabbar(segs) {
    var active = activeTabOf(segs);
    Array.prototype.forEach.call(document.querySelectorAll('#tabbar a'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-tab') === active);
    });
  }

  function setView(html) {
    view.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function errorCard(err) {
    console.error(err);
    return '<div class="empty"><strong>加载失败</strong><p class="small">' + esc(err && err.message ? err.message : String(err)) +
      '</p><p class="small mt8">请通过本地服务器打开（双击「启动.cmd」），不要直接双击 index.html。</p></div>';
  }

  function render() {
    var token = ++renderToken;
    var route = parseHash();
    currentRoute = route;
    var subjParam = route.params.get('subject');
    if (subjParam && SUBJECTS[subjParam] && subjParam !== state.subject) setSubject(subjParam);
    document.body.setAttribute('data-subject', state.subject);
    updateTabbar(route.segs);
    var handler = routes[route.segs[0] || 'home'] || routes.home;
    view.innerHTML = '<div class="skeleton-wrap"><div class="skeleton skeleton-title"></div>' +
      '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div>';
    Promise.resolve()
      .then(function () { return handler(route); })
      .catch(function (err) {
        if (token !== renderToken) return;
        view.innerHTML = errorCard(err);
      });
  }

  function boot() {
    view = document.getElementById('view');
    var saved = storeGet(KEY_SUBJECT, 'math');
    if (SUBJECTS[saved]) state.subject = saved;
    document.body.setAttribute('data-subject', state.subject);
    buildSubjectSwitch();
    buildTabbar();
    window.addEventListener('hashchange', render);
    if (!location.hash) {
      history.replaceState(null, '', '#/home');
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
    render();
  }

  return {
    SUBJECTS: SUBJECTS,
    SUBJECT_ORDER: SUBJECT_ORDER,
    TYPE_LABEL: TYPE_LABEL,
    DIFF_LABEL: DIFF_LABEL,
    QTYPE_LABEL: QTYPE_LABEL,
    STATUS_LABEL: STATUS_LABEL,
    STATUS_CLASS: STATUS_CLASS,
    MODE_LABEL: MODE_LABEL,
    state: state,
    routes: routes,
    boot: boot,
    render: render,
    setSubject: setSubject,
    go: go,
    href: href,
    esc: esc,
    fmtNum: fmtNum,
    fmtDate: fmtDate,
    fmtDay: fmtDay,
    uid: uid,
    subjectLabel: subjectLabel,
    truncateLabel: truncateLabel,
    toast: toast,
    setView: setView,
    loadMeta: loadMeta,
    loadTopics: loadTopics,
    loadQuestions: loadQuestions,
    loadFull: loadFull,
    graph: graph,
    gradesOf: gradesOf,
    gradeLabel: gradeLabel,
    chapterOf: chapterOf,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    draftOpts: draftOpts,
    getProfiles: getProfiles,
    getRecords: getRecords,
    getRecord: getRecord,
    addProfile: addProfile,
    ensureProfile: ensureProfile,
    addRecord: addRecord,
    removeRecord: removeRecord,
    removeProfile: removeProfile,
    lastRecord: lastRecord,
    openSheet: mountSheet,
    closeSheet: closeSheet,
    showTopicSheet: showTopicSheet,
    pathGraphSVG: pathGraphSVG
  };
})();
