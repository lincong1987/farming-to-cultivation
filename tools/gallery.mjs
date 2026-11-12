// 多机位美术取证：标题 / 阵眼列队 / 塔群实战 / 夜战 / 第5章冰原。
// 用法：node tools/gallery.mjs [dist/html] [shots目录]
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
const URL = 'file:///' + resolve(process.argv[2] || 'dist/农家青年的逆袭.html').replace(/\\/g, '/');
const OUT = resolve(process.argv[3] || 'shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(URL + '?bench&seed=4207&dt=0.016');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
await shot('g1-title');

// 开局 → 布景
await page.click('#btn-new'); await wait(400);
await page.click('[data-ok]'); await wait(300);
await page.evaluate(() => {
  const D = window.__NJ.debug, sim = window.__NJ.sim();
  D.money(99999); D.seeds(40); D.realm(4);
  sim0(); function sim0() { window.__NJ.sim().S.spiritMax = 9999; window.__NJ.sim().addSpirit(9999); }
  // 农田：全部种熟，一半已刨一半水灵
  D.plantAll('radish'); D.growAll();
});
await wait(300);
// 塔群沿车道列队 + 怪物在阵眼前列队（冰冻当模特）
const stage = await page.evaluate(() => {
  const sim = window.__NJ.sim();
  const kinds = ['pea', 'pome', 'shroom', 'cactus', 'sun', 'chomp'];
  const spots = [[7, -3.2], [5.4, -9.5], [-5.6, -9.3], [-7.4, -3], [0, 9.6], [9.2, 4],
                 [8, -6], [-8, -7], [4.5, 9], [-4.5, 9.5], [11, -2], [-11, 0], [12, 5], [-12, 6], [0, -12]];
  let n = 0, si = 0;
  for (const k of kinds) {
    for (; si < spots.length; si++) { if (sim.canPlace(spots[si][0], spots[si][1])) continue; sim.placeTower(k, spots[si][0], spots[si][1]); n++; si++; break; }
  }
  const ids = ['sprout', 'mush', 'potling', 'runner', 'beetle', 'moth'];
  const arc = ids.map((id, i) => {
    const a = -Math.PI * .9 + i / (ids.length - 1) * Math.PI * .8;
    return { id, x: Math.cos(a) * 3.6, z: -6 + Math.sin(a) * 3.6 + (i % 2 ? .5 : -.4) };
  });
  arc.forEach(({ id, x, z }) => {
    sim.spawnEnemy({ id, hp: 1e5, speedMul: 1 });
    const e = sim.enemies[sim.enemies.length - 1];
    e.x = x; e.z = z; e.stunT = 1e9;
  });
  return n;
});
console.log('stage towers:', stage);
// 拉近第一人称/近景跟随拍列队
await page.evaluate(() => { const P = window.__NJ.sim().P; P.x = 0; P.z = 3.2; P.camYaw = Math.PI; P.camMode = 0; P.camDist = 9; });
await wait(900);
await shot('g2-nexus-parade');

// 俯瞰全景
await page.evaluate(() => { const P = window.__NJ.sim().P; P.camMode = 1; P.camDist = 22; P.x = 0; P.z = 2; });
await wait(900);
await shot('g3-overview');

// 夜战：黄昏光线 + 远程开火
await page.evaluate(() => {
  const sim = window.__NJ.sim();
  const P = sim.P; P.camMode = 0; P.camDist = 12; P.x = 4; P.z = -1;
  sim.setTime01(.86);
  // 放一波活怪
  for (let i = 0; i < 7; i++) sim.spawnEnemy({ id: 'sprout', hp: 300, speedMul: 1 });
  sim.enemies.forEach((e) => { e.stunT = 0; });
  sim.S.towers.forEach((t) => t.cd = 0);
});
await wait(1600);
await shot('g4-night-fire');

// 第5章冰原主题
await page.evaluate(() => { window.__NJ.debug.goto(4); });
await wait(900);
await page.evaluate(() => {
  const sim = window.__NJ.sim(); const P = sim.P;
  P.camMode = 1; P.camDist = 20;
  for (let i = 0; i < 5; i++) { sim.spawnEnemy({ id: 'frostwolf', hp: 900, speedMul: 1 }); sim.spawnEnemy({ id: 'iceimp', hp: 600, speedMul: 1 }); }
  sim.enemies.forEach((e, i) => { const a = i / sim.enemies.length * Math.PI * 2; e.stunT = 1e9; e.x = Math.cos(a) * 5; e.z = 3 + Math.sin(a) * 4; });
});
await wait(900);
await shot('g5-frost');

await browser.close();
console.log('gallery done →', OUT);
