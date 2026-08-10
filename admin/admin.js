// ============================================================
// 织律 · 后台管理系统
// ============================================================
const Admin = {
  // Editable copies of game data
  _data: {},

  // Change tracking
  _changes: {},
  _changeCount: 0,

  // Current tab
  _tab: 'overview',

  init() {
    this._loadData();
    this._bindNav();
    this._renderTab('overview');
    document.getElementById('mainContent').querySelector('.loading')?.remove();
  },

  // ---- DATA LOADING ----

  _loadData() {
    // Deep-clone all game data globals from data.js
    this._data = {
      characters: JSON.parse(JSON.stringify(CHARACTERS)),
      swordsmanCards: JSON.parse(JSON.stringify(SWORDSMAN_CARDS)),
      martialCards: JSON.parse(JSON.stringify(MARTIALARTIST_CARDS)),
      enemies: JSON.parse(JSON.stringify(ENEMIES)),
      equipment: JSON.parse(JSON.stringify(EQUIPMENT)),
      signatureSwords: JSON.parse(JSON.stringify(SIGNATURE_SWORDS)),
      status: JSON.parse(JSON.stringify(STATUS)),
      regions: JSON.parse(JSON.stringify(REGIONS)),
    };
    // Load saved changes from localStorage
    try {
      const saved = localStorage.getItem('zhilv_admin_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this._data, parsed);
        this._changes = JSON.parse(localStorage.getItem('zhilv_admin_changes') || '{}');
        this._changeCount = Object.keys(this._changes).length;
      }
    } catch(e) { /* ignore */ }
  },

  _saveData() {
    try {
      localStorage.setItem('zhilv_admin_data', JSON.stringify(this._data));
      localStorage.setItem('zhilv_admin_changes', JSON.stringify(this._changes));
    } catch(e) {
      this.toast('⚠️ localStorage 存储空间不足', 'warning');
    }
  },

  _trackChange(category, id, field, oldVal, newVal) {
    if (!this._changes[category]) this._changes[category] = {};
    if (!this._changes[category][id]) this._changes[category][id] = {};
    this._changes[category][id][field] = { old: oldVal, new: newVal };
    this._changeCount = Object.values(this._changes).reduce((s, cat) =>
      s + Object.values(cat).reduce((s2, item) => s2 + Object.keys(item).length, 0), 0);
    this._saveData();
  },

  resetAll() {
    if (!confirm('确定要重置所有修改？这将丢失所有未导出的变更。')) return;
    localStorage.removeItem('zhilv_admin_data');
    localStorage.removeItem('zhilv_admin_changes');
    this._changes = {};
    this._changeCount = 0;
    this._loadData();
    this._renderTab(this._tab);
    this.toast('✅ 已重置所有修改');
  },

  // ---- NAVIGATION ----

  _bindNav() {
    document.getElementById('navList').addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item) return;
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      this._tab = item.dataset.tab;
      this._renderTab(this._tab);
    });
  },

  _renderTab(tab) {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';
    switch (tab) {
      case 'overview': this._renderOverview(main); break;
      case 'characters': this._renderCharacters(main); break;
      case 'cards': this._renderCards(main); break;
      case 'enemies': this._renderEnemies(main); break;
      case 'equipment': this._renderEquipment(main); break;
      case 'statuses': this._renderStatuses(main); break;
      case 'bosses': this._renderBosses(main); break;
      case 'assets': this._renderAssets(main); break;
      case 'export': this._renderExport(main); break;
    }
  },

  // ---- OVERVIEW ----

  _renderOverview(main) {
    const d = this._data;
    main.innerHTML = `
      <div class="page-header"><h2>📊 总览仪表盘</h2><span class="stats">变更: ${this._changeCount} 项</span></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">2</div><div class="stat-label">角色</div></div>
        <div class="stat-card"><div class="stat-num">${d.swordsmanCards.length + d.martialCards.length}</div><div class="stat-label">技能卡总数</div></div>
        <div class="stat-card"><div class="stat-num">${d.enemies.length}</div><div class="stat-label">敌人模板</div></div>
        <div class="stat-card"><div class="stat-num">${d.equipment.length}</div><div class="stat-label">装备</div></div>
        <div class="stat-card"><div class="stat-num">${d.signatureSwords.length}</div><div class="stat-label">名剑</div></div>
        <div class="stat-card"><div class="stat-num">${Object.keys(d.status).length}</div><div class="stat-label">异常状态</div></div>
        <div class="stat-card"><div class="stat-num">${d.regions.length}</div><div class="stat-label">章节</div></div>
        <div class="stat-card"><div class="stat-num">${this._changeCount}</div><div class="stat-label">待保存变更</div></div>
      </div>
      <h3 style="margin-top:20px;margin-bottom:12px;">快速导航</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${['characters','cards','enemies','equipment','bosses','assets','export'].map(t =>
          `<button class="btn" onclick="Admin._renderTab('${t}');document.querySelectorAll('.nav-item').forEach(e=>e.classList.toggle('active',e.dataset.tab==='${t}'))">→ ${t}</button>`
        ).join('')}
      </div>
    `;
  },

  // ---- CHARACTERS ----

  _renderCharacters(main) {
    const chars = this._data.characters;
    main.innerHTML = this._pageHeader('👤 角色编辑');
    const table = this._createTable(['ID', '名称', '生命', '攻击力', '能量', '抽牌', '初始牌数', '操作']);
    const tbody = table.querySelector('tbody');

    Object.entries(chars).forEach(([id, c]) => {
      const cardCount = (c.startingCards || []).reduce((s, e) => s + e.count, 0);
      const row = this._addRow(tbody, [
        id,
        { val: c.name || c.className, editable: true, onEdit: (v) => { c.name = v; c.className = v; this._trackChange('characters', id, 'name', c.name, v); this._saveData(); } },
        { val: c.maxHp, editable: true, cls: 'num', onEdit: (v) => { c.maxHp = parseInt(v); this._trackChange('characters', id, 'maxHp', c.maxHp, v); this._saveData(); } },
        { val: c.atk, editable: true, cls: 'num', onEdit: (v) => { c.atk = parseInt(v); this._trackChange('characters', id, 'atk', c.atk, v); this._saveData(); } },
        { val: c.baseEnergy, editable: true, cls: 'num', onEdit: (v) => { c.baseEnergy = parseInt(v); this._trackChange('characters', id, 'baseEnergy', c.baseEnergy, v); this._saveData(); } },
        { val: c.baseDraw, editable: true, cls: 'num', onEdit: (v) => { c.baseDraw = parseInt(v); this._trackChange('characters', id, 'baseDraw', c.baseDraw, v); this._saveData(); } },
        { val: cardCount, cls: 'num' },
      ]);
      this._addActionBtn(row, '编辑详情', () => this._editCharacter(id));
    });

    main.appendChild(table);
  },

  _editCharacter(id) {
    const c = this._data.characters[id];
    const cardNames = (c.startingCards || []).map(e => {
      const def = ALL_CARDS[e.cardId]; return `${def?.name || e.cardId} ×${e.count}`;
    }).join(', ');
    this._showModal(`编辑角色: ${c.name}`, `
      <div class="modal-field"><label>名称</label><input value="${c.name}" onchange="Admin._data.characters['${id}'].name=this.value;Admin._saveData()"></div>
      <div class="modal-field"><label>生命</label><input type="number" value="${c.maxHp}" onchange="Admin._data.characters['${id}'].maxHp=+this.value;Admin._saveData()"></div>
      <div class="modal-field"><label>攻击力</label><input type="number" value="${c.atk}" onchange="Admin._data.characters['${id}'].atk=+this.value;Admin._saveData()"></div>
      <div class="modal-field"><label>能量上限</label><input type="number" value="${c.baseEnergy}" onchange="Admin._data.characters['${id}'].baseEnergy=+this.value;Admin._saveData()"></div>
      <div class="modal-field"><label>每回抽牌</label><input type="number" value="${c.baseDraw}" onchange="Admin._data.characters['${id}'].baseDraw=+this.value;Admin._saveData()"></div>
      <div class="modal-field"><label>初始牌组</label><p style="font-size:11px;color:var(--text-dim)">${cardNames}</p></div>
      <div class="modal-field"><label>资源名</label><input value="${c.resource.name}" disabled></div>
      <div class="modal-field"><label>描述</label><textarea onchange="Admin._data.characters['${id}'].description=this.value;Admin._saveData()">${c.description || ''}</textarea></div>
    `);
  },

  // ---- CARDS ----

  _renderCards(main) {
    const allCards = [...this._data.swordsmanCards, ...this._data.martialCards];
    main.innerHTML = this._pageHeader('🃏 技能卡编辑') + `<div class="search-bar">
      <input class="search-input" id="cardSearch" placeholder="搜索卡牌名称、标签..." oninput="Admin._filterCards()">
      <select id="cardFilter" onchange="Admin._filterCards()" style="padding:8px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:6px">
        <option value="all">全部</option><option value="swordsman">剑圣</option><option value="martialArtist">武圣</option>
      </select>
    </div><div id="cardTableWrap"></div>`;

    this._renderCardTable(allCards);
  },

  _filterCards() {
    const q = document.getElementById('cardSearch').value.toLowerCase();
    const f = document.getElementById('cardFilter').value;
    let all = [...this._data.swordsmanCards, ...this._data.martialCards];
    if (f === 'swordsman') all = this._data.swordsmanCards;
    else if (f === 'martialArtist') all = this._data.martialCards;
    if (q) all = all.filter(c => c.name.includes(q) || c.tags?.some(t => t.includes(q)) || c.desc?.includes(q));
    this._renderCardTable(all);
  },

  _renderCardTable(cards) {
    const wrap = document.getElementById('cardTableWrap');
    if (!wrap) return;
    const table = this._createTable(['名称', '类型', '标签', '费用', '伤害倍率', '描述', '关键词', '操作']);
    const tbody = table.querySelector('tbody');
    cards.forEach(c => {
      const dmg = c.effects?.filter(e => e.type === 'damage').map(e => `${e.multiplier}×${e.hits || 1}`).join(' | ') || '-';
      const row = this._addRow(tbody, [
        { val: c.name, editable: true, onEdit: (v) => { c.name = v; this._saveData(); } },
        { val: c.cardType, cls: c.cardType === 'attack' ? 'tag red' : c.cardType === 'power' ? 'tag gold' : 'tag green' },
        { val: (c.tags || []).join(', ') },
        { val: c.energyCost, editable: true, cls: 'num', onEdit: (v) => { c.energyCost = +v; this._saveData(); } },
        { val: dmg, cls: 'num' },
        { val: (c.desc || '').substring(0, 40) + (c.desc?.length > 40 ? '...' : '') },
        { val: (c.pileKeywords || []).join(', ') || '-', cls: 'tag' },
      ]);
      this._addActionBtn(row, '编辑', () => this._editCard(c));
    });
    wrap.appendChild(table);
  },

  _editCard(card) {
    this._showModal(`编辑: ${card.name}`, `
      <div class="modal-field"><label>名称</label><input value="${card.name}" onchange="this.closest('.admin-modal')._card.name=this.value"></div>
      <div class="modal-field"><label>ID</label><input value="${card.id}" disabled></div>
      <div class="modal-field"><label>能量费用</label><input type="number" value="${card.energyCost}" onchange="this.closest('.admin-modal')._card.energyCost=+this.value"></div>
      <div class="modal-field"><label>类型</label><select onchange="this.closest('.admin-modal')._card.cardType=this.value">
        <option value="attack" ${card.cardType==='attack'?'selected':''}>攻击</option>
        <option value="power" ${card.cardType==='power'?'selected':''}>能力</option>
        <option value="technique" ${card.cardType==='technique'?'selected':''}>技法</option>
      </select></div>
      <div class="modal-field"><label>标签 (逗号分隔)</label><input value="${(card.tags||[]).join(',')}" onchange="this.closest('.admin-modal')._card.tags=this.value.split(',')"></div>
      <div class="modal-field"><label>关键词 (逗号分隔)</label><input value="${(card.pileKeywords||[]).join(',')}" onchange="this.closest('.admin-modal')._card.pileKeywords=this.value.split(',')"></div>
      <div class="modal-field"><label>描述</label><textarea onchange="this.closest('.admin-modal')._card.desc=this.value">${card.desc}</textarea></div>
      <div class="modal-field"><label>伤害效果 (JSON)</label><textarea>${JSON.stringify(card.effects, null, 2)}</textarea></div>
      <button class="btn btn-primary" onclick="Admin._saveCardEdit(Admin._editingCard); Admin.closeModal(); Admin._renderTab('cards')">💾 保存</button>
    `);
    this._editingCard = card;
    document.querySelector('.admin-modal')._card = card;
  },

  _saveCardEdit(card) {
    this._trackChange('cards', card.id, '*', null, 'modified');
    this._saveData();
    this.toast(`✅ ${card.name} 已保存`);
  },

  // ---- ENEMIES ----

  _renderEnemies(main) {
    const enemies = this._data.enemies;
    main.innerHTML = this._pageHeader('👾 敌人编辑');
    const table = this._createTable(['ID', '名称', '类型', '生命', '防御', '标签', '意图数量', '操作']);
    const tbody = table.querySelector('tbody');
    enemies.forEach(e => {
      const row = this._addRow(tbody, [
        { val: e.id },
        { val: e.name, editable: true, onEdit: (v) => { e.name = v; this._saveData(); } },
        { val: e.type, cls: `tag ${e.type==='boss'?'red':e.type==='elite'?'gold':'green'}` },
        { val: e.maxHp, editable: true, cls: 'num', onEdit: (v) => { e.maxHp = +v; this._saveData(); } },
        { val: e.defense, editable: true, cls: 'num', onEdit: (v) => { e.defense = +v; this._saveData(); } },
        { val: (e.tags || []).join(', ') },
        { val: (e.intentPattern || []).length, cls: 'num' },
      ]);
      this._addActionBtn(row, '编辑', () => this._editEnemy(e));
    });
    main.appendChild(table);
  },

  _editEnemy(enemy) {
    const intents = JSON.stringify(enemy.intentPattern, null, 2);
    const phases = JSON.stringify(enemy.phases || [], null, 2);
    this._showModal(`编辑敌人: ${enemy.name}`, `
      <div class="modal-field"><label>名称</label><input value="${enemy.name}" onchange="this.closest('.admin-modal')._enemy.name=this.value"></div>
      <div class="modal-field"><label>ID</label><input value="${enemy.id}" disabled></div>
      <div class="modal-field"><label>类型</label><select onchange="this.closest('.admin-modal')._enemy.type=this.value">
        <option value="normal" ${enemy.type==='normal'?'selected':''}>普通</option>
        <option value="elite" ${enemy.type==='elite'?'selected':''}>精英</option>
        <option value="boss" ${enemy.type==='boss'?'selected':''}>Boss</option>
      </select></div>
      <div class="modal-field"><label>生命</label><input type="number" value="${enemy.maxHp}" onchange="this.closest('.admin-modal')._enemy.maxHp=+this.value"></div>
      <div class="modal-field"><label>防御</label><input type="number" value="${enemy.defense}" onchange="this.closest('.admin-modal')._enemy.defense=+this.value"></div>
      <div class="modal-field"><label>意图模式 (JSON)</label><textarea style="min-height:120px" onchange="try{this.closest('.admin-modal')._enemy.intentPattern=JSON.parse(this.value)}catch(e){}">${intents}</textarea></div>
      <div class="modal-field"><label>阶段 (JSON, 仅Boss)</label><textarea onchange="try{this.closest('.admin-modal')._enemy.phases=JSON.parse(this.value)}catch(e){}">${phases}</textarea></div>
      <button class="btn btn-primary" onclick="Admin._saveEnemyEdit(Admin._editingEnemy);Admin.closeModal();Admin._renderTab('enemies')">💾 保存</button>
    `);
    this._editingEnemy = enemy;
    document.querySelector('.admin-modal')._enemy = enemy;
  },

  _saveEnemyEdit(enemy) {
    this._trackChange('enemies', enemy.id, '*', null, 'modified');
    this._saveData();
    this.toast(`✅ ${enemy.name} 已保存`);
  },

  // ---- EQUIPMENT ----

  _renderEquipment(main) {
    const eq = this._data.equipment;
    main.innerHTML = this._pageHeader('⚔️ 装备编辑');
    const table = this._createTable(['名称', '稀有度', '插槽', '描述', '效果', '操作']);
    const tbody = table.querySelector('tbody');
    eq.forEach(e => {
      const row = this._addRow(tbody, [
        { val: e.name, editable: true, onEdit: (v) => { e.name = v; this._saveData(); } },
        { val: e.rarity, cls: `tag ${e.rarity==='神话'?'red':e.rarity==='史诗'?'gold':'green'}` },
        { val: e.slot, cls: 'tag' },
        { val: (e.desc || '').substring(0, 50) + (e.desc?.length > 50 ? '...' : '') },
        { val: JSON.stringify(e.effect || {}).substring(0, 40) + '...' },
      ]);
      this._addActionBtn(row, '编辑', () => this._editEquipment(e));
    });
    main.appendChild(table);
  },

  _editEquipment(equip) {
    this._showModal(`编辑装备: ${equip.name}`, `
      <div class="modal-field"><label>名称</label><input value="${equip.name}" onchange="this.closest('.admin-modal')._eq.name=this.value"></div>
      <div class="modal-field"><label>ID</label><input value="${equip.id}" disabled></div>
      <div class="modal-field"><label>稀有度</label><select onchange="this.closest('.admin-modal')._eq.rarity=this.value">
        <option value="普通" ${equip.rarity==='普通'?'selected':''}>普通</option>
        <option value="稀有" ${equip.rarity==='稀有'?'selected':''}>稀有</option>
        <option value="史诗" ${equip.rarity==='史诗'?'selected':''}>史诗</option>
        <option value="神话" ${equip.rarity==='神话'?'selected':''}>神话</option>
      </select></div>
      <div class="modal-field"><label>描述</label><textarea onchange="this.closest('.admin-modal')._eq.desc=this.value">${equip.desc}</textarea></div>
      <div class="modal-field"><label>效果 (JSON)</label><textarea style="min-height:80px" onchange="try{this.closest('.admin-modal')._eq.effect=JSON.parse(this.value)}catch(e){}">${JSON.stringify(equip.effect, null, 2)}</textarea></div>
      <button class="btn btn-primary" onclick="Admin._saveEquipmentEdit(Admin._editingEq);Admin.closeModal();Admin._renderTab('equipment')">💾 保存</button>
    `);
    this._editingEq = equip;
    document.querySelector('.admin-modal')._eq = equip;
  },

  _saveEquipmentEdit(equip) {
    this._trackChange('equipment', equip.id, '*', null, 'modified');
    this._saveData();
    this.toast(`✅ ${equip.name} 已保存`);
  },

  // ---- STATUSES ----

  _renderStatuses(main) {
    const statuses = this._data.status;
    main.innerHTML = this._pageHeader('☠️ 异常状态编辑');
    const table = this._createTable(['ID', '名称', '最大层数', '衰减', '衰减时机', '操作']);
    const tbody = table.querySelector('tbody');
    Object.entries(statuses).forEach(([id, s]) => {
      const row = this._addRow(tbody, [
        { val: id },
        { val: s.name },
        { val: s.maxStacks, editable: true, cls: 'num', onEdit: (v) => { s.maxStacks = +v; this._saveData(); } },
        { val: s.decay, editable: true, cls: 'num', onEdit: (v) => { s.decay = +v; this._saveData(); } },
        { val: s.decayTiming, cls: 'tag' },
      ]);
      this._addActionBtn(row, '编辑', () => this._editStatus(id, s));
    });
    main.appendChild(table);
  },

  _editStatus(id, s) {
    this._showModal(`编辑状态: ${s.name}`, `
      <div class="modal-field"><label>名称</label><input value="${s.name}" onchange="this.closest('.admin-modal')._st.name=this.value"></div>
      <div class="modal-field"><label>最大层数</label><input type="number" value="${s.maxStacks}" onchange="this.closest('.admin-modal')._st.maxStacks=+this.value"></div>
      <div class="modal-field"><label>每回合衰减</label><input type="number" value="${s.decay}" onchange="this.closest('.admin-modal')._st.decay=+this.value"></div>
      <div class="modal-field"><label>衰减时机</label><select onchange="this.closest('.admin-modal')._st.decayTiming=this.value">
        <option value="round_end" ${s.decayTiming==='round_end'?'selected':''}>回合结束</option>
        <option value="owner_turn_end" ${s.decayTiming==='owner_turn_end'?'selected':''}>拥有者回合结束</option>
      </select></div>
      <button class="btn btn-primary" onclick="Admin._saveStatusEdit(Admin._editingSt);Admin.closeModal();Admin._renderTab('statuses')">💾 保存</button>
    `);
    this._editingSt = s;
    document.querySelector('.admin-modal')._st = s;
  },

  _saveStatusEdit(s) {
    this._trackChange('status', s.id, '*', null, 'modified');
    this._saveData();
    this.toast(`✅ ${s.name} 已保存`);
  },

  // ---- BOSSES ----

  _renderBosses(main) {
    const regions = this._data.regions;
    const bosses = this._data.enemies.filter(e => e.type === 'boss');
    main.innerHTML = this._pageHeader('🐉 Boss & 关卡配置');
    main.innerHTML += `<h3 style="margin-bottom:12px;">章节缩放进阶</h3>`;
    const table = this._createTable(['章节', '名称', 'Boss名', '缩放倍率', '操作']);
    const tbody = table.querySelector('tbody');
    regions.forEach((r, i) => {
      const boss = bosses[i] || {};
      const row = this._addRow(tbody, [
        { val: `第${i+1}章` },
        { val: r.name },
        { val: r.bossName, editable: true, onEdit: (v) => { r.bossName = v; this._saveData(); } },
        { val: r.scale, editable: true, cls: 'num', onEdit: (v) => { r.scale = +v; this._saveData(); } },
      ]);
      this._addActionBtn(row, '编辑Boss', () => {
        const b = bosses[i]; if (b) this._editEnemy(b);
        else this.toast('该章节尚无独立Boss','warning');
      });
    });
    main.appendChild(table);
  },

  // ---- ASSETS ----

  _renderAssets(main) {
    const assets = [
      { name: '主菜单背景', path: '../assets/bg_menu_fan_kuan.jpg', info: '范宽《溪山行旅图》' },
      { name: '战斗背景', path: '../assets/bg_battle_guo_xi.jpg', info: '郭熙《早春图》' },
      { name: '通用背景', path: '../assets/bg_bamboo.jpg', info: '郑燮《竹石图》' },
      { name: '路线图装饰', path: '../assets/bg_map_fuchun.jpg', info: '黄公望《富春山居图》' },
      { name: '剑圣立绘', path: '../assets/char_swordsman.jpg', info: '角色图标' },
      { name: '武圣立绘', path: '../assets/char_martial.jpg', info: '角色图标' },
      { name: '大招演出图', path: '../assets/ultimate_cinematic.jpg', info: '万剑归流演出' },
    ];
    main.innerHTML = this._pageHeader('🖼️ 资产管理') + `
      <p style="color:var(--text-dim);margin-bottom:16px">提示：替换资源文件需通过 Git 或直接在 assets/ 目录替换文件</p>
      <div class="asset-grid">
        ${assets.map(a => `
          <div class="asset-card">
            <img src="${a.path}" alt="${a.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22100%22><rect fill=%22%232a3348%22 width=%22160%22 height=%22100%22/><text x=%2280%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2212%22>无预览</text></svg>'">
            <div class="asset-name">${a.name}</div>
            <div class="asset-meta">${a.info}</div>
          </div>
        `).join('')}
      </div>

      <h3 style="margin-top:24px;margin-bottom:12px;">敌人图标 (基于定义)</h3>
      <div class="asset-grid">
        ${this._data.enemies.slice(0, 8).map(e => `
          <div class="asset-card">
            <div style="width:100%;height:100px;display:flex;align-items:center;justify-content:center;background:#1a2235;border-radius:4px">
              <span style="font-size:48px;color:${e.color || '#b8a684'}">${e.glyph || e.name.charAt(0)}</span>
            </div>
            <div class="asset-name">${e.name}</div>
            <div class="asset-meta">${e.type}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ---- EXPORT ----

  _renderExport(main) {
    const exportData = {
      characters: this._data.characters,
      swordsmanCards: this._data.swordsmanCards,
      martialCards: this._data.martialCards,
      enemies: this._data.enemies,
      equipment: this._data.equipment,
      signatureSwords: this._data.signatureSwords,
      status: this._data.status,
      regions: this._data.regions,
      _changes: this._changes,
    };

    const json = JSON.stringify(exportData, null, 2);
    main.innerHTML = this._pageHeader('💾 导出部署') + `
      <p style="color:var(--text-dim);margin-bottom:16px">下面的 JSON 包含所有修改后的数据。你可以下载并在 data.js 中替换对应部分。</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-primary" onclick="Admin._downloadJSON()">📥 下载 JSON</button>
        <button class="btn btn-success" onclick="Admin._copyJSON()">📋 复制到剪贴板</button>
        <button class="btn" onclick="Admin._showChanges()">📝 查看变更清单 (${this._changeCount})</button>
      </div>
      <div class="json-panel" id="exportPanel">${this._highlightJSON(json)}</div>
      <h3 style="margin-top:20px;margin-bottom:12px;">导入数据</h3>
      <div style="display:flex;gap:8px">
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="Admin._importJSON(event)">
        <button class="btn" onclick="document.getElementById('importFile').click()">📂 选择 JSON 文件导入</button>
        <button class="btn btn-danger" onclick="Admin.resetAll()">🔄 重置所有修改</button>
      </div>
    `;
  },

  _highlightJSON(json) {
    return json
      .replace(/(".*?"):/g, '<span class="key">$1</span>:')
      .replace(/: (".*?")/g, ': <span class="str">$1</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="num">$1</span>');
  },

  _downloadJSON() {
    const data = JSON.stringify(this._exportData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zhilv_data_export.json';
    a.click(); URL.revokeObjectURL(url);
    this.toast('✅ JSON 已下载');
  },

  _copyJSON() {
    const data = JSON.stringify(this._exportData(), null, 2);
    navigator.clipboard.writeText(data).then(() => this.toast('✅ 已复制到剪贴板'));
  },

  _exportData() {
    return {
      CHARACTERS: this._data.characters,
      SWORDSMAN_CARDS: this._data.swordsmanCards,
      MARTIALARTIST_CARDS: this._data.martialCards,
      ENEMIES: this._data.enemies,
      EQUIPMENT: this._data.equipment,
      SIGNATURE_SWORDS: this._data.signatureSwords,
      STATUS: this._data.status,
      REGIONS: this._data.regions,
    };
  },

  _showChanges() {
    const lines = [];
    Object.entries(this._changes).forEach(([cat, items]) => {
      lines.push(`【${cat}】`);
      Object.entries(items).forEach(([id, fields]) => {
        lines.push(`  ${id}:`);
        Object.entries(fields).forEach(([field, { old, new: nval }]) => {
          lines.push(`    ${field}: ${JSON.stringify(old)} → ${JSON.stringify(nval)}`);
        });
      });
    });
    const text = lines.length > 0 ? lines.join('\n') : '暂无变更记录';
    this._showModal('变更清单', `<pre style="font-size:12px;white-space:pre-wrap">${text}</pre>`);
  },

  _importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        // Map imported data to our structure
        if (imported.CHARACTERS) this._data.characters = imported.CHARACTERS;
        if (imported.SWORDSMAN_CARDS) this._data.swordsmanCards = imported.SWORDSMAN_CARDS;
        if (imported.MARTIALARTIST_CARDS) this._data.martialCards = imported.MARTIALARTIST_CARDS;
        if (imported.ENEMIES) this._data.enemies = imported.ENEMIES;
        if (imported.EQUIPMENT) this._data.equipment = imported.EQUIPMENT;
        if (imported.SIGNATURE_SWORDS) this._data.signatureSwords = imported.SIGNATURE_SWORDS;
        if (imported.STATUS) this._data.status = imported.STATUS;
        if (imported.REGIONS) this._data.regions = imported.REGIONS;
        this._changes = imported._changes || {};
        this._changeCount = Object.keys(this._changes).length;
        this._saveData();
        this._renderTab('export');
        this.toast('✅ 数据导入成功');
      } catch(err) {
        this.toast('❌ JSON 格式错误: ' + err.message, 'warning');
      }
    };
    reader.readAsText(file);
  },

  // ---- TABLE UTILS ----

  _pageHeader(title) {
    return `<div class="page-header"><h2>${title}</h2><span class="stats">变更: ${this._changeCount} 项</span></div>`;
  },

  _createTable(headers) {
    const wrap = document.createElement('div');
    wrap.className = 'data-table-wrap';
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody></tbody>`;
    wrap.appendChild(table);
    return wrap;
  },

  _addRow(tbody, cells) {
    const tr = document.createElement('tr');
    cells.forEach(c => {
      const td = document.createElement('td');
      if (typeof c === 'object') {
        if (c.cls) td.className = c.cls;
        td.textContent = c.val != null ? String(c.val) : '';
        if (c.editable) {
          td.classList.add('editable');
          td.title = '点击编辑';
          td.onclick = () => {
            const input = document.createElement('input');
            input.value = td.textContent;
            input.style.cssText = 'width:100%;padding:4px 6px;border:1px solid var(--primary);border-radius:4px;background:var(--bg);color:var(--text);font-size:12px';
            input.onblur = () => {
              td.textContent = input.value;
              if (c.onEdit) c.onEdit(input.value);
            };
            input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
            td.textContent = '';
            td.appendChild(input);
            input.focus();
            input.select();
          };
        }
      } else {
        td.textContent = String(c);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    return tr;
  },

  _addActionBtn(row, text, fn) {
    const td = document.createElement('td');
    td.className = 'action-col';
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.textContent = text;
    btn.onclick = fn;
    td.appendChild(btn);
    row.appendChild(td);
  },

  // ---- MODAL ----

  _showModal(title, content) {
    const modal = document.getElementById('editModal');
    document.getElementById('modalContent').innerHTML = `
      <h3>${title}</h3>${content}
      <div class="modal-actions">
        <button class="btn" onclick="Admin.closeModal()">关闭</button>
      </div>
    `;
    modal.style.display = 'block';
  },

  closeModal() {
    document.getElementById('editModal').style.display = 'none';
  },

  // ---- TOAST ----

  toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'admin-toast';
    el.style.borderColor = type === 'warning' ? 'var(--warning)' : 'var(--success)';
    el.style.color = type === 'warning' ? 'var(--warning)' : 'var(--success)';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  },
};

// Init on load
window.addEventListener('DOMContentLoaded', () => {
  // Wait for data.js to load
  if (typeof CHARACTERS === 'undefined') {
    setTimeout(() => Admin.init(), 100);
  } else {
    Admin.init();
  }
});
