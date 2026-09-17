# efficiency-docs · 功能测试用例（主路径 / 边界）

日期：2026-09-17  
对照：`docs/PRD_MVP.md` §5、`docs/design/SYNC_STATES.md`、`docs/API_CONTRACT.md`、`docs/PRODUCT_READY_NO_TOKEN.md`  
环境：Web `http://localhost:5173` · API `http://localhost:8787`  
归属：@功能测试  
不测（交割）：无 Token 失败态契约/可读性 → @接口测试 / @体验测试；演示翻车点 → @体验测试；冒烟清单维护 → @回归测试

四态约定：`syncing | synced | error | offline_readonly`

---

## 预置

| 项 | 说明 |
|---|---|
| P0-无 Token | 无 `.env.local` 或 Token 为空/placeholder；默认预期 `error`（详测归接口/体验） |
| P1-有 Token | 有效 Integration Token + Task DB ID；（可选）文档根页 ID |
| 钩子 | `?forceSyncState=` 或 `X-Force-Sync-State` 可强制四态 |

---

## A. 壳与启动（主路径）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-A1 | `npm run setup && npm run dev`，打开 :5173 | 壳子可达，侧栏/顶栏见：今日清单、全部任务、文档库、搜索、设置 | P0 | Y |
| ED-A1b | `npm run check:env`（配置未齐） | 自检失败且**不打印密钥**；同步态可落到 error | P0 | Y |
| ED-A1c | 配置齐后 `curl localhost:8787/api/health` | 200，`ok:true`，含 `syncState`、`configured` | P0 | Y |

## B. 鉴权与设置（主路径 · 有 Token）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-B1 | 设置页保存有效 Token + Task DB，点「鉴权并读一条」或 `GET /api/notion/ping` | 200，`syncState=synced`，`hasRow` 真/假均可；有样例则 title 可读 | P0 | Y |
| ED-B2 | 仅 Token、缺 Task DB ID，再 ping | 503，`syncState=error`，`configuredToken:true`，错误可读 | P0 | Y |
| ED-B3 | Token 存本机后查仓库 | 无 Token 进 git；`.env.local` 被 ignore | P0 | Y |

## C. 今日清单 / 任务（主路径 + 边界）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-C1 | 有 Token：打开今日清单 / `GET /api/tasks/today` | 200，`syncState=synced`；`today` 为 Asia/Shanghai 日；任务含 id/title/status/due | P0 | Y |
| ED-C2 | 勾选一条未完成任务为完成 | UI 更新；Notion 侧 status→done；芯片短暂 syncing→synced | P0 | Y |
| ED-C3 | 创建任务（标题必填）并设 due=今天 | Notion 可见；今日清单出现 | P0 | Y |
| ED-C4 | 改标题 / 改期 / 改标签或项目 | Notion 属性同步；失败则见 error+可重试（详 F 交接口） | P0 | Y |
| ED-C5 **边界** | due=今天未 done | 纳入今日清单 | P0 | Y |
| ED-C6 **边界** | due=昨天未 done（过期） | 纳入今日清单 | P0 | Y |
| ED-C7 **边界** | due=明天未 done | **不**纳入今日（应在全部任务可见） | P0 | N |
| ED-C8 **边界** | 无 due 且未 done | 纳入今日（可行动） | P0 | N |
| ED-C9 **边界** | status=done（含 完成/已完成/complete/completed） | 排除今日清单 | P0 | Y |
| ED-C10 **边界** | 标题为空提交创建 | 前端拦截或明确错误；不写脏数据 | P0 | N |
| ED-C11 | 全部任务：按项目 / 标签筛选 | 列表仅匹配项；清空筛选恢复 | P0 | N |

## D. 文档（主路径 + 边界）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-D1 | 文档库列出根页子页 | 至少可见配置的根下文档（有 Token+根页） | P0 | Y |
| ED-D2 | 打开一篇，编辑正文，保存 | Notion 页 blocks 更新；synced | P0 | Y |
| ED-D3 **边界** | 未配置文档根页 | 设置/启动提示映射缺口（F3）；不静默空成功 | P0 | N |
| ED-D4 **边界** | 保存中途断网（可 mock） | error + 保留编辑稿提示；可重试（与接口对齐） | P0 | Y |

## E. 搜索 / 筛选（主路径 + 边界）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-E1 | 搜索已知任务标题关键词 | 命中该任务 | P0 | Y |
| ED-E2 | 搜索已知文档标题 | 至少标题命中 | P0 | Y |
| ED-E3 **边界** | 搜索无匹配词 | 空结果明确，非报错页 | P0 | N |
| ED-E4 **边界** | 超长 / 特殊字符关键词 | 不崩溃；可空结果 | P1 | N |

## F. 同步四态（主路径挂钩 · UI 可见）

> 失败契约细节归 @接口测试；可读性/演示归 @体验测试。此处只卡「主路径能看见对的态」。

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-F1 | 有 Token 成功拉今日 | 芯片 `synced`（或等价文案「已同步」） | P0 | Y |
| ED-F2 | 请求进行中（前端） | 可见 `syncing` | P0 | N |
| ED-F3 | `forceSyncState=offline_readonly` | 芯片离线只读；写/勾选禁用 | P0 | Y |
| ED-F4 | `forceSyncState=error` | 失败+重试入口可见 | P0 | Y |
| ED-F5 | 无缓存 + offline | 明确空态（非白屏）——空态文案细调归体验 | P1 | N |

## G. 门禁结论模板

| 项 | 填 |
|---|---|
| 构建/端口 | :5173 / :8787 |
| A1–A9 主路径 | 通过 / 阻塞（列 ID） |
| 边界 ED-C5–C10 / D3–D4 / E3 | 通过 / 残留 |
| 已知缺陷 | |
| **放行建议** | 不放行外发；本机演示仅当阻断项全绿且内容门禁过 |

