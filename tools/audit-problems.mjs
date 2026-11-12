// 问题单审计：六项用户反馈各一个机械探针，METRIC problems=<未解决数 0..6>。
// 每项 try/catch：钩子缺失/异常 = 该问题未解决。用法：node tools/audit-problems.mjs [dist/html]
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
const URL = 'file:///' + resolve(process.argv[2] || 'dist/陇上修真.html').replace(/\\/g, '/');

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL + '?bench&seed=4207&dt=0.016');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
// 开局并关掉章节卡（若卡住会体现在探针超时上）
try { await page.click('#btn-new'); await page.waitForTimeout(400);
      while (await page.locator('[data-tn]').count()) { await page.click('[data-tn]'); await page.waitForTimeout(120); } await page.click('[data-ok]'); await page.waitForTimeout(300); } catch {}

const results = await page.evaluate(() => {
  const out = {};
  const NJ = window.__NJ;
  const sim = NJ.sim();
  // P1 移动映射：camYaw=π 时相机在南侧朝北，W 应 -z、D 应 +x
  try {
    const m = sim.probe.moveDir(Math.PI, 1, 0);   // W
    const r = sim.probe.moveDir(Math.PI, 0, 1);   // D
    const m2 = sim.probe.moveDir(0, 1, 0);        // camYaw=0 相机北侧朝南看 → W 应 +z
    out.p1_move = (m.z < -0.9 && Math.abs(m.x) < 0.1) && (r.x > 0.9 && Math.abs(r.z) < 0.1) && (m2.z > 0.9);
  } catch (e) { out.p1_move = false; }
  // P2 UI 层级：面板打开时盖住底栏/侧栏；toast 不压 HUD
  try {
    NJ.ui().openPanel('shop');
    const tb = document.querySelector('.toolbar').getBoundingClientRect();
    const hit = document.elementFromPoint(tb.x + tb.width / 2, tb.y + tb.height / 2);
    const covered = !!(hit && hit.closest('.panels, .panel, #pn'));
    document.querySelector('#pn .x').click();
    NJ.ui().closePanels();
    out.p2_ui = covered;
  } catch (e) { out.p2_ui = false; }
  // P3 碰撞：树点、塔心、阵眼都被推离；怪间有斥力
  try {
    const solids = sim.probe.levelInfo();
    const tree = solids.trees[0];
    const a = sim.collide(tree.x, tree.z, .42);
    const dTree = Math.hypot(a[0] - tree.x, a[1] - tree.z) >= tree.r + .42 - .02;
    const n = sim.collide(solids.nexus.x, solids.nexus.z, .42);
    const dNex = Math.hypot(n[0] - solids.nexus.x, n[1] - solids.nexus.z) >= solids.nexus.r + .42 - .02;
    sim.probe.clearEnemies();
    const gap = sim.probe.enemySeparation();   // 同点位放三只冻结怪，跑 90 帧后的最小两两距离
    out.p3_collide = dTree && dNex && gap > 0.5;
    sim.probe.clearEnemies();
  } catch (e) { out.p3_collide = false; }
  // P4 地图规模：半径与田格数
  try {
    const li = sim.probe.levelInfo();
    out.p4_size = li.bounds >= 24 && li.plots >= 40;
  } catch (e) { out.p4_size = false; }
  // P5 人物精细度：主角网格三角形数
  try { const hd = sim.probe.heroDetail(); out.p5_hero = hd.tris >= 2200 && hd.hold && hd.eyes; } catch (e) { out.p5_hero = false; }
  // P6 视角自由度：跟随模式俯仰扫掠的相机高度跨度 + 可压低近地
  try {
    const span = sim.probe.camSweep(); // {minY, maxY, elevMin, elevMax(rad above horizon)}
    out.p6_cam = (span.maxY - span.minY) >= 8 && span.elevMin <= 0.25 && span.elevMax >= 1.25;
  } catch (e) { out.p6_cam = false; }
  return out;
});
await browser.close();

const problems = Object.values(results).filter((v) => !v).length;
for (const k in results) console.log((results[k] ? 'RESOLVED ' : 'UNRESOLVED') + ' ' + k);
console.log(`METRIC problems=${problems}`);
process.exit(0);
