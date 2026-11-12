// 从 jimao-port 复刻产物提取原始 three.js，包成标准全局 THREE 命名空间。
// 原包（esbuild IIFE）顶部的 br(lt,{...}) 已把全部公开导出挂到 lt 上，
// 因此包一层 return lt 即得完整公开 API（THREE.Scene / THREE.WebGLRenderer / REVISION ...）。
//
// 用法：node tools/vendor-three.mjs <jimao-port/replica/vendor/three.js> <输出路径>
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = process.argv[3] || 'vendor/three.js';
const src = readFileSync(SRC, 'utf8');

const head = src.indexOf('(() => {\n');
const tail = src.lastIndexOf(';\nreturn {');
if (head < 0 || tail < 0 || tail <= head) throw new Error('输入不是预期的 jimao-port vendor/three.js 形状');
const threeCode = src.slice(head + '(() => {\n'.length, tail);

const out = `/* three.js r180（MIT）—— 由《几猫港区》单文件包中提取的 three.js 部分原样保留（压缩态）。
   上游 Felix Rieseberg 的 Saltline / 本仓库 jimao-port 复刻同源。 */
window.THREE = (() => {
${threeCode}
;
return lt;
})();
`;
writeFileSync(OUT, out);
console.log('写出', OUT, out.length, 'chars');
