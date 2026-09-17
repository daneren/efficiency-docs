# Token 未到位前 · 产品齐套包

日期：2026-09-17  
原则：主动推进；只在缺老板密钥时一次性升级。不改 Notion SoT 决策。

## 1. 已锁（无需老板）

| 项 | 裁定 |
|---|---|
| 形态 | 本机 Web + Notion SoT（A+B） |
| Doc 形态 | **文档根页子页**（不用独立 Doc DB，MVP） |
| 同步四态 | `syncing \| synced \| error \| offline_readonly`（见 `design/SYNC_STATES.md`） |
| 外发 | 不推远程；本机演示 |

## 2. Token 前可齐套（本机）

| 交付 | Owner | 完成定义 |
|---|---|---|
| PRD 验收表可测 | 产品（本文 + PRD §5） | A1–A9 / F1–F3 有 mock 路径说明 |
| 四态 UI | 设计/前端 | 无 Token 默认 `error`；可手动切四态预览 |
| API 契约 | 工程 | 健康检查 + tasks 列表（mock 或空+错误体） |
| 一键起 | 工程 | `npm run install:all && npm run dev` 文档可复制 |
| `.env.local.example` | 工程 | 已钉；与 `NOTION_SETUP.md` 一致 |

## 3. Mock 验收路径（测试可先跑）

| ID | Mock 做法 | 真 Token 后 |
|---|---|---|
| A1 | localhost 打开壳 | 同 |
| A8 | UI 故事/开关打四态 | 接真同步事件 |
| A9 | 注入「offline」标只读 | 断网复测 |
| F1 | 空/错 Token → error 文案 | 同 |
| F2 | mock 写失败 → 失败+可重试 | 真写回 |
| A3–A7 | mock JSON 今日清单/文档/搜索 | 换 Notion 数据 |

**真机门禁（一次性要老板）：** Integration Token + Task DB ID；（可选）文档根页 ID。

## 4. 产品对工程的接口期望（契约摘要）

- `GET /api/health` → ok  
- `GET /api/sync/state` → 四态之一 + 可读 `message`  
- `GET /api/tasks?view=today\|all` → 列表；无鉴权时 401/503 + 不静默  
- Doc 列表：根页 children；编辑后写 blocks（M3）

## 5. 升主管时机

仅当：① 上表齐套且 mock 主路径绿，或 ② **只缺**老板 Token/DB ID。其它过程不打扰老板。
