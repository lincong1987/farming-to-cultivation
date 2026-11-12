/* 07-ui — HUD / 工具栏 / 建塔·丹炉·商店面板 / 章节卡与结算 / 标题与暂停。
   全部 DOM 由 JS 建进 #ui（沿袭《几猫港区》的 8 元素外壳）。 */
'use strict';

const UI = window.UI = (() => {

  const MODES = [
    { id: 'till', name: '刨地', icon: '⛏' },
    { id: 'plant', name: '播种', icon: '🌱' },
    { id: 'water', name: '浇水', icon: '💧' },
    { id: 'harvest', name: '收割', icon: '🌾' },
    { id: 'weapon', name: '武器', icon: '⚔' },
    { id: 'build', name: '布防', icon: '🏺' },
    { id: 'upgrade', name: '强化', icon: '▲' },
    { id: 'sell', name: '拆除', icon: '✕' },
  ];
  const MODE_HINT = {
    till: '左键锄向田垄，开垦一格',
    plant: '左键下种（Q 换种子，缺种自动花灵石买）',
    water: '左键浇水，水分足作物才长',
    harvest: '左键收割成熟的作物（E 也可）',
    weapon: '左键挥砍/施法，自动锁定准星附近的妖',
    build: '左键落塔（灵能支付）· Esc 退出布防',
    upgrade: '点击防御塔升级（灵能）',
    sell: '点击防御塔拆除，返还六成灵能',
  };

  function build(G) {
    const root = document.getElementById('ui');
    let scr = 'title';
    let mode = 'till', prevMode = 'till';
    let currentSeed = 'cabbage', currentWeapon = 'hoe', currentTower = 'pea';
    let buildKind = 'tower', currentBuilding = 'well';
    let diffPick = null;
    const ELN = { phys: '物理', fire: '火', ice: '冰', thunder: '雷', true: '真实', buff: '增益', eco: '经济' };
    const settings = loadSettings();
    let panelName = null;   // build|alchemy|shop
    let modalName = null;   // intro|clear|dead|end|pause|help

    /* ---------- DOM 骨架 ---------- */
    const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };

    const hud = el('div', 'hud');
    hud.innerHTML = `
      <div class="h-l">
        <div id="hearts" class="hearts"></div>
        <div class="realm-line"><span id="realm-badge" class="pill"></span><span id="xp-wrap" class="xp-wrap"><i id="xp-fill"></i><span id="xp-text"></span></span></div>
      </div>
      <div class="h-c">
        <div id="lvl-label" class="lvl-label"></div>
        <div id="nexus-wrap" class="nexus-wrap"><i id="nexus-fill"></i><span>灵田阵眼</span></div>
        <div id="wave-label" class="wave-label"></div>
      </div>
      <div class="h-r">
        <div class="res"><span class="res-k">灵石</span><b id="r-money">0</b></div>
        <div class="res"><span class="res-k">灵能</span><b id="r-spirit">0</b><span id="spirit-wrap" class="spirit-wrap"><i id="spirit-fill"></i></span></div>
        <div class="res"><span class="res-k" id="clock">辰时 ×1</span></div>
      </div>`;
    root.appendChild(hud);

    const modeHint = el('div', 'mode-hint'); root.appendChild(modeHint);

    const toolbar = el('div', 'toolbar');
    toolbar.innerHTML = MODES.map((m, i) => `<button class="slot" data-i="${i}" title="${m.name}"><kbd>${i + 1}</kbd><span class="ic">${m.icon}</span><span class="nm">${m.name}</span></button>`).join('');
    root.appendChild(toolbar);

    const subs = el('div', 'subs');
    subs.innerHTML = `<button class="chip" id="chip-seed">🌱 <b id="seed-name">白菜</b> ×<span id="seed-n">0</span> <kbd>Q</kbd></button>
      <button class="chip" id="chip-weapon">⚔ <b id="wp-name">老锄头</b> Lv<span id="wp-lv">1</span> <kbd>R</kbd></button>

      <span class="npc-hint hide" id="npc-hint"></span>
      <button class="chip hide" id="chip-tower">🏰 <b id="tower-name"></b> <span id="tower-cost"></span></button>`;
    root.appendChild(subs);

    const tipBar = el('div', 'tip-bar hide'); root.appendChild(tipBar);
    const side = el('div', 'side');
    side.innerHTML = `<button class="t-btn" id="btn-build">布防 <kbd>B</kbd></button>
      <button class="t-btn" id="btn-alchemy">丹炉 <kbd>G</kbd></button>
      <button class="t-btn" id="btn-shop">商店 <kbd>K</kbd></button>
      <button class="t-btn" id="btn-quest">任务 <kbd>J</kbd><i class="qbadge hide"></i></button>
      <button class="t-btn hide" id="btn-advance">⛰ 下一关</button>
      <button class="t-btn" id="btn-speed">⏩ <b id="speed-n">×1</b> <kbd>T</kbd></button>
      <button class="t-btn" id="btn-view">👁 视角 <kbd>C</kbd></button>
      <button class="t-btn" id="btn-pause">☰ <kbd>Esc</kbd></button>`;
    root.appendChild(side);

    const items = el('div', 'items'); root.appendChild(items);
    const toasts = el('div', 'toasts'); root.appendChild(toasts);
    const panelBox = el('div', 'panels'); root.appendChild(panelBox);
    const modalBox = el('div', 'modals'); root.appendChild(modalBox);
    const titleBox = el('div', 'title-screen'); root.appendChild(titleBox);

    /* ---------- 工具函数 ---------- */
    const sim = () => G.sim;
    const $ = (id) => document.getElementById(id);
    function loadSettings() { try { return Object.assign({ bgm: 1, sfx: 1 }, JSON.parse(localStorage.getItem('nj_set') || '{}')); } catch { return { bgm: 1, sfx: 1 }; } }
    function saveSettings() { try { localStorage.setItem('nj_set', JSON.stringify(settings)); } catch {} }

    let toastN = 0;
    function toast(msg) {
      const t = el('div', 'toast', msg);
      t.style.top = (136 + (toastN++ % 4) * 34) + 'px';
      toasts.appendChild(t);
      setTimeout(() => t.classList.add('out'), 2600);
      setTimeout(() => { t.remove(); toastN--; }, 3100);
    }
    window.__NJtoast = toast;

    function anyPanel() { return !!(panelName || modalName); }
    function closePanels() {
      let closed = false;
      if (panelName) { panelName = null; renderPanel(); closed = true; }
      if (mode === 'build' || mode === 'upgrade' || mode === 'sell') { setMode(prevMode); closed = true; }
      if (modalName === 'intro') { modalName = null; renderModal(); closed = true; }
      return closed;
    }

    /* ---------- 模式与选择 ---------- */
    function setMode(m) {
      if (m === 'build' || m === 'upgrade' || m === 'sell') { if (mode !== m) prevMode = mode === 'build' || mode === 'upgrade' || mode === 'sell' ? prevMode : mode; }
      mode = m;
      [...toolbar.querySelectorAll('.slot')].forEach((b, i) => b.classList.toggle('on', MODES[i].id === m));
      $('chip-tower').classList.toggle('hide', m !== 'build');
      if (m === 'build') {
        if (buildKind === 'building') { const t = DATA.BUILDINGS[currentBuilding]; $('tower-name').textContent = t.name; $('tower-cost').textContent = t.cost + ' 灵石'; }
        else { const t = DATA.TOWERS[currentTower]; $('tower-name').textContent = t.name; $('tower-cost').textContent = t.cost + ' 灵能'; }
      }
      modeHint.textContent = MODE_HINT[m] || '';
      modeHint.classList.toggle('show', m === 'build' || m === 'upgrade' || m === 'sell');
    }
    function selectTool(i) {
      const m = MODES[i]; if (!m) return;
      if (m.id === 'build' && !unlockedTowers().some((t) => t === currentTower)) { const u = unlockedTowers()[0]; if (u) currentTower = u; }
      setMode(m.id);
      Sound.play('ui'); syncInv();
      if (m.id === 'build') renderPanel(); // 打开布防面板供选择
    }
    const unlockedSeeds = () => DATA.CROP_IDS.filter((id) => sim().S.realm >= DATA.CROPS[id].unlock);
    const ownedWeapons = () => DATA.WEAPON_IDS.filter((id) => sim().S.weapons[id]);
    const unlockedTowers = () => DATA.TOWER_IDS;
    function cycleSeed() {
      const list = unlockedSeeds();
      let i = list.indexOf(currentSeed);
      currentSeed = list[(i + 1) % list.length];
      Sound.play('ui'); syncInv();
      toast('种子：' + DATA.CROPS[currentSeed].name);
    }
    function cycleWeapon() {
      const list = ownedWeapons();
      if (!list.length) return;
      let i = list.indexOf(currentWeapon);
      currentWeapon = list[(i + 1) % list.length];
      Sound.play('ui'); syncInv();
      toast('武器：' + DATA.WEAPONS[currentWeapon].name + ' Lv' + sim().S.weapons[currentWeapon]);
    }

    /* ---------- 面板：布防 / 丹炉 / 商店 ---------- */
    function openPanel(name) {
      if (scr !== 'playing') return;
      panelName = panelName === name ? null : name;
      if (panelName === 'build') { buildKind = 'tower'; prevMode = mode === 'build' ? prevMode : mode; setMode('build'); }
      Sound.play('ui'); renderPanel();
    }
    function renderPanel() {
      if (!panelName) { panelBox.innerHTML = ''; return; }
      const s = sim().S;
      let body = '';
      if (panelName === 'build') {
        body = `<h3>灵纹工坊 · 布防 <small>消耗灵能，塔位避开耕地与阵眼</small></h3><div class="cards">` +
          DATA.TOWER_IDS.map((id) => {
            const t = DATA.TOWERS[id];
            const locked = s.realm < t.unlock;
            return `<button class="b-card ${locked ? 'lock' : ''} ${currentTower === id ? 'sel' : ''}" data-t="${id}" style="border-left:5px solid ${DATA.Q_COLOR[t.q]}">
              <i class="dot" style="background:#${t.color.toString(16).padStart(6, '0')}"></i>
              <b>${t.name}</b><span class="qtag">${DATA.Q_NAMES[t.q]} · ${ELN[t.el] || ''}</span><span class="sub">${t.desc}</span>
              <span class="stat">${t.kind === 'gen' ? '产灵能' : '伤' + t.dmg + ' · 程' + t.range + ' · ' + t.rate.toFixed(1) + '/秒'}</span>
              <span class="cost">灵能 ${t.cost}</span>
              ${locked ? `<span class="locktag">境界「${DATA.REALMS[t.unlock].name}」解锁</span>` : ''}
            </button>`;
          }).join('') + `</div>
          <h3 class="mt">工坊淬炼 <small>局外永久 · 强化石+灵石，对该型号所有塔生效</small></h3><div class="cards mini">` +
          DATA.TOWER_IDS.map((id2) => {
            const t2 = DATA.TOWERS[id2]; const lv = s.enh[id2] || 0; const cap = DATA.ENH[t2.q].cap;
            const st2 = DATA.ENH[t2.q].stone(lv + 1), cn2 = DATA.ENH[t2.q].coin(lv + 1);
            return `<button class="b-card ${lv >= cap ? 'lock' : ''}" ${lv >= cap ? 'disabled' : `data-enh="${id2}"`} style="border-left:4px solid ${DATA.Q_COLOR[t2.q]}">
              <b>${t2.name}</b><span class="sub">淬 ${lv}/${cap} · 下级 伤+${Math.round(DATA.ENH[t2.q].dmg * 100)}% 速+${(DATA.ENH[t2.q].rate * 100).toFixed(1)}%</span>
              <span class="cost">石×${st2} 灵石×${cn2}${lv >= cap ? ' 已满' : ''}</span></button>`;
          }).join('') + `</div>`;
      } else if (panelName === 'alchemy') {
        const st = sim().state();
        const next = DATA.REALMS[s.realm + 1];
        body = `<h3>小药炉 · 炼丹 <small>材料来自击杀掉落，灵石来自卖菜</small></h3>
          <div class="mats">` + Object.keys(DATA.MATERIALS).map((k) => `<span>${DATA.MATERIALS[k].name} <b>${s.inv[k] || 0}</b></span>`).join('') +
          Object.keys(s.inv).filter((k) => String(k).startsWith('pill')).map((k) => `<span class="pilltag">${DATA.PILLS[+k.slice(4)].name} ×${s.inv[k]}</span>`).join('') + `</div>` +
          (next ? `<div class="brewrow"><div class="brewinfo"><b>下一境界：${next.name}</b><span>修为 ${st.xp}/${next.need}</span>${DATA.PILLS[next.id] ? `<span>需 ${DATA.PILLS[next.id].name}（${DATA.PILLS[next.id].cost}灵石 + ${Object.entries(DATA.PILLS[next.id].mats).map(([k, n]) => DATA.MATERIALS[k].name + '×' + n).join('、')}）</span>` : ''}</div>
            <div class="brewbtns">
              ${DATA.PILLS[next.id] ? `<button class="act" data-brew="${next.id}">炼制${DATA.PILLS[next.id].name}</button>` : ''}
              <button class="act gold" data-break>⚡ 突破${next.name}</button>
            </div></div>` : `<div class="brewrow"><div class="brewinfo"><b>已至大乘</b><span>守住飞升天梯即可白日飞升</span></div></div>`) +
          `<h3 class="mt">更远的境界</h3><div class="cards mini">` +
          DATA.REALMS.slice(s.realm + 2).map((r) => {
            const p = DATA.PILLS[r.id];
            return `<button class="b-card" ${p ? `data-brew="${r.id}"` : 'disabled'}><b>${r.name}</b><span class="sub">需修为 ${r.need}${p ? ' · ' + p.name + '（' + p.cost + '灵石 + ' + Object.entries(p.mats).map(([k, n]) => DATA.MATERIALS[k].name + '×' + n).join('、') + '）' : ''}</span></button>`;
          }).join('') + `</div>`;
      } else if (panelName === 'quest') {
        const P = window.PRDSYS; const qs = P ? P.questList() : null;
        if (!qs) { body = ''; }
        else {
          const stt = (x) => x.st === 'done' ? '<span class="qst ok">✓</span>' : x.st === 'lock' ? '<span class="qst lock">🔒</span>' : '<span class="qst">' + x.p + '</span>';
          const row = (x, extra) => '<div class="qrow ' + x.st + '"><b>' + x.name + '</b>' + stt(x) + '<span class="qgoal">' + x.goal + '</span><span class="qrew">' + P.rewardText(x.reward) + '</span>' + (extra || '') + '</div>';
          body = '<div class="qlist"><h3>稷下事务 <small>主线 ' + Math.min(16, sim().S.q ? sim().S.q.main : 0) + '/16 · 金稻穗 ' + (sim().S.q && sim().S.q.rice || 0) + '/36 · 信物 ' + (sim().S.q && sim().S.q.relic || 0) + '/4 · 铭文 ' + (sim().S.q && sim().S.q.insc || 0) + '/8</small></h3>'
            + '<h4 class="qsec">📜 主线</h4>' + qs.main.map((x) => row(x)).join('')
            + '<h4 class="qsec">🌿 支线</h4>' + qs.side.map((x) => row(x)).join('')
            + '<h4 class="qsec">☀ 今日日课</h4>' + qs.daily.map((x) => row(x, x.st === 'active' && parseFloat(x.p) >= x.need && !x.claimed ? '<button class="mini-claim" data-claim="' + x.id + '">领取</button>' : (x.claimed ? '<span class="qst ok">已领</span>' : ''))).join('')
            + '<h4 class="qsec">🏆 成就</h4>' + qs.achv.map((x) => row(x)).join('') + '</div>';
        }
      } else if (panelName === 'shop') {
        body = `<h3>村口收购站 <small>灵石是硬通货</small></h3>
          <div class="tabs"><button class="tab on" data-tab="seed">种子</button><button class="tab" data-tab="wp">武器</button><button class="tab" data-tab="it">消耗品</button><button class="tab" data-tab="home">家园</button><button class="tab" data-tab="out">出售</button></div>
          <div class="cards" id="shop-body"></div>`;
        panelBox.innerHTML = `<div class="panel" id="pn"><button class="x" data-close>✕</button>${body}</div>`;
        renderShopTab('seed');
        wirePanel();
        return;
      }
      panelBox.innerHTML = `<div class="panel" id="pn"><button class="x" data-close>✕</button>${body}</div>`;
      wirePanel();
    }
    let shopTab = 'seed';
    function renderShopTab(tab) {
      shopTab = tab || shopTab;
      [...panelBox.querySelectorAll('.tab')].forEach((b) => b.classList.toggle('on', b.dataset.tab === shopTab));
      const s = sim().S;
      const box = $('shop-body');
      if (!box) return;
      if (shopTab === 'seed') {
        box.innerHTML = DATA.CROP_IDS.map((id) => {
          const c = DATA.CROPS[id];
          const locked = s.realm < c.unlock;
          return `<button class="b-card ${locked ? 'lock' : ''}" ${locked ? 'disabled' : `data-seed="${id}"`}>
            <i class="dot" style="background:#${c.color.toString(16).padStart(6, '0')}"></i>
            <b>${c.name}</b><span class="sub">${c.hours}时熟 · 产${c.yield} · 卖${c.price} · ${c.cat}种</span>
            <span class="own">持有 ${s.seeds[id] || 0}</span><span class="cost">${c.seed * 5} 灵石 / 5 粒</span></button>`;
        }).join('');
      } else if (shopTab === 'wp') {
        box.innerHTML = DATA.WEAPON_IDS.map((id) => {
          const w = DATA.WEAPONS[id];
          const lv = s.weapons[id];
          const locked = !lv && s.realm < w.unlock;
          const cost = lv ? (lv >= 5 ? null : w.up * lv) : w.price;
          return `<button class="b-card ${locked ? 'lock' : ''} ${id === currentWeapon ? 'sel' : ''}" ${locked || cost == null ? 'disabled' : `data-wp="${id}"`}>
            <b>${w.name}</b><span class="sub">${w.kind === 'melee' ? '近战扇形' : '远程'} · 伤${w.dmg} · ${w.rate}/秒${lv ? ' · 已藏' : ''}</span>
            <span class="own">${lv ? 'Lv' + lv : '未拥有'}</span><span class="cost">${cost == null ? '已满级' : (lv ? '升级 ' : '购买 ') + cost + ' 灵石'}</span></button>`;
        }).join('');
      } else if (shopTab === 'it') {
        box.innerHTML = Object.keys(DATA.ITEMS).map((id) => {
          const it = DATA.ITEMS[id];
          return `<button class="b-card" ${it.price ? `data-item="${id}"` : 'disabled'}><b>${it.name}</b><span class="sub">${it.desc}</span><span class="own">持有 ${s.bag[id] || 0}</span>${it.price ? `<span class="cost">${it.price} 灵石</span>` : ''}</button>`;
        }).join('');
      } else if (shopTab === 'home') {
        const s0 = sim().S;
        const next = DATA.FARM_TIERS.find((t) => t.n > s0.farm);
        let h = '<div class="row"><b>灵田畦亩</b><span>已垦 ' + s0.farm + ' / ' + DATA.FARM_TIERS[DATA.FARM_TIERS.length - 1].n + ' 格</span>' +
          (next ? '<span>下一阶 ' + next.n + ' 格 · ' + next.cost + ' 灵石' + (next.realm ? ' · 需' + DATA.REALMS[next.realm].name : '') + '</span><button class="act" data-farm>开垦</button>' : '<span>已全部开垦</span>') + '</div>';
        h += '<div class="cards">' + Object.keys(DATA.BUILDINGS).map((id) => {
          const bd = DATA.BUILDINGS[id]; const locked = s0.realm < bd.realm; const have = s0.buildings.filter((b) => b.id === id).length;
          return '<button class="b-card ' + (locked ? 'lock' : '') + '" ' + (locked ? 'disabled' : 'data-bld="' + id + '"') + '><b>' + bd.name + '</b><span class="sub">' + bd.desc + '</span><span class="own">已建 ' + have + '</span><span class="cost">' + bd.cost + ' 灵石</span>' + (locked ? '<span class="locktag">境界「' + DATA.REALMS[bd.realm].name + '」解锁</span>' : '') + '</button>';
        }).join('') + '</div>';
        box.innerHTML = h;
      } else {
        const s2 = sim().state();
        const rows = Object.keys(s2.harvest).filter((k) => s2.harvest[k] > 0);
        box.innerHTML = (rows.length ? rows.map((k) => `<div class="row"><b>${DATA.CROPS[k].name}</b><span>×${s2.harvest[k]}</span><span>≈ ${s2.harvest[k] * DATA.CROPS[k].price} 灵石</span></div>`).join('') : '<div class="row dim">背篓空空，先收割些作物</div>')
          + `<div class="sellrow"><button class="act gold" data-sell>💰 全部出售</button><span class="hint">收下的作物随时可卖</span></div>`;
      }
    }
    function wirePanel() {
      panelBox.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => { panelName = null; renderPanel(); Sound.play('ui'); });
      if (panelName) panelBox.onclick = (e) => { if (e.target === panelBox) { panelName = null; panelBox.onclick = null; renderPanel(); Sound.play('ui'); } };
      panelBox.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
        if (b.classList.contains('lock')) { Sound.play('deny'); return; }
        currentTower = b.dataset.t; panelName = null; setMode('build'); renderPanel(); syncInv(); Sound.play('ui');
        toast('左键落地建塔 · Esc 退出布防');
      });
      panelBox.querySelectorAll('[data-brew]').forEach((b) => b.onclick = () => { sim().brewPill(+b.dataset.brew); renderPanel(); });
      panelBox.querySelectorAll?.('[data-claim]').forEach((b) => b.onclick = () => { if (window.PRDSYS.claimDaily(b.dataset.claim)) renderPanel(); });
      panelBox.querySelectorAll('[data-break]').forEach((b) => b.onclick = () => { sim().breakthrough(); renderPanel(); });
      panelBox.querySelectorAll('[data-enh]').forEach((b) => b.onclick = () => { if (sim().enhTower(b.dataset.enh)) renderPanel(); });
      panelBox.querySelectorAll('.tab').forEach((b) => b.onclick = () => { renderShopTab(b.dataset.tab); Sound.play('ui'); });
      panelBox.querySelectorAll('[data-seed]').forEach((b) => b.onclick = () => { if (!sim().buySeed(b.dataset.seed)) return; currentSeed = b.dataset.seed; renderPanel(); syncInv(); });
      panelBox.querySelectorAll('[data-wp]').forEach((b) => b.onclick = () => { sim().buyWeapon(b.dataset.wp); renderPanel(); syncInv(); });
      panelBox.querySelectorAll('[data-item]').forEach((b) => b.onclick = () => { sim().buyItem(b.dataset.item); renderPanel(); });
      panelBox.querySelectorAll('[data-sell]').forEach((b) => b.onclick = () => { sim().sellHarvest(); renderPanel(); });
      panelBox.querySelectorAll('[data-farm]').forEach((b) => b.onclick = () => { if (sim().unlockNextFarm()) renderPanel(); });
      panelBox.querySelectorAll('[data-bld]').forEach((b) => b.onclick = () => {
        currentBuilding = b.dataset.bld; buildKind = 'building'; panelName = null; renderPanel();
        prevMode = mode === 'build' ? prevMode : mode; setMode('build'); syncInv();
        Sound.play('ui'); toast('左键放置 ' + DATA.BUILDINGS[currentBuilding].name + '（灵石）· Esc 退出');
      });
    }

    /* ---------- 模态：章节卡 / 结算 / 失败 / 飞升 / 暂停 / 操作 ---------- */
    function renderModal() {
      if (!modalName) { modalBox.innerHTML = ''; return; }
      const s = sim();
      const st = s.state();
      const def = DATA.LEVELS[s.S.levelIdx];
      let h = '';
      if (modalName === 'talk') {
        h = '<div class="modal talk"><div class="tl">' + talkQueue[talkI] + '</div>'
          + '<div class="mbtns"><button class="go" data-tn>' + (talkI < talkQueue.length - 1 ? '继续 ▸' : '🌾 下田') + '</button><button class="ghost" data-ts>跳过</button></div></div>';
      } else if (modalName === 'intro') {
        const sD = sim().S; const dcur = diffPick == null ? sD.diff : diffPick;
        const ok1 = sD.cleared.includes(def.id), ok2 = sD.diffCleared.includes(def.id + ':1');
        const dtabs = DATA.DIFFS.map((dd, i) => {
          const en = i === 0 || (i === 1 && ok1) || (i === 2 && ok2);
          return `<button class="difftab ${dcur === i ? 'on' : ''} ${en ? '' : 'dis'}" data-dif="${i}" ${en ? '' : 'disabled'}>${dd.name}</button>`;
        }).join('');
        h = `<div class="modal intro"><div class="ch-num">第 ${def.id} 章 · ${def.name}</div><h2>区域试炼</h2>
          <p>${def.intro}</p>
          <p class="meta">共 ${def.waves} 波${def.boss ? ' · 波 5/10 精英 · 波 15 <b class="boss">⚑ ' + DATA.MONSTERS[def.boss].name + '</b>' : ''} · 守好灵田阵眼</p>
          <div class="difftabs">${dtabs}</div>
          <button class="go" data-ok>🌾 下田干活</button></div>`;
      } else if (modalName === 'clear') {
        const final = def.final;
        h = `<div class="modal clear"><div class="ch-num">第 ${def.id} 章告捷</div><h2>${def.name} · 守住了</h2>
          <div class="grid2">
            <span>章节酬劳</span><b>${def.reward} 灵石</b>
            <span>本章击杀</span><b>${s.S.kills}</b>
            <span>境界</span><b>${DATA.REALMS[s.S.realm].name}</b>
            <span>存折</span><b>${st.money} 灵石</b>
          </div>
          ${final ? `<p class="boss">天梯已通，飞升只在一念。</p>` : `<p>田间事未完：休整、建塔、炼丹，随时再战。</p>`}
          <div class="mbtns">
            ${final ? `<button class="go gold" data-ascend>☯ 白日飞升</button><button class="ghost" data-plow>🌾 归锄 · 另一种圆满</button>` : `<button class="go" data-next>⛰ 挑战下一章 · ${DATA.LEVELS[s.S.levelIdx + 1].name}</button>`}
            ${(s.S.diff === 0) ? `<button class="ghost" data-diff="1">⚔ 困难难度再战</button>` : (s.S.diff === 1 ? `<button class="ghost" data-diff="2">☠ 噩梦难度再战</button>` : '')}
            <button class="ghost" data-ok>🌱 留下继续种田</button>
          </div></div>`;
      } else if (modalName === 'dead') {
        h = `<div class="modal dead"><h2>道消一劫</h2><p>${st.wave > 0 ? '第 ' + st.wave + ' 波，' : ''}境界保住了，身外之物散了一半。</p>
          <p class="why">败因：${lastReason}</p>
          <div class="mbtns"><button class="go" data-retry>🔄 重整旗鼓（重打本章）</button><button class="ghost" data-home>回标题</button></div></div>`;
      } else if (modalName === 'end') {
        h = `<div class="modal end"><div class="ch-num">${s.S.endedB && !s.S.ascended ? '归锄' : '飞升'}</div><h2>陇上修真 · ${s.S.endedB && !s.S.ascended ? '归园田居' : '圆满'}</h2>
          <p>${s.S.endedB && !s.S.ascended ? '仙籍合上，锄头重新扛上肩。八区的稻都归了仓，婆婆的灶上温着饭。' : '三分薄地成了灵田万亩，豆兵妖藤尽化春泥。凡人笑我痴种，我自成仙。'}</p>
          <div class="grid2">
            <span>境界</span><b>${DATA.REALMS[s.S.realm].name}</b>
            <span>修为</span><b>${s.S.xp}</b>
            <span>身家</span><b>${st.money} 灵石</b>
            <span>斩妖</span><b>${s.S.kills}</b>
            <span>守塔</span><b>${s.S.towers.length} 座</b>
            <span>用时</span><b>${Math.floor((performance.now() - playStart) / 60000)} 分</b>
          </div>
          <div class="mbtns"><button class="go gold" data-home>🏠 回标题（进度已存）</button></div></div>`;
      } else if (modalName === 'pause') {
        h = `<div class="modal pause"><h2>歇口气</h2>
          <div class="mbtns col">
            <button class="go" data-resume>▶ 继续修行</button>
            <button class="ghost" data-save>💾 手动存档</button>
            <div class="volrow"><span>音乐</span><input id="vol-bgm" type="range" min="0" max="1" step="0.05" value="${settings.bgm}"><span>音效</span><input id="vol-sfx" type="range" min="0" max="1" step="0.05" value="${settings.sfx}"></div>
            <button class="ghost" data-home>🏠 回标题（自动存档）</button>
          </div></div>`;
      } else if (modalName === 'help') {
        h = `<div class="modal help"><h2>怎么种怎么打</h2>
          <div class="hk">
            <span><kbd>W A S D</kbd> 移动 · <kbd>Shift</kbd> 跑</span>
            <span><kbd>左键 / F</kbd> 干活 · <kbd>空格</kbd> 跳跃（能跳过自家塔位）</span>
            <span><kbd>1-8</kbd> 刨地 播种 浇水 收割 武器 布防 强化 拆除</span>
            <span><kbd>Q</kbd> 换种子 · <kbd>R</kbd> 换武器 · <kbd>E</kbd> 阵眼祈愿（灵石↔灵能）</span>
            <span><kbd>B</kbd> 布防工坊 · <kbd>G</kbd> 丹炉 · <kbd>K</kbd> 商店 · <kbd>J</kbd> 任务</span>
            <span><kbd>C</kbd> 跟随 / 俯瞰 / 第一人称 · <kbd>V</kbd> 快速俯瞰 · 滚轮拉近</span>
            <span><kbd>T</kbd> 时间 1×/2×/4× · <kbd>右键拖动</kbd> 转视角 · <kbd>Esc</kbd> 暂停</span>
          </div>
          <p>循环：种菜换灵石 → 灵能竖塔 → 波次来袭守住阵眼 → 收割杀怪涨修为 → 炼丹突破境界 → 更强的塔与作物 → 八章打满，白日飞升。</p>          <p class="gh-line">⭐ 开源仓库：<a href="https://github.com/lincong1987/farming-to-cultivation" target="_blank" rel="noopener">lincong1987/farming-to-cultivation</a></p>
          <div class="mbtns"><button class="go" data-ok>懂了</button></div></div>`;
      }
      modalBox.innerHTML = h;
      const box = modalBox.firstElementChild;
      if (!box) return;
      box.querySelector('[data-tn]')?.addEventListener('click', () => { Sound.play('ui'); if (talkI < talkQueue.length - 1) { talkI++; renderModal(); } else endTalk(); });
      box.querySelector('[data-ts]')?.addEventListener('click', () => { Sound.play('deny'); endTalk(); });
      box.querySelectorAll?.('[data-dif]')?.forEach((b) => b.onclick = () => { diffPick = +b.dataset.dif; Sound.play('ui'); renderModal(); });
      box.querySelector('[data-ok]')?.addEventListener('click', () => { const wasHelp = modalName === 'help'; if (wasHelp && window.PRDSYS) { window.PRDSYS.Q().seen.help = 1; sim().save(); } if (diffPick != null) { sim().S.diff = diffPick; diffPick = null; sim().save(); } Sound.play('ui'); modalName = null; renderModal(); if (wasHelp && pendingIntro) { pendingIntro = false; levelIntro(); } });
      box.querySelector('[data-next]')?.addEventListener('click', () => { Sound.play('ui'); modalName = null; renderModal(); G.nextLevel(); });
      box.querySelector('[data-retry]')?.addEventListener('click', () => { Sound.play('ui'); modalName = null; renderModal(); G.restartLevel(); });
      box.querySelector('[data-ascend]')?.addEventListener('click', () => { Sound.play('breakthrough'); s.ascend(); });
      box.querySelector('[data-plow]')?.addEventListener('click', () => { s.returnToPlow(); });
      box.querySelectorAll?.('[data-diff]').forEach((b) => b.onclick = () => { modalName = null; renderModal(); s.replayDiff(+b.dataset.diff); });
      box.querySelector('[data-resume]')?.addEventListener('click', () => { pause(false); });
      box.querySelector('[data-save]')?.addEventListener('click', (e) => { s.save(); e.target.textContent = '✔ 已存'; });
      box.querySelector('[data-home]')?.addEventListener('click', () => { s.save(); Sound.play('ui'); toTitle(); });
      box.querySelector('#vol-bgm')?.addEventListener('input', (e) => { settings.bgm = +e.target.value; Sound.setVolume(undefined, settings.bgm); saveSettings(); });
      box.querySelector('#vol-sfx')?.addEventListener('input', (e) => { settings.sfx = +e.target.value; Sound.setVolume(settings.sfx); saveSettings(); });
    }
    let lastReason = '阵眼失守';
    let lastClear = null;
    let playStart = performance.now();

    /* ---------- 标题 ---------- */
    function renderTitle() {
      const has = sim() && sim().hasSave();
      titleBox.innerHTML = `
        <div class="t-card">
          <div class="t-kicker">塔防 × 种田 × 升仙</div>
          <h1>陇上<span>修真</span></h1>
          <p class="t-sub">Cultivation on the Ridge · 祖传三分田，妖藤成了精。种出灵能，竖起炮塔，一路从凡人修到大乘。</p>
          <div class="t-btns">
            <button class="go" id="btn-new">🌱 新的开始</button>
            <button class="go gold ${has ? '' : 'dis'}" id="btn-cont">⛰ 继续修行</button>
            <button class="ghost" id="btn-help">❓ 操作说明</button>
          </div>
          <div class="t-btns"><a class="go gh-btn" href="https://github.com/lincong1987/farming-to-cultivation" target="_blank" rel="noopener">⭐ 开源仓库 · GitHub</a></div><div class="t-foot">three.js · 全程序化资产（零资源文件）· 单文件即玩</div>
        </div>`;
      $('btn-new').onclick = () => { Sound.resume(); Sound.play('build'); startNew(true); };
      $('btn-cont').onclick = () => { Sound.resume(); startNew(false, true); };
      $('btn-help').onclick = () => { modalName = 'help'; renderModal(); };
    }
    function startNew(fresh, fromSave) {
      titleBox.classList.add('hide');
      if (fromSave) G.continueGame();
      else G.newGame();
    }
    function toTitle() {
      scr = 'title'; modalName = null; panelName = null;
      hud.classList.remove('show'); toolbar.classList.remove('show'); subs.classList.remove('show');
      side.classList.remove('show'); items.classList.remove('show'); modeHint.classList.remove('show');
      renderModal(); renderPanel(); renderTitle(); titleBox.classList.remove('hide');
    }

    /* ---------- 同步 HUD ---------- */
    let lastHpMax = 0;
    function syncTop() {
      const st = sim().state();
      $('r-money').textContent = st.money;
      $('r-spirit').textContent = Math.floor(st.spirit);
      $('spirit-fill').style.width = (st.spirit / st.spiritMax * 100) + '%';
      const rv = DATA.REALMS[st.realm];
      const next = DATA.REALMS[st.realm + 1];
      $('realm-badge').textContent = rv.name;
      const xpv = next ? clamp(st.xp / next.need, 0, 1) : 1;
      $('xp-fill').style.width = (xpv * 100) + '%';
      $('xp-text').textContent = next ? `${st.xp}/${next.need}` : `${st.xp}`;
      $('nexus-fill').style.width = (st.nexusHp / st.nexusMax * 100) + '%';
      $('nexus-wrap').classList.toggle('low', st.nexusHp / st.nexusMax < .35);
      $('lvl-label').textContent = `第${st.level}章 ${st.levelName}`;
      const doneChapter = st.wave >= st.waves && !st.waveActive;
      $('wave-label').textContent = st.waveActive
        ? `⚔ 第 ${st.wave}/${st.waves} 波 · 余 ${st.enemies}`
        : doneChapter ? '✅ 本章已守 · 去下一关或留下种田'
        : st.intermission > 0 ? (st.wave === 0 ? `首波 ${st.intermission}s · 趁现在种地建塔` : `休整 ${st.intermission}s · 第 ${st.wave}/${st.waves} 波已退`)
        : `波次 ${st.wave}/${st.waves}`;
      hearts(st);
      $('btn-advance').classList.toggle('hide', !(doneChapter && st.cleared.length));
      $('btn-advance').textContent = st.level >= 8 ? '☯ 飞升' : '⛰ 下一关';
    }
    function hearts(st) {
      const box = $('hearts');
      if (box.childElementCount !== st.hpMax) {
        box.innerHTML = '';
        for (let i = 0; i < st.hpMax; i++) box.appendChild(el('i', 'hp'));
      }
      [...box.children].forEach((h, i) => h.classList.toggle('off', i >= st.hp));
    }
    function syncInv() {
      const s = sim().S;
      $('seed-name').textContent = DATA.CROPS[currentSeed]?.name || '无';
      $('seed-n').textContent = s.seeds[currentSeed] || 0;
      $('wp-name').textContent = DATA.WEAPONS[currentWeapon]?.name || '无';
      $('wp-lv').textContent = s.weapons[currentWeapon] || 0;
      // 物品快捷栏
      items.innerHTML = Object.keys(DATA.ITEMS).map((id) => {
        const n = s.bag[id] || 0;
        return `<button class="islot ${n ? '' : 'z'}" data-use="${id}" title="${DATA.ITEMS[id].name}：${DATA.ITEMS[id].desc}">${ICON[id]}<i>${n}</i></button>`;
      }).join('') + `<button class="islot gold" data-use="hpPot" title="快捷喝药 H">🍶<i>${s.bag.hpPot || 0}</i></button>`;
      items.querySelectorAll('[data-use]').forEach((b) => b.onclick = () => { if (sim().useItem(b.dataset.use)) Sound.play('ui'); });
    }
    const ICON = { hpPot: '🍶', fertilizer: '🌦', bomb: '🧨', freeze: '❄', smite: '⚡', guard: '🛡', speed: '👟', fpMax: '🔮' };
    function syncClock() {
      const st = sim().state();
      const hh = Math.floor(st.time01 * 24);
      const name = hh >= 5 && hh < 9 ? '卯时' : hh < 11 ? '辰时' : hh < 13 ? '午时' : hh < 17 ? '未时' : hh < 19 ? '酉时' : hh < 23 ? '戌时' : '子时';
      $('clock').textContent = `${name} ×${st.speed}`;
      $('speed-n').textContent = '×' + st.speed;
    }
    function questBadge() {
      const b = $('btn-quest')?.querySelector('.qbadge'); if (!b || !window.PRDSYS || !sim()) return;
      const P = window.PRDSYS; const q = P.Q(); const dl = P.DAILY;
      let n = 0; for (const d of dl) if (!q.done['d!' + d.id] && P.prog(d.id) >= d.need) n++;
      b.classList.toggle('hide', !n); if (n) b.textContent = n;
    }
    function syncAll() {
      questBadge(); syncTop(); syncInv(); syncClock(); renderPanel(); }

    /* ---------- 每帧 ---------- */
    let ghost = null, ghostId = null;
    function tick(dt) {
      if (tipBar && (tick._q = Math.floor(performance.now() / 900)) !== tick._q0) { tick._q0 = tick._q; tipBar.textContent = nextTip(); tipBar.classList.toggle('hide', !tipBar.textContent); }
      syncClock();
      if (scr !== 'playing') { if (ghost) ghost.visible = false; return; }
      syncTop();
      if (mode === 'build') {
        const wantId = buildKind === 'building' ? 'b:' + currentBuilding : 't:' + currentTower;
        if (!ghost || ghostId !== wantId) {
          if (ghost) G.scene.remove(ghost);
          ghost = buildKind === 'building' ? Art.buildingMesh(currentBuilding) : Art.towerMesh(currentTower); ghostId = wantId;
          ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .6; } });
          G.scene.add(ghost);
        }
        const pt = sim().aimPoint();
        if (pt) {
          ghost.visible = true;
          ghost.position.set(pt.x, .3, pt.z);
          ghost.rotation.y += dt * 2;
          const err = buildKind === 'building' ? sim().canPlaceB(pt.x, pt.z) : sim().canPlace(pt.x, pt.z);
          ghost.children[0].material.color.setHex(err ? 0xe06a5a : 0xa8e8a0);
        }
      } else if (ghost) ghost.visible = false;
    }

    /* ---------- 屏幕流程 ---------- */
    function state() { return scr; }
    function pause(v) {
      if (v && scr === 'playing') { scr = 'paused'; modalName = 'pause'; renderModal(); }
      else if (!v && scr === 'paused') { scr = 'playing'; modalName = null; renderModal(); Sound.resume(); }
    }
    function play() {
      scr = 'playing';
      hud.classList.add('show'); toolbar.classList.add('show'); subs.classList.add('show');
      side.classList.add('show'); items.classList.add('show');
      setMode('till'); playStart = performance.now();
      syncAll();
      Sound.resume(); Sound.startMusic();
    }
    let talkQueue = [], talkI = 0;
    let bubbleT = 0;
    function nextTip() {
      const q = window.PRDSYS && window.PRDSYS.Q(); const s = sim();
      if (!q || !s || !q.seen.help || modalName) return '';
      const S = s.S;
      if (S.towers.length === 0 && S.wave === 0) return '竖塔：按 B 开灵纹工坊，选塔点地；灵能不够按 E 向阵眼祈愿（灵石换灵能）';
      if (q.main < 2) return '农活链：1 刨地 → 2 播种 → 3 浇水 → 成熟 4 收割；也可直接点格子自动走过去';
      if (S.nexusHp / S.nexusMax < .6) return '阵眼受损——K 商店卖粮换灵能，回工坊升级/补塔';
      if (S.realm < 8 && S.xp > (DATA.REALMS[S.realm + 1].need || 1e9) * .7) return '修为将满：G 丹炉炼' + ((DATA.PILLS || [])[S.realm + 1] || { name: '突破丹' }).name + '，然后突破境界';
      return '';
    }
    let pendingIntro = false;
    function introFlow() {
      const q = window.PRDSYS && window.PRDSYS.Q();
      if (q && !q.seen.help) { pendingIntro = true; modalName = 'help'; renderModal(); return; }
      levelIntro();
    }
    function levelIntro() {
      const P = window.PRDSYS; const ch = (sim().S.levelIdx | 0) + 1;
      if (P) { const seen = P.Q(); const lines = P.chapterIntro(ch);
        if (lines.length && !seen.seen['i' + ch]) { talkQueue = lines; talkI = 0; modalName = 'talk'; renderModal(); return; } }
      modalName = 'intro'; renderModal();
    }
    function endTalk() { const P = window.PRDSYS; if (P) { P.Q().seen['i' + ((sim().S.levelIdx | 0) + 1)] = 1; P.Q().seen = P.Q().seen; sim().save(); } talkQueue = []; modalName = 'intro'; renderModal(); }
    function levelClear(def) { lastClear = def; scr = 'clear'; modalName = 'clear'; syncTop(); renderModal(); }
    function gameOver(reason, def) { lastReason = reason; scr = 'dead'; modalName = 'dead'; renderModal(); }
    function ending() { scr = 'end'; modalName = 'end'; renderModal(); Sound.play('breakthrough'); }
    function setScr(s) { scr = s; }

    /* ---------- 接线 ---------- */
    toolbar.querySelectorAll('.slot').forEach((b) => b.onclick = () => selectTool(+b.dataset.i));
    $('chip-seed').onclick = cycleSeed;
    $('chip-weapon').onclick = cycleWeapon;
    $('chip-tower').onclick = () => openPanel('build');
    $('btn-build').onclick = () => openPanel('build');
    $('btn-quest').onclick = () => openPanel('quest');
    $('btn-alchemy').onclick = () => openPanel('alchemy');
    $('btn-shop').onclick = () => openPanel('shop');
    $('btn-advance').onclick = () => { const st = sim().state(); if (st.level >= 8) { sim().ascend(); } else G.nextLevel(); };
    $('btn-speed').onclick = () => { const s = sim(); s.S.speed = s.S.speed === 1 ? 2 : s.S.speed === 2 ? 4 : 1; Sound.play('ui'); };
    $('btn-view').onclick = () => { const P = sim().P; P.camMode = (P.camMode + 1) % 3; Sound.play('ui'); toast(['跟随视角', '俯瞰视角', '第一人称'][P.camMode]); };
    $('btn-pause').onclick = () => pause(true);
    if (matchMedia('(pointer: coarse)').matches) {
      const jb = document.createElement('button'); jb.className = 't-btn'; jb.innerHTML = '⤒ 跳跃';
      jb.onclick = () => { sim().P.jumpQ = true; }; side.appendChild(jb);
    }

    // UI 自己监听 Esc：暂停态恢复 / 标题关帮助
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && scr === 'paused') pause(false);
      if (e.code === 'Enter' && scr === 'title' && sim() && sim().hasSave()) startNew(false, true);
      if ((e.code === 'KeyJ' || e.code === 'KeyM') && scr === 'playing' && !e.repeat) openPanel('quest');
    });

    Sound.setVolume(settings.sfx, settings.bgm);
    renderTitle(); titleBox.classList.remove('hide');

    return {
      state, setScr, play, pause, toTitle,
      toast, anyPanel, closePanels, openPanel, renderPanel,
      selectTool, cycleSeed, cycleWeapon, setMode,
      syncTop, syncInv, syncClock, syncAll, tick, refreshTitle: renderTitle,
      questsChanged() { if (panelName === 'quest') renderPanel(); questBadge(); },
      levelIntro, introFlow, levelClear, gameOver, ending,
      get mode() { return mode; }, set mode(v) { setMode(v); },
      get currentSeed() { return currentSeed; }, set currentSeed(v) { currentSeed = v; },
      get currentWeapon() { return currentWeapon; }, set currentWeapon(v) { currentWeapon = v; },
      get currentTower() { return currentTower; }, set currentTower(v) { currentTower = v; },
      get buildKind() { return buildKind; }, set buildKind(v) { buildKind = v; },
      get currentBuilding() { return currentBuilding; }, set currentBuilding(v) { currentBuilding = v; },
      npcNear(kind) {
        const h = $('npc-hint'); if (!h) return;
        const NAMES = { grannie: '青禾婆婆', blacksmith: '铁匠老鼓', hawker: '钱串子', aunt: '团婶' };
        if (!kind) { h.classList.add('hide'); return; }
        h.textContent = 'F · ' + (NAMES[kind] || kind); h.classList.remove('hide');
      },
      storyBar(lines) {
        let sb = $('story-bar');
        if (!sb) { sb = el('div', 'story-bar hide'); sb.id = 'story-bar'; root.appendChild(sb); }
        let i = 0;
        const show = () => {
          if (i >= lines.length) { sb.classList.add('hide'); return; }
          sb.textContent = lines[i]; sb.classList.remove('hide');
          sb.style.opacity = 0; requestAnimationFrame(() => { sb.style.transition = 'opacity .8s'; sb.style.opacity = 1; });
          i++; setTimeout(() => { sb.style.opacity = 0; setTimeout(show, 900); }, 7200);
        };
        show();
      },
      sayBubble(kind, text) {
        const NAMES = { grannie: '👵 青禾婆婆', blacksmith: '🔨 铁匠老鼓', hawker: '🧮 钱串子', aunt: '🧹 团婶' };
        let bb = $('npc-bubble');
        if (!bb) { bb = el('div', 'npc-bubble hide'); bb.id = 'npc-bubble'; root.appendChild(bb); }
        bb.innerHTML = '<b>' + (NAMES[kind] || '') + '</b><span>' + text + '</span>';
        bb.classList.remove('hide');
        clearTimeout(bubbleT); bubbleT = setTimeout(() => bb.classList.add('hide'), 3200);
      },
      settings,
    };
  }
  return { build };
})();
