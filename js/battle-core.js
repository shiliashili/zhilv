// ============================================================
// 织律 Weaveline v1.4 - Battle Core
// 卡牌驱动战斗：抽牌堆/手牌/弃牌堆/消耗堆/能量/敌人意图
// ============================================================

const ARMOR_CONST = 15; // 防御减伤常数

class BattleCore {
  constructor(setup, seed) {
    this.setup = setup; // { character, cards, equipment, signatureSword, enemies, currentHp }
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.shuffleRng = this.rng.fork('shuffle');
    this.reshuffleRng = this.rng.fork('reshuffle');
    this.effectRng = this.rng.fork('effect');
    this.aiRng = this.rng.fork('ai');

    // Turn state
    this.round = 0;
    this.phase = 'player_turn_start'; // player_turn_start | player_input | enemy_turn | victory | defeat
    this.enemyActionIndex = 0;
    this.enemyQueue = [];

    // Card zones
    this.drawPile = [];
    this.hand = [];
    this.discardPile = [];
    this.exhaustPile = [];
    this.powerZone = [];

    // Card instances registry
    this.cardInstances = {}; // { instanceId: { instanceId, cardId, upgrades, temporary, retainedThisTurn, costOverride } }

    // Energy
    this.energy = 3;
    this.maxEnergy = 3;

    // Player
    this.maxHp = setup.character.maxHp;
    this.hp = setup.currentHp != null ? Math.min(this.maxHp, Math.max(1, setup.currentHp)) : this.maxHp;
    this.atk = setup.character.atk;
    this.shield = 0;
    this.alive = true;

    // Resources
    this.swordIntent = 0;
    this.momentum = 0;
    this.focus = 0;

    // Signature sword / Martial style / Arrow style
    this.signatureSword = setup.signatureSword || null;
    this.martialStyle = setup.martialStyle || null;
    this.arrowStyle = setup.arrowStyle || null;

    // 混元真意：开局自带1蓄势
    if (this.martialStyle && this.martialStyle.effect?.startMomentum) {
      this.momentum = this.martialStyle.effect.startMomentum;
    }

    // Intent tracking - MUST come before _initEnemies (which uses it)
    this.enemyPlans = {}; // { enemyId: EnemyActionPlan }

    // Enemies
    this.enemies = [];
    this._initEnemies();

    // Proficiency
    this.proficiency = setup.proficiency || {};
    this.pendingUpgrades = [];

    // Equipment
    this.equipment = setup.equipment || [];
    this._eqState = {};

    // Buffs
    this.buffs = {};

    // Tracking
    this.battleLog = [];
    this.events = [];
    this.cardsPlayedThisTurn = []; // cardIds
    this.ultimateCastedThisTurn = false;
    this.totalHitsDealt = 0;
    this.uniqueCardsPlayedThisTurn = new Set();
    this._firstFistKickMomentumDone = false; // 疾风真意追踪

    // Equipment state
    this._eqState = {
      firstHitPoisonUsed: false,
      energyOnEmptyUsed: 0,
      energyOnReshuffleUsed: 0,
      firstPoisonNoDecayUsed: {},
      firstCastXpUsed: false,
      drawOnDiscardUsed: false,
      armorBreak3Used: false,
      zeroCostShieldUsed: false,
      firstShieldBonusUsed: false,
      firstQiDiscounted: false,
      firstArrowDiscounted: false,
      firstCost2Attacked: false,
      chain3DiffCount: 0,
      chain3DiffCards: [],
    };

    // Generate initial deck and shuffle
    this._generateDeck();
    this._shuffleDrawPile();

    // Signature sword: 太初 starts with 1 intent
    if (this.signatureSword && this.signatureSword.id === 'sword_taichu') {
      this.swordIntent = 1;
      this._log('🌟 太初：开战自送1点剑意');
    }

    // First turn shield (护心镜)
    const guardMirror = this.equipment.find(e => e.id === 'eq_guard_mirror');
    if (guardMirror) {
      this.shield += 8;
      this._log('🛡 护心镜：获得8护盾');
    }

    // Generate enemy intents
    this._generateAllIntents();
  }

  // ---- INITIALIZATION ----

  _generateDeck() {
    let instanceCounter = 0;
    // Use the player's actual deck (from setup.cards), not the character template
    const deck = this.setup.cards || this.setup.deck || [];
    for (const cardId of deck) {
      const cardDef = ALL_CARDS[cardId];
      if (!cardDef) continue;
      const instanceId = `card_${instanceCounter++}`;
      this.cardInstances[instanceId] = {
        instanceId, cardId: cardId, temporary: false,
        retainedThisTurn: false, costOverride: null,
        costOverrideDuration: null, runtimeFlags: {}
      };
      this.drawPile.push(instanceId);
      // Init proficiency if needed
      if (!this.proficiency[cardId]) {
        this.proficiency[cardId] = { xp: 0, level: 1 };
      }
    }
  }

  _shuffleDrawPile() {
    this.drawPile = this.shuffleRng.shuffle([...this.drawPile]);
  }

  _initEnemies() {
    this.setup.enemies.forEach((enemyDef, i) => {
      this.enemies.push({
        id: `enemy_${i}`,
        name: enemyDef.name,
        maxHp: enemyDef.maxHp,
        hp: enemyDef.maxHp,
        defense: enemyDef.defense || 0,
        alive: true,
        definition: enemyDef,
        statuses: {},
        cooldowns: {},
        shield: 0,
        displayOrder: i,
        phases: enemyDef.phases ? JSON.parse(JSON.stringify(enemyDef.phases)) : [],
        _originalDefense: enemyDef.defense || 0,
      });
      this.enemyPlans[`enemy_${i}`] = null;
    });
  }

  // ---- DRAW SYSTEM ----

  _drawCards(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      // Reshuffle if needed
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this._reshuffle();
      }
      if (this.drawPile.length === 0) break;

      const cardId = this.drawPile.shift();

      // Hand limit check
      if (this.hand.length >= this.setup.character.handLimit) {
        this.discardPile.push(cardId);
        this._addEvent('card_overdraw', { cardInstanceId: cardId });
        continue;
      }

      this.hand.push(cardId);
      drawn.push(cardId);
      this._addEvent('card_drawn', { cardInstanceId: cardId });
    }
    return drawn;
  }

  _reshuffle() {
    if (this.discardPile.length === 0) return;
    this.drawPile = this.reshuffleRng.shuffle([...this.discardPile]);
    this.discardPile = [];
    this._addEvent('discard_reshuffled', {});
    this._log('🔄 弃牌堆重洗入抽牌堆');

    // 轮转剑匣：重洗获得1能量
    const cycleSheath = this.equipment.find(e => e.id === 'eq_cycle_sheath');
    if (cycleSheath && this._eqState.energyOnReshuffleUsed < 1) {
      this._eqState.energyOnReshuffleUsed++;
      this.energy = Math.min(this.maxEnergy, this.energy + 1);
      this._log('⚡ 轮转剑匣：重洗获得1能量');
    }
  }

  // ---- PLAYER COMMANDS ----

  /** Play a card from hand */
  playCard(cardInstanceId, targetIds = []) {
    if (this.phase !== 'player_input') return { accepted: false, reason: '非玩家输入阶段' };
    if (!this.hand.includes(cardInstanceId)) return { accepted: false, reason: '卡牌不在手牌中' };

    const cardInst = this.cardInstances[cardInstanceId];
    const cardDef = ALL_CARDS[cardInst.cardId];
    if (!cardDef) return { accepted: false, reason: '卡牌定义不存在' };

    // Calculate final cost
    const finalCost = this._calcCost(cardInst, cardDef);
    if (this.energy < finalCost) return { accepted: false, reason: '能量不足' };

    // Validate targets
    const tMode = cardDef.targetMode;
    if (tMode === 'enemy_single' && targetIds.length !== 1) {
      // Single enemy needs 1 target
      const aliveEnemies = this.enemies.filter(e => e.alive);
      if (cardDef.name === '折光回剑' || cardDef.name === '回风斩' || cardDef.name === '流云刺' || cardDef.name === '穿林破影' || cardDef.name === '燕返' || cardDef.name === '踏月连环' ||
          cardDef.name === '青锋剑气' || cardDef.name === '百步飞剑' || cardDef.name === '一剑开天') {
        if (targetIds.length === 0) return { accepted: false, reason: '请选择目标' };
      }
    }

    // Remove from hand
    this.hand = this.hand.filter(id => id !== cardInstanceId);

    // Deduct energy
    this.energy -= finalCost;
    this._addEvent('energy_changed', { energy: this.energy, cost: finalCost });

    // Check conditions
    let conditionMet = true;
    if (cardDef.onCast?.conditional?.condition === 'was_retained' && !cardInst.retainedThisTurn) {
      conditionMet = false;
    }

    // Execute effects
    this._log(`🎯 ${cardDef.name} (费${finalCost})`);
    this._addEvent('card_play_started', { cardInstanceId, cardId: cardInst.cardId, targetIds });

    // Track cards played
    this.cardsPlayedThisTurn.push(cardInst.cardId);
    this.uniqueCardsPlayedThisTurn.add(cardInst.cardId);

    this._executeCard(cardInst, cardDef, targetIds);

    // Post-cast: resource changes
    if (cardDef.onCast?.resourceChange) {
      const rc = cardDef.onCast.resourceChange;
      if (rc.sword_intent) {
        this.swordIntent = Math.min(3, this.swordIntent + rc.sword_intent);
        this._addEvent('resource_changed', { resource: 'sword_intent', value: this.swordIntent });
        if (this.swordIntent >= 3) {
          this._addEvent('ultimate_ready', {});
          this._log('⚔️ 剑意满3！大招就绪！');
        }
      }
      if (rc.momentum) {
        let gain = rc.momentum;
        // 疾风真意：每回合第一张拳/脚额外+1蓄势
        if (this.martialStyle && this.martialStyle.effect?.firstFistKickMomentum
            && (cardDef.roleCategory === 'fist' || cardDef.roleCategory === 'kick')
            && !this._firstFistKickMomentumDone) {
          this._firstFistKickMomentumDone = true;
          gain += this.martialStyle.effect.firstFistKickMomentum;
          this._log(`💨 ${this.martialStyle.name}：首张拳脚额外+${this.martialStyle.effect.firstFistKickMomentum}蓄势`);
        }
        this.momentum = Math.min(this._momentumMax(), this.momentum + gain);
        this._addEvent('resource_changed', { resource: 'momentum', value: this.momentum });
      }
      if (rc.focus) {
        this.focus = Math.min(3, this.focus + rc.focus);
        this._addEvent('resource_changed', { resource: 'focus', value: this.focus });
        if (this.focus >= 3) {
          this._addEvent('ultimate_ready', {});
          this._log('🎯 专注满3！大招就绪！');
        }
      }
    }

    // Combo bonus for 踏月连环
    if (cardDef.onCast?.comboPerUnique) {
      // Already handled in damage calc
    }

    // 名剑效果
    this._applySignatureSwordEffect(cardDef);

    // Proficiency gain
    this._gainProficiency(cardInst.cardId, cardDef);

    // Move card to discard/exhaust based on keywords
    if (cardDef.pileKeywords.includes('exhaust')) {
      this.exhaustPile.push(cardInstanceId);
      this._addEvent('card_exhausted', { cardInstanceId });
    } else if (cardDef.cardType === 'power') {
      this.powerZone.push(cardInstanceId);
      this._addEvent('card_to_powerzone', { cardInstanceId });
    } else {
      this.discardPile.push(cardInstanceId);
      this._addEvent('card_discarded', { cardInstanceId });
    }

    // Check end conditions
    this._checkEndConditions();
    return { accepted: true, result: this.getResult(), events: [...this.events], log: [...this.battleLog] };
  }

  /** Cast ultimate (剑圣大招/弓箭手大招) */
  castUltimate() {
    if (this.phase !== 'player_input') return { accepted: false, reason: '非玩家输入阶段' };
    if (!this.setup.character.ultimate) return { accepted: false, reason: '无大招' };

    const res = this._getUltimateResource();
    if (res.value < 3) return { accepted: false, reason: res.key === 'focus' ? '专注不足3点' : '剑意不足3点' };

    const ultimate = this.setup.character.ultimate;
    if (res.key === 'focus') this.focus = 0;
    else this.swordIntent = 0;
    this.ultimateCastedThisTurn = true;

    this._addEvent('ultimate_started', {});
    this._addEvent('resource_changed', { resource: res.key, value: 0 });
    this._log(res.key === 'focus' ? '🎯 万箭齐发！' : '⚔️ 万剑归流！');

    // Execute ultimate effects
    for (const effect of ultimate.effects) {
      if (effect.type === 'damage') {
        const hits = effect.hits || 1;
        const multiplier = effect.multiplier || 1;

        if (effect.allEnemies) {
          const alive = this.enemies.filter(e => e.alive);
          for (const enemy of alive) {
            for (let h = 0; h < hits; h++) {
              this._dealDamage(enemy.id, multiplier, ['ultimate'], ultimate.hitPreset || 'heavy');
            }
          }
        } else if (effect.targetMode === 'lowest_hp_pct') {
          const alive = this.enemies.filter(e => e.alive);
          if (alive.length > 0) {
            const target = alive.reduce((a, b) => (a.hp / a.maxHp) <= (b.hp / b.maxHp) ? a : b);
            for (let h = 0; h < hits; h++) {
              this._dealDamage(target.id, multiplier, ['ultimate'], ultimate.hitPreset || 'execute');
            }
          }
        }
      }
    }

    // 太初：大招后获得8护盾
    if (this.signatureSword && this.signatureSword.id === 'sword_taichu') {
      this.shield += 8;
      this._log('🛡 太初：释放大招获得8护盾');
      this._addEvent('shield_changed', { shield: this.shield, delta: 8 });
    }

    this._addEvent('ultimate_finished', {});
    this._checkEndConditions();
    return { accepted: true, result: this.getResult(), events: [...this.events], log: [...this.battleLog] };
  }

  /** 大招资源（剑意/专注） */
  _getUltimateResource() {
    if (this.setup.character.id === 'archer') {
      return { key: 'focus', value: this.focus };
    }
    return { key: 'sword_intent', value: this.swordIntent };
  }

  /** End player turn */
  endTurn() {
    if (this.phase !== 'player_input') return { accepted: false, reason: '非玩家输入阶段' };

    this._log('--- 结束回合 ---');
    // Track enemy actions this turn for animation playback
    this.enemyTurnSummary = { attacked: false, totalDamage: 0, hpDamage: 0, shieldAbsorbed: 0 };

    // Discard non-retain cards
    const toKeep = [];
    const toDiscard = [];
    for (const ciid of this.hand) {
      const ci = this.cardInstances[ciid];
      const cd = ALL_CARDS[ci.cardId];
      if (cd && (cd.pileKeywords.includes('retain') || ci.retainedThisTurn)) {
        toKeep.push(ciid);
      } else {
        toDiscard.push(ciid);
      }
    }

    // 藏锋剑鞘：随机保留1张剑气
    const hiddenScabbard = this.equipment.find(e => e.id === 'eq_hidden_scabbard');
    if (hiddenScabbard && toDiscard.length > 0) {
      const qiCards = toDiscard.filter(ciid => {
        const cd = ALL_CARDS[this.cardInstances[ciid].cardId];
        return cd && cd.roleCategory === 'sword_qi';
      });
      if (qiCards.length > 0) {
        const pick = this.effectRng.pick(qiCards);
        toKeep.push(pick);
        toDiscard.splice(toDiscard.indexOf(pick), 1);
        this._log('⚔️ 藏锋剑鞘：保留1张剑气');
      }
    }

    this.hand = toKeep;
    this.discardPile.push(...toDiscard);

    // Clear trackers
    this.cardsPlayedThisTurn = [];
    this.uniqueCardsPlayedThisTurn.clear();
    this.ultimateCastedThisTurn = false;
    this._firstFistKickMomentumDone = false;
    this._eqState.firstHitPoisonUsed = false;
    this._eqState.energyOnReshuffleUsed = 0;
    this._eqState.firstQiDiscounted = false;
    this._eqState.firstArrowDiscounted = false;
    this._eqState.firstCost2Attacked = false;
    this._eqState.chain3DiffCount = 0;
    this._eqState.chain3DiffCards = [];

    // 回气玉：上回合能量为0，下回合+1
    const energyJade = this.equipment.find(e => e.id === 'eq_energy_jade');
    if (energyJade && this.energy === 0 && this._eqState.energyOnEmptyUsed < 2) {
      this._eqState.energyOnEmptyUsed++;
    }

    // Enemy turn
    this.phase = 'enemy_turn';
    this._executeEnemyTurn();

    // Generate next intents
    this._generateAllIntents();

    // New player turn
    this.round++;
    this.energy = this.maxEnergy;
    if (this._eqState.energyOnEmptyUsed > 0) {
      this.energy++;
      this._eqState.energyOnEmptyUsed = 0;
      this._log('⚡ 回气玉：额外获得1能量');
    }
    this.shield = 0; // Shield clears per turn (with exceptions via equipment)
    this._drawCards(this.setup.character.baseDraw);
    this.phase = 'player_input';

    this._checkEndConditions();
    return { accepted: true, result: this.getResult(), events: [...this.events], log: [...this.battleLog], enemyTurnSummary: { ...this.enemyTurnSummary } };
  }

  // ---- CARD EXECUTION ----

  _executeCard(cardInst, cardDef, targetIds) {
    const isHeavy = this._checkHeavy(cardDef);
    const isRetained = cardInst.retainedThisTurn;

    for (const effect of cardDef.effects) {
      if (effect.type === 'damage') {
        const hits = effect.hits || 1;
        const multiplier = effect.multiplier || 1;
        // 计算无视防御（贯穿箭 + 穿云流派）
        let ignoreDef = effect.ignoreDef || 0;
        if (this.arrowStyle && this.arrowStyle.effect?.arrowIgnoreDef && cardDef.roleCategory === 'arrow') {
          ignoreDef += this.arrowStyle.effect.arrowIgnoreDef;
        }

        if (effect.allEnemies) {
          const alive = this.enemies.filter(e => e.alive);
          for (const enemy of alive) {
            for (let h = 0; h < hits; h++) {
              this._dealDamage(enemy.id, multiplier, [cardDef.id], cardDef.hitPreset, ignoreDef);
            }
          }
        } else {
          let target = null;
          if (targetIds.length > 0) {
            target = this.enemies.find(e => e.id === targetIds[0] && e.alive);
          }
          if (!target) {
            const alive = this.enemies.filter(e => e.alive);
            if (alive.length > 0) target = alive[0];
          }
          if (target) {
            for (let h = 0; h < hits; h++) {
              const extraMult = this._getDamageModifiers(cardDef, cardInst, target, isHeavy);
              this._dealDamage(target.id, multiplier * extraMult, [cardDef.id], cardDef.hitPreset, ignoreDef);
            }
          }
        }
      } else if (effect.type === 'gain_shield') {
        let amount = effect.amount || 0;
        // 铁壁法衣：首次护盾+30%
        const ironWall = this.equipment.find(e => e.id === 'eq_iron_wall_robe');
        if (ironWall && !this._eqState.firstShieldBonusUsed) {
          amount = Math.floor(amount * 1.30);
          this._eqState.firstShieldBonusUsed = true;
        }
        this.shield += amount;
        this._addEvent('shield_changed', { shield: this.shield, delta: amount });
        this._log(`🛡 获得护盾+${amount}`);
      } else if (effect.type === 'draw_cards') {
        this._drawCards(effect.amount || 0);
      } else if (effect.type === 'add_status') {
        if (targetIds.length > 0) {
          const enemy = this.enemies.find(e => e.id === targetIds[0] && e.alive);
          if (enemy) this._applyStatus(enemy, effect.statusId, effect.stacks || 1);
        }
      } else if (effect.type === 'detonate_status') {
        // 引爆状态：每层造成额外伤害（或按倍率），然后清除该状态
        const enemy = this.enemies.find(e => e.id === targetIds[0] && e.alive);
        if (enemy) {
          const stacks = this._getStatusStacks(enemy, effect.statusId);
          if (stacks > 0) {
            let dmgMult = effect.damagePerStack || 0.8;
            // 猎鹰流派：引爆标记伤害+25%
            if (effect.statusId === 'mark' && this.arrowStyle && this.arrowStyle.effect?.markDetonateBonus) {
              dmgMult *= (1 + this.arrowStyle.effect.markDetonateBonus);
            }
            // 用 _dealDamage 结算（受防御/易伤影响），倍率 = 层数×每层倍率
            this._dealDamage(enemy.id, stacks * dmgMult, [cardDef.id, 'detonate'], effect.hitPreset || 'heavy');
            delete enemy.statuses[effect.statusId];
            const statusName = STATUS[effect.statusId]?.name || effect.statusId;
            this._log(`💥 引爆 ${stacks} 层${statusName}！`);
          }
        }
      } else if (effect.type === 'shield_to_damage') {
        // 护盾反震：将护盾按比例转化为伤害
        const ratio = effect.ratio || 0.8;
        const dmgFromShield = Math.floor(this.shield * ratio);
        if (dmgFromShield > 0) {
          const enemy = this.enemies.find(e => e.id === targetIds[0] && e.alive);
          if (enemy) {
            this._dealDamage(enemy.id, dmgFromShield / Math.max(1, this.atk), [cardDef.id, 'reflect'], 'standard');
            this._log(`🛡 护盾反震：转化 ${dmgFromShield} 伤害`);
          }
        }
      } else if (effect.type === 'add_buff') {
        if (!this.buffs[effect.buffId]) this.buffs[effect.buffId] = { stacks: 0, value: effect.value };
        this.buffs[effect.buffId].stacks = Math.min(effect.maxStacks || 999, this.buffs[effect.buffId].stacks + (effect.stacks || 1));
        this.buffs[effect.buffId].value = effect.value;
        this._log(`⬆ ${effect.buffId} x${this.buffs[effect.buffId].stacks}`);
      } else if (effect.type === 'resource_change') {
        if (effect.resourceId === 'momentum') {
          this.momentum = Math.min(this._momentumMax(), this.momentum + (effect.delta || 0));
          this._addEvent('resource_changed', { resource: 'momentum', value: this.momentum });
        }
      } else if (effect.type === 'modify_next_damage') {
        // 藏锋式: next sword_qi damage +25%
        this._nextDamageBonus = { tag: effect.tag, bonus: effect.bonus };
      } else if (effect.type === 'set_keyword') {
        // Add retain to self
        cardInst.retainedThisTurn = true;
      } else if (effect.type === 'conditional') {
        // Check condition
        if (effect.condition === 'last_card_was_qi') {
          if (this.cardsPlayedThisTurn.length >= 2) {
            const prevCardId = this.cardsPlayedThisTurn[this.cardsPlayedThisTurn.length - 2];
            const prevCard = ALL_CARDS[prevCardId];
            if (prevCard && prevCard.roleCategory === 'sword_qi') {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'last_card_was_arrow') {
          if (this.cardsPlayedThisTurn.length >= 2) {
            const prevCardId = this.cardsPlayedThisTurn[this.cardsPlayedThisTurn.length - 2];
            const prevCard = ALL_CARDS[prevCardId];
            if (prevCard && prevCard.roleCategory === 'arrow') {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'target_hp_below_50') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && enemy.hp / enemy.maxHp < 0.5) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'target_hp_below_25') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && enemy.hp / enemy.maxHp < 0.25) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'target_hp_above_70') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && enemy.hp / enemy.maxHp > 0.7) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'target_hp_below_30') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && enemy.hp / enemy.maxHp < 0.3) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'enemy_intent_is_attack') {
          if (targetIds.length > 0) {
            const plan = this.enemyPlans[targetIds[0]];
            if (plan && plan.intent === 'attack') {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'sword_intent_ge_2') {
          if (this.swordIntent >= 2) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        } else if (effect.condition === 'sword_intent_eq_3') {
          if (this.swordIntent === 3) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        } else if (effect.condition === 'momentum_eq_3') {
          if (this.momentum === 3) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        } else if (effect.condition === 'only_one_enemy') {
          if (this.enemies.filter(e => e.alive).length === 1) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        } else if (effect.condition === 'ultimate_casted_this_turn') {
          if (this.ultimateCastedThisTurn) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        } else if (effect.condition === 'target_has_mark') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && this._getStatusStacks(enemy, 'mark') > 0) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'target_has_burn') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && this._getStatusStacks(enemy, 'burn') > 0) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'target_has_armorBreak') {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy && this._getStatusStacks(enemy, 'armorBreak') > 0) {
              this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
            }
          }
        } else if (effect.condition === 'shield_ge_10') {
          if (this.shield >= 10) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        } else if (effect.condition === 'sword_qi_might_ge_3') {
          if ((this.buffs['sword_qi_might']?.stacks || 0) >= 3) {
            this._executeSubEffects(effect.effects, cardDef, targetIds, isHeavy);
          }
        }
      }
    }

    // Retain bonus (燕返)
    if (cardDef.onCast?.conditional?.condition === 'was_retained' && isRetained) {
      // Damage already boosted in _getDamageModifiers
    }

    // 淬毒护腕：首次伤害施加中毒
    const poisonBrace = this.equipment.find(e => e.id === 'eq_poison_brace');
    if (poisonBrace && !this._eqState.firstHitPoisonUsed && targetIds.length > 0) {
      const enemy = this.enemies.find(e => e.id === targetIds[0]);
      if (enemy) {
        this._eqState.firstHitPoisonUsed = true;
        this._applyStatus(enemy, 'poison', 2);
      }
    }

    // 铁砂袋：重式额外破甲
    const sandbag = this.equipment.find(e => e.id === 'eq_iron_sandbag');
    if (sandbag && isHeavy && targetIds.length > 0) {
      const enemy = this.enemies.find(e => e.id === targetIds[0]);
      if (enemy) this._applyStatus(enemy, 'armorBreak', 1);
    }

    // 降龙真意：重式命中附带破甲
    if (this.martialStyle && this.martialStyle.effect?.heavyArmorBreak && isHeavy && targetIds.length > 0) {
      const enemy = this.enemies.find(e => e.id === targetIds[0]);
      if (enemy) this._applyStatus(enemy, 'armorBreak', this.martialStyle.effect.heavyArmorBreak);
    }

    // 轻羽剑穗：0费牌+2护盾
    const featherTassel = this.equipment.find(e => e.id === 'eq_feather_tassel');
    if (featherTassel && this._calcCost(cardInst, cardDef) === 0 && !this._eqState.zeroCostShieldUsed) {
      this._eqState.zeroCostShieldUsed = true;
      this.shield += 2;
      this._log('🪶 轻羽剑穗：+2护盾');
    }
  }

  _executeSubEffects(effects, cardDef, targetIds, isHeavy) {
    for (const eff of (effects || [])) {
      if (eff.type === 'damage') {
        if (eff.allEnemies) {
          const alive = this.enemies.filter(e => e.alive);
          for (const enemy of alive) {
            for (let h = 0; h < (eff.hits || 1); h++) {
              this._dealDamage(enemy.id, eff.multiplier, [cardDef.id], cardDef.hitPreset);
            }
          }
        } else {
          if (targetIds.length > 0) {
            const enemy = this.enemies.find(e => e.id === targetIds[0]);
            if (enemy) {
              for (let h = 0; h < (eff.hits || 1); h++) {
                this._dealDamage(enemy.id, eff.multiplier, [cardDef.id], cardDef.hitPreset);
              }
            }
          }
        }
      } else if (eff.type === 'gain_shield') {
        this.shield += eff.amount || 0;
      } else if (eff.type === 'add_status') {
        if (eff.allEnemies) {
          for (const enemy of this.enemies.filter(e => e.alive)) {
            this._applyStatus(enemy, eff.statusId, eff.stacks || 1);
          }
        } else if (targetIds.length > 0) {
          const enemy = this.enemies.find(e => e.id === targetIds[0]);
          if (enemy) this._applyStatus(enemy, eff.statusId, eff.stacks || 1);
        }
      } else if (eff.type === 'detonate_status') {
        const enemy = this.enemies.find(e => e.id === targetIds[0] && e.alive);
        if (enemy) {
          const stacks = this._getStatusStacks(enemy, eff.statusId);
          if (stacks > 0) {
            this._dealDamage(enemy.id, stacks * (eff.damagePerStack || 0.8), [cardDef.id, 'detonate'], eff.hitPreset || 'heavy');
            delete enemy.statuses[eff.statusId];
            this._log(`💥 引爆 ${stacks} 层${STATUS[eff.statusId]?.name || eff.statusId}！`);
          }
        }
      }
    }
  }

  _getDamageModifiers(cardDef, cardInst, target, isHeavy) {
    let mult = 1.0;

    // Proficiency bonus
    const prof = this.proficiency[cardDef.id];
    if (prof) {
      const profMults = [1.0, 1.08, 1.18, 1.30, 1.45];
      mult *= profMults[prof.level - 1] || 1.0;
    }

    // Sword intent bonus for sword techniques/qi
    if (cardDef.roleCategory === 'sword_technique' || cardDef.roleCategory === 'sword_qi') {
      mult *= (1 + this.swordIntent * 0.10);
    }

    // Heavy bonus (武圣) — 降龙真意提升重式倍率
    if (isHeavy) {
      const baseHeavy = (this.martialStyle && this.martialStyle.effect?.heavyMult) || 1.60;
      mult *= baseHeavy;
      // Card-specific heavy bonus
      if (cardDef.onCast?.heavyBonus) {
        mult *= (1 + cardDef.onCast.heavyBonus);
      }
    }

    // 混元劲 buff
    if (this.buffs['hunyuan_power']) {
      const b = this.buffs['hunyuan_power'];
      mult *= (1 + b.value * b.stacks);
    }

    // 剑气之威 buff：剑气伤害递增
    if (this.buffs['sword_qi_might'] && cardDef.roleCategory === 'sword_qi') {
      const b = this.buffs['sword_qi_might'];
      mult *= (1 + b.value * b.stacks);
    }

    // 藏锋式 next damage bonus
    if (this._nextDamageBonus && this._nextDamageBonus.tag === cardDef.roleCategory) {
      mult *= (1 + this._nextDamageBonus.bonus);
      this._nextDamageBonus = null;
    }

    // 断岳：第一张费用≥2的单体攻击+35%
    const duanyue = this.signatureSword && this.signatureSword.id === 'sword_duanyue';
    if (duanyue && !this._eqState.firstCost2Attacked && cardDef.energyCost >= 2 && cardDef.targetMode === 'enemy_single') {
      this._eqState.firstCost2Attacked = true;
      mult *= 1.35;
      this._log('⚔️ 断岳：首张高费攻击+35%');
    }

    // 燕返保留加成
    if (cardInst.retainedThisTurn && cardDef.onCast?.conditional?.condition === 'was_retained') {
      mult *= 1.30;
    }

    // 裂脉扳指：攻击牌+22%
    const splitVeinRing = this.equipment.find(e => e.id === 'eq_split_vein_ring');
    if (splitVeinRing && cardDef.cardType === 'attack') {
      mult *= 1.22;
    }

    // 踏月连环 combo bonus
    if (cardDef.onCast?.comboPerUnique) {
      mult *= (1 + this.uniqueCardsPlayedThisTurn.size * cardDef.onCast.comboPerUnique.bonus);
    }

    // Vulnerable on target
    if (this._getStatusStacks(target, 'vulnerable') > 0) {
      mult *= 1.25;
    }

    // Weak on caster
    if (this._getPlayerStatusStacks('weak') > 0) {
      mult *= 0.80;
    }

    return mult;
  }

  _checkHeavy(cardDef) {
    const max = this._momentumMax();
    if (this.momentum >= max && (cardDef.roleCategory === 'fist' || cardDef.roleCategory === 'kick')) {
      this.momentum = 0;
      this._addEvent('resource_changed', { resource: 'momentum', value: 0 });
      this._log('💥 重式触发！');
      this._applyMartialStyleHeavy(cardDef);
      return true;
    }
    return false;
  }

  /** 蓄势上限（混元真意 +1） */
  _momentumMax() {
    let max = 3;
    if (this.martialStyle && this.martialStyle.effect?.momentumMaxAdd) {
      max += this.martialStyle.effect.momentumMaxAdd;
    }
    return max;
  }

  /** 重式触发时应用武道真意效果 */
  _applyMartialStyleHeavy(cardDef) {
    const fx = this.martialStyle?.effect;
    if (!fx) return;

    // 太极真意：触发重式获得护盾
    if (fx.heavyShield) {
      this.shield += fx.heavyShield;
      this._addEvent('shield_changed', { shield: this.shield, delta: fx.heavyShield });
      this._log(`🛡 ${this.martialStyle.name}：重式获得${fx.heavyShield}护盾`);
    }
    // 疾风真意：触发重式抽1张
    if (fx.heavyDraw) {
      this._drawCards(fx.heavyDraw);
      this._log(`🃏 ${this.martialStyle.name}：重式抽${fx.heavyDraw}张`);
    }
  }

  _calcCost(cardInst, cardDef) {
    let cost = cardDef.energyCost;

    // 惊鸿：每回合第一张剑气费用-1
    const jinghong = this.signatureSword && this.signatureSword.id === 'sword_jinghong';
    if (jinghong && !this._eqState.firstQiDiscounted && cardDef.roleCategory === 'sword_qi') {
      this._eqState.firstQiDiscounted = true;
      cost = Math.max(0, cost - 1);
    }

    // 太极真意：金钟劲费用-1
    if (this.martialStyle && this.martialStyle.effect?.goldenBellCostDown && cardDef.id === 'ms_golden_bell') {
      cost = Math.max(0, cost - this.martialStyle.effect.goldenBellCostDown);
    }

    // 疾风流派：每回合第一张箭技费用-1
    if (this.arrowStyle && this.arrowStyle.effect?.firstArrowCostDown
        && cardDef.roleCategory === 'arrow' && cardDef.tags?.includes('箭技')
        && !this._eqState.firstArrowDiscounted) {
      this._eqState.firstArrowDiscounted = true;
      cost = Math.max(0, cost - this.arrowStyle.effect.firstArrowCostDown);
    }

    // 裂脉扳指：每回合第一张攻击牌费用+1
    const splitVeinRing = this.equipment.find(e => e.id === 'eq_split_vein_ring');
    if (splitVeinRing && cardDef.cardType === 'attack' && this.cardsPlayedThisTurn.length === 0) {
      cost += 1;
    }

    return Math.max(0, cost);
  }

  // ---- DAMAGE ----

  _dealDamage(enemyId, multiplier, tags, hitPreset, ignoreDef = 0) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy || !enemy.alive) return 0;

    let damage = this.atk * multiplier;

    // Enemy defense mitigation (可无视部分防御)
    let totalDef = Math.max(0, enemy._originalDefense - (this._getStatusStacks(enemy, 'armorBreak') * 3));
    if (ignoreDef > 0) {
      totalDef = totalDef * (1 - Math.min(1, ignoreDef));
    }
    const mitigation = totalDef / (totalDef + ARMOR_CONST);
    damage *= (1 - mitigation);

    // Enemy shield absorption
    if (enemy.shield > 0) {
      const absorbed = Math.min(enemy.shield, damage);
      enemy.shield -= absorbed;
      damage -= absorbed;
    }

    damage = Math.max(1, Math.floor(damage));
    enemy.hp -= damage;

    this._addEvent('damage', {
      enemyId, amount: damage, tags, hitPreset,
      hpRemaining: enemy.hp, maxHp: enemy.maxHp
    });

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      this._addEvent('enemy_died', { enemyId, name: enemy.name });
      this._log(`💀 ${enemy.name} 被击败！`);
    }

    return damage;
  }

  _applyDamageToPlayer(amount, sourceName, skillName, enemyId) {
    const originalAmount = amount;
    let shieldAbsorbed = 0;
    // Shield absorption
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      shieldAbsorbed = absorbed;
    }

    amount = Math.max(0, Math.floor(amount));
    this.hp -= amount;
    this._log(`${sourceName} 使用 ${skillName}，对你造成 ${amount} 点伤害`);

    this._addEvent('player_damaged', { amount, sourceName, skillName, enemyId, hpRemaining: this.hp });

    // Track enemy turn summary (for animation)
    if (this.enemyTurnSummary) {
      this.enemyTurnSummary.attacked = true;
      this.enemyTurnSummary.totalDamage += originalAmount;
      this.enemyTurnSummary.hpDamage += amount;
      this.enemyTurnSummary.shieldAbsorbed += shieldAbsorbed;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  // ---- ENEMY SYSTEM ----

  _generateAllIntents() {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      this._generateIntent(enemy);
    }
  }

  _generateIntent(enemy) {
    const def = enemy.definition;
    if (!def || !def.intentPattern) return;

    // Check boss phase transitions
    if (enemy.phases && enemy.phases.length > 0) {
      for (const phase of enemy.phases) {
        if (enemy.hp / enemy.maxHp <= phase.hpThreshold && !enemy[`_phase_${phase.hpThreshold}_done`]) {
          enemy[`_phase_${phase.hpThreshold}_done`] = true;
          def.intentPattern.push({ ...phase.skillUnlock });
          this._log(`🐉 ${enemy.name} 进入新阶段！解锁：${phase.skillUnlock.tags?.join(' ') || ''}`);
        }
      }
    }

    // Filter available patterns
    const available = def.intentPattern.filter(p => {
      const cd = enemy.cooldowns[p.tags?.join(',') || p.intent] || 0;
      return cd <= 0;
    });

    if (available.length === 0) {
      this.enemyPlans[enemy.id] = {
        enemyId: enemy.id,
        intent: 'attack',
        value: 1,
        damagePerHit: 8,
        hits: 1,
        tags: ['普攻'],
        previewText: '普攻 8伤害'
      };
      return;
    }

    const weighted = available.map(p => ({ value: p, weight: p.weight || 50 }));
    const picked = this.aiRng.weightedPick(weighted);

    // Set cooldown
    if (picked.cooldown) {
      const key = picked.tags?.join(',') || picked.intent;
      enemy.cooldowns[key] = picked.cooldown + 1;
    }

    // Build preview text
    let previewText = '';
    if (picked.intent === 'attack') {
      previewText = `${picked.hits > 1 ? picked.hits + '×' : ''}${picked.damagePerHit * (picked.hits || 1)}伤害`;
      if (picked.applyStatus) {
        previewText += ` +${picked.applyStatus.stacks}层${STATUS[picked.applyStatus.statusId]?.name || ''}`;
      }
    } else if (picked.intent === 'shield') {
      previewText = `护盾${picked.value}`;
    } else if (picked.intent === 'buff') {
      previewText = `强化`;
    } else if (picked.intent === 'buff_ally') {
      previewText = `保护队友 +${picked.value}护盾`;
    }

    if (picked.tags?.length) previewText += ` [${picked.tags.join('/')}]`;

    this.enemyPlans[enemy.id] = {
      enemyId: enemy.id,
      ...picked,
      previewText
    };

    this._addEvent('intent_generated', { enemyId: enemy.id, plan: this.enemyPlans[enemy.id] });
  }

  _executeEnemyTurn() {
    // Tick cooldowns
    for (const enemy of this.enemies) {
      for (const key of Object.keys(enemy.cooldowns)) {
        if (enemy.cooldowns[key] > 0) enemy.cooldowns[key]--;
      }
    }

    // Execute enemy actions in order
    const aliveEnemies = this.enemies.filter(e => e.alive);
    for (const enemy of aliveEnemies) {
      if (!this.alive) break;

      const plan = this.enemyPlans[enemy.id];
      if (!plan) continue;

      // Tick statuses on enemy at start of its turn
      this._tickEnemyStatuses(enemy, 'owner_turn_end');

      if (plan.intent === 'attack') {
        const totalDmg = (plan.damagePerHit || 10) * (plan.hits || 1);
        this._applyDamageToPlayer(totalDmg, enemy.name, plan.tags?.join('/') || '攻击', enemy.id);

        if (plan.applyStatus) {
          this._applyPlayerStatus(plan.applyStatus.statusId, plan.applyStatus.stacks);
        }
      } else if (plan.intent === 'shield') {
        enemy.shield += plan.value || 0;
        this._log(`${enemy.name} 获得护盾 +${plan.value}`);
        if (plan.heal) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + plan.heal);
          this._log(`${enemy.name} 回复 +${plan.heal}`);
        }
      } else if (plan.intent === 'buff') {
        if (plan.value?.defUp) {
          enemy._originalDefense += plan.value.defUp;
          enemy.defense = enemy._originalDefense;
          this._log(`${enemy.name} 防御 +${plan.value.defUp}`);
        }
        if (plan.value?.atkUp) {
          this._log(`${enemy.name} 攻击力提升`);
        }
      } else if (plan.intent === 'buff_ally') {
        const ally = this.enemies.filter(e => e.alive && e.id !== enemy.id)
          .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (ally) {
          ally.shield += plan.value || 0;
          this._log(`${enemy.name} 保护 ${ally.name} +${plan.value}护盾`);
        }
      }
    }

    if (!this.alive) {
      this.phase = 'defeat';
    }
  }

  _tickEnemyStatuses(enemy, timing) {
    if (!enemy.statuses) return;
    const toRemove = [];
    for (const [statusId, instance] of Object.entries(enemy.statuses)) {
      const statusDef = STATUS[statusId];
      if (!statusDef) continue;

      // DoT 结算（中毒/灼烧等持续伤害）
      if (timing === statusDef.decayTiming && statusDef.onTick && instance.stacks > 0) {
        const tick = statusDef.onTick(instance.stacks);
        if (tick.type === 'damage' && tick.amount > 0) {
          let dmg = tick.amount;
          // 烈焰流派：灼烧每层伤害+1
          if (statusId === 'burn' && this.arrowStyle && this.arrowStyle.effect?.burnDamageBonus) {
            dmg += instance.stacks * this.arrowStyle.effect.burnDamageBonus;
          }
          // 护盾吸收（除非穿透护盾）
          if (!tick.bypassShield && enemy.shield > 0) {
            const absorbed = Math.min(enemy.shield, dmg);
            enemy.shield -= absorbed;
            dmg -= absorbed;
          }
          dmg = Math.max(0, Math.floor(dmg));
          enemy.hp -= dmg;
          this._addEvent('damage', { enemyId: enemy.id, amount: dmg, tags: tick.tags || [statusId], hpRemaining: enemy.hp, maxHp: enemy.maxHp });
          this._log(`☠ ${enemy.name} ${statusDef.name}伤害 -${dmg} (${instance.stacks}层)`);
          if (enemy.hp <= 0) {
            enemy.hp = 0;
            enemy.alive = false;
          }
        }
      }

      // 衰减（标记/破甲/虚弱/易伤/持续伤害层数）
      if (statusDef.decayTiming === 'round_end' || statusDef.decayTiming === 'owner_turn_end') {
        // 百毒囊：首次中毒结算不减少层数
        if (statusId === 'poison') {
          const poisonSac = this.equipment.find(e => e.id === 'eq_poison_sac');
          if (poisonSac && !this._eqState.firstPoisonNoDecayUsed[enemy.id]) {
            this._eqState.firstPoisonNoDecayUsed[enemy.id] = true;
            this._log('☠ 百毒囊：中毒层数保持');
          } else {
            instance.stacks = Math.max(0, instance.stacks - (statusDef.decay || 0));
          }
        } else {
          instance.stacks = Math.max(0, instance.stacks - (statusDef.decay || 0));
        }
      }

      if (instance.stacks <= 0) toRemove.push(statusId);
    }

    for (const sid of toRemove) {
      delete enemy.statuses[sid];
    }
    // Update defense from armorBreak
    enemy.defense = Math.max(0, enemy._originalDefense - (enemy.statuses?.armorBreak?.stacks || 0) * 3);
  }

  _applyStatus(enemy, statusId, stacks) {
    if (!enemy || !enemy.alive) return;
    if (!enemy.statuses) enemy.statuses = {};
    const statusDef = STATUS[statusId];
    if (!statusDef) return;

    // 箭术流派加成
    if (this.arrowStyle) {
      if (statusId === 'mark' && this.arrowStyle.effect?.markBonus) {
        stacks += this.arrowStyle.effect.markBonus;
      }
      if (statusId === 'burn' && this.arrowStyle.effect?.burnStackBonus) {
        stacks += this.arrowStyle.effect.burnStackBonus;
      }
    }

    const existing = enemy.statuses[statusId];
    const current = existing ? existing.stacks : 0;
    enemy.statuses[statusId] = { stacks: Math.min(statusDef.maxStacks, current + stacks) };
    this._log(`${enemy.name} ${statusDef.name} +${stacks} (${enemy.statuses[statusId].stacks}层)`);

    // 破阵符：精英/Boss破甲3层触发
    if (statusId === 'armorBreak' && enemy.statuses[statusId].stacks >= 3) {
      const breakerTalisman = this.equipment.find(e => e.id === 'eq_breaker_talisman');
      if (breakerTalisman && !this._eqState.armorBreak3Used && (enemy.definition?.type === 'elite' || enemy.definition?.type === 'boss')) {
        this._eqState.armorBreak3Used = true;
        this._drawCards(2);
        this.energy = Math.min(this.maxEnergy, this.energy + 1);
        this._log('💥 破阵符：抽2张+1能量');
      }
    }
  }

  _applyPlayerStatus(statusId, stacks) {
    if (!this._playerStatuses) this._playerStatuses = {};
    const statusDef = STATUS[statusId];
    if (!statusDef) return;
    const current = this._playerStatuses[statusId]?.stacks || 0;
    this._playerStatuses[statusId] = { stacks: Math.min(statusDef.maxStacks, current + stacks) };
  }

  _getStatusStacks(enemy, statusId) {
    return enemy?.statuses?.[statusId]?.stacks || 0;
  }

  _getPlayerStatusStacks(statusId) {
    return this._playerStatuses?.[statusId]?.stacks || 0;
  }

  // ---- SIGNATURE SWORD EFFECTS ----

  _applySignatureSwordEffect(cardDef) {
    if (!this.signatureSword) return;

    // 流光：不同名连段
    if (this.signatureSword.id === 'sword_liuguang') {
      if (this._eqState.chain3DiffCards.length === 0 || this._eqState.chain3DiffCards[this._eqState.chain3DiffCards.length - 1] !== cardDef.id) {
        this._eqState.chain3DiffCards.push(cardDef.id);
        if (this._eqState.chain3DiffCards.length === 3) {
          const unique = new Set(this._eqState.chain3DiffCards);
          if (unique.size === 3) {
            this._drawCards(1);
            this.shield += 4;
            this._log('✨ 流光：连段奖励！抽1牌+4护盾');
          }
          this._eqState.chain3DiffCards = [];
        }
      }
    }

    // 惊鸿：第一张剑气≥2费打出后抽1张
    if (this.signatureSword.id === 'sword_jinghong') {
      if (cardDef.roleCategory === 'sword_qi' && cardDef.energyCost >= 2 && this._eqState.firstQiDiscounted) {
        this._drawCards(1);
        this._log('⚡ 惊鸿：高费剑气奖励抽1张');
      }
    }

    // 断岳：第一张≥2费单体攻击击杀+1能量
    if (this.signatureSword.id === 'sword_duanyue') {
      if (this._eqState.firstCost2Attacked) {
        const target = this.enemies.find(e => !e.alive && e.definition);
        if (target) {
          this.energy = Math.min(this.maxEnergy, this.energy + 1);
          this._log('⚔️ 断岳：击杀！+1能量');
        }
      }
    }
  }

  // ---- PROFICIENCY ----

  _gainProficiency(cardId, cardDef) {
    if (!this.proficiency[cardId]) this.proficiency[cardId] = { xp: 0, level: 1 };

    let xpGain = 1;
    // 训练手册：首次+3
    const trainingManual = this.equipment.find(e => e.id === 'eq_training_manual');
    if (trainingManual && !this._eqState.firstCastXpUsed) {
      xpGain += 3;
      this._eqState.firstCastXpUsed = true;
    }

    this.proficiency[cardId].xp += xpGain;
    const newLevel = this._getProficiencyLevel(this.proficiency[cardId].xp);
    if (newLevel > this.proficiency[cardId].level) {
      this.proficiency[cardId].level = newLevel;
      this.pendingUpgrades.push(cardId);
      this._log(`⭐ ${cardDef.name} 熟练度提升到 Lv${newLevel}！`);
      this._addEvent('proficiency_changed', { cardId, level: newLevel });
    }
  }

  _getProficiencyLevel(xp) {
    if (xp >= 55) return 5;
    if (xp >= 30) return 4;
    if (xp >= 14) return 3;
    if (xp >= 5) return 2;
    return 1;
  }

  // ---- CHECKS ----

  _checkEndConditions() {
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.phase = 'defeat';
      this._addEvent('defeat', {});
    }
    if (this.enemies.every(e => !e.alive)) {
      this.phase = 'victory';
      this._addEvent('victory', {});
    }
  }

  // ---- PUBLIC API ----

  /** Start battle - draw first hand */
  begin() {
    this.energy = this.maxEnergy;
    this._drawCards(this.setup.character.baseDraw);
    this.phase = 'player_input';
    this._log(`--- 战斗开始 ---`);
    this._log(`⚡ 能量: ${this.energy}/${this.maxEnergy} | 抽牌: ${this.hand.length}张`);
  }

  /** Get full state for UI */
  getState() {
    return {
      round: this.round,
      phase: this.phase,
      player: {
        hp: this.hp, maxHp: this.maxHp, atk: this.atk,
        shield: this.shield, alive: this.alive
      },
      enemies: this.enemies.map(e => ({
        id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp,
        defense: e.defense, alive: e.alive, shield: e.shield,
        statuses: e.statuses, type: e.definition?.type || 'normal',
        color: e.definition?.color || '#b8a684',
        tags: e.definition?.tags || [],
        definitionId: e.definition?.id || e.id,
        glyph: e.definition?.glyph || e.name.charAt(0)
      })),
      swordIntent: this.swordIntent,
      momentum: this.momentum,
      momentumMax: this._momentumMax(),
      martialStyle: this.martialStyle,
      focus: this.focus,
      arrowStyle: this.arrowStyle,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      hand: this.hand,
      drawPileCount: this.drawPile.length,
      discardPileCount: this.discardPile.length,
      exhaustPileCount: this.exhaustPile.length,
      enemyPlans: this.enemyPlans,
      log: [...this.battleLog],
      events: [...this.events],
      proficiency: this.proficiency,
      pendingUpgrades: [...this.pendingUpgrades]
    };
  }

  getResult() {
    if (this.phase === 'victory') return { isOver: true, victory: true };
    if (this.phase === 'defeat') return { isOver: true, defeat: true };
    return { isOver: false };
  }

  /** Get card info for hand display */
  getCardInfo(cardInstanceId) {
    const ci = this.cardInstances[cardInstanceId];
    if (!ci) return null;
    const cd = ALL_CARDS[ci.cardId];
    if (!cd) return null;
    return {
      instanceId: ci.instanceId,
      cardId: ci.cardId,
      name: cd.name,
      cardType: cd.cardType,
      roleCategory: cd.roleCategory,
      energyCost: this._calcCost(ci, cd),
      originalCost: cd.energyCost,
      targetMode: cd.targetMode,
      tags: cd.tags,
      pileKeywords: cd.pileKeywords,
      desc: cd.desc,
      hitPreset: cd.hitPreset,
      castSfx: cd.castSfx,
      impactSfx: cd.impactSfx,
      retainedThisTurn: ci.retainedThisTurn,
      isCostDiscounted: this._calcCost(ci, cd) < cd.energyCost
    };
  }

  getHandCards() {
    return this.hand.map(ciid => this.getCardInfo(ciid)).filter(Boolean);
  }

  canPlayCard(cardInstanceId) {
    if (this.phase !== 'player_input') return false;
    const ci = this.cardInstances[cardInstanceId];
    if (!ci) return false;
    const cd = ALL_CARDS[ci.cardId];
    if (!cd) return false;
    return this.energy >= this._calcCost(ci, cd);
  }

  canUltimate() {
    return this.phase === 'player_input' && this._getUltimateResource().value >= 3 && !!this.setup.character.ultimate;
  }

  getAliveEnemyIds() {
    return this.enemies.filter(e => e.alive).map(e => e.id);
  }

  _log(msg) {
    this.battleLog.push(`[R${this.round}] ${msg}`);
  }

  _addEvent(type, data) {
    this.events.push({ type, round: this.round, data, timestamp: Date.now() });
  }
}
