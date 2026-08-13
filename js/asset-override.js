// ============================================================
// 织律 Weaveline - 资产覆盖机制
// 支持后台管理系统上传图片覆盖默认资源（地图/角色/怪物贴图）
// 覆盖数据存于 localStorage，key 前缀 zhilv_asset_
// ============================================================

const WeavelineAssets = {
  // 默认资源 key 映射
  _keyMap: {
    'assets/bg_menu_fan_kuan.jpg': 'bg_menu',
    'assets/bg_battle_guo_xi.jpg': 'bg_battle',
    'assets/bg_bamboo.jpg': 'bg_bamboo',
    'assets/bg_map_fuchun.jpg': 'bg_map',
    'assets/char_swordsman.jpg': 'char_swordsman',
    'assets/char_martial.jpg': 'char_martial',
    'assets/ultimate_cinematic.jpg': 'ultimate',
  },

  getOverride(key) {
    try {
      return localStorage.getItem('zhilv_asset_' + key);
    } catch (e) { return null; }
  },

  /** 获取敌人贴图覆盖（key 为敌人 id 或名称） */
  getEnemyImage(enemyId) {
    try {
      return localStorage.getItem('zhilv_asset_enemy_' + enemyId);
    } catch (e) { return null; }
  },

  /** 解析资源路径：优先返回覆盖的 base64，否则返回默认路径 */
  resolve(defaultPath) {
    const key = this._keyMap[defaultPath];
    if (key) {
      const override = this.getOverride(key);
      if (override) return override;
    }
    return defaultPath;
  },
};

// 全局辅助函数
function wlAsset(path) {
  return WeavelineAssets.resolve(path);
}
