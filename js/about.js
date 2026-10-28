/* 关于：来源、许可与使用说明 */
App.routes.about = function () {
  return App.loadMeta().then(function (meta) {
    var topics = 0, questions = 0, edges = 0;
    App.SUBJECT_ORDER.forEach(function (s) {
      topics += meta.subjects[s].topics;
      questions += meta.subjects[s].questions;
      edges += meta.subjects[s].edges;
    });

    var html = '';
    html += '<div class="about-hero"><div class="brand-mark">知</div><h1>知脉 · 知识点诊断</h1>' +
      '<p>中小学知识图谱 · 先修关系诊断 · 可离线安装</p></div>';

    html += '<section class="section"><div class="card">';
    html += '<p class="small" style="line-height:1.75">这是一个本地运行的知识点诊断应用，参照 math.pansgo.com 的功能与交互重新实现：' +
      '按学科浏览知识图谱，选择目标知识点或整册筛查，用诊断题沿着先修关系逐层回溯，最后给出薄弱根因、学习路径与章节分布。</p>';
    html += '<p class="small muted mt8" style="line-height:1.75">所有数据与诊断记录都保存在你自己的浏览器里，不上传、不联网也能用。</p>';
    html += '</div></section>';

    html += '<section class="section"><div class="section-head"><h2>能做什么</h2></div><div class="card"><ul class="about-list">';
    html += '<li><span class="dot"></span><span>四个学科：数学、语文、英语、物理，覆盖小学到高中。</span></li>';
    html += '<li><span class="dot"></span><span>知识图谱：按年级、学段、领域筛选，查看每个知识点的先修与后续。</span></li>';
    html += '<li><span class="dot"></span><span>自适应诊断：答对要连续确认，答错就继续追问更基础的先修。</span></li>';
    html += '<li><span class="dot"></span><span>整册筛查：按教材册次快速找出一册里最薄弱的章节。</span></li>';
    html += '<li><span class="dot"></span><span>档案归档：诊断结果自动保存，可随时回看，也可以导出为 JSON。</span></li>';
    html += '</ul></div></section>';

    html += '<section class="section"><div class="section-head"><h2>数据与来源</h2></div><div class="card">';
    html += '<div class="kv"><span>知识点总数</span><b>' + App.fmtNum(topics) + '</b></div>';
    html += '<div class="kv"><span>先修关系</span><b>' + App.fmtNum(edges) + '</b></div>';
    html += '<div class="kv"><span>诊断题</span><b>' + App.fmtNum(questions) + '</b></div>';
    html += '<div class="kv"><span>数据来源</span><b>cn-math-taxonomy 开源知识图谱</b></div>';
    html += '<div class="kv"><span>使用许可</span><b>CC BY-NC 4.0（非商业）</b></div>';
    html += '</div>';
    html += '<p class="tiny muted mt8" style="line-height:1.7">数据与诊断引擎来自开源项目 ' +
      '<a href="https://github.com/xiaoyang111222/cn-math-taxonomy" target="_blank" rel="noopener" style="text-decoration:underline">cn-math-taxonomy</a>' +
      '，原作者保留署名权。本项目仅用于学习与教学研究，不用于商业用途。' +
      '界面与交互参照 <a href="https://math.pansgo.com" target="_blank" rel="noopener" style="text-decoration:underline">math.pansgo.com</a> 实现，与原作者无隶属关系。</p>';
    html += '</section>';

    html += '<section class="section"><div class="section-head"><h2>安装到主屏幕</h2></div><div class="card"><ul class="about-list">';
    html += '<li><span class="dot"></span><span>手机浏览器：打开本页面后，点「分享 / 菜单」→「添加到主屏幕」。</span></li>';
    html += '<li><span class="dot"></span><span>电脑浏览器：地址栏右侧的安装图标，或菜单里的「安装知脉」。</span></li>';
    html += '<li><span class="dot"></span><span>安装后可像普通 App 一样全屏打开，核心页面离线可用。</span></li>';
    html += '</ul></div></section>';

    html += '<section class="section"><div class="card tight">';
    html += '<div class="kv"><span>版本</span><b>1.0.0</b></div>';
    html += '<div class="kv"><span>运行方式</span><b>本地静态页面 / PWA</b></div>';
    html += '<div class="kv"><span>数据更新</span><b>' + App.esc(meta.generated || '—') + '</b></div>';
    html += '</div></section>';

    html += '<p class="footer-note">诊断结果只是学习参考，不替代老师的判断。<br>愿每个孩子都能找到卡住的那一步。</p>';

    App.setView(html);
  });
};
