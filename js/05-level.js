/* 05-level — 关卡地形生成：微缩台地（分层圆角断崖 + 贴花草皮 + 田埂 + 水洼）、
   怪物路径（贝塞尔样条 + 出生点）、碰撞体、植被分布、灵田阵眼与农田区。
   每章一套地形主题色，风格对齐参考图的「盆栽微缩世界」。 */
'use strict';

const Level = window.Level = (() => {

  /* 主题色板：草皮顶面 / 断崖 / 雾 / 天光 / 阳光色 */
  const THEMES = {
    meadow: { grass: 0x7db24f, grassEdge: 0x5f9038, cliff: 0xd8c9a0, fog: 0xcfe0c0, sky: 0x9ec8e8, sun: 0xfff2d0, water: 0x6ab8d8 },
    peach: { grass: 0x86b858, grassEdge: 0x68984a, cliff: 0xe0cba8, fog: 0xf0d8e0, sky: 0xb8d8e8, sun: 0xffe8d8, water: 0x72bcd8 },
    bamboo: { grass: 0x6aa848, grassEdge: 0x4e8236, cliff: 0xc8c090, fog: 0xc8dcc0, sky: 0xa8d0e0, sun: 0xf4ecd0, water: 0x5aa8b8 },
    maple: { grass: 0x8fa84a, grassEdge: 0x6e8a3a, cliff: 0xd8b890, fog: 0xe8d0b8, sky: 0xc8b8d0, sun: 0xffd8a8, water: 0x6aa0b0 },
    frost: { grass: 0xbcd8e0, grassEdge: 0x9cc0cc, cliff: 0xdce8ee, fog: 0xe4f0f4, sky: 0xc8e0f0, sun: 0xf0f8ff, water: 0x8ad0e8 },
    lava: { grass: 0x7a5a44, grassEdge: 0x5e4434, cliff: 0x4a3630, fog: 0xd88a58, sky: 0x8a4a3a, sun: 0xffb070, water: 0xd85a2a },
    mist: { grass: 0x6a9a72, grassEdge: 0x527a5c, cliff: 0xb0b8a8, fog: 0xc0d0c8, sky: 0x9ab0b8, sun: 0xe8f0e0, water: 0x6a9aa0 },
    ascend: { grass: 0x8aa8d8, grassEdge: 0x6a88b8, cliff: 0xc8c0e0, fog: 0xd8d0f0, sky: 0x6a5aa0, sun: 0xf4e8b8, water: 0x9ab8f0 },
  };

  const R = 25.5;        // 主台地半径（圆角多边形）
  const SPAWN_RING = 22.5; // 怪物出生半径（台地边缘）
  const FAR = 58;          // 外围装饰环带半径

  function roundedPolyRadius(angle, r, round = .9) {
    // 8 边圆角台地轮廓：角点处向内收
    const k = Math.abs(Math.cos(angle * 4));   // 角点 0，边中点 1
    return r * lerp(round, 1, k);
  }

  function build(def, rng) {
    const theme = THEMES[def.theme] || THEMES.meadow;
    const group = new THREE.Group();

    /* ---- 主台地：两层挤出叠出圆角断崖 ---- */
    const sink = new Map();
    const shapePts = [];
    const N = 48;
    for (let i = 0; i <= N; i++) { const a = i / N * TAU; const r = roundedPolyRadius(a, R); shapePts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    const shape = new THREE.Shape(shapePts);
    const lower = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelThickness: .28, bevelSize: .3, bevelSegments: 3, curveSegments: 2 }), new THREE.MeshToonMaterial({ map: toTexture(paintCliff(), { repeat: 6 }), gradientMap: Art.G('ramp', () => rampOf()), color: theme.cliff }));
    lower.rotation.x = -Math.PI / 2; lower.position.y = -1.46; group.add(lower);

    const topMat = new THREE.MeshToonMaterial({ map: toTexture(paintGrass(512, hexRgb(theme.grass)), { repeat: 10 }), gradientMap: rampOf(), color: 0xffffff });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .3, 48), topMat);
    top.scale.set(R - .15, 1, R - .15); top.position.y = .12; group.add(top);
    // 圆角边：沿轮廓铺一圈草皮贴花圆盘，遮接缝
    for (let i = 0; i < 50; i++) { const a = i / 50 * TAU; const rr = roundedPolyRadius(a, R - .3); Art.addParts(sink, Art.M4I, 'edgedisc', Art.cyl(.5, .55, .1, 8), topMat, [Art.partLocal3(Math.cos(a) * rr, .26, Math.sin(a) * rr, 0, 0, 0, 1, 1, 1)]); }

    /* ---- 田埂环岛（外围低阶田埂，可种可守） ---- */
    const ringShape = new THREE.Shape();
    for (let i = 0; i <= N; i++) { const a = i / N * TAU; const r = roundedPolyRadius(a, R + 3.4); ringShape.moveTo && i === 0 ? ringShape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ringShape.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    const hole = new THREE.Path();
    for (let i = 0; i <= N; i++) { const a = i / N * TAU; const r = roundedPolyRadius(a, R + 1.4); i === 0 ? hole.moveTo(Math.cos(a) * r, Math.sin(a) * r) : hole.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ringShape.holes.push(hole);
    const berm = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: .5, bevelEnabled: true, bevelThickness: .12, bevelSize: .16, bevelSegments: 2, curveSegments: 2 }), new THREE.MeshToonMaterial({ map: toTexture(paintGrass(512, hexRgb(theme.grassEdge)), { repeat: 6 }), gradientMap: rampOf() }));
    berm.rotation.x = -Math.PI / 2; berm.position.y = -.42; group.add(berm);

    /* ---- 怪物路径：外环缺口 → 阵眼（贝塞尔样条） ---- */
    const lanes = buildLanes(def, rng);

    /* ---- 农田：中央 6×4 网格（24 格），每格 4×3 子格共用 ---- */
    const plots = [];
    const gridW = 8, gridH = 5, cell = 2.15;
    const tilTex = toTexture(paintTilled());
    const baseMat = new THREE.MeshToonMaterial({ map: tilTex, gradientMap: rampOf(), color: 0xd8bd94 });
    const soilMat = new THREE.MeshToonMaterial({ map: tilTex, gradientMap: rampOf(), color: 0xffffff });
    const baseGeo = Art.box(cell - .24, .34, cell - .24);
    const soilGeo = Art.box(cell - .42, .1, cell - .42);
    let nPlots = 0;
    for (let gz = 0; gz < gridH; gz++) for (let gx = 0; gx < gridW; gx++) nPlots++;
    const baseIM = new THREE.InstancedMesh(baseGeo, baseMat, nPlots);
    const soilIM = new THREE.InstancedMesh(soilGeo, soilMat, nPlots);
    const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
    const _c = new THREE.Color();
    for (let i = 0; i < nPlots; i++) soilIM.setMatrixAt(i, HIDE);
    soilIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    soilIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nPlots * 3).fill(1), 3);
    soilIM.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const grassCapMat = new THREE.MeshToonMaterial({ map: toTexture(paintGrass(256, hexRgb(theme.grass)), { repeat: 1 }), gradientMap: rampOf() });
    const capIM = new THREE.InstancedMesh(Art.box(cell - .3, .09, cell - .3), grassCapMat, nPlots);
    const capShow = [];
    group.add(baseIM, capIM, soilIM);
    let pIdx = 0;
    for (let gz = 0; gz < gridH; gz++) for (let gx = 0; gx < gridW; gx++) {
      const px = (gx - (gridW - 1) / 2) * cell;
      const pz = 2.6 + (gz - (gridH - 1) / 2) * cell;
      baseIM.setMatrixAt(pIdx, new THREE.Matrix4().makeTranslation(px, .18, pz));
      capIM.setMatrixAt(pIdx, new THREE.Matrix4().makeTranslation(px, .33, pz)); capShow.push(true);
      plots.push({ x: px, z: pz, i: pIdx, tilled: false, moisture: 0, crop: null, view: null, soilHex: -1, locked: false });
      pIdx++;
    }
    // 「未开垦」木牌：一块板 + 十字桩，锁定格上显示
    const signIM = new THREE.InstancedMesh(Art.box(cell - 1, .42, .06), new THREE.MeshToonMaterial({ map: toTexture(paintWood(), { repeat: 1 }), gradientMap: rampOf(), color: 0xc8a878 }), nPlots);
    const postIM = new THREE.InstancedMesh(Art.cyl(.05, .05, .5, 6), new THREE.MeshToonMaterial({ color: 0x6e4a2c, gradientMap: rampOf() }), nPlots);
    group.add(signIM, postIM);
    const _hm = new THREE.Matrix4().makeScale(0, 0, 0);
    const unlockPlots = (n) => {
      for (const pl of plots) {
        const wasLocked = pl.locked;
        pl.locked = plots.indexOf(pl) >= n;
        if (pl.locked) {
          const m = new THREE.Matrix4().makeTranslation(pl.x, .52, pl.z);
          signIM.setMatrixAt(pl.i, m); postIM.setMatrixAt(pl.i, new THREE.Matrix4().makeTranslation(pl.x, .28, pl.z));
        } else { signIM.setMatrixAt(pl.i, _hm); postIM.setMatrixAt(pl.i, _hm); }
        if (wasLocked === false && pl.locked === false && !pl.tilled && capShow[pl.i]) continue;
      }
      signIM.instanceMatrix.needsUpdate = true; postIM.instanceMatrix.needsUpdate = true;
    };
    unlockPlots(16);
    const _capHide = new THREE.Matrix4().makeScale(0, 0, 0);
    const setSoil = (pl, { tilled, color, wet } = {}) => {
      if (tilled !== undefined && capShow[pl.i] !== !tilled) {
        capShow[pl.i] = !tilled;
        capIM.setMatrixAt(pl.i, tilled ? _capHide : new THREE.Matrix4().makeTranslation(pl.x, .33, pl.z));
        soilIM.setMatrixAt(pl.i, tilled ? new THREE.Matrix4().makeTranslation(pl.x, .36, pl.z) : _capHide);
        capIM.instanceMatrix.needsUpdate = true; soilIM.instanceMatrix.needsUpdate = true;
      }
      if (color !== undefined && color !== pl.soilHex) { pl.soilHex = color; soilIM.setColorAt(pl.i, _c.setHex(color)); if (soilIM.instanceColor) soilIM.instanceColor.needsUpdate = true; }
    };
    soilIM.instanceMatrix.needsUpdate = true;

    /* ---- 灵田阵眼：中央白玉台 + 旋转符环 ---- */
    const nexus = new THREE.Group();
    nexus.position.set(0, .28, -6);
    const dais = new THREE.Mesh(Art.cyl(1.3, 1.6, .5, 10), new THREE.MeshToonMaterial({ map: toTexture(paintStone()), gradientMap: rampOf(), color: 0xe8ecf4 }));
    dais.position.y = .25; nexus.add(dais);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.6, 0), new THREE.MeshToonMaterial({ color: 0x8fd4f2, emissive: 0x3a8ab0, emissiveIntensity: .8, gradientMap: rampOf() }));
    crystal.position.y = 1.3; nexus.add(crystal);
    nexus.add(Art.glowSprite(0x9fe4ff, { size: 4.6, y: 1.35, base: .95 }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.0, .05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: .7 }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 1.3; nexus.add(halo);
    group.add(nexus);

    /* ---- 水洼 ×2（灵泉，回灵能加成点） ---- */
    const pools = [];
    for (let i = 0; i < 3; i++) {
      const a = rng.range(0, TAU), rr = rng.range(12, 20);
      const p = new THREE.Mesh(Art.cyl(1.4, 1.2, .12, 12), new THREE.MeshToonMaterial({ map: toTexture(paintWater()), gradientMap: rampOf(), color: theme.water }));
      p.position.set(Math.cos(a) * rr, .06, Math.sin(a) * rr); group.add(p);
      pools.push({ x: p.position.x, z: p.position.z });
    }

    /* ---- 植被：树 / 草丛 / 花 / 石头（避开农田与路径） ---- */
    const deco = [];
    const clear = (x, z, rad) => {
      if (Math.abs(x) < gridW * cell / 2 + 1.4 && z > 0 && z < gridH * cell + 4.5) return false;   // 农田区
      if (Math.hypot(x, z + 6) < 3) return false;                                                  // 阵眼
      for (const lane of lanes) { for (let t = 0; t <= 1; t += .05) { const q = lane.at(t); if (Math.hypot(x - q.x, z - q.z) < 2.2) return false; } }
      return true;
    };
    for (let i = 0; i < 46; i++) {
      const a = rng.range(0, TAU), rr = rng.range(9, R - 2);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!clear(x, z)) { i--; continue; }
      const us = rng.range(.8, 1.5);
      Art.treeParts(def.theme, i + def.id * 100, sink, x, .25, z, us);
      deco.push({ x, z, r: .7 * us, solid: true });
    }
    for (let i = 0; i < 64; i++) {
      const a = rng.range(0, TAU), rr = rng.range(3, R - 1);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!clear(x, z)) { rng.next(); continue; }
      Art.tuftParts(i * 7 + def.id, rng.next() > .6, sink, x, .25, z);
    }
    for (let i = 0; i < 30; i++) {
      const a = rng.range(0, TAU), rr = rng.range(4, R - 1);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!clear(x, z)) continue;
      if (rng.next() > .5) Art.flowerParts(i, sink, x, .26, z); else Art.mushroomParts(i, sink, x, .26, z);
    }
    for (let i = 0; i < 18; i++) {
      const a = rng.range(0, TAU), rr = rng.range(8, R - 1);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (!clear(x, z)) continue;
      Art.rockParts(i * 13 + def.id, sink, x, .2, z);
      deco.push({ x, z, r: .5, solid: true });
    }
    // 外围浮岛环带（剪影层，参考图的微缩感）
    const cliffIM = new THREE.MeshToonMaterial({ map: toTexture(paintCliff(), { repeat: 2 }), gradientMap: rampOf(), color: theme.cliff });
    const capMat = new THREE.MeshToonMaterial({ color: theme.grass, gradientMap: rampOf() });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + rng.range(-.2, .2), rr = rng.range(FAR * .7, FAR);
      const ang = a;
      const rTop = rng.range(1.6, 3.4), rBot = rng.range(.8, 1.8), h = rng.range(.8, 1.6);
      const ix = Math.cos(ang) * rr, iy = rng.range(-3, -1), iz = Math.sin(ang) * rr;
      Art.addParts(sink, Art.M4I, 'islBody', Art.cyl(1, 1, 1, 8), cliffIM, [Art.partLocal3(ix, iy, iz, 0, 0, 0, rTop, h, rBot)]);
      Art.addParts(sink, Art.M4I, 'islCap', Art.cyl(1, .94, .25, 8), capMat, [Art.partLocal3(ix, iy + h / 2, iz, 0, 0, 0, rTop, 1, rTop)]);
      Art.treeParts(def.theme, 500 + i, sink, ix, iy + h / 2 + .1, iz, .8);
    }

    Art.flushParts(group, sink);

    /* ---- 碰撞体（圆形，玩家与怪物绕行用） ---- */
    const solids = deco.filter((d) => d.solid).map((d) => ({ x: d.x, z: d.z, r: d.r, solid: true }));
    for (const p of plots) solids.push({ x: p.x, z: p.z, r: cell * .62, plot: p });
    solids.push({ x: 0, z: -6, r: .8, nexus: true, solid: true });
    const daisTop = { x: 0, z: -6, r: 1.45, top: .5 };

    /* ---- NPC 与金稻穗站位：黄金角扫描 + clear() 过滤（确定性，不依赖 rng） ---- */
    const spots = [];
    for (let i = 0; i < 72; i++) {
      const a = 2.399963 * i + def.id * .7, rr = 5 + (i * 3.7) % 16;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (clear(x, z) && Math.hypot(x, z + 6) > 3.4 && Math.hypot(x, z) < R - 2.2) spots.push([+x.toFixed(2), +z.toFixed(2)]);
    }
    const npcPos = { grannie: spots[0] || [4, -3.5], blacksmith: spots[6] || [-4, -3.5], hawker: spots[12] || [6.5, -6], aunt: spots[18] || [-6.5, -6] };
    const rices = [];
    for (let i = 4 + def.id * 5; i < 4 + def.id * 5 + 5 && i < spots.length; i++) rices.push(spots[i]);
    return {
      group, theme, def, lanes, plots, pools, solids, nexus, crystal, halo, top, setSoil, daisTop, unlockPlots, npcPos, rices,
      bounds: R - .4, bermR: R + 3.4, spawnR: SPAWN_RING,
      heightAt() { return 0; }, // 平地游戏，高度恒 0（台地顶面 y≈0.25~0.4，行走面取 0）
    };
  }

  /* ---- 车道样条：三个出生缺口汇入阵眼 ---- */
  function buildLanes(def, rng) {
    const target = { x: 0, z: -6 };
    const lanes = [];
    const baseA = [0.4, 2.5, 4.6];
    for (const a0 of baseA) {
      const a = a0 + rng.range(-.3, .3);
      const spawn = { x: Math.cos(a) * SPAWN_RING, z: Math.sin(a) * SPAWN_RING };
      const midA = a + rng.range(-.7, .7);
      const mid = { x: Math.cos(midA) * rng.range(10, 15), z: Math.sin(midA) * rng.range(10, 15) };
      const ctrl1 = { x: lerp(spawn.x, mid.x, .5) + rng.range(-3.6, 3.6), z: lerp(spawn.z, mid.z, .5) + rng.range(-3.6, 3.6) };
      const ctrl2 = { x: lerp(mid.x, target.x, .5) + rng.range(-2.4, 2.4), z: lerp(mid.z, target.z, .5) + rng.range(-3.6, 3.6) };
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(spawn.x, 0, spawn.z),
        new THREE.Vector3(ctrl1.x, 0, ctrl1.z),
        new THREE.Vector3(mid.x, 0, mid.z),
        new THREE.Vector3(ctrl2.x, 0, ctrl2.z),
        new THREE.Vector3(target.x, 0, target.z),
      ]);
      // 预采样加速
      const samples = c.getSpacedPoints(80);
      lanes.push({ curve: c, samples, len: Math.max(30, c.getLength()), at(t) { const i = clamp(Math.round(t * 80), 0, 80); return samples[i]; }, spawn });
    }
    return lanes;
  }

  let _ramp = null;
  function rampOf() { if (!_ramp) _ramp = makeToonRamp(4); return _ramp; }
  function hexRgb(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }

  return { build, THEMES, R, SPAWN_RING };
})();
