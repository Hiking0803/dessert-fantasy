// 游戏渲染器 - Canvas绘制、动画系统、粒子特效
import { CANDY_TYPES, SPECIAL_TYPES, OBSTACLE_TYPES, BOARD_SIZE } from './engine.js';

// roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        const [tl, tr, br, bl] = r;
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br);
        this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// 粒子类
class Particle {
    constructor(x, y, color, options = {}) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = options.vx || (Math.random() - 0.5) * 8;
        this.vy = options.vy || (Math.random() - 0.5) * 8 - 3;
        this.life = options.life || 1.0;
        this.decay = options.decay || 0.02 + Math.random() * 0.02;
        this.size = options.size || 3 + Math.random() * 5;
        this.gravity = options.gravity || 0.15;
        this.shape = options.shape || (Math.random() > 0.5 ? 'circle' : 'star');
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.rotation += this.rotSpeed;
        this.size *= 0.98;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;

        if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'star') {
            this.drawStar(ctx, 0, 0, 5, this.size, this.size * 0.5);
        } else if (this.shape === 'heart') {
            this.drawHeart(ctx, 0, 0, this.size);
        }
        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerR, innerR) {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
            rot += step;
        }
        ctx.closePath();
        ctx.fill();
    }

    drawHeart(ctx, cx, cy, size) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + size * 0.3);
        ctx.bezierCurveTo(cx - size, cy - size * 0.5, cx - size * 0.5, cy - size, cx, cy - size * 0.5);
        ctx.bezierCurveTo(cx + size * 0.5, cy - size, cx + size, cy - size * 0.5, cx, cy + size * 0.3);
        ctx.fill();
    }
}

// 动画管理器
class AnimationManager {
    constructor() {
        this.animations = [];
    }

    add(anim) {
        this.animations.push(anim);
    }

    update(dt) {
        this.animations = this.animations.filter(a => {
            a.elapsed += dt;
            if (a.elapsed >= a.duration) {
                if (a.onComplete) a.onComplete();
                return false;
            }
            if (a.onUpdate) a.onUpdate(a.elapsed / a.duration);
            return true;
        });
    }

    isAnimating() {
        return this.animations.length > 0;
    }

    clear() {
        this.animations = [];
    }
}

// 甜品绘制颜色 - 高饱和高对比，确保小格子下也能清晰辨认
const CANDY_COLORS = [
    ['#e8365d', '#ff4d76'], // 草莓蛋糕 - 鲜红
    ['#f5c800', '#ffe040'], // 布丁 - 明黄
    ['#ff6d00', '#ff9100'], // 甜甜圈 - 亮橙
    ['#7b1fa2', '#ab47bc'], // 马卡龙 - 紫色（与红色区分更大）
    ['#0288d1', '#29b6f6'], // 冰淇淋 - 天蓝
    ['#2e7d32', '#4caf50'], // 巧克力 - 绿色（替代棕色，小格子下更醒目）
];

const CANDY_EMOJIS = ['🍰', '🍮', '🍩', '🧁', '🍦', '🍫'];

export class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = 0;
        this.boardX = 0;
        this.boardY = 0;
        this.boardSize = BOARD_SIZE; // 动态棋盘大小
        this.particles = [];
        this.animations = new AnimationManager();
        this.selectedCell = null;
        this.hintCell = null;
        this.hintTimer = 0;
        this.shakeOffset = { x: 0, y: 0 };
        this.comboText = null;
        this.floatingTexts = [];
        this.sweetStormActive = false;
        this.sweetStormTimer = 0;
        this.glowCells = [];
        this.hintCells = []; // 提示高亮格子
    }

    // 设置棋盘大小
    setBoardSize(size) {
        this.boardSize = size;
    }

    // 调整画布大小
    resize(containerWidth, containerHeight) {
        const dpr = window.devicePixelRatio || 1;
        // 减少边距，让棋盘尽可能大（尤其10×10时）
        const padding = this.boardSize >= 10 ? 4 : 12;
        const maxSize = Math.min(containerWidth, containerHeight) - padding;
        this.cellSize = Math.floor(maxSize / this.boardSize);
        // 10×10棋盘在小屏幕上确保最小格子尺寸
        if (this.boardSize >= 10 && this.cellSize < 32) {
            this.cellSize = 32;
        }
        const boardPixelSize = this.cellSize * this.boardSize;

        this.canvas.width = boardPixelSize * dpr;
        this.canvas.height = boardPixelSize * dpr;
        this.canvas.style.width = boardPixelSize + 'px';
        this.canvas.style.height = boardPixelSize + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.boardX = 0;
        this.boardY = 0;
    }

    // 获取格子像素坐标
    getCellPos(row, col) {
        return {
            x: this.boardX + col * this.cellSize + this.cellSize / 2,
            y: this.boardY + row * this.cellSize + this.cellSize / 2
        };
    }

    // 像素坐标转格子坐标
    pixelToCell(px, py) {
        const col = Math.floor((px - this.boardX) / this.cellSize);
        const row = Math.floor((py - this.boardY) / this.cellSize);
        if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
            return { row, col };
        }
        return null;
    }

    // 主渲染循环
    render(board, dt) {
        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, w, h);

        // 绘制棋盘背景
        this.drawBoardBackground(ctx, w, h);

        // 更新动画
        this.animations.update(dt);

        // 更新震动
        if (this.shakeOffset.x !== 0 || this.shakeOffset.y !== 0) {
            this.shakeOffset.x *= 0.9;
            this.shakeOffset.y *= 0.9;
            if (Math.abs(this.shakeOffset.x) < 0.5) this.shakeOffset.x = 0;
            if (Math.abs(this.shakeOffset.y) < 0.5) this.shakeOffset.y = 0;
        }

        ctx.save();
        ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

        // 绘制甜品元素
        if (board) {
            for (let r = 0; r < this.boardSize; r++) {
                for (let c = 0; c < this.boardSize; c++) {
                    const cell = board[r][c];
                    // 先绘制石头障碍
                    if (cell.obstacle === OBSTACLE_TYPES.STONE) {
                        this.drawStone(ctx, r, c);
                        continue;
                    }
                    if (cell.type >= 0 || cell.type === -2) {
                        this.drawCandy(ctx, cell, r, c);
                        // 绘制冰块覆盖层
                        if (cell.obstacle === OBSTACLE_TYPES.ICE) {
                            this.drawIce(ctx, r, c);
                        }
                    }
                }
            }
        }

        // 绘制选中高亮
        if (this.selectedCell) {
            this.drawSelection(ctx, this.selectedCell.row, this.selectedCell.col);
        }

        // 绘制提示高亮
        if (this.hintCells && this.hintCells.length === 2) {
            this.drawHintHighlight(ctx, this.hintCells);
        }

        ctx.restore();

        // 绘制粒子
        this.updateAndDrawParticles(ctx, dt);

        // 绘制浮动文字
        this.updateFloatingTexts(ctx, dt);

        // 绘制甜蜜风暴特效
        if (this.sweetStormActive) {
            this.drawSweetStorm(ctx, w, h, dt);
        }

        // 绘制连击文字
        if (this.comboText) {
            this.drawComboText(ctx, w, h);
        }

        // 绘制终极一击过场
        if (this.ultimateEffect && this.ultimateEffect.active) {
            this.drawUltimateEffect(ctx, w, h, dt);
        }
    }

    // 绘制棋盘背景
    drawBoardBackground(ctx, w, h) {
        // 华夫格背景
        ctx.fillStyle = 'rgba(139, 90, 43, 0.15)';
        ctx.fillRect(0, 0, w, h);

        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const x = this.boardX + c * this.cellSize;
                const y = this.boardY + r * this.cellSize;
                const isLight = (r + c) % 2 === 0;

                // 格子背景
                ctx.fillStyle = isLight ? 'rgba(255, 248, 225, 0.6)' : 'rgba(255, 236, 179, 0.6)';
                ctx.beginPath();
                ctx.roundRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4);
                ctx.fill();

                // 格子边框
                ctx.strokeStyle = 'rgba(188, 143, 85, 0.2)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    // 绘制甜品
    drawCandy(ctx, cell, row, col) {
        const pos = this.getCellPos(row, col);
        let x = pos.x;
        let y = pos.y;

        // 如果有动画位置偏移
        if (cell.animX !== undefined) x = cell.animX;
        if (cell.animY !== undefined) y = cell.animY;

        const size = this.cellSize * 0.4 * (cell.scale || 1);
        const alpha = cell.alpha !== undefined ? cell.alpha : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);

        // 发光效果（特殊元素）
        if (cell.special !== SPECIAL_TYPES.NONE) {
            this.drawSpecialGlow(ctx, cell.special, size);
        }

        // 选中时的弹跳效果
        if (cell.selected) {
            const bounce = Math.sin(Date.now() * 0.01) * 2;
            ctx.translate(0, bounce);
        }

        // 绘制彩色背景圆圈 - 仅普通元素使用淡色背景，特殊元素不绘制（由发光效果替代）
        if (cell.type >= 0 && cell.type < CANDY_COLORS.length && cell.special === SPECIAL_TYPES.NONE) {
            const bgRadius = this.cellSize * 0.36;
            ctx.beginPath();
            ctx.arc(0, 0, bgRadius, 0, Math.PI * 2);
            ctx.fillStyle = CANDY_COLORS[cell.type][1] + '40';
            ctx.fill();
        }

        // 绘制甜品emoji - 大格子用0.55，小格子(10×10)用0.65确保清晰
        const emojiRatio = this.boardSize >= 10 ? 0.65 : 0.58;
        const fontSize = Math.max(16, Math.floor(this.cellSize * emojiRatio));
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 特殊标记的字体大小 - 小格子时相对更大
        const markerRatio = this.boardSize >= 10 ? 0.55 : 0.45;

        if (cell.type === -2 || cell.special === SPECIAL_TYPES.RAINBOW) {
            // 万能味觉精灵 - 彩虹效果 + 放大 + 旋转
            const hue = (Date.now() * 0.15) % 360;
            ctx.save();
            ctx.rotate(Math.sin(Date.now() * 0.002) * 0.15);
            const rainbowScale = 1.15 + Math.sin(Date.now() * 0.005) * 0.08;
            ctx.scale(rainbowScale, rainbowScale);
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowBlur = 20;
            ctx.fillText('🌟', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        } else if (cell.special === SPECIAL_TYPES.LINE_H || cell.special === SPECIAL_TYPES.LINE_V) {
            // 糖霜喷射器 - 金色边框 + 放大脉冲
            const lineScale = 1.05 + Math.sin(Date.now() * 0.006) * 0.06;
            ctx.save();
            ctx.scale(lineScale, lineScale);
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 18;
            ctx.fillText(CANDY_EMOJIS[cell.type] || '🍬', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
            // 方向箭头标记 - 更大更醒目
            ctx.font = `bold ${Math.max(10, Math.floor(fontSize * markerRatio))}px serif`;
            const arrowAlpha = 0.7 + Math.sin(Date.now() * 0.008) * 0.3;
            ctx.globalAlpha = arrowAlpha * alpha;
            ctx.fillText(cell.special === SPECIAL_TYPES.LINE_H ? '↔️' : '↕️', size * 0.85, -size * 0.65);
            ctx.globalAlpha = alpha;
        } else if (cell.special === SPECIAL_TYPES.BOMB) {
            // 奶油爆弹 - 红色脉冲 + 放大
            const bombScale = 1.08 + Math.sin(Date.now() * 0.007) * 0.07;
            ctx.save();
            ctx.scale(bombScale, bombScale);
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 20;
            ctx.fillText(CANDY_EMOJIS[cell.type] || '🍬', 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
            // 爆炸标记 - 更大更醒目
            ctx.font = `${Math.max(10, Math.floor(fontSize * markerRatio))}px serif`;
            const bombAlpha = 0.7 + Math.sin(Date.now() * 0.008) * 0.3;
            ctx.globalAlpha = bombAlpha * alpha;
            ctx.fillText('💥', size * 0.85, -size * 0.65);
            ctx.globalAlpha = alpha;
        } else {
            // 普通甜品 - 无额外效果
            ctx.fillText(CANDY_EMOJIS[cell.type] || '🍬', 0, 0);
        }

        ctx.restore();
    }

    // 绘制特殊元素发光 - 增强版，更醒目
    drawSpecialGlow(ctx, special, size) {
        const time = Date.now() * 0.004;
        const pulse = 0.5 + Math.sin(time) * 0.3;
        const fastPulse = 0.6 + Math.sin(time * 2) * 0.4;

        switch (special) {
            case SPECIAL_TYPES.LINE_H:
            case SPECIAL_TYPES.LINE_V: {
                // 糖霜喷射器 - 金色脉冲光环 + 旋转光线
                const glowSize = size * 1.8 * (1 + Math.sin(time) * 0.1);
                // 外层大光晕
                const grad1 = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, glowSize);
                grad1.addColorStop(0, `rgba(255, 215, 0, ${0.6 * fastPulse})`);
                grad1.addColorStop(0.5, `rgba(255, 165, 0, ${0.3 * fastPulse})`);
                grad1.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.beginPath();
                ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
                ctx.fillStyle = grad1;
                ctx.fill();
                // 方向指示光线
                ctx.save();
                ctx.globalAlpha = 0.4 + Math.sin(time * 1.5) * 0.3;
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.lineDashOffset = -Date.now() * 0.02;
                if (special === SPECIAL_TYPES.LINE_H) {
                    ctx.beginPath();
                    ctx.moveTo(-size * 2.5, 0);
                    ctx.lineTo(size * 2.5, 0);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(0, -size * 2.5);
                    ctx.lineTo(0, size * 2.5);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
                ctx.restore();
                // 旋转菱形边框
                ctx.save();
                ctx.rotate(time * 0.5);
                ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + Math.sin(time * 2) * 0.3})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                const ds = size * 1.3;
                ctx.moveTo(0, -ds); ctx.lineTo(ds, 0); ctx.lineTo(0, ds); ctx.lineTo(-ds, 0);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
                break;
            }
            case SPECIAL_TYPES.BOMB: {
                // 奶油爆弹 - 红色脉冲 + 爆炸波纹
                const bombSize = size * 2.0 * (1 + Math.sin(time * 1.5) * 0.15);
                // 内层红色光晕
                const grad2 = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, bombSize);
                grad2.addColorStop(0, `rgba(255, 50, 50, ${0.7 * fastPulse})`);
                grad2.addColorStop(0.4, `rgba(255, 100, 50, ${0.4 * fastPulse})`);
                grad2.addColorStop(0.7, `rgba(255, 150, 0, ${0.2 * fastPulse})`);
                grad2.addColorStop(1, 'rgba(255, 50, 50, 0)');
                ctx.beginPath();
                ctx.arc(0, 0, bombSize, 0, Math.PI * 2);
                ctx.fillStyle = grad2;
                ctx.fill();
                // 扩散波纹
                const wavePhase = (Date.now() * 0.002) % 1;
                const waveR = size * (1.0 + wavePhase * 1.5);
                ctx.beginPath();
                ctx.arc(0, 0, waveR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 80, 80, ${(1 - wavePhase) * 0.6})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                // 第二层波纹（错开相位）
                const wavePhase2 = ((Date.now() * 0.002) + 0.5) % 1;
                const waveR2 = size * (1.0 + wavePhase2 * 1.5);
                ctx.beginPath();
                ctx.arc(0, 0, waveR2, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 150, 0, ${(1 - wavePhase2) * 0.4})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                // 十字标记
                ctx.save();
                ctx.globalAlpha = 0.5 + Math.sin(time * 2) * 0.3;
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2;
                const cs = size * 1.2;
                ctx.beginPath();
                ctx.moveTo(-cs, 0); ctx.lineTo(cs, 0);
                ctx.moveTo(0, -cs); ctx.lineTo(0, cs);
                ctx.stroke();
                ctx.restore();
                break;
            }
            case SPECIAL_TYPES.RAINBOW: {
                // 万能味觉精灵 - 彩虹旋转光环
                const hue = (Date.now() * 0.15) % 360;
                const rainbowSize = size * 2.2 * (1 + Math.sin(time) * 0.1);
                // 彩虹渐变光晕
                const grad3 = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, rainbowSize);
                grad3.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.7)`);
                grad3.addColorStop(0.3, `hsla(${(hue + 60) % 360}, 100%, 60%, 0.4)`);
                grad3.addColorStop(0.6, `hsla(${(hue + 120) % 360}, 100%, 60%, 0.2)`);
                grad3.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.beginPath();
                ctx.arc(0, 0, rainbowSize, 0, Math.PI * 2);
                ctx.fillStyle = grad3;
                ctx.fill();
                // 旋转彩虹弧线
                ctx.save();
                const arcCount = 6;
                for (let i = 0; i < arcCount; i++) {
                    const arcHue = (hue + i * 60) % 360;
                    const startAngle = time + (Math.PI * 2 * i / arcCount);
                    ctx.beginPath();
                    ctx.arc(0, 0, size * 1.5, startAngle, startAngle + Math.PI / 3);
                    ctx.strokeStyle = `hsla(${arcHue}, 100%, 60%, ${0.6 + Math.sin(time + i) * 0.3})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                ctx.restore();
                // 闪烁星星
                ctx.save();
                for (let i = 0; i < 4; i++) {
                    const angle = time * 0.8 + (Math.PI * 2 * i / 4);
                    const dist = size * 1.6;
                    const sx = Math.cos(angle) * dist;
                    const sy = Math.sin(angle) * dist;
                    const starSize = 3 + Math.sin(time * 3 + i) * 1.5;
                    ctx.fillStyle = `hsla(${(hue + i * 90) % 360}, 100%, 80%, ${0.7 + Math.sin(time * 2 + i) * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, starSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                break;
            }
        }
    }

    // 绘制石头障碍
    drawStone(ctx, row, col) {
        const pos = this.getCellPos(row, col);
        const size = this.cellSize * 0.45;

        ctx.save();
        ctx.translate(pos.x, pos.y);

        // 石头背景
        const grad = ctx.createRadialGradient(-size * 0.2, -size * 0.2, size * 0.1, 0, 0, size);
        grad.addColorStop(0, '#9e9e9e');
        grad.addColorStop(0.5, '#757575');
        grad.addColorStop(1, '#424242');
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 石头纹理线条
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, -size * 0.2);
        ctx.lineTo(size * 0.3, size * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, size * 0.3);
        ctx.lineTo(size * 0.5, -size * 0.1);
        ctx.stroke();

        // 石头emoji - 大棋盘时增大比例
        const stoneRatio = this.boardSize >= 10 ? 0.55 : 0.45;
        const fontSize = Math.max(14, Math.floor(this.cellSize * stoneRatio));
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪨', 0, 0);

        ctx.restore();
    }

    // 绘制冰块覆盖层
    drawIce(ctx, row, col) {
        const pos = this.getCellPos(row, col);
        const size = this.cellSize * 0.46;
        const time = Date.now() * 0.002;

        ctx.save();
        ctx.translate(pos.x, pos.y);

        // 冰块半透明覆盖
        const iceGrad = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size);
        iceGrad.addColorStop(0, 'rgba(200, 230, 255, 0.15)');
        iceGrad.addColorStop(0.5, 'rgba(150, 210, 255, 0.3)');
        iceGrad.addColorStop(1, 'rgba(100, 180, 255, 0.4)');
        ctx.beginPath();
        ctx.roundRect(-size, -size, size * 2, size * 2, 6);
        ctx.fillStyle = iceGrad;
        ctx.fill();

        // 冰块边框
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.5 + Math.sin(time) * 0.2})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 冰裂纹
        ctx.strokeStyle = 'rgba(200, 230, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-size * 0.3, -size * 0.5);
        ctx.lineTo(size * 0.1, 0);
        ctx.lineTo(-size * 0.2, size * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(size * 0.1, 0);
        ctx.lineTo(size * 0.5, size * 0.2);
        ctx.stroke();

        // 冰块角标 - 大棋盘时增大比例
        const iceRatio = this.boardSize >= 10 ? 0.28 : 0.22;
        ctx.font = `${Math.max(10, Math.floor(this.cellSize * iceRatio))}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.8;
        ctx.fillText('🧊', size * 0.6, -size * 0.6);

        ctx.restore();
    }

    // 绘制选中高亮
    drawSelection(ctx, row, col) {
        const pos = this.getCellPos(row, col);
        const size = this.cellSize * 0.5;
        const time = Date.now() * 0.005;
        const pulse = 1 + Math.sin(time) * 0.08;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.scale(pulse, pulse);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-size, -size, size * 2, size * 2, 8);
        ctx.stroke();
        ctx.restore();
    }

    // 绘制提示高亮
    drawHintHighlight(ctx, cells) {
        const time = Date.now() * 0.006;
        const pulse = 1 + Math.sin(time) * 0.12;
        const glowAlpha = 0.4 + Math.sin(time * 1.5) * 0.3;

        for (const cell of cells) {
            const pos = this.getCellPos(cell.r, cell.c);
            const size = this.cellSize * 0.5;

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.scale(pulse, pulse);

            // 外发光
            ctx.shadowColor = '#00e676';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = `rgba(0, 230, 118, ${glowAlpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(-size, -size, size * 2, size * 2, 10);
            ctx.stroke();

            // 内发光填充
            ctx.fillStyle = `rgba(0, 230, 118, ${glowAlpha * 0.2})`;
            ctx.fill();

            ctx.restore();
        }

        // 绘制连接箭头
        if (cells.length === 2) {
            const p1 = this.getCellPos(cells[0].r, cells[0].c);
            const p2 = this.getCellPos(cells[1].r, cells[1].c);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.save();
            ctx.globalAlpha = glowAlpha;
            ctx.font = `${Math.floor(this.cellSize * 0.35)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💡', midX, midY - this.cellSize * 0.5);
            ctx.restore();
        }
    }

    // 生成消除粒子
    spawnRemoveParticles(row, col, color, count = 8) {
        const pos = this.getCellPos(row, col);
        const colors = [color, '#ffd700', '#ff69b4', '#fff'];
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(
                pos.x, pos.y,
                colors[Math.floor(Math.random() * colors.length)],
                {
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10 - 2,
                    size: 2 + Math.random() * 4,
                    shape: ['circle', 'star', 'heart'][Math.floor(Math.random() * 3)]
                }
            ));
        }
    }

    // 生成特效粒子
    spawnSpecialParticles(row, col, type) {
        const pos = this.getCellPos(row, col);
        const count = type === 'sweet_storm' ? 60 : 30;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 3 + Math.random() * 8;
            const colors = ['#ffd700', '#ff69b4', '#ff6b9d', '#4fc3f7', '#ffa726', '#ab47bc', '#fff'];
            this.particles.push(new Particle(
                pos.x, pos.y,
                colors[Math.floor(Math.random() * colors.length)],
                {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 3 + Math.random() * 6,
                    decay: 0.01 + Math.random() * 0.01,
                    gravity: 0.05,
                    shape: ['circle', 'star', 'heart'][Math.floor(Math.random() * 3)]
                }
            ));
        }
    }

    // 生成甜蜜风暴粒子
    spawnSweetStormParticles() {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        this.sweetStormActive = true;
        this.sweetStormTimer = 2.0;

        for (let i = 0; i < 100; i++) {
            const colors = ['#ffd700', '#ff69b4', '#ff6b9d', '#4fc3f7', '#ffa726', '#ab47bc', '#e91e63', '#fff'];
            this.particles.push(new Particle(
                Math.random() * w, Math.random() * h,
                colors[Math.floor(Math.random() * colors.length)],
                {
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    size: 4 + Math.random() * 8,
                    decay: 0.008,
                    gravity: 0,
                    shape: ['circle', 'star', 'heart'][Math.floor(Math.random() * 3)]
                }
            ));
        }
    }

    // 更新和绘制粒子
    updateAndDrawParticles(ctx, dt) {
        this.particles = this.particles.filter(p => {
            p.update();
            p.draw(ctx);
            return p.life > 0;
        });
    }

    // 添加浮动文字
    addFloatingText(text, x, y, color = '#ffd700', size = 20) {
        this.floatingTexts.push({
            text, x, y, color, size,
            life: 1.0,
            vy: -2
        });
    }

    // 更新浮动文字
    updateFloatingTexts(ctx, dt) {
        this.floatingTexts = this.floatingTexts.filter(ft => {
            ft.y += ft.vy;
            ft.life -= 0.02;
            if (ft.life <= 0) return false;

            ctx.save();
            ctx.globalAlpha = ft.life;
            ctx.font = `bold ${ft.size}px 'PingFang SC', sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = ft.color;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
            return true;
        });
    }

    // 显示连击文字
    showCombo(combo) {
        if (combo >= 2) {
            this.comboText = {
                text: `${combo}x 连击！`,
                life: 1.5,
                scale: 0
            };
        }
    }

    // 绘制连击文字
    drawComboText(ctx, w, h) {
        if (!this.comboText) return;
        this.comboText.life -= 0.02;
        this.comboText.scale = Math.min(1, this.comboText.scale + 0.1);

        if (this.comboText.life <= 0) {
            this.comboText = null;
            return;
        }

        ctx.save();
        ctx.globalAlpha = Math.min(1, this.comboText.life);
        ctx.translate(w / 2, h * 0.3);
        ctx.scale(this.comboText.scale, this.comboText.scale);
        ctx.font = `bold 36px 'PingFang SC', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255, 105, 180, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText(this.comboText.text, 0, 0);
        ctx.restore();
    }

    // 绘制甜蜜风暴特效
    drawSweetStorm(ctx, w, h, dt) {
        this.sweetStormTimer -= dt;
        if (this.sweetStormTimer <= 0) {
            this.sweetStormActive = false;
            return;
        }

        const alpha = Math.min(0.3, this.sweetStormTimer * 0.15);
        const hue = (Date.now() * 0.2) % 360;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // 终极一击过场动画
    showUltimateEffect(canvasW, canvasH) {
        this.ultimateEffect = {
            active: true,
            timer: 2.5,
            phase: 0, // 0=闪入, 1=展示, 2=淡出
            w: canvasW || this.canvas.width / (window.devicePixelRatio || 1),
            h: canvasH || this.canvas.height / (window.devicePixelRatio || 1),
        };
    }

    // 绘制终极一击过场
    drawUltimateEffect(ctx, w, h, dt) {
        if (!this.ultimateEffect || !this.ultimateEffect.active) return;

        const ue = this.ultimateEffect;
        ue.timer -= dt;

        if (ue.timer <= 0) {
            ue.active = false;
            return;
        }

        const totalDuration = 2.5;
        const elapsed = totalDuration - ue.timer;

        // 阶段计算
        let alpha = 1;
        let textScale = 1;
        let bgAlpha = 0;

        if (elapsed < 0.3) {
            // 闪入阶段
            const t = elapsed / 0.3;
            alpha = t;
            textScale = 2.0 - t * 1.0; // 从2x缩到1x
            bgAlpha = t * 0.7;
        } else if (elapsed < 1.8) {
            // 展示阶段
            alpha = 1;
            textScale = 1.0 + Math.sin((elapsed - 0.3) * 4) * 0.05;
            bgAlpha = 0.7;
        } else {
            // 淡出阶段
            const t = (elapsed - 1.8) / 0.7;
            alpha = 1 - t;
            textScale = 1.0 + t * 0.3;
            bgAlpha = 0.7 * (1 - t);
        }

        ctx.save();

        // 背景遮罩 - 从中心扩散的渐变
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        bgGrad.addColorStop(0, `rgba(255, 50, 100, ${bgAlpha * 0.3})`);
        bgGrad.addColorStop(0.5, `rgba(100, 0, 150, ${bgAlpha * 0.5})`);
        bgGrad.addColorStop(1, `rgba(0, 0, 0, ${bgAlpha * 0.8})`);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // 闪光线条
        if (elapsed < 1.5) {
            const lineCount = 12;
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.globalAlpha = alpha * 0.6;
            for (let i = 0; i < lineCount; i++) {
                const angle = (Math.PI * 2 * i / lineCount) + elapsed * 2;
                const len = Math.max(w, h) * (elapsed < 0.5 ? elapsed * 2 : 1);
                const hue = (i * 30 + elapsed * 100) % 360;
                ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
                ctx.lineWidth = 3 - elapsed;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 主文字 "终极一击！"
        ctx.globalAlpha = alpha;
        ctx.translate(w / 2, h / 2);
        ctx.scale(textScale, textScale);

        // 文字阴影/光晕
        const hue = (Date.now() * 0.2) % 360;
        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        ctx.shadowBlur = 30;
        ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.12)}px 'PingFang SC', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 描边
        ctx.strokeStyle = `hsl(${(hue + 180) % 360}, 100%, 30%)`;
        ctx.lineWidth = 6;
        ctx.strokeText('⚡ 终极一击！⚡', 0, 0);

        // 渐变填充
        const textGrad = ctx.createLinearGradient(-100, -20, 100, 20);
        textGrad.addColorStop(0, '#ffd700');
        textGrad.addColorStop(0.3, '#ff6b9d');
        textGrad.addColorStop(0.6, '#ffd700');
        textGrad.addColorStop(1, '#ff69b4');
        ctx.fillStyle = textGrad;
        ctx.fillText('⚡ 终极一击！⚡', 0, 0);

        ctx.shadowBlur = 0;

        // 副文字
        if (elapsed > 0.4 && elapsed < 2.0) {
            ctx.globalAlpha = alpha * 0.8;
            ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.05)}px 'PingFang SC', sans-serif`;
            ctx.fillStyle = '#ffd700';
            ctx.fillText('🌪️ 甜蜜风暴 · 全屏消除 🌪️', 0, Math.min(w, h) * 0.1);
        }

        ctx.restore();
    }

    // 震动效果
    shake(intensity = 5) {
        this.shakeOffset.x = (Math.random() - 0.5) * intensity * 2;
        this.shakeOffset.y = (Math.random() - 0.5) * intensity * 2;
    }
}
