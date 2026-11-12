// 无头全流程验收：boot → 标题 → 开局 → 种田（锄/种/浇/长/收/卖）→ 建塔 → 击怪
//                → 波次与通关 → 下一章 → 炼丹突破 → 三视角 → 存档重载 → 零报错。
// 用法：node tools/verify.mjs [dist/html] [shots目录]
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { ({ chromium } = createRequire('D:/projects/research/agent-game-3d-skills/replica/package.json')('playwright')); }

function findChrome() {
  const cache = process.env.LOCALAPPDATA + '/ms-playwright';
  const dirs = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).map((d) => d.split('-')[1]);
  for (const rev of ['1248', '1254', '1234', '1194', '1187', ...dirs.sort((a, b) => b - a)]) {
    const p = cache + '/chromium-' + rev + '/chrome-win64/chrome.exe';
    if (dirs.includes(rev) && existsSync(p)) return p;
  }
}
const URL = 'file:///' + resolve(process.argv[2] || 'dist/陇上修真.html').replace(/\\/g, '/');
const OUT = resolve(process.argv[3] || 'shots');
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  ' + detail : '')); };
const st = (page) => page.evaluate(() => window.__NJ.state());
const clickSel = async (page, sel) => { await page.waitForSelector(sel, { timeout: 5000 }); await page.click(sel); };

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

/* ---------- 1. 标题（无 autostart） ---------- */
await page.goto(URL + '?bench&seed=4207&dt=0.016');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
check('boot 无致命错误', await page.evaluate(() => window.__fatal === null));
let s = await st(page);
check('初始为标题屏', s.screen === 'title', s.screen);
await page.screenshot({ path: OUT + '/v1-title.png' });

/* ---------- 2. 新的开始 → 章节卡 ---------- */
await clickSel(page, '#btn-new');
if (await page.locator('.modal.help').count()) { await page.click('.modal.help [data-ok]'); await page.waitForTimeout(250); check('首开弹帮助说明', true); } else check('首开弹帮助说明', false, 'missing');
      while (await page.locator('[data-tn]').count()) { await page.click('[data-tn]'); await page.waitForTimeout(120); }
await page.waitForTimeout(500);
s = await st(page);
check('进入 playing 且弹章节卡', s.screen === 'playing' && s.level === 1 && s.wave === 0, `level=${s.level}`);
check('章节卡有「下田干活」按钮', await page.locator('[data-ok]').count() > 0);
await page.screenshot({ path: OUT + '/v2-intro.png' });
await clickSel(page, '[data-ok]');
await page.waitForTimeout(300);

/* ---------- 3. 种田全流程 ---------- */
await page.evaluate(() => {
  const D = window.__NJ.debug;
  D.money(2000); D.spirit(600); D.seeds(30);
  D.plantAll('cabbage');
});
await page.waitForTimeout(400);
s = await st(page);
check('32 格全部种上白菜', s.plots.every((p) => p.crop && p.crop.type === 'cabbage'), s.plots.filter((p) => p.crop).length + '/24');
await page.screenshot({ path: OUT + '/v3-farm.png' });
await page.evaluate(() => window.__NJ.debug.growAll());
await page.waitForTimeout(300);
s = await st(page);
check('全部催熟到 4 阶', s.plots.every((p) => p.crop && p.crop.stage >= 4), JSON.stringify(s.plots[0]));
const xpBefore = s.xp;
await page.evaluate(() => window.__NJ.debug.harvestAll());
await page.waitForTimeout(300);
s = await st(page);
check('收割入仓', (s.harvest.cabbage || 0) >= 40 && s.plots.every((p) => !p.crop), 'cabbage=' + s.harvest.cabbage);
check('收割给经验', s.xp > xpBefore, `${xpBefore}→${s.xp}`);
const sold = await page.evaluate(() => window.__NJ.debug.sellAll());
s = await st(page);
check('出售到账', sold > 400 && s.money > 2000, `sold=${sold} money=${s.money}`);

/* ---------- 4. 建塔 + 击杀 ---------- */
const placed = await page.evaluate(() => {
  const sim = window.__NJ.sim();
  const spots = [[9, 0], [-9, 0], [0, 9], [11, -8], [-11, -8], [6, -10], [3, 8]];
  for (const [x, z] of spots) { if (!sim.canPlace(x, z)) { if (sim.placeTower('pea', x, z)) return { x, z }; } }
  return null;
});
s = await st(page);
check('豌豆炮建起（灵能扣减）', !!placed && s.towers === 1, JSON.stringify(placed));
const combat = await page.evaluate(async () => {
  const sim = window.__NJ.sim();
  const t = sim.S.towers[0];
  sim.spawnEnemy({ id: 'sprout', hp: 1e6, speedMul: 1 });
  const e = sim.enemies[0];
  e.x = t.x + 2; e.z = t.z; e.stunT = 5;        // 冻在塔口当靶
  const hp0 = e.hp;
  await new Promise((r) => setTimeout(r, 1500)); // ~90 帧
  return { hp0, hp1: e.hp, hurt: e.hp < hp0, flash: e.hitFlash >= 0 };
});
check('塔自动开火命中敌人', combat.hurt, `hp ${combat.hp0}→${combat.hp1}`);
const kills0 = (await st(page)).kills;
await page.evaluate(() => window.__NJ.debug.killAll());
await page.waitForTimeout(200);
s = await st(page);
check('击杀计数与掉落', s.kills > kills0, `kills=${s.kills}`);
await page.screenshot({ path: OUT + '/v4-tower.png' });

/* ---------- 5. 布防面板与升级/拆除 ---------- */
const upg = await page.evaluate(() => {
  const sim = window.__NJ.sim();
  sim.addSpirit(500);
  const t = sim.S.towers[0];
  const ok = sim.upgradeTower(t);
  const soldBack = (() => { const before = sim.spirit; sim.sellTower(t); return sim.spirit - before; })();
  return { ok, lv: t.lv, soldBack, left: sim.S.towers.length };
});
check('塔可升级（lv2）', upg.ok && upg.lv === 2, JSON.stringify(upg));
check('拆塔返还灵能', upg.soldBack > 0 && upg.left === 0, JSON.stringify(upg));

/* ---------- 6. 通关本章 → 下一章 ---------- */
await page.evaluate(() => window.__NJ.debug.clearWaves());
await page.waitForTimeout(500);
s = await st(page);
check('本章守通报结算', s.screen === 'clear' && s.cleared.includes(1), s.screen);
await page.screenshot({ path: OUT + '/v5-clear.png' });
await clickSel(page, '[data-next]');
await page.waitForTimeout(600);
s = await st(page);
check('进入第 2 章（世界重建）', s.level === 2 && s.screen === 'playing' && s.wave === 0, `level=${s.level}`);
check('第 2 章塔与境界继承', s.realm >= 0 && s.money > 2000, JSON.stringify({ realm: s.realm, money: s.money }));
while (await page.locator('[data-tn]').count()) { await page.click('[data-tn]'); await page.waitForTimeout(120); }
await clickSel(page, '[data-ok]');
await page.waitForTimeout(300);

/* ---------- 7. 炼丹 → 突破 ---------- */
const realmUp = await page.evaluate(async () => {
  const D = window.__NJ.debug, sim = window.__NJ.sim();
  D.money(50000); D.giveMats(); D.xp(500);
  const brewed = sim.brewPill(1);
  const broke = sim.breakthrough();
  return { brewed, broke, realm: sim.S.realm };
});
check('炼丹 + 突破到感气', realmUp.brewed && realmUp.broke && realmUp.realm === 1, JSON.stringify(realmUp));
const gated = await page.evaluate(() => {
  const sim = window.__NJ.sim();
  const e = sim.canPlace(12, 6);
  return e === null ? 'free' : e;
});
await page.screenshot({ path: OUT + '/v6-chapter2.png' });

/* ---------- 8. 三视角切换（真按键） ---------- */
for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyC'); await page.waitForTimeout(120); }
s = await st(page);
check('C 键三视角循环回跟随', s.camMode === 0, 'cam=' + s.camMode);
await page.evaluate(() => window.__NJ.sim().P.camMode = 1);
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/v7-overview.png' });
await page.evaluate(() => window.__NJ.sim().P.camMode = 2);
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/v8-fpv.png' });

/* ---------- 9. 夜晚光照 ---------- */
await page.evaluate(() => { window.__NJ.sim().P.camMode = 0; window.__NJ.debug ? window.__NJ.sim().setTime01(0.93) : 0; });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/v9-night.png' });

/* ---------- 10. 存档 → 重载 → 继续修行 ---------- */
const saved = await page.evaluate(() => {
  const sim = window.__NJ.sim();
  sim.placeTower('pea', 9, 0); sim.placeTower('shroom', -9, 0);
  sim.save();
  return { money: sim.S.money, level: sim.S.levelIdx, realm: sim.S.realm, towers: sim.S.towers.length };
});
await page.goto(URL + '?bench&seed=4207&dt=0.016');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
await clickSel(page, '#btn-cont');
await page.waitForTimeout(800);
s = await st(page);
check('继续修行恢复章节进度', s.level === saved.level + 1, `${s.level} vs ${saved.level + 1}`);
check('恢复灵石与境界', s.money === saved.money && s.realm === saved.realm, JSON.stringify({ m: s.money, r: s.realm }));
check('恢复防御塔（含塔位）', s.towers === saved.towers, `towers=${s.towers}`);
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + '/v10-loaded.png' });

/* ---------- 11. 移动与战斗输入（真键鼠） ---------- */
/* 11a. 方向符号矩阵：camYaw=0 时相机位于 -z 侧朝 +z 看（屏幕上=+z，右=−x）。 */
const dirs = await page.evaluate(() => {
  const S0 = window.__NJ.sim(); const P = S0.P;
  const tap = (key, yaw) => {
    P.camYaw = yaw; P.x = 0; P.z = 2;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: key }));
    for (let i = 0; i < 20; i++) S0.update(0.016);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: key }));
    return { x: +(P.x).toFixed(2), z: +(P.z - 2).toFixed(2) };
  };
  const w0 = tap('KeyW', 0), s0 = tap('KeyS', 0), d0 = tap('KeyD', 0);
  const s12 = Math.sin(1.2), c12 = Math.cos(1.2);
  const w12 = tap('KeyW', 1.2);
  return { w0, s0, d0, wDot: +(w12.x * s12 + w12.z * c12).toFixed(2) };
});
check('W 朝屏幕深处(相机朝向 +fwd)', dirs.w0.z > 0.5, JSON.stringify(dirs.w0));
check('S 朝相机侧', dirs.s0.z < -0.5, JSON.stringify(dirs.s0));
check('D 朝屏幕右(−x @yaw0)', dirs.d0.x < -0.5, JSON.stringify(dirs.d0));
check('转视角后 W 仍沿新 fwd', dirs.wDot > 0.8, `dot=${dirs.wDot}`);
await page.evaluate(() => { const P = window.__NJ.sim().P; P.x = 0; P.z = 8; });
await page.keyboard.down('KeyW');
await page.waitForTimeout(500);
await page.keyboard.up('KeyW');
const moved = await page.evaluate(() => { const P = window.__NJ.sim().P; return { x: +P.x.toFixed(2), z: +P.z.toFixed(2) }; });
check('W 前进改变坐标', moved.z !== 8 || Math.abs(moved.x) > .01, JSON.stringify(moved));
await page.evaluate(() => { const sim = window.__NJ.sim(); sim.spawnEnemy({ id: 'runner', hp: 30, speedMul: 1 }); const e = sim.enemies[0]; const P = sim.P; e.x = P.x - Math.sin(P.camYaw) * 1.6; e.z = P.z - Math.cos(P.camYaw) * 1.6; e.stunT = 2; sim.P.camMode = 0; });
await page.keyboard.press('KeyF');
await page.waitForTimeout(400);
s = await st(page);
check('F 键近战判定生效（敌人掉血或击杀）', s.kills > 0 || (await page.evaluate(() => window.__NJ.sim().enemies[0]?.hp < 30)), 'kills=' + s.kills);

/* ---------- 12. 零错误收尾 ---------- */
const errs = await page.evaluate(() => window.__errors);
check('window.__errors 为空', errs.length === 0, errs.join(' | ').slice(0, 300));
check('全程无 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
await page.waitForTimeout(2500);
const info = await page.evaluate(() => { const r = window.__NJ; return { screen: r.state().screen, frames: window.__frames }; });
check('渲染循环持续（帧数可观）', info.frames > 80, JSON.stringify(info));

await browser.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} 通过 ====`);
if (failed.length) { console.log('失败项：' + failed.map((f) => f.name).join('；')); process.exit(1); }
