# API 契约（efficiency-docs · MVP）

对照 `docs/design/SYNC_STATES.md`、`docs/PRD_MVP.md` A3/A8。Token 仅本机 `.env.local`，不进仓库。

## `syncState` 四态

| 值 | 含义 | 典型来源 |
|---|---|---|
| `syncing` | 同步中 | **仅**测试钩子强制；正常成功路径不返回 |
| `synced` | 已与 Notion 成功交互 | health（已配置）/ ping / today 成功 |
| `error` | 配置或 Notion API 业务失败 | Token/DB 缺失、鉴权/权限/查询错误 |
| `offline_readonly` | Notion 网络不可达 | DNS/连接拒绝/超时等；列表为空（缓存未做时） |

所有 JSON 响应均含 `syncState`。失败另含 `error: string`。

## 测试钩子

- Query：`?forceSyncState=syncing|synced|error|offline_readonly`
- 或 Header：`X-Force-Sync-State: <同上>`
- 生效时额外 `forcedSyncState: true`，覆盖业务算出的态（便于前端四态 UI）

## 端点

### `GET /api/health`

- **200** `{ ok: true, syncState, sourceOfTruth:"notion", configured, taskDbId, docRoot, docDb }`
- `configured` = Token 已填且非 placeholder；其余 `*Id`/`doc*` 为布尔「是否已配置」

### `GET /api/notion/ping`（M1）

- **503** 无 Token / placeholder：`{ ok:false, syncState:"error", error, setup:string[] }`
- **503** 无 `NOTION_TASK_DB_ID`：`{ ok:false, syncState:"error", error, configuredToken:true }`
- **200** `{ ok:true, syncState:"synced", hasRow, sample:{id,title,url}|null, message }`
- **502** Notion API 业务错：`syncState:"error"` + `hint`
- **503** 网络不可达：`syncState:"offline_readonly"` + `hint`

### `GET /api/tasks/today`

- **503** 配置缺失：`{ ok:false, syncState:"error", tasks:[], error }`
- **200** `{ ok:true, syncState:"synced", tasks:[{id,title,status,url,due}], today:"YYYY-MM-DD" }`
  - `today` 为 Asia/Shanghai 日历日
  - `due` 为 Notion date.start（可空）
- **502** API 业务错 → `error`；**503** 网络 → `offline_readonly`；均 `tasks:[]`

## 今日清单过滤规则

1. 状态为 done / 完成 / 已完成 / complete / completed → **排除**
2. 日期属性名优先：`Due` / `due` / `Date` / `date` / `日期` / `截止`，否则取第一个 `date` 属性
3. 有 due：`due` 日期（上海日历）**≤ 今天**（含今日与过期）→ **纳入**
4. 无 due：未完成 → **纳入**（可行动）

## 前端对接要点

- 请求进行中由前端自置 `syncing`；服务端成功/失败落地为 `synced` / `error` / `offline_readonly`
- 用钩子验收四态芯片；真 Token 到位后再打 M1 读绿
