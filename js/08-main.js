/* 08-main — 装配与主循环：渲染器 / 昼夜光照 / 关卡装卸 / 三屏流转 /
   无头 harness（?seed ?dt ?bench ?autostart + window.__NJ）。 */
'use strict';

(function main() {
  const params = Object.fromEntries(new URLSearchParams(location.search));
  const bench = !!params.bench || location.hash === '#bench';
  if (bench) params.noaudio = '1';
  if (params.noaudio && window.Sound) Sound.setEnabled(false);

  window.__frames = 0;
  window.__ready = false;
  window.__fatal = null;
  window.__errors = [];
  const fatal = (e) => {
    window.__fatal = String(e && e.stack || e);
    console.error('[fatal] ' + window.__fatal);
    const f = document.getElementById('fatal');
    if (f) f.textContent = '陇上修真启动失败：' + window.__fatal;
  };
  addEventListener('error', (e) => window.__errors.push(String(e.message)));
  const origError = console.error.bind(console);
  console.error = (...a) => { try { window.__errors.push(a.map(String).join(' ')); } catch {} origError(...a); } ;

  const bootMsg = document.getElementById('boot-msg');
  const bootFill = document.getElementById('boot-fill');
  const nextFrame = () => new Promise((r) => setTimeout(r, 0));
  async function step(msg, p) {
    if (bootMsg) bootMsg.textContent = msg;
    if (bootFill) bootFill.style.width = Math.round(p * 100) + '%';
    await nextFrame();
  }

  const t0 = performance.now();
  function r(name, fn) {
    const s = performance.now();
    const v = fn();
    const ms = performance.now() - s;
    if (ms > 120) console.log('[boot] ' + name + ' ' + ms.toFixed(0) + 'ms');
    return v;
  }

  boot().catch(fatal);

  async function boot() {
    await step('正在架起灶台', .08);
    const canvas = document.getElementById('view');
    const renderer = r('renderer', () => {
      const x = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      x.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      x.setSize(innerWidth, innerHeight);
      x.shadowMap.enabled = true;
      x.shadowMap.type = THREE.PCFSoftShadowMap;
      x.toneMapping = THREE.ACESFilmicToneMapping;
      x.toneMappingExposure = 1.12;
      x.outputColorSpace = THREE.SRGBColorSpace;
      return x;
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 220);
    scene.add(camera);

    // 光照：半球天光 + 带阴影的日光 + 阵眼补光
    const hemi = new THREE.HemisphereLight(0xffffff, 0x74624a, .75); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
    sun.position.set(14, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.camera.far = 70; sun.shadow.bias = -.0008;
    scene.add(sun, sun.target);
    const fill = new THREE.PointLight(0xffd27a, .0, 46); fill.position.set(0, 4, -6); scene.add(fill);
    scene.fog = new THREE.Fog(0xcfe0c0, 38, 112);

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    await step('正在揉泥烧罐', .28);
    r('mats', () => Art.makeMaterials());

    /* ---- World：关卡装卸 + 昼夜 ---- */
    const World = {
      level: null, group: null,
      fx: r('fx', () => Art.makeFx(scene)),
      dayCol: new THREE.Color(), nightCol: new THREE.Color(0x2a3048),
      skyDay: new THREE.Color(), skyNight: new THREE.Color(0x181e30),
      load(idx) {
        if (this.group) {
          this.group.traverse((o) => {
            if (o.isInstancedMesh) o.dispose();
            if (o.geometry && !Art.isShared(o.geometry)) o.geometry.dispose();
          });
          scene.remove(this.group);
        }
        const def = DATA.LEVELS[idx];
        const rng = makeRng(hashStr(String(params.seed || '4207')) + idx * 7919);
        const lv = Level.build(def, rng);
        scene.add(lv.group);
        lv.top.receiveShadow = true;
        lv.nexus.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.level = lv; this.group = lv.group;
        this.skyDay.set(lv.theme.sky); this.dayCol.set(lv.theme.fog);
        scene.background = new THREE.Color(lv.theme.sky);
        scene.fog.color.copy(lv.theme.fog);
        sun.target.position.set(0, 0, 0);
      },
      setDaylight(k) {
        NJ.dark = 1 - k;
        sun.intensity = .25 + k * 1.15;
        sun.color.setRGB(1, .86 + k * .1, .7 + k * .18);
        hemi.intensity = .3 + k * .55;
        fill.intensity = (1 - k) * 2.2;
        scene.fog.color.copy(this.dayCol).lerp(this.nightCol, (1 - k) * .78);
        if (scene.background && scene.background.isColor) scene.background.copy(this.skyDay).lerp(this.skyNight, (1 - k) * .82);
      },
    };

    const G = { scene, camera, renderer, params, dom: canvas, world: World, rng: makeRng(hashStr(String(params.seed || '4207'))) };

    await step('正在插秧', .5);
    r('world', () => World.load(0));
    G.ui = r('ui', () => UI.build(G));
    if (window.PRDSYS) window.PRDSYS.init({ sim: null, ui: G.ui });

    /* ---- 屏幕流转 ---- */
    function bindPRD() { if (window.PRDSYS) window.PRDSYS.init({ sim: G.sim, ui: G.ui }); }
    G.newGame = () => {
      G.sim?.dispose();
      World.load(0);
      G.sim = Sim.build(G); bindPRD();
      G.ui.play(); G.ui.introFlow();
      G.sim.updateEnv(0);
    };
    G.continueGame = () => {
      const c = G.sim.readSave();
      if (!c) return G.newGame();
      G.sim.dispose();
      World.load(c.S.levelIdx || 0);
      G.sim = Sim.build(G); bindPRD();
      G.sim.applyCarry(c);
      G.ui.play();
      if (c.ts) {
        const hrs = Math.min(8, (Date.now() - c.ts) / 36e5);
        if (hrs > .1) {
          const rate = (c.S.farm || 16) * 31 * (1 + (c.S.realm || 0) * .2) * (1 + ((c.S.buildings || []).length) * .08);
          const coins = Math.round(rate * hrs);
          G.sim.S.money += coins; G.sim.S.xp += Math.round(120 * hrs);
          G.ui.toast('🏮 闭关 ' + hrs.toFixed(1) + ' 小时：灵币 +' + coins + '，修为 +' + Math.round(120 * hrs));
          G.ui.syncAll();
        }
      }
      G.ui.toast('存档已载入，继续修行');
      G.sim.updateEnv(0);
    };
    G.travelTo = (idx) => {
      idx = clamp(idx | 0, 0, DATA.LEVELS.length - 1);
      const carry = G.sim.snapshot();
      const from = carry.S.levelIdx;
      if (from === idx) return;
      carry.S.levelIdx = idx;
      carry.S.wave = 0; carry.S.waveActive = false; carry.S.intermission = 25; carry.S.dead = false;
      carry.plots = [];                       // 每区自成一方田
      carry.px = 0; carry.pz = idx > from ? 20.5 : -20.5;   // 从对侧山门步入
      G.sim.dispose();
      World.load(idx);
      G.sim = Sim.build(G); bindPRD();
      G.sim.applyCarry(carry);
      G.ui.setScr('playing');
      G.ui.levelIntro();
      G.sim.updateEnv(0);
      G.ui.toast((idx > from ? '⛰ 穿过北山门 · ' : '⛰ 折返南山门 · ') + '第 ' + (idx + 1) + ' 章 ' + DATA.LEVELS[idx].name);
      G.sim.save();
    };
    G.nextLevel = () => G.travelTo(G.sim.S.levelIdx + 1);
    G.restartLevel = () => {
      const carry = G.sim.snapshot();
      carry.S.wave = 0; carry.S.waveActive = false; carry.S.intermission = 22; carry.S.dead = false;
      G.sim.dispose();
      World.load(carry.S.levelIdx);
      G.sim = Sim.build(G); bindPRD();
      G.sim.applyCarry(carry);
      G.ui.setScr('playing');
      G.ui.levelIntro();
    };
    G.toTitle = () => { World.load(0); G.sim?.dispose(); G.sim = Sim.build(G); bindPRD(); G.ui.toTitle(); };
    // 标题背景需要一个 sim（输入被 state 门控挡住）
    G.sim = r('sim', () => Sim.build(G));
    G.sim.updateEnv(0);
    G.ui.refreshTitle();

    await step('已备好锄头与灵能', 1);
    document.getElementById('boot').classList.add('done');
    setTimeout(() => { const b = document.getElementById('boot'); if (b) b.hidden = true; }, 700);

    /* ---- harness ---- */
    const D = {};
    window.__NJ = {
      state() { return { screen: G.ui.state(), ...G.sim.state() }; },
      info() { const c = renderer.info.render; return { calls: c.calls, tris: c.triangles }; },
      sim: () => G.sim,
      ui: () => G.ui,
      debug: D,
    };
    Object.assign(D, {
        money(v) { G.sim.S.money += v; G.ui.syncTop(); },
        spirit(v) { G.sim.addSpirit(v); },
        xp(v) { G.sim.gainXp(v); },
        giveMats() { for (const k of ['wood', 'stone', 'fiber', 'core', 'spirit']) G.sim.S.inv[k] = (G.sim.S.inv[k] || 0) + 99; G.ui.syncAll(); },
        seeds(n = 20) { for (const id of DATA.CROP_IDS) G.sim.S.seeds[id] = (G.sim.S.seeds[id] || 0) + n; G.ui.syncInv(); },
        realm(id) { G.sim.S.realm = id; G.sim.S.hpMax = DATA.REALMS[id].hp; G.sim.S.hp = G.sim.S.hpMax; G.sim.S.spiritMax = 100 + id * 25; G.ui.syncAll(); },
        tillAll() { G.world.level.plots.forEach((p) => { if (!p.tilled) { p.tilled = true; G.world.level.setSoil(p, { tilled: true, color: 0xc29a6e }); } }); },
        plantAll(type) {
          D.tillAll();
          G.world.level.plots.forEach((p) => {
            if (!p.crop) { G.ui.currentSeed = type || 'cabbage'; G.sim.plant({ x: p.x, z: p.z }); }
          });
        },
        growAll() { G.world.level.plots.forEach((p) => { if (p.crop) { p.crop.growth += DATA.CROPS[p.crop.type].hours; p.moisture = 3; G.sim.save(); } }); },
        waterAll() { G.world.level.plots.forEach((p) => { p.moisture = 3; }); },
        plotsInfo() { return G.world.level.plots.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) })); },
        plantAt(x, z, type) { const p = G.sim.nearestPlot({ x, z }, .8); if (p) { G.ui.currentSeed = type; return G.sim.plant({ x: p.x, z: p.z }); } return false; },
        growAt(x, z, k = 1) { const p = G.sim.nearestPlot({ x, z }, .8); if (p && p.crop) { p.crop.growth += DATA.CROPS[p.crop.type].hours * k; p.moisture = Math.max(p.moisture, 2.5); G.sim.reStage(p); return true; } return false; },
        waterAt(x, z) { const p = G.sim.nearestPlot({ x, z }, .8); return p && G.sim.waterCrop({ x: p.x, z: p.z }); },
        harvestAll() { G.world.level.plots.forEach((p) => { if (p.crop) G.sim.harvest({ x: p.x, z: p.z }); }); },
        sellAll() { return G.sim.sellHarvest(); },
        place(id, x, z) { return G.sim.placeTower(id, x, z); },
        spawn(id, n = 1) { for (let i = 0; i < n; i++) G.sim.spawnEnemy({ id, hp: DATA.MONSTERS[id].hp, speedMul: 1 }); },
        killAll() { for (const e of G.sim.enemies.slice()) G.sim.damageEnemy(e, 1e6, 0xffffff); },
        clearWaves() {   // 直接打完本章（不播动画）
          const st = G.sim.S;
          for (let w = st.wave; w < DATA.LEVELS[st.levelIdx].waves; w++) { st.wave++; }
          G.sim.enemies.forEach((e) => { e.dead = true; G.scene.remove(e.view); });
          G.sim.clearLevel();
        },
        nexus(n) { G.sim.S.nexusHp -= n; },
        hurt(n) { G.sim.hurtPlayer(n || 1); },
        cam(i) { G.sim.P.camMode = i; },
        goto(idx) {
          const carry = G.sim.snapshot();
          carry.S.levelIdx = clamp(idx, 0, DATA.LEVELS.length - 1); carry.plots = [];
          G.sim.dispose(); World.load(carry.S.levelIdx);
          G.sim = Sim.build(G); bindPRD(); G.sim.applyCarry(carry);
        },
        save() { G.sim.save(); },
        hasSave() { return G.sim.hasSave(); },
      speed(v) { G.sim.S.speed = v; },
    });
    if (params.autostart || bench) G.newGame();

    /* ---- 主循环 ---- */
    let last = performance.now(), fps = 0, titleT = 0;
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      let dt = (now - last) / 1000; last = now;
      fps = fps ? fps * .95 + dt * .05 : dt;
      const stepDt = params.dt ? +params.dt : dt;
      NJ.time = { dt: stepDt, t: now / 1000, frame: window.__frames, fps: +(1 / Math.max(.0001, fps)).toFixed(1) };
      try {
        const scr = G.ui.state();
        if (scr === 'playing' && !G.ui.anyPanel()) {
          G.sim.update(stepDt);
          G.sim.updateCamera(stepDt);
        } else if (scr === 'playing') {
          // 面板或章节卡打开：世界暂停，相机仍跟随
          G.sim.updateCamera(Math.min(stepDt, .05));
        } else if (scr === 'title' || scr === 'end') {
          // 标题/结局：镜头环绕灵田，作物与阵眼仍活着
          G.sim.updateEnv(Math.min(stepDt, .05));
          G.sim.enemies.length = 0;
          titleT += stepDt * .12;
          camera.position.set(Math.sin(titleT) * 20, 11 + Math.sin(titleT * 1.7) * 2, Math.cos(titleT) * 20);
          camera.lookAt(0, 1, -1);
        } else {
          // 暂停 / 结算 / 败北：世界冻结，相机保持
          G.sim.updateCamera(Math.min(stepDt, .05));
        }
        G.ui.tick(Math.min(stepDt, .05));
        renderer.render(scene, camera);
      } catch (e) {
        window.__errors.push(String((e && e.stack) || e));
        if (!window.__fatal) fatal(e);
      }
      window.__frames++;
      if (window.__frames === 2) window.__ready = true;
    });
  }
})();
