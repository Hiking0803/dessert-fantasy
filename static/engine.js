// 游戏核心引擎 - 棋盘逻辑、匹配检测、消除与下落
// 甜品类型定义
export const CANDY_TYPES = [
    { id: 0, name: '草莓蛋糕', emoji: '🍰', color: '#e8365d' },
    { id: 1, name: '布丁', emoji: '🍮', color: '#f5c800' },
    { id: 2, name: '甜甜圈', emoji: '🍩', color: '#ff6d00' },
    { id: 3, name: '马卡龙', emoji: '🧁', color: '#7b1fa2' },
    { id: 4, name: '冰淇淋', emoji: '🍦', color: '#0288d1' },
    { id: 5, name: '巧克力', emoji: '🍫', color: '#2e7d32' },
];

// 特殊元素类型
export const SPECIAL_TYPES = {
    NONE: 0,
    LINE_H: 1,    // 糖霜喷射器-横向（四连横）
    LINE_V: 2,    // 糖霜喷射器-纵向（四连纵）
    BOMB: 3,      // 奶油爆弹（五连L/T型）
    RAINBOW: 4,   // 万能味觉精灵（五连直线）
};

// 障碍物类型
export const OBSTACLE_TYPES = {
    NONE: 0,
    ICE: 1,       // 冰块 - 覆盖在甜品上，需要消除旁边的甜品来破冰（消除1次破冰）
    STONE: 2,     // 石头 - 不可移动，不可消除，占据格子
};

export const BOARD_SIZE = 10;

// 根据关卡ID获取棋盘大小：1-3关6×6，4-9关8×8，10+关10×10
export function getBoardSizeForLevel(levelId) {
    if (levelId <= 3) return 6;
    if (levelId <= 9) return 8;
    return 10;
}

// 根据关卡ID获取可用的甜品种类数量（前几关降低难度）
export function getCandyCountForLevel(levelId) {
    if (levelId <= 3) return 4; // 1-3关只用4种甜品，更容易连线
    if (levelId <= 5) return 5; // 4-5关用5种甜品
    return 6; // 其余关卡用全部6种
}

// 创建一个棋盘格子
export function createCell(type = -1, special = SPECIAL_TYPES.NONE, obstacle = OBSTACLE_TYPES.NONE) {
    return {
        type,       // 甜品类型 0-5, -1表示空
        special,    // 特殊类型
        obstacle,   // 障碍物类型
        row: 0,
        col: 0,
        x: 0, y: 0,           // 渲染位置
        targetX: 0, targetY: 0, // 目标位置（动画用）
        scale: 1,
        alpha: 1,
        removing: false,
        falling: false,
        isNew: false,
        selected: false,
    };
}

export class GameEngine {
    constructor() {
        this.board = [];
        this.size = BOARD_SIZE;
        this.score = 0;
        this.moves = 30;
        this.targetScore = 5000;
        this.combo = 0;
        this.maxCombo = 0;
        this.isProcessing = false;
        this.pendingSpecials = []; // 待生成的特殊元素
        this.removedCells = [];   // 本轮被消除的格子
        this.levelConfig = null;
    }

    // 初始化棋盘
    initBoard(levelConfig) {
        this.levelConfig = levelConfig || {};
        this.score = 0;
        this.moves = levelConfig?.moves || 30;
        this.targetScore = levelConfig?.targetScore || 5000;
        this.combo = 0;
        this.maxCombo = 0;
        this.board = [];

        // 根据关卡ID动态设置棋盘大小和甜品种类
        if (levelConfig?.id) {
            this.size = getBoardSizeForLevel(levelConfig.id);
            this.candyCount = getCandyCountForLevel(levelConfig.id);
        } else {
            this.candyCount = CANDY_TYPES.length;
        }

        let attempts = 0;
        const maxAttempts = 50;

        do {
            this.board = [];
            for (let r = 0; r < this.size; r++) {
                this.board[r] = [];
                for (let c = 0; c < this.size; c++) {
                    let type;
                    // 确保初始棋盘没有三连，且只使用限定种类的甜品
                    do {
                        type = Math.floor(Math.random() * this.candyCount);
                    } while (this.wouldMatch(r, c, type));
                    const cell = createCell(type);
                    cell.row = r;
                    cell.col = c;
                    this.board[r][c] = cell;
                }
            }
            attempts++;
            // 确保棋盘有可用的移动（有解）
        } while (!this.hasValidMoves() && attempts < maxAttempts);

        // 如果多次尝试仍无解，强制洗牌直到有解
        if (!this.hasValidMoves()) {
            this.ensureValidMoves();
        }

        // 放置障碍物
        if (levelConfig?.obstacles) {
            this.placeObstacles(levelConfig.obstacles);
        }

        return this.board;
    }

    // 放置障碍物
    placeObstacles(obstacleConfig) {
        const positions = [];
        // 收集可放置障碍物的位置（避免边角和中心区域，保证可玩性）
        for (let r = 1; r < this.size - 1; r++) {
            for (let c = 1; c < this.size - 1; c++) {
                // 避免正中心3x3区域
                const centerR = Math.floor(this.size / 2);
                const centerC = Math.floor(this.size / 2);
                if (Math.abs(r - centerR) <= 1 && Math.abs(c - centerC) <= 1) continue;
                positions.push({ r, c });
            }
        }

        // 随机打乱位置
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        let posIdx = 0;

        // 放置冰块（覆盖在甜品上）
        if (obstacleConfig.ice) {
            for (let i = 0; i < obstacleConfig.ice && posIdx < positions.length; i++) {
                const pos = positions[posIdx++];
                this.board[pos.r][pos.c].obstacle = OBSTACLE_TYPES.ICE;
            }
        }

        // 放置石头（替换甜品）
        if (obstacleConfig.stone) {
            for (let i = 0; i < obstacleConfig.stone && posIdx < positions.length; i++) {
                const pos = positions[posIdx++];
                const cell = createCell(-3, SPECIAL_TYPES.NONE, OBSTACLE_TYPES.STONE);
                cell.row = pos.r;
                cell.col = pos.c;
                this.board[pos.r][pos.c] = cell;
            }
        }

        // 确保放置障碍物后仍有可用移动
        if (!this.hasValidMoves()) {
            this.ensureValidMoves();
        }
    }

    // 确保棋盘有可用移动（强制创建至少一个可消除组合）
    ensureValidMoves() {
        let maxTries = 100;
        while (!this.hasValidMoves() && maxTries > 0) {
            // 随机选一个位置，将其与相邻格子设为相同类型以创造三连机会
            const r = Math.floor(Math.random() * (this.size - 2));
            const c = Math.floor(Math.random() * (this.size - 2));
            const type = Math.floor(Math.random() * this.candyCount);
            // 横向放置两个相同的，让第三个可以通过交换得到
            this.board[r][c].type = type;
            this.board[r][c + 1].type = type;
            // 在附近放一个相同类型的，使得交换后可以三连
            if (r + 1 < this.size && this.board[r + 1][c + 2]) {
                this.board[r + 1][c + 2].type = type;
            }
            maxTries--;
        }
    }

    // 检查放置某类型是否会形成三连
    wouldMatch(row, col, type) {
        // 检查横向
        if (col >= 2) {
            if (this.board[row][col - 1]?.type === type && this.board[row][col - 2]?.type === type) {
                return true;
            }
        }
        // 检查纵向
        if (row >= 2) {
            if (this.board[row - 1]?.[col]?.type === type && this.board[row - 2]?.[col]?.type === type) {
                return true;
            }
        }
        return false;
    }

    // 获取格子
    getCell(row, col) {
        if (row < 0 || row >= this.size || col < 0 || col >= this.size) return null;
        return this.board[row][col];
    }

    // 检查两个格子是否相邻
    isAdjacent(r1, c1, r2, c2) {
        return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
    }

    // 交换两个格子
    swap(r1, c1, r2, c2) {
        const cell1 = this.board[r1][c1];
        const cell2 = this.board[r2][c2];
        this.board[r1][c1] = cell2;
        this.board[r2][c2] = cell1;
        cell1.row = r2; cell1.col = c2;
        cell2.row = r1; cell2.col = c1;
    }

    // 尝试交换并检查是否有效
    trySwap(r1, c1, r2, c2) {
        if (!this.isAdjacent(r1, c1, r2, c2)) return false;
        const cell1 = this.board[r1][c1];
        const cell2 = this.board[r2][c2];
        if (cell1.type < 0 && cell1.type !== -2) return false;
        if (cell2.type < 0 && cell2.type !== -2) return false;
        // 石头不可交换
        if (cell1.obstacle === OBSTACLE_TYPES.STONE || cell2.obstacle === OBSTACLE_TYPES.STONE) return false;
        // 冰块覆盖的甜品不可交换
        if (cell1.obstacle === OBSTACLE_TYPES.ICE || cell2.obstacle === OBSTACLE_TYPES.ICE) return false;

        // 检查组合技：两个特殊元素交换（包括相同类型的特殊元素）
        const comboResult = this.checkSpecialCombo(cell1, cell2);
        if (comboResult) {
            // 记录交换前的位置，因为swap后row/col会变
            const pos1 = { row: r1, col: c1 };
            const pos2 = { row: r2, col: c2 };
            this.swap(r1, c1, r2, c2);
            return { type: 'combo', combo: comboResult, cells: [cell1, cell2], positions: [pos1, pos2] };
        }

        // 如果两个都是特殊元素（即使checkSpecialCombo没有匹配到），也允许交换并触发各自效果
        if (cell1.special !== SPECIAL_TYPES.NONE && cell2.special !== SPECIAL_TYPES.NONE) {
            const pos1 = { row: r1, col: c1 };
            const pos2 = { row: r2, col: c2 };
            this.swap(r1, c1, r2, c2);
            return { type: 'combo', combo: 'dual_special', cells: [cell1, cell2], positions: [pos1, pos2] };
        }

        // 万能味觉精灵特殊处理（一个是RAINBOW，另一个是普通元素）
        if (cell1.special === SPECIAL_TYPES.RAINBOW || cell2.special === SPECIAL_TYPES.RAINBOW) {
            this.swap(r1, c1, r2, c2);
            const rainbow = cell1.special === SPECIAL_TYPES.RAINBOW ? this.board[r2][c2] : this.board[r1][c1];
            const other = cell1.special === SPECIAL_TYPES.RAINBOW ? this.board[r1][c1] : this.board[r2][c2];
            return { type: 'rainbow', rainbow, target: other };
        }

        // 单个特殊元素与普通元素交换 - 允许交换（只要能形成匹配或特殊元素本身就有效果）
        // 普通交换
        this.swap(r1, c1, r2, c2);
        const matches = this.findAllMatches();
        if (matches.length === 0) {
            // 无效交换，换回
            this.swap(r1, c1, r2, c2);
            return false;
        }
        return { type: 'normal', matches };
    }

    // 检查特殊元素组合技
    checkSpecialCombo(cell1, cell2) {
        const s1 = cell1.special;
        const s2 = cell2.special;
        if (s1 === SPECIAL_TYPES.NONE && s2 === SPECIAL_TYPES.NONE) return null;

        // 糖霜喷射器 + 奶油爆弹 = 甜蜜风暴
        if ((this.isLine(s1) && s2 === SPECIAL_TYPES.BOMB) || (s1 === SPECIAL_TYPES.BOMB && this.isLine(s2))) {
            return 'sweet_storm';
        }
        // 糖霜喷射器 + 万能味觉精灵 = 甜蜜风暴
        if ((this.isLine(s1) && s2 === SPECIAL_TYPES.RAINBOW) || (s1 === SPECIAL_TYPES.RAINBOW && this.isLine(s2))) {
            return 'sweet_storm';
        }
        // 奶油爆弹 + 万能味觉精灵 = 甜蜜风暴
        if ((s1 === SPECIAL_TYPES.BOMB && s2 === SPECIAL_TYPES.RAINBOW) || (s1 === SPECIAL_TYPES.RAINBOW && s2 === SPECIAL_TYPES.BOMB)) {
            return 'sweet_storm';
        }
        // 两个糖霜喷射器 = 十字消除
        if (this.isLine(s1) && this.isLine(s2)) {
            return 'cross_blast';
        }
        // 两个奶油爆弹 = 大范围爆炸
        if (s1 === SPECIAL_TYPES.BOMB && s2 === SPECIAL_TYPES.BOMB) {
            return 'mega_bomb';
        }
        // 两个万能味觉精灵 = 全屏消除
        if (s1 === SPECIAL_TYPES.RAINBOW && s2 === SPECIAL_TYPES.RAINBOW) {
            return 'total_clear';
        }
        return null;
    }

    isLine(special) {
        return special === SPECIAL_TYPES.LINE_H || special === SPECIAL_TYPES.LINE_V;
    }

    // 查找所有匹配
    findAllMatches() {
        const matches = [];
        const visited = Array.from({ length: this.size }, () => Array(this.size).fill(false));

        // 横向扫描
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size - 2; c++) {
                const type = this.board[r][c].type;
                if (type < 0 || this.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                let len = 1;
                while (c + len < this.size && this.board[r][c + len].type === type && this.board[r][c + len].obstacle !== OBSTACLE_TYPES.STONE) len++;
                if (len >= 3) {
                    const match = { cells: [], direction: 'horizontal', length: len };
                    for (let i = 0; i < len; i++) {
                        match.cells.push({ row: r, col: c + i });
                        visited[r][c + i] = true;
                    }
                    matches.push(match);
                    c += len - 1;
                }
            }
        }

        // 纵向扫描
        for (let c = 0; c < this.size; c++) {
            for (let r = 0; r < this.size - 2; r++) {
                const type = this.board[r][c].type;
                if (type < 0 || this.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                let len = 1;
                while (r + len < this.size && this.board[r + len][c].type === type && this.board[r + len][c].obstacle !== OBSTACLE_TYPES.STONE) len++;
                if (len >= 3) {
                    const match = { cells: [], direction: 'vertical', length: len };
                    for (let i = 0; i < len; i++) {
                        match.cells.push({ row: r + i, col: c });
                    }
                    matches.push(match);
                    r += len - 1;
                }
            }
        }

        // 检测L/T型匹配（合并交叉的横纵匹配）
        this.detectLTMatches(matches);

        return matches;
    }

    // 检测L/T型匹配
    detectLTMatches(matches) {
        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const m1 = matches[i];
                const m2 = matches[j];
                if (m1.direction === m2.direction) continue;
                // 检查是否有交叉点
                const overlap = m1.cells.some(c1 =>
                    m2.cells.some(c2 => c1.row === c2.row && c1.col === c2.col)
                );
                if (overlap) {
                    // 标记为L/T型
                    m1.isLT = true;
                    m2.isLT = true;
                    m1.linkedMatch = j;
                    m2.linkedMatch = i;
                }
            }
        }
    }

    // 根据匹配结果确定特殊元素生成
    determineSpecials(matches, swapPos) {
        const specials = [];

        for (const match of matches) {
            if (match.processed) continue;

            // L/T型五连 -> 奶油爆弹
            if (match.isLT && match.linkedMatch !== undefined) {
                const linked = matches[match.linkedMatch];
                if (linked && !linked.processed) {
                    const totalCells = new Set();
                    match.cells.forEach(c => totalCells.add(`${c.row},${c.col}`));
                    linked.cells.forEach(c => totalCells.add(`${c.row},${c.col}`));
                    if (totalCells.size >= 5) {
                        // 在交叉点生成奶油爆弹
                        const overlap = match.cells.find(c1 =>
                            linked.cells.some(c2 => c1.row === c2.row && c1.col === c2.col)
                        );
                        if (overlap) {
                            specials.push({
                                row: overlap.row, col: overlap.col,
                                special: SPECIAL_TYPES.BOMB,
                                type: this.board[overlap.row][overlap.col].type
                            });
                        }
                        linked.processed = true;
                        match.processed = true;
                        continue;
                    }
                }
            }

            // 五连直线 -> 万能味觉精灵
            if (match.length >= 5 && !match.isLT) {
                const center = match.cells[Math.floor(match.cells.length / 2)];
                let pos = center;
                if (swapPos) {
                    const inMatch = match.cells.find(c => c.row === swapPos.row && c.col === swapPos.col);
                    if (inMatch) pos = inMatch;
                }
                specials.push({
                    row: pos.row, col: pos.col,
                    special: SPECIAL_TYPES.RAINBOW,
                    type: -2 // 万能类型
                });
                match.processed = true;
                continue;
            }

            // 四连 -> 糖霜喷射器
            if (match.length === 4) {
                let pos = match.cells[1]; // 默认第二个位置
                if (swapPos) {
                    const inMatch = match.cells.find(c => c.row === swapPos.row && c.col === swapPos.col);
                    if (inMatch) pos = inMatch;
                }
                specials.push({
                    row: pos.row, col: pos.col,
                    special: match.direction === 'horizontal' ? SPECIAL_TYPES.LINE_V : SPECIAL_TYPES.LINE_H,
                    type: this.board[match.cells[0].row][match.cells[0].col].type
                });
                match.processed = true;
                continue;
            }
        }

        return specials;
    }

    // 执行消除 - 支持特殊元素被动触发和链式触发
    executeMatches(matches) {
        const cellsToRemove = new Set();
        for (const match of matches) {
            for (const cell of match.cells) {
                cellsToRemove.add(`${cell.row},${cell.col}`);
            }
        }

        const removed = [];
        const iceBroken = []; // 被破冰的格子
        const triggeredSpecials = new Set(); // 已触发的特殊元素，防止无限递归

        // 先收集所有需要消除的格子
        cellsToRemove.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            const cell = this.board[r][c];
            if (cell.type >= 0 || cell.special === SPECIAL_TYPES.RAINBOW) {
                removed.push({ ...cell, row: r, col: c });
            }
        });

        // 然后触发所有特殊元素的效果（包括链式触发）
        let hasNewSpecials = true;
        while (hasNewSpecials) {
            hasNewSpecials = false;
            const currentRemoved = [...removed]; // 复制当前列表
            for (const cell of currentRemoved) {
                const key = `${cell.row},${cell.col}`;
                if (triggeredSpecials.has(key)) continue;
                if (cell.special && cell.special !== SPECIAL_TYPES.NONE) {
                    triggeredSpecials.add(key);
                    const newEffects = this.triggerSpecialEffect(cell, removed);
                    if (newEffects && newEffects.length > 0) {
                        hasNewSpecials = true; // 有新的格子被加入，可能包含新的特殊元素
                    }
                }
            }
        }

        // 检查被消除格子的相邻格子，如果有冰块则破冰
        const checkedIce = new Set();
        for (const cell of removed) {
            const neighbors = [
                { r: cell.row - 1, c: cell.col },
                { r: cell.row + 1, c: cell.col },
                { r: cell.row, c: cell.col - 1 },
                { r: cell.row, c: cell.col + 1 },
            ];
            for (const n of neighbors) {
                const key = `${n.r},${n.c}`;
                if (checkedIce.has(key)) continue;
                checkedIce.add(key);
                if (n.r >= 0 && n.r < this.size && n.c >= 0 && n.c < this.size) {
                    const neighbor = this.board[n.r][n.c];
                    if (neighbor.obstacle === OBSTACLE_TYPES.ICE) {
                        neighbor.obstacle = OBSTACLE_TYPES.NONE; // 破冰
                        iceBroken.push({ row: n.r, col: n.c });
                    }
                }
            }
        }

        // 将破冰信息附加到返回结果
        removed.iceBroken = iceBroken;

        return removed;
    }

    // 触发特殊元素效果（被动消除时也会调用）
    triggerSpecialEffect(cell, removed) {
        const effects = [];
        switch (cell.special) {
            case SPECIAL_TYPES.LINE_H:
                // 消除整行
                for (let c = 0; c < this.size; c++) {
                    if (this.board[cell.row][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if (this.board[cell.row][c].type >= 0 || this.board[cell.row][c].type === -2) {
                        effects.push({ row: cell.row, col: c });
                    }
                    if (this.board[cell.row][c].obstacle === OBSTACLE_TYPES.ICE) {
                        this.board[cell.row][c].obstacle = OBSTACLE_TYPES.NONE;
                    }
                }
                break;
            case SPECIAL_TYPES.LINE_V:
                // 消除整列
                for (let r = 0; r < this.size; r++) {
                    if (this.board[r][cell.col].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if (this.board[r][cell.col].type >= 0 || this.board[r][cell.col].type === -2) {
                        effects.push({ row: r, col: cell.col });
                    }
                    if (this.board[r][cell.col].obstacle === OBSTACLE_TYPES.ICE) {
                        this.board[r][cell.col].obstacle = OBSTACLE_TYPES.NONE;
                    }
                }
                break;
            case SPECIAL_TYPES.BOMB:
                // 消除十字型范围
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        if (Math.abs(dr) + Math.abs(dc) <= 2) {
                            const nr = cell.row + dr;
                            const nc = cell.col + dc;
                            if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                                if (this.board[nr][nc].obstacle === OBSTACLE_TYPES.STONE) continue;
                                if (this.board[nr][nc].type >= 0 || this.board[nr][nc].type === -2) {
                                    effects.push({ row: nr, col: nc });
                                }
                                if (this.board[nr][nc].obstacle === OBSTACLE_TYPES.ICE) {
                                    this.board[nr][nc].obstacle = OBSTACLE_TYPES.NONE;
                                }
                            }
                        }
                    }
                }
                break;
            case SPECIAL_TYPES.RAINBOW:
                // 万能味觉精灵被动触发：随机选一种颜色消除全场同色
                {
                    const types = [];
                    for (let r = 0; r < this.size; r++) {
                        for (let c = 0; c < this.size; c++) {
                            if (this.board[r][c].type >= 0 && this.board[r][c].obstacle !== OBSTACLE_TYPES.STONE) {
                                types.push(this.board[r][c].type);
                            }
                        }
                    }
                    if (types.length > 0) {
                        const targetType = types[Math.floor(Math.random() * types.length)];
                        for (let r = 0; r < this.size; r++) {
                            for (let c = 0; c < this.size; c++) {
                                if (this.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                                if (this.board[r][c].type === targetType) {
                                    effects.push({ row: r, col: c });
                                }
                                if (this.board[r][c].type === targetType && this.board[r][c].obstacle === OBSTACLE_TYPES.ICE) {
                                    this.board[r][c].obstacle = OBSTACLE_TYPES.NONE;
                                }
                            }
                        }
                    }
                }
                break;
        }

        // 将新的效果格子加入removed列表（包含特殊元素信息，以便链式触发）
        const newEffects = [];
        effects.forEach(e => {
            const existing = removed.find(r => r.row === e.row && r.col === e.col);
            if (!existing) {
                const boardCell = this.board[e.row][e.col];
                removed.push({ ...boardCell, row: e.row, col: e.col });
                newEffects.push(e);
            }
        });

        return newEffects;
    }

    // 执行万能味觉精灵效果
    executeRainbow(rainbowCell, targetCell) {
        const removed = [];
        const targetType = targetCell.type;

        // 消除所有同色元素（跳过石头）
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                if (this.board[r][c].type === targetType) {
                    removed.push({ ...this.board[r][c], row: r, col: c });
                    // 破冰
                    if (this.board[r][c].obstacle === OBSTACLE_TYPES.ICE) {
                        this.board[r][c].obstacle = OBSTACLE_TYPES.NONE;
                    }
                }
            }
        }
        // 也消除万能精灵自身
        removed.push({ ...rainbowCell });

        return removed;
    }

    // 执行组合技效果（positions为交换前的原始位置）
    executeCombo(comboType, cell1, cell2, positions) {
        const removed = [];
        // 使用原始位置（如果提供了的话），避免swap后row/col错乱
        const pos1 = positions ? positions[0] : { row: cell1.row, col: cell1.col };
        const pos2 = positions ? positions[1] : { row: cell2.row, col: cell2.col };

        switch (comboType) {
            case 'sweet_storm':
            case 'total_clear':
            case 'dual_special':
                // 全屏消除所有普通元素（跳过石头）
                for (let r = 0; r < this.size; r++) {
                    for (let c = 0; c < this.size; c++) {
                        if (this.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                        if (this.board[r][c].type >= 0 || this.board[r][c].type === -2) {
                            removed.push({ ...this.board[r][c], row: r, col: c });
                        }
                        // 全屏消除也破冰
                        if (this.board[r][c].obstacle === OBSTACLE_TYPES.ICE) {
                            this.board[r][c].obstacle = OBSTACLE_TYPES.NONE;
                        }
                    }
                }
                break;
            case 'cross_blast': {
                // 十字消除（整行+整列）- 使用原始位置
                const cr = pos1.row, cc = pos1.col;
                for (let c = 0; c < this.size; c++) {
                    if (this.board[cr][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if (this.board[cr][c].type >= 0 || this.board[cr][c].type === -2) removed.push({ ...this.board[cr][c], row: cr, col: c });
                    if (this.board[cr][c].obstacle === OBSTACLE_TYPES.ICE) this.board[cr][c].obstacle = OBSTACLE_TYPES.NONE;
                }
                for (let r = 0; r < this.size; r++) {
                    if (this.board[r][cc].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if ((this.board[r][cc].type >= 0 || this.board[r][cc].type === -2) && r !== cr) removed.push({ ...this.board[r][cc], row: r, col: cc });
                    if (this.board[r][cc].obstacle === OBSTACLE_TYPES.ICE) this.board[r][cc].obstacle = OBSTACLE_TYPES.NONE;
                }
                const cr2 = pos2.row, cc2 = pos2.col;
                for (let c = 0; c < this.size; c++) {
                    if (this.board[cr2][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if ((this.board[cr2][c].type >= 0 || this.board[cr2][c].type === -2) && !removed.find(x => x.row === cr2 && x.col === c)) {
                        removed.push({ ...this.board[cr2][c], row: cr2, col: c });
                    }
                    if (this.board[cr2][c].obstacle === OBSTACLE_TYPES.ICE) this.board[cr2][c].obstacle = OBSTACLE_TYPES.NONE;
                }
                for (let r = 0; r < this.size; r++) {
                    if (this.board[r][cc2].obstacle === OBSTACLE_TYPES.STONE) continue;
                    if ((this.board[r][cc2].type >= 0 || this.board[r][cc2].type === -2) && !removed.find(x => x.row === r && x.col === cc2)) {
                        removed.push({ ...this.board[r][cc2], row: r, col: cc2 });
                    }
                    if (this.board[r][cc2].obstacle === OBSTACLE_TYPES.ICE) this.board[r][cc2].obstacle = OBSTACLE_TYPES.NONE;
                }
                break;
            }
            case 'mega_bomb': {
                // 大范围爆炸（7x7范围）- 使用原始位置
                const mr = Math.floor((pos1.row + pos2.row) / 2);
                const mc = Math.floor((pos1.col + pos2.col) / 2);
                for (let dr = -3; dr <= 3; dr++) {
                    for (let dc = -3; dc <= 3; dc++) {
                        const nr = mr + dr, nc = mc + dc;
                        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                            if (this.board[nr][nc].obstacle === OBSTACLE_TYPES.STONE) continue;
                            if (this.board[nr][nc].type >= 0 || this.board[nr][nc].type === -2) {
                                removed.push({ ...this.board[nr][nc], row: nr, col: nc });
                            }
                            if (this.board[nr][nc].obstacle === OBSTACLE_TYPES.ICE) this.board[nr][nc].obstacle = OBSTACLE_TYPES.NONE;
                        }
                    }
                }
                break;
            }
        }

        return removed;
    }

    // 清除被消除的格子
    clearCells(removed) {
        const uniqueRemoved = [];
        const seen = new Set();
        for (const cell of removed) {
            const key = `${cell.row},${cell.col}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueRemoved.push(cell);
            }
        }

        for (const cell of uniqueRemoved) {
            // 不清除石头格子
            if (this.board[cell.row][cell.col].obstacle === OBSTACLE_TYPES.STONE) continue;
            const newCell = createCell(-1);
            newCell.row = cell.row;
            newCell.col = cell.col;
            this.board[cell.row][cell.col] = newCell;
        }

        return uniqueRemoved;
    }

    // 放置特殊元素
    placeSpecials(specials) {
        for (const sp of specials) {
            const cell = createCell(sp.type >= 0 ? sp.type : 0, sp.special);
            cell.row = sp.row;
            cell.col = sp.col;
            if (sp.special === SPECIAL_TYPES.RAINBOW) {
                cell.type = -2; // 万能类型标记
            }
            cell.isNew = true;
            this.board[sp.row][sp.col] = cell;
        }
    }

    // 下落填充
    applyGravity() {
        const falls = [];

        for (let c = 0; c < this.size; c++) {
            let emptyRow = this.size - 1;
            // 从底部向上扫描
            for (let r = this.size - 1; r >= 0; r--) {
                const cell = this.board[r][c];
                // 石头不移动，跳过
                if (cell.obstacle === OBSTACLE_TYPES.STONE) {
                    emptyRow = r - 1; // 石头上方重新开始计算空位
                    continue;
                }
                if (cell.type >= 0 || cell.type === -2) {
                    if (r !== emptyRow) {
                        // 检查目标位置是否是石头
                        if (this.board[emptyRow][c].obstacle === OBSTACLE_TYPES.STONE) {
                            emptyRow--;
                            if (r !== emptyRow && emptyRow >= 0) {
                                falls.push({
                                    fromRow: r, fromCol: c,
                                    toRow: emptyRow, toCol: c,
                                    cell: this.board[r][c]
                                });
                                this.board[emptyRow][c] = this.board[r][c];
                                this.board[emptyRow][c].row = emptyRow;
                                this.board[r][c] = createCell(-1);
                                this.board[r][c].row = r;
                                this.board[r][c].col = c;
                            }
                        } else {
                            falls.push({
                                fromRow: r, fromCol: c,
                                toRow: emptyRow, toCol: c,
                                cell: this.board[r][c]
                            });
                            this.board[emptyRow][c] = this.board[r][c];
                            this.board[emptyRow][c].row = emptyRow;
                            this.board[r][c] = createCell(-1);
                            this.board[r][c].row = r;
                            this.board[r][c].col = c;
                        }
                    }
                    emptyRow--;
                    // 跳过石头位置
                    while (emptyRow >= 0 && this.board[emptyRow][c].obstacle === OBSTACLE_TYPES.STONE) {
                        emptyRow--;
                    }
                }
            }

            // 从顶部填充新元素（跳过石头位置）
            for (let r = emptyRow; r >= 0; r--) {
                if (this.board[r][c].obstacle === OBSTACLE_TYPES.STONE) continue;
                if (this.board[r][c].type < 0 && this.board[r][c].type !== -2) {
                    const type = Math.floor(Math.random() * (this.candyCount || CANDY_TYPES.length));
                    const cell = createCell(type);
                    cell.row = r;
                    cell.col = c;
                    cell.isNew = true;
                    this.board[r][c] = cell;
                    falls.push({
                        fromRow: r - (emptyRow + 1), fromCol: c,
                        toRow: r, toCol: c,
                        cell: cell,
                        isNew: true
                    });
                }
            }
        }

        return falls;
    }

    // 计算分数
    calculateScore(removed, combo) {
        let base = removed.length * 10;
        let comboBonus = Math.floor(base * combo * 0.5);
        let specialBonus = 0;

        removed.forEach(cell => {
            if (cell.special === SPECIAL_TYPES.LINE_H || cell.special === SPECIAL_TYPES.LINE_V) specialBonus += 50;
            if (cell.special === SPECIAL_TYPES.BOMB) specialBonus += 100;
            if (cell.special === SPECIAL_TYPES.RAINBOW) specialBonus += 200;
        });

        return base + comboBonus + specialBonus;
    }

    // 检查是否有可用的移动
    hasValidMoves() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = this.board[r][c];
                // 跳过石头和冰块
                if (cell.obstacle === OBSTACLE_TYPES.STONE || cell.obstacle === OBSTACLE_TYPES.ICE) continue;
                if (cell.type < 0 && cell.type !== -2) continue;
                // 尝试与右边交换
                if (c < this.size - 1) {
                    const right = this.board[r][c + 1];
                    if (right.obstacle !== OBSTACLE_TYPES.STONE && right.obstacle !== OBSTACLE_TYPES.ICE && (right.type >= 0 || right.type === -2)) {
                        this.swap(r, c, r, c + 1);
                        if (this.findAllMatches().length > 0) {
                            this.swap(r, c, r, c + 1);
                            return true;
                        }
                        this.swap(r, c, r, c + 1);
                    }
                }
                // 尝试与下面交换
                if (r < this.size - 1) {
                    const below = this.board[r + 1][c];
                    if (below.obstacle !== OBSTACLE_TYPES.STONE && below.obstacle !== OBSTACLE_TYPES.ICE && (below.type >= 0 || below.type === -2)) {
                        this.swap(r, c, r + 1, c);
                        if (this.findAllMatches().length > 0) {
                            this.swap(r, c, r + 1, c);
                            return true;
                        }
                        this.swap(r, c, r + 1, c);
                    }
                }
            }
        }
        return false;
    }

    // 查找一个可用的提示移动（返回两个可交换的格子坐标）
    findHint() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const cell = this.board[r][c];
                if (cell.obstacle === OBSTACLE_TYPES.STONE || cell.obstacle === OBSTACLE_TYPES.ICE) continue;
                if (cell.type < 0 && cell.type !== -2) continue;
                // 尝试与右边交换
                if (c < this.size - 1) {
                    const right = this.board[r][c + 1];
                    if (right.obstacle !== OBSTACLE_TYPES.STONE && right.obstacle !== OBSTACLE_TYPES.ICE && (right.type >= 0 || right.type === -2)) {
                        this.swap(r, c, r, c + 1);
                        if (this.findAllMatches().length > 0) {
                            this.swap(r, c, r, c + 1);
                            return { r1: r, c1: c, r2: r, c2: c + 1 };
                        }
                        this.swap(r, c, r, c + 1);
                    }
                }
                // 尝试与下面交换
                if (r < this.size - 1) {
                    const below = this.board[r + 1][c];
                    if (below.obstacle !== OBSTACLE_TYPES.STONE && below.obstacle !== OBSTACLE_TYPES.ICE && (below.type >= 0 || below.type === -2)) {
                        this.swap(r, c, r + 1, c);
                        if (this.findAllMatches().length > 0) {
                            this.swap(r, c, r + 1, c);
                            return { r1: r, c1: c, r2: r + 1, c2: c };
                        }
                        this.swap(r, c, r + 1, c);
                    }
                }
            }
        }
        return null;
    }

    // 洗牌
    shuffle() {
        const cells = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c].type >= 0 && this.board[r][c].obstacle === OBSTACLE_TYPES.NONE) {
                    cells.push(this.board[r][c].type);
                }
            }
        }
        // Fisher-Yates 洗牌
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }
        let idx = 0;
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c].type >= 0 && this.board[r][c].obstacle === OBSTACLE_TYPES.NONE) {
                    this.board[r][c].type = cells[idx++];
                    this.board[r][c].special = SPECIAL_TYPES.NONE;
                }
            }
        }
    }

    // 检查游戏状态
    checkGameState() {
        if (this.score >= this.targetScore) {
            return 'win';
        }
        if (this.moves <= 0) {
            return 'lose';
        }
        return 'playing';
    }

    // 计算星级
    calculateStars() {
        const ratio = this.score / this.targetScore;
        if (ratio >= 2.0) return 3;
        if (ratio >= 1.5) return 2;
        if (ratio >= 1.0) return 1;
        return 0;
    }
}
