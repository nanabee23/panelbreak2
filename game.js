/* ============================================
   PanelBreak - 完全版 game.js（上部）
   内部状態 / 初期化 / 判定ロジック
============================================ */

const COLS = 6;
const ROWS = 8;
const SIZE = 50;

const game = document.getElementById("game");
const comboText = document.getElementById("combo-text");
const comboGaugeFill = document.getElementById("combo-gauge-fill");
const scoreUI = document.getElementById("score");

let grid = [];
let busy = false;

let combo = 0;
let comboTimer = null;
let score = 0;

/* ============================================
   連鎖ゲージ時間（ゆっくり版）
============================================ */
function getComboTime(n) {
  if (n <= 1) return 4500;
  if (n === 2) return 3600;
  if (n === 3) return 2800;
  if (n === 4) return 2200;
  if (n === 5) return 1700;
  if (n === 6) return 1400;
  return 1200;
}

/* ============================================
   WebAudio 初期化
============================================ */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/* ============================================
   ガラス割れ音（シャリーン系）
============================================ */
function playBreakSound() {
  const bufferSize = audioCtx.sampleRate * 0.15;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.4;

  noise.connect(filter).connect(gain).connect(audioCtx.destination);
  noise.start();
}

/* ============================================
   連鎖音（音階上昇）
============================================ */
function playComboSound(n) {
  const freqs = [
    261.63, // ド
    293.66, // レ
    329.63, // ミ
    349.23, // ファ
    392.00, // ソ
    440.00, // ラ
    493.88, // シ
    523.25  // 高ド
  ];
  const idx = Math.min(n - 1, freqs.length - 1);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.frequency.value = freqs[idx];
  osc.type = "triangle";

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

/* ============================================
   スコア加算
============================================ */
function addScore(panels) {
  score += panels * 10 * combo;
  scoreUI.textContent = score;
}

/* ============================================
   内部状態の回転
   [LU, RU, RD, LD] → [LD, LU, RU, RD]
============================================ */
function rotateState(s) {
  return [s[3], s[0], s[1], s[2]];
}

/* ============================================
   パネル生成（内部状態を dataset に保存）
============================================ */
function createBlock(x, y) {
  const div = document.createElement("div");
  div.className = "block";
  div.style.left = `${x * SIZE}px`;
  div.style.top = `${y * SIZE}px`;

  let state = [2, 0, 1, 0];

  let rot = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
  let step = rot / 90;

  for (let i = 0; i < step; i++) {
    state = rotateState(state);
  }

  div.dataset.state = JSON.stringify(state);
  div.dataset.step = String(step);
  div.dataset.rot = String(rot);

  div.style.transform = `rotate(${rot}deg)`;

  const t1 = document.createElement("div");
  t1.className = "tri1";

  const t2 = document.createElement("div");
  t2.className = "tri2";

  div.appendChild(t1);
  div.appendChild(t2);

  return div;
}

/* ============================================
   2×2 のひし形判定
============================================ */
function check2x2(x, y) {
  if (x < 0 || x >= COLS - 1 || y < 0 || y >= ROWS - 1) return false;

  const A = JSON.parse(grid[y][x].dataset.state);
  const B = JSON.parse(grid[y][x+1].dataset.state);
  const C = JSON.parse(grid[y+1][x].dataset.state);
  const D = JSON.parse(grid[y+1][x+1].dataset.state);

  const a = A[2];
  const b = B[3];
  const c = C[1];
  const d = D[0];

  if (a === 0) return false;

  return (a === b && b === c && c === d);
}

/* ============================================
   盤面全体のマッチ（自動連鎖用）
============================================ */
function findAllMatches() {
  let matched = [];

  for (let y = 0; y < ROWS - 1; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (check2x2(x, y)) {
        matched.push([x, y]);
        matched.push([x+1, y]);
        matched.push([x, y+1]);
        matched.push([x+1, y+1]);
      }
    }
  }

  return [...new Set(matched.map(JSON.stringify))].map(JSON.parse);
}

/* ============================================
   初期化（ひし形ゼロで開始）
============================================ */
function init() {
  for (let y = 0; y < ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < COLS; x++) {
      const block = createBlock(x, y);
      grid[y][x] = block;
      game.appendChild(block);
    }
  }

  for (let loop = 0; loop < 20; loop++) {
    const matches = findAllMatches();
    if (matches.length === 0) break;

    matches.forEach(([x, y]) => {
      const old = grid[y][x];
      if (old) game.removeChild(old);

      const b = createBlock(x, y);
      grid[y][x] = b;
      game.appendChild(b);
    });
  }
}

init();
/* ============================================
   連鎖ゲージの開始
============================================ */
function startComboGauge() {
  if (comboTimer) clearTimeout(comboTimer);

  const time = getComboTime(combo);

  comboGaugeFill.style.transition = "none";
  comboGaugeFill.style.width = "100%";

  setTimeout(() => {
    comboGaugeFill.style.transition = `width ${time}ms linear`;
    comboGaugeFill.style.width = "0%";
  }, 20);

  comboTimer = setTimeout(() => {
    combo = 0;
    comboText.textContent = "";
    comboGaugeFill.style.width = "0%";
  }, time);
}

/* ============================================
   連鎖開始（UI更新＋音）
============================================ */
function startCombo() {
  comboText.textContent = combo + "連";
  startComboGauge();
  playComboSound(combo);
}

/* ============================================
   周囲の2×2だけ判定
============================================ */
function collectMatchesForCell(cx, cy) {
  let matched = [];

  const anchors = [
    [cx - 1, cy - 1],
    [cx,     cy - 1],
    [cx - 1, cy    ],
    [cx,     cy    ]
  ];

  for (const [ax, ay] of anchors) {
    if (!check2x2(ax, ay)) continue;

    matched.push([ax, ay]);
    matched.push([ax+1, ay]);
    matched.push([ax, ay+1]);
    matched.push([ax+1, ay+1]);
  }

  return matched;
}

/* ============================================
   消去 → 落下 → 自動連鎖
============================================ */
function resolveMatches(matched) {
  if (matched.length === 0) return;

  const unique = [...new Set(matched.map(JSON.stringify))].map(JSON.parse);
  if (unique.length === 0) return;

  busy = true;

  // 連鎖更新
  if (comboTimer) combo++;
  else combo = 1;

  startCombo();
  playBreakSound();
  addScore(unique.length);

  unique.forEach(([x, y]) => {
    const b = grid[y][x];
    if (!b) return;

    const angle = b.style.transform.match(/rotate\(([-0-9.]+)deg\)/);
    if (angle) b.style.setProperty("--angle", angle[1] + "deg");

    b.classList.add("crack");
    setTimeout(() => {
      game.removeChild(b);
    }, 250);

    grid[y][x] = null;
  });

  setTimeout(() => {
    dropBlocks();

    setTimeout(() => {
      const autoMatches = findAllMatches();
      if (autoMatches.length > 0) {
        resolveMatches(autoMatches);
      } else {
        busy = false;
      }
    }, 220);
  }, 280);
}

/* ============================================
   トリガー（クリック or 交換後）
============================================ */
function resolveForCells(cells) {
  if (busy) return;
  let matched = [];

  for (const [cx, cy] of cells) {
    matched = matched.concat(collectMatchesForCell(cx, cy));
  }

  resolveMatches(matched);
}

/* ============================================
   落下処理
============================================ */
function dropBlocks() {
  for (let x = 0; x < COLS; x++) {
    let empty = [];

    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y][x] === null) {
        empty.push(y);
      } else if (empty.length > 0) {
        const newY = empty.shift();
        const block = grid[y][x];
        grid[newY][x] = block;
        grid[y][x] = null;
        block.style.top = `${newY * SIZE}px`;
        empty.push(y);
      }
    }

    empty.forEach(y => {
      const b = createBlock(x, y);
      grid[y][x] = b;
      game.appendChild(b);
    });
  }
}
/* ============================================
   入力処理（ドラッグ or タップ回転）
============================================ */

let startX = 0, startY = 0;
let startCellX = 0, startCellY = 0;
let dragging = false;
let moved = false;

function getCell(x, y) {
  const rect = game.getBoundingClientRect();
  const gx = Math.floor((x - rect.left) / SIZE);
  const gy = Math.floor((y - rect.top) / SIZE);
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return { gx: -1, gy: -1 };
  return { gx, gy };
}

function pointerStart(x, y) {
  if (busy) return;

  const c = getCell(x, y);
  if (c.gx === -1) return;

  dragging = true;
  moved = false;
  startX = x;
  startY = y;
  startCellX = c.gx;
  startCellY = c.gy;
}

function pointerMove(x, y) {
  if (!dragging) return;  // busy は無視（ドラッグ中に busy になるケースがある）

  const dx = x - startX;
  const dy = y - startY;

  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    moved = true;
  }
}

function pointerEnd(x, y) {
  if (!dragging) return;
  dragging = false;

  const dx = x - startX;
  const dy = y - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  /* ============================
     スワイプ（入れ替え）
  ============================ */
  if (moved && (absX > 30 || absY > 30)) {
    let tx = startCellX;
    let ty = startCellY;

    if (absX > absY) tx += dx > 0 ? 1 : -1;
    else ty += dy > 0 ? 1 : -1;

    if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) {
      swapBlocks(startCellX, startCellY, tx, ty);
      setTimeout(() => resolveForCells([[startCellX, startCellY], [tx, ty]]), 250);
    }
    return;
  }

  /* ============================
     タップ（回転）
  ============================ */
  if (!moved) {
    const b = grid[startCellY][startCellX];

    // 内部状態を回転
    let state = JSON.parse(b.dataset.state);
    state = rotateState(state);
    b.dataset.state = JSON.stringify(state);

    // step を安全に更新（NaN防止）
    let step = parseInt(b.dataset.step, 10);
    if (isNaN(step)) step = 0;
    step = (step + 1) & 3;
    b.dataset.step = String(step);

    const rot = step * 90;
    b.dataset.rot = String(rot);
    b.style.transform = `rotate(${rot}deg)`;

    setTimeout(() => resolveForCells([[startCellX, startCellY]]), 250);
  }
}

/* ============================================
   PC / スマホ入力
============================================ */

game.addEventListener("mousedown", e => {
  e.preventDefault();
  pointerStart(e.clientX, e.clientY);
});
game.addEventListener("mousemove", e => {
  pointerMove(e.clientX, e.clientY);
});
game.addEventListener("mouseup", e => {
  pointerEnd(e.clientX, e.clientY);
});

// スマホ
game.addEventListener("touchstart", e => {
  const t = e.touches[0];
  pointerStart(t.clientX, t.clientY);
});
game.addEventListener("touchmove", e => {
  const t = e.touches[0];
  pointerMove(t.clientX, t.clientY);
});
game.addEventListener("touchend", e => {
  const t = e.changedTouches[0];
  pointerEnd(t.clientX, t.clientY);
});
