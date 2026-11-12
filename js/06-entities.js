/* 06-entities — 运行时实体：主角（三视角 + 碰撞）、种田循环、防御塔 AI、
   怪物波次与寻路、战斗与物品、境界突破、存档。
   核心循环：种田换灵石与灵能 → 建塔守灵田阵眼 → 收割杀怪涨修为 → 炼丹升境界。 */
'use strict';

const Sim = window.Sim = (() => {
  const { clamp, lerp, damp, dampAngle, TAU, dist2 } = NJ.math;
  const DAY_SECONDS = 110;          // 1× 速一天 ≈ 110 秒

  function build(G, carried) {
    const { scene, camera, dom, rng, world, ui } = G;
    const level = world.level;
    const fx = world.fx;

    /* ---- 可变状态（存档面） ---------------------------------------------- */
    function freshS() {
      return {
        realm: 0, xp: 0, money: 80, spiritMax: 100,
        inv: { wood: 8, stone: 4, fiber: 4, core: 0, spirit: 0 },
        seeds: { cabbage: 8, radish: 4 },
        harvest: {},
        weapons: { hoe: 1 },
        towers: [], buildings: [], farm: 16,
        kills: 0, lost: 0,
        levelIdx: 0, wave: 0, waveActive: false, intermission: 25,
        diff: 0, diffCleared: [], enh: {},
        nexusHp: 100, nexusMax: 100,
        hp: 5, hpMax: 5,
        bag: { hpPot: 2, fertilizer: 1 },
        speed: 1, cleared: [], ascended: false, dead: false,
      };
    }
    const S = freshS();
    const realmv = () => DATA.REALMS[S.realm];
    const DIFFW = () => DATA.DIFFS[S.diff || 0];
    let spirit = 90;
    let time01 = .28;
    const shd = (g) => { g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };

    /* ---- 主角 ------------------------------------------------------------ */
    const hero = Art.heroMesh();
    let holdKey = null;
    function syncHold() {
      const want = ui.mode === 'weapon' ? weaponId() : '';
      if (want === holdKey) return;
      holdKey = want;
      const hold = hero.userData.hold; if (!hold) return;
      while (hold.children.length) hold.remove(hold.children[0]);
      if (want) hold.add(Art.weaponMesh(want));
    }
    hero.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(hero);
    /* ---- NPC 与金稻穗（PRD 玩法层）---- */
    const npcs = [];
    {
      const NPOS = level.npcPos || {};
      for (const kind of ['grannie', 'blacksmith', 'hawker', 'aunt']) {
        const pos = NPOS[kind]; if (!pos) continue;
        const v = Art.npcMesh(kind); v.position.set(pos[0], 0, pos[1]); v.rotation.y = Math.atan2(0 - pos[0], -6 - pos[1]) + Math.PI;
        scene.add(v); npcs.push({ kind, x: pos[0], z: pos[1], view: v });
        level.solids.push({ x: pos[0], z: pos[1], r: .45, solid: true });
      }
    }
    const riceViews = (level.rices || []).map((rz, i) => { const v = Art.riceEarMesh(); v.position.set(rz[0], 0, rz[1]); v.userData.i = i; scene.add(v); return { x: rz[0], z: rz[1], view: v, got: false }; });
    let nearNpc = null;
    function syncRiceView() {
      const q = window.PRDSYS && window.PRDSYS.Q(); if (!q) return; if (!q.gotR) q.gotR = {};
      for (const r of riceViews) { const key = level.def.id + ':' + r.view.userData.i; if (q.gotR[key]) { r.got = true; r.view.visible = false; } }
    }
    syncRiceView();
    const P = {
      x: 0, z: 8, camYaw: Math.PI, pitch: 0,
      vx: 0, vz: 0, walk: 0, swing: -1,
      camMode: 0, camDist: 12, pitLo: -.55, pitHi: 1.42, py: 0, vy: 0, jumpQ: false,
      invuln: 0, shieldT: 0, speedT: 0,
    };
    let useCd = 0, homeT = 0, cropSpirit = 0;
    const playerSpeed = () => 5.6 * realmv().speed * (P.speedT > 0 ? 1.5 : 1);
    // 摇杆/键位 → 世界方向：fw=前进量(+W) st=右移量(+D)。与相机朝向严格配对（见相机模块）
    function mapMove(yaw, fw, st) {
      const s = Math.sin(yaw), c = Math.cos(yaw);
      return { x: fw * s - st * c, z: fw * c + st * s };
    }
    const weaponId = () => ui.currentWeapon;

    /* ---- 山门：八区互通（北=下一章，需守清本章；南=回上一章，随时可行） ---- */
    const gates = new THREE.Group(); scene.add(gates);
    const fwdZ = -(level.bounds - 1.2), backZ = level.bounds - 1.2;
    const fwdOpen = Art.gateMesh(false), fwdLock = Art.gateMesh(true);
    const backOpen = Art.gateMesh(false), backLock = Art.gateMesh(true);
    for (const [m, z] of [[fwdOpen, fwdZ], [fwdLock, fwdZ], [backOpen, backZ], [backLock, backZ]]) { m.position.set(0, .27, z); gates.add(m); }
    let travelCd = 1.2, hintCd = 0;
    function gateStates() {
      const def = DATA.LEVELS[S.levelIdx];
      const canFwd = S.levelIdx < DATA.LEVELS.length - 1 && S.cleared.includes(def.id);
      const canBack = S.levelIdx > 0;
      fwdOpen.visible = canFwd; fwdLock.visible = !canFwd;
      backOpen.visible = canBack; backLock.visible = !canBack;
      return { canFwd, canBack };
    }

    /* ---- 输入：键鼠 + 触屏（绑 window，不依赖指针锁定） ------------------- */
    const keys = Object.create(null);
    const pointer = { down: false, moved: 0, lastX: innerWidth / 2, lastY: innerHeight / 2, has: false };
    const touch = { moveId: -1, lookId: -1, ax: 0, ay: 0, mx: 0, my: 0, lx: 0, ly: 0 };
    const mobile = matchMedia('(pointer: coarse)').matches;
    const onUi = (e) => !!(e.target && e.target.closest && e.target.closest('button, input, a, .panel, .slot, .t-btn, .hud, .modal, .tab, .b-card'));
    const listeners = [];
    const listen = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); listeners.push([t, ev, fn, opt]); };

    listen(window, 'keydown', (e) => {
      if (ui.state() !== 'playing') return;
      if (e.code === 'Escape') { ui.closePanels() || ui.pause(true); e.preventDefault(); return; }
      keys[e.code] = true;
      if (e.code === 'Space') { P.jumpQ = true; e.preventDefault(); }
      if (e.code === 'KeyF') act();
      if (e.code === 'KeyE') interact();
      if (/^Digit[1-8]$/.test(e.code)) ui.selectTool(+e.code.slice(5) - 1);
      if (e.code === 'KeyQ') ui.cycleSeed();
      if (e.code === 'KeyR') ui.cycleWeapon();
      if (e.code === 'KeyC') { P.camMode = (P.camMode + 1) % 3; ui.toast(['跟随视角', '俯瞰视角（布防）', '第一人称'][P.camMode]); }
      if (e.code === 'KeyV') { P.camMode = P.camMode === 1 ? 0 : 1; ui.toast(P.camMode === 1 ? '俯瞰（布防）' : '跟随视角'); }
      if (e.code === 'KeyT') { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; ui.toast('时间 ×' + S.speed); }
      if (e.code === 'KeyB') ui.openPanel('build');
      if (e.code === 'KeyG') ui.openPanel('alchemy');
      if (e.code === 'KeyK') ui.openPanel('shop');
      if (e.code === 'KeyH') useItem('hpPot');
    });
    listen(window, 'keyup', (e) => { keys[e.code] = false; });
    listen(window, 'mousedown', (e) => {
      if (ui.state() !== 'playing' || onUi(e)) return;
      pointer.down = true; pointer.moved = 0;
      pointer.lastX = e.clientX; pointer.lastY = e.clientY;
      if (e.button === 2) e.preventDefault();
    }, true);
    listen(window, 'mousemove', (e) => {
      const dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY;
      pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.has = true;
      if (ui.state() !== 'playing' || !pointer.down || ui.anyPanel()) return;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      if (pointer.moved > 4) {
        P.camYaw -= dx * .0045;
        P.pitch = clamp(P.pitch + dy * .0035, P.pitLo, P.pitHi);
      }
    });
    listen(window, 'mouseup', (e) => {
      if (ui.state() !== 'playing') { pointer.down = false; return; }
      if (pointer.down && pointer.moved < 6 && !onUi(e) && !ui.anyPanel()) act(e.clientX, e.clientY);
      pointer.down = false;
    });
    listen(window, 'wheel', (e) => {
      if (ui.state() !== 'playing' || onUi(e)) return;
      P.camDist = clamp(P.camDist + Math.sign(e.deltaY) * 1.4, P.camMode === 1 ? 10 : 3.5, P.camMode === 1 ? 34 : 26);
    }, { passive: true });
    listen(window, 'contextmenu', (e) => e.preventDefault());
    listen(window, 'touchstart', (e) => {
      if (ui.state() !== 'playing' || onUi(e)) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * .42 && touch.moveId < 0) { touch.moveId = t.identifier; touch.ax = t.clientX; touch.ay = t.clientY; touch.mx = t.clientX; touch.my = t.clientY; }
        else if (touch.lookId < 0) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
      }
    }, { passive: true });
    listen(window, 'touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.moveId) { touch.mx = t.clientX; touch.my = t.clientY; }
        else if (t.identifier === touch.lookId) {
          P.camYaw -= (t.clientX - touch.lx) * .006;
          P.pitch = clamp(P.pitch + (t.clientY - touch.ly) * .004, -.5, .9);
          touch.lx = t.clientX; touch.ly = t.clientY;
        }
      }
    }, { passive: true });
    listen(window, 'touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.moveId) touch.moveId = -1;
        if (t.identifier === touch.lookId) {
          touch.lookId = -1;
          const gp = groundPick(t.clientX, t.clientY);
          if (gp && ui.mode !== 'weapon') { orderNavAt(gp); return; }
          act();
        }
      }
    });

    /* ---- 射线拾取地面 ------------------------------------------------------ */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const gPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.3);
    const gHit = new THREE.Vector3();
    function groundPick(cx, cy) {
      const r = dom.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(gPlane, gHit) ? { x: gHit.x, z: gHit.z } : null;
    }
    function aimPoint() {
      if (P.camMode === 1 || ui.mode === 'build') {
        const gp = pointer.has ? groundPick(pointer.lastX, pointer.lastY) : null;
        if (gp) return gp;
      }
      const gp = groundPick(innerWidth / 2, innerHeight * .58);
      if (gp) return gp;
      return { x: P.x + Math.sin(P.camYaw) * 5, z: P.z + Math.cos(P.camYaw) * 5 };
    }

    /* ---- 自动寻路：steering 绕开圆形障碍，走到目标执行指令 ------------------- */
    const nav = { active: false, tx: 0, tz: 0, act: null, plot: null, seed: null, x: 0, y: 0, z: 0 };
    nav.marker = new THREE.Mesh(new THREE.TorusGeometry(.34, .05, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: .9, depthWrite: false }));
    nav.marker.rotation.x = Math.PI / 2; nav.marker.visible = false; scene.add(nav.marker);
    function blockedAt(x, z) {
      const margin = .5;
      for (const so of level.solids) { if (!so.solid || so.nexus) continue; if (dist2(x, z, so.x, so.z) < (so.r + margin) ** 2) return true; }
      for (const t of S.towers) if (dist2(x, z, t.x, t.z) < (.55 + margin) ** 2) return true;
      for (const bd of S.buildings || []) if (dist2(x, z, bd.x, bd.z) < (bd.r + margin) ** 2) return true;
      return Math.hypot(x, z) > level.bounds - 1.1;
    }
    function steerTo(tx, tz) {
      const base = Math.atan2(tx - P.x, tz - P.z);
      for (const off of [0, .5, -.5, 1, -1, 1.5, -1.5, 2.1, -2.1]) {
        const a = base + off, dx = Math.sin(a), dz = Math.cos(a);
        let clear = true;
        for (let k = 1; k <= 3 && clear; k++) if (blockedAt(P.x + dx * k * .55, P.z + dz * k * .55)) clear = false;
        if (clear) return { x: dx, z: dz };
      }
      return { x: Math.sin(base), z: Math.cos(base) };
    }
    function orderTo(x, z, actName, plot, seed) {
      nav.active = true; nav.tx = x; nav.tz = z; nav.act = actName || null; nav.plot = plot || null; nav.seed = seed || null;
    }
    function runNavOrder() {
      const p2 = nav.plot; const a = nav.act; const seed = nav.seed;
      nav.act = null; nav.plot = null;
      if (!p2 || !a) return;
      if (p2.locked) { Sound.play('deny'); ui.toast('这块田还没开垦 —— 商店「家园」里扩建'); return; }
      const pt = { x: p2.x, z: p2.z };
      if (a === 'plant' && seed) ui.currentSeed = seed;
      if (a === 'till') till(pt);
      else if (a === 'plant') plant(pt);
      else if (a === 'water') waterCrop(pt);
      else if (a === 'harvest') harvest(pt);
    }

    /* ---- 碰撞：圆-圆推挤 + 台地边界 ---------------------------------------- */
    function collide(px, pz, rad, air) {
      let x = px, z = pz;
      const solids = level.solids;
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (!s.solid) continue;
        const dx = x - s.x, dz = z - s.z;
        const d = Math.hypot(dx, dz), min = rad + s.r;
        if (d < min) {
          if (d > 1e-4) { x += dx / d * (min - d); z += dz / d * (min - d); }
          else { const ang = (s.x * 7.31 + s.z * 3.71) % TAU; x += Math.cos(ang) * min; z += Math.sin(ang) * min; }
        }
      }
      for (const bd of S.buildings) {
        const dx = x - bd.x, dz = z - bd.z;
        const d = Math.hypot(dx, dz), min = rad + bd.r;
        if (d < min) {
          if (d > 1e-4) { x += dx / d * (min - d); z += dz / d * (min - d); }
          else { const ang = (bd.x * 5.13 + bd.z * 9.71) % TAU; x += Math.cos(ang) * min; z += Math.sin(ang) * min; }
        }
      }
      for (const t of S.towers) {
        if (air) break;
        const dx = x - t.x, dz = z - t.z;
        const d = Math.hypot(dx, dz), min = rad + .55;
        if (d < min) {
          if (d > 1e-4) { x += dx / d * (min - d); z += dz / d * (min - d); }
          else { const ang = (t.x * 5.13 + t.z * 9.71) % TAU; x += Math.cos(ang) * min; z += Math.sin(ang) * min; }
        }
      }
      const rr = Math.hypot(x, z), maxR = level.bounds - .6;
      if (rr > maxR) { x = x / rr * maxR; z = z / rr * maxR; }
      return [x, z];
    }

    const dais = level.daisTop || { x: 0, z: -6, r: 1.45, top: 0 };
    function groundH(x, z) { return Math.hypot(x - dais.x, z - dais.z) < dais.r ? dais.top : 0; }

    /* ---- 灵能（建塔货币） -------------------------------------------------- */
    function addSpirit(v) { spirit = clamp(spirit + v, 0, S.spiritMax); if (v > 0 && window.PRDSYS) window.PRDSYS.fire('spiritGain', v); ui.syncTop(); }
    function spendSpirit(v) { if (spirit < v) return false; spirit -= v; ui.syncTop(); return true; }

    /* ---- 种田 -------------------------------------------------------------- */
    function nearestPlot(pt, maxD = 2.4) {
      let best = null, bd = maxD * maxD;
      for (const p of level.plots) { const d = dist2(pt.x, pt.z, p.x, p.z); if (d < bd) { bd = d; best = p; } }
      return best;
    }
    const stageOf = (crop) => clamp(1 + Math.floor((crop.growth / DATA.CROPS[crop.type].hours) * 3.999), 1, 4);
    function reStage(p) {
      const st = stageOf(p.crop);
      if (p.crop.stage !== st) {
        p.crop.stage = st;
        if (p.view) scene.remove(p.view);
        p.view = Art.cropMesh(p.crop.type, st, p.crop.seed);
        p.view.position.set(p.x, .32, p.z); scene.add(p.view);
      }
    }
    function till(pt) {
      const p = nearestPlot(pt); if (!p || p.tilled) return false;
      p.tilled = true; level.setSoil(p, { tilled: true, color: 0xc29a6e });
      Sound.play('till'); puffAt(p.x, .45, p.z, 0xc8a878);
      (window.PRDSYS && window.PRDSYS.fire('till', 1)); save(); return true;
    }
    function plant(pt) {
      const p = nearestPlot(pt); if (!p || !p.tilled || p.crop) return false;
      const type = ui.currentSeed; if (!type) return false;
      if ((S.seeds[type] || 0) <= 0) {
        const cost = DATA.CROPS[type].seed;
        if (S.money < cost) { Sound.play('deny'); ui.toast('灵石与' + DATA.CROPS[type].name + '种子都不足'); return false; }
        S.money -= cost;
      } else S.seeds[type]--;
      p.crop = { type, growth: 0, seed: level.plots.indexOf(p) + 1, stage: 0 };
      reStage(p);
      Sound.play('plant');
      (window.PRDSYS && window.PRDSYS.fire('plant', 1)); ui.syncInv(); save(); return true;
    }
    function waterCrop(pt) {
      const p = nearestPlot(pt); if (!p || !p.tilled) return false;
      p.moisture = 3; level.setSoil(p, { color: 0x71503a });
      Sound.play('water'); fx.puffs.spawn(new THREE.Vector3(p.x, .5, p.z), { ttl: .4, scale: .7 });
      (window.PRDSYS && window.PRDSYS.fire('water', 1));
      return true;
    }
    function harvest(pt) {
      const p = nearestPlot(pt); if (!p || !p.crop || stageOf(p.crop) < 4) return false;
      const c = DATA.CROPS[p.crop.type];
      S.harvest[p.crop.type] = (S.harvest[p.crop.type] || 0) + c.yield;
      (window.PRDSYS && window.PRDSYS.fire('harvest', 1)); (window.PRDSYS && window.PRDSYS.fire('grain', 1, p.crop.type));
      gainXp(c.xp); addSpirit(6 + S.realm * 3);
      if (p.view) scene.remove(p.view);
      p.crop = null; p.view = null;
      Sound.play('harvest'); puffAt(p.x, .55, p.z, c.color); ui.syncInv(); save(); return true;
    }
    function updateCrops(dHours) {
      if (dHours <= 0) return;
      let growing = 0;
      for (const p of level.plots) {
        if (!p.crop) continue;
        const c = DATA.CROPS[p.crop.type];
        const before = stageOf(p.crop);
        p.moisture = Math.max(0, p.moisture - dHours * c.water * .22);
        if (p.moisture <= .02) { if (p.soilHex !== 0xa88a64) level.setSoil(p, { color: 0xdcc094 }); continue; }  // 干透停长
        let gm = 1 + S.realm * .06;
        for (const gd of S.buildings) if (gd.id === 'guard' && dist2(p.x, p.z, gd.x, gd.z) < 36) { gm *= 1 + .15 * (gd.lvl || 1); break; }
        p.crop.growth += dHours * gm;
        if (stageOf(p.crop) < 4) growing++;
        reStage(p);
        if (stageOf(p.crop) >= 4 && before < 4) puffAt(p.x, .55, p.z, 0xf5e8a8);
      }
      // V1.0 §4.2：生长中的作物持续泄出灵能（生气），每株每游戏时 0.8
      cropSpirit += growing * dHours * .8;
      if (cropSpirit >= 1) { const v = Math.floor(cropSpirit); cropSpirit -= v; addSpirit(v); }
    }

    /* ---- 经验与境界 -------------------------------------------------------- */
    function gainXp(v) {
      S.xp += v;
      const next = DATA.REALMS[S.realm + 1];
      if (next && S.xp >= next.need && !S.realmReady) { S.realmReady = true; Sound.play('quest'); ui.toast('灵台清明——去丹炉（G）突破' + next.name); }
      ui.syncTop();
    }
    function breakthrough() {
      const next = DATA.REALMS[S.realm + 1];
      if (!next || S.xp < next.need) { Sound.play('deny'); ui.toast('修为不足'); return false; }
      const pill = DATA.PILLS[next.id];
      if (pill && !(S.inv['pill' + next.id] > 0)) { Sound.play('deny'); ui.toast('需要' + pill.name + '——丹炉里以灵石与材料炼制'); return false; }
      if (pill) S.inv['pill' + next.id]--;
      S.realm = next.id;
      S.hpMax = realmv().hp; S.hp = S.hpMax;
      S.spiritMax += 25; addSpirit(40);
      S.realmReady = false;
      Sound.play('breakthrough');
        (window.PRDSYS && window.PRDSYS.fire('realm', 1)); ringAt(P.x, P.z, 0xffd23c);
      ui.toast('突破！' + next.name + ' —— ' + next.desc);
      ui.syncAll(); save(); return true;
    }

    /* ---- 防御塔 ------------------------------------------------------------ */
    function canPlace(x, z) {
      if (Math.hypot(x, z) > level.bounds - 1.2) return '要建在台地里';
      if (Math.hypot(x, z + 6) < 2.8) return '离阵眼太近';
      for (const p of level.plots) if (dist2(x, z, p.x, p.z) < 1.5 ** 2) return '不能建在耕地上';
      for (const t of S.towers) if (dist2(x, z, t.x, t.z) < 1.5 ** 2) return '塔距太近';
      for (const s of level.solids) if (s.solid && dist2(x, z, s.x, s.z) < (s.r + .9) ** 2) return '这里被植被挡住';
      return null;
    }
    function placeTower(id, x, z) {
      const def = DATA.TOWERS[id];
      if (S.realm < def.unlock) { Sound.play('deny'); ui.toast(def.name + ' 需境界「' + DATA.REALMS[def.unlock].name + '」'); return false; }
      const err = canPlace(x, z); if (err) { Sound.play('deny'); ui.toast(err); return false; }
      if (!spendSpirit(def.cost)) { Sound.play('deny'); ui.toast('灵能不足（' + def.cost + '）——种地与向日葵灵灯供能'); return false; }
      const g = shd(Art.towerMesh(id)); g.position.set(x, .3, z); scene.add(g);
      S.towers.push({ id, x, z, lv: 1, cd: 0, hp: 220 + def.cost * 1.6, maxHp: 220 + def.cost * 1.6, view: g });
      Sound.play('build'); ringAt(x, z, def.color); save(); return true;
      (window.PRDSYS && window.PRDSYS.fire(DATA.TOWERS[id].kind === 'trap' ? 'buildTrap' : 'buildTower', 1));
    }
    function enhOf(id) { return S.enh[id] || 0; }
    function towerDmg(t) { const q = DATA.TOWERS[t.id].q; return DATA.TOWERS[t.id].dmg * DATA.UPG_DMG[t.lv - 1] * (1 + enhOf(t.id) * DATA.ENH[q].dmg); }
    function towerRange(t) { return DATA.TOWERS[t.id].range * 2.15 * DATA.UPG_RANGE[t.lv - 1]; }   // V1.0 表按格计，1格=2.15m（NUMBERS.md 换算）
    function towerRate(t) { const q = DATA.TOWERS[t.id].q; return DATA.TOWERS[t.id].rate * DATA.UPG_RATE[t.lv - 1] * (1 + enhOf(t.id) * DATA.ENH[q].rate); }
    function nearestTowerAt(pt, r = 2.2) { let best = null, bd = r * r; for (const t of S.towers) { const d = dist2(pt.x, pt.z, t.x, t.z); if (d < bd) { bd = d; best = t; } } return best; }
    function upgradeTower(t) {
      const def = DATA.TOWERS[t.id];
      if (t.lv >= 5) { ui.toast(def.name + ' 已满级'); return false; }
      const cost = Math.round(def.cost * DATA.UPG_COST[t.lv]);
      if (!spendSpirit(cost)) { Sound.play('deny'); ui.toast('灵能不足（升级需 ' + cost + '）'); return false; }
      t.lv++; t.maxHp += 150; t.hp = t.maxHp;
      if (t.lv === 3) (window.PRDSYS && window.PRDSYS.fire('towerLv3', 1));
      t.view.scale.setScalar(1 + (t.lv - 1) * .12);
      Sound.play('upgrade'); ringAt(t.x, t.z, 0xffd23c); save(); return true;
    }
    function sellTower(t) {
      const i = S.towers.indexOf(t); if (i < 0) return;
      scene.remove(t.view); S.towers.splice(i, 1);
      addSpirit(Math.floor(DATA.TOWERS[t.id].cost * .6));
      Sound.play('coin'); save();
    }
    function canPlaceB(x, z) {
      if (Math.hypot(x, z) > level.bounds - 1.2) return '要建在台地里';
      if (Math.hypot(x, z + 6) < 2.8) return '离阵眼太近';
      for (const p2 of level.plots) if (dist2(x, z, p2.x, p2.z) < 1.5 ** 2) return '不能建在耕地上';
      for (const t of S.towers) if (dist2(x, z, t.x, t.z) < 1.5 ** 2) return '离防御塔太近';
      for (const b of S.buildings) if (dist2(x, z, b.x, b.z) < 2.2 ** 2) return '离家园建筑太近';
      for (const so of level.solids) if (so.solid && !so.nexus && dist2(x, z, so.x, so.z) < (so.r + .9) ** 2) return '这里被植被挡住';
      return null;
    }
    function placeBuilding(id, x, z) {
      const bd = DATA.BUILDINGS[id]; if (!bd) return false;
      if (S.realm < bd.realm) { Sound.play('deny'); ui.toast(bd.name + ' 需境界「' + DATA.REALMS[bd.realm].name + '」'); return false; }
      const err = canPlaceB(x, z); if (err) { Sound.play('deny'); ui.toast(err); return false; }
      if (S.money < bd.cost) { Sound.play('deny'); ui.toast('灵石不足（' + bd.cost + '）'); return false; }
      S.money -= bd.cost;
      const g = Art.buildingMesh(id); g.position.set(x, .3, z); scene.add(g);
      S.buildings.push({ id, x, z, r: bd.r, view: g, eggT: 0, lvl: 1 });
      (window.PRDSYS && window.PRDSYS.fire('build', 1));
      Sound.play('build'); ringAt(x, z, 0xf0c34a); ui.syncTop(); save(); return true;
    }
    function nearestBuildingAt(pt, r = 2.2) { let best = null, bdd = r * r; for (const t of S.buildings) { const d = dist2(pt.x, pt.z, t.x, t.z); if (d < bdd) { bdd = d; best = t; } } return best; }
    function sellBuilding(b) {
      const i = S.buildings.indexOf(b); if (i < 0) return;
      scene.remove(b.view); S.buildings.splice(i, 1);
      S.money += Math.floor(DATA.BUILDINGS[b.id].cost * .6);
      Sound.play('coin'); ui.syncTop(); save();
    }
    function enhTower(id) {
      const def = DATA.TOWERS[id]; const q = def.q; const lv = S.enh[id] || 0;
      const cap = DATA.ENH[q].cap;
      if (lv >= cap) { Sound.play('deny'); ui.toast(QN(q) + '塔强化已满 ' + cap + ' 级'); return false; }
      const st = DATA.ENH[q].stone(lv + 1), cn = DATA.ENH[q].coin(lv + 1);
      if ((S.inv.enhstone || 0) < st || S.money < cn) { Sound.play('deny'); ui.toast('需强化石×' + st + ' + 灵石×' + cn); return false; }
      S.inv.enhstone -= st; S.money -= cn; S.enh[id] = lv + 1;
      (window.PRDSYS && window.PRDSYS.fire('enh', 1));
      Sound.play('upgrade'); ui.syncAll(); save(); return true;
    }
    function QN(q) { return DATA.Q_NAMES[q]; }
    function hasBuilding(id) { return S.buildings.some((b) => b.id === id); }
    function replayDiff(d) {
      const key = def0(S.levelIdx) + ':' + (d - 1);
      if (d > 0 && !S.diffCleared.includes(key) && !(d === 1 && S.cleared.includes(def0(S.levelIdx)))) { Sound.play('deny'); ui.toast('难度未解锁'); return false; }
      S.diff = d; S.wave = 0; S.waveActive = false; S.intermission = 25;
      ui.toast('⚔ ' + DATA.DIFFS[d].name + '难度 · 再战 ' + DATA.LEVELS[S.levelIdx].name); save(); return true;
    }
    function def0(i) { return DATA.LEVELS[i].id; }
    function unlockNextFarm() {
      const tier = DATA.FARM_TIERS.find((t) => t.n > S.farm);
      if (!tier) { Sound.play('deny'); ui.toast('田畦已全部开垦'); return false; }
      if (S.realm < tier.realm) { Sound.play('deny'); ui.toast('境界不足，需「' + DATA.REALMS[tier.realm].name + '」'); return false; }
      if (S.money < tier.cost) { Sound.play('deny'); ui.toast('灵石不足（' + tier.cost + '）'); return false; }
      S.money -= tier.cost; S.farm = tier.n;
      level.unlockPlots(S.farm);
      Sound.play('build'); ui.toast('⛰ 新开 ' + tier.n + ' 畦田！'); ui.syncAll(); save(); return true;
    }

    function destroyTower(t) {
      const i = S.towers.indexOf(t); if (i < 0) return;
      scene.remove(t.view); S.towers.splice(i, 1);
      S.lost++;
      ui.toast(DATA.TOWERS[t.id].name + ' 被摧毁！');
      ringAt(t.x, t.z, 0xd8442f); save();
    }

    /* ---- 怪物 -------------------------------------------------------------- */
    const enemies = [];
    let spawnQueue = [], spawnT = 0, waveState = 'idle';   // idle|spawn|fight

    function startWave() {
      const def = DATA.LEVELS[S.levelIdx];
      const w = S.wave;
      const row = DATA.WAVES[S.levelIdx][w - 1];
      spawnQueue = [];
      let total = 0;
      for (const [id, n] of row) for (let i = 0; i < n; i++) { spawnQueue.push({ id }); total++; }
      if (w === def.waves && def.boss) { spawnQueue.push({ id: def.boss }); }
      const per = DATA.waveSpirit(S.levelIdx, w, total);
      for (const q of spawnQueue) q.waveSpirit = per;
      for (let i = spawnQueue.length - 1; i > 0; i--) { const j = rng.int(i + 1); [spawnQueue[i], spawnQueue[j]] = [spawnQueue[j], spawnQueue[i]]; }
      spawnT = .5; waveState = 'spawn'; S.waveActive = true;
      ui.toast('第 ' + w + '/' + def.waves + ' 波来袭' + (def.boss && w === def.waves ? '：⚠ ' + DATA.MONSTERS[def.boss].name + '！' : '！'));
      if (def.final && w === def.waves) { /* 剧情条：玄冥子聚伪谷登梯 */
        ui.storyBar(['四饿使归位。祭田中央，玄冥子聚起最后一把伪谷——他要用八千顷的粮，给自己铺一条登天的梯。', '青禾婆婆：「娃，听见没有……那梯子上，全是稻子的哭声。」']); }
      Sound.play('quest'); Sound.intensity(.5 + w / def.waves * .5);
      save();
    }
    function spawnEnemy(spec) {
      const d = DATA.MONSTERS[spec.id];
      const st = DATA.mStats(spec.id, S.levelIdx, S.wave, S.diff);
      const lane = level.lanes[rng.int(level.lanes.length)];
      const view = shd(Art.monsterMesh(d));
      view.add(Art.glowSprite(0xffd23c, { size: d.boss ? 2.8 : 1.15, y: (d.fly ? 1.9 : 1.25) * (d.r / .42), base: .65 }));
      scene.add(view);
      enemies.push({
        id: spec.id, def: d, x: lane.spawn.x, z: lane.spawn.z, t: 0, lane,
        hp: st.hp, hpMax: st.hp, speed: st.spd, gold: st.gold, xp: st.xp, dmg: st.dmg, tags: d.tags || '',
        slowT: 0, stunT: 0, dead: false, hitFlash: 0, fly: !!d.fly,
        bob: rng.range(0, TAU), shootCd: rng.range(.4, 1.6), r: d.r, view,
        shield: d.shield ? d.shield * (DIFFW() || 1) : 0, burnT: 0, shred: 0, killSrc: null, healCd: 1.4, sumCd: 7, rushT: 0, rushCd: 2.4, phase: rng.range(0, 9), stealthOn: false, _aura: 0,
      });
    }
    function damageEnemy(e, dmg, opts) {
      opts = opts || {};
      const src = opts.src;
      if (src !== 'true' && e.def.dodge && Math.random() < e.def.dodge) { fx.puffs.spawn(new THREE.Vector3(e.x, .8, e.z), { ttl: .25, scale: .6 }); return; }
      let mul = DATA.elMul(src === 'true' ? 'true' : (src && src.el) || 'phys', e.tags);
      let armor = (e.def.armor || 0) * (1 - Math.min(.6, (e.shred || 0) * .2));
      e.hp -= (src === 'true' ? dmg : dmg * mul) * (1 - (src === 'true' ? 0 : armor));
      if (src === 'kill') e.killSrc = true;
      if (e.shield > 0) { e.shield -= dmg; if (e.shield < 0) { e.hp += e.shield; e.shield = 0; } }
      e.hitFlash = .1;
      fx.puffs.spawn(new THREE.Vector3(e.x, (e.fly ? 1.5 : .7), e.z), { ttl: .3, scale: .7 });
      if (e.hp <= 0) killEnemy(e);
    }
    function killEnemy(e) {
      e.dead = true; S.kills++;
      (window.PRDSYS && window.PRDSYS.fire('kill', 1));
      const d = e.def; const dm = DIFFW();
      S.money += e.gold || Math.round((d.gold || 5) * (1 + S.levelIdx * .4));
      gainXp(e.xp || d.xp || 6);
      addSpirit((d.boss ? 50 : 1.2 + S.realm * .5) * dm.drop * (e.killSrc ? 1.3 : 1) + (e.waveSpirit || 0));
      const drop = DATA.dropFor(d);
      for (const k in drop) if (Math.random() < drop[k] * (k === 'enhstone' ? dm.mat : 1)) S.inv[k] = (S.inv[k] || 0) + Math.max(1, Math.round((d.boss ? 4 : 1) * (k === 'enhstone' ? dm.mat : 1)));
      puffAt(e.x, .8, e.z, d.color); ringAt(e.x, e.z, 0xffffff);
      if (d.boom) {
        ringAt(e.x, e.z, 0xff7a2f); fx.rings.spawn(new THREE.Vector3(e.x, .4, e.z), { ttl: .55, scale: 2.4, tint: 0xff5a2a });
        for (const t2 of S.towers.slice()) if (dist2(e.x, e.z, t2.x, t2.z) < 6.8) { t2.hp -= Math.round((d.boom || 60) * DIFFW().atk); if (t2.hp <= 0) destroyTower(t2); }
        if (Math.hypot(e.x, e.z + 6) < 3.6) S.nexusHp -= Math.round((d.boom || 60) * .3 * DIFFW().atk);
        if (Math.hypot(e.x - P.x, e.z - P.z) < 2.6) hurtPlayer(d.dmgP || 2);
        Sound.play('cannon');
      }
      if (d.split && enemies.length < 92) {
        const kidId = d.splitId || 'sprout', kidHp = Math.max(22, Math.round(e.hpMax * .22));
        for (let k = 0; k < d.split; k++) {
          spawnEnemy({ id: kidId, hp: kidHp, speedMul: 1.1 });
          const c = enemies[enemies.length - 1]; c.lane = e.lane; c.t = e.t; c.x = e.x + (k - d.split / 2) * .8; c.z = e.z + (k % 2 ? .4 : -.4);
        }
        puffAt(e.x, .6, e.z, d.color);
      }
      Sound.play('kill');
      if (d.boss) ui.toast('⚑ ' + d.name + ' 伏诛！');
      scene.remove(e.view);
      ui.syncTop(); save();
    }
    function updateEnemies(dt) {
      // 战鼓蟾光环：4m 内友军 +30% 移速
      for (const a0 of enemies) a0._aura = 0;
      for (const au of enemies) { if (au.dead || !au.def.aura) continue; for (const o of enemies) if (!o.dead && o !== au && dist2(au.x, au.z, o.x, o.z) < 20) o._aura = Math.max(o._aura, .3); }
      for (const e of enemies) {
        if (e.dead) continue;
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        const potMat = e.view.children[0].material;
        if (potMat.emissive) potMat.emissive.setHex(e.hitFlash > 0 ? 0xff4a3a : 0x000000);
        if (e.stunT > 0) e.stunT -= dt;
        else {
          let mult = e.slowT > 0 ? .45 : 1;
          if (e.rushT > 0) { e.rushT -= dt; mult *= 2.7; }
          else if (e.def.rush) { e.rushCd -= dt; if (e.rushCd <= 0) { e.rushT = .8; e.rushCd = 4.2; Sound.play('zap'); } }
          mult *= 1 + (e._aura || 0);
          const sp = e.speed * mult;
          if (e.slowT > 0) e.slowT -= dt;
          e.t = Math.min(1, e.t + sp * dt / (e.lane.len || 44));   // 沿弧长匀速：sp=米/秒
          const q = e.lane.at(e.t);
          e.x = q.x; e.z = q.z;
        }
        e.bob += dt * (e.fly ? 9 : 11); if (e.def.stealth) e.phase += dt;
        e.view.position.set(e.x, e.fly ? 1.5 + Math.sin(e.bob) * .2 : .28 + Math.abs(Math.sin(e.bob)) * .07, e.z);
        const face = Math.hypot(P.x - e.x, P.z - e.z) < 6 ? Math.atan2(P.x - e.x, P.z - e.z) : Math.atan2(-e.lane.at(Math.min(1, e.t + .02)).x + e.x, -e.lane.at(Math.min(1, e.t + .02)).z + e.z) + Math.PI;
        e.view.rotation.y = dampAngle(e.view.rotation.y, face, 8, dt);
        if (e.def.regen) e.hp = Math.min(e.hpMax, e.hp + e.def.regen * dt);
        if (e.burnT > 0) { e.burnT -= dt; e.hp -= (e.def.baseHp || 30) * .012 * dt * 3; if (e.hp <= 0) killEnemy(e); }
        if (e.shred > 0 && (e.bob % 4) < dt) e.shred -= 1;
        if (e.def.heal) { e.healCd -= dt; if (e.healCd <= 0) { e.healCd = 1.5;
          for (const o of enemies) { if (o === e || o.dead || o.hp >= o.hpMax * .7 || dist2(e.x, e.z, o.x, o.z) > 13) continue;   // 医不满血：只拉已残目标，塔火能有效削减
            o.hp = Math.min(o.hpMax * .7, o.hp + o.hpMax * .02); fx.beam(e.x, .9, e.z, o.x, .7, o.z, { color: 0x9df0b8, width: .07, ttl: .3 }); } } }
        if (e.def.summon) { e.sumCd -= dt; if (e.sumCd <= 0 && enemies.length < 95) { e.sumCd = 7;
          spawnEnemy({ id: e.def.summon, waveSpirit: 0 });
          const n0 = enemies[enemies.length - 1]; n0.lane = e.lane; n0.t = e.t; n0.x = e.x + .5; n0.z = e.z; puffAt(e.x, .6, e.z, DATA.MONSTERS[e.def.summon].color); } }
        if (e.def.stealth) { const hid = (e.phase % 3.4) > 2.1; if (hid !== e.stealthOn) { e.stealthOn = hid; e.view.visible = !hid; } }

        // 攻击判定：近塔 → 啃塔；到阵眼 → 轰阵眼；远程怪射程内有玩家 → 吐击；贴脸 → 咬
        let atk = null;
        for (const t of S.towers) { if (dist2(e.x, e.z, t.x, t.z) < 1.7 ** 2) { atk = { tower: t }; break; } }
        if (!atk && Math.hypot(e.x, e.z + 6) < 2.6) atk = { nexus: true };
        if (!atk && !e.fly && Math.hypot(e.x - P.x, e.z - P.z) < e.r + .7) atk = { hero: true };
        if (!atk && e.def.ranged) {
          const dh = Math.hypot(e.x - P.x, e.z - P.z);
          if (dh < e.def.ranged) atk = { hero: true, ranged: true };
        }
        if (atk) {
          e.shootCd -= dt;
          if (e.shootCd <= 0) {
            e.shootCd = atk.ranged ? 2.2 : 1.25;
            if (atk.ranged) fx.beam(e.x, 1, e.z, atk.hero ? P.x : 0, atk.hero ? 1 : 1.2, atk.hero ? P.z : -6, { color: 0xa8d84a, width: .15, ttl: .28 });
            if (atk.tower) {
              atk.tower.hp -= Math.max(2, Math.round(e.dmg * .8));
              puffAt(e.x, .9, e.z);
              Sound.play('hit');
              if (atk.tower.hp <= 0) destroyTower(atk.tower);
            } else if (atk.nexus) {
              S.nexusHp -= Math.max(1, e.dmg);
              ringAt(0, -6, 0xff5a4a); Sound.play('hurt');
              if (S.nexusHp <= 0) return lose('灵田阵眼被毁');
            } else hurtPlayer(Math.max(1, Math.ceil(e.dmg * (e.def.dmgP || 1) * .5)));
          }
        }
      }
      // 地面怪障碍化：塔身/水晶柱是物理屏障，撞上停下啃，不再穿模站塔
      for (const e of enemies) {
        if (e.dead || e.fly) continue;
        for (const bdd of S.buildings) {
          const dx = e.x - bdd.x, dz = e.z - bdd.z, min = bdd.r + e.r;
          const d = Math.hypot(dx, dz);
          if (d < min && d > 1e-4) { e.x += dx / d * (min - d); e.z += dz / d * (min - d); }
        }
        for (const t of S.towers) {
          const dx = e.x - t.x, dz = e.z - t.z, min = .55 + e.r;
          const d = Math.hypot(dx, dz);
          if (d < min && d > 1e-4) { e.x += dx / d * (min - d); e.z += dz / d * (min - d); }
        }
        const nx0 = e.x, nz0 = e.z + 6, minN = .8 + e.r;
        const dn = Math.hypot(nx0, nz0);
        if (dn < minN && dn > 1e-4) { e.x += nx0 / dn * (minN - dn); e.z += nz0 / dn * (minN - dn); }
      }
      // 地面怪两两斥力：不再叠成一列（空中单位互不干扰）
      for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i]; if (a.dead || a.fly) continue;
        for (let j = i + 1; j < enemies.length; j++) {
          const bo = enemies[j]; if (bo.dead || bo.fly) continue;
          let dx = a.x - bo.x, dz = a.z - bo.z;
          let d = Math.hypot(dx, dz);
          const min = (a.r + bo.r) * .95;
          if (d > min) continue;
          if (d < 1e-4) { dx = .3 + .11 * i; dz = .25 + .07 * j; d = Math.hypot(dx, dz); }
          const push = (min - d) * .5;
          a.x += dx / d * push; a.z += dz / d * push;
          bo.x -= dx / d * push; bo.z -= dz / d * push;
          a.view.position.x = a.x; a.view.position.z = a.z;
          bo.view.position.x = bo.x; bo.view.position.z = bo.z;
        }
      }
      for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    }

    /* ---- 塔开火 ------------------------------------------------------------- */
    function nearestEnemy(x, z, r) { let best = null, bd = r * r; for (const e of enemies) { if (e.dead || e.stealthOn) continue; const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } } return best; }
    function auraBuff(t) {
      let b = 1;
      for (const a of S.towers) {
        if (a === t) continue;
        const k = DATA.TOWERS[a.id].kind;
        if (k === 'auraDmg' && dist2(t.x, t.z, a.x, a.z) < (towerRange(a) || 5.5) ** 2) b *= 1.3;
      }
      return b;
    }
    function rateBuff(t) {
      let b = 1;
      for (const a of S.towers) {
        if (a === t) continue;
        if (DATA.TOWERS[a.id].kind === 'auraRate' && dist2(t.x, t.z, a.x, a.z) < (towerRange(a) || 5.5) ** 2) b *= 1.2;
      }
      return b;
    }
    function aoe(x, z, r, dmg, opts) {
      for (const e of enemies) if (!e.dead && dist2(x, z, e.x, e.z) < r * r) damageEnemy(e, dmg, opts);
      ringAt(x, z, (opts && opts.tint) || 0xff7a2f);
    }
    function fireTower(t, gdt) {
      const def = DATA.TOWERS[t.id];
      const range = towerRange(t), dmg = towerDmg(t);
      const e = nearestEnemy(t.x, t.z, range + (def.kind === 'gen' ? 0 : .5));
      if (def.kind === 'gen') {
        t.cd -= gdt;
        if (t.cd <= 0) { t.cd = 1 / towerRate(t); addSpirit(2 + t.lv * 1.2); fx.shots.spawn(new THREE.Vector3(t.x, 1.5, t.z), { ttl: .5, vel: [0, 1.2, 0] }); }
        return;
      }
      if (!e) return;
      if (t.view.userData.crest) { const a = Math.atan2(e.x - t.x, e.z - t.z); t.view.userData.crest.rotation.y = dampAngle(t.view.userData.crest.rotation.y, a, 8, gdt); }
      switch (def.kind) {
        case 'shot': case 'cannon': case 'multi': case 'economy': {
          if (dist2(t.x, t.z, e.x, e.z) > range ** 2) return;
          t.cd -= gdt * rateBuff(t); if (t.cd > 0) return;
          t.cd = 1 / towerRate(t);
          fx.shots.spawn(new THREE.Vector3(t.x, 1.15, t.z), { ttl: .1, scale: 2.6, tint: 0xffffff });
          fx.beam(t.x, 1.15, t.z, e.x, .7, e.z, { color: def.color, width: def.kind === 'cannon' ? .26 : .16, ttl: .18 });
          if (def.kind === 'multi') { for (let k2 = 0; k2 < 3; k2++) { const alt = nearestEnemy(t.x, t.z, range) || e; damageEnemy(alt, dmg * auraBuff(t), { tint: def.color, src: def }); } }
          else damageEnemy(e, dmg * auraBuff(t), { tint: def.color, src: def.kind === 'economy' ? 'kill' : def.el === 'true' ? 'true' : def });
          if (def.shred) e.shred = Math.min(3, (e.shred || 0) + 1);
          if (def.freeze && Math.random() < def.freeze * (e.tags.indexOf('fire') >= 0 ? 2 : 1)) e.stunT = Math.max(e.stunT, 2);
          if (def.slow) e.slowT = Math.max(e.slowT || 0, 1.4);
          if (def.burn) e.burnT = Math.max(e.burnT, 3);
          if (def.knock) e.t = Math.max(0, e.t - def.knock / (e.lane.len || 40));
          if (def.splash) aoe(e.x, e.z, def.splash + t.lv * .25, dmg * .55 * auraBuff(t), { tint: def.color, src: def });
          Sound.play(def.kind === 'cannon' ? 'cannon' : 'shoot');
          break;
        }
        case 'trap': {
          t.cd -= gdt; if (t.cd > 0 || dist2(t.x, t.z, e.x, e.z) > range ** 2) return;
          t.cd = 1 / towerRate(t);
          aoe(t.x, t.z, def.splash + t.lv * .35, dmg * auraBuff(t), { tint: def.color, src: def });
          Sound.play('cannon');
          break;
        }
        case 'melee': {
          t.cd -= gdt; if (t.cd > 0 || dist2(t.x, t.z, e.x, e.z) > range ** 2) return;
          t.cd = 1 / towerRate(t);
          damageEnemy(e, dmg * auraBuff(t), { tint: def.color, src: def.el === 'true' ? 'true' : def });
          t.view.rotation.z = .22; setTimeout(() => { t.view.rotation.z = 0; }, 110);
          Sound.play('hit');
          break;
        }
        case 'aura': {
          if (dist2(t.x, t.z, e.x, e.z) > range ** 2) return;
          t.cd -= gdt; if (t.cd > 0) return; t.cd = 1 / towerRate(t);
          for (const m of enemies) {
            if (m.dead || dist2(t.x, t.z, m.x, m.z) > range ** 2) continue;
            if (def.slow) m.slowT = 1.4;
            if (def.stun) m.stunT = Math.max(m.stunT, def.stun);
            damageEnemy(m, dmg * auraBuff(t), { tint: def.color, src: def });
          }
          break;
        }
        case 'chain': {
          t.cd -= gdt; if (t.cd > 0 || dist2(t.x, t.z, e.x, e.z) > range ** 2) return;
          t.cd = 1 / towerRate(t);
          let src = { x: t.x, z: t.z }; const hitSet = new Set();
          let cur = e, d = dmg;
          for (let j = 0; j < def.arcs + Math.floor(t.lv / 2) && cur; j++) {
            hitSet.add(cur);
            fx.beam(src.x, 1.2, src.z, cur.x, .8, cur.z, { color: def.color, width: .1, ttl: .22 });
            damageEnemy(cur, d * auraBuff(t), { tint: def.color, src: def });
            src = cur; d *= .72;
            cur = null;
            for (const m of enemies) { if (!m.dead && !hitSet.has(m) && dist2(src.x, src.z, m.x, m.z) < 36) { cur = m; break; } }
          }
          Sound.play('zap');
          break;
        }
        case 'beam': {
          if (dist2(t.x, t.z, e.x, e.z) > range ** 2) return;
          damageEnemy(e, dmg * gdt * 4.2 * auraBuff(t), { tint: def.color, src: def });
          fx.beam(t.x, 1.3, t.z, e.x, .75, e.z, { color: def.color, width: .2, ttl: .1 });
          break;
        }
      }
    }

    /* ---- 玩家动作 ------------------------------------------------------------ */
    function npcTick(dt) {
      const q = window.PRDSYS && window.PRDSYS.Q();
      for (const r of riceViews) {
        if (r.got) continue;
        r.view.rotation.y += dt * 1.2; r.view.position.y = Math.sin(S.time01 * 40 + r.x) * .05;
        if (dist2(P.x, P.z, r.x, r.z) < 1.5) {
          r.got = true; r.view.visible = false;
          if (q) { if (!q.gotR) q.gotR = {}; q.gotR[level.def.id + ':' + r.view.userData.i] = 1; window.PRDSYS.fire('rice', 1); }
          Sound.play('coin'); ringAt(r.x, r.z, 0xffd76a); ui.toast('🌾 拾得金稻穗（' + (q ? q.rice : '?') + '/36）');
        }
      }
      let best = null, bd = 2.4 * 2.4;
      for (const n of npcs) { const d = dist2(P.x, P.z, n.x, n.z); if (d < bd) { bd = d; best = n; } }
      const k = best ? best.kind : null;
      if (k !== nearNpc) { nearNpc = k; if (ui.npcNear) ui.npcNear(k); }
    }
    function handleNpc(kind) {
      useCd = .4;
      if (kind === 'blacksmith') { ui.openPanel('build'); return; }
      if (kind === 'hawker') { ui.openPanel('shop'); return; }
      if (window.PRDSYS && ui.sayBubble) ui.sayBubble(kind, window.PRDSYS.npcSay(kind));
    }
    function act(aimX, aimY) {
      if (ui.state() !== 'playing' || useCd > 0 || S.dead) return;
      if (nearNpc && aimX === undefined) { handleNpc(nearNpc); return; }
      const m = ui.mode;
      const pt = (aimX !== undefined ? groundPick(aimX, aimY) : null) || aimPoint(); if (!pt) return;
      if (m === 'weapon' && aimX === undefined && upgradeBuilding(pt)) return;
      if (m === 'build') {
        if (ui.buildKind === 'building') return void (placeBuilding(ui.currentBuilding, pt.x, pt.z) && (useCd = .3));
        return void (placeTower(ui.currentTower, pt.x, pt.z) && (useCd = .3));
      }
      if (m === 'upgrade') { const t = nearestTowerAt(pt); if (t) upgradeTower(t); return; }
      if (m === 'sell') { const t = nearestTowerAt(pt); if (t) { sellTower(t); return; } const bb = nearestBuildingAt(pt); if (bb) sellBuilding(bb); return; }
      if (m === 'till' || m === 'plant' || m === 'water' || m === 'harvest') {
        const p = nearestPlot(pt, 3.6);
        if (!p) { orderTo(pt.x, pt.z, null, null); Sound.play('ui'); return; }     // 空地：纯走过去
        if (Math.hypot(P.x - p.x, P.z - p.z) > 2.15) {
          if (p.locked) { Sound.play('deny'); ui.toast('这块田还没开垦 —— 商店「家园」里扩建'); return; }
          orderTo(p.x, p.z, m, p, ui.currentSeed); Sound.play('ui'); ui.toast('自动前往 · ' + ({ till: '刨地', plant: '播种', water: '浇水', harvest: '收割' })[m]); return;
        }
        if (p.locked) { Sound.play('deny'); ui.toast('这块田还没开垦 —— 商店「家园」里扩建'); return; }
        if (m === 'till') return void (till(pt) && (useCd = .32));
        if (m === 'plant') return void (plant(pt) && (useCd = .28));
        if (m === 'water') return void (waterCrop(pt) && (useCd = .26));
        return void (harvest(pt) && (useCd = .26));
      }
      if (m === 'weapon') {
        const id = weaponId();
        const w = DATA.WEAPONS[id];
        const lv = S.weapons[id] || 1;
        const dmg = w.dmg * (1 + (lv - 1) * .5) * realmv().dmg;
        swing();
        if (w.kind === 'melee') {
          const pa = Math.atan2(Math.sin(P.camYaw), Math.cos(P.camYaw));
          let hitN = 0;
          for (const e of enemies) {
            if (e.dead) continue;
            const dd = Math.hypot(e.x - P.x, e.z - P.z);
            if (dd > w.range + e.r + .4) continue;
            const a = Math.atan2(e.x - P.x, e.z - P.z);
            let dA = Math.abs(a - pa); if (dA > Math.PI) dA = TAU - dA;
            if (dA < (w.arc * Math.PI / 180) / 2) { damageEnemy(e, dmg, 0xffe27a); hitN++; }
          }
          if (!hitN) Sound.play('swing');
          useCd = 1 / w.rate;
        } else {
          const aim = enemies.find((e) => !e.dead && !e.stealthOn && Math.hypot(e.x - P.x, e.z - P.z) < w.range)
            || { x: pt.x, z: pt.z };
          fx.beam(P.x, 1.15, P.z, aim.x, .75, aim.z, { color: w.kind === 'spray' ? 0xff8a2f : 0x8ff0d8, width: .22, ttl: .24 });
          const hitE = enemies.find((e) => !e.dead && Math.hypot(e.x - aim.x, e.z - aim.z) < 1.1);
          if (hitE) damageEnemy(hitE, dmg, 0x8fd4f2);
          else if (w.kind === 'spray') aoe(aim.x, aim.z, 2.6, dmg * .6, 0xff7a2f);
          else aoe(aim.x, aim.z, .8, dmg * .4, 0x8fd4f2);
          Sound.play(w.kind === 'spray' ? 'cannon' : 'shoot');
          useCd = 1 / w.rate;
        }
      }
    }
    function orderNavAt(gp) {                                  // 触屏点对应物下指令
      const m = ui.mode;
      if (m === 'till' || m === 'plant' || m === 'water' || m === 'harvest') {
        const p = nearestPlot(gp, 3.6);
        if (p) {
          if (p.locked) { Sound.play('deny'); ui.toast('这块田还没开垦 —— 商店「家园」里扩建'); return; }
          if (Math.hypot(P.x - p.x, P.z - p.z) > 2.15) { orderTo(p.x, p.z, m, p, ui.currentSeed); Sound.play('ui'); return; }
          const pt = { x: p.x, z: p.z };
          if (m === 'plant') ui.currentSeed = ui.currentSeed;
          if (m === 'till') till(pt); else if (m === 'plant') plant(pt); else if (m === 'water') waterCrop(pt); else harvest(pt);
          return;
        }
      }
      orderTo(gp.x, gp.z, null, null);
    }
    function upgradeBuilding(pt) {
      const b = nearestBuildingAt(pt, 2.2); if (!b) return false;
      const bd = DATA.BUILDINGS[b.id]; b.lvl = b.lvl || 1;
      if (b.lvl >= 3) { Sound.play('deny'); ui.toast(bd.name + ' 已满级 Lv3'); return true; }
      const cost = Math.round(bd.cost * b.lvl * 1.6);
      if (S.money < cost) { Sound.play('deny'); ui.toast('升级需 ' + cost + ' 灵石'); return true; }
      S.money -= cost; b.lvl++; if (b.view) b.view.scale.setScalar(1 + (b.lvl - 1) * .14);
      Sound.play('upgrade'); ui.toast(bd.name + ' 升到 Lv' + b.lvl); ui.syncTop(); save(); return true;
    }
    function returnToPlow() {
      const def = DATA.LEVELS[S.levelIdx];
      if (!(def.final && S.cleared.includes(def.id))) { Sound.play('deny'); ui.toast('先守完八章'); return false; }
      S.endedB = true;
      if (window.PRDSYS) { window.PRDSYS.Q().title = '归锄'; }
      S.money += 2000; save(); ui.ending(); return true;
    }
    function interact() {
      if (ui.state() !== 'playing') return;
      if (Math.hypot(P.x, P.z + 6) < 3.4) {   // 阵眼祈愿：灵石 → 灵能
        if (S.money >= 30) { S.money -= 30; addSpirit(25); Sound.play('coin'); ui.toast('以灵石 30 祈得灵能 25'); }
        else { Sound.play('deny'); ui.toast('灵石不足'); }
        ui.syncTop(); save(); return;
      }
      const pt = aimPoint();
      if (pt) harvest(pt);
    }
    function swing() { P.swing = 0; }

    function hurtPlayer(dmg) {
      if (P.invuln > 0 || P.shieldT > 0 || S.dead) return;
      S.hp -= Math.max(1, Math.ceil(dmg / (2 + S.realm)));
      P.invuln = 1.4; Sound.play('hurt'); ui.syncTop();
      if (S.hp <= 0) {
        S.hp = S.hpMax;
        P.x = 0; P.z = 8;
        S.money = Math.max(0, S.money - Math.ceil(S.money * .08));
        ui.toast('元气大伤，被灵田阵眼的金光拽了回来');
        Sound.play('error'); ui.syncTop(); save();
      }
    }

    /* ---- 特效小助手 ---------------------------------------------------------- */
    function puffAt(x, y, z) { for (let i = 0; i < 3; i++) fx.puffs.spawn(new THREE.Vector3(x + (Math.random() - .5) * .5, y, z + (Math.random() - .5) * .5), { ttl: .5, scale: .8, vel: [(Math.random() - .5) * 1.5, 1.8, (Math.random() - .5) * 1.5] }); }
    function ringAt(x, z, color) { fx.rings.spawn(new THREE.Vector3(x, .36, z), { ttl: .45, tint: color !== undefined ? color : 0xffd23c }); }

    /* ---- 波次导演 ------------------------------------------------------------- */
    function waveTick(dt) {
      if (S.dead) return;
      const def = DATA.LEVELS[S.levelIdx];
      if (S.intermission > 0) {
        S.intermission -= dt;
        ui.syncClock();
        if (S.intermission <= 0) { S.wave++; startWave(); }
        return;
      }
      if (!S.waveActive) return;
      if (waveState === 'spawn') {
        spawnT -= dt;
        if (spawnT <= 0 && spawnQueue.length && enemies.length < 30) { spawnT = Math.max(.3, 1.15 - S.levelIdx * .07); spawnEnemy(spawnQueue.shift()); }
        if (!spawnQueue.length) waveState = 'fight';
      } else if (waveState === 'fight') {
        if (enemies.length === 0) {
          S.waveActive = false; waveState = 'idle';
          addSpirit(25 + S.levelIdx * 5);
          S.nexusHp = Math.min(S.nexusMax, S.nexusHp + 40 + S.levelIdx * 30);
          if (S.wave >= def.waves) return clearLevel();
          S.intermission = DATA.gapFor(S.wave + 1, S.diff);
          ui.toast('波次肃清！趁休整种地、建塔、去丹炉');
          Sound.intensity(.18); save();
        }
      }
    }
    function clearLevel() {
      const def = DATA.LEVELS[S.levelIdx];
      { const q = window.PRDSYS && window.PRDSYS.Q(); if (q && def.boss) { if (!q.marks) q.marks = {}; const mk = 'i:' + def.id; if (!q.marks[mk]) { q.marks[mk] = 1; q.insc = (q.insc || 0) + 1; ui.toast('🪨 拾得稷神铭文（' + q.insc + '/8）'); } } }
      S.money += def.reward; addSpirit(100); S.nexusHp = Math.min(S.nexusMax, S.nexusHp + 120 + S.levelIdx * 80); gainXp(def.boss ? 420 : 160);
      const dk = def.id + ':' + (S.diff || 0);
      (window.PRDSYS && window.PRDSYS.fire('clear', 1, def.id)); if (S.diff === 1) (window.PRDSYS && window.PRDSYS.fire('hardClear', 1)); if (S.diff === 2) (window.PRDSYS && window.PRDSYS.fire('nightClear', 1));
      if (!S.cleared.includes(def.id)) S.cleared.push(def.id);
      if (!S.diffCleared.includes(dk)) S.diffCleared.push(dk);
      S.dead = false;
      ui.levelClear(def);
      Sound.play('quest'); Sound.intensity(.2);
      save();
    }
    function lose(reason) {
      S.dead = true; S.waveActive = false; waveState = 'idle';
      ui.gameOver(reason, DATA.LEVELS[S.levelIdx]);
      Sound.play('error');
    }
    /** 重开本章（保留境界/财富，重置战场） */
    function retry() {
      G.restartLevel();
    }
    /** 下一章 */
    function advance() {
      if (S.levelIdx >= DATA.LEVELS.length - 1) return;
      G.nextLevel();
    }

    /* ---- 时间与环境 ------------------------------------------------------------ */
    function updateEnv(dt) {
      const prev = time01;
      time01 = (time01 + dt / DAY_SECONDS) % 1;
      const sunEl = Math.sin(time01 * TAU - Math.PI / 2);
      world.setDaylight(clamp(sunEl * .5 + .5, 0, 1));
      updateCrops(((time01 - prev + 1) % 1) * 24);
      if (Math.floor(time01 * 24) !== Math.floor(prev * 24)) for (const w of S.buildings) {
        if (w.id !== 'well') continue;
        const wr = (4 + 1.2 * ((w.lvl || 1) - 1)) ** 2;
        for (const p2 of level.plots) if (p2.tilled && dist2(p2.x, p2.z, w.x, w.z) < wr) { p2.moisture = Math.max(p2.moisture, 2.5); level.setSoil(p2, { color: 0x71503a }); }
      }
    }

    /* ---- 主更新 ----------------------------------------------------------------- */
    function update(dt) {
      const gdt = Math.min(dt, .05) * S.speed;
      useCd = Math.max(0, useCd - gdt);
      P.invuln = Math.max(0, P.invuln - gdt);
      P.shieldT = Math.max(0, P.shieldT - gdt);
      P.speedT = Math.max(0, P.speedT - gdt);

      let mx = 0, mz = 0;
      if (keys.KeyW || keys.ArrowUp) mz -= 1;
      if (keys.KeyS || keys.ArrowDown) mz += 1;
      if (keys.KeyA || keys.ArrowLeft) mx -= 1;
      if (keys.KeyD || keys.ArrowRight) mx += 1;
      if (touch.moveId >= 0) { mx = clamp((touch.mx - touch.ax) / 50, -1, 1); mz = clamp((touch.my - touch.ay) / 50, -1, 1); }
      const run = keys.ShiftLeft || keys.ShiftRight ? 1.5 : 1;
      let dirx = 0, dirz = 0;
      if (mx || mz) {
        nav.active = false;                                   // 手动接管即取消指令
        const len = Math.hypot(mx, mz); mx /= len; mz /= len;
        const mv = mapMove(P.camYaw, -mz, mx); dirx = mv.x; dirz = mv.z;   // 唯一事实源：W=屏幕深处(+fwd)，D=屏幕右
      } else if (nav.active) {
        const d = Math.hypot(nav.tx - P.x, nav.tz - P.z);
        if (d < .4) { nav.active = false; runNavOrder(); }
        else { const st = steerTo(nav.tx, nav.tz); dirx = st.x; dirz = st.z; }
      } else { P.vx *= .0002; P.vz *= .0002; }
      if (dirx || dirz) { P.vx = dirx * playerSpeed() * run; P.vz = dirz * playerSpeed() * run; }
      nav.marker.visible = nav.active;
      if (nav.active) { nav.marker.position.set(nav.tx, .5 + Math.sin(performance.now() / 260) * .05, nav.tz); nav.marker.rotation.z += dt * 2.2; }
      const gh = groundH(P.x, P.z);
      if (P.jumpQ) { if (P.py <= gh + .02) { P.vy = 4.6; Sound.play('ui'); } P.jumpQ = false; }
      if (P.py > gh + 1e-3 || P.vy > 0) {
        P.vy -= 13 * gdt; P.py += P.vy * gdt;
        const g2 = groundH(P.x, P.z);
        if (P.py <= g2 && P.vy < 0) { P.py = g2; P.vy = 0; }
      } else P.py = gh;
      const air = P.py > groundH(P.x + P.vx * gdt, P.z + P.vz * gdt) + .32;
      const [nx, nz] = collide(P.x + P.vx * gdt, P.z + P.vz * gdt, .42, air);
      const moved = Math.hypot(nx - P.x, nz - P.z);
      P.x = nx; P.z = nz;
      P.walk += moved * 2.2;

      hero.position.set(P.x, .28 + P.py, P.z);
      const tgt = nearestEnemy(P.x, P.z, 7);
      const faceYaw = moved > .002 ? Math.atan2(P.vx, P.vz) : tgt ? Math.atan2(tgt.x - P.x, tgt.z - P.z) : hero.rotation.y;
      hero.rotation.y = dampAngle(hero.rotation.y, faceYaw, 12, dt);
      const legs = hero.userData.legs, arms = hero.userData.arms;
      const amp = moved > .001 ? .55 : 0;
      for (let i = 0; i < 2; i++) { legs[i].rotation.x = Math.sin(P.walk * 4 + i * Math.PI) * amp; arms[i].rotation.x = -legs[i].rotation.x * .8; }
      hero.userData.body.position.y = Math.abs(Math.sin(P.walk * 4)) * (amp > 0 ? .05 : 0);
      if (P.swing >= 0) { P.swing += dt * 7; const k = Math.sin(Math.min(1, P.swing) * Math.PI); hero.userData.arms[1].rotation.x = -k * 1.9; if (P.swing >= 1) { P.swing = -1; hero.userData.arms[1].rotation.x = 0; } }
      hero.visible = P.invuln <= 0 || Math.floor(P.invuln * 12) % 2 === 0;
      syncHold();
      const blink = ((NJ.time ? NJ.time.t : performance.now() / 1000) % 3.4) < .14 ? .12 : 1;
      if (hero.userData.eyeL) { hero.userData.eyeL.scale.y = blink; hero.userData.eyeR.scale.y = blink; }

      // 山门通行检测
      travelCd = Math.max(0, travelCd - dt); hintCd = Math.max(0, hintCd - dt);
      const gs = gateStates();
      if (travelCd <= 0 && !ui.anyPanel()) {
        if (Math.hypot(P.x, P.z - fwdZ) < 1.5) {
          if (gs.canFwd) { travelCd = 4; G.travelTo(S.levelIdx + 1); }
          else if (hintCd <= 0) { hintCd = 4; Sound.play('deny'); ui.toast('山门紧闭 —— 先守住本章 ' + DATA.LEVELS[S.levelIdx].waves + ' 波'); }
        } else if (gs.canBack && Math.hypot(P.x, P.z - backZ) < 1.5) { travelCd = 4; G.travelTo(S.levelIdx - 1); }
      }

      homeT += gdt;
      if (homeT >= 1) {
        const lamps = S.buildings.reduce((a, b) => a + (b.id === 'lamp' ? 1 : 0), 0);
        if (lamps) addSpirit(.5 * lamps);
        for (const bd of S.buildings) if (bd.id === 'shed') { bd.eggT = (bd.eggT || 0) + homeT; if (bd.eggT >= 60) { bd.eggT = 0; S.money += Math.round(25 * (bd.lvl || 1) * (hasBuilding('barn') ? 1.15 : 1)); fx.shots.spawn(new THREE.Vector3(bd.x, 1.1, bd.z), { ttl: .7, vel: [0, 1.6, 0], tint: 0xf6ead8 }); Sound.play('coin'); ui.syncTop(); save(); } }
        homeT = 0;
      }
      for (const t of S.towers) fireTower(t, gdt);
      updateEnemies(gdt);
      npcTick(gdt);
      waveTick(gdt);
      updateEnv(gdt);
      fx.update(gdt);
      level.crystal.rotation.y += dt * .8;
      level.halo.rotation.z += dt * .45;
      level.crystal.position.y = 1.3 + Math.sin(performance.now() / 650) * .09;
    }

    /* ---- 相机（三视角统一阻尼） -------------------------------------------------- */
    const camLook = new THREE.Vector3(0, 1, 0);
    function updateCamera(dt) {
      const k = 1 - Math.exp(-7 * dt);
      if (P.camMode === 0) {
        const d = clamp(P.camDist, 3.5, 26);
        const el = clamp(.62 + P.pitch * .9, .12, 1.45);   // 轨道仰角：7°~83°
        const tx = P.x - Math.sin(P.camYaw) * d * Math.cos(el), tz = P.z - Math.cos(P.camYaw) * d * Math.cos(el);
        camera.position.lerp({ x: tx, y: .9 + d * Math.sin(el), z: tz }, k);
        camLook.lerp({ x: P.x, y: .9, z: P.z - 1.4 }, k);
      } else if (P.camMode === 1) {
        const d = clamp(P.camDist, 10, 34);
        const el = clamp(1.16 + P.pitch * .22, .8, 1.5);
        camera.position.lerp({ x: P.x - Math.sin(P.camYaw) * d * Math.cos(el), y: .9 + d * Math.sin(el), z: P.z - Math.cos(P.camYaw) * d * Math.cos(el) }, k);
        camLook.lerp({ x: P.x, y: 0, z: P.z - 1 }, k);
      } else {
        camera.position.lerp({ x: P.x - Math.sin(P.camYaw) * .3, y: 1.5, z: P.z - Math.cos(P.camYaw) * .3 }, 1 - Math.exp(-16 * dt));
        camLook.set(P.x + Math.sin(P.camYaw) * 6, 1.45 + P.pitch * 6, P.z + Math.cos(P.camYaw) * 6);
      }
      camera.lookAt(camLook);
      const fovWant = P.camMode === 2 ? 68 : P.camMode === 1 ? 52 : 55;
      camera.fov = damp(camera.fov, fovWant, 6, dt);
      camera.updateProjectionMatrix();
    }

    /* ---- 存档 --------------------------------------------------------------------- */
    const SAVE_KEY = 'nj_save_v2';
    function snapshot() {
      const towers = S.towers.map((t) => ({ id: t.id, x: +t.x.toFixed(2), z: +t.z.toFixed(2), lv: t.lv }));
      const plots = level.plots.map((p) => ({ t: p.tilled ? 1 : 0, m: +p.moisture.toFixed(2), c: p.crop ? { y: p.crop.type, g: +p.crop.growth.toFixed(1) } : 0 }));
      return { v: 1, S: { ...S, towers, buildings: S.buildings.map((b) => ({ id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), lvl: b.lvl || 1 })) }, spirit, time01, px: +P.x.toFixed(2), pz: +P.z.toFixed(2), camYaw: +P.camYaw.toFixed(3), camMode: P.camMode, cw: ui.currentWeapon, cs: ui.currentSeed, ts: Date.now() };
    }
    function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); } catch { /* 无存储环境 */ } }
    function applyCarry(c) {
      if (!c || c.v !== 1) return;
      const st = c.S;
      S.realm = st.realm; S.xp = st.xp; S.money = st.money; S.spiritMax = st.spiritMax;
      S.inv = st.inv; S.seeds = st.seeds; S.harvest = st.harvest || {};
      S.weapons = st.weapons || { hoe: 1 };
      if (st.q) S.q = st.q;
      S.farm = st.farm || 16; level.unlockPlots(S.farm);
      for (const bd of (st.buildings || [])) { const g = Art.buildingMesh(bd.id); g.position.set(bd.x, .3, bd.z); scene.add(g); S.buildings.push({ id: bd.id, x: bd.x, z: bd.z, r: DATA.BUILDINGS[bd.id].r, view: g, eggT: 0, lvl: bd.lvl || 1 }); }
      S.kills = st.kills || 0; S.lost = st.lost || 0;
      S.levelIdx = st.levelIdx || 0;
      S.nexusHp = 500 + S.levelIdx * 400; S.nexusMax = S.nexusHp;
      S.hpMax = DATA.REALMS[S.realm].hp; S.hp = Math.min(st.hp || S.hpMax, S.hpMax);
      S.bag = st.bag || S.bag; S.speed = st.speed || 1; S.cleared = st.cleared || []; S.ascended = !!st.ascended;
      spirit = c.spirit; time01 = c.time01 ?? .28;
      P.x = c.px; P.z = c.pz; P.camYaw = c.camYaw ?? Math.PI; P.camMode = c.camMode ?? 0;
      ui.currentWeapon = c.cw || 'hoe'; ui.currentSeed = c.cs || 'cabbage';
      for (const t of (st.towers || [])) {
        const g = shd(Art.towerMesh(t.id)); g.position.set(t.x, .3, t.z); g.scale.setScalar(1 + (t.lv - 1) * .12); scene.add(g);
        S.towers.push({ id: t.id, x: t.x, z: t.z, lv: t.lv, cd: 0, hp: 220 + DATA.TOWERS[t.id].cost * 1.6, maxHp: 220 + DATA.TOWERS[t.id].cost * 1.6, view: g });
      }
      (c.plots || []).forEach((pd, i) => {
        const p = level.plots[i]; if (!p) return;
        p.tilled = !!pd.t; level.setSoil(p, { tilled: p.tilled, color: p.tilled ? 0xc29a6e : undefined }); p.moisture = pd.m || 0;
        if (pd.c && DATA.CROPS[pd.c.y]) { p.crop = { type: pd.c.y, growth: pd.c.g, seed: i + 1, stage: 0 }; p.view = null; reStage(p); }
      });
    }
    function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
    function readSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 1 ? s : null; } catch { return null; } }
    function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }
    function eraseSave() { clearSave(); }

    /* ---- 物品与商店 --------------------------------------------------------------- */
    function useItem(id) {
      if (!(S.bag[id] > 0)) { Sound.play('deny'); return false; }
      S.bag[id]--;
      const pt = aimPoint();
      switch (id) {
        case 'hpPot': S.hp = Math.min(S.hpMax, S.hp + 1); Sound.play('harvest'); break;
        case 'fertilizer':
          for (const p of level.plots) if (p.crop) { p.crop.growth += DATA.CROPS[p.crop.type].hours * .25; reStage(p); }
          Sound.play('water'); ui.toast('灵雨落下，全场作物催熟 25%'); break;
        case 'bomb': if (pt) { aoe(pt.x, pt.z, 3.6, 240, 0xff7a2f); Sound.play('cannon'); } break;
        case 'freeze': for (const e of enemies) e.stunT = Math.max(e.stunT, 3.2); Sound.play('freeze'); ui.toast('全场冻结 3 秒'); break;
        case 'smite': { const e = nearestEnemy(P.x, P.z, 16); if (e) { damageEnemy(e, 240 + S.realm * 80, 0xa9d8ff); fx.beam(e.x, 9, e.z, e.x, .5, e.z, { color: 0xbfe0ff, width: .5, ttl: .3 }); ringAt(e.x, e.z, 0xa9d8ff); } Sound.play('zap'); break; }
        case 'guard': P.shieldT = 6; Sound.play('upgrade'); ui.toast('金光咒：6 秒免伤'); break;
        case 'speed': P.speedT = 8; Sound.play('upgrade'); break;
        default: Sound.play('coin');
      }
      ui.syncInv(); save(); return true;
    }
    function buyItem(id) {
      const it = DATA.ITEMS[id]; if (!it) return false;
      if (S.money < it.price) { Sound.play('deny'); return false; }
      S.money -= it.price; S.bag[id] = (S.bag[id] || 0) + 1;
      Sound.play('coin'); ui.syncAll(); save(); return true;
    }
    function buySeed(type, n = 5) {
      const cost = DATA.CROPS[type].seed * n;
      if (S.money < cost) { Sound.play('deny'); return false; }
      S.money -= cost; S.seeds[type] = (S.seeds[type] || 0) + n;
      Sound.play('coin'); ui.syncAll(); save(); return true;
    }
    function buyWeapon(id) {
      const w = DATA.WEAPONS[id]; if (!w) return false;
      if (S.realm < w.unlock) { Sound.play('deny'); return false; }
      const lv = S.weapons[id];
      if (lv) {
        if (lv >= 5) return false;
        if (S.money < w.up * lv) { Sound.play('deny'); return false; }
        S.money -= w.up * lv; S.weapons[id]++; Sound.play('upgrade');
      } else {
        if (S.money < w.price) { Sound.play('deny'); return false; }
        S.money -= w.price; S.weapons[id] = 1; Sound.play('build');
      }
      ui.currentWeapon = id; ui.syncAll(); save(); return true;
    }
    function sellHarvest() {
      let v = 0;
      for (const k in S.harvest) v += S.harvest[k] * DATA.CROPS[k].price;
      let __u = 0; for (const k in S.harvest) __u += S.harvest[k];
      { const bn = S.buildings.find((bb) => bb.id === 'barn'); if (bn) v = Math.round(v * (1 + .1 * (bn.lvl || 1)) + .05); }
      if (v <= 0) { Sound.play('deny'); return 0; }
      S.money += v; S.harvest = {};
      (window.PRDSYS && window.PRDSYS.fire('sell', __u));
      Sound.play('coin'); ui.toast('收购入账 ' + v + ' 灵石'); ui.syncAll(); save(); return v;
    }
    function brewPill(realmId) {
      const pill = DATA.PILLS[realmId]; if (!pill) return false;
      if (S.money < pill.cost) { Sound.play('deny'); ui.toast('灵石不足'); return false; }
      for (const k in pill.mats) if ((S.inv[k] || 0) < pill.mats[k]) { Sound.play('deny'); ui.toast('缺材料：' + DATA.MATERIALS[k].name + '×' + pill.mats[k]); return false; }
      S.money -= pill.cost;
      for (const k in pill.mats) S.inv[k] -= pill.mats[k];
      S.inv['pill' + realmId] = (S.inv['pill' + realmId] || 0) + 1;
      Sound.play('build'); ui.toast('丹成！' + pill.name);
      (window.PRDSYS && window.PRDSYS.fire('pill', 1)); ui.syncAll(); save(); return true;
    }
    function doAction() { act(); }
    function dispose() {
      for (const n of npcs) scene.remove(n.view);
      for (const r of riceViews) scene.remove(r.view);
      for (const [t, ev, fn, opt] of listeners) t.removeEventListener(ev, fn, opt);
      listeners.length = 0;
      scene.remove(hero);
      scene.remove(gates);
      scene.remove(nav.marker);
      for (const t of S.towers) scene.remove(t.view);
      for (const b of S.buildings) scene.remove(b.view);
      S.buildings.length = 0;
      for (const e of enemies) { e.dead = true; scene.remove(e.view); }
      enemies.length = 0;
      S.towers.length = 0;
      for (const p of level.plots) if (p.view) { scene.remove(p.view); p.view = null; }
      for (const pool of [fx.shots, fx.puffs, fx.rings, fx.sparks]) pool.clear();
    }
    function ascend() {
      const def = DATA.LEVELS[S.levelIdx];
      if (def.final && S.cleared.includes(def.id)) { S.ascended = true; ui.ending(); save(); return true; }
      Sound.play('deny'); ui.toast('先守飞升天梯（第 8 章）'); return false;
    }

    return {
      S, P, hero, enemies, update, updateCamera, updateEnv, dispose,
      snapshot, save, applyCarry, hasSave, readSave, eraseSave,
      startWave, waveTick, clearLevel, lose, retry, advance, ascend,
      canPlace, placeTower, upgradeTower, sellTower, destroyTower, nearestTowerAt,
      canPlaceB, placeBuilding, nearestBuildingAt, sellBuilding, unlockNextFarm, hasBuilding, enhTower, replayDiff, towerDmg, towerRange, towerRate, upgradeBuilding, returnToPlow, npcs: () => npcs.map((n) => ({ kind: n.kind, x: n.x, z: n.z })), riceViews: () => riceViews.map((r) => ({ x: r.x, z: r.z, got: r.got })), tod(k) { time01 = clamp(k, 0, .999); updateEnv(.001); },
      groundPick, aimPoint, nearestPlot, act: doAction, interact, collide,
      probe: {
        moveDir: (yaw, fw, st) => mapMove(yaw, fw, st),
        levelInfo() {
          const nexus = level.solids.find((x) => x.nexus) || { x: 0, z: -6, r: 1.9 };
          return { trees: level.solids.filter((x) => x.solid && !x.nexus && x.r >= .4).map((x) => ({ x: x.x, z: x.z, r: x.r })), nexus: { x: nexus.x, z: nexus.z, r: nexus.r, solid: !!nexus.solid }, bounds: level.bounds, plots: level.plots.length };
        },
        clearEnemies() { for (const e of enemies) { e.dead = true; scene.remove(e.view); } enemies.length = 0; },
        enemySeparation() {
          const lane = level.lanes[0]; const q = lane.at(.55);
          for (let i = 0; i < 3; i++) {
            spawnEnemy({ id: 'sprout', hp: 5000, speedMul: 1 });
            const e = enemies[enemies.length - 1]; e.lane = lane; e.t = .55; e.x = q.x; e.z = q.z; e.stunT = 9;
          }
          for (let f = 0; f < 90; f++) updateEnemies(1 / 60);
          let mind = 1e9;
          for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) mind = Math.min(mind, Math.hypot(enemies[i].x - enemies[j].x, enemies[i].z - enemies[j].z));
          return mind === 1e9 ? 0 : mind;
        },
        heroTris() { let t = 0; hero.traverse((o) => { if (o.isMesh) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(t); },
        heroDetail() { let t = 0; hero.traverse((o) => { if (o.isMesh) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return { tris: Math.round(t), hold: !!hero.userData.hold, eyes: !!(hero.userData.eyeL && hero.userData.eyeR) }; },
        camSweep() {
          const mode0 = P.camMode, d0 = P.camDist, pi0 = P.pitch, px0 = P.x, pz0 = P.z;
          P.camMode = 0; P.camDist = 12; P.x = 0; P.z = 8;
          let minY = 1e9, maxY = -1e9, elevMin = 9, elevMax = -9;
          for (const pit of [P.pitLo !== undefined ? P.pitLo : -.5, P.pitHi !== undefined ? P.pitHi : .9, 0]) {
            P.pitch = pit;
            for (let i = 0; i < 120; i++) updateCamera(.05);
            const hy = camera.position.y - .8, hz = Math.hypot(camera.position.x - P.x, camera.position.z - P.z);
            const elev = Math.atan2(hy, Math.max(.5, hz));
            minY = Math.min(minY, camera.position.y); maxY = Math.max(maxY, camera.position.y);
            elevMin = Math.min(elevMin, elev); elevMax = Math.max(elevMax, elev);
          }
          P.camMode = mode0; P.camDist = d0; P.pitch = pi0; P.x = px0; P.z = pz0;
          for (let i = 0; i < 30; i++) updateCamera(.05);
          return { minY, maxY, elevMin, elevMax };
        },
      },
      spawnEnemy, damageEnemy, harvest, plant, till, waterCrop, hurtPlayer, reStage,
      orderTo, navState: () => nav.active, activeRegion: () => S.levelIdx,
      setTime01(v) { time01 = v; }, get time01() { return time01; },
      get spirit() { return spirit; }, get useCd() { return useCd; },
      addSpirit, spendSpirit, gainXp, breakthrough,
      useItem, buyItem, buySeed, buyWeapon, sellHarvest, brewPill,
      playerSpeed, realmv,
      state() {
        const def = DATA.LEVELS[S.levelIdx];
        return {
          realm: S.realm, xp: S.xp, money: S.money, spirit, spiritMax: S.spiritMax,
          hp: S.hp, hpMax: S.hpMax, inv: { ...S.inv }, seeds: { ...S.seeds }, harvest: { ...S.harvest }, bag: { ...S.bag },
          level: def.id, levelName: def.name, wave: S.wave, waves: def.waves,
          waveActive: S.waveActive, intermission: Math.ceil(Math.max(0, S.intermission)),
          nexusHp: Math.max(0, Math.round(S.nexusHp)), nexusMax: S.nexusMax,
          enemies: enemies.length, kills: S.kills, towers: S.towers.length,
          time01: +time01.toFixed(3), speed: S.speed, dead: S.dead, cleared: S.cleared.slice(),
          camMode: P.camMode, mode: ui.mode, ascended: S.ascended,
          towersList: S.towers.map((t) => ({ id: t.id, lv: t.lv, x: +t.x.toFixed(1), z: +t.z.toFixed(1) })),
          plots: level.plots.map((p) => ({ tilled: p.tilled, locked: !!p.locked, moisture: +p.moisture.toFixed(2), crop: p.crop ? { type: p.crop.type, stage: stageOf(p.crop), growth: +p.crop.growth.toFixed(1) } : null })),
        };
      },
    };
  }
  return { build };
})();
