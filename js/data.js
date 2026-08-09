// ============================================================
// 织律 Weaveline - Game Data
// Characters, Skills, Enemies, Equipment, Status Effects, Routes
// ============================================================

// ---- 异常状态 (独立减益，不再有元素反应机制) ----
const STATUS = {
  burn: {
    id: 'burn', name: '灼烧', nameKey: '灼烧',
    maxStacks: 10, decay: 1, decayTiming: 'round_end',
    onTick: (stacks) => ({ type: 'damage', amount: stacks * 2, tags: ['dot', 'burn'] })
  },
  armorBreak: {
    id: 'armorBreak', name: '破甲', nameKey: '破甲',
    maxStacks: 6, decay: 1, decayTiming: 'round_end',
    onApply: (stacks) => ({ defPenalty: stacks * 3 })
  }
};

// ---- Equipment ----
// ---- 佩饰 (装备，契合剑圣/武圣的武侠主题) ----
const EQUIPMENT = [
  // ============ 原有九件（机制装备，独立判定） ============
  { id: 'eq_chixin_yu', name: '炽心玉', rarity: '普通', slot: 'accessory',
    desc: '每回合首次造成伤害后，回复2点生命（心火温养，久战不疲）',
    effect: { healOnDealDamage: 2 } },
  { id: 'eq_huixin_yu', name: '会心玉', rarity: '普通', slot: 'accessory',
    desc: '蓄势重击(heavy)额外造成35%伤害',
    effect: { heavyBonus: 0.35 } },
  { id: 'eq_guanjia_fu', name: '贯甲符', rarity: '稀有', slot: 'accessory',
    desc: '对带有"破甲"状态的敌人，造成的伤害额外+25%',
    effect: { vsArmorBreakBonus: 0.25 } },
  { id: 'eq_zhoutian_huan', name: '周天环', rarity: '稀有', slot: 'special',
    desc: '技能槽首位与末位视为相邻（连携贯通）',
    effect: { loopSlot: true } },
  { id: 'eq_wujian_tie', name: '悟剑帖', rarity: '稀有', slot: 'special',
    desc: '每场战斗首次施展的招式，额外获得3点熟练',
    effect: { firstCastBonus: 3 } },
  { id: 'eq_dingxing_zhu', name: '定星珠', rarity: '稀有', slot: 'special',
    desc: '基础权重最低的招式，权重+35%（弥补弱势）',
    effect: { lowestWeightBonus: 0.35 } },
  { id: 'eq_yinyang_jue', name: '阴阳珏', rarity: '史诗', slot: 'special',
    desc: '相邻槽位标签不同时，该招式效果+8%',
    effect: { oppositeTagBonus: 0.08 } },
  { id: 'eq_lianxing_kou', name: '连星扣', rarity: '史诗', slot: 'special',
    desc: '连出保护延至第3次连续后方触发；连续同招伤害+8%',
    effect: { streakDelay: 3, streakDamageBonus: 0.08 } },
  { id: 'eq_huifeng_jian', name: '回风鉴', rarity: '史诗', slot: 'special',
    desc: '自动演绎威力+25%，但不再积攒熟练',
    effect: { replayBonus: 0.25, noProficiency: true } },

  // ============ 普通 (10) ============
  { id: 'eq_tiebushan', name: '铁布衫', rarity: '普通', slot: 'armor',
    desc: '金钟罩体，受到的伤害减少8%',
    effect: { dmgReduction: 0.08 } },
  { id: 'eq_tunajue', name: '吐纳诀', rarity: '普通', slot: 'scroll',
    desc: '每回合开始调息，回复3点生命',
    effect: { hpRegenRound: 3 } },
  { id: 'eq_lieshijin', name: '裂石劲', rarity: '普通', slot: 'fist',
    desc: '吐劲碎石，造成的所有伤害+6%',
    effect: { dmgMultAdd: 0.06 } },
  { id: 'eq_ningshen', name: '凝神珠', rarity: '普通', slot: 'accessory',
    desc: '心神凝定，连出保护延后1次方触发',
    effect: { streakDelayAdd: 1 } },
  { id: 'eq_hushenfu', name: '护身符', rarity: '普通', slot: 'talisman',
    desc: '每场战斗首次受到的伤害减免50%',
    effect: { firstHitShieldPct: 0.5 } },
  { id: 'eq_qingshen', name: '轻身步', rarity: '普通', slot: 'boots',
    desc: '身法轻灵，所有招式出手权重+10%',
    effect: { allWeightMult: 0.10 } },
  { id: 'eq_xuantiejie', name: '玄铁戒', rarity: '普通', slot: 'accessory',
    desc: '玄铁压腕，蓄势重击伤害+20%',
    effect: { heavyAdd: 0.20 } },
  { id: 'eq_huichun', name: '回春丹', rarity: '普通', slot: 'consumable',
    desc: '战前服丹，开局获得相当于8%生命的护盾',
    effect: { startShieldPct: 0.08 } },
  { id: 'eq_pozhang', name: '破障符', rarity: '普通', slot: 'talisman',
    desc: '符破坚障，无视敌人10%防御',
    effect: { ignoreDef: 0.10 } },
  { id: 'eq_juqi', name: '聚气符', rarity: '普通', slot: 'talisman',
    desc: '每回合自行聚气，蓄势+1',
    effect: { momentumPerRound: 1 } },

  // ============ 稀有 (10) ============
  { id: 'eq_qixing', name: '七星步', rarity: '稀有', slot: 'boots',
    desc: '踏罡步斗，每回合开始获得5%生命的护盾',
    effect: { roundShieldPct: 0.05 } },
  { id: 'eq_jiuzhuan', name: '九转丹', rarity: '稀有', slot: 'consumable',
    desc: '九转还魂，每回合开始回复6点生命',
    effect: { hpRegenRound: 6 } },
  { id: 'eq_yufeng', name: '御风环', rarity: '稀有', slot: 'accessory',
    desc: '御风之势，蓄势重击伤害+35%',
    effect: { heavyAdd: 0.35 } },
  { id: 'eq_pojun', name: '破军令', rarity: '稀有', slot: 'talisman',
    desc: '破军当头，对生命高于70%的敌人伤害+20%',
    effect: { vsHighHpAdd: 0.20 } },
  { id: 'eq_hansha', name: '含沙射影', rarity: '稀有', slot: 'hidden',
    desc: '袖中飞沙，攻击有20%几率使敌人破甲1层',
    effect: { armorBreakOnHitChance: 0.20, armorBreakOnHitStacks: 1 } },
  { id: 'eq_liuyun', name: '流云袖', rarity: '稀有', slot: 'accessory',
    desc: '袖卷流云，所有招式出手权重+20%',
    effect: { allWeightMult: 0.20 } },
  { id: 'eq_longlin', name: '龙鳞甲', rarity: '稀有', slot: 'armor',
    desc: '龙鳞护身，受到的伤害减少18%',
    effect: { dmgReduction: 0.18 } },
  { id: 'eq_dingshen', name: '定身符', rarity: '稀有', slot: 'talisman',
    desc: '符定其身，连续同招伤害+12%',
    effect: { streakDmgAdd: 0.12 } },
  { id: 'eq_chiyan', name: '赤焰符', rarity: '稀有', slot: 'talisman',
    desc: '赤焰附身，攻击有25%几率使敌人灼烧1层',
    effect: { burnOnHitChance: 0.25, burnOnHitStacks: 1 } },
  { id: 'eq_taixu', name: '太虚镜', rarity: '稀有', slot: 'accessory',
    desc: '太虚照影，蓄势上限+1',
    effect: { momentumMaxAdd: 1 } },

  // ============ 史诗 (10) ============
  { id: 'eq_xuanyuan', name: '轩辕剑意', rarity: '史诗', slot: 'special',
    desc: '轩辕剑意加身，造成的所有伤害+15%',
    effect: { dmgMultAdd: 0.15 } },
  { id: 'eq_panlong', name: '盘龙玉', rarity: '史诗', slot: 'accessory',
    desc: '盘龙绕体，每回合开始获得8%生命的护盾',
    effect: { roundShieldPct: 0.08 } },
  { id: 'eq_qiankun', name: '乾坤袋', rarity: '史诗', slot: 'special',
    desc: '纳乾吐坤，每回合开始回复10点生命',
    effect: { hpRegenRound: 10 } },
  { id: 'eq_fumo', name: '伏魔印', rarity: '史诗', slot: 'talisman',
    desc: '伏魔镇邪，对破甲敌人伤害+35%',
    effect: { vsArmorBreakAdd: 0.35 } },
  { id: 'eq_jinghong', name: '惊鸿扇', rarity: '史诗', slot: 'accessory',
    desc: '惊鸿一现，蓄势重击伤害+50%',
    effect: { heavyAdd: 0.50 } },
  { id: 'eq_xuanwu', name: '玄武甲', rarity: '史诗', slot: 'armor',
    desc: '玄武镇北，受到的伤害减少25%',
    effect: { dmgReduction: 0.25 } },
  { id: 'eq_zidian', name: '紫电青霜', rarity: '史诗', slot: 'accessory',
    desc: '紫电绕身，攻击有40%几率使敌人破甲2层',
    effect: { armorBreakOnHitChance: 0.40, armorBreakOnHitStacks: 2 } },
  { id: 'eq_hongchen', name: '红尘劫', rarity: '史诗', slot: 'special',
    desc: '红尘勘破，对生命低于30%的敌人伤害+40%',
    effect: { vsLowHpAdd: 0.40 } },
  { id: 'eq_wushuang', name: '无双谱', rarity: '史诗', slot: 'special',
    desc: '无双绝学，所有招式出手权重+30%',
    effect: { allWeightMult: 0.30 } },
  { id: 'eq_kunlun', name: '昆仑玉', rarity: '史诗', slot: 'accessory',
    desc: '昆仑玉魄，首次受击完全化解，且开局获得10%生命护盾',
    effect: { firstHitShieldPct: 1.0, startShieldPct: 0.10 } },

  // ============ 神话 (10) — 仅击败每层最终首领掉落 ============
  { id: 'eq_zhuxian', name: '诛仙剑', rarity: '神话', slot: 'special',
    desc: '诛仙之锋，造成的所有伤害+30%',
    effect: { dmgMultAdd: 0.30 } },
  { id: 'eq_taiji', name: '太极图', rarity: '神话', slot: 'special',
    desc: '太极生两仪，每回合回血15且获得10%生命护盾',
    effect: { hpRegenRound: 15, roundShieldPct: 0.10 } },
  { id: 'eq_jiutian', name: '九天玄女佩', rarity: '神话', slot: 'accessory',
    desc: '玄女临凡，蓄势重击伤害+80%',
    effect: { heavyAdd: 0.80 } },
  { id: 'eq_pangu', name: '盘古斧意', rarity: '神话', slot: 'special',
    desc: '盘古开天，无视敌人25%防御',
    effect: { ignoreDef: 0.25 } },
  { id: 'eq_nvwa', name: '女娲石', rarity: '神话', slot: 'special',
    desc: '女娲补天，受到的伤害减少40%',
    effect: { dmgReduction: 0.40 } },
  { id: 'eq_donghuang', name: '东皇钟', rarity: '神话', slot: 'special',
    desc: '东皇镇世，对破甲敌人伤害+60%',
    effect: { vsArmorBreakAdd: 0.60 } },
  { id: 'eq_kunlunjing', name: '昆仑镜', rarity: '神话', slot: 'special',
    desc: '昆仑照影，攻击50%几率使敌人破甲2层并灼烧2层',
    effect: { armorBreakOnHitChance: 0.50, armorBreakOnHitStacks: 2, burnOnHitChance: 0.50, burnOnHitStacks: 2 } },
  { id: 'eq_shennong', name: '神农鼎', rarity: '神话', slot: 'special',
    desc: '神农尝百草，每回合蓄势+2且回血12',
    effect: { momentumPerRound: 2, hpRegenRound: 12 } },
  { id: 'eq_fuxi', name: '伏羲琴', rarity: '神话', slot: 'special',
    desc: '伏羲演八卦，所有招式权重+50%，连出保护延至第4次',
    effect: { allWeightMult: 0.50, streakDelayAdd: 2 } },
  { id: 'eq_hundun', name: '混沌青莲', rarity: '神话', slot: 'special',
    desc: '混沌初开，造成的所有伤害+25%，且首次受击完全化解',
    effect: { dmgMultAdd: 0.25, firstHitShieldPct: 1.0 } }
];

// ---- 名剑 (Signature Swords for 剑圣) ----
// 每把名剑都对剑意层数机制做了适配：emitEffect 内字段被 battle-core.js 解读为 stack 版本。
const SIGNATURE_SWORDS = [
  { id: 'sword_liuguang', name: '流光',
    desc: '本次释放技能与上次不同，技能效果+12%；连续3次不同技能额外获得1剑意层',
    effect: { diffSkillBonus: 0.12, chain3Bonus: { swordIntent: 1 } } },
  { id: 'sword_jinghong', name: '惊鸿',
    desc: '大招释放所需剑意层-1（2层即可释放）；大招伤害额外+20%',
    effect: { ultimateCostReduce: 1, ultimateBonus: 0.20 } },
  { id: 'sword_duanyue', name: '断岳',
    desc: '每累计7次有效命中，下次单体技能变为必暴+处决(普通敌人<18%生命)',
    effect: { hitCount7: { critGuaranteed: true, executeThreshold: 0.18 } } },
  { id: 'sword_taichu', name: '太初',
    desc: '每场战斗开场自动获得1层剑意；生命<40%时剑技权重×1.25、命中时剑意+1',
    effect: { firstCombatStackFree: true, lowHpSwordBonus: { weightMult: 1.25, intentBonus: 1 }, lowHpThreshold: 0.40 } }
];

// ---- Character Skills ----
// 剑圣 (Swordsman) skills —— 伤害为具体数值（每 hit）
// 剑意层数机制：0-3 层，每层 +10% 伤害。剑技命中后层数+1。三层满后可以释放"大招"（在 6 个普通技能之外的 3 个终极技能），释放后层数 -1。
const SWORDSMAN_SKILLS = [
  // ===================== 剑技（命中后 +1 层剑意） =====================
  { id: 's_cloud_stab', name: '流云刺', category: 'sword_technique', tag: '剑技',
    baseWeight: 120, cooldown: 0, target: 'lowest_hp',
    desc: '造成 2 段 ×12 伤害；命中后剑意层数 +1',
    effects: [{ type: 'damage', base: 12, hits: 2 }],
    onHit: { swordIntent: 1 },
    hitPreset: 'light', castSfx: 'blade_light', impactSfx: 'blade_light' },

  { id: 's_whirlwind', name: '回风斩', category: 'sword_technique', tag: '剑技',
    baseWeight: 105, cooldown: 0, target: 'random',
    desc: '造成 18 伤害；若上次技能不同，再追加 8 伤害；命中后剑意层数 +1',
    effects: [{ type: 'damage', base: 18, hits: 1 }],
    chainBonus: { damage: 0.45, condition: 'different_skill' },
    onHit: { swordIntent: 1 },
    hitPreset: 'light', castSfx: 'blade_light', impactSfx: 'blade_light' },

  { id: 's_swallow_return', name: '燕返', category: 'sword_technique', tag: '剑技',
    baseWeight: 85, cooldown: 1, target: 'highest_hp',
    desc: '造成 25 伤害；若上一招为剑气，本次+9伤害；命中后剑意层数 +1',
    effects: [{ type: 'damage', base: 25, hits: 1 }],
    conditionBonus: { damage: 0.35, condition: 'last_skill_qi' },
    onHit: { swordIntent: 1 },
    hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },

  { id: 's_moon_combo', name: '踏月连环', category: 'sword_technique', tag: '剑技',
    baseWeight: 70, cooldown: 1, target: 'random',
    desc: '造成 4 段 ×7 伤害；每段独立判定暴击；命中后剑意层数 +1',
    effects: [{ type: 'damage', base: 7, hits: 4, critPerHit: true }],
    onHit: { swordIntent: 1 },
    hitPreset: 'standard', castSfx: 'blade_multi', impactSfx: 'blade_multi', multiHit: true },

  { id: 's_forest_pierce', name: '穿林破影', category: 'sword_technique', tag: '剑技',
    baseWeight: 90, cooldown: 0, target: 'lowest_hp',
    desc: '造成 20 伤害；目标生命<50%时再追击 11 伤害；命中后剑意层数 +1',
    effects: [{ type: 'damage', base: 20, hits: 1 }],
    executeBonus: { threshold: 0.50, chaseDamage: 0.55 },
    onHit: { swordIntent: 1 },
    hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },

  { id: 's_reflect_sword', name: '折光回剑', category: 'sword_technique', tag: '剑技',
    baseWeight: 75, cooldown: 1, target: 'last_attacker',
    desc: '造成 22 伤害；若上一轮受到伤害，本次+7伤害；命中后剑意层数 +1',
    effects: [{ type: 'damage', base: 22, hits: 1 }],
    revengeBonus: { damage: 0.30, condition: 'took_damage_last_round' },
    onHit: { swordIntent: 1 },
    hitPreset: 'standard', castSfx: 'blade_light', impactSfx: 'blade_light' },

  // ===================== 剑气（无成本、不增剑意） =====================
  { id: 's_green_edge_qi', name: '青锋剑气', category: 'sword_qi', tag: '剑气',
    baseWeight: 100, cooldown: 0, target: 'lowest_hp',
    desc: '造成 35 伤害；单体高输出',
    effects: [{ type: 'damage', base: 35, hits: 1 }],
    hitPreset: 'standard',
    castSfx: 'sword_qi', impactSfx: 'sword_qi' },

  { id: 's_river_qi', name: '横江剑气', category: 'sword_qi', tag: '剑气',
    baseWeight: 70, cooldown: 1, target: 'all_enemies',
    desc: '全体 18 伤害',
    effects: [{ type: 'damage', base: 18, hits: 1, allEnemies: true }],
    hitPreset: 'standard',
    castSfx: 'sword_qi', impactSfx: 'sword_qi' },

  { id: 's_hundred_step_frost', name: '百步飞霜', category: 'sword_qi', tag: '剑气',
    baseWeight: 55, cooldown: 2, target: 'lowest_hp',
    desc: '造成 41 伤害；普通敌人<15%生命处决',
    effects: [{ type: 'damage', base: 41, hits: 1, execute: 0.15 }],
    hitPreset: 'heavy',
    castSfx: 'sword_qi', impactSfx: 'sword_qi' },

  { id: 's_sword_rain', name: '剑雨千寻', category: 'sword_qi', tag: '剑气',
    baseWeight: 50, cooldown: 2, target: 'random',
    desc: '随机目标 7 伤害 ×8 段',
    effects: [{ type: 'damage', base: 7, hits: 8 }],
    hitPreset: 'light',
    castSfx: 'sword_qi', impactSfx: 'sword_qi', multiHit: true },

  // ===================== 旧·绝技（不再依赖剑意，但保留强力效果） =====================
  { id: 's_ten_thousand_swords', name: '万剑归流', category: 'sword_qi', tag: '剑气·绝技',
    baseWeight: 28, cooldown: 4, target: 'random',
    desc: '随机目标 8 伤害 ×6 段（不再消耗剑意；冷却4回合）',
    effects: [{ type: 'damage', base: 8, hits: 6 }],
    hitPreset: 'standard', sweetener: 'heavy',
    castSfx: 'sword_qi_bloom', impactSfx: 'sword_qi_bloom',
    tier: 'custom', multiHit: true },

  { id: 's_one_sword_sky', name: '一剑开天', category: 'sword_technique', tag: '剑技·绝技',
    baseWeight: 24, cooldown: 4, target: 'highest_hp',
    desc: '造成 78 伤害，附带处决演出（不再依赖剑意；冷却4回合）',
    effects: [{ type: 'damage', base: 78, hits: 1 }],
    hitPreset: 'execute', sweetener: 'execute',
    castSfx: 'sword_qi_bloom', impactSfx: 'execute',
    tier: 'custom' },

  // ===================== 新增：3 个大招（需 3 层剑意，释放后层数 -1） =====================
  { id: 's_spirit_roundslash', name: '气刃大回转', category: 'sword_ultimate', tag: '大招',
    baseWeight: 110, cooldown: 2, target: 'highest_hp',
    desc: '【需3层剑意】释放后层数-1；造成 65 伤害，并使目标破甲3层',
    effects: [{ type: 'damage', base: 65, hits: 1 }],
    applyStatus: { status: 'armorBreak', stacks: 3 },
    requireSwordIntent: 3, consumeSwordIntent: 1,
    hitPreset: 'execute', sweetener: 'heavy',
    castSfx: 'sword_qi_bloom', impactSfx: 'execute', tier: 'custom' },

  { id: 's_iaigiri', name: '一闪·居合', category: 'sword_ultimate', tag: '大招',
    baseWeight: 110, cooldown: 2, target: 'highest_hp',
    desc: '【需3层剑意】释放后层数-1；造成 50 伤害；目标<30%生命直接处决',
    effects: [{ type: 'damage', base: 50, hits: 1, execute: 0.30 }],
    requireSwordIntent: 3, consumeSwordIntent: 1,
    hitPreset: 'execute', sweetener: 'execute',
    castSfx: 'sword_qi_bloom', impactSfx: 'execute', tier: 'custom' },

  { id: 's_eightway_slash', name: '剑廿三十·八方斩', category: 'sword_ultimate', tag: '大招',
    baseWeight: 80, cooldown: 3, target: 'all_enemies',
    desc: '【需3层剑意】释放后层数-1；全体 18 伤害 ×4 段',
    effects: [{ type: 'damage', base: 18, hits: 4, allEnemies: true }],
    requireSwordIntent: 3, consumeSwordIntent: 1,
    hitPreset: 'heavy', sweetener: 'heavy',
    castSfx: 'sword_qi_bloom', impactSfx: 'sword_qi_bloom', tier: 'custom', multiHit: true }
];

// 武圣 (Martial Artist) skills —— 伤害为具体数值（每 hit）
const MARTIALARTIST_SKILLS = [
  { id: 'm_mountain_fist', name: '开山拳', category: 'fist', tag: '拳法',
    baseWeight: 125, cooldown: 0, target: 'highest_hp',
    desc: '造成 28 伤害；无复杂条件',
    effects: [{ type: 'damage', base: 28, hits: 1 }],
    hitPreset: 'standard', castSfx: 'fist_heavy', impactSfx: 'fist_heavy' },

  { id: 'm_cannon_fist', name: '崩山炮拳', category: 'fist', tag: '拳法',
    baseWeight: 80, cooldown: 1, target: 'highest_hp',
    desc: '造成 39 伤害；目标生命>70%时+8伤害',
    effects: [{ type: 'damage', base: 39, hits: 1 }],
    conditionBonus: { damage: 0.20, condition: 'target_hp_above_70' },
    hitPreset: 'heavy', castSfx: 'fist_heavy', impactSfx: 'fist_heavy' },

  { id: 'm_chain_fist', name: '连环炮拳', category: 'fist', tag: '拳法',
    baseWeight: 95, cooldown: 0, target: 'lowest_hp',
    desc: '造成 3 段 ×13 伤害；三拳命中同一目标',
    effects: [{ type: 'damage', base: 13, hits: 3 }],
    hitPreset: 'standard', castSfx: 'fist_heavy', impactSfx: 'fist_heavy', multiHit: true },

  { id: 'm_armor_break_fist', name: '碎甲拳', category: 'fist', tag: '拳法',
    baseWeight: 85, cooldown: 1, target: 'highest_armor',
    desc: '造成 26 伤害＋破甲2；若已破甲则改为约 50 伤害',
    effects: [{ type: 'damage', base: 26, hits: 1 }],
    applyStatus: { status: 'armorBreak', stacks: 2 },
    armorBrokenBonus: { damage: 1.95 },
    hitPreset: 'standard', castSfx: 'fist_heavy', impactSfx: 'fist_heavy' },

  { id: 'm_overlord_fist', name: '霸王冲拳', category: 'fist', tag: '拳法·绝技',
    baseWeight: 32, cooldown: 3, target: 'highest_hp',
    desc: '造成 56 伤害；重式时额外+14，并带处决',
    effects: [{ type: 'damage', base: 56, hits: 1 }],
    heavyBonus: { multiplier: 1.25, execute: true },
    hitPreset: 'execute', sweetener: 'execute',
    castSfx: 'fist_heavy', impactSfx: 'execute', tier: 'custom' },

  { id: 'm_ground_split_kick', name: '裂地踢', category: 'kick', tag: '脚法',
    baseWeight: 110, cooldown: 0, target: 'lowest_hp',
    desc: '造成 30 伤害；目标<50%生命时+6伤害',
    effects: [{ type: 'damage', base: 30, hits: 1 }],
    conditionBonus: { damage: 0.20, condition: 'target_hp_below_50' },
    hitPreset: 'standard', castSfx: 'kick_heavy', impactSfx: 'kick_heavy' },

  { id: 'm_sweep_kick', name: '扫堂腿', category: 'kick', tag: '脚法',
    baseWeight: 75, cooldown: 1, target: 'all_enemies',
    desc: '全体 17 伤害；2+敌人时权重×1.4',
    effects: [{ type: 'damage', base: 17, hits: 1, allEnemies: true }],
    weightCondition: { multiplier: 1.4, condition: 'enemies_ge_2' },
    hitPreset: 'standard', castSfx: 'kick_heavy', impactSfx: 'kick_heavy' },

  { id: 'm_chase_kick', name: '追命腿', category: 'kick', tag: '脚法',
    baseWeight: 65, cooldown: 1, target: 'lowest_hp',
    desc: '造成 35 伤害，带处决',
    effects: [{ type: 'damage', base: 35, hits: 1 }],
    execute: true,
    hitPreset: 'heavy', sweetener: 'execute',
    castSfx: 'kick_heavy', impactSfx: 'execute' },

  { id: 'm_sky_heavy_kick', name: '裂空重踢', category: 'kick', tag: '脚法·绝技',
    baseWeight: 38, cooldown: 2, target: 'highest_hp',
    desc: '造成 48 伤害；若为重式则本次暴击伤害额外+35%',
    effects: [{ type: 'damage', base: 48, hits: 1 }],
    heavyBonus: { critDamage: 0.35 },
    hitPreset: 'execute', sweetener: 'execute',
    castSfx: 'kick_heavy', impactSfx: 'execute', tier: 'custom' },

  { id: 'm_hunyuan_force', name: '混元劲', category: 'inner_power', tag: '内功',
    baseWeight: 70, cooldown: 3, target: 'self',
    desc: '本场攻击效果+10%，最多3层；随后立即再抽拳/脚',
    effects: [{ type: 'buff', buff: 'atkUp', amount: 0.10, maxStacks: 3 }],
    chainAction: { type: 'fist_or_kick' },
    hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },

  { id: 'm_golden_bell', name: '金钟劲', category: 'inner_power', tag: '内功',
    baseWeight: 55, cooldown: 3, target: 'self',
    desc: '获得最大生命15%护盾；随后立即再抽拳/脚',
    effects: [{ type: 'shield', amount: 0.15 }],
    chainAction: { type: 'fist_or_kick' },
    hitPreset: 'none', castSfx: 'inner_power', impactSfx: 'none' },

  { id: 'm_overlord_qi', name: '霸王真气', category: 'inner_power', tag: '内功·绝技',
    baseWeight: 30, cooldown: 4, target: 'self',
    desc: '立即把蓄势补至3；本次随后抽到的拳/脚重式额外+35%',
    effects: [{ type: 'set_momentum', amount: 3 }],
    chainAction: { type: 'fist_or_kick', heavyBonus: 0.35 },
    hitPreset: 'none', sweetener: 'heavy',
    castSfx: 'inner_power', impactSfx: 'heavy_sweetener', tier: 'custom' }
];

// ---- Characters ----
const CHARACTERS = {
  swordsman: {
    id: 'swordsman', name: '剑圣', className: '剑圣', glyph: '剑', portrait: 'assets/char_swordsman.jpg',
    maxHp: 95, atk: 23, skillSlots: 6,
    startingSkills: ['s_cloud_stab', 's_whirlwind'],
    skillPool: SWORDSMAN_SKILLS,
    resource: { name: '剑意', key: 'swordIntent', max: 3, start: 0 },
    signatureChoices: SIGNATURE_SWORDS,
    streakMultipliers: [{ after: 2, mult: 0.45 }],
    color: '#4FC3F7', bgColor: '#E1F5FE',
    description: '灵巧华丽，招式流动，剑气纵横'
  },
  martialArtist: {
    id: 'martialArtist', name: '武圣', className: '武圣', glyph: '武', portrait: 'assets/char_martial.jpg',
    maxHp: 92, atk: 18, skillSlots: 6,
    startingSkills: ['m_mountain_fist', 'm_ground_split_kick'],
    skillPool: MARTIALARTIST_SKILLS,
    resource: { name: '蓄势', key: 'momentum', max: 3, start: 0 },
    streakMultipliers: [{ after: 2, mult: 0.60 }, { after: 3, mult: 0.30 }],
    color: '#FF7043', bgColor: '#FBE9E7',
    description: '大开大合，以力破巧，拳脚重击'
  }
};

// ---- Enemies ----
const ENEMIES = [
  // Normal enemies
  { id: 'e_fire_mage', glyph: '炎', color: '#e0704a', name: '炎术师', type: 'normal', maxHp: 35, defense: 3, speed: 4,
    tags: ['高爆发', '状态'],
    skills: [
      { name: '火球术', weight: 60, damage: 8, status: { type: 'burn', stacks: 2 }, target: 'random' },
      { name: '烈焰冲击', weight: 40, damage: 14, target: 'player', cooldown: 2 }
    ] },
  { id: 'e_water_priest', glyph: '潮', color: '#6a92ad', name: '潮汐祭司', type: 'normal', maxHp: 40, defense: 2, speed: 5,
    tags: ['状态', '防御'],
    skills: [
      { name: '水弹', weight: 50, damage: 8, target: 'player' },
      { name: '治愈', weight: 50, heal: 10, target: 'self_lowest', cooldown: 2 }
    ] },
  { id: 'e_lightning_beast', glyph: '雷', color: '#d8c060', name: '雷牙兽', type: 'normal', maxHp: 32, defense: 4, speed: 6,
    tags: ['多敌'],
    skills: [
      { name: '电牙撕咬', weight: 55, damage: 11, target: 'player' },
      { name: '放电', weight: 45, damage: 12, target: 'player', cooldown: 2 }
    ] },
  { id: 'e_iron_guard', glyph: '铁', color: '#9a9186', name: '铁甲守卫', type: 'normal', maxHp: 50, defense: 8, speed: 3,
    tags: ['防御'],
    skills: [
      { name: '铁壁', weight: 40, buff: { def: 5, rounds: 2 }, target: 'self', cooldown: 3 },
      { name: '重击', weight: 60, damage: 10, target: 'player' }
    ] },
  { id: 'e_shadow_blade', glyph: '影', color: '#9270a0', name: '影刃刺客', type: 'normal', maxHp: 28, defense: 2, speed: 8,
    tags: ['高爆发'],
    skills: [
      { name: '暗影斩', weight: 55, damage: 11, target: 'player' },
      { name: '毒刃', weight: 45, damage: 7, status: { type: 'burn', stacks: 1 }, target: 'player' }
    ] },
  { id: 'e_rock_golem', glyph: '岩', color: '#a08a68', name: '岩石魔像', type: 'normal', maxHp: 55, defense: 10, speed: 2,
    tags: ['防御'],
    skills: [
      { name: '岩石投掷', weight: 70, damage: 8, target: 'player' },
      { name: '硬化', weight: 30, buff: { def: 8, rounds: 2 }, target: 'self', cooldown: 3 }
    ] },
  { id: 'e_wind_blade', glyph: '风', color: '#7fb59a', name: '风刃武士', type: 'normal', maxHp: 38, defense: 3, speed: 7,
    tags: ['多敌'],
    skills: [
      { name: '风之刃', weight: 60, damage: 8, target: 'player' },
      { name: '旋风斩', weight: 40, damage: 6, target: 'player', hits: 2, cooldown: 2 }
    ] },
  { id: 'e_toxic_spider', glyph: '毒', color: '#8aa84f', name: '毒液蛛', type: 'normal', maxHp: 30, defense: 2, speed: 5,
    tags: ['状态'],
    skills: [
      { name: '毒液喷射', weight: 50, damage: 5, status: { type: 'burn', stacks: 3 }, target: 'player' },
      { name: '蛛网束缚', weight: 50, damage: 4, status: { type: 'armorBreak', stacks: 2 }, target: 'player' }
    ] },

  // Elite enemies
  { id: 'e_elite_fire_lord', glyph: '焰', color: '#e0604a', name: '烈焰领主', type: 'elite', maxHp: 75, defense: 5, speed: 5,
    tags: ['高爆发', '状态'],
    skills: [
      { name: '地狱火', weight: 50, damage: 12, status: { type: 'burn', stacks: 3 }, target: 'player' },
      { name: '火焰新星', weight: 30, damage: 9, target: 'player', aoe: true, cooldown: 3 },
      { name: '燃烧之触', weight: 20, damage: 7, status: { type: 'burn', stacks: 5 }, target: 'player', cooldown: 2 }
    ] },
  { id: 'e_elite_armor_king', glyph: '钢', color: '#b0a89c', name: '钢甲战王', type: 'elite', maxHp: 90, defense: 10, speed: 3,
    tags: ['防御'],
    skills: [
      { name: '毁灭重锤', weight: 45, damage: 11, target: 'player', cooldown: 1 },
      { name: '铁壁防御', weight: 30, buff: { def: 10, rounds: 2 }, target: 'self', cooldown: 3 },
      { name: '战吼', weight: 25, buff: { atk: 0.3, rounds: 3 }, target: 'self', cooldown: 3 }
    ] },

  // Boss
  { id: 'e_boss_dragon', glyph: '龙', color: '#c9a24b', name: '万律龙尊', type: 'boss', maxHp: 100, defense: 5, speed: 4,
    tags: ['Boss'],
    skills: [
      { name: '龙息', weight: 40, damage: 5, status: { type: 'burn', stacks: 3 }, target: 'player', aoe: true },
      { name: '龙爪', weight: 30, damage: 7, target: 'player', cooldown: 1 },
      { name: '龙鳞护体', weight: 15, buff: { def: 6, rounds: 2 }, heal: 10, target: 'self', cooldown: 3 },
      { name: '龙威', weight: 15, damage: 4, debuff: { atk: -0.2, rounds: 2 }, target: 'player', aoe: true, cooldown: 3 }
    ],
    phases: [
      { hpThreshold: 0.5, skillUnlock: { name: '灭世龙啸', weight: 50, damage: 8, status: { type: 'burn', stacks: 4 }, target: 'player', aoe: true, cooldown: 3 } }
    ] }
];

// ---- 敌人随层数强度倍率 ----
function layerScale(layer) {
  if (layer <= 2) return 1.0;
  if (layer <= 5) return 1.15;
  if (layer <= 8) return 1.30;
  if (layer <= 10) return 1.50;
  return 1.0; // boss: 使用固定值，不在这里倍率
}

// Generate default encountered enemies by layer
function generateEncounter(layer, seedRng) {
  const rng = seedRng || new SeededRandom(Date.now());
  const isElite = rng.nextFloat() < 0.12 && layer >= 4;
  const isBoss = layer >= 11;

  if (isBoss) {
    return {
      type: 'boss',
      enemies: [{ ...ENEMIES.find(e => e.type === 'boss') }]
    };
  }

  if (isElite) {
    const elites = ENEMIES.filter(e => e.type === 'elite');
    const pick = rng.pick(elites);
    const scale = layerScale(layer);
    return {
      type: 'elite',
      enemies: [{
        ...pick,
        maxHp: Math.floor(pick.maxHp * scale),
        defense: Math.floor(pick.defense * scale),
        skills: pick.skills.map(s => ({ ...s, damage: Math.floor((s.damage || 0) * scale) }))
      }]
    };
  }

  const normals = ENEMIES.filter(e => e.type === 'normal');
  const count = rng.nextInt(1, 3);
  const selected = [];
  const pool = [...normals];
  const scale = layerScale(layer);
  for (let i = 0; i < count; i++) {
    const idx = rng.nextInt(0, pool.length - 1);
    const p = pool[idx];
    selected.push({
      ...p,
      maxHp: Math.floor(p.maxHp * scale),
      defense: Math.floor(p.defense * scale),
      skills: p.skills.map(s => ({ ...s, damage: Math.floor((s.damage || 0) * scale) }))
    });
    pool.splice(idx, 1);
    if (pool.length === 0) break;
  }

  return { type: 'normal', enemies: selected };
}

// ---- Route Generation ----
function generateRouteMap(seed) {
  const rng = new SeededRandom(seed);
  const layers = 12;  // 4 层更深的关卡（共 12 层，0-11）
  const nodes = [];

  // 在 4 个区域各确保 1 个 shop / rest / upgrade（4×3=12 保证节点在每区）
  const nodeTypes = ['battle', 'battle', 'battle', 'battle', 'event', 'event', 'shop', 'upgrade', 'rest', 'treasure'];

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
        type = rng.pick(nodeTypes);
      }

      // Ensure minimum shop/rest/upgrade per region
      const existing = nodes.flatMap(l => l.map(n => n.type));

      layerNodes.push({
        id: `node_${layer}_${i}`,
        layer,
        index: i,
        type,
        visited: false,
        accessible: false
      });
    }
    nodes.push(layerNodes);
  }

  // Ensure guaranteed nodes exist in each quarter (4 regions × 3 garantueed types)
  const allNodes = nodes.flat();
  // 保证每 3 层至少 1 个 shop / rest / upgrade（12 层 ÷ 4 区 = 每区 3 层）
  for (let region = 0; region < 4; region++) {
    const regionNodes = allNodes.filter(n => n.layer >= region * 3 && n.layer < (region + 1) * 3 && n.layer > 0);
    if (!regionNodes.some(n => n.type === 'shop')) {
      const candidates = regionNodes.filter(n => n.layer < layers - 1 && !n.visited);
      if (candidates.length > 0) rng.pick(candidates).type = 'shop';
    }
    if (!regionNodes.some(n => n.type === 'rest')) {
      const candidates = regionNodes.filter(n => n.type !== 'shop' && !n.visited && n.layer < layers - 1);
      if (candidates.length > 0) rng.pick(candidates).type = 'rest';
    }
    if (!regionNodes.some(n => n.type === 'upgrade')) {
      const candidates = regionNodes.filter(n => n.type !== 'shop' && n.type !== 'rest' && !n.visited && n.layer < layers - 1);
      if (candidates.length > 0) rng.pick(candidates).type = 'upgrade';
    }
  }
  // 全局补位：万一有类型全缺
  if (!allNodes.some(n => n.type === 'shop')) {
    rng.pick(allNodes.filter(n => n.layer > 0 && n.layer < layers - 1)).type = 'shop';
  }
  if (!allNodes.some(n => n.type === 'rest')) {
    rng.pick(allNodes.filter(n => n.layer > 0 && n.layer < layers - 1 && n.type !== 'shop')).type = 'rest';
  }
  if (!allNodes.some(n => n.type === 'upgrade')) {
    rng.pick(allNodes.filter(n => n.layer > 0 && n.layer < layers - 1 && n.type !== 'shop' && n.type !== 'rest')).type = 'upgrade';
  }

  // Generate connections: each node connects to 1-3 nodes in next layer
  for (let layer = 0; layer < layers - 1; layer++) {
    const currentLayer = nodes[layer];
    const nextLayer = nodes[layer + 1];

    // Ensure all next layer nodes are reachable
    const nextAssigned = new Set();
    for (const node of currentLayer) {
      const connections = rng.nextInt(1, Math.min(3, nextLayer.length));
      for (let c = 0; c < connections; c++) {
        const candidates = nextLayer.filter((_, i) => !nextAssigned.has(i));
        const target = candidates.length > 0 ? rng.pick(candidates) : rng.pick(nextLayer);
        if (!node.connections) node.connections = [];
        if (!node.connections.includes(target.id)) {
          node.connections.push(target.id);
        }
        nextAssigned.add(nextLayer.indexOf(target));
      }
    }

    // Ensure all next layer nodes are connected
    for (let i = 0; i < nextLayer.length; i++) {
      if (!currentLayer.some(n => n.connections && n.connections.includes(nextLayer[i].id))) {
        rng.pick(currentLayer).connections.push(nextLayer[i].id);
      }
    }
  }

  // Mark first layer as accessible
  nodes[0].forEach(n => n.accessible = true);

  return { layers, nodes };
}

// Node type display info
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
