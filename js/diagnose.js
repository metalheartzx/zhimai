/* 诊断：目标设置 → 逐题作答 → 结果与学习路径 */
(function () {
  'use strict';

  var quizCtx = null; // { subject, graph, session, draft }

  function startDraft(subject, opts) {
    var draft = {
      id: App.uid('draft'),
      subject: subject,
      mode: opts.mode || 'target',
      targets: opts.targets.slice(),
      targetNames: opts.targetNames || [],
      limit: opts.limit,
      confirm: opts.confirm,
      seed: opts.seed || 'default',
      answers: [],
      createdAt: new Date().toISOString()
    };
    return App.saveDraft(draft);
  }

  /* ------------------------------------------------------------ 设置页 */

  App.routes.diagnose = function (route) {
    var subject = App.state.subject;
    return Promise.all([App.loadMeta(), App.loadTopics(subject)]).then(function (arr) {
      var meta = arr[0];
      var data = arr[1];
      var grades = (meta.subjects[subject].grades) || [];
      var preTarget = route.params.get('target');
      var preGrade = route.params.get('grade');

      var setup = {
        mode: preGrade ? 'screen' : 'target',
        targets: preTarget && data.byId[preTarget] ? [preTarget] : [],
        grade: preGrade || (grades.length && grades[grades.length - 1] ? String(grades[Math.max(0, grades.length - 1)].grade) : ''),
        confirm: DiagEngine.DEFAULT_CONFIRM,
        limit: DiagEngine.DEFAULT_LIMIT
      };
      var draft = App.getDraft();
      var html = '';

      html += '<div><h1 class="page-title">开始诊断</h1>';
      html += '<p class="page-sub">选一个目标知识点（或整册筛查），系统会顺着先修关系逐层追问。</p></div>';

      if (draft && draft.subject === subject && !draft.recordId && (draft.answers || []).length) {
        html += '<div class="card continue-card mt12"><div class="ring">' + (draft.answers || []).length + '</div>' +
          '<div class="grow"><div class="record-title">上次诊断还没做完</div>' +
          '<div class="record-sub">已答 ' + draft.answers.length + ' / ' + draft.limit + ' 题 · ' + App.fmtDate(draft.updatedAt) + '</div></div>' +
          '<button class="btn btn-sm btn-primary" id="resume">继续</button></div>';
      }

      html += '<section class="section"><div class="seg" id="mode-seg">';
      html += '<button data-mode="target"' + (setup.mode === 'target' ? ' class="active"' : '') + '>单点诊断</button>';
      html += '<button data-mode="screen"' + (setup.mode === 'screen' ? ' class="active"' : '') + '>整册筛查</button>';
      html += '</div></section>';

      /* 单点诊断 */
      html += '<section class="section" id="pane-target"' + (setup.mode === 'target' ? '' : ' hidden') + '>';
      html += '<div class="section-head"><h2>诊断目标</h2><span class="hint">可多选，1~5 个</span></div>';
      html += '<div class="target-box">';
      html += '<div class="search-wrap"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>';
      html += '<input class="field" id="t-q" type="search" placeholder="搜索知识点，如「分数的意义」" autocomplete="off"></div>';
      html += '<div id="t-suggest"></div>';
      html += '<div class="target-selected mt12" id="t-selected"></div>';
      html += '</div></section>';

      /* 整册筛查 */
      html += '<section class="section" id="pane-screen"' + (setup.mode === 'screen' ? '' : ' hidden') + '>';
      html += '<div class="section-head"><h2>筛查范围</h2><span class="hint">按教材册次逐点确认</span></div>';
      html += '<div class="card tight"><label class="label">选择年级 / 册次</label>';
      html += '<select class="field" id="s-grade">';
      grades.forEach(function (g) {
        html += '<option value="' + g.grade + '"' + (String(g.grade) === String(setup.grade) ? ' selected' : '') + '>' +
          App.esc(g.label) + '（' + g.topics + ' 个知识点）</option>';
      });
      html += '</select><p class="tiny muted mt8" id="s-count"></p></div></section>';

      /* 参数 */
      html += '<section class="section"><div class="section-head"><h2>诊断强度</h2></div>';
      html += '<div class="card tight"><label class="label">掌握标准：每个知识点连续答对几题算掌握</label>';
      html += '<div class="opt-grid" id="opt-confirm">';
      DiagEngine.CONFIRM_CHOICES.forEach(function (n) {
        html += '<div class="opt' + (n === setup.confirm ? ' active' : '') + '" data-confirm="' + n + '">' + n + ' 题<small>' +
          (n === 2 ? '快速' : n === 3 ? '推荐' : '严格') + '</small></div>';
      });
      html += '</div>';
      html += '<label class="label mt16">题目上限</label><div class="opt-grid" id="opt-limit"></div>';
      html += '</div></section>';

      html += '<div class="start-bar"><button class="btn btn-primary btn-block" id="start">开始诊断</button></div>';

      App.setView(html);

      var suggestEl = document.getElementById('t-suggest');
      var selectedEl = document.getElementById('t-selected');

      function renderSelected() {
        if (!setup.targets.length) {
          selectedEl.innerHTML = '<p class="small muted">还没有选择目标。搜索后点击加入。</p>';
          return;
        }
        selectedEl.innerHTML = setup.targets.map(function (id) {
          var t = data.byId[id];
          return '<span class="chip active">' + App.esc(t ? t.name : id) + '<span class="x" data-remove="' + App.esc(id) + '">×</span></span>';
        }).join('');
      }

      function renderSuggest() {
        var q = document.getElementById('t-q').value.trim().toLowerCase();
        if (!q) { suggestEl.innerHTML = ''; return; }
        var hits = data.topics.filter(function (t) {
          if (t.external) return false;
          return (t.name + ' ' + (t.chapter || '')).toLowerCase().indexOf(q) >= 0;
        }).slice(0, 30);
        if (!hits.length) {
          suggestEl.innerHTML = '<div class="suggest"><span class="suggest-item" style="display:block"><span>没有匹配的知识点</span></span></div>';
          return;
        }
        suggestEl.innerHTML = '<div class="suggest">' + hits.map(function (t) {
          var ch = App.chapterOf(t);
          return '<button type="button" class="suggest-item" data-add="' + App.esc(t.id) + '"><b>' + App.esc(t.name) + '</b><span>' +
            App.esc(App.gradeLabel(subject, t.grade)) + (ch.label ? ' · ' + App.esc(ch.label) : '') + '</span></button>';
        }).join('') + '</div>';
      }

      function limitChoices() {
        return setup.mode === 'screen' ? [20, 40, 60] : [10, 16, 24];
      }

      function renderLimits() {
        var list = limitChoices();
        var def = setup.mode === 'screen' ? DiagEngine.SCREEN_LIMIT : DiagEngine.DEFAULT_LIMIT;
        if (list.indexOf(setup.limit) < 0) setup.limit = list.indexOf(def) >= 0 ? def : list[1];
        document.getElementById('opt-limit').innerHTML = list.map(function (n) {
          return '<div class="opt' + (n === setup.limit ? ' active' : '') + '" data-limit="' + n + '">' + n + ' 题<small>' +
            (n === list[0] ? '精简' : n === list[1] ? '推荐' : '详尽') + '</small></div>';
        }).join('');
      }

      function screenCount() {
        var g = Number(setup.grade);
        var n = data.topics.filter(function (t) { return !t.external && t.grade === g; }).length;
        document.getElementById('s-count').textContent = '该范围共 ' + n + ' 个知识点参与筛查。';
      }

      renderSelected();
      renderLimits();
      if (setup.mode === 'screen') screenCount();

      var resumeBtn = document.getElementById('resume');
      if (resumeBtn) resumeBtn.addEventListener('click', function () { App.go('/quiz'); });

      document.getElementById('mode-seg').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-mode]');
        if (!b) return;
        setup.mode = b.getAttribute('data-mode');
        Array.prototype.forEach.call(this.querySelectorAll('button'), function (x) {
          x.classList.toggle('active', x === b);
        });
        document.getElementById('pane-target').hidden = setup.mode !== 'target';
        document.getElementById('pane-screen').hidden = setup.mode !== 'screen';
        setup.limit = setup.mode === 'screen' ? DiagEngine.SCREEN_LIMIT : DiagEngine.DEFAULT_LIMIT;
        renderLimits();
        if (setup.mode === 'screen') screenCount();
      });

      document.getElementById('opt-confirm').addEventListener('click', function (e) {
        var o = e.target.closest('[data-confirm]');
        if (!o) return;
        setup.confirm = Number(o.getAttribute('data-confirm'));
        Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('active', x === o); });
      });

      document.getElementById('opt-limit').addEventListener('click', function (e) {
        var o = e.target.closest('[data-limit]');
        if (!o) return;
        setup.limit = Number(o.getAttribute('data-limit'));
        Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('active', x === o); });
      });

      var tTimer = null;
      document.getElementById('t-q').addEventListener('input', function () {
        clearTimeout(tTimer);
        tTimer = setTimeout(renderSuggest, 130);
      });
      suggestEl.addEventListener('click', function (e) {
        var it = e.target.closest('[data-add]');
        if (!it) return;
        var id = it.getAttribute('data-add');
        if (setup.targets.indexOf(id) >= 0) { App.toast('已经选过这个知识点了'); return; }
        if (setup.targets.length >= 5) { App.toast('最多选择 5 个目标'); return; }
        setup.targets.push(id);
        document.getElementById('t-q').value = '';
        suggestEl.innerHTML = '';
        renderSelected();
      });
      selectedEl.addEventListener('click', function (e) {
        var x = e.target.closest('[data-remove]');
        if (!x) return;
        var id = x.getAttribute('data-remove');
        setup.targets = setup.targets.filter(function (t) { return t !== id; });
        renderSelected();
      });
      document.getElementById('s-grade').addEventListener('change', function (e) {
        setup.grade = e.target.value;
        screenCount();
      });

      document.getElementById('start').addEventListener('click', function () {
        if (setup.mode === 'target' && !setup.targets.length) {
          App.toast('请先选择至少一个目标知识点');
          return;
        }
        var targets = setup.targets;
        if (setup.mode === 'screen') {
          var g = Number(setup.grade);
          targets = data.topics.filter(function (t) { return !t.external && t.grade === g; }).map(function (t) { return t.id; });
          if (!targets.length) { App.toast('该范围没有可筛查的知识点'); return; }
        }
        App.clearDraft();
        startDraft(subject, {
          mode: setup.mode,
          targets: targets,
          targetNames: targets.slice(0, 3).map(function (id) { return data.byId[id] ? data.byId[id].name : id; }),
          limit: setup.limit,
          confirm: setup.confirm,
          seed: 'ui-' + Date.now()
        });
        App.go('/quiz');
      });
    });
  };

  /* ------------------------------------------------------------ 答题页 */

  App.routes.quiz = function () {
    var draft = App.getDraft();
    if (!draft) { App.toast('没有进行中的诊断'); App.go('/diagnose'); return; }
    var subject = draft.subject;
    if (subject !== App.state.subject) App.setSubject(subject);
    return App.graph(subject, true).then(function (g) {
      var session;
      try {
        session = DiagEngine.replay(g, draft.targets, draft.answers || [], App.draftOpts(draft));
      } catch (err) {
        App.toast('诊断数据异常：' + err.message);
        App.clearDraft();
        App.go('/diagnose');
        return;
      }
      quizCtx = { subject: subject, graph: g, session: session, draft: draft };
      stepQuiz();
    });
  };

  function progressHTML(session) {
    var pct = Math.min(100, Math.round(session.answers.length / Math.max(1, session.limit) * 100));
    return '<div class="quiz-head">' +
      '<span class="quiz-count">' + session.answers.length + '/' + session.limit + '</span>' +
      '<span class="progress"><i style="width:' + pct + '%"></i></span>' +
      '<button class="link-btn" id="quit">退出</button></div>';
  }

  function stepQuiz() {
    var ctx = quizCtx;
    var item = DiagEngine.nextItem(ctx.graph, ctx.session);
    if (!item) { App.go('/result'); return; }
    var q = item.question;
    var topic = ctx.graph.byId[item.topicId] || { name: item.topicId };
    var subject = ctx.subject;
    var html = progressHTML(ctx.session);

    html += '<div class="card question-card">';
    html += '<div class="q-topic"><b>' + App.esc(topic.name) + '</b>' +
      '<span class="badge">' + App.esc(App.gradeLabel(subject, topic.grade)) + '</span>' +
      '<span class="badge ghost">' + App.esc(App.DIFF_LABEL[q.difficulty] || q.difficulty || '标准') + '</span>' +
      '<span class="badge ghost">' + App.esc(App.QTYPE_LABEL[q.type] || '题目') + '</span></div>';
    html += '<div class="q-stem">' + App.esc(q.prompt) + '</div>';

    if (q.type === 'choice' && Array.isArray(q.choices) && q.choices.length) {
      html += '<div class="choices" id="choices">' + q.choices.map(function (c) {
        return '<button class="choice" data-key="' + App.esc(c.key) + '"><span class="key">' + App.esc(c.key) +
          '</span><span class="txt">' + App.esc(c.text) + '</span></button>';
      }).join('') + '</div>';
    } else if (q.type === 'self') {
      html += '<div class="self-box"><label class="label">先自己作答，再对照参考答案自评</label>' +
        '<textarea class="field" id="answer-input" placeholder="写下你的思路或答案（不会判对错）"></textarea>' +
        '<div class="btn-row mt8"><button class="btn btn-primary" id="submit">对照参考答案</button></div></div>';
    } else {
      html += '<div class="answer-row"><input class="field" id="answer-input" type="text" autocomplete="off" ' +
        'placeholder="' + (q.type === 'numeric' ? '填写数值或表达式' : '填写你的答案') + '">' +
        '<button class="btn btn-primary" id="submit">提交</button></div>';
      if (q.type === 'numeric') html += '<p class="q-hint">数值题请只填答案，单位通常不用写。</p>';
    }

    html += '<div id="feedback"></div>';
    html += '</div>';
    html += '<div class="quiz-foot"><button class="link-btn" id="skip">不会，跳过这题</button>' +
      '<span class="tiny muted">答错会继续追问更基础的先修</span></div>';

    App.setView(html);

    document.getElementById('quit').addEventListener('click', function () {
      if (window.confirm('退出后本次进度会保留，下次可从首页继续。确定退出？')) App.go('/home');
    });
    document.getElementById('skip').addEventListener('click', function () {
      submit(ctx, item.topicId, 'skip', '');
    });

    if (q.type === 'choice') {
      document.getElementById('choices').addEventListener('click', function (e) {
        var b = e.target.closest('.choice');
        if (!b) return;
        var key = b.getAttribute('data-key');
        var verdict = DiagEngine.judgeQuestion(q, key);
        markChoices(key, verdict.verdict);
        submit(ctx, item.topicId, verdict.verdict === 'correct' ? 'correct' : 'wrong', key, verdict.verdict === 'manual');
      });
    } else {
      var input = document.getElementById('answer-input');
      function doSubmit() {
        var text = input.value;
        if (!String(text || '').trim()) { App.toast('请先填写答案'); return; }
        var verdict = DiagEngine.judgeQuestion(q, text);
        submit(ctx, item.topicId, verdict.verdict === 'correct' ? 'correct' : 'wrong', text, verdict.verdict === 'manual');
      }
      document.getElementById('submit').addEventListener('click', doSubmit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSubmit(); });
      if (q.type !== 'self') setTimeout(function () { input.focus(); }, 60);
    }
  }

  function markChoices(selectedKey, verdict) {
    var box = document.getElementById('choices');
    if (!box) return;
    var q = null;
    var item = DiagEngine.nextItem(quizCtx.graph, quizCtx.session);
    if (item) q = item.question;
    Array.prototype.forEach.call(box.querySelectorAll('.choice'), function (b) {
      b.disabled = true;
      if (b.getAttribute('data-key') === selectedKey) {
        b.classList.add(verdict === 'correct' ? 'correct' : 'wrong');
      } else if (q && verdict !== 'correct' && b.getAttribute('data-key') === q.answer) {
        b.classList.add('correct');
      }
    });
  }

  function submit(ctx, topicId, result, text, manual) {
    var draft = ctx.draft;
    var item = DiagEngine.nextItem(ctx.graph, ctx.session);
    var q = item && item.topicId === topicId ? item.question : null;
    var topic = ctx.graph.byId[topicId] || { name: topicId };

    if (manual && result === 'wrong') {
      showSelfCheck(ctx, topicId, q, text);
      return;
    }
    finishAnswer(ctx, topicId, result, text);
  }

  function lockAnswerControls() {
    var input = document.getElementById('answer-input');
    if (input) input.disabled = true;
    var submit = document.getElementById('submit');
    if (submit) submit.disabled = true;
    var skip = document.getElementById('skip');
    if (skip) skip.disabled = true;
    var choices = document.getElementById('choices');
    if (choices) Array.prototype.forEach.call(choices.querySelectorAll('button'), function (b) { b.disabled = true; });
  }

  /** 引擎无法自动判定时，展示参考答案让用户自评。 */
  function showSelfCheck(ctx, topicId, q, text) {
    lockAnswerControls();
    var fb = document.getElementById('feedback');
    var ref = q ? q.answer : '';
    fb.innerHTML = '<div class="feedback warn">' +
      '<div class="fb-head">这道题需要你自己核对</div>' +
      '<div class="ref"><b>参考答案：</b>' + App.esc(ref || '（无）') + '</div>' +
      (q && q.explanation ? '<div class="explain">' + App.esc(q.explanation) + '</div>' : '') +
      '<div class="small muted mt8">对照参考答案，你觉得这道题算答对吗？</div>' +
      '<div class="actions"><button class="btn btn-soft" data-self="wrong">我答错了</button>' +
      '<button class="btn btn-primary" data-self="correct">我答对了</button></div></div>';
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-self]');
      if (!b) return;
      fb.innerHTML = '';
      finishAnswer(ctx, topicId, b.getAttribute('data-self'), text);
    });
  }

  function finishAnswer(ctx, topicId, result, text) {
    lockAnswerControls();
    var next;
    try {
      next = DiagEngine.applyAnswer(ctx.graph, ctx.session, topicId, result, { text: text });
    } catch (err) {
      App.toast('记录作答失败：' + err.message);
      return;
    }
    ctx.session = next;
    ctx.draft.answers = (ctx.draft.answers || []).concat([{ id: topicId, result: result, text: text }]);
    App.saveDraft(ctx.draft);

    var after = DiagEngine.nextItem(ctx.graph, next);
    var summary = DiagEngine.summarize(ctx.graph, next);
    var st = DiagEngine.statusOf(next, topicId);
    var fb = document.getElementById('feedback');

    var cls = result === 'correct' ? 'good' : (st === 'shaky' ? 'warn' : 'bad');
    var title = result === 'correct'
      ? (st === 'mastered' ? '答对了，这个知识点已掌握' : '答对了，再确认一题')
      : (result === 'skip' ? '已跳过，稍后会从更基础的地方确认' : (st === 'shaky' ? '这次没答对，判定为「不稳」' : '这个知识点判定为「薄弱」'));

    var qShown = DiagEngine.questionById(ctx.graph, (next.answers[next.answers.length - 1] || {}).qid);
    var html = '<div class="feedback ' + cls + '">';
    html += '<div class="fb-head">' + App.esc(title) + '</div>';
    if (qShown && qShown.answer) html += '<div class="ref"><b>参考答案：</b>' + App.esc(qShown.answer) + '</div>';
    if (qShown && qShown.explanation) html += '<div class="explain">' + App.esc(qShown.explanation) + '</div>';
    html += '<div class="actions"><button class="btn ' + (after ? 'btn-primary' : 'btn-soft') + '" id="fb-next">' +
      (after ? '下一题' : '查看诊断结果') + '</button></div>';
    if (summary.limitReached && !after) {
      html += '<p class="tiny muted mt8">已达题目上限，仍有知识点未测完，可再发起一次筛查。</p>';
    }
    html += '</div>';
    fb.innerHTML = html;
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    var head = document.querySelector('.quiz-head');
    if (head) {
      var pct = Math.min(100, Math.round(next.answers.length / Math.max(1, next.limit) * 100));
      head.querySelector('.quiz-count').textContent = next.answers.length + '/' + next.limit;
      head.querySelector('.progress i').style.width = pct + '%';
    }

    var skipBtn = document.getElementById('skip');
    if (skipBtn) skipBtn.disabled = true;

    document.getElementById('fb-next').addEventListener('click', function () {
      if (after) stepQuiz();
      else App.go('/result');
    });
  }

  /* ------------------------------------------------------------ 结果页 */

  App.routes.result = function () {
    var draft = App.getDraft();
    if (!draft) { App.toast('没有可展示的结果'); App.go('/diagnose'); return; }
    if (draft.subject !== App.state.subject) App.setSubject(draft.subject);
    return App.loadTopics(draft.subject).then(function () {
      return renderResult(draft.subject, draft.targets, draft.answers || [], App.draftOpts(draft), { draft: draft });
    });
  };

  /**
   * 渲染诊断结果。options.draft 存在时会把结果写入档案（仅一次）；
   * options.readonly 用于查看历史记录（不写档案）。
   */
  function renderResult(subject, targets, answers, opts, options) {
    options = options || {};
    return App.graph(subject, true).then(function (g) {
      var session = DiagEngine.replay(g, targets, answers, opts);
      var summary = DiagEngine.summarize(g, session);
      var layout = DiagEngine.layout(g, session, summary);
      var chapters = DiagEngine.chapterSummary(g, session);
      var targetNames = targets.slice(0, 3).map(function (id) { return g.byId[id] ? g.byId[id].name : id; });
      var more = targets.length > 3 ? ' 等 ' + targets.length + ' 个' : '';

      var html = '';
      html += '<div class="card result-hero">';
      html += '<h1>' + (summary.roots.length ? '发现 ' + summary.roots.length + ' 个根因' : '本次诊断未发现明显薄弱点') + '</h1>';
      html += '<p>' + App.esc(App.subjectLabel(subject)) + ' · ' + App.esc(App.MODE_LABEL[summary.mode] || '诊断') +
        ' · 共答 ' + summary.asked + ' 题</p>';
      html += '<div class="score-grid">' +
        '<div class="score good"><b>' + summary.mastered.length + '</b><span>已掌握</span></div>' +
        '<div class="score warn"><b>' + summary.shaky.length + '</b><span>不稳</span></div>' +
        '<div class="score bad"><b>' + summary.weak.length + '</b><span>薄弱</span></div>' +
        '<div class="score"><b>' + summary.untested.length + '</b><span>未测</span></div>' +
        '</div></div>';

      if (summary.limitReached) {
        html += '<div class="notice mt12">已达到设定的 ' + summary.limit + ' 题上限，仍有一部分知识点没测到，结论仅供参考。可以调高题目上限再筛查一次。</div>';
      } else if (summary.mode === 'screen') {
        html += '<div class="notice info mt12">本次为整册筛查：只在所选范围内回溯，范围外的先修（如低年级基础）不在本次结论中。</div>';
      }

      /* 根因 */
      html += '<section class="section"><div class="section-head"><h2>薄弱根因</h2><span class="hint">先修链上最靠前的问题</span></div>';
      if (!summary.roots.length) {
        html += '<div class="empty"><strong>没有找到薄弱根因</strong><p class="small">可能是目标已掌握，或题目上限不够、部分知识点未测完。</p></div>';
      } else {
        summary.roots.forEach(function (r) {
          var t = g.byId[r.id] || { name: r.id };
          html += '<div class="card root-card">';
          html += '<div class="between"><span class="root-name">' + App.esc(t.name) + '</span>' +
            '<span class="badge bad">根因</span></div>';
          if (t.root_reason) html += '<p class="reason">' + App.esc(t.root_reason) + '</p>';
          if (t.description) html += '<p class="reason muted">' + App.esc(t.description) + '</p>';
          if (r.pendingPrereqs.length) {
            html += '<div class="mt8"><span class="tiny muted">还没测到的先修：</span><div class="preq-list">' +
              r.pendingPrereqs.map(function (id) {
                var p = g.byId[id];
                return '<span class="rel-link" data-topic="' + App.esc(id) + '">' + App.esc(p ? p.name : id) + '</span>';
              }).join('') + '</div></div>';
          }
          if (r.outOfScopePrereqs.length) {
            html += '<div class="mt8"><span class="tiny muted">本次范围外的先修：</span><div class="preq-list">' +
              r.outOfScopePrereqs.map(function (id) {
                var p = g.byId[id];
                return '<span class="rel-link soft">' + App.esc(p ? p.name : id) + '</span>';
              }).join('') + '</div></div>';
          }
          html += '<div class="btn-row mt12"><button class="btn btn-sm btn-soft" data-topic-detail="' + App.esc(r.id) + '">看详情</button>' +
            '<button class="btn btn-sm btn-ghost" data-retest="' + App.esc(r.id) + '">单独诊断它</button></div>';
          html += '</div>';
        });
      }
      html += '</section>';

      /* 学习路径 */
      html += '<section class="section"><div class="section-head"><h2>建议学习路径</h2><span class="hint">先修在前，按年级排序</span></div>';
      if (!summary.path.length) {
        html += '<div class="empty"><strong>暂无需要补的知识点</strong><p class="small">继续往下学新内容即可。</p></div>';
      } else {
        html += '<div class="card"><div class="path-list">' + summary.path.map(function (p, i) {
          var t = g.byId[p.id] || { name: p.id };
          var ch = App.chapterOf(t);
          return '<button type="button" class="path-item' + (p.isRoot ? ' root' : '') + '" data-topic-detail="' + App.esc(p.id) + '">' +
            '<span class="path-no">' + (i + 1) + '</span>' +
            '<div class="grow"><div class="p-name">' + App.esc(t.name) + (p.isRoot ? ' · 根因' : '') + '</div>' +
            '<div class="p-meta">' + App.esc(App.gradeLabel(subject, t.grade)) + (ch.label ? ' · ' + App.esc(ch.label) : '') + '</div></div>' +
            '<span class="badge p-status ' + (App.STATUS_CLASS[p.status] || 'ghost') + '">' + App.esc(App.STATUS_LABEL[p.status] || p.status) + '</span>' +
            '</button>';
        }).join('') + '</div></div>';
      }
      html += '</section>';

      /* 路径图 */
      if (layout.nodes.length) {
        html += '<section class="section"><div class="section-head"><h2>路径关系图</h2><span class="hint">点击节点看详情</span></div>';
        html += '<div class="graph-wrap" id="graph-wrap">' + App.pathGraphSVG(g, layout) + '</div>';
        html += '<div class="legend">' +
          '<span><i style="background:#e6f4ec;border:1px solid #17784a"></i>已掌握</span>' +
          '<span><i style="background:#fdf2e0;border:1px solid #a9660a"></i>不稳</span>' +
          '<span><i style="background:#fbecea;border:1px solid #ad3c2d"></i>薄弱</span>' +
          '<span><i style="background:#f4f7f6;border:1px solid #cfd8d5"></i>未测</span>' +
          '<span><i style="background:#fff;border:2px solid #0f6e62"></i>目标</span>' +
          '<span><i style="background:#fff;border:2px solid #ad3c2d"></i>根因</span>' +
          '</div></section>';
      }

      /* 章节分布 */
      var weakChapters = chapters.filter(function (c) { return c.weak || c.shaky; });
      if (weakChapters.length) {
        html += '<section class="section"><div class="section-head"><h2>薄弱章节</h2><span class="hint">共 ' + weakChapters.length + ' 章有问题</span></div>';
        html += '<div class="card">' + weakChapters.slice(0, 12).map(function (c) {
          var total = Math.max(1, c.total);
          return '<div class="chapter-stat">' +
            '<div class="between"><span class="small"><b>' + App.esc(c.label || c.chapterName) + '</b></span>' +
            '<span class="tiny muted">掌握 ' + c.mastered + '/' + c.total + '</span></div>' +
            '<div class="bar">' +
            '<i class="b-good" style="width:' + (c.mastered / total * 100) + '%"></i>' +
            '<i class="b-warn" style="width:' + (c.shaky / total * 100) + '%"></i>' +
            '<i class="b-bad" style="width:' + (c.weak / total * 100) + '%"></i>' +
            '</div>' +
            '<div class="tiny muted mt8">薄弱 ' + c.weak + ' · 不稳 ' + c.shaky + ' · 未测 ' + c.untested + '</div>' +
            '</div>';
        }).join('') + '</div></section>';
      }

      /* 操作 */
      html += '<section class="section"><div class="btn-row">';
      html += '<button class="btn btn-soft" id="again">再测一次</button>';
      if (!options.readonly) {
        html += '<a class="btn btn-primary" href="' + App.href('/profile') + '">去档案查看</a>';
      } else {
        html += '<a class="btn btn-primary" href="' + App.href('/diagnose') + '">发起新诊断</a>';
      }
      html += '</div>';
      if (!options.readonly && summary.roots.length) {
        html += '<p class="tiny muted mt12">本次结果已自动保存到档案，可在「档案」中随时回看。</p>';
      } else if (!options.readonly) {
        html += '<p class="tiny muted mt12">本次结果已自动保存到档案。</p>';
      }
      html += '</section>';

      App.setView(html);

      /* 交互 */
      document.querySelectorAll('[data-topic-detail]').forEach(function (el) {
        el.addEventListener('click', function () {
          App.showTopicSheet(subject, el.getAttribute('data-topic-detail'));
        });
      });
      document.querySelectorAll('[data-retest]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = el.getAttribute('data-retest');
          App.clearDraft();
          startDraft(subject, {
            mode: 'target', targets: [id],
            targetNames: [g.byId[id] ? g.byId[id].name : id],
            limit: DiagEngine.DEFAULT_LIMIT, confirm: 3, seed: 'ui-' + Date.now()
          });
          App.go('/quiz');
        });
      });
      var wrap = document.getElementById('graph-wrap');
      if (wrap) {
        wrap.addEventListener('click', function (e) {
          var n = e.target.closest('.gnode');
          if (n) App.showTopicSheet(subject, n.getAttribute('data-topic'));
        });
      }
      document.getElementById('again').addEventListener('click', function () {
        App.clearDraft();
        startDraft(subject, {
          mode: 'target', targets: targets.slice(), targetNames: targetNames,
          limit: opts.limit || DiagEngine.DEFAULT_LIMIT,
          confirm: opts.confirm || DiagEngine.DEFAULT_CONFIRM,
          seed: 'ui-' + Date.now()
        });
        App.go('/quiz');
      });

      /* 自动归档（仅结果页，一次） */
      if (!options.readonly && options.draft && !options.draft.recordId) {
        var profile = App.ensureProfile();
        var rec = App.addRecord({
          profileId: profile.id,
          subject: subject,
          mode: summary.mode,
          targets: targets.slice(),
          targetNames: targetNames,
          answers: answers.slice(),
          opts: opts,
          label: targetNames.join('、') + more + (summary.mode === 'screen' ? '（整册筛查）' : ''),
          snap: {
            asked: summary.asked, limit: summary.limit,
            mastered: summary.mastered.length, shaky: summary.shaky.length,
            weak: summary.weak.length, untested: summary.untested.length,
            roots: summary.roots.length, path: summary.path.length,
            rootIds: summary.roots.map(function (r) { return r.id; })
          }
        });
        options.draft.recordId = rec.id;
        App.saveDraft(options.draft);
      }
    });
  }

  App.renderResult = renderResult;
})();
