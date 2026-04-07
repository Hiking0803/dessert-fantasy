// 玩家数据管理 - 本地存储 + 服务器同步
import { getCurrentTitle } from './levels.js';

const STORAGE_KEY = 'dessert_fantasy_save';
const API_BASE = '/api';

// 默认玩家数据
function getDefaultPlayerData() {
    return {
        name: '',
        engName: '',
        isEnterprise: false,
        character: 'boy', // 角色形象：boy 或 girl
        level: 1,
        exp: 0,
        coins: 500,
        totalScore: 0,
        maxCombo: 0,
        levelsCleared: {},  // { levelId: { stars, score, cleared } }
        achievements: [],    // 已解锁的成就ID列表
        tools: { shuffle: 3 },
        settings: { sfx: true, music: true, vibrate: true, particles: true },
        createdAt: new Date().toISOString(),
        lastPlayedAt: new Date().toISOString(),
    };
}

export class PlayerManager {
    constructor() {
        this.data = getDefaultPlayerData();
        this.serverSyncEnabled = false;
        this.syncTimer = null;
    }

    // 从本地加载
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = { ...getDefaultPlayerData(), ...parsed };
                return true;
            }
        } catch (e) {
            console.warn('加载存档失败:', e);
        }
        return false;
    }

    // 保存到本地
    save() {
        try {
            this.data.lastPlayedAt = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
            // 异步同步到服务器
            if (this.serverSyncEnabled) {
                this.syncToServer();
            }
        } catch (e) {
            console.warn('保存存档失败:', e);
        }
    }

    // 清除存档
    clearData() {
        this.data = getDefaultPlayerData();
        localStorage.removeItem(STORAGE_KEY);
    }

    // 设置玩家名
    setName(name) {
        this.data.name = name;
        this.save();
    }

    // 企业登录
    async enterpriseLogin() {
        try {
            const resp = await fetch('/ts:auth/tauth/info.ashx');
            if (resp.ok) {
                const info = await resp.json();
                this.data.name = info.ChnName || info.EngName || '甜点师';
                this.data.engName = info.EngName || '';
                this.data.isEnterprise = true;
                this.serverSyncEnabled = true;
                this.save();
                // 尝试从服务器加载存档
                await this.loadFromServer();
                return true;
            }
        } catch (e) {
            console.warn('企业登录失败:', e);
        }
        return false;
    }

    // 同步到服务器
    async syncToServer() {
        if (!this.data.name) return;
        try {
            await fetch(`${API_BASE}/player/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.data.name,
                    eng_name: this.data.engName,
                    is_enterprise: this.data.isEnterprise,
                    level: this.data.level,
                    exp: this.data.exp,
                    coins: this.data.coins,
                    total_score: this.data.totalScore,
                    max_combo: this.data.maxCombo,
                    levels_cleared: JSON.stringify(this.data.levelsCleared),
                    achievements: JSON.stringify(this.data.achievements),
                    tools: JSON.stringify(this.data.tools),
                })
            });
        } catch (e) {
            // 静默失败，下次再同步
        }
    }

    // 从服务器加载
    async loadFromServer() {
        if (!this.data.name) return;
        try {
            const resp = await fetch(`${API_BASE}/player/load?name=${encodeURIComponent(this.data.name)}`);
            if (resp.ok) {
                const serverData = await resp.json();
                if (serverData && serverData.name) {
                    // 合并服务器数据（取较高值）
                    this.data.coins = Math.max(this.data.coins, serverData.coins || 0);
                    this.data.totalScore = Math.max(this.data.totalScore, serverData.total_score || 0);
                    this.data.maxCombo = Math.max(this.data.maxCombo, serverData.max_combo || 0);
                    this.data.level = Math.max(this.data.level, serverData.level || 1);
                    this.data.exp = Math.max(this.data.exp, serverData.exp || 0);
                    if (serverData.levels_cleared) {
                        const serverLevels = JSON.parse(serverData.levels_cleared);
                        for (const [k, v] of Object.entries(serverLevels)) {
                            if (!this.data.levelsCleared[k] || v.score > this.data.levelsCleared[k].score) {
                                this.data.levelsCleared[k] = v;
                            }
                        }
                    }
                    if (serverData.achievements) {
                        const serverAch = JSON.parse(serverData.achievements);
                        for (const a of serverAch) {
                            if (!this.data.achievements.includes(a)) {
                                this.data.achievements.push(a);
                            }
                        }
                    }
                    this.save();
                }
            }
        } catch (e) {
            // 静默失败
        }
    }

    // 更新关卡成绩
    updateLevelResult(levelId, score, stars) {
        const key = String(levelId);
        const existing = this.data.levelsCleared[key];
        if (!existing || score > existing.score) {
            this.data.levelsCleared[key] = { stars: Math.max(stars, existing?.stars || 0), score, cleared: true };
        } else if (stars > existing.stars) {
            this.data.levelsCleared[key].stars = stars;
        }

        // 增加经验和金币
        const expGain = 20 + stars * 10;
        const coinGain = 50 + stars * 30 + Math.floor(score / 100);
        this.data.exp += expGain;
        this.data.coins += coinGain;
        this.data.totalScore += score;

        // 检查升级
        this.checkLevelUp();
        this.save();

        return { expGain, coinGain };
    }

    // 检查升级
    checkLevelUp() {
        const expNeeded = this.data.level * 100;
        while (this.data.exp >= expNeeded) {
            this.data.exp -= expNeeded;
            this.data.level++;
        }
    }

    // 获取总星数
    getTotalStars() {
        let total = 0;
        for (const v of Object.values(this.data.levelsCleared)) {
            total += v.stars || 0;
        }
        return total;
    }

    // 获取已通关数
    getClearedCount() {
        return Object.values(this.data.levelsCleared).filter(v => v.cleared).length;
    }

    // 获取当前称号
    getTitle() {
        return getCurrentTitle(this.data.level);
    }

    // 解锁成就
    unlockAchievement(id) {
        if (!this.data.achievements.includes(id)) {
            this.data.achievements.push(id);
            this.save();
            return true;
        }
        return false;
    }

    // 检查成就条件
    checkAchievements(context = {}) {
        const newAchievements = [];

        // 首次通关
        if (this.getClearedCount() >= 1 && !this.data.achievements.includes('first_clear')) {
            newAchievements.push('first_clear');
        }
        // 连击
        if (context.combo >= 5 && !this.data.achievements.includes('combo_5')) {
            newAchievements.push('combo_5');
        }
        if (context.combo >= 10 && !this.data.achievements.includes('combo_10')) {
            newAchievements.push('combo_10');
        }
        // 甜蜜风暴
        if (context.sweetStorm && !this.data.achievements.includes('sweet_storm')) {
            newAchievements.push('sweet_storm');
        }
        // 高分
        if (context.score >= 50000 && !this.data.achievements.includes('score_50k')) {
            newAchievements.push('score_50k');
        }
        // 通关数
        const cleared = this.getClearedCount();
        if (cleared >= 5 && !this.data.achievements.includes('clear_5')) newAchievements.push('clear_5');
        if (cleared >= 10 && !this.data.achievements.includes('clear_10')) newAchievements.push('clear_10');
        if (cleared >= 15 && !this.data.achievements.includes('clear_15')) newAchievements.push('clear_15');
        if (cleared >= 20 && !this.data.achievements.includes('clear_20')) newAchievements.push('clear_20');
        if (cleared >= 30 && !this.data.achievements.includes('clear_30')) newAchievements.push('clear_30');
        // 星星
        if (this.getTotalStars() >= 30 && !this.data.achievements.includes('star_hunter')) {
            newAchievements.push('star_hunter');
        }
        // 闪电通关
        if (context.movesLeft >= 15 && !this.data.achievements.includes('speed_clear')) {
            newAchievements.push('speed_clear');
        }

        for (const id of newAchievements) {
            this.unlockAchievement(id);
        }

        return newAchievements;
    }

    // 使用道具
    useTool(toolId) {
        if (this.data.tools[toolId] > 0) {
            this.data.tools[toolId]--;
            this.save();
            return true;
        }
        return false;
    }

    // 获取排行榜（仅显示真实玩家数据）
    async getRankings(type = 'score') {
        try {
            const resp = await fetch(`${API_BASE}/rankings?type=${type}`);
            if (resp.ok) {
                const serverRankings = await resp.json();
                // 确保当前玩家在排行榜中
                if (this.data.name && serverRankings.length > 0) {
                    const playerInList = serverRankings.find(r => r.name === this.data.name);
                    if (!playerInList) {
                        const playerValue = type === 'score' ? this.data.totalScore :
                            type === 'level' ? this.getClearedCount() :
                                this.getTotalStars();
                        if (playerValue > 0) {
                            serverRankings.push({
                                rank: serverRankings.length + 1,
                                name: this.data.name,
                                value: playerValue,
                                avatar: '🧑‍🍳',
                                isPlayer: true
                            });
                            serverRankings.sort((a, b) => b.value - a.value);
                            serverRankings.forEach((r, i) => r.rank = i + 1);
                        }
                    } else {
                        playerInList.isPlayer = true;
                    }
                }
                return serverRankings;
            }
        } catch (e) {
            // 服务器不可用，返回仅包含当前玩家的排行榜
        }
        return this.getLocalRankings(type);
    }

    // 本地排行榜（仅显示当前玩家真实数据，无模拟数据）
    getLocalRankings(type) {
        const rankings = [];

        // 只显示当前玩家的真实数据
        if (this.data.name) {
            const playerValue = type === 'score' ? this.data.totalScore :
                type === 'level' ? this.getClearedCount() :
                    this.getTotalStars();
            rankings.push({
                rank: 1,
                name: this.data.name,
                value: playerValue,
                avatar: '🧑‍🍳',
                isPlayer: true
            });
        }

        if (rankings.length === 0) {
            return [{ rank: '-', name: '暂无数据', value: 0, avatar: '🍰' }];
        }

        return rankings;
    }
}
