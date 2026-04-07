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
export function createCell(type = -1, special = SPECIAL_TYPES.NONE) {
    return {
        type,       // 甜品类型 0-5, -1表示空
        special,    // 特殊类型
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

        return this.board;
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
        if (cell1.type < 0 || cell2.type < 0) return false;

        // 检查组合技：特殊+特殊
        const comboResult = this.checkSpecialCombo(cell1, cell2);
        if (comboResult) {
            this.swap(r1, c1, r2, c2);
            return { type: 'combo', combo: comboResult, cells: [cell1, cell2] };
        }

        // 万能味觉精灵特殊处理
        if (cell1.special === SPECIAL_TYPES.RAINBOW || cell2.special === SPECIAL_TYPES.RAINBOW) {
            this.swap(r1, c1, r2, c2);
            const rainbow = cell1.special === SPECIAL_TYPES.RAINBOW ? this.board[r2][c2] : this.board[r1][c1];
            const other = cell1.special === SPECIAL_TYPES.RAINBOW ? this.board[r1][c1] : this.board[r2][c2];
            return { type: 'rainbow', rainbow, target: other };
        }

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
                if (type < 0) continue;
                let len = 1;
                while (c + len < this.size && this.board[r][c + len].type === type) len++;
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
                if (type < 0) continue;
                let len = 1;
                while (r + len < this.size && this.board[r + len][c].type === type) len++;
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

    // 执行消除
    executeMatches(matches) {
        const cellsToRemove = new Set();
        for (const match of matches) {
            for (const cell of match.cells) {
                cellsToRemove.add(`${cell.row},${cell.col}`);
            }
        }

        const removed = [];
        cellsToRemove.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            const cell = this.board[r][c];
            if (cell.type >= 0 || cell.special === SPECIAL_TYPES.RAINBOW) {
                removed.push({ ...cell, row: r, col: c });
                // 如果被消除的是特殊元素，触发其效果
                if (cell.special !== SPECIAL_TYPES.NONE) {
                    this.triggerSpecialEffect(cell, removed);
                }
            }
        });

        return removed;
    }

    // 触发特殊元素效果
    triggerSpecialEffect(cell, removed) {
        const effects = [];
        switch (cell.special) {
            case SPECIAL_TYPES.LINE_H:
                // 消除整行
                for (let c = 0; c < this.size; c++) {
                    if (this.board[cell.row][c].type >= 0) {
                        effects.push({ row: cell.row, col: c });
                    }
                }
                break;
            case SPECIAL_TYPES.LINE_V:
                // 消除整列
                for (let r = 0; r < this.size; r++) {
                    if (this.board[r][cell.col].type >= 0) {
                        effects.push({ row: r, col: cell.col });
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
                                if (this.board[nr][nc].type >= 0) {
                                    effects.push({ row: nr, col: nc });
                                }
                            }
                        }
                    }
                }
                break;
        }

        effects.forEach(e => {
            const key = `${e.row},${e.col}`;
            const existing = removed.find(r => r.row === e.row && r.col === e.col);
            if (!existing) {
                removed.push({ ...this.board[e.row][e.col], row: e.row, col: e.col });
            }
        });

        return effects;
    }

    // 执行万能味觉精灵效果
    executeRainbow(rainbowCell, targetCell) {
        const removed = [];
        const targetType = targetCell.type;

        // 消除所有同色元素
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.board[r][c].type === targetType) {
                    removed.push({ ...this.board[r][c], row: r, col: c });
                }
            }
        }
        // 也消除万能精灵自身
        removed.push({ ...rainbowCell });

        return removed;
    }

    // 执行组合技效果
    executeCombo(comboType, cell1, cell2) {
        const removed = [];

        switch (comboType) {
            case 'sweet_storm':
            case 'total_clear':
                // 全屏消除所有普通元素
                for (let r = 0; r < this.size; r++) {
                    for (let c = 0; c < this.size; c++) {
                        if (this.board[r][c].type >= 0) {
                            removed.push({ ...this.board[r][c], row: r, col: c });
                        }
                    }
                }
                break;
            case 'cross_blast':
                // 十字消除（整行+整列）
                const cr = cell1.row, cc = cell1.col;
                for (let c = 0; c < this.size; c++) {
                    if (this.board[cr][c].type >= 0) removed.push({ ...this.board[cr][c], row: cr, col: c });
                }
                for (let r = 0; r < this.size; r++) {
                    if (this.board[r][cc].type >= 0 && r !== cr) removed.push({ ...this.board[r][cc], row: r, col: cc });
                }
                const cr2 = cell2.row, cc2 = cell2.col;
                for (let c = 0; c < this.size; c++) {
                    if (this.board[cr2][c].type >= 0 && !removed.find(x => x.row === cr2 && x.col === c)) {
                        removed.push({ ...this.board[cr2][c], row: cr2, col: c });
                    }
                }
                for (let r = 0; r < this.size; r++) {
                    if (this.board[r][cc2].type >= 0 && !removed.find(x => x.row === r && x.col === cc2)) {
                        removed.push({ ...this.board[r][cc2], row: r, col: cc2 });
                    }
                }
                break;
            case 'mega_bomb':
                // 大范围爆炸（5x5范围）
                const mr = Math.floor((cell1.row + cell2.row) / 2);
                const mc = Math.floor((cell1.col + cell2.col) / 2);
                for (let dr = -3; dr <= 3; dr++) {
                    for (let dc = -3; dc <= 3; dc++) {
                        const nr = mr + dr, nc = mc + dc;
                        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                            if (this.board[nr][nc].type >= 0) {
                                removed.push({ ...this.board[nr][nc], row: nr, col: nc });
                            }
                        }
                    }
                }
                break;
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
            this.board[cell.row][cell.col] = createCell(-1);
            this.board[cell.row][cell.col].row = cell.row;
            this.board[cell.row][cell.col].col = cell.col;
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
                if (this.board[r][c].type >= 0 || this.board[r][c].type === -2) {
                    if (r !== emptyRow) {
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
                    emptyRow--;
                }
            }

            // 从顶部填充新元素
            for (let r = emptyRow; r >= 0; r--) {
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
                // 尝试与右边交换
                if (c < this.size - 1) {
                    this.swap(r, c, r, c + 1);
                    if (this.findAllMatches().length > 0) {
                        this.swap(r, c, r, c + 1);
                        return true;
                    }
                    this.swap(r, c, r, c + 1);
                }
                // 尝试与下面交换
                if (r < this.size - 1) {
                    this.swap(r, c, r + 1, c);
                    if (this.findAllMatches().length > 0) {
                        this.swap(r, c, r + 1, c);
                        return true;
                    }
                    this.swap(r, c, r + 1, c);
                }
            }
        }
        return false;
    }

    // 查找一个可用的提示移动（返回两个可交换的格子坐标）
    findHint() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                // 尝试与右边交换
                if (c < this.size - 1) {
                    this.swap(r, c, r, c + 1);
                    if (this.findAllMatches().length > 0) {
                        this.swap(r, c, r, c + 1);
                        return { r1: r, c1: c, r2: r, c2: c + 1 };
                    }
                    this.swap(r, c, r, c + 1);
                }
                // 尝试与下面交换
                if (r < this.size - 1) {
                    this.swap(r, c, r + 1, c);
                    if (this.findAllMatches().length > 0) {
                        this.swap(r, c, r + 1, c);
                        return { r1: r, c1: c, r2: r + 1, c2: c };
                    }
                    this.swap(r, c, r + 1, c);
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
                if (this.board[r][c].type >= 0) {
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
                if (this.board[r][c].type >= 0) {
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
