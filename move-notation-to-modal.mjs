import { readFile, writeFile } from "node:fs/promises";

const root = process.cwd();

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  return source.replace(search, replacement);
}

// index.html
{
  const path = `${root}/index.html`;
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    '        <button id="newGameButton" class="button button-secondary">重新开始</button>',
    `        <div class="topbar-actions">
          <button id="openNotationButton" class="button button-ghost">记谱教学</button>
          <button id="newGameButton" class="button button-secondary">重新开始</button>
        </div>`,
    "topbar actions",
  );

  const guideStart = source.indexOf('          <details class="notation-guide" open>');
  const guideEnd = source.indexOf('          <section class="history-section">', guideStart);
  if (guideStart < 0 || guideEnd < 0) throw new Error("Notation guide block not found");
  source = source.slice(0, guideStart) + source.slice(guideEnd);

  source = replaceOnce(
    source,
    `      <section id="reviewDropzone" class="review-dropzone hidden">
        <div class="drop-icon">谱</div>
        <h2>导入一盘棋进行复盘</h2>
        <p>第一阶段将支持粘贴中国象棋 PGN、手动摆盘和上传棋谱文件。</p>
        <button class="button button-primary" disabled>即将开放</button>
      </section>
    </div>`,
    `      <section id="reviewDropzone" class="review-dropzone hidden">
        <div class="drop-icon">谱</div>
        <h2>导入一盘棋进行复盘</h2>
        <p>第一阶段将支持粘贴中国象棋 PGN、手动摆盘和上传棋谱文件。</p>
        <button class="button button-primary" disabled>即将开放</button>
      </section>
    </div>

    <div id="notationModal" class="notation-modal hidden" role="dialog" aria-modal="true" aria-labelledby="notationModalTitle">
      <button class="notation-backdrop" data-close-notation aria-label="关闭记谱教学"></button>
      <section class="notation-dialog">
        <header class="notation-dialog-header">
          <div>
            <span class="eyebrow">基础教学</span>
            <h2 id="notationModalTitle">象棋记谱怎么读</h2>
          </div>
          <button id="closeNotationButton" class="notation-close" aria-label="关闭">×</button>
        </header>

        <p class="notation-intro">一手棋通常由四部分组成：棋子、起始纵线、移动方向、移动距离或目标纵线。</p>
        <div class="notation-examples" role="group" aria-label="记谱示例">
          <button class="notation-example active" data-notation="车二进四" data-piece="rook" data-color="red">车二进四</button>
          <button class="notation-example" data-notation="马八进七" data-piece="horse" data-color="red">马八进七</button>
          <button class="notation-example" data-notation="炮2平5" data-piece="cannon" data-color="black">炮2平5</button>
        </div>
        <div id="notationBreakdown" class="notation-breakdown" aria-live="polite"></div>
        <div class="notation-help-grid">
          <article>
            <strong>进、退、平</strong>
            <p>进：向对方方向走；退：向自己方向走；平：保持同一横线左右移动。</p>
          </article>
          <article>
            <strong>最后一个数字</strong>
            <p>车、炮、兵通常表示移动几格；马、相、仕以及“平”通常表示落到哪一路。</p>
          </article>
          <article>
            <strong>纵线从哪里数</strong>
            <p>红方和黑方都从自己右手边开始数。红方常用中文数字，黑方常用阿拉伯数字。</p>
          </article>
        </div>
        <p class="notation-rule">例：车二进四 = 第二路的车，向前走四个交叉点。</p>
      </section>
    </div>`,
    "notation modal",
  );

  await writeFile(path, source, "utf8");
}

// app.js
{
  const path = `${root}/app.js`;
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    'const notationBreakdownElement = document.querySelector("#notationBreakdown");',
    `const notationBreakdownElement = document.querySelector("#notationBreakdown");
const notationModalElement = document.querySelector("#notationModal");
const openNotationButtonElement = document.querySelector("#openNotationButton");
const closeNotationButtonElement = document.querySelector("#closeNotationButton");`,
    "notation modal elements",
  );

  source = replaceOnce(
    source,
    `document.querySelectorAll(".notation-example").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".notation-example").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotationLesson(button.dataset.notation, button.dataset.piece, button.dataset.color);
  });
});`,
    `function openNotationLesson() {
  notationModalElement?.classList.remove("hidden");
  document.body.classList.add("modal-open");
  renderNotationLesson();
  closeNotationButtonElement?.focus();
}

function closeNotationLesson() {
  notationModalElement?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  openNotationButtonElement?.focus();
}

openNotationButtonElement?.addEventListener("click", openNotationLesson);
closeNotationButtonElement?.addEventListener("click", closeNotationLesson);
notationModalElement?.querySelector("[data-close-notation]")?.addEventListener("click", closeNotationLesson);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !notationModalElement?.classList.contains("hidden")) closeNotationLesson();
});

document.querySelectorAll(".notation-example").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".notation-example").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotationLesson(button.dataset.notation, button.dataset.piece, button.dataset.color);
  });
});`,
    "notation behavior",
  );

  await writeFile(path, source, "utf8");
}

// styles.css
{
  const path = `${root}/styles.css`;
  let source = await readFile(path, "utf8");
  source += `

/* Standalone notation lesson */
.topbar-actions {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 8px;
}

body.modal-open {
  overflow: hidden;
}

.notation-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
}

.notation-modal.hidden {
  display: none;
}

.notation-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(18, 28, 23, 0.52);
  backdrop-filter: blur(9px);
}

.notation-dialog {
  position: relative;
  width: min(680px, calc(100vw - 40px));
  max-height: min(760px, calc(100vh - 48px));
  overflow-y: auto;
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 24px;
  background: rgba(252, 252, 248, 0.98);
  box-shadow: 0 32px 90px rgba(16, 27, 21, 0.28);
}

.notation-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.notation-dialog-header h2 {
  margin-top: 0;
  font-size: 25px;
}

.notation-close {
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 12px;
  color: #4d5b53;
  background: #f1f3ef;
  font-size: 24px;
  line-height: 1;
}

.notation-intro {
  margin-bottom: 18px;
  color: var(--muted);
  line-height: 1.7;
}

.notation-dialog .notation-examples {
  margin-bottom: 16px;
}

.notation-dialog .notation-breakdown {
  margin-bottom: 18px;
}

.notation-help-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 18px 0;
}

.notation-help-grid article {
  padding: 14px;
  border: 1px solid rgba(35, 75, 59, 0.1);
  border-radius: 14px;
  background: #f3f6f3;
}

.notation-help-grid strong {
  font-size: 13px;
}

.notation-help-grid p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.65;
}

@media (max-width: 720px) {
  .notation-help-grid {
    grid-template-columns: 1fr;
  }

  .topbar-actions .button-ghost {
    display: none;
  }
}
`;
  await writeFile(path, source, "utf8");
}

console.log("Notation lesson moved to standalone modal.");
