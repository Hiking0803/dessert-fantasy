// 音效系统 - Web Audio API
export class AudioManager {
    constructor() {
        this.ctx = null;
        this.sfxEnabled = true;
        this.musicEnabled = true;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('音频初始化失败:', e);
        }
    }

    // 确保音频上下文已激活
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 播放音符
    playNote(freq, duration = 0.15, type = 'sine', volume = 0.3) {
        if (!this.sfxEnabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    // 消除音效 - 清脆的玻璃糖碰撞声
    playMatch(combo = 0) {
        if (!this.sfxEnabled) return;
        const baseFreq = 523 + combo * 80; // C5起，连击越高音越高
        this.playNote(baseFreq, 0.12, 'sine', 0.25);
        setTimeout(() => this.playNote(baseFreq * 1.25, 0.1, 'sine', 0.2), 50);
        setTimeout(() => this.playNote(baseFreq * 1.5, 0.08, 'sine', 0.15), 100);
    }

    // 特殊元素生成音效 - 魔法叮咚
    playSpecialCreate() {
        if (!this.sfxEnabled) return;
        this.playNote(880, 0.15, 'sine', 0.3);
        setTimeout(() => this.playNote(1108, 0.15, 'sine', 0.25), 80);
        setTimeout(() => this.playNote(1318, 0.2, 'sine', 0.2), 160);
    }

    // 糖霜喷射器音效 - 唰的喷射声
    playLineBlast() {
        if (!this.sfxEnabled) return;
        const noise = this.createNoise(0.3);
        if (noise) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.3);
            noise.connect(filter);
            filter.connect(this.ctx.destination);
        }
        this.playNote(440, 0.2, 'sawtooth', 0.15);
    }

    // 奶油爆弹音效 - 闷闷的爆炸声
    playBombBlast() {
        if (!this.sfxEnabled) return;
        this.playNote(100, 0.4, 'sine', 0.4);
        this.playNote(80, 0.5, 'triangle', 0.3);
        setTimeout(() => this.playNote(150, 0.3, 'sine', 0.2), 100);
    }

    // 万能味觉精灵音效 - 轻盈的精灵音效
    playRainbow() {
        if (!this.sfxEnabled) return;
        const notes = [523, 659, 784, 1046, 1318];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playNote(freq, 0.2, 'sine', 0.2), i * 60);
        });
    }

    // 甜蜜风暴音效 - 史诗感混合音效
    playSweetStorm() {
        if (!this.sfxEnabled) return;
        // 低频轰鸣
        this.playNote(60, 1.0, 'sine', 0.4);
        // 上升音阶
        const notes = [262, 330, 392, 523, 659, 784, 1046];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playNote(freq, 0.3, 'sine', 0.25), i * 80);
        });
        // 高频闪烁
        setTimeout(() => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => this.playNote(1500 + i * 200, 0.1, 'sine', 0.15), i * 50);
            }
        }, 500);
    }

    // 交换音效
    playSwap() {
        if (!this.sfxEnabled) return;
        this.playNote(440, 0.08, 'sine', 0.2);
        setTimeout(() => this.playNote(554, 0.08, 'sine', 0.2), 40);
    }

    // 无效交换音效
    playInvalidSwap() {
        if (!this.sfxEnabled) return;
        this.playNote(200, 0.15, 'square', 0.15);
        setTimeout(() => this.playNote(180, 0.15, 'square', 0.15), 100);
    }

    // 按钮点击音效
    playClick() {
        if (!this.sfxEnabled) return;
        this.playNote(660, 0.06, 'sine', 0.15);
    }

    // 胜利音效
    playWin() {
        if (!this.sfxEnabled) return;
        const melody = [523, 659, 784, 1046];
        melody.forEach((freq, i) => {
            setTimeout(() => this.playNote(freq, 0.3, 'sine', 0.3), i * 150);
        });
        setTimeout(() => this.playNote(1046, 0.6, 'sine', 0.25), 600);
    }

    // 失败音效
    playLose() {
        if (!this.sfxEnabled) return;
        this.playNote(330, 0.3, 'sine', 0.25);
        setTimeout(() => this.playNote(294, 0.3, 'sine', 0.25), 200);
        setTimeout(() => this.playNote(262, 0.5, 'sine', 0.2), 400);
    }

    // 成就解锁音效
    playAchievement() {
        if (!this.sfxEnabled) return;
        const notes = [523, 659, 784, 1046, 1318];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playNote(freq, 0.25, 'sine', 0.25), i * 100);
        });
    }

    // 创建噪声节点
    createNoise(duration) {
        if (!this.ctx) return null;
        try {
            const bufferSize = this.ctx.sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            source.connect(gain);
            source.start(this.ctx.currentTime);
            source.stop(this.ctx.currentTime + duration);
            return gain;
        } catch (e) {
            return null;
        }
    }
}
