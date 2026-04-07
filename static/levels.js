// 关卡配置数据
// 棋盘大小：1-3关 6×6，4-9关 8×8，10+关 10×10
// 分数梯度：1-3关 1500/2000/2500（+500），4-9关 3000~8000（+1000），10-15关 8000起（+2000）
export const LEVEL_DATA = [
    { id: 1, name: '甜蜜起步', moves: 35, targetScore: 1500, stars: [1500, 2500, 4000], desc: '新手关卡 · 6×6棋盘 · 消除甜品达到目标分数', boardSize: 6 },
    { id: 2, name: '奶油初试', moves: 32, targetScore: 2000, stars: [2000, 3500, 5500], desc: '进阶关卡 · 6×6棋盘 · 尝试合成四连特效', boardSize: 6 },
    { id: 3, name: '糖霜之路', moves: 30, targetScore: 2500, stars: [2500, 4500, 7000], desc: '新手毕业 · 6×6棋盘 · 利用糖霜喷射器消除整行', boardSize: 6 },
    { id: 4, name: '马卡龙塔', moves: 30, targetScore: 3000, stars: [3000, 5000, 8000], desc: '中级挑战 · 8×8棋盘 · 合成更多特效甜品', boardSize: 8 },
    { id: 5, name: '布丁迷宫', moves: 28, targetScore: 4000, stars: [4000, 6500, 10000], desc: '8×8棋盘 · 挑战更高分数', boardSize: 8 },
    { id: 6, name: '冰淇淋山', moves: 26, targetScore: 5000, stars: [5000, 8000, 12000], desc: '8×8棋盘 · 尝试五连直线', boardSize: 8 },
    { id: 7, name: '巧克力河', moves: 26, targetScore: 6000, stars: [6000, 9500, 14000], desc: '8×8棋盘 · 利用万能味觉精灵', boardSize: 8 },
    { id: 8, name: '甜甜圈桥', moves: 24, targetScore: 7000, stars: [7000, 11000, 16000], desc: '8×8棋盘 · 组合特效获得高分', boardSize: 8 },
    { id: 9, name: '蛋糕城堡', moves: 24, targetScore: 8000, stars: [8000, 12500, 18000], desc: '8×8棋盘 · 挑战组合技', boardSize: 8 },
    { id: 10, name: '糖果风暴', moves: 26, targetScore: 8000, stars: [8000, 13000, 20000], desc: '高级挑战 · 10×10棋盘 · 触发甜蜜风暴', boardSize: 10 },
    { id: 11, name: '奶油漩涡', moves: 24, targetScore: 10000, stars: [10000, 16000, 24000], desc: '10×10棋盘 · 连续消除获得连击', boardSize: 10 },
    { id: 12, name: '焦糖瀑布', moves: 22, targetScore: 12000, stars: [12000, 19000, 28000], desc: '10×10棋盘 · 策略性消除', boardSize: 10 },
    { id: 13, name: '彩虹糖道', moves: 22, targetScore: 14000, stars: [14000, 22000, 32000], desc: '10×10棋盘 · 利用所有特效', boardSize: 10 },
    { id: 14, name: '星光厨房', moves: 20, targetScore: 16000, stars: [16000, 25000, 36000], desc: '10×10棋盘 · 终极挑战前奏', boardSize: 10 },
    { id: 15, name: '🏆 大师对决', moves: 22, targetScore: 18000, stars: [18000, 28000, 40000], desc: '10×10棋盘 · Boss关卡！', isBoss: true, boardSize: 10 },
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
    { id: 'master', name: '甜品大师', level: 15, condition: '达到等级15（通关全部关卡并获得大量星星）' },
    { id: 'legend', name: '传说甜点师', level: 20, condition: '达到等级20（反复挑战关卡获取最高评价）' },
];

// 获取当前称号
export function getCurrentTitle(level) {
    let title = TITLES[0];
    for (const t of TITLES) {
        if (level >= t.level) title = t;
    }
    return title;
}
