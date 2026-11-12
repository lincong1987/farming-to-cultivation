/* 02-data — 游戏数据表（数值系统 V1.0）：作物 / 怪物 / 防御塔 / 武器 / 物品 / 境界 / 关卡 / 难度 / 强化。
   数值即玩法；口径与单位换算见 NUMBERS.md。 */
'use strict';

const DATA = window.DATA = (() => {

  /* ---- 境界（升仙）—— 谷道九阶 ------------------------------------------- */
  const REALMS = [
    { id: 0, name: '凡人', hp: 5, dmg: 1, speed: 1, need: 500, desc: '种在土里没人识' },
    { id: 1, name: '感气', hp: 6, dmg: 1.25, speed: 1.06, need: 2000, pill: 1, desc: '芽动，灵气随锄进出' },
    { id: 2, name: '筑基', hp: 7, dmg: 1.55, speed: 1.12, need: 6000, pill: 2, desc: '扎根。桃溪泉涌' },
    { id: 3, name: '结丹', hp: 8, dmg: 1.95, speed: 1.18, need: 15000, pill: 3, desc: '抽穗。吞天火一粒' },
    { id: 4, name: '元婴', hp: 10, dmg: 2.4, speed: 1.24, need: 35000, pill: 4, desc: '灌浆。废墟前立誓' },
    { id: 5, name: '化神', hp: 12, dmg: 3.0, speed: 1.3, need: 70000, pill: 5, desc: '开镰。斩梦而醒' },
    { id: 6, name: '炼虚', hp: 14, dmg: 3.8, speed: 1.35, need: 120000, pill: 6, desc: '归仓。知悉全部真相' },
    { id: 7, name: '合体', hp: 17, dmg: 4.8, speed: 1.4, need: 200000, pill: 7, desc: '人与谷，意合为一' },
    { id: 8, name: '大乘', hp: 20, dmg: 6.2, speed: 1.45, need: 320000, pill: 8, desc: '不是飞升之身，是可以育种之身' },
  ];

  /* ---- 难度（本区通关解锁下一档） ---------------------------------------- */
  const DIFFS = [
    { id: 0, name: '普通', hp: 1.0, atk: 1.0, spd: 1.0, drop: 1.0, mat: 1.0 },
    { id: 1, name: '困难', hp: 1.8, atk: 1.5, spd: 1.1, drop: 1.5, mat: 1.8 },
    { id: 2, name: '噩梦', hp: 3.0, atk: 2.2, spd: 1.25, drop: 2.5, mat: 3.0 },
  ];

  /* ---- 作物：12 种 -------------------------------------------------------- */
  const CROPS = {
    cabbage: { name: '白菜', cat: '凡', hours: 4, price: 12, seed: 3, yield: 2, xp: 30, water: 1.6, unlock: 0, color: 0xb9c96a },
    radish: { name: '萝卜', cat: '凡', hours: 6, price: 20, seed: 5, yield: 2, xp: 50, water: 1.8, unlock: 0, color: 0xe4715e },
    corn: { name: '灵豆', cat: '凡', hours: 9, price: 32, seed: 9, yield: 2, xp: 90, water: 2.0, unlock: 1, color: 0xf0c54a },
    tomato: { name: '番茄', cat: '凡', hours: 12, price: 45, seed: 14, yield: 3, xp: 130, water: 2.2, unlock: 1, color: 0xd8442f },
    chili: { name: '火辣椒', cat: '灵', hours: 16, price: 70, seed: 24, yield: 3, xp: 220, water: 2.4, unlock: 2, color: 0xe0341c },
    pumpkin: { name: '金南瓜', cat: '灵', hours: 20, price: 95, seed: 34, yield: 2, xp: 300, water: 2.6, unlock: 2, color: 0xf08a1e },
    eggplant: { name: '紫灵茄', cat: '灵', hours: 26, price: 130, seed: 52, yield: 3, xp: 430, water: 2.4, unlock: 3, color: 0x7a3f96 },
    herb: { name: '凝露灵草', cat: '灵', hours: 30, price: 165, seed: 70, yield: 2, xp: 560, water: 3.0, unlock: 3, color: 0x58c7a0 },
    lotus: { name: '赤焰火莲', cat: '仙', hours: 36, price: 260, seed: 120, yield: 3, xp: 800, water: 2.2, unlock: 4, color: 0xff5a3c },
    ginseng: { name: '寒冰雪参', cat: '仙', hours: 44, price: 360, seed: 180, yield: 2, xp: 1100, water: 1.6, unlock: 5, color: 0xa8e8ff },
    rice: { name: '紫金稻', cat: '仙', hours: 52, price: 520, seed: 280, yield: 4, xp: 1600, water: 3.4, unlock: 6, color: 0xd8b24a },
    peach: { name: '蟠桃苗', cat: '仙', hours: 64, price: 850, seed: 460, yield: 3, xp: 2400, water: 2.8, unlock: 6, color: 0xff9fc4 },
  };
  const CROP_IDS = Object.keys(CROPS);

  /* ---- 炮塔：18 座（品质白绿蓝紫橙 / 元素物理火冰雷真实增益经济） -----------
     dmg/rate/range 为 1 级基准；cost=造价（灵能）。升级曲线见 UPG_*。 */
  const TOWERS = {
    pea:         { name: '灵纹豌豆炮', q: 'white', el: 'phys', kind: 'shot', dmg: 8, range: 7, rate: 1.0, splash: 0, cost: 50, proj: 14, color: 0x8fc84a, unlock: 0, desc: '基础速射，指哪打哪' },
    spiketrap:   { name: '地刺陶罐', q: 'white', el: 'phys', kind: 'trap', dmg: 12, range: 2.4, rate: .5, splash: 2.2, cost: 30, proj: 0, color: 0x9a7a4a, unlock: 0, desc: '埋在路上的竹签，便宜不疼白不铺' },
    sun:         { name: '向日葵灵灯', q: 'green', el: 'eco', kind: 'gen', dmg: 0, range: 0, rate: 1, splash: 0, cost: 80, proj: 0, color: 0xf5c542, unlock: 1, desc: '每秒供 2+ 灵能' },
    bean3:       { name: '连珠豆炮', q: 'green', el: 'phys', kind: 'multi', dmg: 5, range: 7.5, rate: .8, splash: 0, cost: 120, proj: 14, color: 0xa8d84a, unlock: 1, desc: '一次撒三颗灵豆' },
    vine:        { name: '减速藤蔓塔', q: 'green', el: 'ice', kind: 'aura', dmg: 3, range: 7, rate: .8, splash: 0, cost: 100, proj: 0, color: 0x6ab84a, slow: .55, unlock: 1, desc: '大范围缠藤减速 45%' },
    sling:       { name: '投石粮囤', q: 'green', el: 'phys', kind: 'shot', dmg: 28, range: 6, rate: .35, splash: 1.6, cost: 150, proj: 9, color: 0xb8a280, knock: 2, unlock: 1, desc: '巨石把小怪掀回去' },
    cactus:      { name: '仙人掌弩', q: 'green', el: 'phys', kind: 'shot', dmg: 26, range: 10, rate: .8, splash: 0, cost: 130, proj: 20, color: 0x5aa345, unlock: 1, desc: '远射程单体穿刺' },
    shroom:      { name: '雷火蘑菇阵', q: 'blue', el: 'fire', kind: 'trap', dmg: 55, range: 2.6, rate: .8, splash: 2.6, cost: 90, proj: 0, color: 0xd8442f, unlock: 2, desc: '贴脸引爆的地雷菇' },
    pome:        { name: '爆炎火榴炮', q: 'blue', el: 'fire', kind: 'cannon', dmg: 42, range: 6, rate: .5, splash: 3, cost: 200, proj: 9, color: 0xff7a2f, burn: true, unlock: 2, desc: '溅射+点燃 3 秒' },
    ice:         { name: '玄冰寒莲炮', q: 'blue', el: 'ice', kind: 'shot', dmg: 26, range: 6.5, rate: .6, splash: 0, cost: 200, proj: 12, color: 0x6cc8f0, slow: .6, freeze: .2, unlock: 3, desc: '减速 40%，20% 冻住 2 秒' },
    fungaltower: { name: '灵菌医疗塔', q: 'blue', el: 'buff', kind: 'auraRate', dmg: 0, range: 5.5, rate: 1, splash: 0, cost: 180, proj: 0, color: 0xe4d4f0, unlock: 3, desc: '圈内塔攻速 +20%' },
    drummertower:{ name: '战鼓蟾塔', q: 'blue', el: 'buff', kind: 'auraDmg', dmg: 0, range: 5.5, rate: 1, splash: 0, cost: 180, proj: 0, color: 0xd8a13c, unlock: 3, desc: '圈内塔伤害 +30%' },
    chomp:       { name: '大嘴食人花', q: 'purple', el: 'phys', kind: 'melee', dmg: 40, range: 2.8, rate: 1.1, splash: 0, cost: 240, proj: 0, color: 0xb0489a, unlock: 4, desc: '近身吞噬，撕咬快' },
    bamboo:      { name: '引雷竹炮', q: 'purple', el: 'thunder', kind: 'chain', dmg: 52, range: 8, rate: .7, splash: 0, cost: 350, proj: 0, color: 0xa9d8ff, arcs: 4, unlock: 4, desc: '闪电链跳 4 目标' },
    eye:         { name: '磐岩石化眼', q: 'purple', el: 'ice', kind: 'aura', dmg: 4, range: 4.5, rate: 1, splash: 0, cost: 320, proj: 0, color: 0x9a948a, stun: .4, unlock: 4, desc: '目光所及步履维艰' },
    spiked:      { name: '破甲刺球塔', q: 'purple', el: 'phys', kind: 'shot', dmg: 20, range: 6.5, rate: .5, splash: 0, cost: 300, proj: 12, color: 0x7a6a5a, shred: true, unlock: 5, desc: '护甲 -20%，叠 3 层' },
    inkpot:      { name: '吸粮黑罐', q: 'purple', el: 'eco', kind: 'economy', dmg: 20, range: 7, rate: .6, splash: 0, cost: 280, proj: 10, color: 0x4a3a4a, unlock: 5, desc: '被它击杀 +30% 灵能' },
    seal:        { name: '九天符阵台', q: 'orange', el: 'phys', kind: 'beam', dmg: 150, range: 9, rate: .7, splash: 1, cost: 420, proj: 0, color: 0xe8c268, unlock: 5, desc: '持续符光扫射' },
    ricecannon:  { name: '紫金稻穗炮', q: 'orange', el: 'true', kind: 'shot', dmg: 88, range: 8.5, rate: .6, splash: 0, cost: 500, proj: 14, color: 0xd8b24a, unlock: 6, desc: '真实伤害，无视护甲与减伤' },
  };
  const TOWER_IDS = Object.keys(TOWERS);
  const Q_NAMES = { white: '普通', green: '优秀', blue: '稀有', purple: '史诗', orange: '传说' };
  const Q_COLOR = { white: '#b8c4c8', green: '#8fc84a', blue: '#6cc8f0', purple: '#c86ae8', orange: '#f0a83c' };

  // 局内 5 级升级曲线（伤害/攻速/范围倍率；升级消耗=造价×倍率）
  const UPG_DMG = [1, 1.5, 2.2, 3.2, 4.5];
  const UPG_RATE = [1, 1.05, 1.15, 1.3, 1.5];
  const UPG_RANGE = [1, 1, 1.05, 1.15, 1.3];
  const UPG_COST = [0, 1, 2.4, 5, 10];
  // 局外永久强化（灵石+强化石）：品质上限 / 每级提升 / 每级消耗
  const ENH = {
    white:  { cap: 10, dmg: .05, rate: .01, stone: (n) => n, coin: (n) => 100 * n },
    green:  { cap: 15, dmg: .055, rate: .012, stone: (n) => n, coin: (n) => 150 * n },
    blue:   { cap: 20, dmg: .06, rate: .015, stone: (n) => n + 1, coin: (n) => 200 * n },
    purple: { cap: 25, dmg: .07, rate: .018, stone: (n) => n + 2, coin: (n) => 300 * n },
    orange: { cap: 30, dmg: .08, rate: .02, stone: (n) => n + 3, coin: (n) => 500 * n },
  };

  /* ---- 元素克制：塔元素 × 怪标签 → 倍率（§2.4） ---------------------------- */
  function elMul(el, tags) {
    if (el === 'true' || el === 'buff' || el === 'eco') return 1;
    const has = (t) => tags && tags.indexOf(t) >= 0;
    if (el === 'fire' && (has('plant') || has('insect'))) return 1.5;
    if (el === 'ice' && has('fire')) return 1.5;
    if (el === 'thunder' && (has('water') || has('ice'))) return 1.5;
    if (el === 'phys' && has('armor')) return 0.8;
    return 1;
  }

  /* ---- 怪物图鉴（属性公式 §2.1；类型倍率 §2.3；章节系数 CHAPTER_MUL） -------
     tags: plant/insect/ice/fire/water/armor/beast/thunder */
  const MONSTERS = {
    sprout: { name: '豆兵', baseHp: 20, baseDmg: 1, baseSpd: 1.0, dmgP: 1, tags: 'plant', color: 0x6aa33c, crest: 'sprout', r: .38, chapter: 1, type: 'mob' },
    runner: { name: '田鼠精', baseHp: 25, baseDmg: 1, baseSpd: 1.2, dmgP: 1, tags: 'beast', color: 0x9cc84a, crest: 'sprout', r: .32, chapter: 1, type: 'mob' },
    potling: { name: '黑陶罐妖', baseHp: 30, baseDmg: 1, baseSpd: 1.0, dmgP: 1, tags: 'plant', color: 0x4a3022, crest: 'star', r: .42, chapter: 1, type: 'mob' },
    mush: { name: '毒蘑菇精', baseHp: 26, baseDmg: 2, baseSpd: 1.1, dmgP: 1, ranged: 6, tags: 'plant', color: 0xc8503a, crest: 'mushroom', r: .38, chapter: 1, type: 'mob' },
    beetle: { name: '毒甲虫', baseHp: 40, baseDmg: 2, baseSpd: .8, dmgP: 2, tags: 'insect,armor', color: 0x5c636e, crest: 'shell', r: .48, chapter: 2, type: 'mob' },
    moth: { name: '飞蛾妖', baseHp: 18, baseDmg: 1, baseSpd: 1.4, dmgP: 1, fly: true, tags: 'insect', color: 0xd8c9a8, crest: 'wing', r: .4, chapter: 2, type: 'mob' },
    rootwalker: { name: '枯根行者', baseHp: 46, baseDmg: 2, baseSpd: .95, dmgP: 2, tags: 'plant', color: 0x6e4a2c, crest: 'twigs', r: .5, chapter: 2, type: 'mob' },
    spitter: { name: '喷酸食虫草', baseHp: 34, baseDmg: 2, baseSpd: 1.1, dmgP: 2, ranged: 8, tags: 'plant', color: 0x7aa83c, crest: 'pitcher', r: .45, chapter: 3, type: 'mob' },
    banyan: { name: '独木妖', baseHp: 60, baseDmg: 2, baseSpd: .6, dmgP: 2, split: 2, tags: 'plant', color: 0x3e6e2a, crest: 'canopy', r: .62, chapter: 3, type: 'mob' },
    hopper: { name: '蹦蹦菇', baseHp: 20, baseDmg: 1, baseSpd: 1.6, dmgP: 1, tags: 'plant', color: 0x8fc44a, crest: 'mushroom', r: .34, chapter: 2, type: 'mob' },
    boomkin: { name: '爆裂罐', baseHp: 28, baseDmg: 2, baseSpd: 1.4, dmgP: 2, boom: 90, tags: 'plant', color: 0xff5a2a, crest: 'flame', r: .4, chapter: 3, type: 'mob' },
    shelldog: { name: '甲壳蜷', baseHp: 55, baseDmg: 2, baseSpd: .9, dmgP: 2, tags: 'insect,armor', armor: .25, color: 0x8a6a4a, crest: 'shell', r: .5, chapter: 3, type: 'mob' },
    wraith: { name: '雾影藤妖', baseHp: 52, baseDmg: 2, baseSpd: 1.5, dmgP: 2, dodge: .3, tags: 'plant', color: 0x7c6ea8, crest: 'tendrils', r: .44, chapter: 4, type: 'mob' },
    starv: { name: '饿殍农', baseHp: 50, baseDmg: 2, baseSpd: .9, dmgP: 3, tags: 'plant', color: 0x8a7a4a, crest: 'twigs', r: .5, chapter: 4, type: 'mob' },
    myco: { name: '灵菌医', baseHp: 30, baseDmg: 1, baseSpd: .7, dmgP: 1, heal: true, tags: 'plant', color: 0xe4d4f0, crest: 'mushroom', r: .46, chapter: 4, type: 'mob' },
    drummer: { name: '战鼓蟾', baseHp: 45, baseDmg: 1, baseSpd: .6, dmgP: 1, aura: true, tags: 'water', color: 0xd8a13c, crest: 'sun', r: .52, chapter: 4, type: 'mob' },
    wisp: { name: '隐身魃', baseHp: 120, baseDmg: 4, baseSpd: 1.0, dmgP: 2, stealth: true, tags: 'plant', color: 0x9a8ac8, crest: 'tendrils', r: .4, chapter: 4, type: 'elite' },
    treant: { name: '枫守巨像', baseHp: 95, baseDmg: 4, baseSpd: .55, dmgP: 4, tags: 'plant', color: 0xb05a28, crest: 'canopy', r: .72, chapter: 4, type: 'mob' },
    icebug: { name: '冰壳虫', baseHp: 70, baseDmg: 2, baseSpd: .7, dmgP: 2, tags: 'insect,ice', armor: .3, color: 0x8fd4f2, crest: 'crystal', r: .46, chapter: 5, type: 'mob' },
    frostwolf: { name: '雪绒妖犬', baseHp: 150, baseDmg: 5, baseSpd: 1.1, dmgP: 3, rush: true, tags: 'beast,ice', color: 0xcfe4ee, crest: 'ears', r: .5, chapter: 5, type: 'elite' },
    rusher: { name: '铁蹄驹', baseHp: 70, baseDmg: 3, baseSpd: 1.1, dmgP: 3, rush: true, tags: 'beast', color: 0x7a6a5a, crest: 'ears', r: .52, chapter: 5, type: 'mob' },
    magma: { name: '熔岩火灵', baseHp: 105, baseDmg: 4, baseSpd: 1.0, dmgP: 4, burn: true, tags: 'fire', color: 0xe0562a, crest: 'flame', r: .5, chapter: 6, type: 'mob' },
    emberbug: { name: '火榴虫', baseHp: 35, baseDmg: 3, baseSpd: 1.1, dmgP: 2, fly: true, boom: 40, tags: 'fire,insect', color: 0xffa63c, crest: 'wing', r: .34, chapter: 6, type: 'mob' },
    brooder: { name: '孵化罐', baseHp: 100, baseDmg: 0, baseSpd: .45, dmgP: 0, summon: 'sprout', tags: 'plant', color: 0xc86a8a, crest: 'petals', r: .62, chapter: 6, type: 'producer' },
    ghostpot: { name: '幽火罐', baseHp: 90, baseDmg: 3, baseSpd: 1.1, dmgP: 3, stealth: true, ranged: 6, tags: 'fire', color: 0x5aa0c8, crest: 'flame', r: .48, chapter: 6, type: 'mob' },
        mistfrog: { name: '雾沼蛙', baseHp: 70, baseDmg: 3, baseSpd: .9, dmgP: 3, tags: 'water,beast', color: 0x6aa0a8, crest: 'halo', r: .48, chapter: 3, type: 'mob' },
        goldenbeetle: { name: '金龟将', baseHp: 140, baseDmg: 5, baseSpd: .6, dmgP: 4, armor: .35, tags: 'armor,beast', color: 0xc8a84a, crest: 'shell', r: .56, chapter: 5, type: 'mob' },
        frostworm: { name: '冰蚕蛾', baseHp: 55, baseDmg: 3, baseSpd: 1.2, dmgP: 2, fly: true, tags: 'ice,insect', color: 0xb8e0f0, crest: 'wing', r: .36, chapter: 5, type: 'mob' },
        inkvine: { name: '墨藤妖', baseHp: 160, baseDmg: 4, baseSpd: .65, dmgP: 4, tags: 'plant', color: 0x4a3a5a, crest: 'tendrils', r: .58, chapter: 6, type: 'mob' },
        stoner: { name: '石敢当', baseHp: 210, baseDmg: 5, baseSpd: .55, dmgP: 5, armor: .4, tags: 'armor', color: 0x8a8a84, crest: 'crystal', r: .6, chapter: 7, type: 'mob' },
        ashwitch: { name: '灰烬巫', baseHp: 95, baseDmg: 5, baseSpd: .8, dmgP: 4, ranged: 7, tags: 'fire', color: 0xd87a4a, crest: 'petals', r: .48, chapter: 8, type: 'mob' },
        nightorchid: { name: '夜兰魅', baseHp: 130, baseDmg: 6, baseSpd: .9, dmgP: 4, stealth: true, dodge: .25, tags: 'plant', color: 0x7a4a9a, crest: 'orchid', r: .5, chapter: 7, type: 'elite' },
    thunder: { name: '雷翼蝠', baseHp: 105, baseDmg: 4, baseSpd: 1.5, dmgP: 4, chain: true, fly: true, tags: 'beast,thunder', color: 0x6c8fd8, crest: 'wing', r: .5, chapter: 7, type: 'mob' },
    mirebeast: { name: '泽泥魔', baseHp: 190, baseDmg: 6, baseSpd: .7, dmgP: 5, regen: 8, tags: 'water', color: 0x5a6a4a, crest: 'twigs', r: .68, chapter: 7, type: 'mob' },
    twinling: { name: '并蒂妖', baseHp: 180, baseDmg: 3, baseSpd: .8, dmgP: 4, split: 2, heal: true, tags: 'plant', color: 0x8ac46a, crest: 'vine', r: .6, chapter: 7, type: 'elite' },
    stonedevil: { name: '岩魔将', baseHp: 320, baseDmg: 8, baseSpd: .6, dmgP: 6, armor: .35, tags: 'armor', color: 0x8a8478, crest: 'crystal', r: .78, chapter: 8, type: 'mob' },
    warden: { name: '守山灵将', baseHp: 550, baseDmg: 11, baseSpd: .7, dmgP: 7, shield: 200, tags: 'water,armor', color: 0x4a7a8a, crest: 'halo', r: .8, chapter: 8, type: 'mob' },
    tormentor: { name: '刑天罐', baseHp: 250, baseDmg: 6, baseSpd: .5, dmgP: 5, armor: .4, shield: 260, tags: 'armor', color: 0x9a3a2a, crest: 'crystal', r: .74, chapter: 8, type: 'elite' },
    // ── 各章波 15 BOSS（前四章小 BOSS + 四饿使，§2.2 B001-B004）────────────
    rootling:   { name: '藤根幼体', boss: true, baseHp: 1000, baseDmg: 10, baseSpd: .4, dmgP: 5, gold: 320, xp: 300, split: 3, tags: 'plant', color: 0x5a7a3a, crest: 'twigs', r: 1.0, chapter: 1, type: 'boss' },
    mudsire:    { name: '污泉妖母', boss: true, baseHp: 1000, baseDmg: 10, baseSpd: .4, dmgP: 5, gold: 320, xp: 300, summon: 'runner', tags: 'water', color: 0x4a6a5a, crest: 'pitcher', r: 1.0, chapter: 2, type: 'boss' },
    bossGourd:  { name: '妖藤葫芦王', boss: true, baseHp: 1000, baseDmg: 10, baseSpd: .4, dmgP: 5, gold: 640, xp: 600, split: 4, tags: 'plant', color: 0x7a4a2a, crest: 'vine', r: 1.1, chapter: 3, type: 'boss' },
    maplelord:  { name: '枫守巨像·怨', boss: true, baseHp: 1000, baseDmg: 10, baseSpd: .4, dmgP: 6, heal: true, gold: 640, xp: 600, tags: 'plant', color: 0xc0512a, crest: 'canopy', r: 1.1, chapter: 4, type: 'boss' },
    bossInferno:{ name: '炎魔金刚', boss: true, baseHp: 2000, baseDmg: 15, baseSpd: .5, dmgP: 8, burn: true, gold: 900, xp: 850, tags: 'fire', color: 0xd8401f, crest: 'flame', r: 1.2, chapter: 5, type: 'boss' },
    souljar:    { name: '熔岩仓魂', boss: true, baseHp: 2000, baseDmg: 15, baseSpd: .45, dmgP: 8, summon: 'emberbug', boom: 260, gold: 900, xp: 850, tags: 'fire', color: 0x8a2f1f, crest: 'flame', r: 1.15, chapter: 6, type: 'boss' },
    bossNightmare:{ name: '梦魇花妖', boss: true, baseHp: 2800, baseDmg: 12, baseSpd: .45, dmgP: 10, ranged: 9, dodge: .2, heal: true, gold: 1100, xp: 1100, tags: 'plant', color: 0x9a4ab8, crest: 'petals', r: 1.25, chapter: 7, type: 'boss' },
    bossSky:    { name: '玄冥子', boss: true, final: true, baseHp: 5000, baseDmg: 20, baseSpd: .35, dmgP: 12, chain: true, shield: 800, summon: 'sprout', gold: 2000, xp: 2000, tags: 'armor', color: 0x3a4a7a, crest: 'halo', r: 1.4, chapter: 8, type: 'boss' },
  };
  const TYPE_MUL = { mob: { hp: 1, atk: 1, drop: 1 }, elite: { hp: 4, atk: 3, drop: 5 }, producer: { hp: 1, atk: 1, drop: 2 }, boss: { hp: 1, atk: 1, drop: 1 } };
  const CHAPTER_MUL = [1, 1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.0, 9.0];   // 索引=章号（1..8）

  /* 单怪最终属性：生命=基础×章节系数×波次系数×类型×难度；精英/BOSS 基础值即最终档 */
  function mStats(id, chIdx, wave, diff) {
    const m = MONSTERS[id];
    const cm = m.boss ? 1 : CHAPTER_MUL[chIdx + 1];
    const wm = m.boss ? 1 : 1 + (Math.max(1, wave) - 1) * .06;
    const tm = TYPE_MUL[m.type] || TYPE_MUL.mob;
    const d = DIFFS[diff || 0];
    const hp = Math.max(1, Math.round(m.baseHp * cm * wm * tm.hp * d.hp));
    const dmg = Math.max(1, Math.round(m.baseDmg * cm * tm.atk * d.atk));
    const spd = m.baseSpd * d.spd * (m.boss ? 1 : 1 + (Math.max(1, wave) - 1) * .02);
    const gold = m.gold || Math.max(2, Math.round((m.baseHp * .12 + m.baseDmg) * tm.drop * d.drop));
    const xp = m.xp || Math.max(3, Math.round((m.baseHp * .1 + m.baseDmg * 2) * tm.drop * d.drop));
    return { hp, dmg, spd, gold, xp };
  }

  /* ---- 波次表：每章 15 波，(怪 id × 只数)；1/5/10/15 按 V1.0 原表，其余内插。
     间隔：1-5 波 15s、6-10 波 12s、11-15 波 10s（困难 -2s，噩梦 -3s）。
     波 15 的 BOSS 由生成器按 LEVELS.boss 自动追加。 */
  const WAVES = [
    [[['sprout', 5]], [['sprout', 6], ['runner', 2]], [['sprout', 4], ['runner', 4]], [['runner', 8]], [['sprout', 6], ['runner', 3], ['potling', 2]],
     [['sprout', 8], ['runner', 4]], [['runner', 10]], [['sprout', 10], ['runner', 5]], [['runner', 8], ['moth', 2]], [['treant', 2], ['sprout', 8]],
     [['sprout', 12], ['runner', 6]], [['moth', 8], ['runner', 4]], [['sprout', 10], ['runner', 8], ['moth', 2]], [['treant', 1], ['runner', 10], ['moth', 4]], [['sprout', 10], ['potling', 4]]],
    [[['beetle', 5], ['sprout', 3]], [['beetle', 6], ['moth', 3]], [['beetle', 4], ['runner', 6]], [['moth', 8], ['beetle', 2]], [['treant', 1], ['beetle', 6]],
     [['beetle', 7], ['hopper', 5]], [['moth', 9], ['beetle', 3]], [['beetle', 8], ['runner', 6]], [['hopper', 8], ['moth', 4]], [['treant', 2], ['beetle', 8]],
     [['banyan', 4], ['beetle', 5]], [['moth', 10], ['hopper', 4]], [['beetle', 9], ['runner', 8]], [['treant', 2], ['banyan', 4]], [['banyan', 6], ['beetle', 4]]],
    [[['banyan', 5], ['beetle', 4]], [['hopper', 6], ['spitter', 2]], [['spitter', 5], ['beetle', 4]], [['banyan', 6], ['mistfrog', 2]], [['banyan', 2], ['emberbug', 5]],
     [['spitter', 7], ['hopper', 4]], [['wraith', 6], ['beetle', 4]], [['banyan', 8], ['spitter', 3]], [['boomkin', 6], ['wraith', 3]], [['spitter', 8], ['treant', 2]],
     [['wraith', 8], ['hopper', 6]], [['banyan', 8], ['boomkin', 4]], [['spitter', 9], ['wraith', 5]], [['treant', 3], ['boomkin', 6]], [['banyan', 10], ['spitter', 5]]],
    [[['starv', 6], ['banyan', 4]], [['starv', 7], ['myco', 1]], [['wraith', 6], ['starv', 4]], [['myco', 3], ['starv', 8]], [['myco', 2], ['starv', 8]],
     [['drummer', 1], ['starv', 8], ['wisp', 2]], [['wraith', 9], ['myco', 2]], [['starv', 10], ['hopper', 4]], [['wisp', 3], ['myco', 3]], [['drummer', 1], ['starv', 10], ['treant', 2]],
     [['treant', 3], ['wraith', 8]], [['wisp', 4], ['myco', 4]], [['starv', 12], ['wraith', 6]], [['drummer', 2], ['wisp', 3], ['myco', 3]], [['starv', 12], ['myco', 2], ['treant', 1]]],
    [[['icebug', 6], ['frostwolf', 1]], [['icebug', 8], ['rusher', 2]], [['frostwolf', 2], ['icebug', 5]], [['rusher', 6], ['icebug', 4]], [['treant', 1], ['icebug', 8]],
     [['icebug', 6], ['frostworm', 4], ['goldenbeetle', 2]], [['frostwolf', 4], ['rusher', 4]], [['boomkin', 8], ['icebug', 6]], [['ghostpot', 4], ['frostwolf', 3]], [['frostwolf', 2], ['icebug', 10]],
     [['rusher', 8], ['ghostpot', 4]], [['magma', 6], ['icebug', 8]], [['frostwolf', 5], ['wisp', 4]], [['treant', 2], ['rusher', 8]], [['icebug', 10], ['emberbug', 8], ['frostwolf', 2]]],
    [[['brooder', 2], ['emberbug', 6]], [['magma', 6], ['boomkin', 4]], [['brooder', 3], ['ghostpot', 3]], [['emberbug', 10], ['magma', 3]], [['wisp', 2], ['emberbug', 8]],
     [['brooder', 4], ['inkvine', 3], ['magma', 4]], [['thunder', 5], ['boomkin', 6]], [['brooder', 3], ['ghostpot', 5]], [['magma', 8], ['emberbug', 6]], [['brooder', 4], ['treant', 2]],
     [['thunder', 7], ['brooder', 2]], [['ghostpot', 8], ['magma', 5]], [['brooder', 5], ['wisp', 5]], [['magma', 9], ['boomkin', 6]], [['brooder', 4], ['emberbug', 12], ['magma', 5]]],
    [[['thunder', 6], ['myco', 3]], [['mirebeast', 4], ['thunder', 4]], [['thunder', 8], ['myco', 4]], [['twinling', 2], ['thunder', 5]], [['twinling', 3], ['myco', 3]],
     [['mirebeast', 6], ['thunder', 6]], [['twinling', 4], ['wisp', 2]], [['wisp', 3], ['nightorchid', 2], ['thunder', 6]], [['twinling', 5], ['mirebeast', 4]], [['tormentor', 1], ['twinling', 4]],
     [['mirebeast', 7], ['myco', 4]], [['thunder', 10], ['wisp', 5]], [['twinling', 4], ['tormentor', 1], ['thunder', 5]], [['warden', 1], ['twinling', 5]], [['twinling', 5], ['myco', 2], ['wisp', 3], ['mirebeast', 3]]],
    [[['thunder', 6], ['starv', 8]], [['warden', 1], ['thunder', 6]], [['mirebeast', 4], ['stoner', 2], ['thunder', 5]], [['wraith', 10], ['warden', 2]], [['drummer', 2], ['ashwitch', 3], ['tormentor', 2]],
     [['stonedevil', 4], ['myco', 4]], [['warden', 1], ['twinling', 3], ['thunder', 4]], [['brooder', 4], ['tormentor', 2]], [['magma', 10], ['warden', 1]], [['warden', 1], ['tormentor', 3], ['myco', 3]],
     [['stonedevil', 4], ['wisp', 5]], [['thunder', 10], ['warden', 1]], [['tormentor', 3], ['mirebeast', 4], ['thunder', 4]], [['warden', 1], ['stonedevil', 3], ['thunder', 4]], [['warden', 1], ['tormentor', 3], ['starv', 8]]],
  ];
  // 单波灵能掉落总目标（ch1 按表；其余章按 ch2 表值×区增长）
  const WSPI = [25, 45, 48, 56, 110, 72, 70, 95, 80, 180, 102, 108, 130, 170, 300];
  function waveSpirit(chIdx, w, count) {
    const base = WSPI[Math.min(14, w - 1)] * (1 + chIdx * .55);
    return Math.max(.5, base / Math.max(1, count));
  }
  function gapFor(w, diff) {
    const cut = diff === 2 ? 3 : diff === 1 ? 2 : 0;
    return Math.max(6, (w <= 5 ? 15 : w <= 10 ? 12 : 10) - cut);
  }

  /* ---- 武器（主角手持）：8 把 ×5 级 + 品质/元素 ---------------------------- */
  const WEAPONS = {
    hoe: { name: '老锄头', q: 'white', el: 'phys', dmg: 12, rate: 1.6, arc: 90, range: 2.2, price: 0, up: 40, kind: 'melee', unlock: 0, style: 'farm' },
    sickle: { name: '弯月镰', q: 'green', el: 'phys', dmg: 20, rate: 2.1, arc: 110, range: 2.3, price: 60, up: 70, kind: 'melee', unlock: 0, style: 'farm' },
    machete: { name: '开山柴刀', q: 'blue', el: 'phys', dmg: 34, rate: 1.7, arc: 80, range: 2.5, price: 220, up: 150, kind: 'melee', unlock: 1, style: 'farm' },
    talisman: { name: '青木灵符', q: 'blue', el: 'phys', dmg: 26, rate: 1.3, arc: 0, range: 8, price: 420, up: 260, kind: 'throw', unlock: 1, style: 'cast' },
    staff: { name: '碧玉法杖', q: 'purple', el: 'ice', dmg: 46, rate: 1.1, arc: 0, range: 9.5, price: 950, up: 520, kind: 'bolt', unlock: 2, style: 'cast' },
    crossbow: { name: '连珠灵弩', q: 'purple', el: 'phys', dmg: 38, rate: 2.4, arc: 0, range: 11, price: 1900, up: 980, kind: 'shot', unlock: 3, style: 'cast' },
    gourd: { name: '三昧真火葫芦', q: 'orange', el: 'fire', dmg: 68, rate: .9, arc: 0, range: 8, price: 3600, up: 1800, kind: 'spray', unlock: 4, style: 'cast' },
    sword: { name: '御天飞剑', q: 'orange', el: 'true', dmg: 110, rate: 1.4, arc: 0, range: 12, price: 7000, up: 3200, kind: 'fly', unlock: 5, style: 'cast' },
  };
  const WEAPON_IDS = Object.keys(WEAPONS);

  /* ---- 消耗品与材料 -------------------------------------------------------- */
  const ITEMS = {
    hpPot: { name: '回血陶罐', price: 25, desc: '回复 1 心', type: 'use' },
    fpMax: { name: '灵露', price: 0, desc: '灵能上限 +15', type: 'use' },
    bomb: { name: '雷火符', price: 40, desc: '掷出爆炸，范围 3', type: 'use' },
    freeze: { name: '玄冰珠', price: 60, desc: '全场冻结 3 秒', type: 'use' },
    smite: { name: '天雷咒', price: 90, desc: '雷击单体 ×8', type: 'use' },
    guard: { name: '金光咒符', price: 70, desc: '护体 6 秒免伤', type: 'use' },
    speed: { name: '神行符', price: 35, desc: '加速 8 秒', type: 'use' },
    fertilizer: { name: '灵雨符', price: 45, desc: '全场作物催生 25%', type: 'use' },
  };
  const MATERIALS = {
    wood: { name: '灵木', drop: true }, stone: { name: '玄石', drop: true },
    fiber: { name: '妖藤', drop: true }, core: { name: '妖丹', drop: true },
    spirit: { name: '灵晶', drop: true }, enhstone: { name: '强化石', drop: true },
  };
  const PILLS = [
    null,
    { name: '感气丹', cost: 200, mats: { wood: 4, fiber: 2 } },
    { name: '筑基丹', cost: 700, mats: { wood: 10, fiber: 6, stone: 4 } },
    { name: '结金丹', cost: 2000, mats: { stone: 14, core: 4 } },
    { name: '育婴丹', cost: 5000, mats: { core: 12, spirit: 4 } },
    { name: '化神丹', cost: 11000, mats: { core: 26, spirit: 12 } },
    { name: '炼虚丹', cost: 22000, mats: { spirit: 28, core: 40 } },
    { name: '合体丹', cost: 40000, mats: { spirit: 55, core: 70 } },
    { name: '飞升丹', cost: 70000, mats: { spirit: 100, core: 120 } },
  ];

  /* ---- 家园：农田分阶 & 建筑 ----------------------------------------------- */
  const FARM_TIERS = [
    { n: 16, cost: 0, realm: 0 },
    { n: 24, cost: 600, realm: 0 },
    { n: 32, cost: 1800, realm: 1 },
    { n: 40, cost: 4500, realm: 2 },
  ];
  const BUILDINGS = {
    well:  { name: '灵泉井', cost: 200, realm: 0, r: 1.2, color: 0x8d8a80, desc: '每小时自动浇灌 5m 内的田' },
    guard: { name: '法稻草人', cost: 400, realm: 0, r: 1.0, color: 0xc9a44e, desc: '6m 内作物生长 +15%' },
    lamp:  { name: '石灵灯', cost: 150, realm: 0, r: .9, color: 0xb8b0a0, desc: '灵能回复 +0.5/秒，夜间放光' },
    shed:  { name: '瑞鸡舍', cost: 600, realm: 1, r: 1.1, color: 0xd8b98a, desc: '每 60s 下一只灵蛋（+25 灵石）' },
    barn:  { name: '大谷仓', cost: 900, realm: 1, r: 1.5, color: 0xc0512a, desc: '全部作物出售价 +20%' },
  };

  /* ---- 关卡：8 区（山门互通；每区 15 波；boss=波 15） ---------------------- */
  const LEVELS = [
    { id: 1, name: '青禾田埂', theme: 'meadow', waves: 15, reward: 320, boss: 'rootling', intro: '祖传三分田，来了第一批豆兵。刨地、下种、竖起第一座豌豆炮。' },
    { id: 2, name: '桃溪坡', theme: 'peach', waves: 15, reward: 680, boss: 'mudsire', intro: '坡上桃花开了，毒甲虫与飞蛾也来了。上游的泉眼，黑得不对。' },
    { id: 3, name: '竹林小径', theme: 'bamboo', waves: 15, reward: 1250, boss: 'bossGourd', intro: '竹子成精，独木妖会分裂。吞了三村粮的仓贼，盘踞竹林深处。' },
    { id: 4, name: '枫叶坞', theme: 'maple', waves: 15, reward: 2200, boss: 'maplelord', intro: '一整坞的农户，秋收夜里成了精。它们不是恶——是饿。' },
    { id: 5, name: '寒玉冰原', theme: 'frost', waves: 15, reward: 3600, boss: 'bossInferno', intro: '冰原下封着当年纵火的天火。是放出来，还是吞下去？' },
    { id: 6, name: '赤焰火山', theme: 'lava', waves: 15, reward: 5400, boss: 'souljar', intro: '旧粮仓的废墟里，翻出一本烧焦的手记。真相是烫的。' },
    { id: 7, name: '雷泽迷雾', theme: 'mist', waves: 15, reward: 7800, boss: 'bossNightmare', intro: '雾里有你最想要的丰年。握紧镰刀，醒着种地。' },
    { id: 8, name: '飞升天梯', theme: 'ascend', waves: 15, reward: 12000, boss: 'bossSky', final: true, intro: '他每登一级，八区的庄稼就枯一头。万粒归田——最后一镰。' },
  ];

  const ITEM_COUNT = CROP_IDS.length * 2 + WEAPON_IDS.length + TOWER_IDS.length + Object.keys(ITEMS).length + Object.keys(MATERIALS).length + Object.keys(BUILDINGS).length;
  const MONSTER_COUNT = Object.keys(MONSTERS).length;

  function poolFor(c) {
    const ids = [];
    for (const k in MONSTERS) if (!MONSTERS[k].boss && MONSTERS[k].chapter <= c) ids.push(k);
    return ids;
  }
  function dropFor(mon) {
    const elite = mon.type === 'elite' || mon.boss;
    const t = mon.baseHp / 200;
    return {
      wood: Math.min(.9, .25 + t), fiber: Math.min(.8, .15 + t * .8), stone: Math.min(.7, t),
      core: mon.boss ? 1 : Math.min(.6, t * .5), spirit: mon.boss ? 1 : Math.min(.3, t * .25),
      enhstone: mon.boss ? 6 : elite ? .5 : Math.min(.12, t * .06),
    };
  }

  return { REALMS, DIFFS, CROPS, CROP_IDS, TOWERS, TOWER_IDS, Q_NAMES, Q_COLOR, UPG_DMG, UPG_RATE, UPG_RANGE, UPG_COST, ENH, elMul,
    MONSTERS, TYPE_MUL, CHAPTER_MUL, mStats, WEAPONS, WEAPON_IDS, ITEMS, MATERIALS, PILLS,
    LEVELS, WAVES, waveSpirit, gapFor, FARM_TIERS, BUILDINGS, ITEM_COUNT, MONSTER_COUNT, poolFor, dropFor };
})();
