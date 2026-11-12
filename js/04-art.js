/* 04-art — 程序化美术：toon 材质库、Q 版角色、作物、陶罐塔、盆栽怪、树丛贴花、
   弹幕与特效池。造型语言对齐参考图：黑陶罐体 + 植物冠 + 发光黄眼、糊泥炮塔、
   微缩台地、三头身兜帽主角。全部几何体运行时拼出，零模型文件。 */
'use strict';

const Art = window.Art = (() => {

  let mats = null, ramp = null;
  const geoCache = {};

  function G(key, make) { return geoCache[key] || (geoCache[key] = make()); }
  const cyl = (rt, rb, h, s = 8) => G(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const sph = (r, w = 10, h = 8) => G(`s${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
  const box = (a, b, c) => G(`b${a}_${b}_${c}`, () => new THREE.BoxGeometry(a, b, c));
  const cone = (r, h, s = 6) => G(`k${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));

  function toon(color, extra = {}) {
    return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
  }
  function makeMaterials() {
    ramp = makeToonRamp(4);
    const skin = toon(0xf6cfa4);
    mats = {
      grass: toon(0x74a34a), grassDark: toon(0x527f36),
      dirt: new THREE.MeshToonMaterial({ map: toTexture(paintDirt(), { repeat: 4 }), gradientMap: ramp }),
      tilled: new THREE.MeshToonMaterial({ map: toTexture(paintTilled()), gradientMap: ramp }),
      tilledDry: new THREE.MeshToonMaterial({ map: toTexture(paintTilled()), gradientMap: ramp, color: 0xd8c0a0 }),
      cliff: new THREE.MeshToonMaterial({ map: toTexture(paintCliff(), { repeat: 2 }), gradientMap: ramp }),
      wood: new THREE.MeshToonMaterial({ map: toTexture(paintWood(), { repeat: 1 }), gradientMap: ramp }),
      stone: new THREE.MeshToonMaterial({ map: toTexture(paintStone()), gradientMap: ramp }),
      pot: new THREE.MeshToonMaterial({ map: toTexture(paintPot()), gradientMap: ramp }),
      potDark: new THREE.MeshToonMaterial({ map: toTexture(paintPot(256, '#3c2417')), gradientMap: ramp }),
      cloth: new THREE.MeshToonMaterial({ map: toTexture(paintCloth()), gradientMap: ramp }),
      clothGreen: new THREE.MeshToonMaterial({ map: toTexture(paintCloth(256, [72, 130, 64])), gradientMap: ramp }),
      leaf: new THREE.MeshToonMaterial({ map: toTexture(paintLeaf()), gradientMap: ramp }),
      leafFlat: toon(0x4e8a34), leafYellow: toon(0xc8b23c), leafRed: toon(0xc0512a),
      skin, hood: toon(0x3a5a9a), hair: toon(0xe8c85a), shirt: toon(0xf2ead8), vest: toon(0x8a5ab8),
      boot: toon(0x6e4a2c), belt: toon(0x4a3420),
      eye: new THREE.MeshBasicMaterial({ color: 0x1a1410 }),
      glow: toon(0xffd23c, { emissive: 0xffb020, emissiveIntensity: .9 }),
      glowEye: new THREE.MeshBasicMaterial({ color: 0xffe27a }),
      water: new THREE.MeshToonMaterial({ map: toTexture(paintWater()), gradientMap: ramp, transparent: true, opacity: .92 }),
      petalPink: toon(0xf0a0c0), petalWhite: toon(0xf6ead0),
      metal: toon(0xa8b0b8), gold: toon(0xf0c34a, { emissive: 0x503800, emissiveIntensity: .25 }),
      cropBase: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }),
      cropGlow: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }),
      leafDark: toon(0x3e6e2a),
      white: toon(0xffffff), gray: toon(0x9a948a),
      heart: new THREE.MeshBasicMaterial({ color: 0xe0342f }),
    };
    return mats;
  }
  function matFor(hex, flat) { const k = 't' + hex + (flat ? 'f' : ''); return mats[k] || (mats[k] = toon(hex, flat ? { flatShading: true } : {})); }

  /* ---- 冠饰：塔/怪/作物通用的植物部件工厂 --------------------------------- */
  function crest(kind, color = 0x6aa33c, s = 1) {
    const g = new THREE.Group();
    const m = matFor(color);
    if (kind === 'sprout') {
      const stem = new THREE.Mesh(cyl(.02 * s, .03 * s, .3 * s, 5), mats.leafFlat); stem.position.y = .15 * s; g.add(stem);
      for (const dir of [-1, 1]) {
        const l = new THREE.Mesh(sph(.09 * s, 7, 5), m); l.scale.set(1.5, .35, .9);
        l.position.set(dir * .08 * s, .3 * s, 0); l.rotation.z = dir * .7; g.add(l);
      }
    } else if (kind === 'mushroom') {
      const cap = new THREE.Mesh(sph(.26 * s, 9, 6), m); cap.scale.set(1, .62, 1); cap.position.y = .16 * s; g.add(cap);
      for (let i = 0; i < 4; i++) { const dot = new THREE.Mesh(sph(.045 * s, 5, 4), mats.petalWhite); const a = i * 1.7; dot.position.set(Math.cos(a) * .14 * s, .24 * s, Math.sin(a) * .14 * s); g.add(dot); }
    } else if (kind === 'star') {
      for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(cone(.09 * s, .3 * s, 4), m); const a = i / 5 * TAU; p.position.set(Math.cos(a) * .1 * s, .14 * s, Math.sin(a) * .1 * s); p.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7); g.add(p); }
    } else if (kind === 'canopy') {
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(sph((.2 - i * .04) * s, 8, 6), i ? m : mats.leafDark || m); b.position.y = (.08 + i * .14) * s; b.scale.y = .75; g.add(b); }
    } else if (kind === 'twigs') {
      for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(cyl(.012 * s, .022 * s, .34 * s, 4), mats.boot); const a = i / 5 * TAU; t.position.set(Math.cos(a) * .06 * s, .16 * s, Math.sin(a) * .06 * s); t.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); g.add(t); }
    } else if (kind === 'wing') {
      for (const dir of [-1, 1]) { const w = new THREE.Mesh(sph(.2 * s, 7, 5), m); w.scale.set(1.5, .22, .9); w.position.set(dir * .16 * s, .1 * s, 0); w.rotation.z = dir * .5; g.add(w); }
    } else if (kind === 'shell') {
      const s2 = new THREE.Mesh(sph(.24 * s, 9, 6), m); s2.scale.set(1.1, .7, 1.3); s2.position.y = .1 * s; g.add(s2);
    } else if (kind === 'pitcher') {
      const p = new THREE.Mesh(cyl(.12 * s, .07 * s, .34 * s, 7), m); p.position.y = .17 * s; g.add(p);
      const lip = new THREE.Mesh(cyl(.14 * s, .12 * s, .05 * s, 7), matFor(0xd86a3c)); lip.position.y = .34 * s; g.add(lip);
    } else if (kind === 'tendrils') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const t = new THREE.Mesh(cyl(.014 * s, .026 * s, .36 * s, 4), m); t.position.set(Math.cos(a) * .1 * s, .18 * s, Math.sin(a) * .1 * s); t.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); g.add(t); }
    } else if (kind === 'crystal') {
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; const c = new THREE.Mesh(cone(.06 * s, .26 * s, 4), m); c.position.set(Math.cos(a) * .09 * s, .12 * s, Math.sin(a) * .09 * s); c.rotation.set(Math.sin(a) * .3, 0, -Math.cos(a) * .3); g.add(c); }
    } else if (kind === 'flame') {
      const f = new THREE.Mesh(cone(.14 * s, .4 * s, 6), toon(0xff8a2f, { emissive: 0xff5a00, emissiveIntensity: 1 })); f.position.y = .2 * s; g.add(f);
      const f2 = new THREE.Mesh(cone(.08 * s, .24 * s, 6), toon(0xffd23c, { emissive: 0xffa000, emissiveIntensity: 1 })); f2.position.y = .3 * s; g.add(f2);
    } else if (kind === 'ears') {
      for (const dir of [-1, 1]) { const e = new THREE.Mesh(cone(.08 * s, .24 * s, 5), m); e.position.set(dir * .1 * s, .2 * s, 0); e.rotation.z = dir * .25; g.add(e); }
    } else if (kind === 'halo') {
      const t = new THREE.Mesh(new THREE.TorusGeometry(.24 * s, .03 * s, 6, 14), mats.glow); t.rotation.x = Math.PI / 2; t.position.y = .36 * s; g.add(t);
    } else if (kind === 'vine') {
      const v = new THREE.Mesh(new THREE.TorusGeometry(.16 * s, .04 * s, 6, 12), m); v.rotation.x = Math.PI / 2.4; v.position.y = .2 * s; g.add(v);
      for (const dir of [-1, 1]) { const l = new THREE.Mesh(sph(.1 * s, 6, 5), m); l.scale.set(1.4, .4, .8); l.position.set(dir * .16 * s, .26 * s, 0); g.add(l); }
    } else if (kind === 'petals') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const p = new THREE.Mesh(sph(.16 * s, 7, 5), m); p.scale.set(1.6, .3, 1); p.position.set(Math.cos(a) * .14 * s, .1 * s, Math.sin(a) * .14 * s); p.rotation.y = -a; g.add(p); }
      const mid = new THREE.Mesh(sph(.09 * s, 7, 5), mats.glow); mid.position.y = .2 * s; g.add(mid);
    } else if (kind === 'pea') {
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const p = new THREE.Mesh(sph(.11 * s, 6, 5), m); p.position.set(Math.cos(a) * .1 * s, .06 * s, Math.sin(a) * .1 * s); g.add(p); }
    } else if (kind === 'cactus') {
      const c = new THREE.Mesh(cyl(.07 * s, .09 * s, .4 * s, 7), m); c.position.y = .2 * s; g.add(c);
      const a1 = new THREE.Mesh(cyl(.045 * s, .055 * s, .18 * s, 6), m); a1.position.set(.1 * s, .22 * s, 0); a1.rotation.z = -.5; g.add(a1);
    } else if (kind === 'chomp') {
      const jaw = new THREE.Mesh(cyl(.02 * s, .16 * s, .2 * s, 7), m); jaw.position.y = .1 * s; g.add(jaw);
      const top = new THREE.Mesh(cyl(.18 * s, .1 * s, .14 * s, 7), matFor(0xd86ab8)); top.position.y = .24 * s; g.add(top);
    } else if (kind === 'sun') {
      const c = new THREE.Mesh(cyl(.1 * s, .1 * s, .05 * s, 8), mats.boot); c.position.y = .16 * s; g.add(c);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const p = new THREE.Mesh(box(.05 * s, .012 * s, .12 * s), mats.glow); p.position.set(Math.cos(a) * .14 * s, .17 * s, Math.sin(a) * .14 * s); p.rotation.y = -a; g.add(p); }
    } else if (kind === 'ice') {
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; const p = new THREE.Mesh(box(.14 * s, .02 * s, .14 * s), matFor(0xbfe8f8)); p.position.set(Math.cos(a) * .1 * s, .06 * s, Math.sin(a) * .1 * s); p.rotation.y = a; g.add(p); }
      const l = new THREE.Mesh(sph(.07 * s, 7, 5), mats.glowEye ? matFor(0x8fd4f2) : matFor(0x8fd4f2)); l.position.y = .12 * s; g.add(l);
    } else if (kind === 'pome') {
      const p = new THREE.Mesh(sph(.16 * s, 8, 6), m); p.scale.y = 1.2; p.position.y = .12 * s; g.add(p);
      const cr = new THREE.Mesh(cyl(.02 * s, .04 * s, .12 * s, 5), mats.leafFlat); cr.position.y = .3 * s; g.add(cr);
    } else if (kind === 'bamboo') {
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(cyl(.035 * s, .04 * s, .5 * s, 6), matFor(0x6a9a4a)); b.position.set((i - 1) * .08 * s, .25 * s, (i % 2) * .04 * s); b.rotation.z = (i - 1) * .12; g.add(b); }
    } else if (kind === 'seal') {
      const pl = new THREE.Mesh(box(.3 * s, .02 * s, .3 * s), matFor(0xe8d8a8)); pl.position.y = .06 * s; pl.rotation.y = .5; g.add(pl);
      const fu = new THREE.Mesh(box(.06 * s, .26 * s, .015 * s), matFor(0xf0e8c8)); fu.position.y = .2 * s; g.add(fu);
      const gl = new THREE.Mesh(sph(.05 * s, 6, 5), mats.glow); gl.position.y = .34 * s; g.add(gl);
    }
    return g;
  }

  /* ---- 主角：三头身兜帽农家青年（精细化：五官/发梢/围巾/背包葫芦/手持挂点） -- */
  function heroMesh() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body); g.userData.body = body;
    // 腿 + 靴（走路摆动）
    const legs = [];
    for (const dir of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(dir * .085, .3, 0); body.add(leg);
      const pants = new THREE.Mesh(cyl(.068, .06, .18, 7), mats.hood); pants.position.y = -.07; leg.add(pants);
      const boot = new THREE.Mesh(cyl(.072, .078, .13, 8), mats.boot); boot.position.set(0, -.22, .012); boot.rotation.x = -.08; leg.add(boot);
      const sole = new THREE.Mesh(box(.16, .035, .2), mats.belt); sole.position.set(0, -.29, .04); leg.add(sole);
      const toe = new THREE.Mesh(sph(.07, 7, 5), mats.boot); toe.scale.set(.9, .6, .8); toe.position.set(0, -.25, .11); leg.add(toe);
      legs.push(leg);
    }
    g.userData.legs = legs;
    // 身子：束腰短褂 + 罩袍下摆 + 围巾 + 褡裢
    const torso = new THREE.Mesh(cyl(.165, .135, .32, 12), mats.shirt); torso.position.y = .46; body.add(torso);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(.15, .21, .14, 12, 1, true), mats.vest); hem.position.y = .3; body.add(hem);
    const vest = new THREE.Mesh(cyl(.172, .16, .18, 12), mats.hood); vest.position.y = .53; body.add(vest);
    const strap = new THREE.Mesh(box(.05, .3, .02), mats.belt); strap.position.set(.05, .5, .15); strap.rotation.z = -.5; body.add(strap);
    const beltM = new THREE.Mesh(cyl(.178, .178, .045, 12), mats.belt); beltM.position.y = .355; body.add(beltM);
    const buckle = new THREE.Mesh(box(.05, .05, .02), mats.gold); buckle.position.set(0, .355, .175); body.add(buckle);
    const satchel = new THREE.Mesh(box(.11, .09, .07), mats.boot); satchel.position.set(-.17, .36, -.02); satchel.rotation.z = .12; body.add(satchel);
    const flap = new THREE.Mesh(box(.115, .03, .075), mats.belt); flap.position.set(-.17, .415, -.02); flap.rotation.z = .12; body.add(flap);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(.125, .045, 7, 14), matFor(0xd8543c)); scarf.position.y = .635; scarf.rotation.x = Math.PI / 2; body.add(scarf);
    const scarfTail = new THREE.Mesh(box(.05, .12, .02), matFor(0xd8543c)); scarfTail.position.set(.07, .58, .1); scarfTail.rotation.set(.3, 0, .4); body.add(scarfTail);
    // 背包葫芦（灵泉）
    const pack = new THREE.Group(); pack.position.set(0, .48, -.19); body.add(pack);
    const bottle = new THREE.Mesh(sph(.07, 9, 7), matFor(0xb0784a)); bottle.scale.set(1, 1.25, 1); pack.add(bottle);
    const bottleNeck = new THREE.Mesh(cyl(.026, .034, .06, 7), matFor(0xb0784a)); bottleNeck.position.y = .1; pack.add(bottleNeck);
    const cork = new THREE.Mesh(cyl(.03, .03, .022, 7), mats.wood); cork.position.y = .14; pack.add(cork);
    const strapL = new THREE.Mesh(box(.025, .22, .015), mats.belt); strapL.position.set(.07, .1, .12); strapL.rotation.x = -.3; pack.add(strapL);
    const strapR = new THREE.Mesh(box(.025, .22, .015), mats.belt); strapR.position.set(-.07, .1, .12); strapR.rotation.x = -.3; pack.add(strapR);
    // 手臂（上臂+小臂+手；右手挂武器）
    const arms = [];
    for (const dir of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(dir * .185, .585, 0); body.add(arm);
      const sleeve = new THREE.Mesh(cyl(.05, .045, .15, 7), mats.hood); sleeve.position.y = -.06; sleeve.rotation.z = dir * .3; arm.add(sleeve);
      const fore = new THREE.Mesh(cyl(.04, .036, .13, 7), mats.skin); fore.position.set(dir * .045, -.19, .02); arm.add(fore);
      const hand = new THREE.Mesh(sph(.042, 7, 6), mats.skin); hand.position.set(dir * .055, -.265, .03); arm.add(hand);
      arms.push(arm);
    }
    g.userData.arms = arms;
    const hold = new THREE.Group(); hold.position.set(.06, -.28, .06); hold.rotation.set(-.5, 0, -.2); arms[1].add(hold);
    g.userData.hold = hold;
    // 头（大头，占身高 ~45%）
    const head = new THREE.Group(); head.position.y = .95; body.add(head); g.userData.head = head;
    const skull = new THREE.Mesh(sph(.255, 16, 12), mats.skin); skull.scale.set(1, .96, .95); head.add(skull);
    const hoodM = new THREE.Mesh(sph(.29, 16, 12), mats.hood); hoodM.scale.set(1.01, 1.02, 1); hoodM.position.set(0, .03, -.06); head.add(hoodM);
    const brim = new THREE.Mesh(cyl(.2, .28, .11, 14, 1, true), mats.hood); brim.position.set(0, .11, .05); brim.rotation.x = .55; head.add(brim);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(.205, .022, 6, 14, Math.PI), mats.gold); trim.position.set(0, .14, .07); trim.rotation.set(.55, 0, Math.PI); head.add(trim);
    const hoodTail = new THREE.Mesh(cyl(.06, .015, .2, 6), mats.hood); hoodTail.position.set(0, .16, -.28); hoodTail.rotation.x = -.9; head.add(hoodTail);
    // 头发：刘海三束 + 鬓角 + 呆毛
    const fringeGeo = sph(.085, 7, 5);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(fringeGeo, mats.hair); f.scale.set(1.5, .55, .5); f.position.set((i - 1) * .115, .17, .2); f.rotation.set(-.35, 0, (i - 1) * .22); head.add(f); }
    for (const dir of [-1, 1]) { const side = new THREE.Mesh(sph(.05, 6, 5), mats.hair); side.scale.set(.6, 1.7, .8); side.position.set(dir * .21, -.02, .13); head.add(side); }
    const tuft = new THREE.Mesh(cyl(.022, .01, .13, 5), mats.hair); tuft.position.set(0, .28, .11); tuft.rotation.x = -.45; head.add(tuft);
    // 尖耳（Link 感）
    for (const dir of [-1, 1]) { const ear = new THREE.Mesh(cone(.045, .14, 5), mats.skin); ear.position.set(dir * .25, .01, 0); ear.rotation.set(0, 0, dir * 1.45); ear.scale.set(1, 1, .5); head.add(ear); }
    // 五官：眼白+瞳+高光（眨眼引用）、眉、鼻、嘴、腮红
    const eyes = [];
    for (const dir of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(dir * .098, 0, .225); head.add(eye);
      const white = new THREE.Mesh(sph(.048, 8, 7), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp })); white.scale.set(.8, 1.15, .5); eye.add(white);
      const pupil = new THREE.Mesh(sph(.026, 7, 6), mats.eye); pupil.position.set(dir * .004, -.004, .028); eye.add(pupil);
      const glint = new THREE.Mesh(sph(.009, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(dir * -.012, .016, .04); eye.add(glint);
      eyes.push(eye);
    }
    g.userData.eyeL = eyes[0]; g.userData.eyeR = eyes[1];
    for (const dir of [-1, 1]) { const brow = new THREE.Mesh(box(.075, .015, .02), mats.hair); brow.position.set(dir * .098, .085, .235); brow.rotation.z = dir * -.22; head.add(brow); }
    const nose = new THREE.Mesh(sph(.02, 6, 5), mats.skin); nose.position.set(0, -.03, .26); head.add(nose);
    const mouth = new THREE.Mesh(box(.05, .012, .012), matFor(0x9a4a3a)); mouth.position.set(0, -.105, .235); head.add(mouth);
    for (const dir of [-1, 1]) { const blush = new THREE.Mesh(sph(.04, 6, 5), matFor(0xf09a8a)); blush.scale.set(1, .6, .35); blush.position.set(dir * .165, -.06, .19); head.add(blush); }
    return g;
  }

  /* ---- 武器挂饰（右手持有） ------------------------------------------------- */
  function weaponMesh(id) {
    const g = new THREE.Group();
    const mk = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
    if (id === 'hoe') { mk(cyl(.016, .02, .5, 6), mats.wood, 0, 0, 0); mk(box(.04, .09, .07), mats.metal, 0, -.25, .028, .25, 0, 0); }
    else if (id === 'sickle') { mk(cyl(.014, .018, .3, 6), mats.wood, 0, .05, 0); mk(new THREE.TorusGeometry(.07, .009, 5, 10, Math.PI * .85), mats.metal, 0, -.12, 0, 0, 0, -.5); }
    else if (id === 'machete') { mk(cyl(.015, .018, .16, 6), mats.wood, 0, .12, 0); mk(box(.035, .3, .012), mats.metal, 0, -.05, 0); }
    else if (id === 'talisman') { mk(box(.07, .13, .012), matFor(0xf0e8c8), 0, -.02, 0, .15, 0, .1); mk(box(.02, .05, .014), matFor(0xd8543c), 0, .03, 0, .15, 0, .1); }
    else if (id === 'staff') { mk(cyl(.016, .02, .62, 7), matFor(0x8a6a4a), 0, .02, 0); const gem = mk(new THREE.OctahedronGeometry(.06, 0), matFor(0x6fe0c0), 0, -.34, 0); gem.material = new THREE.MeshToonMaterial({ color: 0x6fe0c0, emissive: 0x2aa080, emissiveIntensity: .9, gradientMap: ramp }); mk(new THREE.TorusGeometry(.075, .011, 5, 10), mats.gold, 0, -.28, 0, Math.PI / 2, 0, 0); }
    else if (id === 'crossbow') { mk(box(.05, .26, .03), mats.wood, 0, .02, 0); mk(new THREE.TorusGeometry(.13, .012, 5, 12, Math.PI), mats.wood, 0, -.13, 0, Math.PI / 2, 0, Math.PI / 2); mk(box(.012, .2, .012), matFor(0x9ac84a), 0, -.05, .02); }
    else if (id === 'gourd') { const b1 = mk(sph(.06, 9, 7), matFor(0xc8503a), 0, .05, 0); b1.scale.y = 1.1; const b2 = mk(sph(.045, 8, 6), matFor(0xc8503a), 0, -.06, 0); b2.scale.y = 1.2; mk(cyl(.015, .02, .03, 6), mats.wood, 0, .12, 0); }
    else { mk(box(.035, .46, .012), matFor(0xcfe4f4), 0, -.02, 0); mk(box(.11, .025, .03), mats.gold, 0, .22, 0); mk(cyl(.017, .014, .11, 6), matFor(0x4a3a2a), 0, .29, 0); mk(sph(.024, 6, 5), mats.gold, 0, .35, 0); }
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }

  /* ---- 怪物：黑陶罐 + 冠饰 + 发光黄眼（参考图直译） ----------------------- */
  function monsterMesh(def) {
    const g = new THREE.Group();
    const s = def.r / .42;
    const bodyM = def.boss ? mats.pot : mats.potDark;
    const pot = new THREE.Mesh(G('potBody', () => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.sin(t * Math.PI * .92) * .42 + .08, t * .95)); }
      return new THREE.LatheGeometry(pts, 12);
    }), bodyM);
    pot.scale.setScalar(s * .78); g.add(pot);
    const rim = new THREE.Mesh(cyl(.3, .26, .1, 10), mats.potDark); rim.position.y = .78 * s; rim.scale.setScalar(s * .9); g.add(rim);
    // 兽皮围裙（参考图的三角纹裙摆）
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.4 * s, .5 * s, .28 * s, 10, 1, true), mats.cloth); skirt.position.y = .22 * s; g.add(skirt);
    // 发光眼：侧面一个 + 正面一对
    const eyePos = [[.34 * s, .5 * s, .26 * s], [-.06 * s, .5 * s, .4 * s], [.14 * s, .5 * s, .38 * s]];
    const eyes = [];
    for (const [x, y, z] of eyePos) { const e = new THREE.Mesh(sph(.055 * s, 6, 5), mats.glowEye); e.position.set(x, y, z); g.add(e); eyes.push(e); }
    g.userData.eyes = eyes;
    const cr = crest(def.crest, def.color, s * (def.boss ? 1.5 : 1.15));
    cr.position.y = .8 * s; g.add(cr);
    g.userData.scale = s;
    if (def.fly) g.userData.fly = true;
    return g;
  }

  /* ---- 塔：陶罐炮塔（参考图核心造型） ------------------------------------- */
  function towerMesh(towerId) {
    const t = DATA.TOWERS[towerId];
    const g = new THREE.Group();
    const pot = new THREE.Mesh(G('potBody', () => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const q = i / 8; pts.push(new THREE.Vector2(Math.sin(q * Math.PI * .92) * .42 + .08, q * .95)); }
      return new THREE.LatheGeometry(pts, 12);
    }), mats.pot);
    pot.scale.setScalar(.8); pot.position.y = .05; g.add(pot);
    const rim = new THREE.Mesh(cyl(.3, .27, .1, 10), mats.potDark); rim.position.y = .82; g.add(rim);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .24, 10, 1, true), towerId === 'sun' ? mats.clothGreen : mats.cloth);
    skirt.position.y = .22; g.add(skirt);
    // 罐身小眼（参考图：陶罐有眼睛）
    const eye = new THREE.Mesh(sph(.05, 6, 5), mats.glowEye); eye.position.set(.3, .5, .18); g.add(eye);
    const eye2 = new THREE.Mesh(sph(.05, 6, 5), mats.glowEye); eye2.position.set(-.05, .5, .34); g.add(eye2);
    const crestMap = { pea: 'pea', shroom: 'mushroom', cactus: 'cactus', chomp: 'chomp', sun: 'sun', ice: 'ice', pome: 'pome', bamboo: 'bamboo', eye: 'crystal', seal: 'seal' };
    const crestMapColor = { pea: 0x8fc84a, shroom: 0xd8442f, cactus: 0x5aa345, chomp: 0xb0489a, sun: 0xf5c542, ice: 0x9adcf4, pome: 0xff7a2f, bamboo: 0x6a9a4a, eye: 0xb0a89a, seal: 0xe8c268 };
    const cr = crest(crestMap[towerId], crestMapColor[towerId], 1.25);
    cr.position.y = .85; g.add(cr); g.userData.crest = cr;
    // 炮口（射击类）
    if (t.kind === 'shot' || t.kind === 'cannon') {
      const muzzle = new THREE.Mesh(cyl(.05, .09, .3, 7), mats.potDark);
      muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, .6, .4); g.add(muzzle);
      const glow = new THREE.Mesh(sph(.05, 6, 5), mats.glow); glow.position.set(0, .6, .56); g.add(glow); g.userData.flash = glow;
    }
    return g;
  }

  /* ---- 作物网格：牧场物语式剪影，每（种×阶）合并成 1-2 个几何体 --------------
     主体顶点色单材质单 mesh；灵光件（露珠/火焰/成熟星）合进第二张发光网格。 */
  const _m4 = new THREE.Matrix4();
  const _e4 = new THREE.Euler();
  const _q4 = new THREE.Quaternion();
  const _v4 = new THREE.Vector3();
  function mm(x, y, z, sx, sy, sz, rx, ry, rz) {
    if (sy === undefined) { return _m4.makeTranslation(x, y, z); }
    _e4.set(rx || 0, ry || 0, rz || 0);
    return _m4.compose(_v4.set(x, y, z), _q4.setFromEuler(_e4), new THREE.Vector3(sx, sy, sz === undefined ? sx : sz));
  }
  function mergeGeos(parts) {
    const pos = [], nor = [], col = [];
    const c = new THREE.Color();
    for (const [geo, mtx, color] of parts) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(mtx);
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      c.set(color);
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
        col.push(c.r, c.g, c.b);
      }
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const LEAF = 0x58a03c, LEAF_D = 0x3e7a2c, SOILG = 0x6fae4a;
  function cropParts(type, stage) {
    const base = [], glow = [];
    const B = (geo, m, col) => base.push([geo, m.clone(), col]);
    const G = (geo, m, col) => glow.push([geo, m.clone(), col]);
    const frond = (n, y, h, col, spread, tilt) => {
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2;
        B(cone(.045, h, 4), mm(Math.cos(a) * spread, y + h * .42, Math.sin(a) * spread, 1, 1, 1, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt), col); }
    };
    if (type === 'cabbage') {
      const heads = [0, .06, .12, .19, .26][stage], lr = [.06, .13, .19, .24][stage - 1], nl = [2, 4, 6, 8][stage - 1];
      for (let i = 0; i < nl; i++) { const a = i / nl * Math.PI * 2;
        B(sph(.13, 8, 6), mm(Math.cos(a) * lr, .06 + heads * .25, Math.sin(a) * lr, 1.35, .32, .85, .5, a, 0), i % 2 ? LEAF : SOILG); }
      if (stage >= 2) B(sph(heads, 10, 8), mm(0, heads * .95, 0, 1, 1.08, 1), 0xd8e8a0);
      if (stage >= 3) B(sph(heads * .72, 9, 7), mm(0, heads * 1.5, 0, 1, 1.05, 1), 0xeef5d4);
      if (stage === 4) B(sph(heads * .45, 8, 6), mm(0, heads * 2.0, 0, 1, .95, 1), 0xf8fce8);
    } else if (type === 'radish' || type === 'ginseng') {
      const ice = type === 'ginseng', body = ice ? 0xe8f4f8 : 0xe8e2d0, blush = ice ? 0x9adcf4 : 0xe4715e;
      const rootR = [0, .05, .09, .13, .17][stage], rootH = rootR * 2.6 + .05;
      B(cone(rootR, rootH, 9), mm(0, rootH * .5 - .02, 0, 1, 1, 1, Math.PI, 0, 0), body);
      B(sph(rootR * 1.02, 9, 6), mm(0, .015, 0, 1, .55, 1), blush);
      if (stage === 4) B(cyl(.012, .006, .12, 5), mm(0, -rootH + .06, 0, 1, 1, 1, Math.PI, 0, 0), body);
      frond([0, 3, 4, 6, 7][stage], rootR * .5, [0, .22, .3, .38, .44][stage], ice ? 0x7ab8c8 : LEAF, .05 + rootR * .5, .55);
      if (ice) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .6; G(cone(.03, .16, 4), mm(Math.cos(a) * .1, .2, Math.sin(a) * .1, 1, 1, 1, Math.sin(a) * .4, 0, -Math.cos(a) * .4), 0xa8e8ff); }
    } else if (type === 'corn') {
      const H = [0, .22, .45, .72, 1.0][stage];
      B(cyl(.02, .03, H, 6), mm(0, H * .5, 0), LEAF_D);
      const bl = [0, 2, 3, 4, 6][stage];
      for (let i = 0; i < bl; i++) { const a = i / bl * Math.PI * 2;
        B(box(.03, H * .55, .01), mm(Math.cos(a) * .06, H * (.35 + (i % 3) * .18), Math.sin(a) * .06, 1, 1, 1, Math.sin(a) * .9, a, -Math.cos(a) * .9 + .5), LEAF); }
      if (stage >= 3) B(cone(.02, .14, 4), mm(0, H + .06, 0, 1, 1, 1, 0, 0, .2), 0xd8c86a);
      if (stage === 4) {
        B(cyl(.055, .065, .26, 8), mm(.08, H * .62, .05, 1, 1, 1, 0, 0, -.28), 0xf0c54a);
        B(box(.02, .2, .05), mm(.055, H * .62, .085, 1, 1, 1, .15, 0, -.25), SOILG);
        B(sph(.045, 6, 5), mm(.085, H * .62 + .145, .05, 1, .8, 1), 0xe8dc8a);
      }
    } else if (type === 'tomato') {
      B(box(.018, [0, .2, .34, .46, .55][stage], .018), mm(0, .14, 0), 0x8a6a4a);
      const br = [0, .12, .18, .24, .27][stage];
      B(sph(br, 9, 7), mm(0, .1 + br * .8, 0, 1, .9, 1), LEAF);
      if (stage >= 3) B(sph(br * .7, 8, 6), mm(.1, .18 + br * .5, .06, 1, .9, 1), SOILG);
      const nf = [0, 0, 1, 3, 6][stage];
      for (let i = 0; i < nf; i++) { const a = i / 6 * Math.PI * 2 + .5;
        B(sph(stage === 4 ? .065 : .05, 8, 6), mm(Math.cos(a) * br * .9, .13 + br * .7 + (i % 2) * .07, Math.sin(a) * br * .9), stage === 4 ? 0xd8442f : 0x7ab84a); }
    } else if (type === 'chili') {
      const br = [0, .1, .16, .21, .24][stage];
      B(sph(br, 9, 7), mm(0, .08 + br * .8, 0, 1, .95, 1), LEAF);
      const nf = [0, 0, 2, 4, 7][stage];
      for (let i = 0; i < nf; i++) { const a = i / 7 * Math.PI * 2 + .3;
        B(cone(.025, [0, 0, .1, .13, .15][stage], 5), mm(Math.cos(a) * br * .8, .1 + br * 1.15 + (i % 3) * .05, Math.sin(a) * br * .8, 1, 1, 1, Math.sin(a) * .25, 0, -Math.cos(a) * .25), stage >= 3 ? 0xe0341c : 0x58a03c); }
      if (stage >= 3) for (let i = 0; i < 2; i++) B(sph(.02, 5, 4), mm((i ? .08 : -.07), .12 + br, (i ? .05 : -.07)), 0xf0ecd8);
    } else if (type === 'pumpkin') {
      B(cyl(.02, .025, .1 * stage, 5), mm(0, .05 * stage, 0), LEAF_D);
      const lf = [0, 2, 3, 4, 4][stage];
      for (let i = 0; i < lf; i++) { const a = i / lf * Math.PI * 2 + .8;
        B(sph(.14, 8, 6), mm(Math.cos(a) * .16, .03, Math.sin(a) * .16, 1.3, .12, 1.3, 0, a, 0), i % 2 ? LEAF : LEAF_D); }
      if (stage >= 3) {
        const pr = [0, 0, 0, .13, .24][stage];
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI;
          B(sph(pr, 9, 7), mm(Math.cos(a) * pr * .45, pr * .85, Math.sin(a) * pr * .45, .72, .82, 1.05, 0, a, 0), 0xf08a1e); }
        B(cyl(.025, .035, .08, 6), mm(0, pr * 1.75, 0, 1, 1, 1, .1, 0, .2), LEAF_D);
      }
    } else if (type === 'eggplant') {
      const br = [0, .12, .17, .22, .24][stage];
      B(sph(br, 9, 7), mm(0, .09 + br * .75, 0, 1, .9, 1), LEAF_D);
      const nf = [0, 0, 1, 3, 5][stage];
      for (let i = 0; i < nf; i++) { const a = i / 5 * Math.PI * 2 + 1;
        B(sph(.055, 8, 6), mm(Math.cos(a) * br * .8, .16 + br * .55 + (i % 2) * .06, Math.sin(a) * br * .8, .85, 1.5, .85, .25, 0, -.2), 0x6a3596);
        B(cone(.03, .03, 5), mm(Math.cos(a) * br * .8, .21 + br * .55 + (i % 2) * .06, Math.sin(a) * br * .8, 1, 1, 1, Math.PI, 0, 0), LEAF); }
    } else if (type === 'herb') {
      frond([0, 3, 5, 6, 7][stage], .02, [0, .2, .3, .4, .46][stage], 0x58c7a0, .05, .45);
      G(sph([0, 0, .03, .045, .06][stage], 7, 6), mm(0, [0, 0, .2, .28, .36][stage], 0), 0xaef2ff);
    } else if (type === 'lotus') {
      B(cyl(.26, .3, .04, 12), mm(0, .02, 0), 0x2f5e28);
      if (stage >= 2) B(cyl(.18, .2, .035, 12), mm(.14, .05, -.1), 0x3a6e30);
      const pet = [0, 0, 4, 6, 8][stage];
      for (let i = 0; i < pet; i++) { const a = i / pet * Math.PI * 2;
        G(cone(.045, [0, 0, .18, .24, .3][stage], 5), mm(Math.cos(a) * .07, .16, Math.sin(a) * .07, 1, 1, 1, Math.sin(a) * .55, 0, -Math.cos(a) * .55), 0xff5a3c); }
      G(sph(.05, 7, 6), mm(0, .14, 0), 0xffd23c);
    } else if (type === 'rice') {
      const n = [0, 2, 3, 4, 5][stage], H = [0, .3, .48, .62, .7][stage === 0 ? 0 : stage];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + .4;
        B(cyl(.012, .016, H, 5), mm(Math.cos(a) * .05, H * .5, Math.sin(a) * .05, 1, 1, 1, Math.sin(a) * .18, 0, -Math.cos(a) * .18), stage >= 3 ? 0xc8b23c : LEAF);
        if (stage >= 3) { const droop = stage === 4 ? .95 : .6;
          for (let k = 0; k < 4; k++) { const t = k / 3;
            B(sph(.022, 6, 5), mm(Math.cos(a) * (.05 + t * .12 * droop), H * (1 - t * t * .35 * droop) - t * .02, Math.sin(a) * (.05 + t * .12 * droop), 1, 1, 1), stage === 4 ? 0xb87fd8 : 0xe0c85a); } } }
    } else if (type === 'peach') {
      const H = [0, .22, .38, .55, .72][stage], cr = [0, .14, .2, .27, .33][stage];
      B(cyl(.04, .06, H, 7), mm(0, H * .5, 0), 0x8a6a4a);
      if (stage >= 2) B(cyl(.02, .03, cr * .8, 5), mm(cr * .3, H * .9, 0, 1, 1, 1, 0, 0, -.7), 0x8a6a4a);
      B(sph(cr, 9, 7), mm(0, H + cr * .5, 0, 1.05, .85, 1.05), 0x4e8a34);
      if (stage === 3) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; G(sph(.03, 6, 5), mm(Math.cos(a) * cr * .8, H + cr * .6, Math.sin(a) * cr * .8), 0xffc8dc); }
      if (stage === 4) for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + .5; B(sph(.055, 8, 6), mm(Math.cos(a) * cr * .75, H + cr * .3, Math.sin(a) * cr * .75), 0xff9fc4); }
    } else {
      B(sph(.1, 7, 5), mm(0, .06, 0), SOILG);
    }
    if (stage === 4) {   // 成熟通用星芒（并入发光件，不额外花 draw）
      const star = G;
      star(box(.032, .11, .01), mm(0, .5, 0), 0xffe89a);
      star(box(.11, .032, .01), mm(0, .5, 0), 0xffe89a);
      star(box(.062, .062, .008), mm(0, .5, 0, 1, 1, 1, 0, 0, .78), 0xfff3c0);
    }
    return { base, glow };
  }
  const cropGeoCache = {};
  function cropMesh(type, stage, seed) {
    const key = type + stage;
    if (!cropGeoCache[key]) {
      const parts = cropParts(type, stage);
      cropGeoCache[key] = {
        geo: parts.base.length ? mergeGeos(parts.base) : null,
        glow: parts.glow.length ? mergeGeos(parts.glow) : null,
      };
    }
    const gd = cropGeoCache[key];
    const g = new THREE.Group();
    if (gd.geo) g.add(new THREE.Mesh(gd.geo, mats.cropBase));
    if (gd.glow) g.add(new THREE.Mesh(gd.glow, mats.cropGlow));
    g.scale.setScalar(1.18);
    g.rotation.y = (seed || 0) * 2.399;
    return g;
  }

  /* ---- 部件收集器：装饰拆成（几何，材质，世界矩阵），关卡末尾合并实例化 ---- */
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);
  const _v = new THREE.Vector3();
  const _m1 = new THREE.Matrix4();
  const _e = new THREE.Euler();
  const IDENT = new THREE.Matrix4();
  function partLocal(px, py, pz, rotY, sx, sy, sz) {
    return new THREE.Matrix4().compose(_v.set(px, py, pz), _q.setFromAxisAngle(_up, rotY || 0), new THREE.Vector3(sx, sy, sz === undefined ? sx : sz));
  }
  function partLocal3(px, py, pz, ex, ey, ez, sx, sy, sz) {
    _e.set(ex || 0, ey || 0, ez || 0);
    return new THREE.Matrix4().compose(_v.set(px, py, pz), _q.setFromEuler(_e), new THREE.Vector3(sx, sy, sz === undefined ? sx : sz));
  }
  function addParts(sink, parentM, geoKey, geo, mat, localMats) {
    const k = geoKey + '|' + mat.uuid;
    let b = sink.get(k); if (!b) sink.set(k, b = { geo, mat, list: [] });
    for (const lm of localMats) b.list.push(new THREE.Matrix4().multiplyMatrices(parentM, lm));
  }
  function flushParts(parent, sink) {
    const made = [];
    for (const b of sink.values()) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.list.length);
      for (let i = 0; i < b.list.length; i++) im.setMatrixAt(i, b.list[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      parent.add(im); made.push(im);
    }
    return made;
  }

  /* ---- 场景植被：叶簇树 / 草丛 / 花 / 蘑菇 / 石头 ------------------------- */
  /* 草丛/石头/花/蘑菇 部件版（与各自 mesh 版 rng 同序） */
  function tuftParts(seed, tall, sink, px, py, pz) {
    const rng = makeRng(seed * 97 + (tall ? 1 : 0));
    const n = tall ? 7 : 5;
    const spread = tall ? .16 : .1, cy = tall ? .3 : .15;
    for (let i = 0; i < n; i++) {
      const a = rng.next() * TAU;
      const h = (tall ? .8 : .4) * (.7 + rng.next() * .6);
      const mat = rng.next() > .4 ? mats.leafFlat : mats.grassDark;
      addParts(sink, IDENT, 'tuftblade', cone(.03, 1, 3), mat, [partLocal3(px + Math.cos(a) * spread, py + cy, pz + Math.sin(a) * spread, (rng.next() - .5) * .5, a, (rng.next() - .5) * .5, 1, h, 1)]);
    }
  }
  function rockParts(seed, sink, px, py, pz) {
    const rng = makeRng(seed * 53);
    addParts(sink, IDENT, 'rock', sph(.3, 7, 5), mats.stone, [partLocal3(px, py + .12, pz, rng.next(), rng.next(), rng.next(), .6 + rng.next() * .8, .4 + rng.next() * .4, .6 + rng.next() * .8)]);
  }
  function flowerParts(seed, sink, px, py, pz) {
    const rng = makeRng(seed * 71);
    addParts(sink, IDENT, 'fstem', cyl(.015, .02, .3, 4), mats.leafFlat, [partLocal3(px, py + .15, pz, 0, 0, 0, 1, 1, 1)]);
    const col = rng.next() > .5 ? 0xf06a8a : (rng.next() > .5 ? 0xf5c542 : 0xffffff);
    const m = matFor(col);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      addParts(sink, IDENT, 'petal', cone(.09 * .8, .3 * .8, 4), m, [partLocal3(px + Math.cos(a) * .1 * .8, py + .3 + .14 * .8, pz + Math.sin(a) * .1 * .8, Math.sin(a) * .7, 0, -Math.cos(a) * .7, 1, 1, 1)]);
    }
  }
  function mushroomParts(seed, sink, px, py, pz) {
    const rng = makeRng(seed * 17);
    addParts(sink, IDENT, 'mstem', cyl(.05, .07, .2, 6), mats.petalWhite, [partLocal3(px, py + .1, pz, 0, 0, 0, 1, 1, 1)]);
    const s = .9, m = matFor(rng.next() > .5 ? 0xc8503a : 0xe8b04a);
    addParts(sink, IDENT, 'mcap', sph(.26 * s, 9, 6), m, [partLocal3(px, py + .16 * s, pz, 0, 0, 0, 1, .62, 1)]);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      addParts(sink, IDENT, 'mdot', sph(.045 * s, 5, 4), mats.petalWhite, [partLocal3(px + Math.cos(a) * .14 * s, py + .24 * s, pz + Math.sin(a) * .14 * s, 0, 0, 0, 1, 1, 1)]);
    }
  }
  // 树部件版：rng 调用顺序与 treeMesh 完全一致 → 同 seed 同形状
  function treeParts(theme, seed, sink, px, py, pz, us) {
    const rng = makeRng(seed * 31 + hashStr(theme));
    const M0 = new THREE.Matrix4().compose(_v.set(px, py, pz), _q.setFromAxisAngle(_up, 0), new THREE.Vector3(us, us, us));
    const trunkGeo = cyl(.14, .22, .8, 7);
    addParts(sink, M0, 'trunk', trunkGeo, mats.wood, [partLocal(0, .4, 0, 0, 1, 1, 1)]);
    const col = { meadow: [0x4e8a34, 0x5f9c40, 0x74a34a], peach: [0x6a9a44, 0xf0a0c0, 0xe88ab0], bamboo: [0x7ab04a, 0x6a9a3a, 0x8ac05a], maple: [0xc0512a, 0xd87a2f, 0xb03a20], frost: [0x7a9aa8, 0xa8c8d8, 0xd8eaf2], lava: [0x6a3a20, 0xc0512a, 0x8a4a2a], mist: [0x5a7a6a, 0x7a9a8a, 0x9ab8a8], ascend: [0x7a8ab8, 0xc8b24a, 0xa8b8e0] }[theme] || [0x4e8a34, 0x5f9c40];
    const blobGeo = sph(1, 9, 7);
    const layers = 3 + rng.int(2);
    const locals = [];
    const byMat = new Map();
    for (let i = 0; i < layers; i++) {
      const r = (.72 - i * .16) * (.85 + rng.next() * .35);
      const m = matFor(col[i % col.length], true);
      locals.push({ m, lm: partLocal((rng.next() - .5) * .18, .85 + i * .34, (rng.next() - .5) * .18, rng.next() * TAU, Math.max(.18, r), Math.max(.18, r) * .72, Math.max(.18, r)) });
    }
    for (const e of locals) addParts(sink, M0, 'blob', blobGeo, e.m, [e.lm]);
    if (theme === 'peach' || theme === 'ascend') addParts(sink, M0, 'fruit', sph(.07, 6, 5), matFor(0xf06a8a), [partLocal(.3, 1, .2, 0, 1, 1, 1)]);
  }
  function treeMesh(theme = 'meadow', seed = 1) {
    const g = new THREE.Group();
    const rng = makeRng(seed * 31 + hashStr(theme));
    const trunk = new THREE.Mesh(cyl(.14, .22, .8, 7), mats.wood); trunk.position.y = .4; g.add(trunk);
    const col = { meadow: [0x4e8a34, 0x5f9c40, 0x74a34a], peach: [0x6a9a44, 0xf0a0c0, 0xe88ab0], bamboo: [0x7ab04a, 0x6a9a3a, 0x8ac05a], maple: [0xc0512a, 0xd87a2f, 0xb03a20], frost: [0x7a9aa8, 0xa8c8d8, 0xd8eaf2], lava: [0x6a3a20, 0xc0512a, 0x8a4a2a], mist: [0x5a7a6a, 0x7a9a8a, 0x9ab8a8], ascend: [0x7a8ab8, 0xc8b24a, 0xa8b8e0] }[theme] || [0x4e8a34, 0x5f9c40];
    const layers = 3 + rng.int(2);
    for (let i = 0; i < layers; i++) {
      const r = (.72 - i * .16) * (.85 + rng.next() * .35);
      const blob = new THREE.Mesh(sph(Math.max(.18, r), 9, 7), matFor(col[i % col.length], true));
      blob.scale.y = .72; blob.position.set((rng.next() - .5) * .18, .85 + i * .34, (rng.next() - .5) * .18);
      blob.rotation.y = rng.next() * TAU; g.add(blob);
    }
    if (theme === 'peach' || theme === 'ascend') { const fruit = new THREE.Mesh(sph(.07, 6, 5), matFor(0xf06a8a)); fruit.position.set(.3, 1, .2); g.add(fruit); }
    return g;
  }
  function tuftMesh(seed = 1, tall = false) {
    const g = new THREE.Group();
    const rng = makeRng(seed * 97 + (tall ? 1 : 0));
    const n = tall ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = rng.next() * TAU;
      const blade = new THREE.Mesh(cone(.03, (tall ? .8 : .4) * (.7 + rng.next() * .6), 3), rng.next() > .4 ? mats.leafFlat : mats.grassDark);
      blade.position.set(Math.cos(a) * (tall ? .16 : .1), (tall ? .3 : .15), Math.sin(a) * (tall ? .16 : .1));
      blade.rotation.set((rng.next() - .5) * .5, a, (rng.next() - .5) * .5); g.add(blade);
    }
    return g;
  }
  function flowerMesh(seed = 1) {
    const g = new THREE.Group();
    const rng = makeRng(seed * 71);
    const stem = new THREE.Mesh(cyl(.015, .02, .3, 4), mats.leafFlat); stem.position.y = .15; g.add(stem);
    const col = rng.next() > .5 ? 0xf06a8a : (rng.next() > .5 ? 0xf5c542 : 0xffffff);
    const cr = crest('star', col, .8); cr.position.y = .3; g.add(cr);
    return g;
  }
  function rockMesh(seed = 1) {
    const r = new THREE.Mesh(sph(.3, 7, 5), mats.stone);
    const rng = makeRng(seed * 53);
    r.scale.set(.6 + rng.next() * .8, .4 + rng.next() * .4, .6 + rng.next() * .8);
    r.position.y = .12; r.rotation.set(rng.next(), rng.next(), rng.next());
    return r;
  }
  function mushroomProp(seed = 1) {
    const g = new THREE.Group();
    const rng = makeRng(seed * 17);
    const stem = new THREE.Mesh(cyl(.05, .07, .2, 6), mats.petalWhite); stem.position.y = .1; g.add(stem);
    const cap = crest('mushroom', rng.next() > .5 ? 0xc8503a : 0xe8b04a, .9); g.add(cap);
    return g;
  }

    /* ---- 家园建筑：井/稻草人/石灯/鸡舍/谷仓（卡通剪影） ---------------------- */
  /* ---- NPC：四人简版角色（站姿 + 标志道具） ---- */
  function npcMesh(kind) {
    const K = {
      grannie:    { coat: 0x7a8f5a, hair: 0xe8e8e8, hat: 0,       skin: 0xf0cba8 },
      blacksmith: { coat: 0x7a4a2a, hair: 0x3a2a1a, hat: 0xd8c8a8, skin: 0xd8a878 },
      hawker:     { coat: 0xb8963c, hair: 0x2a2a2a, hat: 0x4a3a6a, skin: 0xf0cba8 },
      aunt:       { coat: 0xc86a7a, hair: 0x5a3a2a, hat: 0,        skin: 0xf0cba8 },
    }[kind] || {};
    const g = new THREE.Group(); const b = new THREE.Group(); g.add(b); g.userData.body = b;
    const coat = matFor(K.coat), skin = matFor(K.skin);
    for (const dir of [-1, 1]) {
      const leg = new THREE.Mesh(cyl(.07, .055, .3, 7), matFor(0x5a4a3a)); leg.position.set(dir * .09, .15, 0); b.add(leg);
      const shoe = new THREE.Mesh(box(.13, .06, .19), matFor(0x3a2f28)); shoe.position.set(dir * .09, .03, .03); b.add(shoe);
    }
    const torso = new THREE.Mesh(cyl(.17, .2, .42, 10), coat); torso.position.y = .5; b.add(torso);
    const arms = [];
    for (const dir of [-1, 1]) {
      const arm = new THREE.Mesh(cyl(.045, .04, .3, 6), coat); arm.position.set(dir * .2, .56, 0); arm.rotation.z = dir * .34; b.add(arm);
      const hand = new THREE.Mesh(sph(.05, 6, 5), skin); hand.position.set(dir * .25, .42, 0); b.add(hand); arms.push(arm);
    }
    const head = new THREE.Mesh(sph(.155, 10, 8), skin); head.position.y = .86; b.add(head); g.userData.head = head;
    const eye = matFor(0x2a2228);
    for (const dir of [-1, 1]) { const e2 = new THREE.Mesh(sph(.02, 5, 4), eye); e2.position.set(dir * .055, .88, .135); b.add(e2); }
    if (kind === 'grannie') {
      const bun = new THREE.Mesh(sph(.1, 8, 6), matFor(K.hair)); bun.scale.set(1, .8, 1); bun.position.set(0, .97, -.05); b.add(bun);
      const shawl = new THREE.Mesh(new THREE.TorusGeometry(.15, .05, 6, 12), matFor(0x8a6a8a)); shawl.position.y = .72; shawl.rotation.x = Math.PI / 2; b.add(shawl);
      const stick = new THREE.Mesh(cyl(.02, .022, .62, 6), matFor(0xb0784a)); stick.position.set(.3, .34, .06); stick.rotation.z = -.12; b.add(stick);
    } else if (kind === 'blacksmith') {
      const band = new THREE.Mesh(cyl(.16, .16, .06, 10), matFor(K.hat)); band.position.y = .95; b.add(band);
      const apron = new THREE.Mesh(box(.24, .3, .04), matFor(0x4a352a)); apron.position.set(0, .44, .18); b.add(apron);
      const hH = new THREE.Mesh(box(.1, .07, .07), matFor(0x7a7a84)); hH.position.set(-.3, .5, .12); b.add(hH);
      const hS = new THREE.Mesh(cyl(.018, .018, .18, 6), matFor(0x8a6a4a)); hS.position.set(-.28, .38, .12); hS.rotation.z = .5; b.add(hS);
    } else if (kind === 'hawker') {
      const hat = new THREE.Mesh(cone(.24, .16, 10), matFor(K.hat)); hat.position.y = 1.02; b.add(hat);
      const brim = new THREE.Mesh(cyl(.24, .24, .02, 12), matFor(K.hat)); brim.position.y = .96; b.add(brim);
      const aba = new THREE.Mesh(box(.16, .12, .035), matFor(0x8a6a3a)); aba.position.set(.26, .46, .1); aba.rotation.set(.2, -.4, 0); b.add(aba);
      for (let i2 = 0; i2 < 3; i2++) { const b3 = new THREE.Mesh(sph(.016, 5, 4), matFor(0x2f2a28)); b3.position.set(.21 + i2 * .035, .47, .122); b.add(b3); }
    } else {
      const bun2 = new THREE.Mesh(sph(.09, 8, 6), matFor(K.hair)); bun2.position.set(0, 1.0, -.02); b.add(bun2);
      const pin = new THREE.Mesh(cyl(.012, .012, .16, 5), matFor(0xe8b73a)); pin.position.set(.06, 1.0, -.04); pin.rotation.z = 1.1; b.add(pin);
      const hand2 = new THREE.Mesh(box(.12, .12, .02), matFor(0xe8d8c8)); hand2.position.set(-.26, .5, .1); hand2.rotation.z = .5; b.add(hand2);
    }
    g.userData.kind = kind;
    return g;
  }
  /* ---- 金稻穗（收藏物）：穗梗 + 穗头 + 微光 ---- */
  function riceEarMesh() {
    const g = new THREE.Group();
    const stalk = new THREE.Mesh(cyl(.015, .02, .5, 5), matFor(0xc8a84a)); stalk.position.y = .25; g.add(stalk);
    const ear = new THREE.Mesh(sph(.09, 8, 6), matFor(0xffd76a)); ear.scale.set(1, 1.7, 1); ear.position.y = .56; ear.rotation.z = .3; g.add(ear);
    for (let i2 = 0; i2 < 4; i2++) { const grain = new THREE.Mesh(sph(.028, 5, 4), matFor(0xffe89a)); grain.position.set(.05 - i2 * .03, .52 + i2 * .05, .04); g.add(grain); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd76a, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.1); glow.position.y = .5; g.add(glow);
    g.userData.glow = glow;
    return g;
  }
  function buildingMesh(id) {
    const g = new THREE.Group();
    const B = DATA.BUILDINGS[id] || DATA.BUILDINGS.well;
    const mk = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); if (sx) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); g.add(m); return m; };
    if (id === 'well') {
      mk(cyl(.42, .46, .3, 10), mats.stone, 0, .15, 0);
      mk(cyl(.34, .34, .06, 10), mats.water, 0, .31, 0);
      for (const d of [-1, 1]) mk(cyl(.04, .04, .7, 6), mats.wood, d * .36, .62, 0);
      mk(box(.95, .07, .12), mats.wood, 0, 1, 0);
      mk(cyl(.015, .015, .3, 4), mats.cloth, 0, .82, 0);
      mk(cyl(.09, .07, .12, 7), matFor(0xb0784a), 0, .64, 0);
    } else if (id === 'guard') {
      mk(cyl(.05, .06, 1.1, 6), mats.wood, 0, .55, 0);
      mk(box(.8, .05, .05), mats.wood, 0, .95, 0);
      mk(cyl(.02, .02, .5, 4), mats.cloth, 0, .95, 0, 0, 0, Math.PI / 2);
      mk(sph(.17, 9, 7), mats.straw || mats.cloth, 0, 1.22, 0);
      mk(cone(.2, .16, 8), matFor(0xc9a44e), 0, 1.4, 0, -.12, 0, .1);
      mk(cyl(.05, .05, .1, 5), mats.boot, 0, 1.24, .16, Math.PI / 2, 0, 0);
      mk(box(.34, .3, .08), matFor(0xd8543c), 0, .78, .06);
    } else if (id === 'lamp') {
      mk(cyl(.18, .24, .16, 8), mats.stone, 0, .08, 0);
      mk(cyl(.09, .09, .5, 8), mats.stone, 0, .4, 0);
      mk(box(.34, .3, .34), matFor(0xefe6c8), 0, .8, 0);
      mk(cone(.28, .18, 4), mats.stone, 0, 1.03, 0, 0, Math.PI / 4, 0);
      const gl = mk(sph(.09, 7, 6), mats.glow, 0, .8, 0);
      g.add(glowSprite(0xffd27a, { size: 1.7, y: .8, base: .8 }));
      g.userData.lampGlow = gl;
    } else if (id === 'shed') {
      mk(box(.9, .6, .8), matFor(0xd8b98a), 0, .3, 0);
      mk(box(1.05, .1, .95), matFor(0xc9a44e), 0, .64, 0, .0, Math.PI / 4, 0, 1, 1, 1);
      const roof = mk(cone(.75, .5, 4), matFor(0xb0542a), 0, .85, 0, 0, Math.PI / 4, 0); roof.scale.set(1, 1, .9);
      mk(box(.24, .3, .04), mats.boot, 0, .22, .42);
      mk(sph(.11, 7, 6), mats.petalWhite, .28, .14, .58);
      mk(sph(.04, 6, 5), mats.petalWhite, .28, .28, .6, 0, 0, 0);
      mk(box(.05, .03, .02), matFor(0xf0a030), .34, .27, .62);
    } else {
      mk(box(1.5, 1, 1.2), matFor(0xd8c9a0), 0, .5, 0);
      const roof = mk(box(1.8, .16, 1.5), matFor(0xc0512a), 0, 1.12, 0, .04, 0, 0);
      mk(box(1.9, .1, .2), matFor(0x8a4a2a), 0, 1.22, 0);
      mk(box(.5, .7, .05), mats.wood, 0, .35, .62);
      mk(box(.62, .5, .06), matFor(0xf0c34a), 0, 1.28, .3, .5, 0, 0);
      mk(cyl(.08, .08, .5, 6), mats.wood, .55, 1.35, 0, 0, 0, -.5);
      mk(sph(.1, 7, 5), mats.hayGold || matFor(0xc9a44e), .72, 1.5, 0);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    g.userData.r = B.r;
    return g;
  }

  /* ---- 山门（区界之门）：鸟居式双柱两梁，锁定时灰暗缠藤 ---- */
  function gateMesh(locked) {
    const g = new THREE.Group();
    const wood = locked ? toon(0x6a6258) : mats.wood;
    const beam = locked ? toon(0x55504a) : matFor(0xc0512a);
    for (const dir of [-1, 1]) {
      const post = new THREE.Mesh(cyl(.12, .16, 2.6, 8), wood); post.position.set(dir * .95, 1.3, 0); post.rotation.z = dir * .04; g.add(post);
    }
    const top = new THREE.Mesh(box(2.9, .18, .34), beam); top.position.y = 2.7; g.add(top);
    const cap = new THREE.Mesh(box(3.2, .12, .42), beam); cap.position.y = 2.86; g.add(cap);
    const lintel = new THREE.Mesh(box(2.3, .14, .28), wood); lintel.position.y = 2.3; g.add(lintel);
    const plaque = new THREE.Mesh(box(.5, .4, .06), locked ? toon(0x3a3833) : mats.gold); plaque.position.set(0, 2.05, .16); g.add(plaque);
    if (locked) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const v = new THREE.Mesh(cyl(.03, .03, 1.4 + (i % 2) * .5, 5), toon(0x3e6e2a)); v.position.set(Math.cos(a) * .9, 1.2, Math.sin(a) * .12); v.rotation.z = (i - 2) * .18; g.add(v); }
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }

  /* ---- 特效：实例化图集粒子（2 draw call）+ 条纹灵光带（1 draw）+ 假 glow 贴花 ----
       粒子：单 quad + iPos/iCol/iMisc 实例属性，程序化 4 格图集（光点/圆环/星芒/烟团）。
       灵光带：相机面 quad 沿 A→B 展开，fract 条纹沿长度滚动（every-joule streams 同款手法）。 */
  let _fxAtlas = null;
  function fxAtlas() {
    if (_fxAtlas) return _fxAtlas;
    const [c, ctx] = canvas2d(256, 256);
    const cell = (ix, iy, draw) => { ctx.save(); ctx.beginPath(); ctx.rect(ix * 128, iy * 128, 128, 128); ctx.clip(); ctx.translate(ix * 128, iy * 128); draw(); ctx.restore(); };
    cell(0, 0, () => { const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 58); g.addColorStop(0, '#fff'); g.addColorStop(.45, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
    cell(1, 0, () => { for (let i = 0; i < 12; i++) { ctx.lineWidth = 11 - i * .8; ctx.globalAlpha = .85 - i * .07; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(64, 64, 20 + i * 3.6, 0, TAU); ctx.stroke(); } });
    cell(0, 1, () => { ctx.translate(64, 64); for (let i = 0; i < 2; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); const g = ctx.createLinearGradient(0, -58, 0, 58); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -58); ctx.quadraticCurveTo(9, 0, 0, 58); ctx.quadraticCurveTo(-9, 0, 0, -58); ctx.fill(); ctx.restore(); } const g2 = ctx.createRadialGradient(0, 0, 1, 0, 0, 20); g2.addColorStop(0, '#fff'); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.fillRect(-20, -20, 40, 40); });
    cell(1, 1, () => { const rng = makeRng(4242); for (let i = 0; i < 7; i++) { const x = 64 + (rng.next() - .5) * 46, y = 64 + (rng.next() - .5) * 46, r = 26 + rng.next() * 22; const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); } });
    _fxAtlas = toTexture(c); _fxAtlas.wrapS = _fxAtlas.wrapT = THREE.ClampToEdgeWrapping; _fxAtlas.repeat.set(1, 1);
    return _fxAtlas;
  }
  const PART_VS = `
    precision highp float;
    attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iMisc; // size, 余寿01, 旋转, 图集格
    varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vCell;
    void main() {
      vUv = uv; vCol = iCol; vK = iMisc.y; vCell = iMisc.w;
      vec2 q = position.xy * iMisc.x;
      float ca = cos(iMisc.z), sa = sin(iMisc.z);
      vec2 r = vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
      vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
      mv.xy += r;
      gl_Position = projectionMatrix * mv;
    }`;
  const PART_FS = `
    precision highp float;
    uniform sampler2D uAtlas;
    varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vCell;
    void main() {
      vec2 off = vec2(mod(vCell, 2.0), floor(vCell / 2.0)) * 0.5;
      vec4 t = texture2D(uAtlas, off + clamp(vUv, vec2(0.02), vec2(0.98)) * 0.48 + 0.01);
      float a = t.a * vK;
      if (a < 0.02) discard;
      gl_FragColor = vec4(vCol * t.rgb, a);
    }`;
  function makeIPool(scene, ranges, { additive }) {
    const cap = ranges.reduce((acc, r) => acc + r.n, 0);
    let acc = 0;
    for (const r of ranges) { r.off = acc; acc += r.n; }
    const slots = [];
    for (const r of ranges) for (let i = 0; i < r.n; i++) slots.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, ttl: 1, size: 1, spin: 0, rot: 0, color: new THREE.Color(1, 1, 1), cell: r.cell, off: r.off, n: r.n });
    const geo = new THREE.PlaneGeometry(1, 1);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    ig.setAttribute('position', geo.getAttribute('position'));
    ig.setAttribute('uv', geo.getAttribute('uv'));
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aMisc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    aPos.setUsage(THREE.DynamicDrawUsage); aCol.setUsage(THREE.DynamicDrawUsage); aMisc.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('iPos', aPos); ig.setAttribute('iCol', aCol); ig.setAttribute('iMisc', aMisc);
    ig.instanceCount = cap;
    const mat = new THREE.ShaderMaterial({ uniforms: { uAtlas: { value: fxAtlas() } }, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(ig, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const step = {
      update(dt) {
        for (let i = 0; i < cap; i++) {
          const sl = slots[i];
          if (sl.life <= 0) { aMisc.setX(i, 0); continue; }
          sl.life -= dt;
          sl.pos.addScaledVector(sl.vel, dt);
          sl.vel.multiplyScalar(1 - dt * 1.9);
          sl.rot += sl.spin * dt;
          const k = Math.max(0, sl.life / sl.ttl);
          const grow = (sl.cell === 1 || sl.cell === 3) ? 1 + (1 - k) * .9 : 1 + (1 - k) * .25;
          aPos.setXYZ(i, sl.pos.x, sl.pos.y, sl.pos.z);
          aCol.setXYZ(i, sl.color.r, sl.color.g, sl.color.b);
          aMisc.setXYZW(i, k > 0 ? sl.size * grow : 0, k, sl.rot, sl.cell);
        }
        aPos.needsUpdate = aCol.needsUpdate = aMisc.needsUpdate = true;
      },
    };
    const wrappers = {};
    for (const r of ranges) {
      let cur = r.off;
      wrappers[r.name] = {
        spawn(pos, { vel = [0, 0, 0], ttl = 1, scale = 1, spin = 0, tint } = {}) {
          const sl = slots[cur]; cur = r.off + ((cur - r.off + 1) % r.n);
          sl.pos.copy(pos); sl.vel.set(vel[0], vel[1], vel[2]);
          sl.ttl = Math.max(.02, ttl); sl.life = sl.ttl; sl.size = scale * .22; sl.spin = spin; sl.rot = Math.random() * TAU;
          sl.color.setHex(tint !== undefined ? tint : r.def);
          return sl;
        },
        clear() { for (let i = r.off; i < r.off + r.n; i++) slots[i].life = 0; },
      };
    }
    return { step, ...wrappers };
  }
  const BEAM_VS = `
    precision highp float;
    attribute vec3 iA; attribute vec3 iB; attribute vec3 iCol; attribute vec4 iMisc; // 宽, 出生时刻, 寿命, 种子
    uniform float uTime;
    varying vec2 vUv; varying vec3 vCol; varying float vLife; varying float vSeed;
    void main() {
      float life = 1.0 - (uTime - iMisc.y) / max(iMisc.z, 0.001);
      vLife = clamp(life, 0.0, 1.0);
      vUv = uv; vCol = iCol; vSeed = iMisc.w;
      vec4 mvA = modelViewMatrix * vec4(iA, 1.0);
      vec4 mvB = modelViewMatrix * vec4(iB, 1.0);
      float t = position.x + 0.5;
      vec3 dirv = mvB.xyz - mvA.xyz;
      vec2 perp = normalize(cross(dirv, vec3(0.0, 0.0, 1.0)).xy);
      float taper = pow(sin(t * 3.14159), 0.4);
      float w = iMisc.x * mix(0.35, 1.0, taper) * (0.3 + 0.7 * vLife);
      vec3 p = mix(mvA.xyz, mvB.xyz, t) + vec3(perp * (position.y * w), 0.0);
      gl_Position = projectionMatrix * vec4(p, 1.0);
    }`;
  const BEAM_FS = `
    precision highp float;
    uniform float uTime;
    varying vec2 vUv; varying vec3 vCol; varying float vLife; varying float vSeed;
    void main() {
      float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
      float ph = fract(vUv.x * 7.0 - uTime * 5.0 + vSeed * 9.37);
      float band = smoothstep(0.62, 0.9, ph) * (1.0 - smoothstep(0.9, 1.0, ph));
      float a = pow(across, 1.5) * (0.4 + band * 1.25) * vLife;
      if (a < 0.02) discard;
      gl_FragColor = vec4(vCol * (0.75 + band * 1.6), a);
    }`;
  function makeBeams(scene) {
    const cap = 40;
    const geo = new THREE.PlaneGeometry(1, 1);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index; ig.setAttribute('position', geo.getAttribute('position')); ig.setAttribute('uv', geo.getAttribute('uv'));
    const aA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aM = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    [aA, aB, aCol, aM].forEach((x) => x.setUsage(THREE.DynamicDrawUsage));
    ig.setAttribute('iA', aA); ig.setAttribute('iB', aB); ig.setAttribute('iCol', aCol); ig.setAttribute('iMisc', aM);
    ig.instanceCount = cap;
    const uTime = { value: 0 };
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ig, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let cursor = 0;
    return {
      set time(v) { uTime.value = v; },
      beam(ax, ay, az, bx, by, bz, { color = 0x8fd4f2, width = .22, ttl = .22 } = {}) {
        const i = cursor; cursor = (cursor + 1) % cap;
        aA.setXYZ(i, ax, ay, az); aB.setXYZ(i, bx, by, bz);
        const c = new THREE.Color(color);
        aCol.setXYZ(i, c.r, c.g, c.b);
        aM.setXYZW(i, width, uTime.value, ttl, Math.random());
        aA.needsUpdate = aB.needsUpdate = aCol.needsUpdate = aM.needsUpdate = true;
      },
    };
  }
  let _glowTex = null;
  function glowTex() {
    if (_glowTex) return _glowTex;
    const [c, ctx] = canvas2d(128, 128);
    const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    _glowTex = toTexture(c); _glowTex.wrapS = _glowTex.wrapT = THREE.ClampToEdgeWrapping; _glowTex.repeat.set(1, 1);
    return _glowTex;
  }
  function glowSprite(color, { size = 1.6, y = 0, base = .8 } = {}) {
    const mat = new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const sp = new THREE.Sprite(mat);
    sp.scale.setScalar(size); sp.position.y = y;
    sp.userData = { size, base, ph: Math.random() * TAU };
    (NJ._glows = NJ._glows || []).push(sp);
    return sp;
  }
  function pruneGlows() {
    const list = NJ._glows || [];
    for (let i = list.length - 1; i >= 0; i--) {
      let o = list[i], inScene = false;
      while (o) { if (o.isScene) { inScene = true; break; } o = o.parent; }
      if (!inScene) { list[i].material.dispose(); list.splice(i, 1); }
    }
  }
  function makeFx(scene) {
    const add = makeIPool(scene, [
      { name: 'shots', n: 150, cell: 0, def: 0xffe27a },
      { name: 'rings', n: 40, cell: 1, def: 0xffd23c },
      { name: 'sparks', n: 64, cell: 2, def: 0xa9d8ff },
    ], { additive: true });
    const smoke = makeIPool(scene, [{ name: 'puffs', n: 110, cell: 3, def: 0xf0ead8 }], { additive: false });
    const beams = makeBeams(scene);
    let t = 0, pruneT = 0;
    return {
      shots: add.shots, rings: add.rings, sparks: add.sparks, puffs: smoke.puffs,
      beam: (...a) => beams.beam(...a),
      update(dt) {
        t += dt; pruneT += dt;
        beams.time = t;
        add.step.update(dt); smoke.step.update(dt);
        const dark = NJ.dark || 0, dk = .25 + .75 * dark;
        for (const g of (NJ._glows || [])) {
          const show = dark > .03;
          if (g.visible !== show) g.visible = show;
          if (show) g.material.opacity = g.userData.base * dk * (.8 + Math.sin(t * 3.1 + g.userData.ph) * .2);
        }
        if (pruneT > 2) { pruneT = 0; pruneGlows(); }
      },
    };
  }

  return { makeMaterials, weaponMesh, get mats() { return mats; }, matFor, crest, heroMesh, monsterMesh, towerMesh, cropMesh, npcMesh, riceEarMesh, treeMesh, tuftMesh, flowerMesh, rockMesh, mushroomProp, makeFx, glowSprite, gateMesh, buildingMesh, treeParts, partLocal, partLocal3, M4I: IDENT, tuftParts, rockParts, flowerParts, mushroomParts, addParts, flushParts, isShared: (geo) => Object.values(geoCache).includes(geo), cyl, sph, box, cone, G };
})();
