// ============================================================
// 织律 Weaveline - Game Controller
// 国风水墨版：主状态机、UI 管理、战斗演出播放
// ============================================================

class GameController {
  constructor() {
    this.state = 'menu'; // menu | character_select | route_map | battle | reward | shop | rest | game_over
    this.character = null;
    this.skills = [];
    this.equipment = [];
    this.signatureSword = null;
    this.hp = 100;
    this.maxHp = 100;
    this.supply = 0; // 物资
    this.routeMap = null;
    this.currentLayer = 0;
    this.currentNode = null;
    this.battleCore = null;
    this.battleResult = null;
    this.seed = Date.now();
    this.rng = new SeededRandom(this.seed);
    this.speed = 1; // 1x, 2x, 4x
    this.isAnimating = false;
    this.proficiency = {};
    this.pendingUpgrades = [];
    this.regionCleared = false;
    // 演出状态
    this._enemyStatuses = {};   // enemyId -> {status: stacks}
    this._liveIntent = 0;       // 演出用剑意（近似）
    this._liveMomentum = 0;     // 演出用蓄势（近似）
  }

  // ============ INIT ============

  async start() {
    // Init audio on first user interaction
    document.addEventListener('click', () => audio.init(), { once: true });
    document.addEventListener('touchstart', () => audio.init(), { once: true });

    this.showMenu();
  }

  // ============ MENU ============

  showMenu() {
    this.state = 'menu';
    audio.stopBgm();
    document.getElementById('app').innerHTML = `
      <div class="screen menu-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_menu_fan_kuan.jpg')"></div>
        <div class="menu-content">
          <div class="game-title">
            <div class="title-calligraphy">织律</div>
            <div class="seal title-seal">律</div>
            <p class="subtitle">WEAVELINE</p>
            <p class="tagline">构筑你的命运之律</p>
          </div>
          <div class="menu-buttons">
            <button class="btn btn-primary btn-large" onclick="game.selectCharacter()">入 局</button>
            <button class="btn btn-secondary" onclick="game.showHelp()">玩法说明</button>
          </div>
          <div class="menu-version">v0.2 国风水墨 · 垂直切片原型</div>
          <div class="menu-characters">
            <div class="char-preview swordsman">
              <div class="char-icon" style="background-image:url('assets/char_swordsman.jpg')"></div>
              <div class="char-name">剑圣</div>
              <div class="char-desc">灵巧华丽 · 剑气纵横</div>
            </div>
            <div class="char-preview martial">
              <div class="char-icon" style="background-image:url('assets/char_martial.jpg')"></div>
              <div class="char-name">武圣</div>
              <div class="char-desc">大开大合 · 以力破巧</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  showHelp() {
    audio.playUiClick();
    document.getElementById('app').innerHTML = `
      <div class="screen help-screen">
        <div class="panel">
          <h2>玩法说明</h2>
          <div class="help-content">
            <div class="help-section">
              <h3>核心玩法</h3>
              <p>《织律》是一款<strong>自动战斗 Roguelite</strong>。战斗中无需操作，角色会按照你构筑的技能池自动战斗。</p>
            </div>
            <div class="help-section">
              <h3>战斗系统</h3>
              <ul>
                <li>每回合从技能池中<strong>按权重随机抽取</strong>一个技能自动释放</li>
                <li>技能有权重、冷却、自动目标规则</li>
                <li><strong>剑圣</strong>：剑技命中积累「剑意层数」（最多3层，每层+10%伤害）；3层可释放大招，释放后层数-1</li>
                <li><strong>武圣</strong>：积累「蓄势」，达到 3 后触发「重式」爆发</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>路线探索</h3>
              <ul>
                <li>树状路线图，从下往上逐层推进</li>
                <li>每层选择一个节点前进</li>
                <li>节点：战斗 · 精英 · 奇遇 · 商栈 · 改造 · 休整 · 遗宝</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>异常状态</h3>
              <ul>
                <li>灼烧：每回合末按层数造成持续伤害</li>
                <li>破甲：降低目标防御，受击更易受创</li>
              </ul>
            </div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.showMenu()">返回</button>
        </div>
      </div>
    `;
  }

  // ============ CHARACTER SELECT ============

  selectCharacter() {
    audio.playUiClick();
    this.state = 'character_select';
    document.getElementById('app').innerHTML = `
      <div class="screen char-select-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.18"></div>
        <h2 class="screen-title">择 角</h2>
        <p class="screen-subtitle">剑走轻灵 · 拳行厚重</p>
        <div class="char-cards">
          <div class="char-card swordsman" onclick="game.pickCharacter('swordsman')">
            <div class="char-card-head">
              <div class="char-portrait" style="background-image:url('assets/char_swordsman.jpg')"></div>
              <div>
                <h3>剑圣</h3>
                <div class="char-stats">
                  <div class="stat">生命 95</div>
                  <div class="stat">剑意 0-3 层</div>
                  <div class="stat">技能槽 6</div>
                </div>
              </div>
            </div>
            <p>灵巧华丽，招式流动，剑气纵横。剑技命中积累剑意层，每层+10%伤害；3层可释放大招。</p>
            <div class="char-skills-preview">
              <span class="skill-tag">流云刺</span>
              <span class="skill-tag">回风斩</span>
              <span class="skill-tag tag-more">+13</span>
            </div>
            <button class="btn btn-primary btn-block">选择剑圣</button>
          </div>
          <div class="char-card martial" onclick="game.pickCharacter('martialArtist')">
            <div class="char-card-head">
              <div class="char-portrait" style="background-image:url('assets/char_martial.jpg')"></div>
              <div>
                <h3>武圣</h3>
                <div class="char-stats">
                  <div class="stat">生命 92</div>
                  <div class="stat">蓄势 0-3</div>
                  <div class="stat">技能槽 6</div>
                </div>
              </div>
            </div>
            <p>大开大合，以力破巧，拳脚重击。积累蓄势触发重式，内功不结束行动。</p>
            <div class="char-skills-preview">
              <span class="skill-tag">开山拳</span>
              <span class="skill-tag">裂地踢</span>
              <span class="skill-tag tag-more">+10</span>
            </div>
            <button class="btn btn-primary btn-block">选择武圣</button>
          </div>
        </div>
        <button class="btn btn-ghost" onclick="game.showMenu()">← 返回</button>
      </div>
    `;
  }

  pickCharacter(charId) {
    audio.playUiClick();
    const charDef = CHARACTERS[charId];
    this.character = charDef;
    this.skills = [...charDef.startingSkills.map(sid =>
      charDef.skillPool.find(s => s.id === sid)
    )];
    this.maxHp = charDef.maxHp;
    this.hp = charDef.maxHp;
    this.supply = 30;
    this.equipment = [];
    this.signatureSword = null;
    this.powerBuff = 0; // 献祭累计的永久增伤
    this.proficiency = {};
    this.skills.forEach(s => { this.proficiency[s.id] = { xp: 0, level: 1 }; });
    this.seed = Date.now();
    this.rng = new SeededRandom(this.seed);

    // If swordsman, show signature sword selection
    if (charId === 'swordsman') {
      this.selectSignatureSword();
    } else {
      this.startRun();
    }
  }

  selectSignatureSword() {
    this.state = 'sword_select';
    document.getElementById('app').innerHTML = `
      <div class="screen sword-select-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.15"></div>
        <h2 class="screen-title">择 剑</h2>
        <p class="screen-subtitle">每局只执一把名剑，整局锁定</p>
        <div class="sword-cards">
          ${SIGNATURE_SWORDS.slice(0, 4).map(sword => `
            <div class="sword-card" onclick="game.pickSword('${sword.id}')">
              <div class="seal sword-name-seal">${sword.name.charAt(0)}</div>
              <div style="flex:1;min-width:0">
                <h3>${sword.name}</h3>
                <p>${sword.desc}</p>
              </div>
              <button class="btn btn-primary btn-sm">执此剑</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  pickSword(swordId) {
    audio.playUiClick();
    this.signatureSword = SIGNATURE_SWORDS.find(s => s.id === swordId);
    this.startRun();
  }

  // ============ RUN START ============

  startRun() {
    this.currentLayer = 0;
    this.regionCleared = false;
    this.routeMap = generateRouteMap(this.seed);
    this.showRouteMap();
  }

  // ============ ROUTE MAP ============

  showRouteMap() {
    this.state = 'route_map';
    const map = this.routeMap;
    const char = this.character;

    // 清除所有节点的 accessible 标记，然后根据当前位置重新计算
    for (let l = 0; l < map.layers; l++) {
      map.nodes[l].forEach(n => n.accessible = false);
    }

    if (this.currentLayer === 0) {
      // 第 0 层所有节点可选
      map.nodes[0].forEach(n => n.accessible = true);
    } else {
      // 找到上一层的已访问节点，标记其连接节点为可到达
      const prevVisited = map.nodes[this.currentLayer - 1].find(n => n.visited);
      if (prevVisited && prevVisited.connections) {
        map.nodes[this.currentLayer].forEach(n => {
          if (prevVisited.connections.includes(n.id)) n.accessible = true;
        });
      }
    }

    let html = `
      <div class="screen route-screen">
        <div class="route-header">
          <div class="header-left">
            <div class="char-badge">${char.glyph} ${char.name}</div>
            ${this.signatureSword ? `<div class="sword-badge">名剑 · ${this.signatureSword.name}</div>` : ''}
          </div>
          <div class="header-right">
            <div class="resource-display"><span class="res-hp">命</span> ${this.hp}/${this.maxHp}</div>
            <div class="resource-display"><span class="res-supply">物资</span> ${this.supply}</div>
            <button class="btn btn-secondary btn-sm" onclick="game.showStatsPanel()" style="padding:4px 10px;font-size:13px;">属性</button>
          </div>
        </div>
        <div class="route-map-title">行 路 图 · 第 ${this.currentLayer + 1} 层</div>
        <div class="scroll-strip" style="background-image:url('assets/bg_map_fuchun.jpg')"></div>
        <div class="route-map-container" id="routeMapContainer">
          <div class="route-map" id="routeMap">`;

    // Render from top (boss) to bottom
    for (let layer = map.layers - 1; layer >= 0; layer--) {
      html += `<div class="route-layer" data-layer="${layer}">`;
      html += `<div class="layer-label">${layer + 1}</div>`;
      html += `<div class="layer-nodes">`;
      map.nodes[layer].forEach((node, i) => {
        const info = NODE_TYPE_INFO[node.type] || NODE_TYPE_INFO.battle;
        const isCurrent = this.currentLayer === layer && node.visited;
        // 只能选当前层、已标记可到达、且未访问的节点
        const isAccessible = node.accessible && !node.visited && layer === this.currentLayer;
        const isPast = node.visited || layer < this.currentLayer;
        const isFuture = layer > this.currentLayer && !node.accessible;

        let nodeClass = 'route-node';
        if (isCurrent) nodeClass += ' current';
        else if (isAccessible) nodeClass += ' accessible';
        else if (isPast) nodeClass += ' past';
        else nodeClass += ' future';

        html += `
          <div class="${nodeClass}" id="rnode_${layer}_${i}"
               data-node-id="${node.id}"
               style="--node-color:${info.color}"
               onclick="${isAccessible ? `game.selectRouteNode(${layer},${i})` : ''}"
               title="${info.name}">
            <div class="node-glyph">${info.glyph}</div>
            <div class="node-type">${info.name}</div>
          </div>`;
      });
      html += `</div></div>`;
    }

    html += `
          </div>
        </div>
        <div class="route-legend">
          ${Object.entries(NODE_TYPE_INFO).map(([type, info]) =>
            `<span class="legend-item"><span class="legend-glyph" style="color:${info.color}">${info.glyph}</span> ${info.name}</span>`
          ).join('')}
        </div>
      </div>
    `;

    document.getElementById('app').innerHTML = html;
    // 等布局完成后绘制 SVG 墨线连接
    requestAnimationFrame(() => this._drawRouteConnections());
  }

  /** 以 SVG 贝塞尔曲线绘制节点连线（墨色虚线，走过的高亮） */
  _drawRouteConnections() {
    const container = document.getElementById('routeMapContainer');
    const mapEl = document.getElementById('routeMap');
    if (!container || !mapEl || !this.routeMap) return;

    // 移除旧 SVG
    const old = container.querySelector('.route-svg');
    if (old) old.remove();

    const containerRect = mapEl.getBoundingClientRect();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'route-svg');
    svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
    svg.style.height = containerRect.height + 'px';

    const centerOf = (layer, index) => {
      const el = document.getElementById(`rnode_${layer}_${index}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left - containerRect.left + r.width / 2,
        y: r.top - containerRect.top + r.height / 2
      };
    };

    const map = this.routeMap;
    for (let layer = 0; layer < map.layers - 1; layer++) {
      map.nodes[layer].forEach((node, i) => {
        if (!node.connections) return;
        const from = centerOf(layer, i);
        if (!from) return;
        node.connections.forEach(connId => {
          const ni = map.nodes[layer + 1].findIndex(n => n.id === connId);
          if (ni < 0) return;
          const to = centerOf(layer + 1, ni);
          if (!to) return;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const midY = (from.y + to.y) / 2;
          path.setAttribute('d', `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`);
          if (node.visited) path.setAttribute('class', 'route-active');
          else if (layer < this.currentLayer) path.setAttribute('class', 'route-past');
          svg.appendChild(path);
        });
      });
    }
    mapEl.appendChild(svg);
  }

  selectRouteNode(layer, index) {
    audio.playUiClick();
    const node = this.routeMap.nodes[layer][index];
    node.visited = true;
    this.currentLayer = layer;
    this.currentNode = node;

    // 清除同层其他节点的可到达标记，确保每层只能选一个
    this.routeMap.nodes[layer].forEach((n, i) => {
      if (i !== index) n.accessible = false;
    });

    switch (node.type) {
      case 'battle':
        this.startBattle('normal');
        break;
      case 'elite':
        this.startBattle('elite');
        break;
      case 'boss':
        this.startBattle('boss');
        break;
      case 'shop':
        this.showShop();
        break;
      case 'rest':
        this.showRest();
        break;
      case 'upgrade':
        this.showUpgrade();
        break;
      case 'event':
        this.showEvent();
        break;
      case 'treasure':
        this.showTreasure();
        break;
      default:
        this.startBattle('normal');
    }

    // Mark next layer as accessible
    if (layer + 1 < this.routeMap.layers) {
      if (node.connections) {
        this.routeMap.nodes[layer + 1].forEach(n => {
          if (node.connections.includes(n.id)) n.accessible = true;
        });
      }
    }
  }

  // ============ BATTLE ============

  startBattle(type) {
    const encounterRng = new SeededRandom(this.seed + this.currentLayer * 1000);
    const encounter = generateEncounter(this.currentLayer, encounterRng);

    // Override type if needed
    if (type === 'boss') {
      encounter.type = 'boss';
      encounter.enemies = [ENEMIES.find(e => e.type === 'boss')];
    }

    const setup = {
      character: this.character,
      skills: this.skills,
      equipment: this.equipment,
      signatureSword: this.signatureSword,
      powerBuff: this.powerBuff,
      enemies: encounter.enemies.map(e => ({ ...e }))
    };

    this.battleCore = new BattleCore(setup, new SeededRandom(this.seed));
    this.state = 'battle';
    this._enemyStatuses = {};
    this._liveIntent = 0;
    this._liveMomentum = 0;
    // 演出用实时血量（随事件逐帧更新，避免开局即显示结算值）
    this._livePlayerHp = setup.character.maxHp;
    this._liveEnemyHp = encounter.enemies.map(e => e.maxHp);

    audio.playBgm(type === 'boss' ? 'boss' : type === 'elite' ? 'elite' : 'battle');

    // Run to end to get all events
    this.battleResult = this.battleCore.runToEnd();
    this.battleEventIndex = 0;
    this.battleSpeed = 1;

    this._renderBattleUI(type, encounter);
    this._playBattleEvents();
  }

  _renderBattleUI(type, encounter) {
    const char = this.character;
    const enemies = encounter.enemies;
    const sigSword = this.signatureSword;
    const typeName = type === 'boss' ? '首领战' : type === 'elite' ? '精英战' : '遭遇战';
    const resMax = char.resource.max;

    document.getElementById('app').innerHTML = `
      <div class="screen battle-screen">
        <div class="battle-bg" style="background-image:url('assets/bg_battle_guo_xi.jpg')"></div>
        <div class="battle-header">
          <div class="battle-type ${type}">${typeName}</div>
          <div class="battle-speed">
            <button class="speed-btn ${this.battleSpeed === 1 ? 'active' : ''}" onclick="game.setSpeed(1)">1×</button>
            <button class="speed-btn ${this.battleSpeed === 2 ? 'active' : ''}" onclick="game.setSpeed(2)">2×</button>
            <button class="speed-btn ${this.battleSpeed === 4 ? 'active' : ''}" onclick="game.setSpeed(4)">4×</button>
            <button class="speed-btn skip" onclick="game.skipBattle()">略过</button>
          </div>
        </div>

        <div class="battle-arena" id="battleArena">
          <!-- Enemy side（上方） -->
          <div class="enemy-area" id="enemyArea">
            ${enemies.map((e, i) => `
              <div class="enemy-unit ${e.type}" id="enemy_${i}">
                <div class="status-row" id="status_${i}"></div>
                <div class="enemy-sprite">
                  <div class="sprite-enemy" style="--enemy-color:${e.color || '#b8a684'}">${e.glyph || e.name.charAt(0)}</div>
                </div>
                <div class="enemy-name">${e.name}</div>
                <div class="hp-bar-container small">
                  <div class="hp-bar enemy-hp">
                    <div class="hp-fill" style="width:100%"></div>
                  </div>
                  <span class="hp-text">${e.maxHp}/${e.maxHp}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Battle log -->
          <div class="battle-log" id="battleLog">
            <div class="log-content"></div>
          </div>

          <!-- Player side（下方） -->
          <div class="player-area">
            <div class="player-sprite" id="playerSprite">
              <div class="sprite-body ${char.id} has-portrait" style="background-image:url('${char.portrait}')">
                <div class="sprite-aura"></div>
                <span class="sprite-glyph">${char.glyph}</span>
              </div>
              <div class="player-name">${char.name}</div>
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar player-hp" id="playerHpBar">
                <div class="hp-fill" style="width:100%"></div>
              </div>
              <span class="hp-text" id="playerHpText">${this._livePlayerHp}/${this.maxHp}</span>
            </div>
            <div class="resource-indicator">
              <span>${char.resource.name}
                <span class="res-val" id="${char.resource.key}">0</span>/${resMax}
              </span>
              ${sigSword ? `<span style="color:var(--gold)">名剑 · ${sigSword.name}</span>` : ''}
            </div>
            <div class="intent-orbs" id="intentOrbs">
              ${Array.from({length: resMax}, () => `<span class="intent-orb ${char.id === 'martialArtist' ? 'momentum' : ''}"></span>`).join('')}
            </div>
          </div>

          <!-- FX layer -->
          <div class="fx-layer" id="fxLayer"></div>
        </div>

        <div class="battle-footer">
          <div class="battle-skills-preview">
            ${this.skills.map((s, i) => `
              <div class="skill-mini" id="skillChip_${s.id}" title="${s.desc}">
                <span class="skill-mini-icon">${s.tag.charAt(0)}</span>
                <span class="skill-mini-name">${s.name}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="battle-overlay" id="battleOverlay" style="display:none"></div>
      </div>
    `;
  }

  // ============ 演出：事件播放 ============

  /** 不同事件的基础停留时长（毫秒，1× 速度下） */
  _eventDelay(event) {
    const p = event.data?.present;
    switch (event.type) {
      case 'skill_cast': return event.data.chained ? 620 : 950;
      case 'damage': {
        if (!p) return 320;
        if (p.preset === 'execute') return 780;
        if (p.preset === 'heavy' || p.isHeavy) return 560;
        if (p.multiHit) return 300;
        return 380;
      }
      case 'enemy_action': return 700;
      case 'execute': return 1500;
      case 'status_applied': return 150;
      case 'victory': case 'defeat': return 400;
      default: return 120;
    }
  }

  /** 战斗日志去 emoji、状态英文转中文，保持水墨界面纯粹 */
  _cleanLog(l) {
    return l
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/gu, '')
      .replace(/\bburn\b/g, '燃烧')
      .replace(/\barmorBreak\b/g, '破甲')
      .replace(/\batkUp\b/g, '攻击强化')
      .replace(/\s{2,}/g, ' ').trim();
  }

  _playBattleEvents() {
    if (this.state !== 'battle') return;
    if (this.battleEventIndex >= this.battleResult.events.length) {
      this._finishBattle();
      return;
    }

    const event = this.battleResult.events[this.battleEventIndex++];
    const delay = this._eventDelay(event) / this.battleSpeed;

    // Handle different event types visually
    switch (event.type) {
      case 'skill_cast':
        this._showSkillCast(event.data);
        break;
      case 'damage':
        this._showDamage(event.data);
        break;
      case 'enemy_action':
        this._showEnemyAction(event.data);
        break;
      case 'execute':
        this._showExecute(event.data);
        break;
      case 'status_applied':
        this._applyStatusChip(event.data);
        break;
      default:
        break;
    }

    // Update battle log
    if (this.battleResult.log && this.battleEventIndex < this.battleResult.log.length) {
      const logEl = document.getElementById('battleLog');
      if (logEl) {
        const content = logEl.querySelector('.log-content');
        if (content) {
          content.innerHTML = this.battleResult.log
            .slice(Math.max(0, this.battleEventIndex - 8), this.battleEventIndex + 1)
            .map(l => `<div class="log-line">${this._cleanLog(l)}</div>`).join('');
          content.scrollTop = content.scrollHeight;
        }
      }
    }

    // Update HP bars
    this._updateHpBars();

    this._playTimer = setTimeout(() => this._playBattleEvents(), delay);
  }

  // ---------- 技能横幅 ----------
  _showSkillCast(data) {
    const skill = data.skill;
    const overlay = document.getElementById('battleOverlay');
    const isUltimate = skill.tag.includes('绝技') || skill.tag.includes('大招');

    // 高亮当前技能槽
    document.querySelectorAll('.skill-mini').forEach(el => el.classList.remove('active-cast'));
    const chip = document.getElementById(`skillChip_${skill.id}`);
    if (chip) chip.classList.add('active-cast');

    // 演出用资源近似推进
    // 剑技：命中后剑意层数 +1（cap 3）
    if (skill.category === 'sword_technique') {
      if (skill.onHit?.swordIntent) this._liveIntent = Math.min(3, this._liveIntent + 1);
    }
    // 剑气：不增减（已不再消耗剑意）
    // 大招：释放后层数 -1（仅在大于 0 时减少，避免跌破 0）
    if (skill.category === 'sword_ultimate') {
      this._liveIntent = Math.max(0, this._liveIntent - 1);
    }
    if (skill.category === 'fist' || skill.category === 'kick' || skill.category === 'inner_power') {
      this._liveMomentum = Math.min(3, this._liveMomentum + 1);
    }
    this._updateOrbs();

    if (overlay) {
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <div class="cast-banner" id="castBanner">
          <div class="cast-banner-tag ${isUltimate ? 'ultimate' : ''}">${data.chained ? '内功追加 · ' : ''}${skill.tag}</div>
          <div class="cast-banner-name">${skill.name}</div>
          <div class="cast-banner-sub">${data.chained ? '蓄势而发' : `出手权重 ${data.weight?.toFixed(0) || '—'}${data.streak > 1 ? ` · 连出 ${data.streak}` : ''}`}</div>
        </div>
      `;
      const hideDelay = (data.chained ? 560 : 880) / this.battleSpeed;
      setTimeout(() => {
        const banner = document.getElementById('castBanner');
        if (banner) {
          banner.classList.add('out');
          setTimeout(() => {
            if (overlay.contains(banner)) {
              overlay.style.display = 'none';
              overlay.innerHTML = '';
            }
          }, 240 / this.battleSpeed);
        }
      }, hideDelay);
    }

    // 玩家前冲
    const playerSprite = document.getElementById('playerSprite');
    if (playerSprite && skill.category !== 'inner_power') {
      playerSprite.classList.remove('attack-lunge');
      void playerSprite.offsetWidth;
      playerSprite.classList.add('attack-lunge');
    }

    audio.playSfx(skill.castSfx || 'skill_select');
  }

  // ---------- 伤害演出 ----------
  _showDamage(data) {
    // 敌方普攻直接命中玩家（走 damage 事件而非 enemy_action）
    if (data.targetId === 'player') {
      if (typeof data.hpRemaining === 'number') this._livePlayerHp = Math.max(0, data.hpRemaining);
      const playerSprite = document.getElementById('playerSprite');
      if (playerSprite) {
        playerSprite.classList.remove('hit-flash', 'player-hit-recoil');
        void playerSprite.offsetWidth;
        playerSprite.classList.add('hit-flash', 'player-hit-recoil');
        setTimeout(() => playerSprite.classList.remove('hit-flash', 'player-hit-recoil'), 260);

        const popup = document.createElement('div');
        popup.className = 'dmg-popup enemy-dmg';
        popup.textContent = `-${data.amount}`;
        playerSprite.appendChild(popup);
        setTimeout(() => popup.remove(), 950);
      }
      this._shake('light');
      return;
    }

    // 更新敌方实时血量
    const targetIdx = parseInt(String(data.targetId).replace('enemy_', ''), 10);
    if (!isNaN(targetIdx) && typeof data.hpRemaining === 'number') {
      this._liveEnemyHp[targetIdx] = Math.max(0, data.hpRemaining);
    }

    const enemyEl = document.getElementById(data.targetId);
    const p = data.present || {};
    const preset = p.preset || 'standard';
    const category = p.category || 'basic';

    if (enemyEl) {
      // 受击闪白 + 后退
      enemyEl.classList.remove('hit-flash', 'hit-recoil');
      void enemyEl.offsetWidth;
      enemyEl.classList.add('hit-flash', 'hit-recoil');
      setTimeout(() => enemyEl.classList.remove('hit-flash', 'hit-recoil'), 260);

      // 伤害数字（书法字）
      const popup = document.createElement('div');
      popup.className = 'dmg-popup';
      popup.textContent = `-${data.amount}`;
      if (data.tags?.includes('dot') || data.tags?.includes('burn')) popup.classList.add('dot');
      if (data.tags?.includes('crit') || p.isHeavy) popup.classList.add('crit');
      if (data.tags?.includes('execute') || preset === 'execute') popup.classList.add('execute');
      enemyEl.appendChild(popup);
      setTimeout(() => popup.remove(), 950);
    }

    // 类别专属特效
    if (enemyEl) {
      if (category === 'sword_technique') {
        this._spawnSlash(enemyEl, p.isBloom ? '#ecd394' : '#cfe8f5');
      } else if (category === 'sword_qi') {
        this._spawnQiWave(enemyEl, p.isBloom);
        this._spawnSlash(enemyEl, p.isBloom ? '#ecd394' : '#a8d8e8');
      } else if (category === 'fist') {
        this._spawnImpact(enemyEl, '#e8b088');
        this._spawnParticles(enemyEl, '#d98e4a', p.isHeavy ? 10 : 6);
      } else if (category === 'kick') {
        this._spawnImpact(enemyEl, '#e0604a');
        this._spawnParticles(enemyEl, '#e0604a', p.isHeavy ? 10 : 6);
      } else {
        this._spawnParticles(enemyEl, '#cbbc9c', 4);
      }
      if (p.isBloom) this._spawnParticles(enemyEl, '#ecd394', 8);
    }

    // 震屏按打击档位
    const shakeLevel = preset === 'execute' ? 'execute'
      : (preset === 'heavy' || p.isHeavy) ? 'heavy'
      : preset === 'light' ? 'light' : 'standard';
    this._shake(shakeLevel);

    // 重击/处决白闪帧
    if (preset === 'heavy' || preset === 'execute' || p.isHeavy) {
      this._flashFrame();
    }

    // 命中音
    audio.playSfx(p.impactSfx || 'hit');
  }

  // ---------- 敌方行动 ----------
  _showEnemyAction(data) {
    const enemyEl = data.enemyId ? document.getElementById(data.enemyId) : null;
    const playerSprite = document.getElementById('playerSprite');

    // 技能伤害扣减实时血量（敌方技能不走 damage 事件）
    if (typeof data.damage === 'number') {
      this._livePlayerHp = Math.max(0, this._livePlayerHp - data.damage);
    }

    // 敌人前冲
    if (enemyEl) {
      enemyEl.classList.remove('attack-lunge');
      void enemyEl.offsetWidth;
      enemyEl.classList.add('attack-lunge');

      // 敌方技能名小标签
      const tag = document.createElement('div');
      tag.className = 'dmg-popup';
      tag.style.cssText = 'top:-30px;font-size:14px;color:var(--paper-dim);font-family:var(--font-song);letter-spacing:2px;';
      tag.textContent = data.skill;
      enemyEl.appendChild(tag);
      setTimeout(() => tag.remove(), 900);
    }

    // 玩家受击
    if (playerSprite) {
      playerSprite.classList.remove('hit-flash', 'player-hit-recoil');
      void playerSprite.offsetWidth;
      playerSprite.classList.add('hit-flash', 'player-hit-recoil');
      setTimeout(() => playerSprite.classList.remove('hit-flash', 'player-hit-recoil'), 260);

      const popup = document.createElement('div');
      popup.className = 'dmg-popup enemy-dmg';
      popup.textContent = `-${data.damage}`;
      playerSprite.appendChild(popup);
      setTimeout(() => popup.remove(), 950);
    }

    this._shake('standard');
    audio.playSfx('hit');
  }

  // ---------- 处决 ----------
  _showExecute(data) {
    const arena = document.getElementById('battleArena');
    if (arena) {
      const cine = document.createElement('div');
      cine.className = 'execute-cinematic';
      cine.innerHTML = `
        <div class="execute-char">斩</div>
        <div class="execute-label">处 决 · ${data.target}</div>
      `;
      arena.appendChild(cine);
      setTimeout(() => cine.remove(), 950 / this.battleSpeed);
    }
    this._flashFrame();
    this._shake('execute');
    audio.playSfx('execute');
  }

  // ---------- 状态图标 ----------
  _applyStatusChip(data) {
    if (data.targetId === 'player') return;
    const idx = data.targetId.replace('enemy_', '');
    if (!this._enemyStatuses[idx]) this._enemyStatuses[idx] = {};
    this._enemyStatuses[idx][data.status] = data.stacks;
    this._renderStatusChips(idx);
  }

  _renderStatusChips(idx) {
    const row = document.getElementById(`status_${idx}`);
    if (!row) return;
    const names = { burn: '燃', armorBreak: '甲' };
    const statuses = this._enemyStatuses[idx] || {};
    row.innerHTML = Object.entries(statuses)
      .filter(([, stacks]) => stacks > 0)
      .map(([type, stacks]) => `<span class="status-chip ${type}">${names[type] || type}·${stacks}</span>`)
      .join('');
  }

  // ---------- FX 生成器 ----------
  _fxLayer() { return document.getElementById('fxLayer'); }

  _centerIn(el, container) {
    const er = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return { x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 };
  }

  /** 剑技斩击弧光 */
  _spawnSlash(targetEl, color) {
    const layer = this._fxLayer();
    if (!layer) return;
    const c = this._centerIn(targetEl, layer);
    const rot = -55 + Math.random() * 70;
    const size = 96 + Math.random() * 30;
    const gradId = `slashGrad_${++GameController._fxSeq}`;
    const fx = document.createElement('div');
    fx.className = 'slash-fx';
    fx.style.cssText = `left:${c.x - size / 2}px;top:${c.y - size / 2}px;width:${size}px;height:${size}px;--slash-rot:${rot}deg;`;
    fx.innerHTML = `
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0"/>
            <stop offset="45%" stop-color="${color}"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
        <path d="M 8 78 Q 50 8 92 30 Q 55 32 20 88 Z" fill="url(#${gradId})" opacity="0.95"/>
      </svg>`;
    layer.appendChild(fx);
    setTimeout(() => fx.remove(), 340);
  }

  /** 剑气月牙波：从玩家飞向目标 */
  _spawnQiWave(targetEl, isBloom) {
    const layer = this._fxLayer();
    const playerEl = document.getElementById('playerSprite');
    if (!layer || !playerEl) return;
    const from = this._centerIn(playerEl, layer);
    const to = this._centerIn(targetEl, layer);
    const size = isBloom ? 84 : 56;
    const fx = document.createElement('div');
    fx.className = 'qi-wave';
    fx.style.cssText = `left:${from.x - size / 2}px;top:${from.y - size / 2}px;width:${size}px;height:${size}px;
      --fx-from-x:0px;--fx-from-y:0px;--fx-to-x:${to.x - from.x}px;--fx-to-y:${to.y - from.y}px;`;
    const color = isBloom ? '#ecd394' : '#a8d8e8';
    fx.innerHTML = `
      <svg viewBox="0 0 100 100" width="100%" height="100%" style="transform:rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI - 45}deg)">
        <path d="M 50 4 A 46 46 0 0 1 96 50 A 60 60 0 0 0 50 4 Z" fill="${color}" opacity="0.9"/>
        <path d="M 50 14 A 36 36 0 0 1 86 50 A 48 48 0 0 0 50 14 Z" fill="#ffffff" opacity="0.55"/>
      </svg>`;
    layer.appendChild(fx);
    setTimeout(() => fx.remove(), 460);
  }

  /** 拳脚冲击环 */
  _spawnImpact(targetEl, color) {
    const layer = this._fxLayer();
    if (!layer) return;
    const c = this._centerIn(targetEl, layer);
    const fx = document.createElement('div');
    fx.className = 'impact-ring';
    const size = 110;
    fx.style.cssText = `left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;--impact-color:${color};`;
    layer.appendChild(fx);
    setTimeout(() => fx.remove(), 380);
  }

  /** 墨点/火花粒子 */
  _spawnParticles(targetEl, color, count) {
    const layer = this._fxLayer();
    if (!layer) return;
    const c = this._centerIn(targetEl, layer);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'ink-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 46;
      const size = 3 + Math.random() * 5;
      p.style.cssText = `left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;
        --dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;--particle-color:${color};`;
      layer.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  /** 震屏 */
  _shake(level) {
    const arena = document.getElementById('battleArena');
    if (!arena) return;
    arena.classList.remove('shake-light', 'shake-standard', 'shake-heavy', 'shake-execute');
    void arena.offsetWidth;
    arena.classList.add(`shake-${level}`);
    setTimeout(() => arena.classList.remove(`shake-${level}`), 560);
  }

  /** 白闪帧 */
  _flashFrame() {
    const arena = document.getElementById('battleArena');
    if (!arena) return;
    const f = document.createElement('div');
    f.className = 'flash-frame';
    arena.appendChild(f);
    setTimeout(() => f.remove(), 200);
  }

  /** 剑意/蓄势珠 */
  _updateOrbs() {
    const orbs = document.getElementById('intentOrbs');
    if (!orbs) return;
    const val = this.character.id === 'swordsman' ? this._liveIntent : this._liveMomentum;
    Array.from(orbs.children).forEach((orb, i) => {
      orb.classList.toggle('filled', i < val);
    });
    const resEl = document.getElementById(this.character.resource.key);
    if (resEl) resEl.textContent = val;
  }

  _updateHpBars() {
    const result = this.battleResult;

    // Player HP（实时演出值）
    const playerHpBar = document.getElementById('playerHpBar');
    if (playerHpBar) {
      const live = Math.max(0, this._livePlayerHp);
      const fill = playerHpBar.querySelector('.hp-fill');
      if (fill) fill.style.width = `${(live / result.player.maxHp * 100)}%`;
      const text = document.getElementById('playerHpText');
      if (text) text.textContent = `${live}/${result.player.maxHp}`;
    }

    // Enemy HP（实时演出值）
    result.enemies.forEach((enemy, i) => {
      const el = document.getElementById(`enemy_${i}`);
      if (el) {
        const live = Math.max(0, this._liveEnemyHp[i] ?? enemy.hp);
        if (live <= 0 && !el.classList.contains('dead')) {
          el.classList.add('dead');
          // 清除状态图标
          const row = document.getElementById(`status_${i}`);
          if (row) row.innerHTML = '';
        }
        const hpBar = el.querySelector('.hp-bar');
        if (hpBar) {
          const fill = hpBar.querySelector('.hp-fill');
          if (fill) fill.style.width = `${(live / enemy.maxHp * 100)}%`;
          const text = hpBar.nextElementSibling;
          if (text) text.textContent = `${live}/${enemy.maxHp}`;
        }
      }
    });
  }

  setSpeed(speed) {
    this.battleSpeed = speed;
    audio.playUiClick();
    // Update buttons
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.speed-btn:nth-child(${speed === 1 ? 1 : speed === 2 ? 2 : 3})`)?.classList.add('active');
  }

  skipBattle() {
    audio.playUiClick();
    if (this._playTimer) clearTimeout(this._playTimer);
    // 直接落到最终状态
    if (this.battleResult) {
      this._livePlayerHp = Math.max(0, this.battleResult.player.hp);
      this.battleResult.enemies.forEach((e, i) => { this._liveEnemyHp[i] = Math.max(0, e.hp); });
    }
    this._updateHpBars();
    this._finishBattle();
  }

  _finishBattle() {
    if (this._playTimer) { clearTimeout(this._playTimer); this._playTimer = null; }
    if (this.state !== 'battle') return;
    this.state = 'battle_end';
    audio.stopBgm();
    const result = this.battleResult;
    this.hp = Math.max(0, result.player.hp);
    this.proficiency = result.proficiency;
    this.pendingUpgrades = result.pendingUpgrades || [];

    if (result.defeat) {
      this.showGameOver();
      return;
    }

    if (result.victory) {
      // Calculate rewards
      const isBoss = this.currentNode?.type === 'boss';
      const isElite = this.currentNode?.type === 'elite';
      const supplyReward = isBoss ? this.rng.nextInt(45, 60) : isElite ? this.rng.nextInt(28, 40) : this.rng.nextInt(12, 18);
      this.supply += supplyReward;

      // 战利品
      const lootOptions = this._generateLoot(isBoss, isElite);

      // If boss, mark region cleared
      if (isBoss) {
        this.regionCleared = true;
        audio.playBgm('victory');
      }

      this.showBattleReward(supplyReward, lootOptions, result);
    }
  }

  _generateLoot(isBoss, isElite) {
    const options = [];
    const pool = this.character.skillPool;
    const existingIds = this.skills.map(s => s.id);

    // 新技能奖励
    const newSkills = pool.filter(s => !existingIds.includes(s.id));
    const shuffledNew = this.rng.shuffle([...newSkills]);
    const newCount = Math.min(2, shuffledNew.length);
    for (let i = 0; i < newCount; i++) {
      options.push({ type: 'skill', data: shuffledNew[i], isDuplicate: false });
    }

    // 重复技能奖励（已有技能 → 提升熟练度）；首领战不再给熟练奖励，专供神话装备
    if (!isBoss && this.skills.length > 0) {
      const duplicates = this.skills.filter(s => {
        const prof = this.proficiency[s.id];
        return prof && prof.level < 5;
      });
      if (duplicates.length > 0) {
        const shuffledDup = this.rng.shuffle([...duplicates]);
        options.push({ type: 'skill', data: shuffledDup[0], isDuplicate: true });
      }
    }

    const existingEqIds = this.equipment.map(eq => eq.id);
    const mythicPool = EQUIPMENT.filter(eq => eq.rarity === '神话' && !existingEqIds.includes(eq.id));

    if (isBoss) {
      // 神话装备：仅击败每层最终首领时作为保证奖励掉落
      if (mythicPool.length > 0) {
        options.push({ type: 'equipment', data: this.rng.pick(mythicPool), isMythic: true });
      }
    } else {
      // 普通/精英战斗：从非常稀有装备池中抽取，绝不掉落神话
      const normalEq = EQUIPMENT.filter(eq => eq.rarity !== '神话' && !existingEqIds.includes(eq.id));
      if (normalEq.length > 0 && (isElite || this.rng.nextFloat() < 0.25)) {
        options.push({ type: 'equipment', data: this.rng.pick(normalEq) });
      }
    }

    return this.rng.shuffle(options).slice(0, 3);
  }

  showBattleReward(supplyReward, lootOptions, result) {
    this.state = 'reward';
    this._lootOptions = lootOptions; // 存储以供 pickLoot 使用

    document.getElementById('app').innerHTML = `
      <div class="screen reward-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.14"></div>
        <div class="panel victory-panel">
          <h2>凯 旋</h2>
          <div class="reward-summary">
            <div class="reward-item">物资 <span class="hl">+${supplyReward}</span>（共 ${this.supply}）</div>
            <div class="reward-item">剩余生命 <span class="hl">${this.hp}/${this.maxHp}</span></div>
            <div class="reward-item">回合数 <span class="hl">${result.rounds}</span></div>
          </div>

          <div class="battle-stats">
            <h3>战斗统计</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-val">${result.rounds}</div>
                <div class="stat-label">回合</div>
              </div>
              <div class="stat-item">
                <div class="stat-val">${Object.values(result.proficiency).reduce((s,p) => s + p.xp, 0)}</div>
                <div class="stat-label">熟练经验</div>
              </div>
            </div>
          </div>

          ${lootOptions.length > 0 ? `
          <div class="loot-section">
            <h3>择一奖励（技能池 ${this.skills.length}/${this.character.skillSlots}）</h3>
            <div class="loot-cards">
              ${lootOptions.map((opt, i) => {
                const existingProf = opt.type === 'skill' && opt.isDuplicate ? (this.proficiency[opt.data.id] || { level: 1, xp: 0 }) : null;
                const nextLevelXp = existingProf ? [0, 4, 12, 26, 48][Math.min(4, existingProf.level)] : null;
                return `
                <div class="loot-card${opt.type === 'equipment' && opt.isMythic ? ' loot-card-mythic' : ''}" onclick="game.pickLoot(${i})">
                  ${opt.type === 'skill' ? `
                    <div class="seal loot-icon">${opt.isDuplicate ? '↑' : opt.data.name.charAt(0)}</div>
                    <div class="loot-name">${opt.data.name} ${opt.isDuplicate ? '<span class="loot-upgrade-badge">进阶</span>' : ''}</div>
                    <div class="loot-desc">${opt.data.desc}</div>
                    ${opt.isDuplicate ? `
                    <div class="loot-upgrade-info">
                      <span>当前 Lv${existingProf.level}</span>
                      <span>熟练 ${existingProf.xp}/${nextLevelXp}</span>
                      <span class="loot-upgrade-gain">→ 获得 +8 熟练经验</span>
                    </div>
                    ` : `
                    <div class="loot-tags">
                      <span class="tag">${opt.data.tag}</span>
                      <span class="tag">权重 ${opt.data.baseWeight}</span>
                      <span class="tag">冷却 ${opt.data.cooldown}</span>
                    </div>
                    `}
                  ` : `
                    <div class="seal loot-icon">器</div>
                    <div class="loot-name">${opt.data.name} <span class="loot-rarity ${opt.data.rarity}">${opt.data.rarity}</span></div>
                    <div class="loot-desc">${opt.data.desc}</div>
                  `}
                  <button class="btn btn-primary btn-sm">取之</button>
                </div>
                `;
              }).join('')}
            </div>
          </div>
          ` : '<p>此行无有可取之获</p>'}

          <div class="reward-actions">
            ${this.pendingUpgrades.length > 0 ? `
            <button class="btn btn-accent" onclick="game.showPendingUpgrades()">
              处理熟练升级 (${this.pendingUpgrades.length})
            </button>
            ` : ''}
            <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">
              继续探索 →
            </button>
          </div>
        </div>
      </div>
    `;
  }

  pickLoot(index) {
    audio.playUiClick();
    const lootOptions = this._lootOptions;
    if (!lootOptions || index >= lootOptions.length) return;

    const opt = lootOptions[index];
    const lootCards = document.querySelectorAll('.loot-card');
    lootCards.forEach((card, i) => {
      if (i !== index) card.style.opacity = '0.4';
      else card.classList.add('picked');
    });
    setTimeout(() => {
      document.querySelectorAll('.loot-card button').forEach(b => b.disabled = true);
    }, 300);

    // 真正应用奖励
    if (opt.type === 'skill') {
      if (opt.isDuplicate) {
        // 重复技能：提升熟练度
        const prof = this.proficiency[opt.data.id];
        if (prof) {
          const xpGain = 8;
          prof.xp += xpGain;
          const oldLevel = prof.level;
          const newLevel = this._calcProficiencyLevel(prof.xp);
          prof.level = newLevel;
          const boostMsg = newLevel > oldLevel
            ? `「${opt.data.name}」熟练提升！Lv${oldLevel} → Lv${newLevel}`
            : `「${opt.data.name}」熟练 +${xpGain}（当前 Lv${prof.level}，${prof.xp}/${[0,4,12,26,48][Math.min(4, prof.level)]}）`;
          this._showLootToast(boostMsg);
        }
      } else {
        // 新技能
        if (this.skills.length >= this.character.skillSlots) {
          // 槽已满：替换第一个技能
          const replaced = this.skills[0];
          this.skills.shift();
          delete this.proficiency[replaced.id];
          this._showLootToast(`替换「${replaced.name}」，习得「${opt.data.name}」`);
        }
        this.skills.push(opt.data);
        this.proficiency[opt.data.id] = { xp: 0, level: 1 };
        if (!opt.isDuplicate) {
          this._showLootToast(`习得新技能「${opt.data.name}」`);
        }
      }
    } else if (opt.type === 'equipment') {
      this.equipment.push(opt.data);
      this._showLootToast(`获得装备「${opt.data.name}」`);
    }

    audio.playSfx('skill_select');
  }

  _calcProficiencyLevel(xp) {
    if (xp >= 48) return 5;
    if (xp >= 26) return 4;
    if (xp >= 12) return 3;
    if (xp >= 4) return 2;
    return 1;
  }

  _showLootToast(msg) {
    const existing = document.querySelector('.loot-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'loot-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  continueAfterBattle() {
    audio.playUiClick();
    if (this.regionCleared) {
      this.showVictoryScreen();
    } else {
      this.currentLayer++;
      if (this.currentLayer >= this.routeMap.layers) {
        this.regionCleared = true;
        this.showVictoryScreen();
      } else {
        this.showRouteMap();
      }
    }
  }

  // ============ SHOP ============

  showShop() {
    this.state = 'shop';
    const shopSkills = this.rng.shuffle([...this.character.skillPool])
      .filter(s => !this.skills.find(es => es.id === s.id))
      .slice(0, 3);

    document.getElementById('app').innerHTML = `
      <div class="screen shop-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.14"></div>
        <div class="panel">
          <h2>商 栈</h2>
          <p>物资 <span style="color:var(--gold-bright)">${this.supply}</span></p>

          <div class="shop-section">
            <h3>技能（55 - 80 物资）</h3>
            <div class="shop-items">
              ${shopSkills.map((s, i) => `
                <div class="shop-item">
                  <div class="seal shop-item-icon">${s.name.charAt(0)}</div>
                  <div class="shop-item-info">
                    <div class="shop-item-name">${s.name}</div>
                    <div class="shop-item-desc">${s.desc}</div>
                    <div class="shop-item-tags">
                      <span class="tag">${s.tag}</span>
                      <span class="tag">权重 ${s.baseWeight}</span>
                    </div>
                  </div>
                  <div class="shop-item-price">
                    <span>${60 + i * 10} 物资</span>
                    <button class="btn btn-primary btn-sm" ${this.supply >= (60+i*10) ? '' : 'disabled'}
                      onclick="game.buySkill('${s.id}', ${60+i*10})">购</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="shop-section">
            <h3>杂项</h3>
            <div class="shop-services">
              <div class="shop-item">
                <span>疗愈 · 恢复 30% 生命</span>
                <span>30 物资</span>
                <button class="btn btn-secondary btn-sm" onclick="game.buyHeal(30)">疗愈</button>
              </div>
              <div class="shop-item">
                <span>随机遗忘 · 移除随机一个技能</span>
                <span>35 物资</span>
                <button class="btn btn-secondary btn-sm" onclick="game.forgetRandomSkill()">随机遗忘</button>
              </div>
            </div>
          </div>

          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">
            离开商栈 →
          </button>
        </div>
      </div>
    `;
  }

  buySkill(skillId, price) {
    if (this.supply < price) return;
    audio.playUiClick();
    const skill = this.character.skillPool.find(s => s.id === skillId);
    if (!skill) return;

    if (this.skills.length >= this.character.skillSlots) {
      this.skills[0] = skill;
    } else {
      this.skills.push(skill);
    }
    this.supply -= price;
    this.proficiency[skillId] = { xp: 0, level: 1 };
    this.showShop();
  }

  buyHeal(cost) {
    if (this.supply < cost) return;
    audio.playUiClick();
    this.supply -= cost;
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.3));
    this.showShop();
  }

  forgetRandomSkill() {
    if (this.skills.length <= 1) return;
    audio.playUiClick();
    if (this.supply < 35) return;
    const idx = this.rng.nextInt(0, this.skills.length - 1);
    const removed = this.skills[idx];
    this.skills.splice(idx, 1);
    delete this.proficiency[removed.id];
    this.supply -= 35;
    this._renderAfterForget(`随机遗忘了【${removed.name}】`);
  }

  forgetSkill(skillId) {
    if (this.skills.length <= 1) return;
    audio.playUiClick();
    if (this.supply < 50) return;
    const idx = this.skills.findIndex(s => s.id === skillId);
    if (idx < 0) return;
    const removed = this.skills[idx];
    this.skills.splice(idx, 1);
    delete this.proficiency[removed.id];
    this.supply -= 50;
    this._renderAfterForget(`遗忘了【${removed.name}】`);
  }

  _renderAfterForget(msg) {
    if (msg) this.toast(msg);
    if (this.state === 'upgrade') this.showUpgrade();
    else this.showShop();
  }

  // 轻量提示（无需阻断操作）
  toast(text) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = 'wl-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ============ REST ============

  showRest() {
    this.state = 'rest';
    const healAmount = Math.floor(this.maxHp * 0.25);
    const alreadyRested = this.currentNode && this.currentNode.rested;

    document.getElementById('app').innerHTML = `
      <div class="screen rest-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.16"></div>
        <div class="panel">
          <h2>休 整</h2>
          <p>竹影婆娑，暂且歇脚。</p>

          <div class="rest-options">
            ${alreadyRested ? `
            <div class="rest-card rested">
              <div class="rest-icon">✓</div>
              <h3>已休整</h3>
              <p>此处已歇过，不可再憩。</p>
              <p class="rest-current">当前生命 ${this.hp}/${this.maxHp}</p>
            </div>
            ` : `
            <div class="rest-card" onclick="game.doRest()">
              <div class="rest-icon">憩</div>
              <h3>小憩</h3>
              <p>恢复 ${healAmount} 生命</p>
              <p class="rest-current">当前生命 ${this.hp}/${this.maxHp}</p>
              <button class="btn btn-primary">休息一下</button>
            </div>
            `}
          </div>

          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">
            ${alreadyRested ? '继续赶路 →' : '不休息，继续赶路 →'}
          </button>
        </div>
      </div>
    `;
  }

  doRest() {
    audio.playUiClick();
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.25));
    if (this.currentNode) this.currentNode.rested = true;
    this.showRest();
  }

  // ============ STATS PANEL ============

  showStatsPanel() {
    audio.playUiClick();
    const char = this.character;
    const proficiencyLevels = [0, 4, 12, 26, 48]; // XP thresholds for L1-5

    // 计算技能槽连携加成
    const synergyTags = this.skills.map(s => s.tag);
    let synergyInfo = '';
    for (let i = 0; i < this.skills.length - 1; i++) {
      if (this.skills[i].tag === this.skills[i + 1].tag) {
        synergyInfo += `<div class="synergy-link">${this.skills[i].name} ↔ ${this.skills[i + 1].name}：同标签 +6%</div>`;
      }
    }

    // 计算各技能基准出手率
    const totalWeight = this.skills.reduce((sum, s) => sum + s.baseWeight, 0);

    const panelHtml = `
      <div class="stats-overlay" id="statsOverlay" onclick="game.closeStatsPanel()">
        <div class="stats-panel" onclick="event.stopPropagation()">
          <div class="stats-header">
            <h2><span class="stats-portrait" style="background-image:url('${char.portrait}')"></span> ${char.name} · 当前属性</h2>
            <button class="btn btn-ghost btn-sm" onclick="game.closeStatsPanel()">✕</button>
          </div>

          <div class="stats-section">
            <div class="stats-grid-3">
              <div class="stat-card">
                <div class="stat-card-val">${this.hp}/${this.maxHp}</div>
                <div class="stat-card-label">生命</div>
              </div>
              <div class="stat-card">
                <div class="stat-card-val">${this.supply}</div>
                <div class="stat-card-label">物资</div>
              </div>
              <div class="stat-card">
                <div class="stat-card-val">${char.skillSlots}</div>
                <div class="stat-card-label">技能槽</div>
              </div>
            </div>
            ${this.signatureSword ? `
            <div class="stats-subsection">
              <h4>名剑</h4>
              <div class="sword-info">
                <span class="sword-name-tag">${this.signatureSword.name}</span>
                <span class="sword-desc">${this.signatureSword.desc}</span>
              </div>
            </div>
            ` : ''}
            ${char.id === 'martialArtist' ? `
            <div class="stats-subsection">
              <h4>专属资源</h4>
              <span class="resource-tag">蓄势 0–3</span>
              <span class="resource-desc">每行动+1蓄势，满3触发重式×1.75</span>
            </div>
            ` : `
            <div class="stats-subsection">
              <h4>专属资源</h4>
              <span class="resource-tag">剑意 0–3 层</span>
              <span class="resource-desc">剑技命中层数+1，每层+10%伤害；3层可释放大招</span>
            </div>
            `}
            ${this.equipment.length > 0 ? `
            <div class="stats-subsection">
              <h4>装备 (${this.equipment.length}件)</h4>
              ${this.equipment.map(eq => `
                <div class="equip-item">
                  <span class="equip-name">${eq.name}</span>
                  <span class="equip-rarity ${eq.rarity}">${eq.rarity}</span>
                  <span class="equip-desc">${eq.desc}</span>
                </div>
              `).join('')}
            </div>
            ` : ''}
          </div>

          <div class="stats-section">
            <h3>技能组合 (${this.skills.length}/${char.skillSlots})</h3>
            <div class="skills-table">
              ${this.skills.map((s, i) => {
                const prof = this.proficiency[s.id] || { xp: 0, level: 1 };
                const rawWeight = s.baseWeight;
                const castRate = totalWeight > 0 ? (rawWeight / totalWeight * 100).toFixed(1) : '—';
                const profXp = prof.xp;
                const nextLevel = proficiencyLevels[Math.min(4, prof.level)];
                const xpNeeded = nextLevel > profXp ? nextLevel - profXp : '—';
                return `
                <div class="skill-row" style="--skill-color:${s.category === 'sword_qi' ? '#a8d8e8' : s.category === 'sword_technique' ? '#cfe8f5' : s.category === 'fist' ? '#e8b088' : s.category === 'kick' ? '#e0604a' : '#cbbc9c'}">
                  <div class="skill-slot-num">${i + 1}</div>
                  <div class="skill-info-main">
                    <div class="skill-name-row">
                      <span class="skill-name">${s.name}</span>
                      <span class="skill-tag-sm">${s.tag}</span>
                      <span class="skill-lv">Lv${prof.level}</span>
                    </div>
                    <div class="skill-desc-sm">${s.desc}</div>
                    <div class="skill-meta">
                      <span>权重 ${rawWeight}</span>
                      <span>基准出手率 ${castRate}%</span>
                      <span>冷却 ${s.cooldown}回合</span>
                      <span>熟练 ${profXp}/${nextLevel === '—' ? 'MAX' : nextLevel}${xpNeeded !== '—' ? ' (+'+xpNeeded+')' : ''}</span>
                    </div>
                  </div>
                </div>
                `;
              }).join('')}
            </div>
            ${synergyInfo ? `
            <div class="synergy-section">
              <h4>槽位连携</h4>
              ${synergyInfo}
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // 在body上追加overlay，点击外部关闭
    const existing = document.getElementById('statsOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'statsOverlay';
    overlay.innerHTML = panelHtml;
    // 用 innerHTML 方式挂载，需要重新设置事件
    document.body.appendChild(overlay);
    // 重新绑定关闭事件
    document.getElementById('statsOverlay').onclick = function(e) {
      if (e.target === this) game.closeStatsPanel();
    };
  }

  closeStatsPanel() {
    audio.playUiClick();
    const overlay = document.getElementById('statsOverlay');
    if (overlay) overlay.remove();
  }

  // ============ UPGRADE ============

  showUpgrade() {
    this.state = 'upgrade';
    document.getElementById('app').innerHTML = `
      <div class="screen upgrade-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.14"></div>
        <div class="panel">
          <h2>改 造 站</h2>
          <p>锤炼技艺，百炼成钢。物资 <span style="color:var(--gold-bright)">${this.supply}</span></p>

          <div class="upgrade-actions">
            <button class="btn btn-ghost btn-sm" onclick="game.forgetRandomSkill()" ${this.supply >= 35 ? '' : 'disabled'}>
              35 物资 · 随机遗忘一个技能
            </button>
          </div>

          <div class="upgrade-list">
            ${this.skills.map(s => {
              const prof = this.proficiency[s.id];
              const canForget = this.skills.length > 1 && this.supply >= 50;
              return `
                <div class="upgrade-item">
                  <div class="upgrade-info">
                    <div class="upgrade-name">${s.name} <span class="tag">Lv${prof?.level || 1}</span></div>
                    <div class="upgrade-desc">${s.desc}</div>
                  </div>
                  <div class="upgrade-btns">
                    <button class="btn btn-secondary btn-sm" onclick="game.upgradeSkill('${s.id}')" ${this.supply >= 65 ? '' : 'disabled'}>
                      65 物资 升级
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="game.forgetSkill('${s.id}')" ${canForget ? '' : 'disabled'}>
                      50 物资 遗忘
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">
            离开 →
          </button>
        </div>
      </div>
    `;
  }

  upgradeSkill(skillId) {
    if (this.supply < 65) return;
    audio.playUiClick();
    this.supply -= 65;
    if (this.proficiency[skillId]) {
      this.proficiency[skillId].xp += 12;
      this.proficiency[skillId].level = Math.min(5, this.proficiency[skillId].level + 1);
    }
    this.showUpgrade();
  }

  // ============ EVENT ============

  showEvent() {
    const events = [
      { title: '神秘商人', desc: '一位蒙面商人向你兜售奇物。', choice: '购买随机装备（40 物资）', effect: 'buy' },
      { title: '古老祭坛', desc: '一座荒废的祭坛散发着微弱光芒。', choice: '献祭 10 生命换取力量', effect: 'sacrifice' },
      { title: '流浪剑客', desc: '一位流浪剑客提出用一件装备换取你的物资。', choice: '用 30 物资换装备', effect: 'trade' },
      { title: '草药园', desc: '你发现了一片野生草药园。', choice: '采集草药恢复生命', effect: 'heal' }
    ];
    const event = this.rng.pick(events);
    this.currentEvent = event;

    this.state = 'event';
    document.getElementById('app').innerHTML = `
      <div class="screen event-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.16"></div>
        <div class="panel">
          <h2>奇遇 · ${event.title}</h2>
          <p>${event.desc}</p>
          <div class="event-choices">
            <button class="btn btn-primary" onclick="game.handleEvent('accept')">
              ${event.choice}
            </button>
            <button class="btn btn-ghost" onclick="game.continueAfterBattle()">
              拂袖而去
            </button>
          </div>
        </div>
      </div>
    `;
  }

  handleEvent(action) {
    audio.playUiClick();
    const ev = this.currentEvent;
    if (action === 'accept' && ev) {
      switch (ev.effect) {
        case 'buy': // 神秘商人：40 物资换随机装备
          if (this.supply >= 40) {
            this.supply -= 40;
            const eq = this.rng.pick(EQUIPMENT);
            this.equipment.push(eq);
            alert(`获得装备：${eq.name}！`);
          } else {
            alert('物资不足，无法购买！');
          }
          break;
        case 'trade': // 流浪剑客：30 物资换装备
          if (this.supply >= 30) {
            this.supply -= 30;
            const eq = this.rng.pick(EQUIPMENT);
            this.equipment.push(eq);
            alert(`获得装备：${eq.name}！`);
          } else {
            alert('物资不足，无法交易！');
          }
          break;
        case 'heal': // 草药园：恢复生命
          this.hp = Math.min(this.maxHp, this.hp + 25);
          alert('采集草药，生命恢复 +25！');
          break;
        case 'sacrifice': // 古老祭坛：献祭 10 生命换永久力量
          if (this.hp > 10) {
            this.hp -= 10;
            this.powerBuff += 0.08;
            alert('献祭生命，力量长存（永久增伤 +8%）！');
          } else {
            this.hp = Math.min(this.maxHp, this.hp + 15);
            alert('命悬一线，祭坛反哺你些许生机（+15 生命）。');
          }
          break;
      }
    }
    this.currentEvent = null;
    this.continueAfterBattle();
  }

  showTreasure() {
    const eq = this.rng.pick(EQUIPMENT);
    this.equipment.push(eq);
    this.supply += this.rng.nextInt(20, 40);
    alert(`遗宝：获得「${eq.name}」与物资！`);
    this.continueAfterBattle();
  }

  // ============ GAME OVER / VICTORY ============

  showGameOver() {
    this.state = 'game_over';
    audio.playBgm('defeat');
    setTimeout(() => audio.stopBgm(), 1500);

    const researchPoints = 18 + Math.floor(Object.values(this.proficiency).reduce((s, p) => s + p.xp, 0) / 4);

    document.getElementById('app').innerHTML = `
      <div class="screen gameover-screen">
        <div class="panel defeat-panel">
          <h2>折 戟</h2>
          <div class="result-summary">
            <div class="result-item">抵达层数：第 ${this.currentLayer + 1} 层</div>
            <div class="result-item">击败敌人：${this.battleResult?.enemies?.filter(e=>!e.alive)?.length || 0}</div>
            <div class="result-item">研究点：+${researchPoints}</div>
          </div>
          <div class="battle-log-summary">
            <h3>战斗回顾</h3>
            <div class="log-scroll">
              ${(this.battleResult?.log || []).slice(-15).map(l => `<div class="log-line">${this._cleanLog(l)}</div>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.showMenu()">
            返回主菜单
          </button>
          <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="game.pickCharacter('${this.character.id}')">
            再试一次
          </button>
        </div>
      </div>
    `;
  }

  showVictoryScreen() {
    this.state = 'game_over';
    audio.playBgm('victory');
    setTimeout(() => audio.stopBgm(), 1000);

    const researchPoints = 35 + 18 * 2 + Math.floor(Object.values(this.proficiency).reduce((s, p) => s + p.xp, 0) / 4);

    document.getElementById('app').innerHTML = `
      <div class="screen victory-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_menu_fan_kuan.jpg');opacity:0.3"></div>
        <div class="panel victory-final-panel">
          <h2>登 峰</h2>
          <div class="victory-title">—— 《织律》掌握者 ——</div>
          <div class="result-summary">
            <div class="result-item">剩余生命：${this.hp}/${this.maxHp}</div>
            <div class="result-item">物资：${this.supply}</div>
            <div class="result-item">研究点：+${researchPoints}</div>
            <div class="result-item">装备：${this.equipment.length} 件</div>
          </div>
          <div class="result-character">
            <div class="char-badge large">
              ${this.character.glyph} ${this.character.name}
              ${this.signatureSword ? ` · ${this.signatureSword.name}` : ''}
            </div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.showMenu()">
            返回主菜单
          </button>
          <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="game.selectCharacter()">
            换个角色再战
          </button>
        </div>
      </div>
    `;
  }
}

// Global instance
GameController._fxSeq = 0;
const game = new GameController();
