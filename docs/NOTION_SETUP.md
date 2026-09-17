# Notion 填写说明（M1）

## 老板要填什么

复制示例后只改本机文件（勿提交、勿推远程）：

```bash
cp .env.local.example .env.local
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `NOTION_TOKEN` | 是 | Internal Integration Secret |
| `NOTION_TASK_DB_ID` | 是 | Task 数据库 32 位 ID |
| `NOTION_DOC_ROOT_PAGE_ID` | 否 | 文档根页（推荐：根页子页） |
| `NOTION_DOC_DB_ID` | 否 | 仅当 Doc 用数据库而非根页 |
| `PORT` | 否 | API 默认 `8787` |

## 步骤

1. Notion → **My integrations** → New **Internal** → 复制 token → `NOTION_TOKEN`
2. 打开 Task DB → **⋯ → Connections** → 邀请该 Integration
3. 从浏览器 URL 复制 DB id → `NOTION_TASK_DB_ID`
4. （可选）文档根页同样邀请 Integration → `NOTION_DOC_ROOT_PAGE_ID`
5. 重启：`npm run dev`
6. 打开 Web「设置」点 **M1：鉴权并读一条**，或 `curl localhost:8787/api/notion/ping`

## 同步四态（对照 `docs/design/SYNC_STATES.md`）

`syncing | synced | error | offline_readonly`  
无 Token / 配置错误 → UI 同步芯片应为 **error**（失败）。

## 安全

- Token 只留本机 `.env.local`
- 仓库已忽略 `.env` / `.env.local`
- 先不推远程
