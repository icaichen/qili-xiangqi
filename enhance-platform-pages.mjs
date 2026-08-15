import { readFile, writeFile } from "node:fs/promises";

const htmlUrl = new URL("./index.html", import.meta.url);
const cssUrl = new URL("./redesign.css", import.meta.url);
let html = await readFile(htmlUrl, "utf8");
let css = await readFile(cssUrl, "utf8");

const oldTrain = '<section id="trainView" class="platform-view platform-page hidden"><div class="platform-page-header"><div><span class="eyebrow">TRAIN</span><h1>训练</h1><p>根据真实对局错误安排训练，而不是随机刷题。</p></div><span>下一阶段</span></div><div class="platform-surface simple-page-card"><h2>对局 → 识别弱点 → 针对练题 → 再测一次</h2><p>计划题型：将军与应将、吃子判断、保护强子、交换、捉双、两步杀、炮架、马腿。</p></div></section>';
const newTrain = `<section id="trainView" class="platform-view platform-page hidden">
        <div class="platform-page-header"><div><span class="eyebrow">TRAIN · 针对训练</span><h1>把错过的棋，再练会一次</h1><p>以后每次复盘都会把真实错误归类到对应训练模块。</p></div><span>训练系统建设中</span></div>
        <div class="training-layout">
          <aside class="platform-surface training-menu">
            <span class="eyebrow">训练类型</span>
            <button class="training-menu-item active"><b>今</b><span>今日训练<small>根据最近对局</small></span></button>
            <button class="training-menu-item"><b>将</b><span>将军与应将<small>强制手优先</small></span></button>
            <button class="training-menu-item"><b>保</b><span>保护与交换<small>避免无谓丢子</small></span></button>
            <button class="training-menu-item"><b>杀</b><span>基础杀法<small>一步杀、两步杀</small></span></button>
            <button class="training-menu-item"><b>局</b><span>基础布局<small>顺炮、列炮</small></span></button>
          </aside>
          <section class="platform-surface training-main">
            <div class="training-head"><div><span class="eyebrow">示例训练模块</span><h2>保护与交换</h2><p>目标：先看清哪些强子正在受攻，再判断躲、保、换哪个更合适。</p></div><span class="training-badge">14级能力</span></div>
            <div class="puzzle-preview-row">
              <article class="puzzle-preview"><span>题目 1</span><div class="mini-board"><i>车</i><i>炮</i></div><small>找出受攻强子</small></article>
              <article class="puzzle-preview"><span>题目 2</span><div class="mini-board"><i>马</i><i>车</i></div><small>选择躲、保或换</small></article>
              <article class="puzzle-preview"><span>题目 3</span><div class="mini-board"><i>炮</i><i>卒</i></div><small>判断交换是否划算</small></article>
              <article class="puzzle-preview"><span>题目 4</span><div class="mini-board"><i>车</i><i>马</i></div><small>检查对手反吃</small></article>
            </div>
            <div class="training-footer"><p>完成真实复盘后，这里会优先出现你重复犯错的题型。</p><button class="button button-primary" disabled>训练功能即将接入</button></div>
          </section>
        </div>
      </section>`;
if (html.includes(oldTrain)) html = html.replace(oldTrain, newTrain);

const oldAnalysis = '<section id="analysisView" class="platform-view platform-page hidden"><div class="platform-page-header"><div><span class="eyebrow">ANALYSIS</span><h1>分析棋盘</h1><p>独立自由摆盘与 Pikafish 分析工具。</p></div><span>规划中</span></div><div class="platform-surface simple-page-card"><h2>自由摆盘 + Pikafish</h2><p>下一阶段支持任意局面、FEN、候选着和主变化。</p></div></section>';
const newAnalysis = `<section id="analysisView" class="platform-view platform-page hidden">
        <div class="platform-page-header"><div><span class="eyebrow">ANALYSIS · 棋盘分析</span><h1>把任何局面放上来研究</h1><p>自由摆盘、FEN、候选着与 Pikafish 主变化会集中在这里。</p></div><span>下一阶段</span></div>
        <div class="analysis-layout">
          <section class="platform-surface analysis-board-shell"><div class="analysis-placeholder-board"><span>车</span><span>马</span><span>炮</span><span class="red-chip">帅</span></div><p>自由摆盘棋盘</p></section>
          <aside class="platform-surface analysis-side"><span class="eyebrow">分析工具</span><h2>Pikafish</h2><div class="analysis-option"><span>局面来源</span><strong>手动摆盘 / FEN</strong></div><div class="analysis-option"><span>候选路线</span><strong>MultiPV 1–5</strong></div><div class="analysis-option"><span>教学解释</span><strong>可验证证据 + AI</strong></div><button class="button button-primary" disabled>自由分析即将开放</button></aside>
        </div>
      </section>`;
if (html.includes(oldAnalysis)) html = html.replace(oldAnalysis, newAnalysis);

const oldProfile = '<section id="profileView" class="platform-view platform-page hidden"><div class="platform-page-header"><div><span class="eyebrow">PROFILE</span><h1>我的棋力</h1><p>Rating、能力画像、课程进度和历史对局。</p></div><span>本地原型</span></div><div class="platform-surface simple-page-card"><h2>平台棋力：—</h2><p>真人匹配与账户系统上线后才生成真实 Rating，不冒充其他平台积分。</p></div></section>';
const newProfile = `<section id="profileView" class="platform-view platform-page hidden">
        <div class="platform-page-header"><div><span class="eyebrow">PROFILE · 我的</span><h1>看见自己到底在进步什么</h1><p>等级分只是结果；真正需要追踪的是你的具体象棋能力。</p></div><span>等待账户系统</span></div>
        <div class="profile-grid">
          <article class="platform-surface profile-identity"><div class="profile-avatar">帅</div><div><span class="eyebrow">棋手档案</span><h2>未登录棋手</h2><p>平台 Rating <strong>—</strong></p></div></article>
          <article class="platform-surface profile-stat"><span>平台棋力</span><strong>—</strong><small>真人匹配上线后生成</small></article>
          <article class="platform-surface profile-stat"><span>完成对局</span><strong>—</strong><small>账户系统上线后统计</small></article>
          <article class="platform-surface ability-card"><div><span class="eyebrow">能力画像</span><h2>不是一个总分，而是六项能力</h2></div><div class="ability-empty"><span>将军识别</span><span>吃子判断</span><span>保护意识</span><span>交换判断</span><span>杀法计算</span><span>布局基础</span></div><p>有足够真实对局后才显示能力百分比，不使用虚构数据。</p></article>
          <article class="platform-surface recent-games-card"><span class="eyebrow">最近对局</span><h2>还没有同步的历史对局</h2><p>未来每一盘都可以继续复盘、重新训练错误题型。</p><button class="button button-ghost platform-jump" data-target-view="play">先下一盘</button></article>
        </div>
      </section>`;
if (html.includes(oldProfile)) html = html.replace(oldProfile, newProfile);

if (!css.includes('/* Rich platform pages */')) {
css += `

/* Rich platform pages */
.training-layout{display:grid;grid-template-columns:220px 1fr;gap:12px}.training-menu{padding:18px}.training-menu-item{width:100%;display:flex;align-items:center;gap:10px;margin-top:5px;padding:10px;border:0;border-radius:7px;color:#6f604f;background:transparent;text-align:left}.training-menu-item>b{width:30px;height:30px;display:grid;place-items:center;border:1px solid #ddc6a8;border-radius:50%;color:#9d3025;background:#f6e8d5;font-family:"Noto Serif SC",serif}.training-menu-item span{font-size:12px;font-weight:700}.training-menu-item small{display:block;margin-top:2px;color:#a09587;font-size:9px;font-weight:500}.training-menu-item.active{background:#f1dfc8;color:#542e23}.training-main{padding:25px}.training-head{display:flex;justify-content:space-between;gap:20px}.training-head h2{margin:4px 0 7px;font-size:25px}.training-head p{max-width:650px;color:#83735e;font-size:12px;line-height:1.7}.training-badge{height:max-content;padding:6px 9px;border-radius:999px;color:#8f2c23;background:#f3ddd0;font-size:10px;font-weight:800}.puzzle-preview-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:24px}.puzzle-preview{padding:12px;border:1px solid #e2ceb2;border-radius:7px;background:#fff8eb}.puzzle-preview>span{color:#826b50;font-size:10px;font-weight:800}.puzzle-preview>small{display:block;margin-top:8px;color:#887765;font-size:9px}.mini-board{position:relative;aspect-ratio:1;margin-top:9px;border:4px solid #c58e50;background:linear-gradient(rgba(104,66,31,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(104,66,31,.18) 1px,transparent 1px),#e8bd78;background-size:25% 25%}.mini-board i{position:absolute;width:25px;height:25px;display:grid;place-items:center;border:1px solid #632e20;border-radius:50%;color:#9e3025;background:#f6dcaa;font-family:"Noto Serif SC",serif;font-size:11px;font-style:normal}.mini-board i:first-child{left:18%;bottom:14%}.mini-board i:last-child{right:16%;top:17%;color:#352b23;border-color:#493729}.training-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:20px;padding-top:16px;border-top:1px solid #ead8c2}.training-footer p{margin:0;color:#897967;font-size:10px}.analysis-layout{display:grid;grid-template-columns:minmax(600px,1.55fr) 320px;gap:12px}.analysis-board-shell{padding:24px}.analysis-board-shell>p{text-align:center;color:#8c7b68;font-size:11px}.analysis-placeholder-board{position:relative;max-width:630px;aspect-ratio:8/9;margin:0 auto;border:8px solid #b77e42;background:linear-gradient(rgba(93,58,28,.24) 1px,transparent 1px),linear-gradient(90deg,rgba(93,58,28,.24) 1px,transparent 1px),#e7bd79;background-size:12.5% 11.11%;box-shadow:inset 0 0 24px rgba(91,56,24,.12)}.analysis-placeholder-board span{position:absolute;width:46px;height:46px;display:grid;place-items:center;border:2px solid #3d3026;border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff1c8,#e5bd76 66%,#c68f49);font-family:"Noto Serif SC",serif;font-size:20px;box-shadow:0 3px 7px rgba(62,36,16,.25)}.analysis-placeholder-board span:nth-child(1){left:2%;top:2%}.analysis-placeholder-board span:nth-child(2){left:26%;top:13%}.analysis-placeholder-board span:nth-child(3){right:14%;top:32%}.analysis-placeholder-board .red-chip{right:38%;bottom:4%;color:#a52e24;border-color:#a52e24}.analysis-side{height:max-content;padding:24px}.analysis-side h2{margin:5px 0 20px;font-size:26px}.analysis-option{padding:13px 0;border-top:1px solid #ead7be}.analysis-option span,.analysis-option strong{display:block}.analysis-option span{color:#9a8b7b;font-size:9px}.analysis-option strong{margin-top:4px;color:#554538;font-size:12px}.analysis-side .button{width:100%;margin-top:18px}.profile-grid{display:grid;grid-template-columns:1.3fr .7fr .7fr;gap:12px}.profile-identity,.profile-stat,.ability-card,.recent-games-card{padding:22px}.profile-identity{display:flex;align-items:center;gap:15px}.profile-avatar{width:58px;height:58px;display:grid;place-items:center;border:2px solid #a52d23;border-radius:50%;color:#a52d23;background:#efd3a6;font-family:"Noto Serif SC",serif;font-size:24px}.profile-identity h2{margin:3px 0 6px}.profile-identity p{margin:0;color:#857563;font-size:11px}.profile-stat span,.profile-stat small{display:block;color:#948575;font-size:9px}.profile-stat strong{display:block;margin:9px 0 6px;font-family:"Noto Serif SC",serif;font-size:34px}.ability-card{grid-column:1/3;min-height:235px}.ability-card h2{margin:3px 0 15px}.ability-empty{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ability-empty span{padding:13px;border:1px solid #e5d1b6;border-radius:6px;color:#776654;background:#fcf4e8;font-size:10px;text-align:center}.ability-card p,.recent-games-card p{margin-top:15px;color:#8c7b68;font-size:10px;line-height:1.7}.recent-games-card{min-height:235px}.recent-games-card h2{margin:4px 0 10px;font-size:20px}.recent-games-card .button{margin-top:12px}@media(max-width:1280px){.puzzle-preview-row{grid-template-columns:repeat(2,1fr)}.analysis-layout{grid-template-columns:1fr 280px}.profile-grid{grid-template-columns:1fr 1fr}.profile-identity{grid-column:1/3}.ability-card{grid-column:1/3}}
`;
}

await writeFile(htmlUrl, html);
await writeFile(cssUrl, css);
console.log("Richer platform pages added");
