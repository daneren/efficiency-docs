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

### `GET /api/tasks/all`

- **503** 配置缺失：`{ ok:false, syncState:"error", tasks:[], error }`
  - Token 缺失：`error:"NOTION_TOKEN missing"`
  - DB ID 缺失：`error:"NOTION_TASK_DB_ID missing"`
- **200** `{ ok:true, syncState:"synced", tasks:[{id,title,status,url,due}] }`
  - 任务数组含所有非完成任务（**无日期过滤**）
  - 同 `/api/tasks/today` 形状：`{id,title,status,url,due}`
  - `due` 为 Notion date.start（可空）
- **502** API 业务错 → `error`；**503** 网络 → `offline_readonly`；均 `tasks:[]`

#### 全任务过滤规则

- 状态为 done / 完成 / 已完成 / complete / completed → **排除**
- 其余任务（无论 due 日期）→ **纳入**

## 今日清单过滤规则

### Doc 存根端点（A5 骨架验收）

**说明：** `/api/docs` 与 `/api/docs/:id` 当前返回硬编码存根数据，用于前端骨架开发。真实 Notion Doc 根页/DB 读取与 blocks→Markdown 转换将在后续实现。

#### `GET /api/docs`

- **200** `{ ok:true, syncState:"synced", stub:true, docs:[{id,title,updatedAt}] }`
  - `docs` 数组含 2–3 条示例文档（id / title / updatedAt）
  - `stub:true` 标识为存根；前端据此显示「存根数据」提示
  - `updatedAt` 为 ISO 8601 时间戳
  - 仍支持 `forceSyncState` 钩子

#### `GET /api/docs/:id`

- **200** `{ ok:true, syncState:"synced", stub:true, id, title, updatedAt, bodyMarkdown }`
  - 已知 id（存根列表中之一）时返回详情
  - `bodyMarkdown` 为 Markdown 格式正文示例
  - 仍支持 `forceSyncState` 钩子
- **404** `{ ok:false, syncState:"error", stub:true, error:"doc not found" }`
  - 未知 id 时返回 404
  - 仍支持 `forceSyncState`（可测四态芯片）

---

## 今日清单过滤规则（`/api/tasks/today`）

1. 状态为 done / 完成 / 已完成 / complete / completed → **排除**
2. 日期属性名优先：`Due` / `due` / `Date` / `date` / `日期` / `截止`，否则取第一个 `date` 属性
3. 有 due：`due` 日期（上海日历）**≤ 今天**（含今日与过期）→ **纳入**
4. 无 due：未完成 → **纳入**（可行动）

## 前端对接要点

- 请求进行中由前端自置 `syncing`；服务端成功/失败落地为 `synced` / `error` / `offline_readonly`
- 用钩子验收四态芯片；真 Token 到位后再打 M1 读绿
