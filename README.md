# 织律 Weaveline

> Roguelite 自动战斗游戏 - Web 原型

## 快速开始

直接在浏览器打开 `index.html` 即可游玩，或部署到任意静态服务器。

## GitHub Pages 部署

1. 将 `weaveline/` 目录推送到 GitHub 仓库
2. 在仓库 Settings → Pages 中
   - Source: Deploy from a branch
   - Branch: main / folder: / (root)  
   或设置 Source: GitHub Actions
3. 等待部署完成后访问 `https://<username>.github.io/<repo>/`

## 玩法

- 选择角色（剑圣/武圣）
- 在树状路线图上选择节点前进
- 战斗自动进行，技能按权重随机抽取
- 战后获取技能/装备奖励
- 利用商店购买技能、治疗
- 在改造站升级技能
- 击败 Boss 通关

## 角色

### 剑圣
- 积累「剑意」，触发「盛放」爆发
- 每局选择一把「名剑」改变流派
- 12个专属技能（剑技/剑气）

### 武圣  
- 积累「蓄势」，触发「重式」打击
- 「内功」技能不结束行动，立即追加拳脚
- 12个专属技能（拳法/脚法/内功）

## 技术

纯前端 HTML + CSS + JavaScript，无需构建工具。使用 Web Audio API 生成音效与五声音阶国风 BGM。

## 美术与字体资源（均从网上获取）

- **字体**：Google Fonts — Ma Shan Zheng（毛笔行书）、Noto Serif SC（宋体）
- **背景画**（公有领域，Wikimedia Commons）：
  - `assets/bg_menu_fan_kuan.jpg` — 北宋 · 范宽《溪山行旅图》（主菜单/通关）
  - `assets/bg_battle_guo_xi.jpg` — 北宋 · 郭熙《早春图》（战斗场景）
  - `assets/bg_bamboo.jpg` — 清 · 郑燮（板桥）《竹石图》（商店/休整/事件等）
  - `assets/bg_map_fuchun.jpg` — 元 · 黄公望《富春山居图（无用师卷）》（路线图卷轴装饰条）
- 角色/敌人以书法字印章形式呈现（剑/武/炎/潮/雷/龙……），斩击、剑气、冲击环等战斗特效为 SVG/CSS 程序化绘制

## v0.2 国风水墨版更新

- 全界面重做为「夜墨」国风主题：墨色为底、鎏金勾边、朱砂印章
- 战斗演出升级：技能卷轴横幅、剑技弧光斩击、剑气月牙波、拳脚冲击环、
  墨点粒子、四档震屏（轻击/标准/重击/处决）、重击白闪帧、处决全屏演出
- 敌人状态（燃/湿/电/甲）实时徽标、剑意/蓄势珠、路线 SVG 墨线连接
- BGM 重写为五声音阶生成式国风配乐（古筝拨弦 + 堂鼓），普通/精英/Boss 三档情绪
