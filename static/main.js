// 主入口 - 整合所有模块、初始化游戏
import { GameEngine, CANDY_TYPES, SPECIAL_TYPES, OBSTACLE_TYPES, BOARD_SIZE, getBoardSizeForLevel } from './engine.js';
import { GameRenderer } from './renderer.js';
import { LEVEL_DATA, ACHIEVEMENTS, TITLES, getCurrentTitle } from './levels.js';
import { PlayerManager } from './player.js';
import { AudioManager } from './audio.js';

// ===== 全局实例 =====
const engine = new GameEngine();
const player = new PlayerManager();
const audio = new AudioManager();
let renderer = null;
let currentLevelId = 1;
let gameState = 'idle'; // idle, playing, animating, paused, win, lose
let lastTime = 0;
let animationFrameId = null;
let selectedCell = null;
let isDragging = false;
let dragStart = null;
let currentCombo = 0;
let usedSweetStorm = false;
let usedRainbowCount = 0;
let usedSpecialCount = 0;
let hintRemaining = 3; // 每局3次提示机会
let hintHighlightCells = []; // 当前高亮的提示格子
let hintAnimTimer = null;

// 角色形象配置
const CHARACTER_AVATARS = {
    boy: {
        name: '萌萌',
        img: 'https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/9a885a25-6489-4caa-9e63-c1f37c39dbaa/image_1775546832_1_1.jpg',
        emoji: '👨‍🍳'
    },
    girl: {
        name: '甜甜',
        img: 'https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/faa7388a-f02e-4d49-953d-0be10af394b6/image_1775546859_2_1.jpg',
        emoji: '👩‍🍳'
    }
};
let selectedCharacter = 'boy'; // 默认选择男孩

// ===== 画面管理 =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ===== 加载画面 =====
async function showLoading() {
    showScreen('loading-screen');
    const bar = document.getElementById('loading-bar');
    const text = document.getElementById('loading-text');

    const steps = [
        { progress: 20, text: '正在烘焙甜品...' },
        { progress: 40, text: '正在装饰蛋糕...' },
        { progress: 60, text: '正在调配奶油...' },
        { progress: 80, text: '正在撒上糖霜...' },
        { progress: 100, text: '甜蜜世界准备就绪！' },
    ];

    for (const step of steps) {
        bar.style.width = step.progress + '%';
        text.textContent = step.text;
        await sleep(400);
    }

    await sleep(300);

    // 加载玩家数据
    const hasData = player.load();
    if (hasData && player.data.name) {
        player.serverSyncEnabled = true; // 自动启用服务器同步
        try { await player.loadFromServer(); } catch(e) {}
        updateMenuUI();
        showScreen('menu-screen');
        initMenuBackground();
    } else {
        showScreen('login-screen');
        initLoginBackground();
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 登录背景动画 =====
function initLoginBackground() {
    const canvas = document.getElementById('login-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const bubbles = [];
    const emojis = ['🍰', '🍮', '🍩', '🧁', '🍦', '🍫', '🍬', '🍭', '🎂', '🍪', '⭐', '✨'];
    for (let i = 0; i < 20; i++) {
        bubbles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: 16 + Math.random() * 24,
            speed: 0.3 + Math.random() * 0.5,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.01 + Math.random() * 0.02,
            alpha: 0.3 + Math.random() * 0.4,
        });
    }

    function animate() {
        if (!document.getElementById('login-screen')?.classList.contains('active')) return;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        bubbles.forEach(b => {
            b.y -= b.speed;
            b.wobble += b.wobbleSpeed;
            b.x += Math.sin(b.wobble) * 0.5;
            if (b.y < -50) {
                b.y = window.innerHeight + 50;
                b.x = Math.random() * window.innerWidth;
            }
            ctx.save();
            ctx.globalAlpha = b.alpha;
            ctx.font = `${b.size}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(b.emoji, b.x, b.y);
            ctx.restore();
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// ===== 菜单背景动画 =====
function initMenuBackground() {
    const canvas = document.getElementById('menu-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const stars = [];
    for (let i = 0; i < 50; i++) {
        stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: 1 + Math.random() * 3,
            speed: 0.2 + Math.random() * 0.3,
            twinkle: Math.random() * Math.PI * 2,
        });
    }

    function animate() {
        if (!document.getElementById('menu-screen')?.classList.contains('active')) return;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        stars.forEach(s => {
            s.twinkle += 0.03;
            const alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// ===== 更新菜单UI =====
function updateMenuUI() {
    const d = player.data;
    document.getElementById('menu-player-name').textContent = d.name || '甜点师';
    document.getElementById('menu-player-level').textContent = `Lv.${d.level} ${player.getTitle().name}`;
    document.getElementById('menu-coins').textContent = d.coins;

    // 使用角色形象图片
    const charKey = d.character || selectedCharacter || 'boy';
    const charInfo = CHARACTER_AVATARS[charKey] || CHARACTER_AVATARS.boy;
    const avatar = document.getElementById('menu-avatar');
    avatar.innerHTML = `<img src="${charInfo.img}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${charInfo.emoji}'">`;

    // 更新角色按钮图标为角色图片
    const charIcon = document.getElementById('menu-char-icon');
    if (charIcon) {
        charIcon.innerHTML = `<img src="${charInfo.img}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${charInfo.emoji}'">`;
    }
}

// ===== 关卡地图 =====
function renderLevelMap() {
    const map = document.getElementById('level-map');
    map.innerHTML = '';

    let totalStars = 0;

    // 赛区定义
    const zones = [
        { name: '🌸 新手入门', range: [1, 3] },
        { name: '🔥 中级挑战', range: [4, 9] },
        { name: '⚡ 高级挑战', range: [10, 15] },
        { name: '🧊 障碍挑战', range: [16, 22] },
        { name: '👑 极限挑战', range: [23, 30] },
    ];

    let currentZoneIdx = 0;

    LEVEL_DATA.forEach((level, idx) => {
        // 检查是否需要插入赛区标题
        if (currentZoneIdx < zones.length && level.id === zones[currentZoneIdx].range[0]) {
            const zoneTitle = document.createElement('div');
            zoneTitle.className = 'zone-title';
            zoneTitle.textContent = zones[currentZoneIdx].name;
            map.appendChild(zoneTitle);
            currentZoneIdx++;
        }

        const cleared = player.data.levelsCleared[String(level.id)];
        const prevCleared = idx === 0 || player.data.levelsCleared[String(LEVEL_DATA[idx - 1].id)]?.cleared;
        const isUnlocked = idx === 0 || prevCleared;
        const stars = cleared?.stars || 0;
        totalStars += stars;

        const node = document.createElement('div');
        node.className = `level-node ${cleared?.cleared ? 'cleared' : isUnlocked ? 'unlocked' : 'locked'} ${level.isBoss ? 'boss' : ''} ${level.obstacles ? 'has-obstacle' : ''}`;

        if (isUnlocked) {
            const obstacleIcons = level.obstacles ? 
                (level.obstacles.ice ? '🧊' : '') + (level.obstacles.stone ? '🪨' : '') : '';
            node.innerHTML = `
                <div class="level-num">${level.isBoss ? '👑' : level.id}</div>
                ${obstacleIcons ? `<div class="level-obstacle-icon">${obstacleIcons}</div>` : ''}
                <div class="level-stars">
                    ${[1, 2, 3].map(s => `<span class="level-star ${s <= stars ? 'earned' : ''}">⭐</span>`).join('')}
                </div>
            `;
            node.addEventListener('click', () => {
                audio.playClick();
                startLevel(level.id);
            });
        } else {
            node.innerHTML = `<div class="level-lock-icon">🔒</div>`;
        }

        map.appendChild(node);
    });

    document.getElementById('total-stars').textContent = totalStars;
}

// ===== 开始关卡 =====
function startLevel(levelId) {
    currentLevelId = levelId;
    const levelConfig = LEVEL_DATA.find(l => l.id === levelId);
    if (!levelConfig) return;

    // 根据关卡设置棋盘大小
    const boardSize = getBoardSizeForLevel(levelId);
    engine.size = boardSize;

    // 初始化引擎
    engine.initBoard(levelConfig);

    // 重置状态
    gameState = 'playing';
    selectedCell = null;
    currentCombo = 0;
    usedSweetStorm = false;
    usedRainbowCount = 0;
    usedSpecialCount = 0;
    hintRemaining = 3;
    hintHighlightCells = [];
    if (hintAnimTimer) { clearTimeout(hintAnimTimer); hintAnimTimer = null; }

    // 更新HUD
    document.getElementById('hud-level').textContent = `关卡 ${levelId}`;
    document.getElementById('hud-score').textContent = '0';
    document.getElementById('hud-moves').textContent = engine.moves;
    document.getElementById('target-score').textContent = levelConfig.targetScore;
    updateStarProgress(0, levelConfig);
    updateToolCounts();

    // 显示游戏画面
    showScreen('game-screen');
    hideAllModals();

    // 初始化渲染器
    initGameCanvas();

    // 启动游戏循环
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    lastTime = performance.now();
    gameLoop(lastTime);
}

// ===== 初始化游戏Canvas =====
function initGameCanvas() {
    const canvas = document.getElementById('game-canvas');
    const wrapper = document.querySelector('.game-board-wrapper');

    renderer = new GameRenderer(canvas);
    renderer.setBoardSize(engine.size);

    function resizeCanvas() {
        const rect = wrapper.getBoundingClientRect();
        renderer.resize(rect.width, rect.height);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 触摸/鼠标事件
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
}

// ===== 输入处理 =====
function getCanvasPos(e) {
    const rect = renderer.canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

let lastClickTime = 0;
let lastClickCell = null;

function onPointerDown(e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const cell = renderer.pixelToCell(pos.x, pos.y);
    if (!cell) return;

    audio.init();
    audio.resume();

    const boardCell = engine.getCell(cell.row, cell.col);
    if (!boardCell || (boardCell.type < 0 && boardCell.type !== -2)) return;
    // 不可点击石头和冰块
    if (boardCell.obstacle === OBSTACLE_TYPES.STONE || boardCell.obstacle === OBSTACLE_TYPES.ICE) return;

    const now = Date.now();
    const isDoubleClick = lastClickCell && lastClickCell.row === cell.row && lastClickCell.col === cell.col && (now - lastClickTime) < 400;

    // 双击特殊元素 -> 直接触发效果
    if (isDoubleClick && boardCell.special !== SPECIAL_TYPES.NONE) {
        lastClickCell = null;
        lastClickTime = 0;
        selectedCell = null;
        renderer.selectedCell = null;
        activateSpecialByClick(cell.row, cell.col);
        return;
    }

    lastClickTime = now;
    lastClickCell = { row: cell.row, col: cell.col };

    if (selectedCell) {
        if (selectedCell.row === cell.row && selectedCell.col === cell.col) {
            // 点击同一个格子（非双击），取消选中
            // 双击已在上面处理
            return;
        }
        // 点击了不同的格子
        if (engine.isAdjacent(selectedCell.row, selectedCell.col, cell.row, cell.col)) {
            // 相邻格子 -> 尝试交换（包括两个特殊元素交换触发组合技）
            attemptSwap(selectedCell.row, selectedCell.col, cell.row, cell.col);
            selectedCell = null;
            renderer.selectedCell = null;
        } else {
            // 非相邻格子 -> 重新选中
            selectedCell = cell;
            renderer.selectedCell = cell;
            audio.playClick();
        }
    } else {
        // 没有已选中的格子 -> 选中当前格子
        selectedCell = cell;
        renderer.selectedCell = cell;
        dragStart = pos;
        isDragging = true;
        audio.playClick();
    }
}

function onPointerMove(e) {
    if (!isDragging || gameState !== 'playing' || !selectedCell) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const threshold = renderer.cellSize * 0.3;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        let targetRow = selectedCell.row;
        let targetCol = selectedCell.col;

        if (Math.abs(dx) > Math.abs(dy)) {
            targetCol += dx > 0 ? 1 : -1;
        } else {
            targetRow += dy > 0 ? 1 : -1;
        }

        if (targetRow >= 0 && targetRow < engine.size && targetCol >= 0 && targetCol < engine.size) {
            attemptSwap(selectedCell.row, selectedCell.col, targetRow, targetCol);
        }

        selectedCell = null;
        renderer.selectedCell = null;
        isDragging = false;
    }
}

function onPointerUp(e) {
    isDragging = false;
}

// ===== 尝试交换 =====
async function attemptSwap(r1, c1, r2, c2) {
    if (gameState !== 'playing') return;
    gameState = 'animating';

    // 清除提示高亮
    clearHintHighlight();

    audio.playSwap();

    const result = engine.trySwap(r1, c1, r2, c2);

    if (!result) {
        // 无效交换 - 播放动画后换回
        audio.playInvalidSwap();
        await animateSwap(r1, c1, r2, c2, 150);
        await animateSwap(r2, c2, r1, c1, 150);
        gameState = 'playing';
        return;
    }

    // 消耗步数
    engine.moves--;
    document.getElementById('hud-moves').textContent = engine.moves;

    // 执行交换动画
    await animateSwap(r1, c1, r2, c2, 150);

    if (result.type === 'combo') {
        // 组合技 - 显示终极一击过场动画
        usedSweetStorm = true;
        const cw = renderer.canvas.width / (window.devicePixelRatio || 1);
        const ch = renderer.canvas.height / (window.devicePixelRatio || 1);
        renderer.showUltimateEffect(cw, ch);
        audio.playSweetStorm();
        renderer.spawnSweetStormParticles();
        renderer.shake(10);
        await sleep(800); // 等待过场动画展示

        const removed = engine.executeCombo(result.combo, result.cells[0], result.cells[1], result.positions);
        const score = removed.length * 30;
        engine.score += score;
        await animateRemoval(removed);
        engine.clearCells(removed);

        const falls = engine.applyGravity();
        await animateFall(falls);
        await processCascade();

    } else if (result.type === 'rainbow') {
        // 万能味觉精灵
        usedRainbowCount++;
        audio.playRainbow();
        const removed = engine.executeRainbow(result.rainbow, result.target);
        const score = removed.length * 20;
        engine.score += score;
        await animateRemoval(removed);
        engine.clearCells(removed);

        const falls = engine.applyGravity();
        await animateFall(falls);
        await processCascade();

    } else {
        // 普通匹配
        currentCombo = 0;
        await processMatches(result.matches, { row: r2, col: c2 });
    }

    // 更新UI
    updateHUD();

    // 检查游戏状态
    const state = engine.checkGameState();
    if (state === 'win') {
        gameState = 'win';
        await sleep(500);
        showWinScreen();
    } else if (state === 'lose') {
        gameState = 'lose';
        await sleep(500);
        showLoseScreen();
    } else {
        // 检查是否有可用移动
        if (!engine.hasValidMoves()) {
            engine.shuffle();
            renderer.addFloatingText('🔀 自动洗牌！', renderer.canvas.width / (window.devicePixelRatio || 1) / 2, renderer.canvas.height / (window.devicePixelRatio || 1) / 2, '#ffd700', 24);
        }
        gameState = 'playing';
    }
}

// ===== 处理匹配消除 =====
async function processMatches(matches, swapPos) {
    currentCombo++;
    if (currentCombo > engine.maxCombo) engine.maxCombo = currentCombo;
    if (currentCombo > player.data.maxCombo) player.data.maxCombo = currentCombo;

    // 确定特殊元素
    const specials = engine.determineSpecials(matches, swapPos);

    // 播放音效
    audio.playMatch(currentCombo);
    if (currentCombo >= 2) {
        renderer.showCombo(currentCombo);
    }

    // 执行消除
    const removed = engine.executeMatches(matches);
    const score = engine.calculateScore(removed, currentCombo);
    engine.score += score;

    // 显示分数浮动文字
    if (removed.length > 0) {
        const avgX = removed.reduce((s, c) => s + renderer.getCellPos(c.row, c.col).x, 0) / removed.length;
        const avgY = removed.reduce((s, c) => s + renderer.getCellPos(c.row, c.col).y, 0) / removed.length;
        renderer.addFloatingText(`+${score}`, avgX, avgY, '#ffd700', 22);
    }

    // 消除动画
    await animateRemoval(removed);

    // 破冰粒子效果
    if (removed.iceBroken && removed.iceBroken.length > 0) {
        for (const ice of removed.iceBroken) {
            renderer.spawnRemoveParticles(ice.row, ice.col, '#64b5f6', 8);
            renderer.addFloatingText('🧊', renderer.getCellPos(ice.row, ice.col).x, renderer.getCellPos(ice.row, ice.col).y, '#29b6f6', 16);
        }
    }

    // 清除格子
    engine.clearCells(removed);

    // 放置特殊元素
    if (specials.length > 0) {
        engine.placeSpecials(specials);
        audio.playSpecialCreate();
        for (const sp of specials) {
            renderer.spawnSpecialParticles(sp.row, sp.col, 'special');
        }
    }

    // 下落填充
    const falls = engine.applyGravity();
    await animateFall(falls);

    // 连锁消除
    await processCascade();
}

// ===== 连锁消除 =====
async function processCascade() {
    let cascadeMatches = engine.findAllMatches();
    while (cascadeMatches.length > 0) {
        currentCombo++;
        if (currentCombo > engine.maxCombo) engine.maxCombo = currentCombo;

        audio.playMatch(currentCombo);
        if (currentCombo >= 2) renderer.showCombo(currentCombo);

        const specials = engine.determineSpecials(cascadeMatches);
        const removed = engine.executeMatches(cascadeMatches);
        const score = engine.calculateScore(removed, currentCombo);
        engine.score += score;

        if (removed.length > 0) {
            const avgX = removed.reduce((s, c) => s + renderer.getCellPos(c.row, c.col).x, 0) / removed.length;
            const avgY = removed.reduce((s, c) => s + renderer.getCellPos(c.row, c.col).y, 0) / removed.length;
            renderer.addFloatingText(`+${score}`, avgX, avgY, '#ff69b4', 20);
        }

        await animateRemoval(removed);
        engine.clearCells(removed);

        // 破冰粒子效果
        if (removed.iceBroken && removed.iceBroken.length > 0) {
            for (const ice of removed.iceBroken) {
                renderer.spawnRemoveParticles(ice.row, ice.col, '#64b5f6', 8);
            }
        }

        if (specials.length > 0) {
            engine.placeSpecials(specials);
            audio.playSpecialCreate();
        }

        const falls = engine.applyGravity();
        await animateFall(falls);

        updateHUD();
        cascadeMatches = engine.findAllMatches();
    }
}

// ===== 动画函数 =====
function animateSwap(r1, c1, r2, c2, duration) {
    return new Promise(resolve => {
        const cell1 = engine.board[r1][c1];
        const cell2 = engine.board[r2][c2];
        const pos1 = renderer.getCellPos(r1, c1);
        const pos2 = renderer.getCellPos(r2, c2);
        const startTime = performance.now();

        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            cell1.animX = pos1.x + (pos2.x - pos1.x) * ease;
            cell1.animY = pos1.y + (pos2.y - pos1.y) * ease;
            cell2.animX = pos2.x + (pos1.x - pos2.x) * ease;
            cell2.animY = pos2.y + (pos1.y - pos2.y) * ease;

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                delete cell1.animX; delete cell1.animY;
                delete cell2.animX; delete cell2.animY;
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

function animateRemoval(removed) {
    return new Promise(resolve => {
        if (removed.length === 0) { resolve(); return; }

        const duration = 250;
        const startTime = performance.now();

        // 生成粒子（包括被动消除的特殊元素也播放特效）
        removed.forEach(cell => {
            const color = CANDY_TYPES[cell.type]?.color || '#ffd700';
            renderer.spawnRemoveParticles(cell.row, cell.col, color, 6);

            if (cell.special === SPECIAL_TYPES.LINE_H || cell.special === SPECIAL_TYPES.LINE_V) {
                audio.playLineBlast();
                renderer.spawnSpecialParticles(cell.row, cell.col, 'line');
                renderer.shake(3);
            } else if (cell.special === SPECIAL_TYPES.BOMB) {
                audio.playBombBlast();
                renderer.spawnSpecialParticles(cell.row, cell.col, 'bomb');
                renderer.shake(5);
            } else if (cell.special === SPECIAL_TYPES.RAINBOW) {
                audio.playRainbow();
                renderer.spawnSpecialParticles(cell.row, cell.col, 'sweet_storm');
                renderer.shake(4);
            }
        });

        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            removed.forEach(cell => {
                const boardCell = engine.board[cell.row]?.[cell.col];
                if (boardCell) {
                    boardCell.scale = 1 - t;
                    boardCell.alpha = 1 - t;
                }
            });

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

function animateFall(falls) {
    return new Promise(resolve => {
        if (falls.length === 0) { resolve(); return; }

        const duration = 300;
        const startTime = performance.now();

        falls.forEach(f => {
            const startPos = renderer.getCellPos(f.fromRow, f.fromCol);
            const endPos = renderer.getCellPos(f.toRow, f.toCol);
            f.startX = startPos.x;
            f.startY = startPos.y;
            f.endX = endPos.x;
            f.endY = endPos.y;
        });

        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            // 弹性缓动
            const ease = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;

            falls.forEach(f => {
                if (f.cell && engine.board[f.toRow]?.[f.toCol]) {
                    const cell = engine.board[f.toRow][f.toCol];
                    cell.animX = f.startX + (f.endX - f.startX) * ease;
                    cell.animY = f.startY + (f.endY - f.startY) * ease;
                    cell.scale = 1;
                    cell.alpha = 1;
                }
            });

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                falls.forEach(f => {
                    const cell = engine.board[f.toRow]?.[f.toCol];
                    if (cell) {
                        delete cell.animX;
                        delete cell.animY;
                        cell.isNew = false;
                    }
                });
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

// ===== 更新HUD =====
function updateHUD() {
    document.getElementById('hud-score').textContent = engine.score;
    document.getElementById('hud-moves').textContent = engine.moves;

    const levelConfig = LEVEL_DATA.find(l => l.id === currentLevelId);
    if (levelConfig) {
        updateStarProgress(engine.score, levelConfig);
    }
}

function updateStarProgress(score, levelConfig) {
    const maxStar = levelConfig.stars[2];
    const progress = Math.min(100, (score / maxStar) * 100);
    document.getElementById('star-progress').style.width = progress + '%';

    document.querySelectorAll('.star-marker').forEach(marker => {
        const starNum = parseInt(marker.dataset.star);
        const threshold = levelConfig.stars[starNum - 1];
        marker.classList.toggle('active', score >= threshold);
    });
}

function updateToolCounts() {
    document.querySelector('#tool-shuffle .tool-count').textContent = player.data.tools.shuffle;
    document.getElementById('hint-count').textContent = hintRemaining;
}

// ===== 胜利/失败画面 =====
function showWinScreen() {
    audio.playWin();
    const stars = engine.calculateStars();
    const levelConfig = LEVEL_DATA.find(l => l.id === currentLevelId);

    // 更新玩家数据
    const rewards = player.updateLevelResult(currentLevelId, engine.score, stars);

    // 检查成就
    const newAchievements = player.checkAchievements({
        combo: engine.maxCombo,
        sweetStorm: usedSweetStorm,
        score: engine.score,
        movesLeft: engine.moves,
    });

    // 强制同步到服务器（确保排行榜更新）
    player.serverSyncEnabled = true;
    player.syncToServer();

    // 更新弹窗
    document.getElementById('win-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('win-score-value').textContent = engine.score;
    document.getElementById('win-coins').textContent = rewards.coinGain;
    document.getElementById('win-star-count').textContent = stars;

    showModal('win-modal');

    // 显示新成就
    if (newAchievements.length > 0) {
        audio.playAchievement();
        newAchievements.forEach(id => {
            const ach = ACHIEVEMENTS.find(a => a.id === id);
            if (ach) {
                setTimeout(() => {
                    showAchievementToast(ach);
                }, 1000);
            }
        });
    }
}

function showLoseScreen() {
    audio.playLose();
    document.getElementById('lose-score-value').textContent = engine.score;
    showModal('lose-modal');
}

function showAchievementToast(achievement) {
    // 播放成就音效
    audio.playAchievement();

    // 创建全屏闪光效果
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%);
        z-index: 199; pointer-events: none;
        animation: achievementFlash 1s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1000);

    // 创建成就弹出卡片
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #ffd700, #ff9800, #ff6b9d); color: white;
        padding: 16px 28px; border-radius: 20px; font-weight: 700; font-size: 15px;
        box-shadow: 0 8px 32px rgba(255,152,0,0.5), 0 0 60px rgba(255,215,0,0.3);
        z-index: 200;
        animation: achievementSlideDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), achievementFadeOut 0.5s ease 2.5s forwards;
        display: flex; align-items: center; gap: 12px;
        border: 2px solid rgba(255,255,255,0.4);
    `;
    toast.innerHTML = `
        <span style="font-size:32px;animation:achievementBounce 0.6s ease 0.3s">${achievement.icon}</span>
        <div>
            <div style="font-size:12px;opacity:0.9;margin-bottom:2px">🎉 成就解锁！</div>
            <div style="font-size:16px;font-weight:800">${achievement.name}</div>
            <div style="font-size:11px;opacity:0.8;margin-top:2px">🪙 +${achievement.reward}</div>
        </div>
    `;
    document.body.appendChild(toast);

    // 生成星星粒子
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            const x = 50 + (Math.random() - 0.5) * 30;
            const y = 80 + Math.random() * 40;
            star.style.cssText = `
                position: fixed; top: ${y}px; left: ${x}%; z-index: 201;
                font-size: ${14 + Math.random() * 12}px; pointer-events: none;
                animation: achievementStar 1s ease-out forwards;
                --tx: ${(Math.random() - 0.5) * 100}px;
                --ty: ${-50 - Math.random() * 80}px;
            `;
            star.textContent = ['✨', '⭐', '🌟', '💫'][Math.floor(Math.random() * 4)];
            document.body.appendChild(star);
            setTimeout(() => star.remove(), 1000);
        }, i * 50);
    }

    setTimeout(() => toast.remove(), 3500);
}

// ===== 游戏循环 =====
function gameLoop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (renderer && engine.board.length > 0) {
        renderer.render(engine.board, dt);
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// ===== 排行榜 =====
async function showRankings(tab = 'score') {
    showModal('ranking-modal');
    const list = document.getElementById('ranking-list');
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">加载中...</div>';

    const rankings = await player.getRankings(tab);
    list.innerHTML = '';

    if (rankings.length === 0 || (rankings.length === 1 && rankings[0].name === '暂无数据')) {
        list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;"><div style="font-size:48px;margin-bottom:12px;">🏆</div><div style="font-size:14px;">暂无排行数据<br>快去挑战关卡，成为第一名吧！</div></div>';
        return;
    }

    rankings.forEach((r, i) => {
        const item = document.createElement('div');
        const topClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
        const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : r.rank;
        const highlight = r.isPlayer ? 'border: 2px solid #ff69b4;' : '';

        item.className = `ranking-item ${topClass}`;
        item.style.cssText = highlight;
        item.innerHTML = `
            <div class="ranking-rank">${rankEmoji}</div>
            <div class="ranking-avatar">${r.avatar || '🧑‍🍳'}</div>
            <div class="ranking-name">${r.name}${r.isPlayer ? ' (我)' : ''}</div>
            <div class="ranking-value">${r.value.toLocaleString()}</div>
        `;
        list.appendChild(item);
    });
}

// ===== 角色面板 =====
function showCharacterPanel() {
    showModal('character-modal');
    const d = player.data;
    document.getElementById('char-name-input').value = d.name;
    document.getElementById('char-level').textContent = d.level;
    document.getElementById('char-exp').textContent = `${d.exp}/${d.level * 100}`;
    document.getElementById('char-coins').textContent = d.coins;
    document.getElementById('char-cleared').textContent = player.getClearedCount();
    document.getElementById('char-stars').textContent = player.getTotalStars();
    document.getElementById('char-combo').textContent = d.maxCombo;

    // 更新角色头像
    const charKey = d.character || selectedCharacter || 'boy';
    const charInfo = CHARACTER_AVATARS[charKey] || CHARACTER_AVATARS.boy;
    const avatarImg = document.getElementById('char-avatar-img');
    if (avatarImg) avatarImg.src = charInfo.img;

    // 更新角色切换按钮状态
    document.querySelectorAll('.character-option-mini').forEach(el => {
        el.classList.toggle('active', el.dataset.char === charKey);
    });

    // 称号列表
    const titlesList = document.getElementById('titles-list');
    titlesList.innerHTML = '';
    TITLES.forEach(t => {
        const isEarned = d.level >= t.level;
        const badge = document.createElement('div');
        badge.className = `title-badge-item ${isEarned ? 'earned' : 'locked'}`;
        badge.innerHTML = `
            <div class="title-badge-name">${isEarned ? '🎖️' : '🔒'} ${t.name}</div>
            <div class="title-badge-condition">Lv.${t.level} · ${t.condition || ''}</div>
        `;
        titlesList.appendChild(badge);
    });
}

// ===== 成就面板 =====
function showAchievementPanel() {
    showModal('achievement-modal');
    const list = document.getElementById('achievement-list');
    list.innerHTML = '';

    ACHIEVEMENTS.forEach(ach => {
        const unlocked = player.data.achievements.includes(ach.id);
        const item = document.createElement('div');
        item.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
        item.innerHTML = `
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-info">
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
            </div>
            <div class="achievement-reward">${unlocked ? '✅' : `🪙${ach.reward}`}</div>
        `;
        list.appendChild(item);
    });
}

// ===== 道具使用 =====
function useToolShuffle() {
    if (gameState !== 'playing') return;
    if (player.useTool('shuffle')) {
        engine.shuffle();
        updateToolCounts();
        audio.playClick();
        renderer.addFloatingText('🔀 洗牌！', renderer.canvas.width / (window.devicePixelRatio || 1) / 2, renderer.canvas.height / (window.devicePixelRatio || 1) / 2, '#4fc3f7', 24);
    }
}

// ===== 事件绑定 =====
function bindEvents() {
    // 登录
    document.getElementById('btn-start-game').addEventListener('click', async () => {
        audio.init();
        const name = document.getElementById('player-name').value.trim();
        if (!name) {
            document.getElementById('player-name').placeholder = '请输入名字哦~';
            document.getElementById('player-name').focus();
            return;
        }
        player.setName(name);
        player.data.character = selectedCharacter;
        player.serverSyncEnabled = true; // 所有用户都自动同步
        player.save();
        // 尝试从服务器加载已有存档（换设备不丢失）
        try { await player.loadFromServer(); } catch(e) {}
        player.syncToServer();
        updateMenuUI();
        // 首次登录显示玩法介绍
        if (!localStorage.getItem('tutorial_shown')) {
            showScreen('menu-screen');
            initMenuBackground();
            showTutorial();
            localStorage.setItem('tutorial_shown', '1');
        } else {
            showScreen('menu-screen');
            initMenuBackground();
        }
        audio.playClick();
    });

    // 角色选择（登录页）
    document.querySelectorAll('.character-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.character-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedCharacter = opt.dataset.char;
            audio.playClick();
        });
    });

    // 菜单
    document.getElementById('btn-adventure').addEventListener('click', () => {
        audio.playClick();
        renderLevelMap();
        showScreen('level-screen');
    });

    document.getElementById('btn-character').addEventListener('click', () => {
        audio.playClick();
        showCharacterPanel();
    });

    document.getElementById('btn-ranking').addEventListener('click', () => {
        audio.playClick();
        showRankings('score');
    });

    document.getElementById('btn-achievements').addEventListener('click', () => {
        audio.playClick();
        showAchievementPanel();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        audio.playClick();
        showModal('settings-modal');
        document.getElementById('setting-sfx').checked = player.data.settings.sfx;
        document.getElementById('setting-music').checked = player.data.settings.music;
        document.getElementById('setting-vibrate').checked = player.data.settings.vibrate;
        document.getElementById('setting-particles').checked = player.data.settings.particles;
    });

    // 关卡选择
    document.getElementById('btn-back-menu').addEventListener('click', () => {
        audio.playClick();
        showScreen('menu-screen');
        initMenuBackground();
    });

    // 游戏HUD
    document.getElementById('btn-pause').addEventListener('click', () => {
        if (gameState === 'playing') {
            gameState = 'paused';
            showModal('pause-modal');
            audio.playClick();
        }
    });

    // 暂停弹窗
    document.getElementById('btn-resume').addEventListener('click', () => {
        hideModal('pause-modal');
        gameState = 'playing';
        audio.playClick();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        hideModal('pause-modal');
        startLevel(currentLevelId);
        audio.playClick();
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
        hideAllModals();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        renderLevelMap();
        showScreen('level-screen');
        audio.playClick();
    });

    // 胜利弹窗
    document.getElementById('btn-next-level').addEventListener('click', () => {
        hideAllModals();
        const nextLevel = currentLevelId + 1;
        if (nextLevel <= LEVEL_DATA.length) {
            startLevel(nextLevel);
        } else {
            renderLevelMap();
            showScreen('level-screen');
        }
        audio.playClick();
    });

    document.getElementById('btn-back-levels').addEventListener('click', () => {
        hideAllModals();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        renderLevelMap();
        showScreen('level-screen');
        audio.playClick();
    });

    // 失败弹窗
    document.getElementById('btn-retry').addEventListener('click', () => {
        hideAllModals();
        startLevel(currentLevelId);
        audio.playClick();
    });

    document.getElementById('btn-lose-quit').addEventListener('click', () => {
        hideAllModals();
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        renderLevelMap();
        showScreen('level-screen');
        audio.playClick();
    });

    // 排行榜
    document.getElementById('btn-close-ranking').addEventListener('click', () => {
        hideModal('ranking-modal');
        audio.playClick();
    });

    document.querySelectorAll('.ranking-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ranking-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            showRankings(tab.dataset.tab);
            audio.playClick();
        });
    });

    // 角色
    document.getElementById('btn-close-character').addEventListener('click', () => {
        hideModal('character-modal');
        audio.playClick();
    });

    document.getElementById('btn-save-name').addEventListener('click', () => {
        const newName = document.getElementById('char-name-input').value.trim();
        if (newName) {
            player.setName(newName);
            updateMenuUI();
            audio.playClick();
        }
    });

    // 成就
    document.getElementById('btn-close-achievement').addEventListener('click', () => {
        hideModal('achievement-modal');
        audio.playClick();
    });

    // 设置
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        hideModal('settings-modal');
        audio.playClick();
    });

    document.getElementById('setting-sfx').addEventListener('change', (e) => {
        player.data.settings.sfx = e.target.checked;
        audio.sfxEnabled = e.target.checked;
        player.save();
    });

    document.getElementById('setting-music').addEventListener('change', (e) => {
        player.data.settings.music = e.target.checked;
        audio.musicEnabled = e.target.checked;
        player.save();
    });

    document.getElementById('setting-vibrate').addEventListener('change', (e) => {
        player.data.settings.vibrate = e.target.checked;
        player.save();
    });

    document.getElementById('setting-particles').addEventListener('change', (e) => {
        player.data.settings.particles = e.target.checked;
        player.save();
    });

    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if (confirm('确定要清除所有存档数据吗？此操作不可恢复！')) {
            player.clearData();
            hideAllModals();
            showScreen('login-screen');
            initLoginBackground();
        }
    });

    // 道具
    document.getElementById('tool-shuffle').addEventListener('click', useToolShuffle);

    document.getElementById('tool-hint').addEventListener('click', () => {
        if (gameState !== 'playing') return;
        if (hintRemaining <= 0) {
            renderer.addFloatingText('💡 提示次数已用完', renderer.canvas.width / (window.devicePixelRatio || 1) / 2, renderer.canvas.height / (window.devicePixelRatio || 1) / 2, '#ff5722', 18);
            return;
        }
        const hint = engine.findHint();
        if (hint) {
            hintRemaining--;
            document.getElementById('hint-count').textContent = hintRemaining;
            audio.playClick();
            // 高亮提示的两个格子
            showHintHighlight(hint.r1, hint.c1, hint.r2, hint.c2);
        } else {
            // 无可用移动，自动洗牌
            engine.shuffle();
            renderer.addFloatingText('🔀 自动洗牌！', renderer.canvas.width / (window.devicePixelRatio || 1) / 2, renderer.canvas.height / (window.devicePixelRatio || 1) / 2, '#ffd700', 24);
        }
    });

    // 弹窗遮罩点击关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal && !modal.id.includes('pause') && !modal.id.includes('win') && !modal.id.includes('lose')) {
                modal.classList.remove('active');
            }
        });
    });

    // 键盘支持（PC端）
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (gameState === 'playing') {
                gameState = 'paused';
                showModal('pause-modal');
            } else if (gameState === 'paused') {
                hideModal('pause-modal');
                gameState = 'playing';
            }
        }
    });
}

// ===== 添加签名 =====
function addSignature() {
    const sig = document.createElement('div');
    sig.className = 'app-signature';
    sig.innerHTML = '<p>由 <a href="https://with.woa.com/" style="color: #8A2BE2;" target="_blank">With</a> 通过自然语言生成</p>';
    document.body.appendChild(sig);
}

// ===== 玩法介绍 =====
let tutorialPage = 0;
const TUTORIAL_TOTAL_PAGES = 5;

function showTutorial() {
    tutorialPage = 0;
    updateTutorialPage();
    showModal('tutorial-modal');
}

function updateTutorialPage() {
    document.querySelectorAll('.tutorial-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tutorial-dot').forEach(d => d.classList.remove('active'));
    const page = document.querySelector(`.tutorial-page[data-page="${tutorialPage}"]`);
    const dot = document.querySelector(`.tutorial-dot[data-dot="${tutorialPage}"]`);
    if (page) page.classList.add('active');
    if (dot) dot.classList.add('active');

    const prevBtn = document.getElementById('btn-tutorial-prev');
    const nextBtn = document.getElementById('btn-tutorial-next');
    const startBtn = document.getElementById('btn-tutorial-start');

    prevBtn.style.display = tutorialPage > 0 ? 'block' : 'none';
    nextBtn.style.display = tutorialPage < TUTORIAL_TOTAL_PAGES - 1 ? 'block' : 'none';
    startBtn.style.display = tutorialPage === TUTORIAL_TOTAL_PAGES - 1 ? 'block' : 'none';
}

function bindTutorialEvents() {
    document.getElementById('btn-tutorial-next').addEventListener('click', () => {
        if (tutorialPage < TUTORIAL_TOTAL_PAGES - 1) {
            tutorialPage++;
            updateTutorialPage();
            audio.playClick();
        }
    });
    document.getElementById('btn-tutorial-prev').addEventListener('click', () => {
        if (tutorialPage > 0) {
            tutorialPage--;
            updateTutorialPage();
            audio.playClick();
        }
    });
    document.getElementById('btn-tutorial-start').addEventListener('click', () => {
        hideModal('tutorial-modal');
        audio.playClick();
    });
    document.getElementById('btn-close-tutorial').addEventListener('click', () => {
        hideModal('tutorial-modal');
        audio.playClick();
    });
    document.querySelectorAll('.tutorial-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            tutorialPage = parseInt(dot.dataset.dot);
            updateTutorialPage();
            audio.playClick();
        });
    });
}

// ===== 点击触发特殊元素（双击触发） =====
async function activateSpecialByClick(row, col) {
    const cell = engine.getCell(row, col);
    if (!cell || cell.special === SPECIAL_TYPES.NONE) return false;

    gameState = 'animating';

    // 收集爆炸范围内的格子
    const removed = [];
    removed.push({ ...cell, row, col });

    // 检查爆炸范围内是否有其他特殊元素
    let hasChainSpecial = false;
    let chainSpecialCell = null;

    if (cell.special === SPECIAL_TYPES.LINE_H) {
        audio.playLineBlast();
        renderer.spawnSpecialParticles(row, col, 'line');
        renderer.shake(3);
        for (let c = 0; c < engine.size; c++) {
            if (engine.board[row][c].obstacle === OBSTACLE_TYPES.STONE) continue;
            if (engine.board[row][c].type >= 0 || engine.board[row][c].type === -2) {
                if (c !== col) {
                    removed.push({ ...engine.board[row][c], row, col: c });
                    if (engine.board[row][c].special !== SPECIAL_TYPES.NONE && !hasChainSpecial) {
                        hasChainSpecial = true;
                        chainSpecialCell = { row, col: c, special: engine.board[row][c].special };
                    }
                }
            }
            // 破冰
            if (engine.board[row][c].obstacle === OBSTACLE_TYPES.ICE) {
                engine.board[row][c].obstacle = OBSTACLE_TYPES.NONE;
            }
        }
    } else if (cell.special === SPECIAL_TYPES.LINE_V) {
        audio.playLineBlast();
        renderer.spawnSpecialParticles(row, col, 'line');
        renderer.shake(3);
        for (let r = 0; r < engine.size; r++) {
            if (engine.board[r][col].obstacle === OBSTACLE_TYPES.STONE) continue;
            if (engine.board[r][col].type >= 0 || engine.board[r][col].type === -2) {
                if (r !== row) {
                    removed.push({ ...engine.board[r][col], row: r, col });
                    if (engine.board[r][col].special !== SPECIAL_TYPES.NONE && !hasChainSpecial) {
                        hasChainSpecial = true;
                        chainSpecialCell = { row: r, col, special: engine.board[r][col].special };
                    }
                }
            }
            if (engine.board[r][col].obstacle === OBSTACLE_TYPES.ICE) {
                engine.board[r][col].obstacle = OBSTACLE_TYPES.NONE;
            }
        }
    } else if (cell.special === SPECIAL_TYPES.BOMB) {
        audio.playBombBlast();
        renderer.spawnSpecialParticles(row, col, 'bomb');
        renderer.shake(5);
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                if (Math.abs(dr) + Math.abs(dc) <= 2) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < engine.size && nc >= 0 && nc < engine.size) {
                        if (engine.board[nr][nc].obstacle === OBSTACLE_TYPES.STONE) continue;
                        if ((nr !== row || nc !== col) && (engine.board[nr][nc].type >= 0 || engine.board[nr][nc].type === -2)) {
                            removed.push({ ...engine.board[nr][nc], row: nr, col: nc });
                            if (engine.board[nr][nc].special !== SPECIAL_TYPES.NONE && !hasChainSpecial) {
                                hasChainSpecial = true;
                                chainSpecialCell = { row: nr, col: nc, special: engine.board[nr][nc].special };
                            }
                        }
                        if (engine.board[nr][nc].obstacle === OBSTACLE_TYPES.ICE) {
                            engine.board[nr][nc].obstacle = OBSTACLE_TYPES.NONE;
                        }
                    }
                }
            }
        }
    } else if (cell.special === SPECIAL_TYPES.RAINBOW) {
        audio.playRainbow();
        // 随机选一种颜色消除
        const types = [];
        for (let r = 0; r < engine.size; r++) {
            for (let c = 0; c < engine.size; c++) {
                if (engine.board[r][c].type >= 0 && engine.board[r][c].obstacle !== OBSTACLE_TYPES.STONE) types.push(engine.board[r][c].type);
            }
        }
        if (types.length > 0) {
            const targetType = types[Math.floor(Math.random() * types.length)];
            for (let r = 0; r < engine.size; r++) {
                for (let c = 0; c < engine.size; c++) {
                    if (engine.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if (engine.board[r][c].type === targetType) {
                        removed.push({ ...engine.board[r][c], row: r, col: c });
                        if (engine.board[r][c].special !== SPECIAL_TYPES.NONE && !hasChainSpecial) {
                            hasChainSpecial = true;
                            chainSpecialCell = { row: r, col: c, special: engine.board[r][c].special };
                        }
                    }
                }
            }
        }
    }

    // 如果爆炸范围内有其他特殊元素，触发甜蜜风暴（终极效果）
    if (hasChainSpecial && chainSpecialCell) {
        usedSweetStorm = true;
        // 显示终极一击过场动画
        const cw = renderer.canvas.width / (window.devicePixelRatio || 1);
        const ch = renderer.canvas.height / (window.devicePixelRatio || 1);
        renderer.showUltimateEffect(cw, ch);
        audio.playSweetStorm();
        renderer.spawnSweetStormParticles();
        renderer.shake(10);
        await sleep(800); // 等待过场动画展示
        // 全屏消除（跳过石头）
        for (let r = 0; r < engine.size; r++) {
            for (let c = 0; c < engine.size; c++) {
                if (engine.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                if (engine.board[r][c].type >= 0 || engine.board[r][c].type === -2) {
                    if (!removed.find(x => x.row === r && x.col === c)) {
                        removed.push({ ...engine.board[r][c], row: r, col: c });
                    }
                }
                // 全屏消除也破冰
                if (engine.board[r][c].obstacle === OBSTACLE_TYPES.ICE) {
                    engine.board[r][c].obstacle = OBSTACLE_TYPES.NONE;
                }
            }
        }
    }

    // 消耗步数
    engine.moves--;
    document.getElementById('hud-moves').textContent = engine.moves;

    const score = removed.length * (hasChainSpecial ? 30 : 15);
    engine.score += score;

    if (removed.length > 0) {
        const avgX = removed.reduce((s, c) => s + renderer.getCellPos(c.row, c.col).x, 0) / removed.length;
        const avgY = removed.reduce((s, c) => s + renderer.getCellPos(c.row, c.col).y, 0) / removed.length;
        renderer.addFloatingText(`+${score}`, avgX, avgY, '#ffd700', 22);
    }

    await animateRemoval(removed);
    engine.clearCells(removed);

    const falls = engine.applyGravity();
    await animateFall(falls);
    await processCascade();

    updateHUD();

    const state = engine.checkGameState();
    if (state === 'win') {
        gameState = 'win';
        await sleep(500);
        showWinScreen();
    } else if (state === 'lose') {
        gameState = 'lose';
        await sleep(500);
        showLoseScreen();
    } else {
        if (!engine.hasValidMoves()) {
            engine.shuffle();
            renderer.addFloatingText('🔀 自动洗牌！', renderer.canvas.width / (window.devicePixelRatio || 1) / 2, renderer.canvas.height / (window.devicePixelRatio || 1) / 2, '#ffd700', 24);
        }
        gameState = 'playing';
    }
    return true;
}

// ===== 提示高亮功能 =====
function showHintHighlight(r1, c1, r2, c2) {
    // 清除之前的高亮
    clearHintHighlight();
    hintHighlightCells = [{r: r1, c: c1}, {r: r2, c: c2}];
    // 通知渲染器绘制高亮
    renderer.hintCells = hintHighlightCells;
    // 3秒后自动清除
    hintAnimTimer = setTimeout(() => {
        clearHintHighlight();
    }, 3000);
}

function clearHintHighlight() {
    hintHighlightCells = [];
    if (renderer) renderer.hintCells = [];
    if (hintAnimTimer) { clearTimeout(hintAnimTimer); hintAnimTimer = null; }
}

// ===== 角色切换事件绑定 =====
function bindCharacterSwitchEvents() {
    document.querySelectorAll('.character-option-mini').forEach(el => {
        el.addEventListener('click', () => {
            const charKey = el.dataset.char;
            selectedCharacter = charKey;
            player.data.character = charKey;
            player.save();
            // 更新角色弹窗头像
            const charInfo = CHARACTER_AVATARS[charKey];
            const avatarImg = document.getElementById('char-avatar-img');
            if (avatarImg) avatarImg.src = charInfo.img;
            // 更新按钮状态
            document.querySelectorAll('.character-option-mini').forEach(o => o.classList.toggle('active', o.dataset.char === charKey));
            // 更新菜单头像
            updateMenuUI();
            audio.playClick();
        });
    });
}

// ===== CSS动画注入 =====
function injectAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
        @keyframes achievementSlideDown {
            from { transform: translateX(-50%) translateY(-40px) scale(0.5); opacity: 0; }
            to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes achievementFadeOut {
            to { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
        }
        @keyframes achievementFlash {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        @keyframes achievementBounce {
            0% { transform: scale(1); }
            50% { transform: scale(1.4); }
            100% { transform: scale(1); }
        }
        @keyframes achievementStar {
            from { transform: translate(0, 0) scale(1); opacity: 1; }
            to { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ===== 启动 =====
function init() {
    injectAnimations();
    addSignature();
    bindEvents();
    bindTutorialEvents();
    bindCharacterSwitchEvents();
    // 恢复已保存的角色选择
    if (player.data.character) {
        selectedCharacter = player.data.character;
    }
    showLoading();
}

// DOM加载完成后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
