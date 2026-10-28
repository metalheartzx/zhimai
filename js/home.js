/* 首页：总览、继续诊断、年级入口 */
App.routes.home = function () {
  return App.loadMeta().then(function (meta) {
    var subject = App.state.subject;
    var sm = meta.subjects[subject];
    var draft = App.getDraft();
    var last = App.lastRecord();
    var html = '';

    html += '<section class="hero">';
    html += '<h1>找到卡住的那一步</h1>';
    html += '<p>沿着知识图谱逐层回溯先修，用少量诊断题定位真正薄弱的基础，再给出可执行的学习顺序。</p>';
    html += '<div class="btn-row"><a class="btn btn-primary" href="' + App.href('/diagnose') + '">开始诊断</a>' +
      '<a class="btn btn-ghost" href="' + App.href('/explore') + '">浏览知识图谱</a></div>';
    html += '</section>';

    if (draft && !draft.recordId) {
      var names = (draft.targetNames || []).slice(0, 2).join('、');
      var more = (draft.targetNames || []).length > 2 ? ' 等' + draft.targetNames.length + '个' : '';
      var answered = (draft.answers || []).length;
      var pct = Math.min(100, Math.round(answered / Math.max(1, draft.limit) * 100));
      html += '<section class="section"><a class="card continue-card" href="' + App.href('/quiz') + '">';
      html += '<div class="ring">' + pct + '%</div>';
      html += '<div class="grow"><div class="row" style="gap:6px"><span class="badge accent">' + App.esc(App.subjectLabel(draft.subject)) +
        '</span><span class="badge ghost">' + App.esc(App.MODE_LABEL[draft.mode] || '诊断') + '</span></div>';
      html += '<div class="record-title mt8 truncate">' + App.esc(names || '已选目标') + App.esc(more) + '</div>';
      html += '<div class="record-sub">已答 ' + answered + ' / ' + draft.limit + ' 题 · ' + App.fmtDate(draft.updatedAt) + '</div></div>';
      html += '<span class="badge warn">继续</span></a></section>';
    } else if (last) {
      html += '<section class="section"><div class="card continue-card">';
      html += '<div class="ring">' + (last.snap && last.snap.weak ? last.snap.weak : 0) + '</div>';
      html += '<div class="grow"><div class="small muted">上次诊断 · ' + App.esc(App.subjectLabel(last.subject)) + ' · ' + App.fmtDate(last.createdAt) + '</div>';
      html += '<div class="record-title mt8">发现 ' + ((last.snap && last.snap.weak) || 0) + ' 个薄弱点，' +
        ((last.snap && last.snap.roots) || 0) + ' 个根因</div></div>';
      html += '<a class="badge accent" href="' + App.href('/record/' + last.id) + '">查看</a></div></section>';
    }

    html += '<section class="section"><div class="section-head"><h2>' + App.esc(App.subjectLabel(subject)) + '知识图谱</h2>' +
      '<span class="hint">数据来自开源知识图谱</span></div>';
    html += '<div class="stats">';
    html += '<div class="stat"><b>' + App.fmtNum(sm.topics) + '</b><span>知识点</span></div>';
    html += '<div class="stat"><b>' + App.fmtNum(sm.edges) + '</b><span>先修关系</span></div>';
    html += '<div class="stat"><b>' + App.fmtNum(sm.questions) + '</b><span>诊断题</span></div>';
    html += '</div>';
    var total = 0, totalTopics = 0;
    App.SUBJECT_ORDER.forEach(function (s) { total += meta.subjects[s].questions; totalTopics += meta.subjects[s].topics; });
    html += '<p class="tiny muted" style="margin-top:8px">四学科合计 ' + App.fmtNum(totalTopics) + ' 个知识点 · ' +
      App.fmtNum(total) + ' 道诊断题</p>';
    html += '</section>';

    html += '<section class="section"><div class="section-head"><h2>按年级浏览</h2>' +
      '<a class="hint" href="' + App.href('/explore') + '">全部 →</a></div>';
    html += '<div class="grade-grid">';
    sm.grades.forEach(function (g) {
      html += '<a class="grade-item" href="' + App.href('/explore?grade=' + g.grade) + '">' +
        '<b>' + App.esc(g.label) + '</b><span>' + g.topics + ' 个知识点</span></a>';
    });
    html += '<a class="grade-item wide" href="' + App.href('/diagnose') + '">' +
      '<div><b>整册筛查</b><span>按年级一次性筛查薄弱章节</span></div><span class="badge accent">去诊断</span></a>';
    html += '</div></section>';

    html += '<section class="section"><div class="section-head"><h2>怎么用</h2></div><div class="card steps">';
    html += '<div class="step"><div class="step-no">1</div><div><b>选一个目标</b><p>可以是最近学不懂的知识点，也可以直接选整册做筛查。</p></div></div>';
    html += '<div class="step"><div class="step-no">2</div><div><b>答几道小题</b><p>每个知识点答对几道才算掌握；答错会继续追问更基础的先修。</p></div></div>';
    html += '<div class="step"><div class="step-no">3</div><div><b>看根因和路径</b><p>结果给出薄弱根因、按年级排序的学习路径和章节分布，可保存进档案。</p></div></div>';
    html += '</div></section>';

    html += '<p class="footer-note">数据：cn-math-taxonomy 开源知识图谱 · CC BY-NC 4.0<br>仅用于学习与教学研究，非商业用途</p>';

    App.setView(html);
  });
};
