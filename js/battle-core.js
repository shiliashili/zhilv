// ============================================================
// 织律 Weaveline - Battle Core Engine
// Auto-combat simulation with weighted skill selection,
// cooldowns, streak protection, status effects
// ============================================================

// 防御减伤常数：减伤率 = 防御 / (防御 + ARMOR_CONST)，平滑且高防收益递减
const ARMOR_CONST = 20;

class BattleCore {
  constructor(setup, rng) {
    this.setup = setup; // { character, skills, equipment, signatureSword, enemies }
    this.rng = rng;
    this.skillRng = rng.fork('skill_select');
    this.targetRng = rng.fork('target');
    this.aiRng = rng.fork('enemy_ai');

    this.player = null;
    this.enemies = [];
    this.round = 0;
    this.phase = 'initializing';
    this.events = [];
    this.battleLog = [];
    this.isPlayerVictory = false;
    this.isDefeat = false;
    this.pendingUpgrades = [];

    // Player-specific resources
    // 剑意二级制：swordIntent = 点数（0-3），swordIntentLevel = 层数（0-3）
    // 每 3 点升 1 层，每层 +10% 伤害；3 层可放大招，释放后 level -1
    this.swordIntent = 0;        // 当前剑意点数（3 点升 1 层）
    this.swordIntentLevel = 0;   // 当前剑意层数（每层 +10% 伤害）
    this.momentum = 0;           // 蓄势（武圣）
    this.firstSwordStackFree = false; // For 太初：开战自送 1 层
    this.totalHitsDealt = 0;
    this.tookDamageLastRound = false;

    // Proficiency
    this.proficiency = {};

    // Streak tracking
    this.streakState = { lastSkillId: null, consecutiveCount: 0 };

    // Buffs
    this.playerBuffs = {};
    this.hasShield = 0;

    // Enemy buffs
    this.enemyBuffs = {};

    // 装备效果状态追踪
    this._eqState = {
      chixinUsed: false,          // 炽心玉：本回合已回血
      firstCastBonusUsed: false,  // 悟剑帖：已触发
      firstHitUsed: false,        // 护身符/昆仑玉/混沌青莲：首次受击已化解
      lastSkillTag: null,         // 阴阳珏：上一个技能标签
    };

    // 聚合所有已装备道具的数值效果
    this._eq = this._aggregateEquipment();

    // 奇遇「献祭」累计的永久增伤
    if (this.setup.powerBuff) this._eq.dmgMultAdd += this.setup.powerBuff;

    this._init();

    // 太初：每场战斗开场自动获得 1 层剑意
    const sigSwordEf = this.setup.signatureSword?.effect;
    if (sigSwordEf?.firstCombatStackFree && this.setup.character.id === 'swordsman') {
      this.swordIntentLevel = 1;
      this._log('🌟 太初：开战自送 1 层剑意');
    }

    // 战前护盾（回春丹/昆仑玉/等）
    if (this._eq.startShieldPct > 0) {
      this.hasShield += Math.floor(this.player.maxHp * this._eq.startShieldPct);
    }
  }

  /** 聚合当前装备的数值效果，统一在战斗开始时计算一次 */
  _aggregateEquipment() {
    const eq = {
      dmgMultAdd: 0, dmgReduction: 0, hpRegenRound: 0, roundShieldPct: 0,
      startShieldPct: 0, allWeightMult: 0, heavyAdd: 0, ignoreDef: 0,
      vsArmorBreakAdd: 0, vsHighHpAdd: 0, vsLowHpAdd: 0, streakDmgAdd: 0,
      streakDelayAdd: 0, firstHitShieldPct: 0, momentumPerRound: 0, momentumMaxAdd: 0,
      burnOnHitChance: 0, burnOnHitStacks: 0, armorBreakOnHitChance: 0, armorBreakOnHitStacks: 0
    };
    for (const e of (this.setup.equipment || [])) {
      const ef = e.effect || {};
      if (ef.dmgMultAdd) eq.dmgMultAdd += ef.dmgMultAdd;
      if (ef.dmgReduction) eq.dmgReduction = Math.min(0.75, eq.dmgReduction + ef.dmgReduction);
      if (ef.hpRegenRound) eq.hpRegenRound += ef.hpRegenRound;
      if (ef.roundShieldPct) eq.roundShieldPct += ef.roundShieldPct;
      if (ef.startShieldPct) eq.startShieldPct += ef.startShieldPct;
      if (ef.allWeightMult) eq.allWeightMult += ef.allWeightMult;
      if (ef.heavyAdd) eq.heavyAdd += ef.heavyAdd;
      if (ef.ignoreDef) eq.ignoreDef = Math.min(0.5, eq.ignoreDef + ef.ignoreDef);
      if (ef.vsArmorBreakAdd) eq.vsArmorBreakAdd += ef.vsArmorBreakAdd;
      if (ef.vsHighHpAdd) eq.vsHighHpAdd += ef.vsHighHpAdd;
      if (ef.vsLowHpAdd) eq.vsLowHpAdd += ef.vsLowHpAdd;
      if (ef.streakDmgAdd) eq.streakDmgAdd += ef.streakDmgAdd;
      if (ef.streakDelayAdd) eq.streakDelayAdd += ef.streakDelayAdd;
      if (ef.firstHitShieldPct) eq.firstHitShieldPct = Math.max(eq.firstHitShieldPct, ef.firstHitShieldPct);
      if (ef.momentumPerRound) eq.momentumPerRound += ef.momentumPerRound;
      if (ef.momentumMaxAdd) eq.momentumMaxAdd += ef.momentumMaxAdd;
      if (ef.burnOnHitChance) { eq.burnOnHitChance = Math.max(eq.burnOnHitChance, ef.burnOnHitChance); eq.burnOnHitStacks = Math.max(eq.burnOnHitStacks, ef.burnOnHitStacks || 1); }
      if (ef.armorBreakOnHitChance) { eq.armorBreakOnHitChance = Math.max(eq.armorBreakOnHitChance, ef.armorBreakOnHitChance); eq.armorBreakOnHitStacks = Math.max(eq.armorBreakOnHitStacks, ef.armorBreakOnHitStacks || 1); }
    }
    return eq;
  }

  _momentumMax() {
    return 3 + (this._eq?.momentumMaxAdd || 0);
  }

  _init() {
    const charDef = this.setup.character;
    const currentHp = (this.setup.currentHp != null) ? this.setup.currentHp : charDef.maxHp;
    this.player = {
      id: 'player',
      name: charDef.name,
      maxHp: charDef.maxHp,
      hp: Math.min(charDef.maxHp, Math.max(1, currentHp)),
      atk: charDef.atk || 15,
      defense: 0,
      speed: 5,
      alive: true,
      faction: 'player',
      skillSlots: [...this.setup.skills],
      displayOrder: 0
    };

    // Initialize proficiency
    this.player.skillSlots.forEach(s => {
      this.proficiency[s.id] = { xp: 0, level: 1 };
    });

    // Initialize enemies
    this.setup.enemies.forEach((enemy, i) => {
      this.enemies.push({
        id: `enemy_${i}`,
        name: enemy.name,
        maxHp: enemy.maxHp,
        hp: enemy.maxHp,
        defense: enemy.defense || 0,
        speed: enemy.speed || 4,
        alive: true,
        faction: 'enemy',
        definition: enemy,
        cooldowns: {},
        displayOrder: i,
        phases: enemy.phases ? [...enemy.phases] : []
      });
      this.enemyBuffs[`enemy_${i}`] = { damageTakenMult: 1, nextActionWeaken: 0 };
    });
  }

  // ============ PUBLIC API ============

  /** Run battle to completion, return all events */
  runToEnd(maxRounds = 100) {
    while (!this.isDefeat && !this.isPlayerVictory && this.round < maxRounds) {
      this._executeRound();
    }
    return {
      events: this.events,
      log: this.battleLog,
      victory: this.isPlayerVictory,
      defeat: this.isDefeat,
      rounds: this.round,
      player: this.player,
      enemies: this.enemies,
      proficiency: this.proficiency
    };
  }

  /** Execute one round */
  step() {
    if (this.isDefeat || this.isPlayerVictory) return null;
    this._executeRound();
    return {
      phase: this.phase,
      events: this.events.slice(-20),
      player: this.player,
      enemies: this.enemies
    };
  }

  // ============ MANUAL BATTLE API ============

  /** 手动模式：仅初始化，不自动执行 */
  startManual() {
    this.round = 0;
    this._nextAction = null;
  }

  /** 回合开始（冷却、状态、buff） */
  beginRound() {
    this.round++;
    this.phase = 'round_start';
    this._log(`--- 第 ${this.round} 回合开始 ---`);
    this._cooldownTick();
    this._statusTick('round_start');
    this._processBuffs();
  }

  /** 玩家选择技能后执行 */
  playSkill(skill) {
    if (this.isDefeat || this.isPlayerVictory) return this.isBattleOver();
    this.phase = 'selecting_player_skill';
    this._log(`🎯 选择技能: ${skill.name}`);

    // Update streak
    if (this.streakState.lastSkillId === skill.id) {
      this.streakState.consecutiveCount++;
    } else {
      this.streakState.lastSkillId = skill.id;
      this.streakState.consecutiveCount = 1;
    }

    this._addEvent('skill_cast', { skill, weight: skill.baseWeight, streak: this.streakState.consecutiveCount });

    // Check if signature sword buff applies
    if (this.setup.signatureSword) {
      this._applySignatureSword(this.setup.signatureSword, skill);
    }

    this._executePlayerSkill(skill);
    // 链式内功：自动追打拳/脚
    if (skill.chainAction) {
      this._chainAction = skill;
      this._executeChainAction();
      this._chainAction = null;
    }
    // 检查是否触发胜利/失败
    this._checkEndConditions();
    return this.isBattleOver();
  }

  /** 执行本轮所有敌人行动 */
  playEnemies() {
    if (this.isDefeat || this.isPlayerVictory) return this.isBattleOver();
    this.phase = 'resolving_enemies';
    const aliveEnemies = this.enemies.filter(e => e.alive);
    aliveEnemies.sort((a, b) => b.speed - a.speed);
    for (const enemy of aliveEnemies) {
      if (this.isDefeat || this.isPlayerVictory) break;
      this._enemyAction(enemy);
    }
    this._checkEndConditions();
    return this.isBattleOver();
  }

  /** 回合结束处理 */
  endRound() {
    if (this.isDefeat || this.isPlayerVictory) return this.isBattleOver();
    this.phase = 'round_end';
    this._statusTick('round_end');
    this._processBuffs();
    this._log(`--- 第 ${this.round} 回合结束 ---`);
    this._checkEndConditions();
    return this.isBattleOver();
  }

  _checkEndConditions() {
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.alive = false;
      this.isDefeat = true;
      this.phase = 'defeat';
      this._addEvent('defeat', {});
    }
    if (this.enemies.every(e => !e.alive)) {
      this.isPlayerVictory = true;
      this.phase = 'victory';
      this._addEvent('victory', {});
    }
  }

  /** 获取可用技能（不在冷却中） */
  getAvailableSkills() {
    return this.player.skillSlots.filter(s => {
      const cd = this._getCooldown(s.id);
      if (cd > 0) return false;
      // 大招层数门禁
      if (s.requireSwordIntent) {
        let required = s.requireSwordIntent;
        const sigSwordEf = this.setup.signatureSword?.effect;
        if (sigSwordEf?.ultimateCostReduce) required = Math.max(1, required - sigSwordEf.ultimateCostReduce);
        if (this.swordIntentLevel < required) return false;
      }
      return true;
    });
  }

  /** 从可用技能中随机抽取 count 张卡 */
  drawHand(count = 4) {
    const available = this.getAvailableSkills();
    const shuffled = this.skillRng.shuffle([...available]);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /** 是否可以释放大招（剑圣专用） */
  canUltimate() {
    if (!this.setup.signatureSword?.ultimate) return false;
    let required = 3;
    const sigSwordEf = this.setup.signatureSword.effect;
    if (sigSwordEf?.ultimateCostReduce) required = Math.max(1, required - sigSwordEf.ultimateCostReduce);
    return this.swordIntentLevel >= required;
  }

  /** 释放名剑大招（层数 -1） */
  playUltimate() {
    if (!this.canUltimate()) return { ok: false };
    const sword = this.setup.signatureSword;
    const ultimate = sword.ultimate;
    const before = this.swordIntentLevel;
    this.swordIntentLevel = Math.max(0, this.swordIntentLevel - 1);
    this._log(`⚔️ ${ultimate.name}！剑意层数 ${before} → ${this.swordIntentLevel}`);
    this._executePlayerSkill(ultimate);
    this._checkEndConditions();
    return this.isBattleOver();
  }

  /** 返回对外状态（供 UI 渲染） */
  getBattleState() {
    return {
      round: this.round,
      player: {
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        atk: this.player.atk,
        hasShield: this.hasShield,
        alive: this.player.alive
      },
      enemies: this.enemies.map(e => ({
        id: e.id,
        name: e.name,
        hp: e.hp,
        maxHp: e.maxHp,
        defense: e.defense,
        alive: e.alive,
        type: e.definition?.type || 'normal',
        color: e.definition?.color || '#b8a684'
      })),
      swordIntent: this.swordIntent,
      swordIntentLevel: this.swordIntentLevel,
      momentum: this.momentum,
      log: [...this.battleLog],
      phase: this.phase
    };
  }

  /** 战斗是否结束 */
  isBattleOver() {
    return {
      isOver: this.isDefeat || this.isPlayerVictory,
      victory: this.isPlayerVictory,
      defeat: this.isDefeat,
      player: this.player,
      enemies: this.enemies,
      proficiency: this.proficiency,
      pendingUpgrades: [...this.pendingUpgrades],
      log: this.battleLog,
      rounds: this.round,
      events: this.events
    };
  }

  // ============ ROUND EXECUTION (AUTO) ============

  _executeRound() {
    this.round++;
    this.phase = 'round_start';
    this._log(`--- 第 ${this.round} 回合开始 ---`);

    // Process round-start status ticks
    this._cooldownTick();
    this._statusTick('round_start');
    this._processBuffs();

    // Player auto-action
    this.phase = 'selecting_player_skill';
    this._playerAutoAction();

    if (this.isDefeat || this.isPlayerVictory) return;

    // Enemy actions
    this.phase = 'resolving_enemies';
    const aliveEnemies = this.enemies.filter(e => e.alive);
    aliveEnemies.sort((a, b) => b.speed - a.speed);
    for (const enemy of aliveEnemies) {
      if (this.isDefeat || this.isPlayerVictory) return;
      this._enemyAction(enemy);
    }

    // Round end processing
    this.phase = 'round_end';
    this._statusTick('round_end');
    this._processBuffs();

    this._log(`--- 第 ${this.round} 回合结束 ---`);

    // Check defeat after round end
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.alive = false;
      this.isDefeat = true;
      this.phase = 'defeat';
      this._addEvent('defeat', {});
    }

    // Check victory
    if (this.enemies.every(e => !e.alive)) {
      this.isPlayerVictory = true;
      this.phase = 'victory';
      this._addEvent('victory', {});
    }
  }

  // ============ PLAYER AUTO ACTION ============

  _playerAutoAction() {
    // Check for internal skill chains (武圣 内功)
    if (this._chainAction) {
      this._executeChainAction();
      return;
    }

    // Collect available skills
    const available = this.player.skillSlots.filter(s => {
      const cooldown = this._getCooldown(s.id);
      return cooldown <= 0;
    });

    // 大招剑意层数门禁：层数不够时将权重视为 0（强制不抽中）
    // 见 _pickSkill 中的 weight 调整

    if (available.length === 0) {
      this._log('所有技能冷却中，使用基础攻击');
      this._basicAttack();
      return;
    }

    // Calculate effective weights
    const weighted = available.map(s => {
      let w = s.baseWeight;

      // 定星珠：最低基础权重技能权重+35%
      if (this.setup.equipment?.some(e => e.id === 'eq_dingxing_zhu')) {
        const allSlots = this.player.skillSlots;
        const minWeight = Math.min(...allSlots.map(s2 => s2.baseWeight));
        if (s.baseWeight === minWeight) w *= 1.35;
      }

      // 轻身步/流云袖/无双谱/伏羲琴：所有招式权重加成
      if (this._eq.allWeightMult > 0) w *= (1 + this._eq.allWeightMult);

      // 武圣 condition: sweep kick weight bonus for 2+ enemies
      if (s.weightCondition) {
        const aliveEnemies = this.enemies.filter(e => e.alive).length;
        if (s.weightCondition.condition === 'enemies_ge_2' && aliveEnemies >= 2) {
          w *= s.weightCondition.multiplier;
        }
      }

      // 连星扣 / 凝神珠 / 伏羲琴 / 普通连出保护
      const hasRatchet = this.setup.equipment?.some(e => e.id === 'eq_lianxing_kou');
      if (this.streakState.lastSkillId === s.id && this.streakState.consecutiveCount > 0) {
        const streakStart = (hasRatchet ? 3 : 2) + this._eq.streakDelayAdd; // 凝神珠+1、伏羲琴+2
        if (this.streakState.consecutiveCount >= streakStart) {
          const charStreaks = this.setup.character.streakMultipliers || [{ after: 2, mult: 0.60 }, { after: 3, mult: 0.30 }];
          const match = charStreaks.find(rule => this.streakState.consecutiveCount >= rule.after);
          if (match) w *= match.mult;
        }
      }

      // 太初 low HP sword bonus
      const sigSword = this.setup.signatureSword;
      if (sigSword && sigSword.id === 'sword_taichu') {
        const lowHpBonus = sigSword.effect.lowHpSwordBonus;
        if (lowHpBonus && this.player.hp / this.player.maxHp < lowHpBonus.lowHpThreshold) {
          if (s.tag === '剑技') w *= lowHpBonus.weightMult;
        }
      }

      // 大招剑意层数门禁：层数不够时不抽中（过滤掉大招）
      if (s.requireSwordIntent) {
        let required = s.requireSwordIntent;
        const sigSwordEf = this.setup.signatureSword?.effect;
        if (sigSwordEf?.ultimateCostReduce) required = Math.max(1, required - sigSwordEf.ultimateCostReduce);
        if (this.swordIntentLevel < required) return null;
      }

      return { skill: s, weight: Math.max(1, w) };
    }).filter(Boolean);

    // Pick skill
    const picked = this.skillRng.weightedPick(weighted.map(w => ({ value: w.skill, weight: w.weight })));
    const effectiveWeight = weighted.find(w => w.skill.id === picked.id)?.weight || picked.baseWeight;

    this._log(`🎯 随机抽中: ${picked.name}（权重: ${effectiveWeight.toFixed(0)}）`);

    // Update streak
    if (this.streakState.lastSkillId === picked.id) {
      this.streakState.consecutiveCount++;
    } else {
      this.streakState.lastSkillId = picked.id;
      this.streakState.consecutiveCount = 1;
    }

    // Add event
    this._addEvent('skill_cast', { skill: picked, weight: effectiveWeight, streak: this.streakState.consecutiveCount });

    // Check if signature sword buff applies
    if (this.setup.signatureSword) {
      const sword = this.setup.signatureSword;
      this._applySignatureSword(sword, picked);
    }

    // Execute skill
    this._executePlayerSkill(picked);

    // Check for chain action (武圣 内功)
    if (picked.chainAction) {
      this._chainAction = picked;
      this._playerAutoAction();
      this._chainAction = null;
    } else {
      this._chainAction = null;
    }
  }

  _executeChainAction() {
    const innerSkill = this._chainAction;
    let bonusMultiplier = 1;
    if (innerSkill.chainAction.heavyBonus) bonusMultiplier = 1 + innerSkill.chainAction.heavyBonus;

    // Pick fist or kick
    const fistOrKick = this.player.skillSlots.filter(s =>
      (s.tag === '拳法' || s.tag === '脚法' || s.tag === '拳法·绝技' || s.tag === '脚法·绝技') &&
      this._getCooldown(s.id) <= 0
    );

    if (fistOrKick.length === 0) {
      this._log('内功：无可用的拳/脚技能');
      this._basicAttack();
      return;
    }

    const picked = this.skillRng.pick(fistOrKick);
    this._log(`💪 内功追加: ${picked.name}${bonusMultiplier > 1 ? ` (重式加成: +${((bonusMultiplier-1)*100).toFixed(0)}%)` : ''}`);
    this._addEvent('skill_cast', { skill: picked, weight: 0, streak: this.streakState.consecutiveCount, chained: true });

    // Check if momentum triggers 重式
    let isHeavy = false;
    if (this.momentum >= 3 && (picked.tag.includes('拳法') || picked.tag.includes('脚法'))) {
      isHeavy = true;
      this.momentum = 0;
      this._log(`💥 蓄势爆发！重式！`);
    }

    this._executePlayerSkill(picked, { bonusMultiplier, isHeavy });
  }

  _basicAttack() {
    const dmg = Math.max(1, Math.round(this.player.atk * 0.5));
    const target = this._pickTarget('random');
    if (target) {
      this._present = { skillId: null, name: '普攻', category: 'basic', tag: '普攻', preset: 'light', isHeavy: false, isBloom: false, impactSfx: 'hit' };
      this._dealDamage(this.player.id, target.id, dmg, ['basic']);
    }
  }

  // ============ SKILL EXECUTION ============

  _executePlayerSkill(skill, options = {}) {
    let { bonusMultiplier = 1, isHeavy = false } = options;

    // 大招逻辑：要求剑意层数 >= requireSwordIntent，释放后层数 -consumeSwordIntent
    let isUltimate = false;
    if (skill.requireSwordIntent) {
      let required = skill.requireSwordIntent;
      // 惊鸿：大招要求-1（但不低于 1）
      const sigSwordEf = this.setup.signatureSword?.effect;
      if (sigSwordEf?.ultimateCostReduce) required = Math.max(1, required - sigSwordEf.ultimateCostReduce);
      // 防御性守卫：层数不够时此技能不应被调用（pick 阶段已过滤）
      if (this.swordIntentLevel < required) {
        this._log(`⚠️ 剑意不足（${this.swordIntentLevel}/${required}），无法释放大招`);
        return;
      }
      const consume = skill.consumeSwordIntent || 1;
      const before = this.swordIntentLevel;
      this.swordIntentLevel = Math.max(0, this.swordIntentLevel - consume);
      isUltimate = true;
      this._log(`⚔️ 大招释放！剑意层数 ${before} → ${this.swordIntentLevel}`);
    }

    // 演出元数据：供表现层按事件驱动斩击/剑气/震屏等效果，不影响结算
    this._present = {
      skillId: skill.id,
      name: skill.name,
      category: skill.category,
      tag: skill.tag,
      preset: skill.hitPreset || 'standard',
      isHeavy,
      isBloom: false, // 旧盛放机制已移除
      isUltimate,
      impactSfx: skill.impactSfx,
      castSfx: skill.castSfx,
      multiHit: !!skill.multiHit,
      ultimate: !!skill.tier || skill.tag.includes('绝技') || skill.tag.includes('大招')
    };

    // Determine effects to use
    let effects = skill.effects;

    // 武圣 heavy bonus
    if (isHeavy && skill.heavyBonus) {
      bonusMultiplier *= (skill.heavyBonus.multiplier || 1);
      if (skill.heavyBonus.critDamage) bonusMultiplier *= (1 + skill.heavyBonus.critDamage);
      if (skill.heavyBonus.execute) skill.execute = true;
    }

    // Process each effect
    let totalDamage = 0;
    for (const effect of effects) {
      if (effect.type === 'damage') {
        const hits = effect.hits || 1;
        for (let h = 0; h < hits; h++) {
          // Pick target
          let target;
          if (effect.allEnemies) {
            // Deal damage to all alive enemies
            const alive = this.enemies.filter(e => e.alive);
            for (const enemy of alive) {
              totalDamage += this._resolveDamage(skill, effect, enemy, bonusMultiplier, isHeavy);
            }
            continue;
          } else {
            target = this._pickTarget(skill.target, skill);
            if (!target) continue;
          }

          totalDamage += this._resolveDamage(skill, effect, target, bonusMultiplier, isHeavy);

          // Execute check
          this._checkExecute(skill, target, totalDamage, isHeavy);
        }

        // 断岳: hit counter
        this.totalHitsDealt += hits;
        if (this.setup.signatureSword && this.setup.signatureSword.id === 'sword_duanyue') {
          if (this.totalHitsDealt >= 7) {
            this.totalHitsDealt = 0;
            this._log('⚔️ 断岳一击！');
          }
        }

      } else if (effect.type === 'buff') {
        if (!this.playerBuffs[effect.buff]) this.playerBuffs[effect.buff] = { stacks: 0, value: effect.amount };
        this.playerBuffs[effect.buff].stacks = Math.min(effect.maxStacks || 999, this.playerBuffs[effect.buff].stacks + 1);
        this.playerBuffs[effect.buff].value = effect.amount;
        this._log(`⬆️ 获得${effect.buff} x${this.playerBuffs[effect.buff].stacks}`);
      } else if (effect.type === 'shield') {
        this.hasShield += Math.floor(this.player.maxHp * effect.amount);
        this._log(`🛡️ 获得护盾 +${Math.floor(this.player.maxHp * effect.amount)}`);
      } else if (effect.type === 'heal') {
        const healAmt = Math.floor(this.player.maxHp * effect.amount);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
        this._log(`💚 回复生命 +${healAmt}`);
      } else if (effect.type === 'set_momentum') {
        this.momentum = Math.min(this._momentumMax(), effect.amount);
        this._log(`💪 蓄势达到${this.momentum}！`);
      }
    }

    // Apply on-hit effects
    if (skill.onHit) {
      if (skill.onHit.swordIntent) {
        // 二级制：点数 +1，满 3 升 1 层
        this.swordIntent += skill.onHit.swordIntent;
        const sigSwordEf = this.setup.signatureSword?.effect;
        // 太初：低血量时，剑技命中额外 +1 点
        if (sigSwordEf?.lowHpSwordBonus &&
            this.player.hp / this.player.maxHp < sigSwordEf.lowHpSwordBonus.lowHpThreshold) {
          this.swordIntent += sigSwordEf.lowHpSwordBonus.intentBonus;
        }
        // 每 3 点升 1 层（最多 3 层）
        while (this.swordIntent >= 3 && this.swordIntentLevel < 3) {
          this.swordIntentLevel++;
          this.swordIntent -= 3;
          this._log(`⬆ 剑意突破！层数升为 ${this.swordIntentLevel} / 3（+${this.swordIntentLevel * 10}% 伤害）`);
        }
        // 层数已满 3 时点数不再累积
        if (this.swordIntentLevel >= 3) this.swordIntent = 0;
        if (this.swordIntent > 0) {
          this._log(`✦ 剑意 +1，点数: ${this.swordIntent}/3，层数: ${this.swordIntentLevel}/3`);
        }
      }
    }

    // Apply status effects
    if (skill.applyStatus) {
      const target = this._pickTarget(skill.target);
      if (target) this._applyStatus(target.id, skill.applyStatus);
    }

    // 武圣 armor break bonus
    if (skill.armorBrokenBonus) {
      const target = this._pickTarget(skill.target);
      if (target && this._getStatusStacks(target.id, 'armorBreak') > 0) {
        this._log(`碎甲加成！`);
        // Re-deal with higher damage
        const extraDmg = (skill.armorBrokenBonus.damage - 1) * skill.effects[0].base;
        this._dealDamage(this.player.id, target.id, Math.floor(extraDmg), ['bonus']);
      }
    }

    // Condition bonus
    let conditionMet = false;
    if (skill.conditionBonus) {
      const target = this._pickTarget(skill.target);
      if (target) {
        if (skill.conditionBonus.condition === 'target_hp_above_70' && target.hp / target.maxHp > 0.7) conditionMet = true;
        if (skill.conditionBonus.condition === 'target_hp_below_50' && target.hp / target.maxHp < 0.5) conditionMet = true;
        if (skill.conditionBonus.condition === 'last_skill_qi' && this.streakState.consecutiveCount === 1) {
          const lastSkill = this.player.skillSlots.find(s => s.id === this.streakState.lastSkillId);
          if (lastSkill && lastSkill.category === 'sword_qi') conditionMet = true;
        }
        if (conditionMet) {
          const bonusDmg = skill.effects[0].base * skill.conditionBonus.damage * bonusMultiplier;
          this._dealDamage(this.player.id, target.id, Math.floor(bonusDmg), ['condition']);
        }
      }
    }

    // Chain bonus (回风斩 different skill)
    if (skill.chainBonus && this.streakState.lastSkillId && this.streakState.lastSkillId !== skill.id) {
      const target = this._pickTarget(skill.target);
      if (target) {
        const chainDmg = skill.effects[0].base * skill.chainBonus.damage * bonusMultiplier;
        this._dealDamage(this.player.id, target.id, Math.floor(chainDmg), ['chain']);
        this._log('🔄 回风追击！');
      }
    }

    // Revenge bonus (折光回剑)
    if (skill.revengeBonus && this.tookDamageLastRound) {
      const target = this._pickTarget(skill.target);
      if (target) {
        const revengeDmg = skill.effects[0].base * skill.revengeBonus.damage * bonusMultiplier;
        this._dealDamage(this.player.id, target.id, Math.floor(revengeDmg), ['revenge']);
        this._log('↩️ 折光反击！');
      }
    }

    // Execute bonus (穿林破影)
    if (skill.executeBonus) {
      const target = this._pickTarget(skill.target);
      if (target && target.hp / target.maxHp < skill.executeBonus.threshold) {
        const chaseDmg = skill.effects[0].base * skill.executeBonus.chaseDamage * bonusMultiplier;
        this._dealDamage(this.player.id, target.id, Math.floor(chaseDmg), ['chase']);
        this._log('🏃 穿林追击！');
      }
    }

    // 剑鸣机制已移除（剑意改 3 层堆叠系统）

    // Proficiency gain
    const hasReplayModule = this.setup.equipment?.some(e => e.id === 'eq_huifeng_jian');
    const hasTrainingManual = this.setup.equipment?.some(e => e.id === 'eq_wujian_tie');

    if ((totalDamage > 0 || isHeavy) && !hasReplayModule) {
      if (this.proficiency[skill.id]) {
        let xpGain = 1;
        // 悟剑帖：每场战斗第1次释放获得+3熟练经验
        if (hasTrainingManual && !this._eqState.firstCastBonusUsed) {
          xpGain += 3;
          this._eqState.firstCastBonusUsed = true;
          this._log('📖 悟剑帖：额外+3熟练经验');
        }
        this.proficiency[skill.id].xp += xpGain;
        const newLevel = this._getProficiencyLevel(this.proficiency[skill.id].xp);
        if (newLevel > this.proficiency[skill.id].level) {
          this.proficiency[skill.id].level = newLevel;
          this.pendingUpgrades.push(skill.id);
          this._log(`⭐ ${skill.name} 熟练度提升到 Lv${newLevel}！`);
        }
      }
    }

    // 蓄势 gain
    this.momentum = Math.min(this._momentumMax(), this.momentum + 1);
  }

  _resolveDamage(skill, effect, target, bonusMultiplier, isHeavy) {
    let rawDmg = effect.base; // 具体伤害数值（来自 data.js）

    // Proficiency bonus
    const prof = this.proficiency[skill.id];
    if (prof) {
      const profMult = [1.0, 1.08, 1.18, 1.30, 1.45][prof.level - 1] || 1.0;
      rawDmg *= profMult;
    }

    // 剑意层数加成：剑技/剑气吃每层 +10%，大招不吃（已含强力设定）
    if (skill.category === 'sword_technique' || skill.category === 'sword_qi') {
      rawDmg *= (1 + this.swordIntentLevel * 0.10);
    }
    // 惊鸿：大招伤害额外 +20%
    if (skill.category === 'sword_ultimate' && this.setup.signatureSword?.effect?.ultimateBonus) {
      rawDmg *= (1 + this.setup.signatureSword.effect.ultimateBonus);
    }

    // 阴阳珏：不同标签相邻+8%效果
    if (this.setup.equipment?.some(e => e.id === 'eq_yinyang_jue')) {
      const skillIndex = this.player.skillSlots.findIndex(s => s.id === skill.id);
      if (skillIndex >= 0) {
        const totalSlots = this.player.skillSlots.length;
        const hasLoopConnector = this.setup.equipment?.some(e => e.id === 'eq_zhoutian_huan');
        const prevTag = skillIndex > 0
          ? this.player.skillSlots[skillIndex - 1].tag
          : (hasLoopConnector ? this.player.skillSlots[totalSlots - 1].tag : null);
        const nextTag = skillIndex < totalSlots - 1
          ? this.player.skillSlots[skillIndex + 1].tag
          : (hasLoopConnector ? this.player.skillSlots[0].tag : null);
        const currentTag = skill.tag;
        if ((prevTag && prevTag !== currentTag) || (nextTag && nextTag !== currentTag)) {
          rawDmg *= 1.08;
        }
      }
    }

    // 贯甲符：对带有"破甲"状态的敌人，伤害额外+25%
    if (this.setup.equipment?.some(e => e.id === 'eq_guanjia_fu')) {
      if (this._getStatusStacks(target.id, 'armorBreak') > 0) {
        rawDmg *= 1.25;
      }
    }

    // 回风鉴：效果+25%
    if (this.setup.equipment?.some(e => e.id === 'eq_huifeng_jian')) {
      rawDmg *= 1.25;
    }

    // 连星扣：连续技能伤害+8%
    if (this.setup.equipment?.some(e => e.id === 'eq_lianxing_kou')) {
      if (this.streakState.lastSkillId === skill.id && this.streakState.consecutiveCount >= 2) {
        rawDmg *= 1.08;
      }
    }

    // 装备通用增伤（裂石劲/轩辕剑意/诛仙剑/混沌青莲）
    if (this._eq.dmgMultAdd > 0) rawDmg *= (1 + this._eq.dmgMultAdd);
    // 对破甲敌人增伤（伏魔印/东皇钟）
    if (this._eq.vsArmorBreakAdd > 0 && this._getStatusStacks(target.id, 'armorBreak') > 0) rawDmg *= (1 + this._eq.vsArmorBreakAdd);
    // 对高生命敌人增伤（破军令）
    if (this._eq.vsHighHpAdd > 0 && target.hp / target.maxHp > 0.7) rawDmg *= (1 + this._eq.vsHighHpAdd);
    // 对低生命敌人增伤（红尘劫）
    if (this._eq.vsLowHpAdd > 0 && target.hp / target.maxHp < 0.3) rawDmg *= (1 + this._eq.vsLowHpAdd);
    // 连续同招增伤（定身符）
    if (this._eq.streakDmgAdd > 0 && this.streakState.lastSkillId === skill.id && this.streakState.consecutiveCount >= 2) rawDmg *= (1 + this._eq.streakDmgAdd);

    // Buff bonuses
    if (this.playerBuffs['atkUp']) {
      rawDmg *= (1 + this.playerBuffs['atkUp'].value * this.playerBuffs['atkUp'].stacks);
    }

    // Signature sword: 流光 different skill bonus
    if (this.setup.signatureSword && this.setup.signatureSword.id === 'sword_liuguang') {
      if (this.streakState.consecutiveCount === 1) { // Different from last skill
        rawDmg *= 1.12;
      }
      // 3 different in a row
      // (simplified check)
    }

    rawDmg *= bonusMultiplier;

    // Heavy multiplier (蓄势)
    if (isHeavy) {
      rawDmg *= 1.75;
      // 会心玉：蓄势重击额外+35%
      if (this.setup.equipment?.some(e => e.id === 'eq_huixin_yu')) {
        rawDmg *= 1.35;
      }
      // 玄铁戒/御风环/惊鸿扇/九天玄女佩：重击额外增伤
      if (this._eq.heavyAdd > 0) rawDmg *= (1 + this._eq.heavyAdd);
    }

    // Defense reduction: 平滑百分比减伤（含无视防御：破障符/盘古斧意）
    const effDef = Math.max(0, target.defense * (1 - this._eq.ignoreDef) - (this._getStatusStacks(target.id, 'armorBreak') * 3));
    const mitigation = effDef / (effDef + ARMOR_CONST);
    rawDmg = Math.max(1, rawDmg * (1 - mitigation));

    // Damage taken multiplier
    rawDmg *= (this.enemyBuffs[target.id]?.damageTakenMult || 1);

    // Random variance ±10%
    rawDmg *= (0.9 + this.rng.nextFloat() * 0.2);

    // 最低伤害下限：避免出现"只打1滴血"的离谱情况（尤其对高防御敌人）
    const atkFloor = Math.max(2, Math.floor(this.player.atk * 0.15));
    const finalDmg = Math.max(atkFloor, Math.floor(rawDmg));

    this._dealDamage(this.player.id, target.id, finalDmg, ['skill', skill.tag]);

    // 装备：攻击附加状态（含沙射影/赤焰符/紫电青霜/昆仑镜）
    if (this.rng && target.alive) {
      if (this._eq.armorBreakOnHitChance > 0 && this.rng.nextFloat() < this._eq.armorBreakOnHitChance) {
        this._applyStatus(target.id, { type: 'armorBreak', stacks: this._eq.armorBreakOnHitStacks });
      }
      if (this._eq.burnOnHitChance > 0 && this.rng.nextFloat() < this._eq.burnOnHitChance) {
        this._applyStatus(target.id, { type: 'burn', stacks: this._eq.burnOnHitStacks });
      }
    }

    return finalDmg;
  }

  _checkExecute(skill, target, damage, isHeavy) {
    if (!target || !target.alive) return;

    // Check if skill has execute trait
    const isExecuteSkill = skill.execute ||
      (skill.effects && skill.effects[0] && skill.effects[0].execute) ||
      (skill.heavyBonus && skill.heavyBonus.execute);

    if (isExecuteSkill && target.definition && target.definition.type !== 'boss') {
      const hpPercent = target.hp / target.maxHp;
      const threshold = (skill.effects && skill.effects[0] && skill.effects[0].execute) ||
                        skill.execute ||
                        0.18;
      if (hpPercent <= threshold) {
        target.hp = 0;
        target.alive = false;
        this._log(`💀 处决！${target.name}被直接击杀！`);
        this._addEvent('execute', { target: target.name, skill: skill.name });
      }
    }

    // 武圣: 力破 check for heavy attacks
    if (isHeavy && target.definition && target.definition.type !== 'boss') {
      const maxHpDmg = damage / target.maxHp;
      if (maxHpDmg >= 0.35) {
        const extraDmg = Math.floor(target.maxHp * 0.08);
        this._dealDamage(this.player.id, target.id, extraDmg, ['forceBreak']);
        this._log(`💥 力破！震伤 +${extraDmg}`);
      }
    }
  }

  // ============ ENEMY AI ============

  _enemyAction(enemy) {
    if (!enemy.alive) return;

    // Check phase transitions for boss
    if (enemy.phases && enemy.phases.length > 0) {
      for (const phase of enemy.phases) {
        if (enemy.hp / enemy.maxHp <= phase.hpThreshold && !enemy[`phase_${phase.hpThreshold}_active`]) {
          enemy[`phase_${phase.hpThreshold}_active`] = true;
          enemy.definition.skills = [...enemy.definition.skills, phase.skillUnlock];
          this._log(`🐉 ${enemy.name}进入第二阶段！解锁新技能：${phase.skillUnlock.name}`);
        }
      }
    }

    // Filter available skills (respect cooldowns)
    const available = enemy.definition.skills.filter(s => {
      const cd = enemy.cooldowns[s.name] || 0;
      return cd <= 0;
    });

    if (available.length === 0) {
      // Basic attack
      this._applyDamageToPlayer(enemy.maxHp * 0.1, enemy.name, '普攻', null, enemy.id);
      return;
    }

    // Pick skill by weight
    const weighted = available.map(s => ({ value: s, weight: s.weight }));
    const picked = this.aiRng.weightedPick(weighted);

    // Set cooldown
    if (picked.cooldown) {
      enemy.cooldowns[picked.name] = picked.cooldown + 1;
    }

    // Override target selection for healing
    if (picked.target === 'self_lowest') {
      const allies = [enemy, ...this.enemies.filter(e => e !== enemy && e.alive)];
      allies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
      const healTarget = allies[0];
      const healAmount = Math.floor(enemy.maxHp * (picked.heal / healTarget.maxHp * 0.3));
      healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmount);
      this._log(`${enemy.name} 使用 ${picked.name}，治疗 ${healTarget.name} +${healAmount}`);
      return;
    }

    if (picked.target === 'self') {
      // Self buff
      if (picked.buff) {
        enemy.defense += picked.buff.def || 0;
        this._log(`${enemy.name} 使用 ${picked.name}，防御+${picked.buff.def || 0}`);
      }
      if (picked.heal) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + picked.heal);
        this._log(`${enemy.name} 使用 ${picked.name}，回复${picked.heal}生命`);
      }
      return;
    }

    // Deal damage to player
    const baseDmg = enemy.maxHp * (picked.damage / 50);
    let finalDmg = Math.floor(baseDmg * (0.9 + this.rng.nextFloat() * 0.2));

    // Status application on hit
    let appliedStatus = null;
    if (picked.status) {
      appliedStatus = picked.status;
    }

    // 经过装备减伤 / 首击护身 / 护盾吸收
    this._applyDamageToPlayer(finalDmg, enemy.name, picked.name, appliedStatus, enemy.id);
  }

  /** 玩家受到伤害的统一步骤：装备减伤 → 首击护身 → 护盾吸收 → 扣血 → 状态 → 失败判定 */
  _applyDamageToPlayer(amount, sourceName, skillName, appliedStatus, enemyId) {
    amount = Math.floor(amount);

    // 装备：伤害减免（铁布衫/龙鳞甲/玄武甲/女娲石）
    if (this._eq.dmgReduction > 0) {
      amount = Math.floor(amount * (1 - this._eq.dmgReduction));
    }

    // 首击护身（护身符/昆仑玉/混沌青莲）：每场战斗首次受击按比例化解
    if (!this._eqState.firstHitUsed && this._eq.firstHitShieldPct > 0) {
      this._eqState.firstHitUsed = true;
      const reduced = Math.floor(amount * this._eq.firstHitShieldPct);
      amount -= reduced;
      this._log(`🛡 护身宝物化解 ${reduced} 点伤害！`);
    }

    // 护盾吸收
    if (this.hasShield > 0) {
      const absorbed = Math.min(this.hasShield, amount);
      this.hasShield -= absorbed;
      amount -= absorbed;
      if (this.hasShield <= 0) this.hasShield = 0;
    }

    amount = Math.max(0, amount);
    this.player.hp -= amount;
    this._log(`${sourceName} 的${skillName}对你造成 ${amount} 点伤害`);

    if (appliedStatus) this._applyStatus('player', appliedStatus);
    this.tookDamageLastRound = true;
    this._addEvent('enemy_action', { enemy: sourceName, enemyId: enemyId, skill: skillName, damage: amount });

    // Check defeat
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.alive = false;
      this.isDefeat = true;
      this.phase = 'defeat';
    }
  }

  // ============ STATUS SYSTEM ============

  _applyStatus(targetId, statusDef) {
    if (targetId === 'player') {
      if (!this.player.statuses) this.player.statuses = {};
      const existing = this.player.statuses[statusDef.type] || { stacks: 0 };
      existing.stacks = Math.min((STATUS[statusDef.type]?.maxStacks || 999), existing.stacks + (statusDef.stacks || 1));
      this.player.statuses[statusDef.type] = existing;
      this._log(`玩家获得 ${statusDef.type} x${statusDef.stacks}`);
    } else {
      const enemy = this.enemies.find(e => e.id === targetId);
      if (enemy) {
        if (!enemy.statuses) enemy.statuses = {};
        const existing = enemy.statuses[statusDef.type] || { stacks: 0 };
        existing.stacks = Math.min((STATUS[statusDef.type]?.maxStacks || 999), existing.stacks + (statusDef.stacks || 1));
        enemy.statuses[statusDef.type] = existing;
        this._log(`${enemy.name} 获得 ${statusDef.type} x${statusDef.stacks}`);
        this._addEvent('status_applied', { targetId, status: statusDef.type, stacks: existing.stacks });
      }
    }
  }

  _getStatusStacks(targetId, statusType) {
    if (targetId === 'player') {
      return this.player.statuses?.[statusType]?.stacks || 0;
    }
    const enemy = this.enemies.find(e => e.id === targetId);
    return enemy?.statuses?.[statusType]?.stacks || 0;
  }

  _statusTick(timing) {
    // Tick enemy statuses
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.statuses) continue;
      for (const [statusType, instance] of Object.entries(enemy.statuses)) {
        const statusDef = STATUS[statusType];
        if (!statusDef) continue;

        if (statusDef.decayTiming === timing) {
          instance.stacks = Math.max(0, instance.stacks - (statusDef.decay || 0));
          if (instance.stacks <= 0) delete enemy.statuses[statusType];
        }

        if (timing === 'round_end' && statusType === 'burn' && instance.stacks > 0) {
          const dmg = instance.stacks * 2;
          enemy.hp -= dmg;
          this._log(`🔥 ${enemy.name} 燃烧伤害 -${dmg} (${instance.stacks}层)`);
          if (enemy.hp <= 0) {
            enemy.hp = 0;
            enemy.alive = false;
            this._log(`💀 ${enemy.name} 被燃烧致死！`);
          }
        }
      }
    }

    // Tick player statuses
    if (this.player.statuses) {
      for (const [statusType, instance] of Object.entries(this.player.statuses)) {
        const statusDef = STATUS[statusType];
        if (!statusDef) continue;

        if (statusDef.decayTiming === timing) {
          instance.stacks = Math.max(0, instance.stacks - (statusDef.decay || 0));
          if (instance.stacks <= 0) delete this.player.statuses[statusType];
        }

        if (timing === 'round_end' && statusType === 'burn' && instance.stacks > 0) {
          const dmg = instance.stacks * 2;
          this.player.hp -= dmg;
          this._log(`🔥 玩家燃烧伤害 -${dmg} (${instance.stacks}层)`);
        }
      }
    }
  }


  // ============ TARGETING ============

  _pickTarget(rule, skill) {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return null;

    switch (rule) {
      case 'self': return this.player;
      case 'random': return this.targetRng.pick(alive);
      case 'lowest_hp':
        return alive.reduce((a, b) => (a.hp / a.maxHp) <= (b.hp / b.maxHp) ? a : b);
      case 'highest_hp':
        return alive.reduce((a, b) => (a.hp / a.maxHp) >= (b.hp / b.maxHp) ? a : b);
      case 'highest_armor':
        return alive.reduce((a, b) => (a.defense || 0) >= (b.defense || 0) ? a : b);
      case 'last_attacker':
        return alive[0]; // Simplified
      case 'all_enemies':
        return alive[0]; // Handle in effect loop
      default:
        return this.targetRng.pick(alive);
    }
  }

  // ============ HELPERS ============

  _dealDamage(sourceId, targetId, amount, tags) {
    let target;
    if (targetId === 'player') {
      target = this.player;
    } else {
      target = this.enemies.find(e => e.id === targetId);
    }
    if (!target || !target.alive) return;

    // Shield absorption
    if (targetId === 'player' && this.hasShield > 0) {
      const absorbed = Math.min(this.hasShield, amount);
      this.hasShield -= absorbed;
      amount -= absorbed;
    }

    amount = Math.max(0, Math.floor(amount));
    target.hp -= amount;

    // 炽心玉：每回合首次造成伤害后回复2生命
    if (sourceId === 'player' && amount > 0 && !this._eqState.chixinUsed) {
      if (this.setup.equipment?.some(e => e.id === 'eq_chixin_yu')) {
        this._eqState.chixinUsed = true;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
        this._log('❤ 炽心玉：温养心火，回复2生命');
      }
    }
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      this._log(`💀 ${target.name || '玩家'} 被击败！`);
    }

    this._addEvent('damage', {
      sourceId, targetId, amount, tags, hpRemaining: target.hp,
      present: (sourceId === 'player' && this._present) ? this._present : null
    });
  }

  _getCooldown(skillId) {
    if (!this._cooldowns) this._cooldowns = {};
    return this._cooldowns[skillId] || 0;
  }

  _setCooldown(skillId, rounds) {
    if (!this._cooldowns) this._cooldowns = {};
    this._cooldowns[skillId] = rounds;
  }

  _cooldownTick() {
    if (!this._cooldowns) this._cooldowns = {};
    for (const key of Object.keys(this._cooldowns)) {
      if (this._cooldowns[key] > 0) this._cooldowns[key]--;
    }
    // Enemy cooldowns
    for (const enemy of this.enemies) {
      for (const key of Object.keys(enemy.cooldowns || {})) {
        if (enemy.cooldowns[key] > 0) enemy.cooldowns[key]--;
      }
    }
    // Round start: reset took damage & equipment round states
    this.tookDamageLastRound = false;
    this._eqState.chixinUsed = false;

    // 装备：每回合开始回血 / 护盾 / 蓄势
    if (this._eq.hpRegenRound > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this._eq.hpRegenRound);
      this._log(`❤ 吐纳回血 +${this._eq.hpRegenRound}`);
    }
    if (this._eq.roundShieldPct > 0) {
      const s = Math.floor(this.player.maxHp * this._eq.roundShieldPct);
      this.hasShield += s;
      this._log(`🛡 周天护盾 +${s}`);
    }
    if (this._eq.momentumPerRound > 0) {
      this.momentum = Math.min(this._momentumMax(), this.momentum + this._eq.momentumPerRound);
    }
  }

  _processBuffs() {
    // Reset enemy damage taken multiplier each round
    for (const enemyId of Object.keys(this.enemyBuffs)) {
      this.enemyBuffs[enemyId].damageTakenMult = 1;
    }
  }

  _getProficiencyLevel(xp) {
    if (xp >= 48) return 5;
    if (xp >= 26) return 4;
    if (xp >= 12) return 3;
    if (xp >= 4) return 2;
    return 1;
  }

  _applySignatureSword(sword, skill) {
    // 流光: 3 different skills bonus
    if (sword.id === 'sword_liuguang') {
      if (!this._swordChain) this._swordChain = [];
      if (this._swordChain.length === 0 || this._swordChain[this._swordChain.length - 1] !== skill.id) {
        this._swordChain.push(skill.id);
        if (this._swordChain.length > 3) this._swordChain.shift();
        if (this._swordChain.length === 3 && new Set(this._swordChain).size === 3) {
          this.swordIntent += 1;
          this._log('✨ 流光：连续3次不同技能，剑意 +1 点！');
          // 点满 3 即自动升层
          if (this.swordIntent >= 3 && this.swordIntentLevel < 3) {
            this.swordIntentLevel++;
            this.swordIntent -= 3;
            this._log(`⬆ 剑意突破！层数升为 ${this.swordIntentLevel} / 3`);
          }
          this._swordChain = [];
        }
      }
    }
  }

  _log(msg) {
    this.battleLog.push(`[R${this.round}] ${msg}`);
  }

  _addEvent(type, data) {
    this.events.push({ type, round: this.round, data, timestamp: Date.now() });
  }
}
