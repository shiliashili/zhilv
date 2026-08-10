// ============================================================
// 织律 Weaveline v1.4 - Game Controller
// 卡牌战斗重构：手牌选择、能量管理、敌人意图、牌堆系统
// ============================================================

class GameController {
  constructor() {
    this.state = 'menu';
    this.character = null;
    this.cards = [];          // Current deck cardIds
    this.equipment = [];
    this.signatureSword = null;
    this.hp = 100;
    this.maxHp = 100;
    this.supply = 0;
    this.routeMap = null;
    this.currentLayer = 0;
    this.currentNode = null;
    this.battleCore = null;
    this.battleResult = null;
    this.seed = Date.now();
    this.rng = new SeededRandom(this.seed);
    this.proficiency = {};
    this.pendingUpgrades = [];
    this.regionCleared = false;
    this.powerBuff = 0;
    this.currentRegion = 0;
    // Battle UI state
    this._targetMode = null;  // null | { cardInstanceId, targetMode }
    this._battleType = 'normal';
    this._animating = false;  // 动画播放中，阻止重复操作
  }

  async start() {
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
          <div class="menu-version">v1.4 卡牌重构 · 抽牌/能量/主动打牌</div>
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
          <h2>玩法说明 v1.4</h2>
          <div class="help-content">
            <div class="help-section">
              <h3>核心玩法</h3>
              <p>每回合从牌堆<strong>抽5张手牌</strong>，消耗<strong>能量</strong>主动打出技能卡。与《杀戮尖塔》类似的牌堆循环——抽牌堆→手牌→弃牌堆→重洗。</p>
            </div>
            <div class="help-section">
              <h3>战斗系统</h3>
              <ul>
                <li>每回合恢复<strong>3点能量</strong>，抽<strong>5张</strong>牌，手牌上限<strong>10张</strong></li>
                <li>卡牌费用0-3，选中手牌→选敌人目标→打出</li>
                <li>弃牌堆在抽牌堆耗尽时重洗回抽牌堆</li>
                <li>敌人意图在每回合开始时<strong>明牌显示</strong></li>
                <li><strong>剑圣</strong>：剑技命中+1剑意（0-3），满3点亮大招按钮</li>
                <li><strong>武圣</strong>：拳/脚命中+1蓄势（0-3），满3后下一拳/脚进入重式×1.60</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>状态系统</h3>
              <ul>
                <li>中毒：持续伤害，无视护盾，独立结算</li>
                <li>破甲：降低防御</li>
                <li>虚弱：降低造成伤害</li>
                <li>易伤：提高受到伤害</li>
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
                  <div class="stat">生命 68</div>
                  <div class="stat">剑意 0-3</div>
                  <div class="stat">起始牌组 10张</div>
                </div>
              </div>
            </div>
            <p>灵巧华丽，招式流动，剑气纵横。打出剑技积攒剑意，满3点亮大招按钮，由你决定何时释放万剑归流。</p>
            <div class="char-skills-preview">
              <span class="skill-tag">流云刺</span>
              <span class="skill-tag">回风斩</span>
              <span class="skill-tag">青锋剑气</span>
              <span class="skill-tag tag-more">+9</span>
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
                  <div class="stat">起始牌组 10张</div>
                </div>
              </div>
            </div>
            <p>大开大合，以力破巧，拳脚重击。积累蓄势触发重式，内功越打越强。</p>
            <div class="char-skills-preview">
              <span class="skill-tag">开山拳</span>
              <span class="skill-tag">裂地踢</span>
              <span class="skill-tag">金钟劲</span>
              <span class="skill-tag tag-more">+9</span>
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
    // Build starting deck from card pool
    this.cards = [];
    for (const entry of charDef.startingCards) {
      for (let i = 0; i < entry.count; i++) {
        this.cards.push(entry.cardId);
      }
    }
    this.maxHp = charDef.maxHp;
    this.hp = charDef.maxHp;
    this.supply = 30;
    this.equipment = [];
    this.signatureSword = null;
    this.powerBuff = 0;
    this.proficiency = {};
    this.cards.forEach(cid => {
      if (!this.proficiency[cid]) this.proficiency[cid] = { xp: 0, level: 1 };
    });
    this.currentRegion = 0;
    this.seed = Date.now();
    this.rng = new SeededRandom(this.seed);

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
          ${SIGNATURE_SWORDS.map(sword => `
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

  // ============ RUN ============

  startRun() {
    this.currentLayer = 0;
    this.regionCleared = false;
    this.routeMap = generateRouteMap(this.seed);
    this.showRouteMap();
  }

  showRouteMap() {
    this.state = 'route_map';
    const map = this.routeMap;
    const char = this.character;

    for (let l = 0; l < map.layers; l++) {
      map.nodes[l].forEach(n => n.accessible = false);
    }
    if (this.currentLayer === 0) {
      map.nodes[0].forEach(n => n.accessible = true);
    } else {
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
            <div class="resource-display"><span class="res-deck">牌组</span> ${this.cards.length}张</div>
            <button class="btn btn-secondary btn-sm" onclick="game.showStatsPanel()" style="padding:4px 10px;font-size:13px;">属性</button>
          </div>
        </div>
        <div class="route-map-title">第${REGIONS[this.currentRegion].name} · 第 ${this.currentLayer + 1} 层</div>
        <div class="scroll-strip" style="background-image:url('assets/bg_map_fuchun.jpg')"></div>
        <div class="route-map-container" id="routeMapContainer">
          <div class="route-map" id="routeMap">`;

    for (let layer = map.layers - 1; layer >= 0; layer--) {
      html += `<div class="route-layer" data-layer="${layer}">`;
      html += `<div class="layer-label">${layer + 1}</div>`;
      html += `<div class="layer-nodes">`;
      map.nodes[layer].forEach((node, i) => {
        const info = NODE_TYPE_INFO[node.type] || NODE_TYPE_INFO.battle;
        const isAccessible = node.accessible && !node.visited && layer === this.currentLayer;
        const isPast = node.visited || layer < this.currentLayer;
        const isFuture = layer > this.currentLayer && !node.accessible;

        let nodeClass = 'route-node';
        if (isPast) nodeClass += ' past';
        else if (isAccessible) nodeClass += ' accessible';
        else nodeClass += ' future';

        html += `
          <div class="${nodeClass}" id="rnode_${layer}_${i}" data-node-id="${node.id}"
               style="--node-color:${info.color}"
               onclick="${isAccessible ? `game.selectRouteNode(${layer},${i})` : ''}"
               title="${info.name}">
            <div class="node-glyph">${info.glyph}</div>
            <div class="node-type">${info.name}</div>
          </div>`;
      });
      html += `</div></div>`;
    }

    html += `</div></div>
        <div class="route-legend">
          ${Object.entries(NODE_TYPE_INFO).map(([type, info]) =>
            `<span class="legend-item"><span class="legend-glyph" style="color:${info.color}">${info.glyph}</span> ${info.name}</span>`
          ).join('')}
        </div>
      </div>`;

    document.getElementById('app').innerHTML = html;
    requestAnimationFrame(() => this._drawRouteConnections());
  }

  _drawRouteConnections() {
    const container = document.getElementById('routeMapContainer');
    const mapEl = document.getElementById('routeMap');
    if (!container || !mapEl || !this.routeMap) return;
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
      return { x: r.left - containerRect.left + r.width / 2, y: r.top - containerRect.top + r.height / 2 };
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
    try {
    audio.playUiClick();
    const node = this.routeMap.nodes[layer][index];
    node.visited = true;
    this.currentLayer = layer;
    this.currentNode = node;

    this.routeMap.nodes[layer].forEach((n, i) => {
      if (i !== index) n.accessible = false;
    });

    switch (node.type) {
      case 'battle': this.startBattle('normal'); break;
      case 'elite': this.startBattle('elite'); break;
      case 'boss': this.startBattle('boss'); break;
      case 'shop': this.showShop(); break;
      case 'rest': this.showRest(); break;
      case 'upgrade': this.showUpgrade(); break;
      case 'event': this.showEvent(); break;
      case 'treasure': this.showTreasure(); break;
      default: this.startBattle('normal');
    }

    if (layer + 1 < this.routeMap.layers && node.connections) {
      this.routeMap.nodes[layer + 1].forEach(n => {
        if (node.connections.includes(n.id)) n.accessible = true;
      });
    }
    } catch(e) {
      console.error('[selectRouteNode] ERROR:', e.message, e.stack);
      document.getElementById('app').innerHTML = '<div style="padding:20px;color:#e0604a"><h2>路由错误</h2><pre>' + e.message + '</pre></div>';
    }
  }

  // ============ BATTLE v1.4 - Card-based ============

  startBattle(type) {
    try {
    const encounterRng = new SeededRandom(this.seed + this.currentLayer * 1000 + this.currentRegion * 10000);
    const encounter = generateEncounter(this.currentLayer, encounterRng, this.currentRegion);

    const setup = {
      character: this.character,
      cards: this.cards,
      equipment: this.equipment,
      signatureSword: this.signatureSword,
      powerBuff: this.powerBuff,
      currentHp: this.hp,
      enemies: encounter.enemies,
      proficiency: { ...this.proficiency }
    };

    this.battleCore = new BattleCore(setup, this.seed + this.currentLayer * 777);
    this.state = 'battle';
    this._battleType = type;
    this._targetMode = null;
    this._animating = false;

    const typeName = type === 'boss' ? '首领战' : type === 'elite' ? '精英战' : '遭遇战';
    audio.playBgm(type === 'boss' ? 'boss' : type === 'elite' ? 'elite' : 'battle');

    this.battleCore.begin();
    this._renderBattleUI();
    } catch(e) {
      console.error('[startBattle] ERROR:', e.message, e.stack);
      document.getElementById('app').innerHTML = '<div style="padding:20px;color:#e0604a;background:#1a1008;border:1px solid #e0604a;border-radius:8px;margin:20px"><h2>战斗系统错误</h2><pre style="white-space:pre-wrap;word-break:break-all">' + e.message + '</pre><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px">刷新重试</button></div>';
    }
  }

  _renderBattleUI() {
    const core = this.battleCore;
    const state = core.getState();
    const char = this.character;

    document.getElementById('app').innerHTML = `
      <div class="screen battle-screen">
        <div class="battle-bg" style="background-image:url('assets/bg_battle_guo_xi.jpg')"></div>

        <!-- Enemy intents bar -->
        <div class="enemy-intents-bar" id="intentsBar">
          ${state.enemies.map(e => {
            const plan = state.enemyPlans[e.id];
            let intentHtml = '???';
            if (plan) {
              intentHtml = `<span class="intent-icon intent-${plan.intent}">${plan.intent === 'attack' ? '⚔' : plan.intent === 'shield' ? '🛡' : plan.intent === 'buff' ? '⬆' : '?'}</span>`;
              if (plan.previewText) intentHtml += ` <span class="intent-text">${plan.previewText}</span>`;
            }
            return `
              <div class="intent-enemy ${e.alive ? '' : 'dead'}" id="intent_${e.id}">
                <div class="intent-enemy-name">${e.name}</div>
                <div class="intent-detail">${intentHtml}</div>
              </div>`;
          }).join('')}
        </div>

        <!-- Arena -->
        <div class="battle-arena" id="battleArena">
          <div class="enemy-area" id="enemyArea">
            ${state.enemies.map((e, i) => `
              <div class="enemy-unit ${e.type || 'normal'} ${e.alive ? '' : 'dead'}"
                   id="enemy_${e.id}" onclick="${this._targetMode ? `game._selectTarget('${e.id}')` : ''}"
                   style="${this._targetMode && e.alive ? 'cursor:pointer;outline:2px solid var(--gold);' : ''}">
                <div class="status-row" id="status_${i}"></div>
                <div class="enemy-sprite">
                  <div class="sprite-enemy" style="--enemy-color:${e.color || '#b8a684'}">${e.definition?.glyph || e.name.charAt(0)}</div>
                </div>
                <div class="enemy-name">${e.name}</div>
                <div class="hp-bar-container small">
                  <div class="hp-bar enemy-hp"><div class="hp-fill" style="width:${e.alive ? (e.hp/e.maxHp*100) : 0}%"></div></div>
                  <span class="hp-text">${e.hp}/${e.maxHp}</span>
                </div>
                ${e.shield > 0 ? `<div class="shield-indicator">🛡${e.shield}</div>` : ''}
              </div>
            `).join('')}
          </div>

          <!-- Player -->
          <div class="player-area">
            <div class="player-sprite" id="playerSprite">
              <div class="sprite-body ${char.id} has-portrait" style="background-image:url('${char.portrait}')">
                <div class="sprite-aura"></div>
                <span class="sprite-glyph">${char.glyph}</span>
              </div>
              ${state.player.shield > 0 ? `<div class="player-shield">🛡${state.player.shield}</div>` : ''}
            </div>
            <div class="hp-bar-container">
              <div class="hp-bar player-hp" id="playerHpBar">
                <div class="hp-fill" style="width:${(state.player.hp/state.player.maxHp*100)}%"></div>
              </div>
              <span class="hp-text" id="playerHpText">${state.player.hp}/${state.player.maxHp}</span>
            </div>
          </div>

          <!-- Battle log -->
          <div class="battle-log" id="battleLog">
            <div class="log-content" id="logContent"></div>
          </div>

          <!-- FX layer -->
          <div class="fx-layer" id="fxLayer"></div>
        </div>

        <!-- ENERGY + PILES + RESOURCE -->
        <div class="battle-hud">
          <div class="hud-left">
            <div class="energy-display" id="energyDisplay">
              <span class="energy-orb">⚡</span>
              <span class="energy-val" id="energyVal">${state.energy}</span>/<span class="energy-max">${state.maxEnergy}</span>
            </div>
            <div class="pile-info">
              <button class="pile-btn" onclick="game._showPileInfo()" title="抽牌堆"><span class="pile-icon">📦</span>${state.drawPileCount}</button>
              <button class="pile-btn" onclick="game._showPileInfo()" title="弃牌堆"><span class="pile-icon">🗑</span>${state.discardPileCount}</button>
              <button class="pile-btn" onclick="game._showPileInfo()" title="消耗堆"><span class="pile-icon">💨</span>${state.exhaustPileCount}</button>
            </div>
            ${this.signatureSword ? `<div class="sword-display">${this.signatureSword.name}</div>` : ''}
          </div>
          <div class="hud-center">
            ${char.id === 'swordsman' ? `
            <div class="resource-display-v2" id="swordIntentDisplay">
              <span class="resource-label">剑意</span>
              ${[0,1,2,3].map(i => `<span class="intent-dot ${i < state.swordIntent ? 'filled' : ''}"></span>`).join('')}
            </div>` : `
            <div class="resource-display-v2" id="momentumDisplay">
              <span class="resource-label">蓄势</span>
              ${[0,1,2,3].map(i => `<span class="momentum-dot ${i < state.momentum ? 'filled' : ''}"></span>`).join('')}
            </div>`}
          </div>
          <div class="hud-right">
            <button class="btn btn-endturn" id="endTurnBtn" onclick="game._endTurn()">结束回合</button>
          </div>
        </div>

        <!-- HAND -->
        <div class="card-hand-area" id="cardHandArea">
          <div class="card-hand-scroll" id="cardHandScroll">
            ${this._renderHandCards()}
          </div>
        </div>

        <!-- Ultimate button (floating) -->
        ${char.id === 'swordsman' ? `
        <div class="ultimate-button-area">
          <button class="btn-ultimate ${state.swordIntent >= 3 ? 'ready' : 'locked'}"
                  id="ultimateBtn"
                  onclick="game._castUltimate()"
                  ${state.swordIntent < 3 ? 'disabled' : ''}>
            ${state.swordIntent >= 3 ? '⚔️ 万剑归流' : `剑意 ${state.swordIntent}/3`}
          </button>
        </div>` : ''}
      </div>
    `;

    this._refreshBattleHud();

    // Wheel → horizontal scroll for card hand (desktop mouse wheel)
    const scrollEl = document.getElementById('cardHandScroll');
    if (scrollEl) {
      scrollEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        scrollEl.scrollLeft += e.deltaY;
      }, { passive: false });
    }
  }

  _renderHandCards() {
    const core = this.battleCore;
    const handCards = core.getHandCards();

    if (handCards.length === 0) return '<div class="no-cards-msg">手牌已空，请结束回合</div>';

    return handCards.map(ci => {
      const canPlay = core.canPlayCard(ci.instanceId);
      const costClass = ci.isCostDiscounted ? 'cost-discounted' : '';
      const typeClass = ci.cardType === 'attack' ? 'card-attack' :
                        ci.cardType === 'power' ? 'card-power' :
                        ci.cardType === 'technique' ? 'card-technique' : 'card-utility';
      const rarityClass = ci.energyCost >= 3 ? 'card-epic' : ci.pileKeywords.includes('exhaust') ? 'card-rare' : '';

      return `
        <div class="battle-card ${typeClass} ${rarityClass} ${canPlay ? '' : 'card-locked'} ${this._targetMode?.cardInstanceId === ci.instanceId ? 'card-selected' : ''}"
             id="bcard_${ci.instanceId}"
             onclick="game._clickCard('${ci.instanceId}')">
          <div class="bcard-cost ${costClass}">${ci.energyCost}${ci.isCostDiscounted ? '<span class="cost-arrow">↓</span>' : ''}</div>
          <div class="bcard-tags">
            ${ci.tags.map(t => `<span class="bcard-tag">${t}</span>`).join('')}
            ${ci.pileKeywords.map(k => `<span class="bcard-keyword">${k === 'retain' ? '保留' : k === 'exhaust' ? '消耗' : k === 'innate' ? '起手' : k}</span>`).join('')}
          </div>
          <div class="bcard-name">${ci.name}</div>
          <div class="bcard-desc">${ci.desc || ''}</div>
        </div>
      `;
    }).join('');
  }

  _clickCard(cardInstanceId) {
    if (this.state !== 'battle' || this._animating) return;
    audio.playSfx('card_select');

    // If already in target mode, cancel
    if (this._targetMode && this._targetMode.cardInstanceId === cardInstanceId) {
      this._targetMode = null;
      this._reRenderHand();
      return;
    }

    const core = this.battleCore;
    if (!core.canPlayCard(cardInstanceId)) {
      this._shake('light');
      return;
    }

    const info = core.getCardInfo(cardInstanceId);
    if (!info) return;

    // Check if target selection needed
    if (info.targetMode === 'enemy_single') {
      this._targetMode = { cardInstanceId, targetMode: 'enemy_single' };
      this._renderBattleUI();
      // Highlight enemies
      const aliveEnemyIds = core.getAliveEnemyIds();
      aliveEnemyIds.forEach(eid => {
        const el = document.getElementById(`enemy_${eid}`);
        if (el) el.classList.add('targetable');
      });
    } else {
      // No target needed, play immediately
      this._playCard(cardInstanceId, []);
    }
  }

  _selectTarget(enemyId) {
    if (!this._targetMode || this._animating) return;
    const cardInstanceId = this._targetMode.cardInstanceId;
    this._targetMode = null;
    this._playCard(cardInstanceId, [enemyId]);
  }

  _playCard(cardInstanceId, targetIds) {
    const core = this.battleCore;

    // Snapshot enemy HPs before play
    const hpBefore = {};
    core.enemies.forEach(e => { hpBefore[e.id] = e.hp; });

    // Get card info for banner
    const cardInfo = core.getCardInfo(cardInstanceId);

    const result = core.playCard(cardInstanceId, targetIds);

    if (!result.accepted) {
      console.warn('Card rejected:', result.reason);
      this._reRenderHand();
      return;
    }

    // --- Animate ---
    if (cardInfo) {
      this._showCastBanner(cardInfo.name, cardInfo.tags[0] || '', false);
      this._animatePlayerAttack();
    }

    // Animate damage on enemies
    core.enemies.forEach(e => {
      const before = hpBefore[e.id] || 0;
      const damage = before - e.hp;
      if (damage > 0) {
        this._animateEnemyHit(e.id, damage, cardInfo?.hitPreset || 'light');
      }
    });

    audio.playSfx(cardInfo?.impactSfx || 'card_play');
    this._refreshBattleHud();

    if (result.result?.isOver) {
      this._finishBattle(result);
      return;
    }

    this._reRenderHand();
  }

  _castUltimate() {
    const core = this.battleCore;
    if (!core.canUltimate() || this._animating) return;
    this._animating = true;

    // Snapshot HPs
    const hpBefore = {};
    core.enemies.forEach(e => { hpBefore[e.id] = e.hp; });

    audio.playSfx('ultimate_click');

    // For swordsman: show cinematic image fade-in BEFORE applying damage
    if (this.character.id === 'swordsman') {
      this._showUltimateCinematic(() => {
        const result = core.castUltimate();
        if (!result.accepted) { this._animating = false; return; }
        this._applyUltimateAnimations(hpBefore, 'execute');
        this._refreshBattleHud();
        this._animating = false;
        if (result.result?.isOver) {
          this._finishBattle(result);
          return;
        }
        this._reRenderHand();
      });
    } else {
      const result = core.castUltimate();
      if (!result.accepted) { this._animating = false; return; }
      this._applyUltimateAnimations(hpBefore, 'execute');
      this._refreshBattleHud();
      this._animating = false;
      if (result.result?.isOver) {
        this._finishBattle(result);
        return;
      }
      this._reRenderHand();
    }
  }

  /** Helper: apply ultimate damage animations */
  _applyUltimateAnimations(hpBefore, hitPreset) {
    this._showCastBanner('万剑归流', '大招', true);
    this._animatePlayerAttack();
    const core = this.battleCore;
    core.enemies.forEach(e => {
      const before = hpBefore[e.id] || 0;
      const damage = before - e.hp;
      if (damage > 0) {
        this._animateEnemyHit(e.id, damage, hitPreset);
      }
    });
  }

  /** Fullscreen cinematic image fade-in for swordsman ultimate */
  _showUltimateCinematic(onComplete) {
    const overlay = document.createElement('div');
    overlay.className = 'ultimate-cinematic-overlay';
    overlay.innerHTML = `
      <div class="ultimate-cinematic-bg"></div>
      <div class="ultimate-cinematic-image-wrap">
        <img src="assets/ultimate_cinematic.jpg" class="ultimate-cinematic-image" />
        <div class="ultimate-cinematic-vignette"></div>
      </div>
      <div class="ultimate-cinematic-text">
        <div class="ultimate-cinematic-name">万剑归流</div>
        <div class="ultimate-cinematic-sub">剑圣 · 大招</div>
      </div>
      <div class="ultimate-cinematic-flash"></div>
    `;
    document.body.appendChild(overlay);

    // Fade in: 800ms
    requestAnimationFrame(() => {
      overlay.classList.add('cinematic-show');
    });

    // Hold: 1300ms (was 900ms)
    setTimeout(() => {
      overlay.classList.add('cinematic-flash-out');
    }, 1300);

    // Fade out: 500ms, total hold = 1300 + 400 = 1700ms + 500ms fade = 2200ms
    setTimeout(() => {
      overlay.classList.add('cinematic-hide');
      setTimeout(() => {
        overlay.remove();
        if (onComplete) onComplete();
      }, 500);
    }, 2200);
  }

  _endTurn() {
    if (this.state !== 'battle' || this._animating) return;
    audio.playSfx('card_discard');

    const core = this.battleCore;
    const hpBefore = core.hp;
    this._animating = true;

    // Run enemy turn
    const result = core.endTurn();
    if (!result.accepted) { this._animating = false; return; }

    // Render new battle UI immediately (prevents race condition)
    this._renderBattleUI();

    // Game over?
    if (result.result?.isOver) {
      setTimeout(() => {
        if (this.state === 'battle') this._finishBattle(result);
        this._animating = false;
      }, 400);
      return;
    }

    // Play enemy attack animations on top of new UI
    const damageTaken = hpBefore - core.hp;
    if (damageTaken > 0) {
      setTimeout(() => {
        core.enemies.forEach(e => { if (e.alive) this._animateEnemyAttack(e.id); });
      }, 50);
      setTimeout(() => {
        this._animatePlayerHit(damageTaken);
        this._refreshBattleHud();
        this._animating = false;
      }, 250);
    } else {
      this._animating = false;
    }
  }

  _reRenderHand() {
    const scrollEl = document.getElementById('cardHandScroll');
    if (scrollEl) {
      scrollEl.innerHTML = this._renderHandCards();
    }
    document.querySelectorAll('.enemy-unit').forEach(el => el.classList.remove('targetable'));
    if (this._targetMode) {
      const aliveEnemyIds = this.battleCore.getAliveEnemyIds();
      aliveEnemyIds.forEach(eid => {
        const el = document.getElementById(`enemy_${eid}`);
        if (el) el.classList.add('targetable');
      });
    }
  }

  // ============ ANIMATION SYSTEM ============

  /** Show cast banner */
  _showCastBanner(cardName, tag, isUltimate) {
    const overlay = document.createElement('div');
    overlay.className = 'battle-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:100;pointer-events:none;';
    overlay.innerHTML = `
      <div class="cast-banner" style="animation:bannerIn 0.22s ease forwards">
        <div class="cast-banner-tag ${isUltimate ? 'ultimate' : ''}">${tag}</div>
        <div class="cast-banner-name">${cardName}</div>
      </div>`;
    const arena = document.getElementById('battleArena');
    if (arena) arena.appendChild(overlay);
    setTimeout(() => {
      overlay.querySelector('.cast-banner').classList.add('out');
      setTimeout(() => overlay.remove(), 240);
    }, 600);
  }

  /** Animate hit on enemy */
  _animateEnemyHit(enemyId, damage, hitPreset) {
    // Convert BattleCore enemy ID to DOM ID
    const domId = `enemy_${enemyId}`;
    const enemyEl = document.getElementById(domId);
    if (!enemyEl || damage <= 0) return;

    // Hit flash + recoil
    enemyEl.classList.remove('hit-flash', 'hit-recoil');
    void enemyEl.offsetWidth;
    enemyEl.classList.add('hit-flash', 'hit-recoil');
    setTimeout(() => enemyEl.classList.remove('hit-flash', 'hit-recoil'), 260);

    // Damage popup
    const popup = document.createElement('div');
    popup.className = 'dmg-popup';
    if (hitPreset === 'execute') popup.classList.add('execute');
    else if (hitPreset === 'heavy') popup.classList.add('crit');
    popup.textContent = `-${Math.floor(damage)}`;
    enemyEl.appendChild(popup);
    setTimeout(() => popup.remove(), 950);

    // Particle effects based on hit type
    const cat = hitPreset;
    if (cat === 'execute') {
      this._spawnSlash(enemyEl, '#e0604a');
      this._spawnParticles(enemyEl, '#e0604a', 10);
      this._spawnImpact(enemyEl, '#e0604a');
      this._shake('execute');
      this._flashFrame();
    } else if (cat === 'heavy') {
      this._spawnImpact(enemyEl, '#e8b088');
      this._spawnParticles(enemyEl, '#d98e4a', 8);
      this._shake('heavy');
      this._flashFrame();
    } else if (cat === 'standard') {
      this._spawnSlash(enemyEl, '#cfe8f5');
      this._spawnParticles(enemyEl, '#cbbc9c', 5);
      this._shake('standard');
    } else {
      this._spawnSlash(enemyEl, '#d0e0f0');
      this._spawnParticles(enemyEl, '#cbbc9c', 4);
      this._shake('light');
    }
  }

  /** Animate player hit from enemy */
  _animatePlayerHit(damage) {
    if (damage <= 0) return;
    const playerEl = document.getElementById('playerSprite');
    if (playerEl) {
      playerEl.classList.remove('hit-flash', 'player-hit-recoil');
      void playerEl.offsetWidth;
      playerEl.classList.add('hit-flash', 'player-hit-recoil');
      setTimeout(() => playerEl.classList.remove('hit-flash', 'player-hit-recoil'), 260);

      const popup = document.createElement('div');
      popup.className = 'dmg-popup enemy-dmg';
      popup.textContent = `-${Math.floor(damage)}`;
      playerEl.appendChild(popup);
      setTimeout(() => popup.remove(), 950);
    }
    this._shake('standard');
  }

  /** Animate player attack lunge */
  _animatePlayerAttack() {
    const playerEl = document.getElementById('playerSprite');
    if (playerEl) {
      playerEl.classList.remove('attack-lunge');
      void playerEl.offsetWidth;
      playerEl.classList.add('attack-lunge');
      setTimeout(() => playerEl.classList.remove('attack-lunge'), 350);
    }
  }

  /** Animate enemy attack lunge */
  _animateEnemyAttack(enemyId) {
    const domId = `enemy_${enemyId}`;
    const enemyEl = document.getElementById(domId);
    if (enemyEl) {
      enemyEl.classList.remove('attack-lunge');
      void enemyEl.offsetWidth;
      enemyEl.classList.add('attack-lunge');
      setTimeout(() => enemyEl.classList.remove('attack-lunge'), 350);
    }
  }

  // ============ FX GENERATORS ============

  _fxLayer() { return document.getElementById('fxLayer'); }

  _centerIn(el, container) {
    const er = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return { x: er.left - cr.left + er.width / 2, y: er.top - cr.top + er.height / 2 };
  }

  _spawnSlash(targetEl, color) {
    const layer = this._fxLayer();
    if (!layer) return;
    const c = this._centerIn(targetEl, layer);
    const rot = -55 + Math.random() * 70;
    const size = 80 + Math.random() * 30;
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

  _spawnImpact(targetEl, color) {
    const layer = this._fxLayer();
    if (!layer) return;
    const c = this._centerIn(targetEl, layer);
    const fx = document.createElement('div');
    fx.className = 'impact-ring';
    const size = 100;
    fx.style.cssText = `left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;--impact-color:${color};`;
    layer.appendChild(fx);
    setTimeout(() => fx.remove(), 380);
  }

  _spawnParticles(targetEl, color, count) {
    const layer = this._fxLayer();
    if (!layer) return;
    const c = this._centerIn(targetEl, layer);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'ink-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      const size = 3 + Math.random() * 5;
      p.style.cssText = `left:${c.x}px;top:${c.y}px;width:${size}px;height:${size}px;--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist}px;--particle-color:${color};`;
      layer.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  _shake(level) {
    const arena = document.getElementById('battleArena');
    if (!arena) return;
    arena.classList.remove('shake-light', 'shake-standard', 'shake-heavy', 'shake-execute');
    void arena.offsetWidth;
    arena.classList.add(`shake-${level}`);
    setTimeout(() => arena.classList.remove(`shake-${level}`), 560);
  }

  _flashFrame() {
    const arena = document.getElementById('battleArena');
    if (!arena) return;
    const f = document.createElement('div');
    f.className = 'flash-frame';
    arena.appendChild(f);
    setTimeout(() => f.remove(), 200);
  }

  _refreshBattleHud() {
    const core = this.battleCore;
    const state = core.getState();

    // Energy
    const energyVal = document.getElementById('energyVal');
    if (energyVal) energyVal.textContent = state.energy;

    // HP
    const playerHpBar = document.getElementById('playerHpBar');
    if (playerHpBar) {
      const fill = playerHpBar.querySelector('.hp-fill');
      if (fill) fill.style.width = `${Math.max(0, (state.player.hp / state.player.maxHp) * 100)}%`;
      const text = document.getElementById('playerHpText');
      if (text) text.textContent = `${state.player.hp}/${state.player.maxHp}`;
    }

    // Player shield
    const playerSprite = document.getElementById('playerSprite');
    if (playerSprite) {
      const shieldEl = playerSprite.querySelector('.player-shield');
      if (state.player.shield > 0) {
        if (!shieldEl) {
          const s = document.createElement('div');
          s.className = 'player-shield';
          s.textContent = `🛡${state.player.shield}`;
          playerSprite.appendChild(s);
        } else {
          shieldEl.textContent = `🛡${state.player.shield}`;
        }
      } else if (shieldEl) {
        shieldEl.remove();
      }
    }

    // Enemies
    state.enemies.forEach((enemy, i) => {
      const el = document.getElementById(`enemy_${enemy.id}`);
      if (el) {
        const bar = el.querySelector('.hp-fill');
        if (bar) bar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
        const text = el.querySelector('.hp-text');
        if (text) text.textContent = `${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
        if (!enemy.alive) el.classList.add('dead');
        // Shield on enemy
        const shieldEl = el.querySelector('.shield-indicator');
        if (enemy.shield > 0) {
          if (!shieldEl) {
            const s = document.createElement('div');
            s.className = 'shield-indicator';
            s.textContent = `🛡${enemy.shield}`;
            el.appendChild(s);
          } else {
            shieldEl.textContent = `🛡${enemy.shield}`;
          }
        } else if (shieldEl) {
          shieldEl.remove();
        }
        // Status chips
        const statusRow = el.querySelector('.status-row');
        if (statusRow && enemy.statuses) {
          const names = { poison: '毒', armorBreak: '甲', weak: '弱', vulnerable: '脆' };
          statusRow.innerHTML = Object.entries(enemy.statuses)
            .filter(([, inst]) => inst.stacks > 0)
            .map(([type, inst]) => `<span class="status-chip ${type}">${names[type] || type}·${inst.stacks}</span>`)
            .join('');
        }
        // Update intent
        const intentEl = document.getElementById(`intent_${enemy.id}`);
        if (intentEl && !enemy.alive) intentEl.classList.add('dead');
      }
    });

    // Resource
    if (this.character.id === 'swordsman') {
      const display = document.getElementById('swordIntentDisplay');
      if (display) {
        const dots = display.querySelectorAll('.intent-dot');
        dots.forEach((dot, i) => dot.classList.toggle('filled', i < state.swordIntent));
      }
      const ultBtn = document.getElementById('ultimateBtn');
      if (ultBtn) {
        ultBtn.classList.toggle('ready', state.swordIntent >= 3);
        ultBtn.classList.toggle('locked', state.swordIntent < 3);
        ultBtn.textContent = state.swordIntent >= 3 ? '⚔️ 万剑归流' : `剑意 ${state.swordIntent}/3`;
        ultBtn.disabled = state.swordIntent < 3;
      }
    } else {
      const display = document.getElementById('momentumDisplay');
      if (display) {
        const dots = display.querySelectorAll('.momentum-dot');
        dots.forEach((dot, i) => dot.classList.toggle('filled', i < state.momentum));
      }
    }

    // Pile counts
    const pileBtns = document.querySelectorAll('.pile-btn');
    if (pileBtns.length >= 3) {
      pileBtns[0].innerHTML = `<span class="pile-icon">📦</span>${state.drawPileCount}`;
      pileBtns[1].innerHTML = `<span class="pile-icon">🗑</span>${state.discardPileCount}`;
      pileBtns[2].innerHTML = `<span class="pile-icon">💨</span>${state.exhaustPileCount}`;
    }

    // Log
    const logEl = document.getElementById('logContent');
    if (logEl) {
      const recent = state.log.slice(-5);
      logEl.innerHTML = recent.map(l => {
        const clean = l.replace(/^\[R\d+\] /, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
        return `<div class="log-line">${clean}</div>`;
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  _finishBattle(result) {
    if (this.state !== 'battle') return;
    this.state = 'battle_end';
    this._animating = false;
    audio.stopBgm();

    const coreResult = result.result || this.battleCore.getResult();
    const state = this.battleCore.getState();

    // Update player HP
    this.hp = Math.max(0, state.player.hp);

    // Update proficiency
    this.proficiency = { ...state.proficiency };
    this.pendingUpgrades = [...state.pendingUpgrades];

    if (coreResult.defeat) {
      this.battleResult = { defeat: true, player: state.player, enemies: state.enemies, log: state.log, rounds: state.round };
      this.showGameOver();
      return;
    }

    if (coreResult.victory) {
      const isBoss = this.currentNode?.type === 'boss';
      const isElite = this.currentNode?.type === 'elite';
      const supplyReward = isBoss ? this.rng.nextInt(45, 60) : isElite ? this.rng.nextInt(28, 40) : this.rng.nextInt(12, 18);
      this.supply += supplyReward;

      const lootOptions = this._generateLoot(isBoss, isElite);
      if (isBoss && this.currentRegion >= REGIONS.length - 1) {
        this.regionCleared = true;
        audio.playBgm('victory');
      }

      this.battleResult = { victory: true, player: state.player, enemies: state.enemies, log: state.log, rounds: state.round, proficiency: state.proficiency };
      this.showBattleReward(supplyReward, lootOptions);
    }
  }

  _generateLoot(isBoss, isElite) {
    const options = [];
    const pool = this.character.cardPool;
    const existingIds = new Set(this.cards);

    // New cards from character pool
    const newCards = pool.filter(c => !existingIds.has(c.id));
    const shuffledNew = this.rng.shuffle([...newCards]);
    const newCount = Math.min(2, shuffledNew.length);
    for (let i = 0; i < newCount; i++) {
      options.push({ type: 'card', data: shuffledNew[i], isDuplicate: false });
    }

    // Equipment
    const existingEqIds = new Set(this.equipment.map(eq => eq.id));

    if (isBoss) {
      const mythicPool = EQUIPMENT.filter(eq => eq.rarity === '神话' && !existingEqIds.has(eq.id));
      if (mythicPool.length > 0) {
        options.push({ type: 'equipment', data: this.rng.pick(mythicPool), isMythic: true });
      }
    } else {
      const normalEq = EQUIPMENT.filter(eq => eq.rarity !== '神话' && !existingEqIds.has(eq.id));
      if (normalEq.length > 0 && (isElite || this.rng.nextFloat() < 0.25)) {
        options.push({ type: 'equipment', data: this.rng.pick(normalEq) });
      }
    }

    return this.rng.shuffle(options).slice(0, 3);
  }

  showBattleReward(supplyReward, lootOptions) {
    this.state = 'reward';
    this._lootOptions = lootOptions;
    const result = this.battleResult;
    const deckSize = this.cards.length;

    document.getElementById('app').innerHTML = `
      <div class="screen reward-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.14"></div>
        <div class="panel victory-panel">
          <h2>凯 旋</h2>
          <div class="reward-summary">
            <div class="reward-item">物资 <span class="hl">+${supplyReward}</span>（共 ${this.supply}）</div>
            <div class="reward-item">剩余生命 <span class="hl">${this.hp}/${this.maxHp}</span></div>
            <div class="reward-item">牌组 <span class="hl">${deckSize}张</span> · 回合 ${result.rounds}</div>
          </div>

          ${lootOptions.length > 0 ? `
          <div class="loot-section">
            <h3>择一奖励</h3>
            <div class="loot-cards">
              ${lootOptions.map((opt, i) => `
                <div class="loot-card${opt.type === 'equipment' && opt.isMythic ? ' loot-card-mythic' : ''}" onclick="game.pickLoot(${i})">
                  ${opt.type === 'card' ? `
                    <div class="seal loot-icon">${opt.data.name.charAt(0)}</div>
                    <div class="loot-name">${opt.data.name}</div>
                    <div class="loot-desc">${opt.data.desc}</div>
                    <div class="loot-tags">
                      <span class="tag">${opt.data.tags[0]}</span>
                      <span class="tag">费${opt.data.energyCost}</span>
                      ${opt.data.pileKeywords.map(k => `<span class="tag">${k}</span>`).join('')}
                    </div>
                  ` : `
                    <div class="seal loot-icon">器</div>
                    <div class="loot-name">${opt.data.name} <span class="loot-rarity ${opt.data.rarity}">${opt.data.rarity}</span></div>
                    <div class="loot-desc">${opt.data.desc}</div>
                  `}
                  <button class="btn btn-primary btn-sm">取之</button>
                </div>
              `).join('')}
            </div>
          </div>
          ` : '<p>此行无有可取之获</p>'}

          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">继续探索 →</button>
        </div>
      </div>
    `;
  }

  pickLoot(index) {
    audio.playUiClick();
    const lootOptions = this._lootOptions;
    if (!lootOptions || index >= lootOptions.length) return;

    const opt = lootOptions[index];
    document.querySelectorAll('.loot-card').forEach((card, i) => {
      if (i !== index) card.style.opacity = '0.4';
      else card.classList.add('picked');
    });
    setTimeout(() => {
      document.querySelectorAll('.loot-card button').forEach(b => b.disabled = true);
    }, 300);

    if (opt.type === 'card') {
      this.cards.push(opt.data.id);
      if (!this.proficiency[opt.data.id]) {
        this.proficiency[opt.data.id] = { xp: 0, level: 1 };
      }
      this.toast(`获得【${opt.data.name}】牌组: ${this.cards.length}张`);
    } else if (opt.type === 'equipment') {
      this.equipment.push(opt.data);
      this.toast(`获得装备「${opt.data.name}」`);
    }
  }

  continueAfterBattle() {
    audio.playUiClick();
    if (this.regionCleared) {
      this.showVictoryScreen();
    } else {
      this.currentLayer++;
      if (this.currentLayer >= this.routeMap.layers) {
        if (this.currentRegion < REGIONS.length - 1) {
          this.currentRegion++;
          this.currentLayer = 0;
          this.regionCleared = false;
          this.routeMap = generateRouteMap(this.seed + this.currentRegion * 7777);
          this.showChapterClear();
        } else {
          this.regionCleared = true;
          this.showVictoryScreen();
        }
      } else {
        this.showRouteMap();
      }
    }
  }

  // ============ SHOP ============

  showShop() {
    this.state = 'shop';
    const pool = this.character.cardPool;
    const existingIds = new Set(this.cards);
    const shopCards = this.rng.shuffle(pool.filter(c => !existingIds.has(c.id))).slice(0, 3);

    document.getElementById('app').innerHTML = `
      <div class="screen shop-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.14"></div>
        <div class="panel">
          <h2>商 栈</h2>
          <p>物资 <span style="color:var(--gold-bright)">${this.supply}</span> · 牌组 ${this.cards.length}张</p>

          <div class="shop-section">
            <h3>技能卡（55 - 80 物资）</h3>
            <div class="shop-items">
              ${shopCards.map((c, i) => `
                <div class="shop-item">
                  <div class="seal shop-item-icon">${c.name.charAt(0)}</div>
                  <div class="shop-item-info">
                    <div class="shop-item-name">${c.name} <span class="tag">费${c.energyCost}</span></div>
                    <div class="shop-item-desc">${c.desc}</div>
                    <div class="shop-item-tags">
                      ${c.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                  </div>
                  <div class="shop-item-price">
                    <span>${60 + i * 10} 物资</span>
                    <button class="btn btn-primary btn-sm" ${this.supply >= (60+i*10) ? '' : 'disabled'}
                      onclick="game.buyCard('${c.id}', ${60+i*10})">购</button>
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
                <span>随机遗忘 · 移除随机一张牌</span>
                <span>35 物资</span>
                <button class="btn btn-secondary btn-sm" onclick="game.removeRandomCard()">随机遗忘</button>
              </div>
            </div>
          </div>

          <div class="shop-section">
            <h3>我的牌组 (${this.cards.length}张)</h3>
            <div class="shop-deck-list">
              ${this.cards.map(cid => {
                const cd = ALL_CARDS[cid];
                if (!cd) return '';
                return `
                  <div class="shop-item small">
                    <span>${cd.name} <span class="tag">费${cd.energyCost}</span></span>
                    <button class="btn btn-ghost btn-sm" onclick="game.forgetCard('${cid}')" ${this.supply >= 35 && this.cards.length > 3 ? '' : 'disabled'}>遗忘 35</button>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">离开商栈 →</button>
        </div>
      </div>
    `;
  }

  buyCard(cardId, price) {
    if (this.supply < price) return;
    audio.playUiClick();
    this.supply -= price;
    this.cards.push(cardId);
    if (!this.proficiency[cardId]) this.proficiency[cardId] = { xp: 0, level: 1 };
    this.showShop();
  }

  buyHeal(cost) {
    if (this.supply < cost) return;
    audio.playUiClick();
    this.supply -= cost;
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.3));
    this.showShop();
  }

  removeRandomCard() {
    if (this.cards.length <= 3) { this.toast('牌组太少，无法删减'); return; }
    if (this.supply < 35) return;
    audio.playUiClick();
    const idx = this.rng.nextInt(0, this.cards.length - 1);
    const removed = this.cards[idx];
    this.cards.splice(idx, 1);
    this.supply -= 35;
    this.toast(`删除了【${ALL_CARDS[removed]?.name || removed}】`);
    this.showShop();
  }

  // ============ REST / UPGRADE / EVENT / TREASURE ============

  showRest() {
    this.state = 'rest';
    const healAmount = Math.floor(this.maxHp * 0.25);
    document.getElementById('app').innerHTML = `
      <div class="screen rest-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.16"></div>
        <div class="panel">
          <h2>休 整</h2>
          <p>竹影婆娑，暂且歇脚。</p>
          <div class="rest-options">
            <div class="rest-card" onclick="game.doRest()">
              <div class="rest-icon">憩</div>
              <h3>小憩</h3>
              <p>恢复 ${healAmount} 生命</p>
              <p class="rest-current">当前生命 ${this.hp}/${this.maxHp}</p>
              <button class="btn btn-primary">休息一下</button>
            </div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">继续赶路 →</button>
        </div>
      </div>
    `;
  }

  doRest() {
    audio.playUiClick();
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.25));
    this.showRest();
  }

  showUpgrade() {
    this.state = 'upgrade';
    document.getElementById('app').innerHTML = `
      <div class="screen upgrade-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.14"></div>
        <div class="panel">
          <h2>改 造 站</h2>
          <p>物资 <span style="color:var(--gold-bright)">${this.supply}</span> · 牌组 ${this.cards.length}张</p>
          <div class="upgrade-list">
            ${this.cards.map(cid => {
              const cd = ALL_CARDS[cid];
              if (!cd) return '';
              const prof = this.proficiency[cid] || { xp: 0, level: 1 };
              const levels = [0, 5, 14, 30, 55];
              const nextXp = levels[Math.min(4, prof.level)] || 55;
              return `
                <div class="upgrade-item">
                  <div class="upgrade-info">
                    <div class="upgrade-name">${cd.name} <span class="tag">费${cd.energyCost}</span> <span class="skill-lv">Lv${prof.level}</span></div>
                    <div class="upgrade-desc">${cd.desc}</div>
                    <div class="skill-meta">熟练 ${prof.xp}/${nextXp} ${prof.level >= 5 ? '(MAX)' : ''}</div>
                  </div>
                  <div class="upgrade-btns">
                    <button class="btn btn-secondary btn-sm" onclick="game.upgradeCard('${cid}')" ${this.supply >= 65 && prof.level < 5 ? '' : 'disabled'}>
                      65 物资 升级 (+10经验)
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="game.forgetCard('${cid}')" ${this.supply >= 50 && this.cards.length > 3 ? '' : 'disabled'}>
                      50 物资 遗忘
                    </button>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <button class="btn btn-primary btn-block" onclick="game.continueAfterBattle()">离开 →</button>
        </div>
      </div>
    `;
  }

  upgradeCard(cardId) {
    if (this.supply < 65) return;
    audio.playUiClick();
    this.supply -= 65;
    if (!this.proficiency[cardId]) this.proficiency[cardId] = { xp: 0, level: 1 };
    this.proficiency[cardId].xp += 10;
    const xp = this.proficiency[cardId].xp;
    const levels = [0, 5, 14, 30, 55];
    let newLevel = 1;
    for (let l = 4; l >= 0; l--) { if (xp >= levels[l]) { newLevel = l + 1; break; } }
    this.proficiency[cardId].level = Math.min(5, newLevel);
    const cd = ALL_CARDS[cardId];
    this.toast(`${cd?.name || cardId} 升级为 Lv${this.proficiency[cardId].level}！`);
    this.showUpgrade();
  }

  forgetCard(cardId) {
    if (this.cards.length <= 3) { this.toast('牌组太少，无法再删'); return; }
    const price = this.state === 'upgrade' ? 50 : 35;
    if (this.supply < price) return;
    audio.playUiClick();
    this.supply -= price;
    const idx = this.cards.indexOf(cardId);
    if (idx < 0) return;
    const cd = ALL_CARDS[cardId];
    this.cards.splice(idx, 1);
    this.toast(`遗忘了【${cd?.name || cardId}】`);
    if (this.state === 'upgrade') this.showUpgrade();
    else if (this.state === 'shop') this.showShop();
  }

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
            <button class="btn btn-primary" onclick="game.handleEvent('accept')">${event.choice}</button>
            <button class="btn btn-ghost" onclick="game.continueAfterBattle()">拂袖而去</button>
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
        case 'buy':
          if (this.supply >= 40) { this.supply -= 40; this.equipment.push(this.rng.pick(EQUIPMENT)); this.toast('获得装备！'); }
          else this.toast('物资不足');
          break;
        case 'trade':
          if (this.supply >= 30) { this.supply -= 30; this.equipment.push(this.rng.pick(EQUIPMENT)); this.toast('获得装备！'); }
          else this.toast('物资不足');
          break;
        case 'heal':
          this.hp = Math.min(this.maxHp, this.hp + 25); this.toast('生命恢复 +25');
          break;
        case 'sacrifice':
          if (this.hp > 10) { this.hp -= 10; this.powerBuff += 0.08; this.toast('献祭成功，力量+8%'); }
          else { this.hp = Math.min(this.maxHp, this.hp + 15); this.toast('祭坛反哺 +15生命'); }
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
    this.toast(`遗宝：获得「${eq.name}」与物资！`);
    this.continueAfterBattle();
  }

  // ============ STATS ============

  showStatsPanel() {
    audio.playUiClick();
    const char = this.character;
    const cardCounts = {};
    this.cards.forEach(cid => { cardCounts[cid] = (cardCounts[cid] || 0) + 1; });

    const panelHtml = `
      <div class="stats-overlay" id="statsOverlay" onclick="game.closeStatsPanel()">
        <div class="stats-panel" onclick="event.stopPropagation()">
          <div class="stats-header">
            <h2>${char.name} · 属性</h2>
            <button class="btn btn-ghost btn-sm" onclick="game.closeStatsPanel()">✕</button>
          </div>
          <div class="stats-section">
            <div class="stats-grid-3">
              <div class="stat-card"><div class="stat-card-val">${this.hp}/${this.maxHp}</div><div class="stat-card-label">生命</div></div>
              <div class="stat-card"><div class="stat-card-val">${this.supply}</div><div class="stat-card-label">物资</div></div>
              <div class="stat-card"><div class="stat-card-val">${this.cards.length}张</div><div class="stat-card-label">牌组</div></div>
            </div>
            ${this.signatureSword ? `<div class="sword-info"><span class="sword-name-tag">${this.signatureSword.name}</span> ${this.signatureSword.desc}</div>` : ''}
          </div>
          <div class="stats-section">
            <h3>牌组详情</h3>
            ${Object.entries(cardCounts).map(([cid, count]) => {
              const cd = ALL_CARDS[cid];
              if (!cd) return '';
              return `<div class="skill-row">
                <div class="skill-info-main">
                  <div class="skill-name-row">
                    <span class="skill-name">${cd.name}</span>
                    <span class="skill-tag-sm">${cd.tags[0]}</span>
                    <span class="skill-tag-sm">费${cd.energyCost}</span>
                    ${count > 1 ? `<span class="skill-tag-sm">×${count}</span>` : ''}
                  </div>
                  <div class="skill-desc-sm">${cd.desc}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
          ${this.equipment.length > 0 ? `
          <div class="stats-section">
            <h3>装备 (${this.equipment.length}件)</h3>
            ${this.equipment.map(eq => `<div class="equip-item"><span class="equip-name">${eq.name}</span> <span class="equip-rarity ${eq.rarity}">${eq.rarity}</span><br><span class="equip-desc">${eq.desc}</span></div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;

    const existing = document.getElementById('statsOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'statsOverlay';
    overlay.innerHTML = panelHtml;
    document.body.appendChild(overlay);
    document.getElementById('statsOverlay').onclick = function(e) {
      if (e.target === this) game.closeStatsPanel();
    };
  }

  closeStatsPanel() {
    audio.playUiClick();
    const overlay = document.getElementById('statsOverlay');
    if (overlay) overlay.remove();
  }

  // ============ CHAPTER / VICTORY ============

  showChapterClear() {
    this.state = 'chapter_clear';
    audio.playBgm('victory');
    const prevRegion = REGIONS[this.currentRegion - 1];
    const nextRegion = REGIONS[this.currentRegion];
    document.getElementById('app').innerHTML = `
      <div class="screen victory-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_bamboo.jpg');opacity:0.2"></div>
        <div class="panel victory-final-panel">
          <h2>${prevRegion.name} 踏破</h2>
          <div class="result-summary">
            <div class="result-item">进入 ${nextRegion.name}</div>
            <div class="result-item">剩余生命：${this.hp}/${this.maxHp}</div>
            <div class="result-item">物资：${this.supply}</div>
            <div class="result-item">牌组：${this.cards.length}张</div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.nextChapter()">进入 ${nextRegion.name}</button>
        </div>
      </div>
    `;
  }

  nextChapter() {
    audio.playUiClick();
    audio.stopBgm();
    this.hp = this.maxHp;
    this.showRouteMap();
  }

  showVictoryScreen() {
    this.state = 'game_over';
    audio.playBgm('victory');
    setTimeout(() => audio.stopBgm(), 1000);

    const isFinalVictory = this.currentRegion >= REGIONS.length - 1;
    document.getElementById('app').innerHTML = `
      <div class="screen victory-screen">
        <div class="ink-bg" style="background-image:url('assets/bg_menu_fan_kuan.jpg');opacity:0.3"></div>
        <div class="panel victory-final-panel">
          <h2>${isFinalVictory ? '登 峰' : '落 幕'}</h2>
          <div class="victory-title">${isFinalVictory ? '—— 《织律》掌握者 ——' : '—— 征程暂歇 ——'}</div>
          <div class="result-summary">
            <div class="result-item">抵达：第 ${this.currentRegion + 1} 章 · 第 ${this.currentLayer + 1} 层</div>
            <div class="result-item">剩余生命：${this.hp}/${this.maxHp}</div>
            <div class="result-item">物资：${this.supply}</div>
            <div class="result-item">牌组：${this.cards.length}张</div>
            <div class="result-item">装备：${this.equipment.length} 件</div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.showMenu()">返回主菜单</button>
          <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="game.selectCharacter()">换个角色再战</button>
        </div>
      </div>
    `;
  }

  showGameOver() {
    this.state = 'game_over';
    audio.playBgm('defeat');
    setTimeout(() => audio.stopBgm(), 1500);

    document.getElementById('app').innerHTML = `
      <div class="screen gameover-screen">
        <div class="panel defeat-panel">
          <h2>折 戟</h2>
          <div class="result-summary">
            <div class="result-item">抵达层数：第 ${this.currentLayer + 1} 层</div>
            <div class="result-item">牌组：${this.cards.length}张</div>
          </div>
          <button class="btn btn-primary btn-block" onclick="game.showMenu()">返回主菜单</button>
          <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="game.pickCharacter('${this.character?.id || 'swordsman'}')">再试一次</button>
        </div>
      </div>
    `;
  }

  // ============ UTILS ============

  toast(text) {
    const el = document.createElement('div');
    el.className = 'wl-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  _showPileInfo() {
    audio.playUiClick();
    const core = this.battleCore;
    if (!core) return;
    this.toast(`抽牌堆:${core.drawPile.length} · 弃牌堆:${core.discardPile.length} · 消耗堆:${core.exhaustPile.length}`);
  }

  _shake(level) {
    const arena = document.getElementById('battleArena');
    if (!arena) return;
    arena.classList.remove('shake-light', 'shake-standard', 'shake-heavy', 'shake-execute');
    void arena.offsetWidth;
    arena.classList.add(`shake-${level}`);
    setTimeout(() => arena.classList.remove(`shake-${level}`), 560);
  }
}

// Global instance
const game = new GameController();
