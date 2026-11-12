// 静帧 draw call 基准：构建后的 dist 在无头里跑固定场景，输出 METRIC 行。
// 用法：node tools/bench-calls.mjs [dist/html]
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
const URL = 'file:///' + resolve(process.argv[2] || 'dist/农家青年的逆袭.html').replace(/\\/g, '/');

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const fatal = [];
page.on('pageerror', (e) => fatal.push(String(e).slice(0, 120)));
await page.goto(URL + '?bench&seed=4207&dt=0.016');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
// 开局进第 1 章静帧（标题相机环绕同场景，draw 数一致且确定性由 seed 保证）
await page.waitForFunction(() => window.__frames > 60, null, { timeout: 60000 });
const info = await page.evaluate(() => window.__NJ.info());
await browser.close();
if (fatal.length || info == null || info.calls === undefined) { console.error('BENCH FAIL', fatal.join('|')); process.exit(2); }
console.log(`METRIC draw_calls=${info.calls}`);
console.log(`METRIC tris=${info.tris}`);
process.exit(0);
