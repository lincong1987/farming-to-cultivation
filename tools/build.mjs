// 打包：把 index.html 的外链 CSS / JS 内联成一个可双击的单文件。
// 用法：node tools/build.mjs [输出文件]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'dist', '陇上修真.html'));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const css = readFileSync(join(ROOT, 'ui.css'), 'utf8').trim();
let out = html.replace('<link rel="stylesheet" href="ui.css">', `<style>\n${css}\n</style>`);

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
for (const src of scripts) {
  const code = readFileSync(join(ROOT, src), 'utf8').replace(/<\/script/gi, '<\\/script').trim();
  out = out.replace(`<script src="${src}"></script>`, () => `<script>\n${code}\n</script>`);
}
writeFileSync(OUT, out);
console.log(`写出 ${OUT}  ${(out.length / 1024).toFixed(0)} KB  (${scripts.length} 个脚本内联)`);
