/* 01-core — 种子随机、值噪声、数学、canvas 纹理工厂。
   全部资产零文件：每一张贴图都是运行时画出来的（沿袭《几猫港区》）。 */
'use strict';

const NJ = window.NJ = window.NJ || {};

/* ---- 随机与噪声 --------------------------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seed) {
  const root = mulberry32(seed >>> 0);
  const wrap = (fn) => ({
    next: fn,
    range: (a, b) => a + (b - a) * fn(),
    int: (n) => Math.floor(fn() * n) % Math.max(1, n),
    pick: (arr) => arr[Math.floor(fn() * arr.length) % arr.length],
    fork: () => wrap(mulberry32(Math.floor(fn() * 4294967296))),
  });
  return wrap(root);
}
function makeNoise2D(rng) {
  const P = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = rng.int(i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const grad = (h, x, y) => {
    switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; }
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = P[P[X] + Y], ab = P[P[X] + Y + 1], ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
    const x1 = grad(aa, xf, yf) * (1 - u) + grad(ba, xf - 1, yf) * u;
    const x2 = grad(ab, xf, yf - 1) * (1 - u) + grad(bb, xf - 1, yf - 1) * u;
    return (x1 * (1 - v) + x2 * v) * .7;
  };
  noise.fbm = (x, y, oct = 4, lac = 2, gain = .5) => {
    let a = .5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  };
  noise.voronoi = (x, y, scale = 8) => {
    const ix = Math.floor(x * scale), iy = Math.floor(y * scale);
    let f1 = 1e9, f2 = 1e9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox, cy = iy + oy;
      const h = hashStr(cx + ':' + cy);
      const px = cx + ((h & 255) / 255), py = cy + (((h >> 8) & 255) / 255);
      const d = (px - x * scale) ** 2 + (py - y * scale) ** 2;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [Math.sqrt(f1) / scale * 2, (Math.sqrt(f2) - Math.sqrt(f1)) / scale * 2];
  };
  return noise;
}

/* ---- 数学 --------------------------------------------------------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const dampAngle = (a, b, k, dt) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  return a + d * (1 - Math.exp(-k * dt));
};
const TAU = Math.PI * 2;
const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;

/* ---- 画布与纹理 --------------------------------------------------------- */
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(canvas, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
/* ---- 程序化贴图工厂 ------------------------------------------------------ */
// 草地：微缩沙盘感的奶绿 + 短笔触草叶
function paintGrass(size = 512, tint = [84, 128, 58]) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(4107), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4, x = p % size, y = (p / size) | 0;
    const g = nz.fbm(x / size * 7, y / size * 7, 4) * .5 + .5;
    img.data[i] = tint[0] + g * 46; img.data[i + 1] = tint[1] + g * 54; img.data[i + 2] = tint[2] + g * 30; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 700; i++) {
    const x = rng.next() * size, y = rng.next() * size, l = 2 + rng.next() * 4;
    ctx.strokeStyle = `rgba(${tint[0] + 30 + rng.next() * 40 | 0},${tint[1] + 30 + rng.next() * 60 | 0},${tint[2] + 20 + rng.next() * 30 | 0},.6)`;
    ctx.lineWidth = .8 + rng.next();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (rng.next() - .5) * 3, y - l * .6, x + (rng.next() - .5) * 4, y - l); ctx.stroke();
  }
  return c;
}
// 泥土地/土路
function paintDirt(size = 512) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(2203), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const g = nz.fbm(u * 8, v * 14, 4) * .5 + .5;
    const pebble = nz.voronoi(u, v, 26)[0];
    const i = (y * size + x) * 4;
    img.data[i] = 158 + g * 40 - pebble * 26; img.data[i + 1] = 126 + g * 32 - pebble * 22; img.data[i + 2] = 88 + g * 22 - pebble * 16; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(110,90,64,.35)';
  for (let i = 0; i < 60; i++) { const x = rng.next() * size, y = rng.next() * size; ctx.beginPath(); ctx.arc(x, y, 1 + rng.next() * 2.2, 0, TAU); ctx.fill(); }
  return c;
}
// 耕地垄沟（横纹 + 碎土）
function paintTilled(size = 256) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(9001), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const ridge = Math.sin(v * TAU * 4) * .5 + .5;
    const g = nz.fbm(u * 12, v * 12, 4) * .5 + .5;
    const i = (y * size + x) * 4;
    img.data[i] = 150 + ridge * 30 + g * 26; img.data[i + 1] = 114 + ridge * 22 + g * 20; img.data[i + 2] = 76 + ridge * 15 + g * 13; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// 石壁断崖（微缩台地的侧壁：浅色岩 + 孔洞）
function paintCliff(size = 512) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(3307), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const g = nz.fbm(u * 9, v * 9, 4) * .5 + .5;
    const band = Math.sin(v * TAU * 3) * .5 + .5;
    const i = (y * size + x) * 4;
    img.data[i] = 168 + g * 30 - band * 14; img.data[i + 1] = 150 + g * 28 - band * 12; img.data[i + 2] = 122 + g * 22 - band * 10; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(90,78,60,.4)';
  for (let i = 0; i < 70; i++) { const x = rng.next() * size, y = rng.next() * size; ctx.beginPath(); ctx.ellipse(x, y, 2 + rng.next() * 4, 1.5 + rng.next() * 2.5, rng.next() * TAU, 0, TAU); ctx.fill(); }
  return c;
}
// 陶罐（塔身与怪物体）：糊泥陶色 + 竖向抹痕 + 底部草裙纹样
function paintPot(size = 256, base = '#5a3a28') {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(5521), nz = makeNoise2D(rng);
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4, x = p % size, y = (p / size) | 0;
    const smear = nz.fbm(x / size * 6, y / size * 30, 3) * .5 + .5;
    const shade = 1 - Math.abs(x / size - .5) * .7;
    img.data[i] *= (.72 + smear * .5) * shade; img.data[i + 1] *= (.7 + smear * .46) * shade; img.data[i + 2] *= (.66 + smear * .4) * shade;
  }
  ctx.putImageData(img, 0, 0);
  // 装饰纹样：红底黄三角（参考图塔裙）
  ctx.fillStyle = 'rgba(210,190,140,.9)';
  for (let x = 0; x < size; x += 32) { ctx.beginPath(); ctx.moveTo(x, size * .82); ctx.lineTo(x + 16, size * .68); ctx.lineTo(x + 32, size * .82); ctx.closePath(); ctx.fill(); }
  return c;
}
// 兽皮/布裙：暖红底 + 锯齿
function paintCloth(size = 256, base = [196, 74, 46]) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(5510), nz = makeNoise2D(rng);
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const p = i / 4, x = p % size, y = (p / size) | 0;
    const weave = ((x >> 2) + (y >> 2)) % 2 ? .93 : 1.05;
    const g = nz.fbm(x / size * 14, y / size * 14, 3) * .5 + .5;
    img.data[i] *= weave * (.8 + g * .4); img.data[i + 1] *= weave * (.78 + g * .4); img.data[i + 2] *= weave * (.72 + g * .4);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// 木纹
function paintWood(size = 512) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(7702);
  const planks = 3, ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const base = 120 + rng.next() * 26;
    ctx.fillStyle = `rgb(${base | 0},${(base * .72) | 0},${(base * .46) | 0})`;
    ctx.fillRect(0, p * ph, size, ph - 2);
    for (let i = 0; i < 160; i++) {
      const y = p * ph + rng.next() * ph;
      ctx.strokeStyle = `rgba(64,42,24,${.05 + rng.next() * .1})`;
      ctx.lineWidth = .6 + rng.next();
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x * .05 + p) * 1.6);
      ctx.stroke();
    }
  }
  return c;
}
// 岩石（悬崖/石苔怪）
function paintStone(size = 256) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(8804), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const f = nz.fbm(u * 10, v * 10, 4) * .5 + .5;
    const crack = smooth(.44, .5, nz.voronoi(u, v, 9)[1]) * 30;
    const i = (y * size + x) * 4;
    img.data[i] = 132 + f * 36 - crack; img.data[i + 1] = 128 + f * 36 - crack; img.data[i + 2] = 118 + f * 30 - crack; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// 叶片冠（成丛叶片的通用绿皮）
function paintLeaf(size = 256) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(6613), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const f = nz.fbm(u * 8, v * 16, 4) * .5 + .5;
    const i = (y * size + x) * 4;
    img.data[i] = 62 + f * 44; img.data[i + 1] = 118 + f * 66; img.data[i + 2] = 48 + f * 30; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(30,66,24,.4)';
  for (let i = 0; i < 40; i++) {
    const x = rng.next() * size, y = rng.next() * size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 12, x + 44, y); ctx.stroke();
  }
  return c;
}
// 水面
function paintWater(size = 256) {
  const [c, ctx] = canvas2d(size, size);
  const rng = makeRng(3301), nz = makeNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const w1 = Math.sin((u * 8 + nz.fbm(u * 4, v * 4, 3)) * TAU) * .5 + .5;
    const w2 = Math.sin((v * 11 - nz.fbm(u * 5 + 9, v * 5, 3)) * TAU) * .5 + .5;
    const g = w1 * .6 + w2 * .4;
    const i = (y * size + x) * 4;
    img.data[i] = 80 + g * 60; img.data[i + 1] = 150 + g * 60; img.data[i + 2] = 170 + g * 66; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
// 中文贴图（招牌 / 关卡横幅）
function paintSign(text, sub, { w = 512, h = 256, bg = '#3f6e2c', fg = '#f2ead8' } = {}) {
  const [c, ctx] = canvas2d(w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${h * .34}px 'PingFang SC','Microsoft YaHei',sans-serif`;
  ctx.fillText(text, w / 2, h * .4);
  if (sub) { ctx.font = `500 ${h * .13}px 'PingFang SC','Microsoft YaHei',sans-serif`; ctx.fillText(sub, w / 2, h * .75); }
  return c;
}
// toon 三段渐变贴图
function makeToonRamp(steps = 4) {
  const [c, ctx] = canvas2d(steps, 1);
  const vals = steps === 4 ? [92, 150, 208, 255] : [110, 180, 255];
  for (let i = 0; i < steps; i++) { ctx.fillStyle = `rgb(${vals[i]},${vals[i]},${vals[i]})`; ctx.fillRect(i, 0, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
NJ.util = { mulberry32, hashStr, makeRng, makeNoise2D, canvas2d, toTexture };
NJ.math = { clamp, lerp, smooth, damp, dampAngle, TAU, dist2 };
