# UI Brief v1 · 效率文档工具

日期：2026-09-17  
负责：UI设计师  
对照：`docs/PRD_MVP.md` · `docs/design/WIREFRAMES_MVP.md` · `docs/design/SYNC_STATES.md`  
仓库：`/Users/danerli/workspace/efficiency-docs` · Web `http://localhost:5173` · API `:8787`

## 1. 一句话

把 scaffold 壳子收成 **一个人用的本机效率客户端**：克制、高密度、状态诚实；Notion 是数据源，UI 负责扫读与写回反馈，不装 SaaS 营销皮。

气质：`utilitarian` · `dense but calm` · `status-honest`  
反关键词：`dashboard glow` · `彩色 tag 墙` · `渐变 CTA` · `插画空态凑热闹`

## 2. 现状 → 目标

| 现在 | 目标 |
|---|---|
| `App.css` 硬编码灰阶，深侧栏 + 浅内容默认感 | 单一 token 表驱动；侧栏/主区同一套语义色 |
| 今日清单能列任务，文档/搜索多为占位 | 按线框做出可点的高保真组件态 |
| 同步芯片有四态 class，视觉偏「彩 pill」 | 四态可辨但不吵；失败可重试入口清晰 |

本轮 UI **先锁 token + App Shell + 今日清单**；文档双栏/搜索精修跟 M3/M4，但 token 一次铺好避免返工。

## 3. 视觉系统（锁 token）

### 3.1 色（建议浅色工作面；侧栏略深）

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#f4f5f7` | 页底 |
| `--surface` | `#ffffff` | 列表卡、编辑器面 |
| `--sidebar` | `#12151a` | 侧栏底（可对齐个人站深色气质，便于品牌连贯） |
| `--sidebar-text` | `#e8ecf2` | 侧栏字 |
| `--text` | `#141820` | 主文 |
| `--text-muted` | `#5c6573` | 次文/日期 |
| `--border` | `rgba(20,24,32,0.08)` | 分割 |
| `--accent` | `#2a9d8f` | 主按钮、当前导航、链接 |
| `--accent-soft` | `rgba(42,157,143,0.12)` | 当前态浅底 |
| `--ok` | `#0f766e` | 已同步 |
| `--warn` | `#b45309` | 离线只读 |
| `--danger` | `#b91c1c` | 同步失败 |
| `--focus` | `#2a9d8f` | 焦点环 |

说明：与个人站同属「青绿强调 + 深壳」，但 **效率工具默认浅工作面**（长时间扫任务更合适）。不做暗亮双主题（本轮）。

### 3.2 字体 / 间距

| 角色 | 规则 |
|---|---|
| UI 中文/英文 | `Inter` 或系统 UI + `PingFang SC` / `Noto Sans SC` |
| 等宽（设置/调试块） | `IBM Plex Mono` 13–14px |
| 密度 | 行高任务行 ≈ 44–48px；侧栏宽 200–220px；主区内边距 24–32px |
| 圆角 | `--radius 10px`；芯片 `--radius-sm 6px`；**少用 999px pill**（同步芯片可小圆角，勿整站胶囊化） |

### 3.3 组件（MVP 优先）

| 组件 | 规格要点 |
|---|---|
| Sidebar nav | 文字 + 左 2px/`soft` 当前态；hover 浅抬，无大投影 |
| Sync chip | 四态色跟 token；失败态带「重试」；`data-sync-state` 保留给测试 |
| Task row | checkbox · 标题 · meta（项目/到期）一行；完成态删线 + muted |
| Section header | 「过期 / 今日」小 caps 或 12px muted + 计数 |
| Primary button | 实心 `--accent`，深字/白字二选一锁对比；禁渐变 |
| Empty | 一句话 + 一个主按钮；无插画 |
| Banner error | 浅红底 + 短错 + 行动 |

## 4. 页面 UI 验收（对齐线框）

| 页 | 必须达到 |
|---|---|
| Shell | 侧栏五入口清晰；芯片全局可见；窄屏不碎 |
| 今日清单 | 过期/今日分组；勾选反馈即时；空态可创建；失败行可感知 |
| 文档库 | 列表+编辑双栏骨架就位（可先静态高保真）；保存态跟芯片 |
| 搜索 | 大输入 + 分组结果；空态有去处 |
| 设置 | Token/ID 表单对齐；校验结果可读；勿把密钥样式做成营销卡 |

## 5. 落点（给工程）

1. 新建 `web/src/styles/tokens.css`（或等价），`App.css` 改为消费 token  
2. Shell / SyncChip / TaskRow 抽成可复用类或小组件  
3. 对照 `SYNC_STATES.md` 四态禁用规则做视觉 + `disabled` 一致  
4. 不改 Notion 契约；UI 只消费已有 `/api/*`

## 6. 不做（红线）

1. 不做多栏仪表盘、图表、英雄区  
2. 不把标签做成彩虹 chip 墙  
3. 不加装饰插画/Lottie 空态  
4. 动效 ≤150ms 色/透明度；不做路由炫技  
5. 不对外发布皮肤；本机可用即可

## 7. 交付顺序（UI）

| 步 | 产出 | 落点 |
|---|---|---|
| ① | 本 Brief（锁 token） | `docs/design/UI_BRIEF_v1.md` |
| ② | token 落地 + Shell 换皮 | `web/src/styles/*` · `App.css` |
| ③ | 今日清单高保真（含空/错/同步态） | `App.tsx` 结构可小改 class，不大拆 IA |
| ④ | 文档/搜索/设置按同一 token 扫平 | 随后 |

负责人（产品/设计总监/工程）若改 IA 或品牌方向，以他们裁定为准；token 表可修订一版，不平行开第二套。

## 8. 过/不过

**过：** 打开不像 Vite 默认模板；今日清单可安静扫完；四态芯片 1 秒可辨；主按钮实心无渐变。  
**不过：** 又堆 glow/大圆角营销风；同步态靠颜色吵闹却说不清能否写入；硬编码色回流。
