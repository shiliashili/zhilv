// ============================================================
// 织律 Weaveline v1.4 - Game Data
// 抽卡战斗重构：手牌/能量/牌堆/消耗堆/敌人意图
// ============================================================

// ---- 异常状态（独立结算，不参与元素反应） ----
const STATUS = {
  poison: {
    id: 'poison', name: '中毒', nameKey: '中毒',
    maxStacks: 30, decay: 1, decayTiming: 'owner_turn_end', bypassShield: true,
    onTick: (stacks) => ({ type: 'damage', amount: stacks, bypassShield: true, tags: ['dot', 'poison'] })
  },
  armorBreak: {
    id: 'armorBreak', name: '破甲', nameKey: '破甲',
    maxStacks: 6, decay: 1, decayTiming: 'round_end',
    onApply: (stacks) => ({ defPenaltyPerStack: 3 })
  },
  weak: {
    id: 'weak', name: '虚弱', nameKey: '虚弱',
    maxStacks: 3, decay: 1, decayTiming: 'round_end',
    onApply: () => ({ damageDealtMult: 0.8 })
  },
  vulnerable: {
    id: 'vulnerable', name: '易伤', nameKey: '易伤',
    maxStacks: 3, decay: 1, decayTiming: 'round_end',
    onApply: () => ({ damageTakenMult: 1.25 })
  },
  delay: {
    id: 'delay', name: '延迟', nameKey: '延迟',
    maxStacks: 2, decay: 1, decayTiming: 'round_end',
  }
};

// ---- Equipment v1.4 ----
const EQUIPMENT = [
  // 主装置
  { id: 'eq_poison_brace', name: '淬毒护腕', rarity: '普通', slot: 'main_device',
    desc: '每回合首次造成直接攻击伤害时，对目标施加中毒2',
    effect: { firstHitPoison: 2 } },
  { id: 'eq_guard_mirror', name: '护心镜', rarity: '普通', slot: 'armor',
    desc: '每场战斗第一回合开始获得8护盾',
    effect: { firstTurnShield: 8 } },
  { id: 'eq_feather_tassel', name: '轻羽剑穗', rarity: '普通', slot: 'accessory',
    desc: '剑圣：每回合第一张费用0的牌打出后获得2护盾',
    character: 'swordsman', effect: { zeroCostShield: 2 } },
  { id: 'eq_iron_sandbag', name: '铁砂袋', rarity: '普通', slot: 'accessory',
    desc: '武圣：重式命中后额外施加破甲1',
    character: 'martialArtist', effect: { heavyArmorBreak: 1 } },

  // 稀有
  { id: 'eq_training_manual', name: '训练手册', rarity: '稀有', slot: 'special',
    desc: '每场战斗第一张有效打出的技能卡额外获得3熟练经验',
    effect: { firstCastXpBonus: 3 } },
  { id: 'eq_energy_jade', name: '回气玉', rarity: '稀有', slot: 'accessory',
    desc: '若上回合结束时能量为0，下回合额外获得1能量（每战最多2次）',
    effect: { energyOnEmpty: { amount: 1, maxPerBattle: 2 } } },
  { id: 'eq_cycle_sheath', name: '轮转剑匣', rarity: '稀有', slot: 'accessory',
    desc: '每次弃牌堆重洗进抽牌堆时获得1能量（每回合最多1次）',
    effect: { energyOnReshuffle: { amount: 1, maxPerTurn: 1 } } },
  { id: 'eq_poison_sac', name: '百毒囊', rarity: '稀有', slot: 'accessory',
    desc: '每名敌人每场战斗第一次中毒结算后，不减少中毒层数',
    effect: { firstPoisonNoDecay: true } },

  // 史诗
  { id: 'eq_hidden_scabbard', name: '藏锋剑鞘', rarity: '史诗', slot: 'special',
    desc: '剑圣：回合结束时随机保留1张未打出的剑气',
    character: 'swordsman', effect: { retainRandomSwordQi: 1 } },
  { id: 'eq_iron_wall_robe', name: '铁壁法衣', rarity: '史诗', slot: 'armor',
    desc: '每回合第一次获得护盾时额外+30%；但该回合后续护盾效果-10%',
    effect: { firstShieldBonus: 0.30, subsequentShieldPenalty: 0.10 } },
  { id: 'eq_breaker_talisman', name: '破阵符', rarity: '史诗', slot: 'talisman',
    desc: '首次把精英/Boss施加到破甲3层时，抽2张并获得1能量（每战1次）',
    effect: { armorBreak3Bonus: { draw: 2, energy: 1, oncePerBattle: true } } },
  { id: 'eq_breath_scroll', name: '残卷·换气诀', rarity: '史诗', slot: 'scroll',
    desc: '每回合第一次主动弃牌时抽1张',
    effect: { drawOnDiscard: { amount: 1, maxPerTurn: 1 } } },

  // 风险装备
  { id: 'eq_split_vein_ring', name: '裂脉扳指', rarity: '史诗', slot: 'accessory',
    desc: '所有攻击牌伤害+22%，但每回合第一张攻击牌费用+1',
    effect: { attackDmgBonus: 0.22, firstAttackCostUp: 1 } },
];

// ---- 名剑 v1.4 (剑圣专属) ----
const SIGNATURE_SWORDS = [
  { id: 'sword_liuguang', name: '流光',
    desc: '每回合第一次连续打出3张不同名称的剑圣牌时，抽1张并获得4护盾',
    effect: { type: 'chain3DiffBonus', draw: 1, shield: 4 },
    ultimate: {
      id: 'ult_wanjian', name: '万剑归流',
      effects: [
        { type: 'damage', multiplier: 0.42, hits: 3, allEnemies: true },
        { type: 'damage', multiplier: 1.20, hits: 1, targetMode: 'lowest_hp_pct', allEnemies: false }
      ]
    }
  },
  { id: 'sword_jinghong', name: '惊鸿',
    desc: '每回合第一张剑气费用-1（最低0）；若原费用≥2，打出后抽1张（每回合1次）',
    effect: { type: 'firstQiDiscounted', minCost: 0, drawIfCostGe2: true },
    ultimate: {
      id: 'ult_wanjian', name: '万剑归流',
      effects: [
        { type: 'damage', multiplier: 0.42, hits: 3, allEnemies: true },
        { type: 'damage', multiplier: 1.20, hits: 1, targetMode: 'lowest_hp_pct' }
      ]
    }
  },
  { id: 'sword_duanyue', name: '断岳',
    desc: '每回合第一张费用≥2的单体攻击伤害+35%；若击杀，获得1能量（每回合1次）',
    effect: { type: 'firstCost2PlusAttackBonus', dmgBonus: 0.35, killEnergy: 1 },
    ultimate: {
      id: 'ult_wanjian', name: '万剑归流',
      effects: [
        { type: 'damage', multiplier: 0.42, hits: 3, allEnemies: true },
        { type: 'damage', multiplier: 1.20, hits: 1, targetMode: 'lowest_hp_pct' }
      ]
    }
  },
  { id: 'sword_taichu', name: '太初',
    desc: '每场战斗开始获得1剑意；每次释放大招后获得8护盾',
    effect: { type: 'startWithIntent', intentBonus: 1, ultimateShield: 8 },
    ultimate: {
      id: 'ult_wanjian', name: '万剑归流',
      effects: [
        { type: 'damage', multiplier: 0.42, hits: 3, allEnemies: true },
        { type: 'damage', multiplier: 1.20, hits: 1, targetMode: 'lowest_hp_pct' }
      ]
    }
  }
];

// ---- 剑圣技能卡 v1.4 (12张) ----
const SWORDSMAN_CARDS = [
  // ===== 剑技 =====
  { id: 'ss_cloud_stab', name: '流云刺', cardType: 'attack', energyCost: 1, roleCategory: 'sword_technique',
    tags: ['剑技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 0.65, hits: 2 }],
    onCast: { resourceChange: { sword_intent: 1 } },
    desc: '0.65×2段；+1剑意', hitPreset: 'light', castSfx: 'blade_light', impactSfx: 'blade_light' },
  { id: 'ss_whirlwind', name: '回风斩', cardType: 'attack', energyCost: 1, roleCategory: 'sword_technique',
    tags: ['剑技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.00, hits: 1 },
      { type: 'gain_shield', amount: 5 },
      { type: 'conditional', condition: 'last_card_was_qi', effects: [{ type: 'gain_shield', amount: 3 }] }
    ],
    onCast: { resourceChange: { sword_intent: 1 } },
    desc: '1.00×；+5护盾（上张剑气时+3）；+1剑意', hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },
  { id: 'ss_swallow_return', name: '燕返', cardType: 'attack', energyCost: 1, roleCategory: 'sword_technique',
    tags: ['剑技'], targetMode: 'enemy_single', pileKeywords: ['retain'],
    effects: [{ type: 'damage', multiplier: 1.35, hits: 1 }],
    onCast: { resourceChange: { sword_intent: 1 }, conditional: { condition: 'was_retained', damageBonus: 0.30 } },
    desc: '1.35×；保留；+1剑意；跨回合保留后伤害+30%', hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },
  { id: 'ss_moon_combo', name: '踏月连环', cardType: 'attack', energyCost: 2, roleCategory: 'sword_technique',
    tags: ['剑技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 0.38, hits: 4 }],
    onCast: { resourceChange: { sword_intent: 1 }, comboPerUnique: { bonus: 0.06 } },
    desc: '0.38×4段；+1剑意；每打过不同名剑牌+6%总伤', hitPreset: 'standard', castSfx: 'blade_multi', impactSfx: 'blade_multi', multiHit: true },
  { id: 'ss_forest_pierce', name: '穿林破影', cardType: 'attack', energyCost: 1, roleCategory: 'sword_technique',
    tags: ['剑技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.15, hits: 1 },
      { type: 'conditional', condition: 'target_hp_below_50', effects: [{ type: 'damage', multiplier: 0.65, hits: 1 }] }
    ],
    onCast: { resourceChange: { sword_intent: 1 } },
    desc: '1.15×；目标<50%改为1.65×；+1剑意', hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },
  { id: 'ss_reflect_sword', name: '折光回剑', cardType: 'attack', energyCost: 1, roleCategory: 'sword_technique',
    tags: ['剑技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 0.90, hits: 1 },
      { type: 'gain_shield', amount: 7 },
      { type: 'conditional', condition: 'enemy_intent_is_attack', effects: [{ type: 'gain_shield', amount: 3 }] }
    ],
    onCast: { resourceChange: { sword_intent: 1 } },
    desc: '0.90×；+7护盾（敌攻击时+3）；+1剑意', hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },

  // ===== 剑气 =====
  { id: 'ss_green_edge_qi', name: '青锋剑气', cardType: 'attack', energyCost: 1, roleCategory: 'sword_qi',
    tags: ['剑气'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.25, hits: 1 },
      { type: 'conditional', condition: 'sword_intent_ge_2', effects: [{ type: 'damage', multiplier: 0.45, hits: 1 }] }
    ],
    desc: '1.25×；剑意≥2追加0.45×', hitPreset: 'standard', castSfx: 'sword_qi', impactSfx: 'sword_qi' },
  { id: 'ss_river_qi', name: '横江剑气', cardType: 'attack', energyCost: 2, roleCategory: 'sword_qi',
    tags: ['剑气'], targetMode: 'enemy_all', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 0.80, hits: 1, allEnemies: true },
      { type: 'conditional', condition: 'sword_intent_eq_3', effects: [{ type: 'damage', multiplier: 1.05, hits: 1, allEnemies: true }] }
    ],
    desc: '全体0.80×；剑意=3时改为1.05×', hitPreset: 'standard', castSfx: 'sword_qi', impactSfx: 'sword_qi' },
  { id: 'ss_hundred_step_sword', name: '百步飞剑', cardType: 'attack', energyCost: 2, roleCategory: 'sword_qi',
    tags: ['剑气'], targetMode: 'enemy_single', pileKeywords: ['retain'],
    effects: [
      { type: 'damage', multiplier: 1.80, hits: 1 },
      { type: 'conditional', condition: 'target_hp_below_25', effects: [{ type: 'damage', multiplier: 0.90, hits: 1 }] }
    ],
    desc: '1.80×；目标<25%时+50%伤害；保留', hitPreset: 'heavy', castSfx: 'sword_qi', impactSfx: 'sword_qi' },
  { id: 'ss_sword_rain', name: '剑雨千寻', cardType: 'attack', energyCost: 2, roleCategory: 'sword_qi',
    tags: ['剑气'], targetMode: 'enemy_all', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 0.32, hits: 3, allEnemies: true },
      { type: 'conditional', condition: 'only_one_enemy', effects: [{ type: 'damage', multiplier: 0.36, hits: 5, allEnemies: true }] }
    ],
    desc: '全体0.32×3；仅1敌时0.36×5', hitPreset: 'light', castSfx: 'sword_qi', impactSfx: 'sword_qi', multiHit: true },

  // ===== 技法/辅助 =====
  { id: 'ss_hidden_edge', name: '藏锋式', cardType: 'technique', energyCost: 0, roleCategory: 'sword_qi',
    tags: ['剑气'], targetMode: 'none', pileKeywords: ['exhaust'],
    effects: [
      { type: 'draw_cards', amount: 1 },
      { type: 'modify_next_damage', tag: 'sword_qi', bonus: 0.25, duration: 'turn' }
    ],
    desc: '抽1张；本回合下一张剑气伤害+25%；消耗', hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },
  { id: 'ss_one_sword_sky', name: '一剑开天', cardType: 'attack', energyCost: 3, roleCategory: 'sword_qi',
    tags: ['剑气'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 3.20, hits: 1 },
      { type: 'conditional', condition: 'ultimate_casted_this_turn', effects: [{ type: 'damage', multiplier: 4.30, hits: 1 }] }
    ],
    desc: '3.20×；本回合已释放大招→4.30×', hitPreset: 'execute', castSfx: 'sword_qi_bloom', impactSfx: 'execute' },
];

// ---- 武圣技能卡 v1.4 (12张) ----
const MARTIALARTIST_CARDS = [
  // ===== 拳法 =====
  { id: 'ms_mountain_fist', name: '开山拳', cardType: 'attack', energyCost: 1, roleCategory: 'fist',
    tags: ['拳法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 1.45, hits: 1 }],
    onCast: { resourceChange: { momentum: 1.0 } },
    desc: '1.45×；+1蓄势', hitPreset: 'standard', castSfx: 'fist_heavy', impactSfx: 'fist_heavy' },
  { id: 'ms_cannon_fist', name: '崩山炮拳', cardType: 'attack', energyCost: 2, roleCategory: 'fist',
    tags: ['拳法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 2.25, hits: 1 },
      { type: 'conditional', condition: 'target_hp_above_70', effects: [{ type: 'damage', multiplier: 2.70, hits: 1 }] }
    ],
    onCast: { resourceChange: { momentum: 1.0 } },
    desc: '2.25×；目标>70%→+20%；+1蓄势', hitPreset: 'heavy', castSfx: 'fist_heavy', impactSfx: 'fist_heavy' },
  { id: 'ms_chain_fist', name: '连环炮拳', cardType: 'attack', energyCost: 2, roleCategory: 'fist',
    tags: ['拳法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 0.68, hits: 3 }],
    onCast: { resourceChange: { momentum: 1.0 }, heavyBonus: 0.15 },
    desc: '0.68×3；重式时总倍率+15%；+1蓄势', hitPreset: 'standard', castSfx: 'fist_heavy', impactSfx: 'fist_heavy', multiHit: true },
  { id: 'ms_armor_break_fist', name: '碎甲拳', cardType: 'attack', energyCost: 1, roleCategory: 'fist',
    tags: ['拳法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.15, hits: 1 },
      { type: 'add_status', statusId: 'armorBreak', stacks: 2 }
    ],
    onCast: { resourceChange: { momentum: 1.0 } },
    desc: '1.15×＋破甲2；+1蓄势', hitPreset: 'standard', castSfx: 'fist_heavy', impactSfx: 'fist_heavy' },
  { id: 'ms_overlord_fist', name: '霸王冲拳', cardType: 'attack', energyCost: 3, roleCategory: 'fist',
    tags: ['拳法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 3.35, hits: 1, executeThreshold: 0.12 }],
    onCast: { resourceChange: { momentum: 1.0 }, heavyBonus: 0.25 },
    desc: '3.35×；重式+25%并带处决；+1蓄势', hitPreset: 'execute', castSfx: 'fist_heavy', impactSfx: 'execute' },

  // ===== 脚法 =====
  { id: 'ms_ground_split_kick', name: '裂地踢', cardType: 'attack', energyCost: 1, roleCategory: 'kick',
    tags: ['脚法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.55, hits: 1 },
      { type: 'conditional', condition: 'target_hp_below_50', effects: [{ type: 'damage', multiplier: 1.94, hits: 1 }] }
    ],
    onCast: { resourceChange: { momentum: 1.0 } },
    desc: '1.55×；目标<50%→+25%；+1蓄势', hitPreset: 'standard', castSfx: 'kick_heavy', impactSfx: 'kick_heavy' },
  { id: 'ms_sweep_kick', name: '扫堂腿', cardType: 'attack', energyCost: 2, roleCategory: 'kick',
    tags: ['脚法'], targetMode: 'enemy_all', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 0.90, hits: 1, allEnemies: true },
      { type: 'add_status', statusId: 'weak', stacks: 1, allEnemies: true }
    ],
    onCast: { resourceChange: { momentum: 1.0 } },
    desc: '全体0.90×虚弱1；+1蓄势', hitPreset: 'standard', castSfx: 'kick_heavy', impactSfx: 'kick_heavy' },
  { id: 'ms_chase_kick', name: '追命腿', cardType: 'attack', energyCost: 2, roleCategory: 'kick',
    tags: ['脚法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 2.10, hits: 1, executeThreshold: 0.12 },
      { type: 'conditional', condition: 'target_hp_below_30', effects: [{ type: 'damage', multiplier: 3.05, hits: 1, executeThreshold: 0.12 }] }
    ],
    onCast: { resourceChange: { momentum: 1.0 } },
    desc: '2.10×带处决；目标<30%→3.05×处决；+1蓄势', hitPreset: 'heavy', castSfx: 'kick_heavy', impactSfx: 'execute' },
  { id: 'ms_sky_heavy_kick', name: '裂空重踢', cardType: 'attack', energyCost: 3, roleCategory: 'kick',
    tags: ['脚法'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 2.95, hits: 1 }],
    onCast: { resourceChange: { momentum: 1.0 }, heavyShield: 8 },
    desc: '2.95×；重式时额外8护盾；+1蓄势', hitPreset: 'execute', castSfx: 'kick_heavy', impactSfx: 'execute' },

  // ===== 内功 =====
  { id: 'ms_hunyuan_force', name: '混元劲', cardType: 'power', energyCost: 1, roleCategory: 'inner_power',
    tags: ['内功'], targetMode: 'self', pileKeywords: ['exhaust'],
    effects: [{ type: 'add_buff', buffId: 'hunyuan_power', stacks: 1, maxStacks: 3, value: 0.08 }],
    desc: '本场拳/脚伤害+8%，最多3层；打出后离开牌堆', hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },
  { id: 'ms_golden_bell', name: '金钟劲', cardType: 'technique', energyCost: 1, roleCategory: 'inner_power',
    tags: ['内功'], targetMode: 'self', pileKeywords: [],
    effects: [
      { type: 'gain_shield', amount: 11 },
      { type: 'conditional', condition: 'momentum_eq_3', effects: [{ type: 'set_keyword', keyword: 'retain', target: 'self' }] }
    ],
    desc: '11护盾；蓄势=3时获得保留', hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },
  { id: 'ms_overlord_qi', name: '霸王真气', cardType: 'technique', energyCost: 0, roleCategory: 'inner_power',
    tags: ['内功'], targetMode: 'self', pileKeywords: ['exhaust'],
    effects: [
      { type: 'resource_change', resourceId: 'momentum', delta: 2 },
      { type: 'draw_cards', amount: 1 }
    ],
    desc: '蓄势+2，抽1张，消耗', hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },
];

// ---- 武道真意 v1.4（武圣专属，对标剑圣名剑） ----
// 每局选一种，整局锁定，改变蓄势/重式机制
const MARTIAL_STYLES = [
  { id: 'style_dragon', name: '降龙真意', glyph: '刚',
    desc: '重式伤害提升至2.0倍，重式命中附带破甲1',
    effect: { heavyMult: 2.0, heavyArmorBreak: 1 } },
  { id: 'style_taiji', name: '太极真意', glyph: '柔',
    desc: '触发重式时获得8护盾，金钟劲费用-1',
    effect: { heavyShield: 8, goldenBellCostDown: 1 } },
  { id: 'style_hunyuan', name: '混元真意', glyph: '浑',
    desc: '蓄势上限+1（满4触发重式），开局自带1蓄势',
    effect: { momentumMaxAdd: 1, startMomentum: 1 } },
  { id: 'style_swift', name: '疾风真意', glyph: '疾',
    desc: '每回合第一张拳/脚额外+1蓄势，触发重式后抽1张',
    effect: { firstFistKickMomentum: 1, heavyDraw: 1 } }
];

// ---- 弓箭手技能卡 v1.4 (12张，参考DNF弓箭手) ----
const ARCHER_CARDS = [
  // ===== 箭技（命中后 +1 专注） =====
  { id: 'ar_swift_arrow', name: '迅捷箭', cardType: 'attack', energyCost: 1, roleCategory: 'arrow',
    tags: ['箭技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 1.10, hits: 1 }],
    onCast: { resourceChange: { focus: 1 } },
    desc: '1.10×；+1专注', hitPreset: 'light', castSfx: 'arrow', impactSfx: 'arrow_hit' },
  { id: 'ar_pierce_arrow', name: '贯穿箭', cardType: 'attack', energyCost: 2, roleCategory: 'arrow',
    tags: ['箭技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 1.75, hits: 1, ignoreDef: 0.15 }],
    onCast: { resourceChange: { focus: 1 } },
    desc: '1.75×；无视15%防御；+1专注', hitPreset: 'standard', castSfx: 'arrow', impactSfx: 'arrow_hit' },
  { id: 'ar_rapid_arrows', name: '连珠箭', cardType: 'attack', energyCost: 2, roleCategory: 'arrow',
    tags: ['箭技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 0.55, hits: 3 }],
    onCast: { resourceChange: { focus: 1 } },
    desc: '0.55×3段；+1专注', hitPreset: 'light', castSfx: 'arrow', impactSfx: 'arrow_hit', multiHit: true },
  { id: 'ar_charged_shot', name: '蓄力重箭', cardType: 'attack', energyCost: 2, roleCategory: 'arrow',
    tags: ['箭技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 2.20, hits: 1 },
      { type: 'conditional', condition: 'last_card_was_arrow', effects: [{ type: 'damage', multiplier: 0.30, hits: 1 }] }
    ],
    onCast: { resourceChange: { focus: 1 } },
    desc: '2.20×；上张为箭技+0.30×；+1专注', hitPreset: 'heavy', castSfx: 'arrow', impactSfx: 'arrow_hit' },
  { id: 'ar_homing_arrow', name: '追踪箭', cardType: 'attack', energyCost: 1, roleCategory: 'arrow',
    tags: ['箭技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.30, hits: 1 },
      { type: 'conditional', condition: 'target_hp_below_50', effects: [{ type: 'damage', multiplier: 0.40, hits: 1 }] }
    ],
    onCast: { resourceChange: { focus: 1 } },
    desc: '1.30×；目标<50%+0.40×；+1专注', hitPreset: 'standard', castSfx: 'arrow', impactSfx: 'arrow_hit' },
  { id: 'ar_hawk_strike', name: '鹰击', cardType: 'attack', energyCost: 2, roleCategory: 'arrow',
    tags: ['箭技'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 1.70, hits: 1 }],
    onCast: { resourceChange: { focus: 1 } },
    desc: '1.70×；鹰袭；+1专注', hitPreset: 'heavy', castSfx: 'arrow', impactSfx: 'arrow_hit' },

  // ===== 散射（AOE，不增专注） =====
  { id: 'ar_scatter', name: '散射箭', cardType: 'attack', energyCost: 2, roleCategory: 'arrow',
    tags: ['散射'], targetMode: 'enemy_all', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 0.75, hits: 1, allEnemies: true }],
    desc: '全体0.75×', hitPreset: 'light', castSfx: 'arrow', impactSfx: 'arrow_hit' },

  // ===== 技巧 =====
  { id: 'ar_eagle_eye', name: '鹰眼', cardType: 'technique', energyCost: 0, roleCategory: 'arrow',
    tags: ['技巧'], targetMode: 'none', pileKeywords: ['exhaust'],
    effects: [
      { type: 'draw_cards', amount: 1 },
      { type: 'modify_next_damage', tag: 'arrow', bonus: 0.25, duration: 'turn' }
    ],
    desc: '抽1张；本回合下张箭技+25%；消耗', hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },
  { id: 'ar_backstep', name: '后跳射击', cardType: 'attack', energyCost: 1, roleCategory: 'arrow',
    tags: ['技巧'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.00, hits: 1 },
      { type: 'gain_shield', amount: 6 }
    ],
    desc: '1.00×＋6护盾', hitPreset: 'standard', castSfx: 'arrow', impactSfx: 'arrow_hit' },

  // ===== 奥义 =====
  { id: 'ar_arrow_rain', name: '箭雨', cardType: 'attack', energyCost: 3, roleCategory: 'arrow',
    tags: ['散射'], targetMode: 'enemy_all', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 0.45, hits: 4, allEnemies: true }],
    desc: '全体0.45×4段', hitPreset: 'light', castSfx: 'arrow', impactSfx: 'arrow_hit', multiHit: true },
  { id: 'ar_snipe', name: '狙击', cardType: 'attack', energyCost: 3, roleCategory: 'arrow',
    tags: ['散射'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [{ type: 'damage', multiplier: 3.40, hits: 1, executeThreshold: 0.25 }],
    desc: '3.40×；目标<25%处决', hitPreset: 'execute', castSfx: 'arrow', impactSfx: 'execute' },
  { id: 'ar_explosive', name: '爆裂箭', cardType: 'attack', energyCost: 2, roleCategory: 'arrow',
    tags: ['散射'], targetMode: 'enemy_single', pileKeywords: [],
    effects: [
      { type: 'damage', multiplier: 1.50, hits: 1 },
      { type: 'add_status', statusId: 'vulnerable', stacks: 1 }
    ],
    desc: '1.50×＋易伤1', hitPreset: 'heavy', castSfx: 'arrow', impactSfx: 'arrow_hit' },
];

// ---- 箭术流派 v1.4（弓箭手专属，对标名剑/武道真意） ----
const ARROW_STYLES = [
  { id: 'style_pierce', name: '穿云流派', glyph: '贯',
    desc: '所有箭技额外无视15%防御',
    effect: { arrowIgnoreDef: 0.15 } },
  { id: 'style_swift', name: '疾风流派', glyph: '疾',
    desc: '每回合第一张箭技费用-1（最低0）',
    effect: { firstArrowCostDown: 1 } },
  { id: 'style_hawk', name: '鹰眼流派', glyph: '鹰',
    desc: '开局自带1专注，释放大招后抽2张',
    effect: { startFocus: 1, ultimateDraw: 2 } },
  { id: 'style_blast', name: '爆裂流派', glyph: '爆',
    desc: '箭雨与爆裂箭额外附加易伤1',
    effect: { aoeVulnerable: 1 } }
];

// ---- Characters v1.4 ----
const CHARACTERS = {
  swordsman: {
    id: 'swordsman', name: '剑圣', className: '剑圣', glyph: '剑', portrait: 'assets/char_swordsman.jpg',
    maxHp: 68, atk: 12, baseEnergy: 3, baseDraw: 5, handLimit: 10,
    startingCards: [
      { cardId: 'ss_cloud_stab', count: 3 },
      { cardId: 'ss_whirlwind', count: 2 },
      { cardId: 'ss_green_edge_qi', count: 2 },
      { cardId: 'ss_reflect_sword', count: 3 }
    ],
    cardPool: SWORDSMAN_CARDS,
    resource: { name: '剑意', key: 'sword_intent', max: 3, start: 0, desc: '打出剑技+1，满3点亮大招' },
    ultimate: {
      id: 'ult_wanjian', name: '万剑归流',
      desc: '对所有敌人造成0.42×3段；对生命最低的敌人追加1.20×',
      effects: [
        { type: 'damage', multiplier: 0.42, hits: 3, allEnemies: true },
        { type: 'damage', multiplier: 1.20, hits: 1, targetMode: 'lowest_hp_pct' }
      ],
      hitPreset: 'execute', castSfx: 'sword_qi_bloom', impactSfx: 'execute'
    },
    signatureChoices: SIGNATURE_SWORDS,
    color: '#4FC3F7', bgColor: '#E1F5FE',
    description: '灵巧华丽，招式流动，剑气纵横'
  },
  martialArtist: {
    id: 'martialArtist', name: '武圣', className: '武圣', glyph: '武', portrait: 'assets/char_martial.jpg',
    maxHp: 92, atk: 16, baseEnergy: 3, baseDraw: 5, handLimit: 10,
    startingCards: [
      { cardId: 'ms_mountain_fist', count: 3 },
      { cardId: 'ms_ground_split_kick', count: 2 },
      { cardId: 'ms_golden_bell', count: 3 },
      { cardId: 'ms_hunyuan_force', count: 2 }
    ],
    cardPool: MARTIALARTIST_CARDS,
    resource: { name: '蓄势', key: 'momentum', max: 3, start: 0, desc: '打出拳/脚+1，满3后下一拳/脚进入重式' },
    styleChoices: MARTIAL_STYLES,
    color: '#FF7043', bgColor: '#FBE9E7',
    description: '大开大合，以力破巧，拳脚重击'
  },
  archer: {
    id: 'archer', name: '弓箭手', className: '弓箭手', glyph: '弓', portrait: 'assets/char_archer.jpg',
    maxHp: 78, atk: 14, baseEnergy: 3, baseDraw: 5, handLimit: 10,
    startingCards: [
      { cardId: 'ar_swift_arrow', count: 3 },
      { cardId: 'ar_pierce_arrow', count: 2 },
      { cardId: 'ar_rapid_arrows', count: 2 },
      { cardId: 'ar_backstep', count: 3 }
    ],
    cardPool: ARCHER_CARDS,
    resource: { name: '专注', key: 'focus', max: 3, start: 0, desc: '打出箭技+1，满3点亮大招' },
    ultimate: {
      id: 'ult_wanjian', name: '万箭齐发',
      desc: '全体0.40×3段箭雨；对生命最低的敌人追加1.20×狙击',
      effects: [
        { type: 'damage', multiplier: 0.40, hits: 3, allEnemies: true },
        { type: 'damage', multiplier: 1.20, hits: 1, targetMode: 'lowest_hp_pct' }
      ],
      hitPreset: 'execute', castSfx: 'arrow', impactSfx: 'arrow_hit'
    },
    styleChoices: ARROW_STYLES,
    color: '#7FB59A', bgColor: '#E8F5E9',
    description: '百步穿杨，箭无虚发'
  }
};

// ---- 所有技能卡注册表 ----
const ALL_CARDS = {};
SWORDSMAN_CARDS.forEach(c => ALL_CARDS[c.id] = c);
MARTIALARTIST_CARDS.forEach(c => ALL_CARDS[c.id] = c);
ARCHER_CARDS.forEach(c => ALL_CARDS[c.id] = c);

// ---- Enemies v1.4 ----
const ENEMIES = [
  { id: 'e_swift_raider', glyph: '迅', color: '#d88a5a', name: '迅袭者', type: 'normal', maxHp: 40, defense: 3,
    tags: ['高爆发'],
    intentPattern: [
      { intent: 'attack', value: 2, damagePerHit: 6, hits: 2, tags: ['连续攻击'], weight: 70 },
      { intent: 'attack', value: 1, damagePerHit: 14, hits: 1, tags: ['重击'], weight: 30 }
    ]
  },
  { id: 'e_charged_archer', glyph: '蓄', color: '#6aad8a', name: '蓄能射手', type: 'normal', maxHp: 35, defense: 2,
    tags: ['高爆发'],
    intentPattern: [
      { intent: 'attack', value: 1, damagePerHit: 8, hits: 1, tags: ['蓄力'], weight: 60 },
      { intent: 'attack', value: 2, damagePerHit: 22, hits: 1, tags: ['爆发'], weight: 40, cooldown: 2 }
    ]
  },
  { id: 'e_guard_unit', glyph: '护', color: '#9a9a8a', name: '护卫单元', type: 'normal', maxHp: 50, defense: 6,
    tags: ['防御'],
    intentPattern: [
      { intent: 'attack', value: 1, damagePerHit: 9, hits: 1, tags: [], weight: 50 },
      { intent: 'shield', value: 8, tags: ['护盾'], weight: 30, cooldown: 2 },
      { intent: 'buff_ally', value: 6, shieldToAlly: true, tags: ['保护'], weight: 20, cooldown: 2 }
    ]
  },
  { id: 'e_poison_blade', glyph: '毒', color: '#7aaa4a', name: '毒刃客', type: 'normal', maxHp: 38, defense: 2,
    tags: ['中毒'],
    intentPattern: [
      { intent: 'attack', value: 1, damagePerHit: 10, hits: 1, tags: [], weight: 50 },
      { intent: 'attack', value: 1, damagePerHit: 5, hits: 1, applyStatus: { statusId: 'poison', stacks: 4 }, tags: ['中毒'], weight: 50, cooldown: 1 }
    ]
  },

  // Elite
  { id: 'e_elite_blade_master', glyph: '刃', color: '#c0604a', name: '剑刃大师', type: 'elite', maxHp: 80, defense: 5,
    tags: ['高爆发', '中毒'],
    intentPattern: [
      { intent: 'attack', value: 2, damagePerHit: 10, hits: 2, tags: ['连续攻击'], weight: 40 },
      { intent: 'attack', value: 1, damagePerHit: 12, hits: 1, applyStatus: { statusId: 'poison', stacks: 3 }, tags: ['中毒'], weight: 30, cooldown: 1 },
      { intent: 'shield', value: 10, tags: ['护盾'], weight: 15, cooldown: 3 },
      { intent: 'attack', value: 1, damagePerHit: 20, hits: 1, tags: ['重击'], weight: 15, cooldown: 2 }
    ]
  },
  { id: 'e_elite_iron_general', glyph: '将', color: '#b0a090', name: '铁甲将军', type: 'elite', maxHp: 100, defense: 8,
    tags: ['防御'],
    intentPattern: [
      { intent: 'attack', value: 1, damagePerHit: 12, hits: 1, tags: [], weight: 40 },
      { intent: 'shield', value: 15, tags: ['护盾'], weight: 25, cooldown: 2 },
      { intent: 'buff', value: { defUp: 4 }, tags: ['强化'], weight: 20, cooldown: 3 },
      { intent: 'attack', value: 1, damagePerHit: 18, hits: 1, tags: ['重击'], weight: 15, cooldown: 2 }
    ]
  },

  // Boss
  { id: 'e_boss_dragon', glyph: '龙', color: '#c9a24b', name: '万律龙尊', type: 'boss', maxHp: 130, defense: 5,
    tags: ['Boss'],
    intentPattern: [
      { intent: 'attack', value: 1, damagePerHit: 8, hits: 2, applyStatus: { statusId: 'poison', stacks: 3 }, tags: ['中毒', '龙息'], weight: 35 },
      { intent: 'attack', value: 1, damagePerHit: 14, hits: 1, tags: ['龙爪'], weight: 30, cooldown: 1 },
      { intent: 'shield', value: 12, tags: ['龙鳞'], heal: 10, weight: 20, cooldown: 3 },
      { intent: 'buff', value: { atkUp: 0.3 }, tags: ['龙威'], weight: 15, cooldown: 3 }
    ],
    phases: [
      { hpThreshold: 0.5, skillUnlock: { intent: 'attack', value: 1, damagePerHit: 10, hits: 1, applyStatus: { statusId: 'poison', stacks: 5 }, tags: ['灭世龙啸'], weight: 40, cooldown: 2 } }
    ]
  }
];

// ---- 区域配置 v1.4 ----
const REGIONS = [
  { name: '风之章', bossName: '风啸龙尊', scale: 1.0, layers: 9, desc: '剑风初起' },
  { name: '云之章', bossName: '云隐龙尊', scale: 1.25, layers: 9, desc: '云深不知处' }
];

function regionScale(region) {
  return REGIONS[Math.min(region, REGIONS.length - 1)]?.scale || 1.0;
}

function layerScale(layer) {
  if (layer <= 2) return 1.0;
  if (layer <= 5) return 1.15;
  if (layer <= 7) return 1.30;
  return 1.0;
}

// ---- 遭遇生成 v1.4 ----
function generateEncounter(layer, seedRng, region = 0) {
  const rng = seedRng || new SeededRandom(Date.now());
  const regionMult = regionScale(region);
  const isElite = rng.nextFloat() < 0.10 && layer >= 3;
  const isBoss = layer >= 8;

  if (isBoss) {
    const bossTmpl = ENEMIES.find(e => e.type === 'boss');
    const regionBossName = REGIONS[region]?.bossName || bossTmpl.name;
    const bossMult = 1.0 + region * 0.12;
    return {
      type: 'boss',
      enemies: [{
        ...bossTmpl, id: 'enemy_0',
        name: regionBossName,
        maxHp: Math.floor(bossTmpl.maxHp * bossMult),
        defense: Math.floor(bossTmpl.defense * bossMult),
        intentPattern: bossTmpl.intentPattern.map(i => ({ ...i })),
        phases: bossTmpl.phases?.map(p => ({ ...p }))
      }]
    };
  }

  if (isElite) {
    const elites = ENEMIES.filter(e => e.type === 'elite');
    const pick = { ...rng.pick(elites) };
    const scale = layerScale(layer) * regionMult;
    return {
      type: 'elite',
      enemies: [{
        ...pick, id: 'enemy_0',
        maxHp: Math.floor(pick.maxHp * scale),
        defense: Math.floor(pick.defense * scale),
        intentPattern: pick.intentPattern.map(i => ({ ...i }))
      }]
    };
  }

  const normals = ENEMIES.filter(e => e.type === 'normal');
  const count = rng.nextInt(1, 3);
  const selected = [];
  const pool = [...normals];
  const scale = layerScale(layer) * regionMult;
  for (let i = 0; i < count; i++) {
    const idx = rng.nextInt(0, pool.length - 1);
    const p = { ...pool[idx] };
    selected.push({
      ...p, id: `enemy_${i}`,
      maxHp: Math.floor(p.maxHp * scale),
      defense: Math.floor(p.defense * scale),
      intentPattern: p.intentPattern.map(ip => ({ ...ip }))
    });
    pool.splice(idx, 1);
    if (pool.length === 0) break;
  }
  return { type: 'normal', enemies: selected };
}

// ---- 路线生成 v1.4 ----
function generateRouteMap(seed) {
  const rng = new SeededRandom(seed);
  const layers = 9; // 8层 + Boss
  const nodes = [];

  for (let layer = 0; layer < layers; layer++) {
    let count;
    if (layer === 0) count = rng.nextInt(2, 4);
    else if (layer === layers - 1) count = 1;
    else count = rng.nextInt(2, 4);

    const layerNodes = [];
    for (let i = 0; i < count; i++) {
      let type;
      if (layer === layers - 1) {
        type = 'boss';
      } else if (layer < 2) {
        type = rng.pick(['battle', 'battle', 'battle', 'event']);
      } else {
        const types = ['battle', 'battle', 'battle', 'event', 'event', 'shop', 'upgrade', 'rest', 'treasure'];
        type = rng.pick(types);
      }
      layerNodes.push({ id: `node_${layer}_${i}`, layer, index: i, type, visited: false, accessible: false });
    }
    nodes.push(layerNodes);
  }

  // Ensure minimum services
  const allNodes = nodes.flat();
  const midNodes = allNodes.filter(n => n.layer > 1 && n.layer < layers - 1);
  if (!midNodes.some(n => n.type === 'shop')) { const c = midNodes.filter(n => n.type !== 'boss'); if (c.length) rng.pick(c).type = 'shop'; }
  if (!midNodes.some(n => n.type === 'rest')) { const c = midNodes.filter(n => n.type !== 'shop' && n.type !== 'boss'); if (c.length) rng.pick(c).type = 'rest'; }
  if (!midNodes.some(n => n.type === 'upgrade')) { const c = midNodes.filter(n => n.type !== 'shop' && n.type !== 'rest' && n.type !== 'boss'); if (c.length) rng.pick(c).type = 'upgrade'; }

  // Connections
  for (let layer = 0; layer < layers - 1; layer++) {
    const currentLayer = nodes[layer];
    const nextLayer = nodes[layer + 1];
    const nextAssigned = new Set();
    for (const node of currentLayer) {
      const connCount = rng.nextInt(1, Math.min(3, nextLayer.length));
      if (!node.connections) node.connections = [];
      for (let c = 0; c < connCount; c++) {
        const candidates = nextLayer.filter((_, i) => !nextAssigned.has(i));
        const target = candidates.length > 0 ? rng.pick(candidates) : rng.pick(nextLayer);
        if (!node.connections.includes(target.id)) node.connections.push(target.id);
        nextAssigned.add(nextLayer.indexOf(target));
      }
    }
    for (let i = 0; i < nextLayer.length; i++) {
      if (!currentLayer.some(n => n.connections && n.connections.includes(nextLayer[i].id))) {
        rng.pick(currentLayer).connections.push(nextLayer[i].id);
      }
    }
  }

  nodes[0].forEach(n => n.accessible = true);
  return { layers, nodes };
}

const NODE_TYPE_INFO = {
  battle: { name: '战斗', glyph: '战', color: '#e0604a' },
  elite: { name: '精英', glyph: '精', color: '#9270a0' },
  boss: { name: '首领', glyph: '王', color: '#c9a24b' },
  event: { name: '奇遇', glyph: '缘', color: '#d98e4a' },
  shop: { name: '商栈', glyph: '商', color: '#ecd394' },
  upgrade: { name: '改造', glyph: '铸', color: '#6b9c8a' },
  rest: { name: '休整', glyph: '休', color: '#6a92ad' },
  treasure: { name: '遗宝', glyph: '宝', color: '#e6c878' }
};
