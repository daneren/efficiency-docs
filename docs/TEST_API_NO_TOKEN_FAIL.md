# efficiency-docs · 接口测试用例（无 Token / 鉴权失败态）

日期：2026-09-17  
对照：`docs/API_CONTRACT.md`、`docs/PRODUCT_READY_NO_TOKEN.md`、`docs/design/SYNC_STATES.md`、`docs/PRD_MVP.md` F1–F3  
环境：API `http://localhost:8787`（壳 `:5173` 仅作联动核对，可读性归 @体验测试）  
归属：@接口测试  
不测（交割）：有 Token 主路径/边界 → @功能测试；空态/演示文案 → @体验测试；冒烟清单 → @回归测试

四态约定：`syncing | synced | error | offline_readonly`  
原则：失败不静默；JSON 必含 `syncState`；失败另含 `error: string`；响应体**不泄露**真实 Token。

---

## 预置

| 项 | 说明 |
|---|---|
| P0-无 Token | 无 `.env.local`，或 `NOTION_TOKEN` 为空 / `secret_xxx` placeholder |
| P0-缺 DB | Token 有效形态但缺 `NOTION_TASK_DB_ID`（可用假 Token 形状 + 空 DB，或临时注释 DB；勿把真密钥写进用例） |
| P1-坏凭据 | 非 placeholder 的无效 Token + 已填 DB（触发 Notion 业务错 → 502/`error`） |
| 钩子 | `?forceSyncState=` 或 `X-Force-Sync-State`；生效时 `forcedSyncState: true` |

可复现冒烟（无 Token）：

```bash
# 确保未配置有效 Token 后起 API，再：
curl -sS http://localhost:8787/api/health | tee /tmp/ed-health.json
curl -sS -o /tmp/ed-ping.json -w '%{http_code}\n' http://localhost:8787/api/notion/ping
curl -sS -o /tmp/ed-today.json -w '%{http_code}\n' http://localhost:8787/api/tasks/today
```

---

## A. Health（配置可见、不冒充成功）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-API-A1 | 无 Token：`GET /api/health` | **200**；`ok:true`；`syncState:"error"`；`configured:false`；含 `sourceOfTruth:"notion"` | P0 | Y |
| ED-API-A2 | 无 Token：响应字段 | 含布尔 `taskDbId` / `docRoot` / `docDb`；**无** Token 明文 | P0 | Y |
| ED-API-A3 | `GET /api/health?forceSyncState=offline_readonly` | 200；`syncState:"offline_readonly"`；`forcedSyncState:true` | P0 | N |

## B. Ping（无 Token / 缺 DB / 业务错 / 网络）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-API-B1 | 无 Token：`GET /api/notion/ping` | **503**；`ok:false`；`syncState:"error"`；`error` 可读（含 Token/setup 指引）；含 `setup:string[]` | P0 | Y |
| ED-API-B2 | Token placeholder（`secret_xxx`）：同 B1 | 同 B1（按无 Token 处理） | P0 | Y |
| ED-API-B3 | 有 Token、缺 `NOTION_TASK_DB_ID` | **503**；`ok:false`；`syncState:"error"`；`configuredToken:true`；`error` 含 DB 缺失 | P0 | Y |
| ED-API-B4 | 无效 Token + 已填 DB（Notion 拒） | **502**；`ok:false`；`syncState:"error"`；含 `hint`（鉴权/邀请类） | P0 | Y |
| ED-API-B5 | 网络不可达（断网 / mock DNS） | **503**；`syncState:"offline_readonly"`；含 `hint` | P0 | Y |
| ED-API-B6 | 响应体 | 永不回显完整 Token；日志侧亦不打印密钥 | P0 | Y |

## C. Today 列表失败契约

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-API-C1 | 无 Token：`GET /api/tasks/today` | **503**；`ok:false`；`syncState:"error"`；`tasks:[]`；`error` 非空 | P0 | Y |
| ED-API-C2 | 缺 Task DB ID | **503**；`ok:false`；`syncState:"error"`；`tasks:[]` | P0 | Y |
| ED-API-C3 | Notion 业务错 | **502**；`syncState:"error"`；`tasks:[]`；`error` 非空 | P0 | Y |
| ED-API-C4 | 网络不可达 | **503**；`syncState:"offline_readonly"`；`tasks:[]` | P0 | Y |
| ED-API-C5 | 失败时不返回假成功列表 | 不得 `ok:true` + 空列表冒充已同步 | P0 | Y |

## D. 四态钩子（契约强制覆盖）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-API-D1 | 无 Token ping + `?forceSyncState=synced` | 仍失败路径语义下可被钩子覆盖 `syncState`；`forcedSyncState:true`（便于前端芯片） | P0 | N |
| ED-API-D2 | Header `X-Force-Sync-State: error` | 与 query 等价 | P0 | N |
| ED-API-D3 | 非法 force 值 | 忽略钩子，走业务算出的态 | P1 | N |

## E. 与产品失败项对齐（PRD F1–F3 · 接口侧）

| ID | 步骤 | 预期 | 优先级 | 阻断 |
|---|---|---|---|---|
| ED-API-E1 **F1** | 无效/缺失 Token 调 ping / today | 明确 `error` + `syncState:error`；不静默 200 成功体 | P0 | Y |
| ED-API-E2 **F2** | （有写接口后）写回失败 | `error` + 可重试语义；不静默丢稿（写端点落地后补 curl） | P1 | Y |
| ED-API-E3 **F3** | 缺 DB / 映射 | ping 503 + `configuredToken` 或明确 DB 缺失错误；不静默空成功 | P0 | Y |

## F. 门禁结论模板

| 项 | 填 |
|---|---|
| 构建/端口 | :8787 |
| 预置 | 无 Token / 缺 DB /（可选）坏凭据 |
| B1–B3 / C1–C2 / E1 E3 | 通过 / 阻塞（列 ID） |
| B4–B5 / C3–C4 | 通过 / 残留 / 未跑 |
| 已知缺陷 | |
| **放行建议** | 无 Token 失败契约未绿 → **不放行**本机演示中的「同步成功」话术；外发一律不放行 |

