/* PanelBreak game.js（スマホ横幅いっぱい対応・完全版） */

const COLS = 6;
const ROWS = 8;

const BASE_SIZE = 50;   // 元の1パネルサイズ
const BASE_W = 300;     // 元の盤面幅
const BASE_H = 400;     // 元の盤面高さ

let SIZE = BASE_SIZE;   // スケール後のパネルサイズ
let scale = 1;

/* DOM */
const gameWrapper = document.getElementById("game-wrapper");
const game = document.getElementById("game");
const comboText = document.getElementById("combo-text");
const comboGaugeFill = document.getElementById("combo-gauge-fill");
const scoreUI = document.getElementById("score");
const timerUI = document.getElementById("timer");
const gameOverOverlay = document.getElementById("game-over-overlay");
const finalScoreValue = document.getElementById("final-score-value");
const hudTop = document.getElementById("hud-top");
const comboUI = document.getElementById("combo-ui");

/* スマホ用スケール */
function setupScale() {
  const isMobile = window.innerWidth <= 480;

  if (isMobile) {
    scale = window.innerWidth / BASE_W; // 横幅いっぱい
  } else {
    scale = 1; // PC はそのまま
  }

  SIZE = BASE_SIZE * scale;

  // 盤面サイズ
  gameWrapper.style.width = `${BASE_W * scale}px`;
  gameWrapper.style.height = `${BASE_H * scale}px`;
  game.style.width = `${BASE_W * scale}px`;
  game.style.height = `${BASE_H * scale}px`;

  // HUD の位置もスケール
  hudTop.style.top = `${0 * scale}px`;
  comboUI.style.top = `${40 * scale}px`;
}
let mode = "none";

function startGame(selectedMode) {
  mode = selectedMode;

  // タイトル画面を消す
  document.getElementById("title-screen").style.display = "none";

  // スケール適用
  setupScale();

  // ゲーム初期化
  init();

  // HUD の位置
  hudTop.style.top = `${0 * scale}px`;
  comboUI.style.top = `${40 * scale}px`;

  // タイムアタック
  if (mode === "timeattack") {
    timeLeft = 60;
    startGameTimer();
  }

  // エンドレス
  if (mode === "endless") {
    timeLeft = Infinity;
    timerUI.textContent = "∞";
  }
}
/* 既存パネルの再スケール（これがズレ解消の決定打） */
function rescaleAllBlocks() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const b = grid[y][x];
      if (!b) continue;

      b.style.width = `${SIZE}px`;
      b.style.height = `${SIZE}px`;
      b.style.left = `${x * SIZE}px`;
      b.style.top  = `${y * SIZE}px`;

      const t1 = b.querySelector(".tri1");
      const t2 = b.querySelector(".tri2");

      if (t1) {
        t1.style.borderTop = `${SIZE}px solid #0a3d62`;
        t1.style.borderRight = `${SIZE}px solid transparent`;
      }
      if (t2) {
        t2.style.borderBottom = `${SIZE}px solid #60a3bc`;
        t2.style.borderLeft = `${SIZE}px solid transparent`;
      }
    }
  }
}

/* スケール適用 → 初期化 → 再スケール */
// setupScale();

/* ゲーム状態 */
let grid = [];
let busy = false;

let combo = 0;
let comboTimer = null;
let score = 0;

/* 制限時間（秒） */
const GAME_TIME = 60;
let timeLeft = GAME_TIME;
let timerId = null;
let gameEnded = false;

/* 連鎖ゲージ時間 */
function getComboTime(n) {
  if (n <= 1) return 4500;
  if (n === 2) return 3600;
  if (n === 3) return 2800;
  if (n === 4) return 2200;
  if (n === 5) return 1700;
  if (n === 6) return 1400;
  return 1200;
}

/* WebAudio */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/* ガラス割れ音 */
function playBreakSound() {
  if (gameEnded) return;
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

/* 連鎖音 */
function playComboSound(n) {
  if (gameEnded) return;
  const freqs = [261.63,293.66,329.63,349.23,392.00,440.00,493.88,523.25];
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

/* スコア */
function addScore(panels) {
  score += panels * 10 * combo;
  scoreUI.textContent = score;
}

/* 内部状態回転 */
function rotateState(s) {
  return [s[3], s[0], s[1], s[2]];
}

/* パネル生成 */
function createBlock(x, y) {
  const div = document.createElement("div");
  div.className = "block";

  div.style.left = `${x * SIZE}px`;
  div.style.top = `${y * SIZE}px`;
  div.style.width = `${SIZE}px`;
  div.style.height = `${SIZE}px`;

  let state = [2, 0, 1, 0];
  let rot = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
  let step = rot / 90;
  for (let i = 0; i < step; i++) state = rotateState(state);

  div.dataset.state = JSON.stringify(state);
  div.dataset.step = String(step);
  div.dataset.rot = String(rot);
  div.style.transform = `rotate(${rot}deg)`;

  const t1 = document.createElement("div");
  t1.className = "tri1";
  t1.style.borderTop = `${SIZE}px solid #0a3d62`;
  t1.style.borderRight = `${SIZE}px solid transparent`;

  const t2 = document.createElement("div");
  t2.className = "tri2";
  t2.style.borderBottom = `${SIZE}px solid #60a3bc`;
  t2.style.borderLeft = `${SIZE}px solid transparent`;

  div.appendChild(t1);
  div.appendChild(t2);

  return div;
}

/* 2×2 ひし形判定 */
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

/* 全体マッチ探索 */
function findAllMatches() {
  let matched = [];
  for (let y = 0; y < ROWS - 1; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (check2x2(x, y)) {
        matched.push([x, y],[x+1,y],[x,y+1],[x+1,y+1]);
      }
    }
  }
  return [...new Set(matched.map(JSON.stringify))].map(JSON.parse);
}

/* 初期化（ひし形ゼロで開始） */
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

/* タイマー更新 */
function updateTimer() {
  if (gameEnded) return;
  timeLeft -= 0.1;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame();
    gameOverOverlay.addEventListener("click", () => {
      if (!gameEnded) return;
      location.reload();
    });
  }
  timerUI.textContent = timeLeft.toFixed(1);
}

/* ゲーム開始時にタイマー起動 */
function startGameTimer() {
  timerUI.textContent = timeLeft.toFixed(1);
  timerId = setInterval(updateTimer, 100);
}

/* ゲーム終了処理 */
function endGame() {
  if (gameEnded) return;
  gameEnded = true;
  busy = true;
  if (comboTimer) clearTimeout(comboTimer);
  if (timerId) clearInterval(timerId);
  comboText.textContent = "";
  comboGaugeFill.style.width = "0%";
  finalScoreValue.textContent = score;
  gameOverOverlay.classList.add("show");
}

// init();
// ★ HUD の位置を再スケール（これが見えない原因の本命）
// hudTop.style.top = `${0 * scale}px`;
// comboUI.style.top = `${40 * scale}px`;


// startGameTimer();

/* 連鎖ゲージ開始 */
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

/* 連鎖開始 */
function startCombo() {
  comboText.textContent = combo + "連";
  startComboGauge();
  playComboSound(combo);
}

/* 周囲の2×2だけ判定 */
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
    matched.push([ax, ay],[ax+1,ay],[ax,ay+1],[ax+1,ay+1]);
  }
  return matched;
}

/* 消去 → 落下 → 自動連鎖 */
function resolveMatches(matched) {
  if (matched.length === 0 || gameEnded) return;
  const unique = [...new Set(matched.map(JSON.stringify))].map(JSON.parse);
  if (unique.length === 0) return;

  busy = true;

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
      if (b.parentNode === game) game.removeChild(b);
    }, 250);
    grid[y][x] = null;
  });

  setTimeout(() => {
    dropBlocks();
    setTimeout(() => {
      const autoMatches = findAllMatches();
      if (autoMatches.length > 0 && !gameEnded) {
        resolveMatches(autoMatches);
      } else {
        busy = false;
      }
    }, 220);
  }, 280);
}

/* トリガー（クリック or 交換後） */
function resolveForCells(cells) {
  if (busy || gameEnded) return;
  let matched = [];
  for (const [cx, cy] of cells) {
    matched = matched.concat(collectMatchesForCell(cx, cy));
  }
  resolveMatches(matched);
}

/* 落下処理 */
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

/* パネル入れ替え */
function swapBlocks(x1, y1, x2, y2) {
  const b1 = grid[y1][x1];
  const b2 = grid[y2][x2];
  if (!b1 || !b2) return;

  grid[y1][x1] = b2;
  grid[y2][x2] = b1;

  b1.style.left = `${x2 * SIZE}px`;
  b1.style.top  = `${y2 * SIZE}px`;
  b2.style.left = `${x1 * SIZE}px`;
  b2.style.top  = `${y1 * SIZE}px`;
}





/* 入力処理（ドラッグ or タップ回転） */

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
  if (busy || gameEnded) return;
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
  if (!dragging) return;
  const dx = x - startX;
  const dy = y - startY;
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;
}

function pointerEnd(x, y) {
  if (!dragging || gameEnded || busy) return;  // ★ busy を追加
  dragging = false;

  const dx = x - startX;
  const dy = y - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  /* スワイプ（入れ替え） */
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

  /* タップ（回転） */
/* タップ（回転） */
if (!moved) {
  const b = grid[startCellY][startCellX];
  let state = JSON.parse(b.dataset.state);
  state = rotateState(state);
  b.dataset.state = JSON.stringify(state);

  let step = parseInt(b.dataset.step, 10);
  if (isNaN(step)) step = 0;
  step = (step + 1) & 3;
  b.dataset.step = String(step);

  let rot = parseInt(b.dataset.rot, 10) || 0;
  rot += 90;
  b.dataset.rot = rot;
  b.style.transform = `rotate(${rot}deg)`;

  // ★ busy が false になるまで待ってから resolveForCells を実行
  const waitResolve = () => {
    if (busy) {
      requestAnimationFrame(waitResolve);
    } else {
      resolveForCells([[startCellX, startCellY]]);
    }
  };
  waitResolve();
}
}

/* PC入力 */
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

/* スマホ入力 */
game.addEventListener("touchstart", e => {
  e.preventDefault();
  const t = e.touches[0];
  pointerStart(t.clientX, t.clientY);
}, { passive: false });

game.addEventListener("touchmove", e => {
  e.preventDefault();
  const t = e.touches[0];
  pointerMove(t.clientX, t.clientY);
}, { passive: false });

game.addEventListener("touchend", e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  pointerEnd(t.clientX, t.clientY);
}, { passive: false });

document.getElementById("retry-button").onclick = () => {
  gameOverOverlay.classList.remove("show");
  startGame(mode);
};

document.getElementById("back-to-title").onclick = () => {
  gameOverOverlay.classList.remove("show");

  // 盤面をクリア
  while (game.firstChild) {
    game.removeChild(game.firstChild);
  }

  // タイトル画面を再表示
  document.getElementById("title-screen").style.display = "flex";

  // 状態リセット
  score = 0;
  combo = 0;
  busy = false;
  gameEnded = false;
  timerUI.textContent = "0.0";
};