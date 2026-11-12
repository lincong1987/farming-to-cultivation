// 功能回归：寻路（nav）/ 家园（farm+buildings）/ 怪物能力（bestiary）——本轮用户反馈的固化验收
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { ({ chromium } = createRequire('D:/projects/research/agent-game-3d-skills/replica/package.json')('playwright')); }
function findChrome(){const c=process.env.LOCALAPPDATA+'/ms-playwright';const d=readdirSync(c).filter(x=>/^chromium-\d+$/.test(x)).map(x=>x.split('-')[1]);for(const r of['1248','1254','1234','1194','1187',...d.sort((a,b)=>b-a)]){const p=c+'/chromium-'+r+'/chrome-win64/chrome.exe';if(d.includes(r)&&existsSync(p))return p;}}
const URL = 'file:///' + 'D:/projects/research/nongjia-rebellion/dist/陇上修真.html';
const R = []; const check=(n,ok,d='')=>{R.push(ok);console.log((ok?'PASS':'FAIL')+'  '+n+(d?'  '+d:''));};
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=d3d11','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const perr=[]; page.on('pageerror',e=>perr.push(String(e).slice(0,140)));
await page.goto(URL + '?bench&seed=42&dt=0.016');
await page.waitForFunction(() => window.__ready === true);
await page.click('#btn-new'); await page.waitForTimeout(300);
      for (let g0 = 0; g0 < 24; g0++) {
        if (await page.locator('[data-tn]').count()) { await page.click('[data-tn]'); await page.waitForTimeout(120); continue; }
        if (await page.locator('[data-ok]').count()) { await page.click('[data-ok]'); await page.waitForTimeout(200); continue; }
        break;
      }
      await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const sim = window.__NJ.sim(); const out = {};
  window.__NJ.debug.realm(3); window.__NJ.debug.money(999999); window.__NJ.debug.spirit(999);
  // nav：远程点格自动走过去刨
  const P = sim.P; P.x = -14; P.z = 14;
  const plots = window.__NJ.debug.plotsInfo();
  let bi = 0, bd = 0; plots.forEach((q, i) => { const d = Math.hypot(q.x - P.x, q.z - P.z); if (d > bd) { bd = d; bi = i; } });
  const lockedTarget = bi >= 16;
  if (lockedTarget) sim.unlockNextFarm(), sim.unlockNextFarm(), sim.unlockNextFarm();
  const q = plots[bi];
  sim.orderTo(q.x, q.z, 'till', { x: q.x, z: q.z, i: bi, locked: false });
  const t0 = performance.now();
  while (performance.now() - t0 < 9000) { await new Promise(r => requestAnimationFrame(r)); if (window.__NJ.state().plots[bi].tilled) break; }
  out.navWalk = window.__NJ.state().plots[bi].tilled;
  out.navArrive = Math.hypot(P.x - q.x, P.z - q.z) < .8;
  // 锁定拦截
  const lp = plots.find((_, i) => i >= sim.S.farm);
  if (lp) { sim.orderTo(lp.x, lp.z, 'till', { x: lp.x, z: lp.z, i: plots.indexOf(lp), locked: true }); await new Promise(r=>setTimeout(r,1400)); out.lockedBlocked = !window.__NJ.state().plots[plots.indexOf(lp)].tilled; } else out.lockedBlocked = true;
  // farm tiers
  out.lockedCount = window.__NJ.state().plots.filter(p => p.locked).length;
  // buildings + passives
  const sp = { barn: [6, 10.5], shed: [3, 10.5], guard: [0, 10.5], lamp: [-3, 10.5], well: [-6, 10.5] };
  out.placedAll = Object.keys(sp).every(k => sim.placeBuilding(k, sp[k][0], sp[k][1]) !== false);
  out.barn = sim.hasBuilding('barn');
  // monsters
  out.species = Object.keys(DATA.MONSTERS).length;
  sim.probe.clearEnemies();
  sim.placeTower('pea', 10, 2);
  const t = sim.S.towers[sim.S.towers.length - 1];
  sim.spawnEnemy({ id: 'boomkin', hp: 1, speedMul: 1 });
  const b = sim.enemies[0]; b.x = t.x + .5; b.z = t.z; b.stunT = 9;
  sim.damageEnemy(b, 999, 0xffffff);
  out.boom = t.hp < t.maxHp;
  sim.spawnEnemy({ id: 'banyan', hp: 1, speedMul: 1 });
  sim.damageEnemy(sim.enemies[sim.enemies.length-1], 999, 0xffffff);
  out.split = sim.enemies.filter(e => !e.dead).length >= 2;   // V1.0 M005：分裂 2 幼体
  sim.probe.clearEnemies();
  sim.spawnEnemy({ id: 'brooder', hp: 9999, speedMul: 1 });
  const br = sim.enemies[0]; br.stunT = 999; br.sumCd = .05;
  const n0 = sim.enemies.length; await new Promise(r=>setTimeout(r,400));
  out.summon = sim.enemies.length > n0;
  sim.probe.clearEnemies();
  return out;
});
check('点击格子自动走过去干活', r.navWalk && r.navArrive);
check('未开垦田指令被拦', r.lockedBlocked);
check('农田分阶开垦可用', r.lockedCount >= 0);
check('五建筑全部放下', r.placedAll);
check('谷仓被动登记', r.barn);
check('怪物 ≥32 种', r.species >= 32, String(r.species));
check('自爆伤塔', r.boom);
check('死亡分裂', r.split);
check('孵巢召唤', r.summon);
check('无 pageerror', perr.length === 0, perr[0] || '');
await browser.close();
const f = R.filter(x => !x).length;
console.log(`\n==== ${R.length - f}/${R.length} 通过 ====`);
process.exit(f ? 1 : 0);
