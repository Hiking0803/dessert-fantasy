// 关卡配置数据
// 棋盘大小：1-3关 6×6，4-9关 8×8，10+关 10×10
// 分数梯度：1-3关 1500/2000/2500（+500），4-9关 3000~8000（+1000），10-15关 9000起（+2000），16-30关 高难度
// 障碍物：16关起引入障碍物（冰块、石头等）
export const LEVEL_DATA = [
    // === 第一赛区：新手入门（1-3关，6×6棋盘）===
    { id: 1, name: '甜蜜起步', moves: 35, targetScore: 1500, stars: [1500, 2500, 4000], desc: '新手关卡 · 6×6棋盘 · 消除甜品达到目标分数', boardSize: 6 },
    { id: 2, name: '奶油初试', moves: 32, targetScore: 2000, stars: [2000, 3500, 5500], desc: '进阶关卡 · 6×6棋盘 · 尝试合成四连特效', boardSize: 6 },
    { id: 3, name: '糖霜之路', moves: 30, targetScore: 2500, stars: [2500, 4500, 7000], desc: '新手毕业 · 6×6棋盘 · 利用糖霜喷射器消除整行', boardSize: 6 },
    // === 第二赛区：中级挑战（4-9关，8×8棋盘）===
    { id: 4, name: '马卡龙塔', moves: 30, targetScore: 3000, stars: [3000, 5000, 8000], desc: '中级挑战 · 8×8棋盘 · 合成更多特效甜品', boardSize: 8 },
    { id: 5, name: '布丁迷宫', moves: 28, targetScore: 4000, stars: [4000, 6500, 10000], desc: '8×8棋盘 · 挑战更高分数', boardSize: 8 },
    { id: 6, name: '冰淇淋山', moves: 26, targetScore: 5000, stars: [5000, 8000, 12000], desc: '8×8棋盘 · 尝试五连直线', boardSize: 8 },
    { id: 7, name: '巧克力河', moves: 26, targetScore: 6000, stars: [6000, 9500, 14000], desc: '8×8棋盘 · 利用万能味觉精灵', boardSize: 8 },
    { id: 8, name: '甜甜圈桥', moves: 24, targetScore: 7000, stars: [7000, 11000, 16000], desc: '8×8棋盘 · 组合特效获得高分', boardSize: 8 },
    { id: 9, name: '蛋糕城堡', moves: 24, targetScore: 8000, stars: [8000, 12500, 18000], desc: '8×8棋盘 · 挑战组合技', boardSize: 8 },
    // === 第三赛区：高级挑战（10-15关，10×10棋盘）===
    { id: 10, name: '糖果风暴', moves: 26, targetScore: 9000, stars: [9000, 14000, 21000], desc: '高级挑战 · 10×10棋盘 · 触发甜蜜风暴', boardSize: 10 },
    { id: 11, name: '奶油漩涡', moves: 24, targetScore: 11000, stars: [11000, 17000, 25000], desc: '10×10棋盘 · 连续消除获得连击', boardSize: 10 },
    { id: 12, name: '焦糖瀑布', moves: 22, targetScore: 13000, stars: [13000, 20000, 29000], desc: '10×10棋盘 · 策略性消除', boardSize: 10 },
    { id: 13, name: '彩虹糖道', moves: 22, targetScore: 15000, stars: [15000, 23000, 33000], desc: '10×10棋盘 · 利用所有特效', boardSize: 10 },
    { id: 14, name: '星光厨房', moves: 20, targetScore: 17000, stars: [17000, 26000, 37000], desc: '10×10棋盘 · 终极挑战前奏', boardSize: 10 },
    { id: 15, name: '🏆 大师对决', moves: 22, targetScore: 19000, stars: [19000, 29000, 42000], desc: '10×10棋盘 · Boss关卡！', isBoss: true, boardSize: 10 },
    // === 第四赛区：障碍挑战（16-22关，10×10棋盘 + 障碍物）===
    { id: 16, name: '🧊 冰封甜品', moves: 28, targetScore: 12000, stars: [12000, 18000, 26000], desc: '10×10棋盘 · 冰块障碍登场！消除冰块旁的甜品来破冰', boardSize: 10, obstacles: { ice: 8 } },
    { id: 17, name: '🪨 岩石糖果', moves: 26, targetScore: 13000, stars: [13000, 20000, 28000], desc: '10×10棋盘 · 石头障碍！无法移动的石头挡住去路', boardSize: 10, obstacles: { stone: 5 } },
    { id: 18, name: '🧊🪨 冰石交错', moves: 28, targetScore: 14000, stars: [14000, 21000, 30000], desc: '10×10棋盘 · 冰块+石头混合障碍', boardSize: 10, obstacles: { ice: 6, stone: 4 } },
    { id: 19, name: '❄️ 极寒甜品', moves: 26, targetScore: 15000, stars: [15000, 23000, 33000], desc: '10×10棋盘 · 大量冰块覆盖', boardSize: 10, obstacles: { ice: 12 } },
    { id: 20, name: '🏔️ 巨石阵', moves: 24, targetScore: 16000, stars: [16000, 24000, 35000], desc: '10×10棋盘 · 石头迷宫', boardSize: 10, obstacles: { stone: 8 } },
    { id: 21, name: '🌀 混沌甜品', moves: 26, targetScore: 17000, stars: [17000, 26000, 37000], desc: '10×10棋盘 · 冰石密布', boardSize: 10, obstacles: { ice: 10, stone: 6 } },
    { id: 22, name: '🏆 障碍大师', moves: 24, targetScore: 18000, stars: [18000, 28000, 40000], desc: '10×10棋盘 · 障碍Boss关！', isBoss: true, boardSize: 10, obstacles: { ice: 12, stone: 8 } },
    // === 第五赛区：极限挑战（23-30关，10×10棋盘 + 高难度障碍）===
    { id: 23, name: '🔥 烈焰厨房', moves: 24, targetScore: 20000, stars: [20000, 30000, 43000], desc: '10×10棋盘 · 极限步数挑战', boardSize: 10, obstacles: { ice: 8, stone: 4 } },
    { id: 24, name: '💎 水晶甜品', moves: 22, targetScore: 22000, stars: [22000, 33000, 47000], desc: '10×10棋盘 · 精准消除', boardSize: 10, obstacles: { ice: 10, stone: 6 } },
    { id: 25, name: '🌊 糖浆海洋', moves: 24, targetScore: 24000, stars: [24000, 36000, 50000], desc: '10×10棋盘 · 大量障碍', boardSize: 10, obstacles: { ice: 14, stone: 6 } },
    { id: 26, name: '⚡ 闪电甜品', moves: 22, targetScore: 26000, stars: [26000, 39000, 54000], desc: '10×10棋盘 · 极限步数', boardSize: 10, obstacles: { ice: 10, stone: 8 } },
    { id: 27, name: '🌙 月光厨房', moves: 22, targetScore: 28000, stars: [28000, 42000, 58000], desc: '10×10棋盘 · 高密度障碍', boardSize: 10, obstacles: { ice: 12, stone: 10 } },
    { id: 28, name: '☀️ 日出甜品', moves: 20, targetScore: 30000, stars: [30000, 45000, 62000], desc: '10×10棋盘 · 超高分挑战', boardSize: 10, obstacles: { ice: 14, stone: 8 } },
    { id: 29, name: '🌟 星辰甜品', moves: 20, targetScore: 33000, stars: [33000, 49000, 68000], desc: '10×10棋盘 · 终极前奏', boardSize: 10, obstacles: { ice: 14, stone: 10 } },
    { id: 30, name: '👑 传说之巅', moves: 22, targetScore: 36000, stars: [36000, 54000, 75000], desc: '10×10棋盘 · 最终Boss！全部障碍！', isBoss: true, boardSize: 10, obstacles: { ice: 16, stone: 12 } },
];

// 成就定义
export const ACHIEVEMENTS = [
    { id: 'first_clear', name: '初出茅庐', desc: '通过第一关', icon: '🎓', reward: 100 },
    { id: 'combo_5', name: '连击新手', desc: '达成5连击', icon: '🔥', reward: 200 },
    { id: 'combo_10', name: '连击大师', desc: '达成10连击', icon: '💥', reward: 500 },
    { id: 'sweet_storm', name: '甜蜜风暴', desc: '首次触发组合技', icon: '🌪️', reward: 300 },
    { id: 'all_stars_1', name: '完美区域', desc: '第一赛区全三星', icon: '⭐', reward: 1000 },
    { id: 'score_50k', name: '高分猎手', desc: '单局得分超过50000', icon: '🎯', reward: 500 },
    { id: 'clear_5', name: '甜品学徒', desc: '通过5个关卡', icon: '🧑‍🍳', reward: 200 },
    { id: 'clear_10', name: '甜品师傅', desc: '通过10个关卡', icon: '👨‍🍳', reward: 500 },
    { id: 'clear_15', name: '甜品大师', desc: '通过全部15个关卡', icon: '👩‍🍳', reward: 1000 },
    { id: 'clear_20', name: '障碍征服者', desc: '通过20个关卡', icon: '🧊', reward: 1500 },
    { id: 'clear_30', name: '传说甜点师', desc: '通过全部30个关卡', icon: '👑', reward: 3000 },
    { id: 'rainbow_3', name: '彩虹收集者', desc: '单局使用3个万能味觉精灵', icon: '🌈', reward: 300 },
    { id: 'no_special', name: '朴素之美', desc: '不使用特效通过一关', icon: '🍃', reward: 400 },
    { id: 'speed_clear', name: '闪电甜点师', desc: '剩余15步以上通关', icon: '⚡', reward: 300 },
    { id: 'weekly_champ', name: '周赛冠军', desc: '排行榜第一名', icon: '🏆', reward: 2000 },
    { id: 'star_hunter', name: '摘星能手', desc: '收集30颗星星', icon: '✨', reward: 800 },
];

// 称号定义
export const TITLES = [
    { id: 'beginner', name: '见习甜点师', level: 1, condition: '初始称号，开始你的甜品之旅' },
    { id: 'apprentice', name: '甜品学徒', level: 3, condition: '达到等级3（通关约3个关卡并获得星星）' },
    { id: 'baker', name: '烘焙师', level: 5, condition: '达到等级5（通关约5个关卡并获得较多星星）' },
    { id: 'patissier', name: '甜点师', level: 8, condition: '达到等级8（通关约8个关卡并获得高星评价）' },
    { id: 'chef', name: '甜品主厨', level: 12, condition: '达到等级12（通关大部分关卡并获得高分）' },
    { id: 'master', name: '甜品大师', level: 15, condition: '达到等级15（通关全部基础关卡）' },
    { id: 'obstacle', name: '障碍征服者', level: 20, condition: '达到等级20（征服障碍关卡）' },
    { id: 'legend', name: '传说甜点师', level: 25, condition: '达到等级25（挑战极限关卡）' },
    { id: 'god', name: '甜品之神', level: 30, condition: '达到等级30（通关全部30关并获得最高评价）' },
];

// 获取当前称号
export function getCurrentTitle(level) {
    let title = TITLES[0];
    for (const t of TITLES) {
        if (level >= t.level) title = t;
    }
    return title;
}
