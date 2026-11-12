/* 09-prd.js — PRD 玩法层：任务系统（主线/支线/每日/成就）、对白、收集品调度、NPC 台词。
 * 运行期依赖 06/07 已装载；06 在关键事件点调 PRDSYS.fire(evt, n)。 */
(function () {
  'use strict';

  // ---------- 任务定义 ----------
  // evt 事件计数（prog 累加）；val 里程碑快照（直接读状态）；主线 post=e 'clear' 通关即推指针
  const MAIN = [
    { id: 'm1a', ch: 1, name: '婆婆的嘱托', goal: '开垦 3 块田并种下作物', evt: 'plant', need: 3, reward: { coin: 80, spirit: 40 } },
    { id: 'm1b', ch: 1, name: '苗劫之后',   goal: '守住灵田阵眼，度过第 1 章', evt: 'clear', need: 1, reward: { coin: 150, stone: 2 } },
    { id: 'm2a', ch: 2, name: '重返桃溪',   goal: '收获 5 次作物', evt: 'harvest', need: 5, reward: { coin: 120, spirit: 60 } },
    { id: 'm2b', ch: 2, name: '再熟一茬',   goal: '度过第 2 章', evt: 'clear', need: 1, reward: { coin: 200, stone: 2, relic: 1 } },
    { id: 'm3a', ch: 3, name: '老鼓的火',   goal: '布设 2 座地刺/陷阱塔', evt: 'buildTrap', need: 2, reward: { coin: 200, spirit: 80 } },
    { id: 'm3b', ch: 3, name: '破灰线',     goal: '度过第 3 章', evt: 'clear', need: 1, reward: { coin: 320, stone: 3 } },
    { id: 'm4a', ch: 4, name: '石伯的一课', goal: '浇水 10 次', evt: 'water', need: 10, reward: { coin: 260, spirit: 100 } },
    { id: 'm4b', ch: 4, name: '枫泣血',     goal: '度过第 4 章', evt: 'clear', need: 1, reward: { coin: 420, stone: 3, relic: 1 } },
    { id: 'm5a', ch: 5, name: '冰线的温度', goal: '淬炼任意塔 1 次', evt: 'enh', need: 1, reward: { coin: 320, spirit: 140 } },
    { id: 'm5b', ch: 5, name: '霜蟒之息',   goal: '度过第 5 章', evt: 'clear', need: 1, reward: { coin: 560, stone: 4 } },
    { id: 'm6a', ch: 6, name: '丹方之价',   goal: '炼制 2 枚丹药', evt: 'pill', need: 2, reward: { coin: 420, spirit: 180 } },
    { id: 'm6b', ch: 6, name: '暗火灯下',   goal: '度过第 6 章', evt: 'clear', need: 1, reward: { coin: 720, stone: 4, relic: 1 } },
    { id: 'm7a', ch: 7, name: '将星的愿望', goal: '建造 1 座功能建筑', evt: 'build', need: 1, reward: { coin: 520, spirit: 220 } },
    { id: 'm7b', ch: 7, name: '碎梦沼泽',   goal: '度过第 7 章', evt: 'clear', need: 1, reward: { coin: 920, stone: 5 } },
    { id: 'm8a', ch: 8, name: '最后的稻田', goal: '境界达到元婴', evt: 'realm', val: () => S().realm, need: 4, reward: { coin: 700, spirit: 300 } },
    { id: 'm8b', ch: 8, name: '大稔',       goal: '度过第 8 章', evt: 'clear', need: 1, reward: { coin: 1500, stone: 6, relic: 1 } },
  ];
  const SIDE = [
    { id: 's1', name: '五谷回环', goal: '收获 5 种不同的作物', evt: 'harvest', val: () => Object.keys(Q().grains || {}).length, need: 5, reward: { coin: 600, spirit: 200 } },
    { id: 's2', name: '灵能积蓄', goal: '累计获得 1200 灵能', evt: 'spiritGain', val: () => Q().sg || 0, need: 1200, reward: { coin: 400, stone: 3 } },
    { id: 's3', name: '粮行大户', goal: '卖出 50 份作物', evt: 'sell', need: 50, reward: { coin: 800, spirit: 260 } },
    { id: 's4', name: '看台名将', goal: '以困难难度通关任一章', evt: 'hardClear', need: 1, reward: { coin: 900, stone: 6 } },
    { id: 's5', name: '井边闲话', goal: '浇水 60 次', evt: 'water', need: 60, reward: { coin: 500, spirit: 300 } },
    { id: 's6', name: '兵工库',   goal: '3 座塔升到 3 级', evt: 'towerLv3', need: 3, reward: { coin: 800, stone: 5 } },
  ];
  const DAILY = [
    { id: 'd1', name: '晨耕三畦', goal: '开垦 3 块田', evt: 'till', need: 3, reward: { coin: 200 } },
    { id: 'd2', name: '除虫令',   goal: '击杀 25 只怪', evt: 'kill', need: 25, reward: { coin: 200, stone: 1 } },
    { id: 'd3', name: '拾穗记',   goal: '拾取 2 枚金稻穗', evt: 'rice', need: 2, reward: { coin: 160, spirit: 80 } },
    { id: 'd4', name: '丰产集',   goal: '收获 12 份作物', evt: 'harvest', need: 12, reward: { coin: 240 } },
  ];
  const ACHV = [
    { id: 'a1', name: '落地生根', goal: '第一次收获', evt: 'harvest', val: () => prog('a1') || S0harvests(), need: 1, reward: { coin: 50 } },
    { id: 'a2', name: '百虫辟易', goal: '累计击杀 100 只怪', evt: 'kill', val: () => S().kills, need: 100, reward: { coin: 300, stone: 2 } },
    { id: 'a3', name: '千里之防', goal: '累计击杀 800 只怪', evt: 'kill', val: () => S().kills, need: 800, reward: { coin: 1200, stone: 8 } },
    { id: 'a4', name: '三区之主', goal: '通关 3 章', evt: 'clear', val: () => S().cleared.length, need: 3, reward: { coin: 500, spirit: 200 } },
    { id: 'a5', name: '八门遍历', goal: '通关 8 章', evt: 'clear', val: () => S().cleared.length, need: 8, reward: { coin: 2000, stone: 10, title: '守稼真人' } },
    { id: 'a6', name: '穗满乾坤', goal: '集齐 12 枚金稻穗', evt: 'rice', val: () => Q().rice, need: 12, reward: { coin: 800, spirit: 300 } },
    { id: 'a7', name: '金玉满堂', goal: '集齐 36 枚金稻穗', evt: 'rice', val: () => Q().rice, need: 36, reward: { coin: 3000, stone: 15, title: '金穗翁' } },
    { id: 'a8', name: '淬火成锋', goal: '任意塔淬炼满级', evt: 'enh', val: () => enhMaxed(), need: 1, reward: { coin: 700, stone: 5 } },
    { id: 'a9', name: '谷道通神', goal: '境界达到化神', evt: 'realm', val: () => S().realm, need: 5, reward: { coin: 1000, spirit: 400 } },
    { id: 'a10', name: '噩梦行者', goal: '以噩梦难度通关任一章', evt: 'nightClear', need: 1, reward: { coin: 1800, stone: 10 } },
    { id: 'a11', name: '家园初成', goal: '拥有 4 座建筑', evt: 'build', val: () => S().buildings.length, need: 4, reward: { coin: 600, spirit: 200 } },
    { id: 'a12', name: '兄长之路', goal: '集齐 4 枚兄长信物', evt: 'relic', val: () => Q().relic, need: 4, reward: { coin: 1500, stone: 8, title: '归人' } },
  ];
  const RICE_STEPS = [[6, { coin: 300, spirit: 150 }], [12, { coin: 600, stone: 4 }], [18, { coin: 1000, spirit: 300 }], [26, { coin: 1500, stone: 8 }], [36, { coin: 3000, stone: 15, title: '金穗翁' }]];

  // ---------- 对白（STORY.md 口径，章节开场 2-3 句，可跳过） ----------
  const INTROS = {
    1: ['青禾婆婆：「娃啊，桃溪的灵田三年没下种了。锄头在墙根，先把门口那三畦地开出来。」', '青禾婆婆：「入夜后『饿殍』会往阵眼爬——白天种地，夜里守田，这就是咱的命。」'],
    2: ['青禾婆婆：「你守住了头一茬！溪下游的荒滩也开出来了，去把番茄秧子移过去。」', '铁匠老鼓：「小子，我瞧你那豌豆炮是花架子。来，我给你在炮管上錾道灵纹。」'],
    3: ['铁匠老鼓：「灰线以北全是虫。地刺陶罐便宜实惠，多埋几处，比啥都强。」', '青禾婆婆：「你兄长当年也是从这片灰线走丢的……这回，别走散喽。」'],
    4: ['枫守巨像·怨：「谁在摘我的枫叶……好熟悉的稻香。是你们……把日子过回来了？」', '钱串子：「哎呀呀，会说话的枫树！这要运到坊间，能卖大价钱呐！」'],
    5: ['青禾婆婆：「北境挂了霜，稻种冻死了大半。玄冰莲炮的炮胚，老鼓给你备下了。」', '铁匠老鼓：「记住，冰线怕火，也认火。带够柴火，去把咱的春天抢回来。」'],
    6: ['钱串子：「丹方残页！我出三百灵石……嗨，开个玩笑。拿去拿去，就当交个朋友。」', '游方丹师：「灯下黑处必有暗火。罐子别捏碎——里头的幽火认人。」'],
    7: ['青禾婆婆：「沼泽的雨，带着血腥味。鼓蟾的皮，是用你兄长战鼓换来的——别糟蹋了。」', '并蒂妖·残识：「我们本也是……护田的秧。是谁把我们拧成了这样？」'],
    8: ['四饿使之影：「农人，你种的每一粒粮，都是我们的口粮。你敢守着粮，敢不敢守着真相？」', '青禾婆婆：「孩子，婆婆没有瞒你。稷神的碑文，等你自己读完。最后一季了——把镰刀磨快。」'],
    endingA: ['稷神铭文·终：「仓廪实而知礼节——飞升者，遗其民。今观此子，稻熟八千顷而民不散，善哉。」', '青禾婆婆：「娃，飞不飞的，婆婆不懂。婆婆只知道，今年米缸是满的。」'],
    endingB: ['你：「仙路尽头是仓库，仓库尽头是灶台。这锄，我领了。」', '青禾婆婆：「回来就好。灶上给你温着饭。」'],
  };
  const NPC_TALK = {
    grannie: ['「日头正好，锄头别闲着。」', '「夜里阵眼的光别断，断了饿殍就来。」', '「你兄长小时候，也是从第一畦地学起的。」'],
    blacksmith: ['「淬炼的事包在我身上，强化石带够了没？」', '「炮管錾灵纹要火候，急不得——跟你种地一个理。」', '「鼓蟾那孙子，皮是我鞣的，架子是我焊的。」'],
    hawker: ['「金稻穗收不收？开玩笑开玩笑……」', '「丹药、丹方、陈年信物——坊间没有的，我有。」', '「买定离手，概不赊账——团婶除外。」'],
    aunt: ['「大鼓！你又偷喝我的桂花酿！」', '「小伙子，别听钱串子胡诌，他八岁的账都敢记。」', '「收成好，婶给你纳双千层底。」'],
  };

  // ---------- 运行时 ----------
  let sim = null, ui = null;
  const S = () => (sim && sim.S) || { levelIdx: 0, realm: 0, money: 0, kills: 0, harvest: {}, buildings: [], inv: {}, weapons: {}, enh: {}, cleared: [], diffCleared: [], q: null };
  function S0harvests() { const h = S().harvest || {}; let v = 0; for (const k in h) v += h[k]; return v; }
  function enhMaxed() { const s = S(); let n = 0; for (const id in s.enh) if (s.enh[id] >= DATA.ENH[DATA.TOWERS[id].q].cap) n++; return n; }
  function Q() { if (!sim) return { done: {}, prog: {}, seen: {}, gotR: {}, daily: { d: '', list: [] }, rice: 0, relic: 0, grains: {}, claim: [], main: 0, sg: 0 }; const s = S(); if (!s.q) s.q = { main: 0, done: {}, prog: {}, claim: [], daily: { d: '', list: DAILY.map((x) => x.id) }, rice: 0, relic: 0, grains: {}, title: '', seen: {}, sg: 0 }; return s.q; }
  const nowDay = () => new Date().toISOString().slice(0, 10);
  function rollDaily() { const q = Q(); if (q.daily.d !== nowDay()) { q.daily = { d: nowDay(), list: DAILY.map((x) => x.id) }; } }
  const prog = (id) => Q().prog[id] || 0;
  const setProg = (id, v) => { Q().prog[id] = v; };

  // 主线状态：q.main=已推到的主线格数；pre 与 post 同章并行可成，post 完成即 main+=2
  function mainState(m) {
    const q = Q(); if (q.done[m.id]) return 'done';
    if ((m.ch - 1) * 2 > q.main) return 'lock';
    return 'active';
  }
  function taskState(t, kind) {
    if (kind === 'main') return mainState(t);
    if (kind === 'daily') { rollDaily(); return Q().daily.list.includes(t.id) && !Q().done[t.id] ? 'active' : Q().done[t.id] ? 'done' : 'lock'; }
    return Q().done[t.id] ? 'done' : 'active';
  }
  function curVal(q, n) { if (q.val) return q.val(); const c = prog(q.id); return q.evt === 'realm' || q.evt === 'spiritGain' ? c : Math.min(c, q.need); }

  function fire(evt, n, arg) {
    if (!sim) return; const q = Q(); rollDaily();
    if (evt === 'spiritGain') { q.sg = (q.sg || 0) + (n || 0); const t2 = SIDE[1]; if (!q.done.s2 && mainOr(t2) && q.sg >= t2.need) { q.done.s2 = true; grant(t2.reward); ui.toast('✔ 支线达成：' + t2.name + ' → ' + rewardText(t2.reward)); sim.save(); } return; }
    if (evt === 'rice') q.rice = (q.rice || 0) + (n == null ? 1 : n);
    if (evt === 'relic') q.relic = (q.relic || 0) + (n == null ? 1 : n);
    if (evt === 'grain' && arg) q.grains[arg] = 1;
    if (evt === 'clear' && arg != null) { const ch = arg; const post = MAIN.find((m) => m.ch === ch); if (post && !q.done[post.id] && mainState(post) === 'active') { q.done[post.id] = true; grant(post.reward); ui.toast('✔ 主线达成：' + post.name + ' → ' + rewardText(post.reward)); if (q.main < ch * 2) q.main = ch * 2; } }
    let touched = 0;
    const bump = (list) => {
      for (const t of list) {
        const kind = MAIN.includes(t) ? 'main' : DAILY.includes(t) ? 'daily' : 'side';
        if (t.evt !== evt || taskState(t, kind) !== 'active') continue;
        if (!t.val) setProg(t.id, Math.min(prog(t.id) + (n == null ? 1 : n), t.need));
        if (curVal(t, n) >= t.need && !q.done[t.id]) { q.done[t.id] = true; grant(t.reward); touched++; ui.toast((kind === 'daily' ? '☀ ' : kind === 'achv' || ACHV.includes(t) ? '🏆 ' : '✔ ') + t.name + (kind === 'achv' || ACHV.includes(t) ? '（成就达成）' : ' → ' + rewardText(t.reward))); }
      }
    };
    // pre 主线（非 clear）
    bump(MAIN.filter((m) => m.evt !== 'clear'));
    bump(SIDE); bump(DAILY); bump(ACHV);
    if (evt === 'rice') { RICE_STEPS.forEach(([need, rw]) => { if (q.rice >= need && !q.claim.includes('r' + need)) { q.claim.push('r' + need); grant(rw); ui.toast('🌾 金稻穗集满 ' + need + '：' + rewardText(rw)); } }); }
    if (touched || evt === 'clear' || n) sim.save();
  }

  function grant(rw) {
    if (!rw) return; const s = S();
    if (rw.coin) s.money += rw.coin;
    if (rw.spirit) sim.addSpirit(rw.spirit);
    if (rw.stone) s.inv.enhstone = (s.inv.enhstone || 0) + rw.stone;
    if (rw.relic) Q().relic = (Q().relic || 0) + rw.relic;
    if (rw.title) Q().title = rw.title;
    try { ui.syncAll(); } catch (e) {}
  }
  function rewardText(rw) { if (!rw) return ''; const p = []; if (rw.coin) p.push('灵石' + rw.coin); if (rw.spirit) p.push('灵能' + rw.spirit); if (rw.stone) p.push('强化石×' + rw.stone); if (rw.relic) p.push('兄长信物×' + rw.relic); if (rw.title) p.push('称号「' + rw.title + '」'); return p.join(' '); }
  function progressText(q) { const v = q.val ? q.val() : prog(q.id); return Math.min(v, q.need) + '/' + q.need; }
  function mainOr(t) { return taskState(t, 'side') === 'active'; }

  // 每日奖励领取（完成后可手动领，防重复）
  function claimDaily(id) {
    const q = Q(); const t = DAILY.find((x) => x.id === id);
    if (!t || q.done['d!' + id] || taskState(t, 'daily') !== 'active') return false;
    if (prog(id) < t.need) return false;
    q.done['d!' + id] = true; delete q.prog[id]; grant(t.reward); ui.toast('☀ 日课已领：' + t.name); sim.save(); return true;
  }

  function npcSay(kind) { const l = NPC_TALK[kind]; return l[Math.floor(Math.random() * l.length)]; }
  function chapterIntro(ch) { return INTROS[ch] || []; }
  function endingText(which) { return which === 'B' ? INTROS.endingB : INTROS.endingA; }

  function questList() {
    const q = Q(); rollDaily();
    return {
      main: MAIN.map((m) => Object.assign({ kind: 'main' }, m, { st: mainState(m), p: progressText(m) })),
      side: SIDE.map((m) => Object.assign({ kind: 'side' }, m, { st: taskState(m, 'side'), p: progressText(m) })),
      daily: DAILY.map((m) => Object.assign({ kind: 'daily' }, m, { st: taskState(m, 'daily'), p: progressText(m), claimed: !!q.done['d!' + m.id] })),
      achv: ACHV.map((m) => Object.assign({ kind: 'achv' }, m, { st: q.done[m.id] ? 'done' : 'active', p: progressText(m) })),
    };
  }

  window.PRDSYS = {
    init(deps) { sim = deps.sim; ui = deps.ui; },
    MAIN, SIDE, DAILY, ACHV, RICE_STEPS, INTROS,
    fire, grant, rewardText, progressText, taskState, mainState,
    Q, rollDaily, prog, claimDaily, npcSay, chapterIntro, endingText, questList,
  };
})();
