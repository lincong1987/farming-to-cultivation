// balance-sim.mjs — 数值 V1.0 校验（双跑）：
//   A：推荐构筑（15 波通关 且 阵眼 ≥30%）；B：裸奔玩家（ch4+ 应守不住，证明塔是主防线）
// 用法：node tools/balance-sim.mjs [html] [--trace]
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
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
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TRACE = process.argv.includes('--trace');
const URL = 'file:///' + resolve(ARGS[0] || 'dist/陇上修真.html').replace(/\\/g, '/');
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const perr = [];
page.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
await page.goto(URL + '?bench&seed=7&dt=0.016&noaudio=1');
await page.waitForFunction(() => window.__ready === true);
await page.click('#btn-new'); await page.waitForTimeout(400);
while (await page.locator('[data-tn]').count()) { await page.click('[data-tn]'); await page.waitForTimeout(120); }
await page.click('[data-ok]'); await page.waitForTimeout(400);

const runChapter = ({ c, towers }) => page.evaluate(({ c, towers, TRACE }) => new Promise((done) => {
  const S0 = window.__NJ.sim(); const S = S0.S; const ui = window.__NJ.ui();
  const PLAN = [
    { gate: 0, buy: ['pea', 'spiketrap', 'pea', 'spiketrap', 'sun', 'bean3', 'pea', 'bean3', 'spiketrap', 'pea'] },
    { gate: 0, buy: ['pea', 'bean3', 'spiketrap', 'vine', 'sun', 'sling', 'bean3', 'sling', 'pea', 'bean3'] },
    { gate: 1, buy: ['bean3', 'shroom', 'vine', 'sun', 'sling', 'bean3', 'shroom', 'cactus', 'sling', 'shroom'] },
    { gate: 2, buy: ['pome', 'vine', 'bean3', 'shroom', 'sun', 'pome', 'chomp', 'vine', 'chomp', 'pome'] },
    { gate: 3, buy: ['ice', 'pome', 'fungaltower', 'vine', 'sun', 'ice', 'pome', 'drummertower', 'ice', 'pome'] },
    { gate: 3, buy: ['pome', 'ice', 'ice', 'drummertower', 'sun', 'pome', 'chomp', 'fungaltower', 'ice', 'chomp'] },
    { gate: 4, buy: ['bamboo', 'pome', 'spiked', 'drummertower', 'pome', 'ice', 'pome', 'chomp', 'fungaltower', 'spiked'] },
    { gate: 6, buy: ['spiked', 'pome', 'ricecannon', 'drummertower', 'fungaltower', 'ricecannon', 'seal', 'inkpot', 'ricecannon', 'bamboo'] },
  ][c];
  const RING = [[0, -11], [3.5, -9.5], [-3.5, -9.5], [5, -6], [-5, -6], [4.3, -3.5], [-4.3, -3.5], [0, -14], [6.9, -10], [-6.9, -10], [7.7, -3.9], [-7.7, -3.9]];   // 12 个互不挤占位（间距≥2.5），覆盖内环+行军段
  // —— 隔离本章：清场（含上章残敌，否则残兵直接啃新章阵眼）、复位跨章状态、UI 打回 playing ——
  for (const e of S0.enemies) { e.dead = true; if (e.view && e.view.parent) e.view.parent.remove(e.view); }
  for (const t of S.towers.slice()) S0.destroyTower(t);
  for (const b of S.buildings.slice()) S0.sellBuilding(b);
  S0.spendSpirit(S0.spirit);
  S.spiritMax = 1200 + c * 550;
  S0.addSpirit(Math.round(S.spiritMax * .6));   // 战前积攒 ≈ 六成上限（含上章携带+农场）
  ui.closePanels(); ui.setScr('playing');
  S.levelIdx = c; S.wave = 0; S.waveActive = false; S.intermission = 1; S.dead = false; S.diff = 0;
  S.nexusHp = S.nexusMax = 500 + c * 400;
  const wasCleared = S.cleared.slice();
  if (!S.cleared.includes(c + 1)) S.cleared.push(c + 1);
  S.realm = Math.max(S.realm, towers ? PLAN.gate : Math.min(8, c + 1));
  if (towers && c >= 4) for (const id of PLAN.buy) S.enh[id] = Math.max(S.enh[id] || 0, c >= 6 ? 12 : 8);
  S.hpMax = S0.realmv().hp; S.hp = 999;   // 玩家代理锁血，只测防线
  const seed = c < 2 ? 'cabbage' : c < 4 ? 'tomato' : c < 6 ? 'pumpkin' : 'rice';
  window.__NJ.debug.seeds(400);
  ui.currentSeed = seed; ui.setMode('weapon');
  S.weapons.crossbow = 1; S.weapons.sword = 1; ui.currentWeapon = c >= 6 ? 'sword' : 'crossbow';
  window.__NJ.debug.plantAll(seed);
  const P = S0.P; P.x = 0; P.z = 2; P.py = 0; P.vy = 0;
  const kills0 = S.kills, t0 = performance.now();
  let steps = 0, planI = 0, ringI = 0, fail = '', done2 = false; let buyTries = 0;
  const buys = [];
  const stepFn = () => {
    for (let burst = 0; burst < 800; burst++) {
      steps++;
      S0.update(0.05);
      if (!Number.isFinite(S.nexusHp)) { fail = 'NexusNaN@w' + S.wave; break; }
      if (steps % 8 === 0) { const e = S0.enemies.find((x) => !x.dead && !x.stealthOn && Math.hypot(x.x - P.x, x.z - P.z) < 11.5); if (e) S0.act(); }
      if (steps % 160 === 0) { window.__NJ.debug.waterAll(); window.__NJ.debug.harvestAll(); window.__NJ.debug.sellAll(); window.__NJ.debug.plantAll(seed); window.__NJ.debug.waterAll(); }
      if (towers && steps % 6 === 0) { buyTries++;
        if (buyTries === 1) window.__b1 = { spirit: S0.spirit, cost: DATA.TOWERS[PLAN.buy[0]].cost, D: typeof DATA };
        // 真实玩家节奏：先升级已建塔保持火力，再补新塔（各花一半库存）
        let g = 0;
        for (const t of S.towers) {
          if (t.lv >= 5) continue;
          const upc = Math.round(DATA.TOWERS[t.id].cost * DATA.UPG_COST[t.lv]);
          if (S0.spirit >= upc + 150) S0.upgradeTower(t);
          if (++g >= 3) break;
        }
        g = 0;
        while (planI < PLAN.buy.length && g++ < 30) {
          let idx = -1;
          for (let q = planI; q < PLAN.buy.length; q++) { const td = DATA.TOWERS[PLAN.buy[q]]; if (S.realm >= (td.unlock || 0) && S0.spirit >= td.cost) { idx = q; break; } }
          if (idx < 0) break;
          const id = PLAN.buy[idx];
          let ok = false;
          for (let rr = 0; rr < RING.length; rr++) {
            const pos = RING[(ringI + rr) % RING.length];
            if (S0.canPlace(pos[0], pos[1]) === null) { ok = S0.placeTower(id, pos[0], pos[1]); if (ok) ringI = (ringI + rr + 1) % RING.length; break; }
          }
          if (!ok) break;   // 暂无空位：保留 planI 下一步重试
          if (TRACE) buys.push({ steps, sp: Math.round(S0.spirit), id });
          planI = idx + 1;
          break;            // 每 6 步至多补一座新塔
        }
      }
      if (S.nexusHp <= 0) { fail = 'NexusFall@w' + S.wave; break; }
      if (steps === 600 || steps === 1800) (window.__mid = window.__mid || []).push({ c, steps, w: S.wave, wa: S.waveActive, e: S0.enemies.length, t: S.towers.length, sc: String(window.__NJ.state().screen) });
      if (S.wave >= 15 && !S.waveActive && S0.enemies.length === 0) { done2 = true; break; }
      if (steps > 120000) { fail = 'timeout@w' + S.wave + 'e' + S0.enemies.length; break; }
    }
    if (fail || done2) {
      const res = { ch: c + 1, mode: towers ? '塔' : '裸', done: done2, fail, wave: S.wave, left: Math.max(0, Math.round(S.nexusHp / S.nexusMax * 100)), towers: S.towers.length, kills: S.kills - kills0, mid: (window.__mid || []).filter(m => m.c === c), canary: RING.map((pp) => S0.canPlace(pp[0], pp[1]) ?? 'OK').slice(0, 6), placedTest: S0.placeTower('pea', 0, -12.5), planI, buyTries, b1: window.__b1 || null, spRaw: S0.spirit, maxed: S.spiritMax, secs: +((performance.now() - t0) / 1000).toFixed(1) };
      if (TRACE) res.buys = buys.slice(0, 4);
      for (const t of S.towers.slice()) S0.destroyTower(t);
      S.cleared = wasCleared;
      done(res);
    } else setTimeout(stepFn, 0);
  };
  stepFn();
}), { c, towers, TRACE });

console.log('—— A 跑：推荐构筑 ——');
const rowsA = [];
for (let c = 0; c < 8; c++) {
  const r = await runChapter({ c, towers: true });
  rowsA.push(r);
  if (TRACE || r.fail) console.log(JSON.stringify(r));
  if (r.fail && c === 0) break;
}
console.table(rowsA);
const badA = rowsA.filter((r) => !r.done || r.left < 30);
console.log(badA.length ? `A 未达标 ${badA.length}/8: ${JSON.stringify(badA.map((b) => ({ ch: b.ch, fail: b.fail, left: b.left })))}` : 'A 跑：8/8 达标（推荐构筑守稳 ≥30%）');
if (!badA.length) {
  console.log('—— B 跑：ch4+ 裸奔（应失守）——');
  const rowsB = [];
  for (let c = 3; c < 8; c++) { const r2 = await runChapter({ c, towers: false }); rowsB.push(r2); }
  console.table(rowsB);
  const soloed = rowsB.filter((r) => r.done && r.left >= 30);
  console.log(soloed.length ? `⚠ 裸奔偷活: ${JSON.stringify(soloed.map((x) => x.ch))}` : 'B 跑：裸奔皆守不住 —— 塔防为主防线 ✓');
}
console.log('pageerrors:', perr.length, perr[0] || '');
await browser.close();
process.exit(badA.length ? 1 : 0);
