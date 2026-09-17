# Tech stack (MVP scaffold)

## Decision

| Layer | Choice | Why |
|-------|--------|-----|
| Web UI | Vite + React + TypeScript | Fast local DX; matches wireframe shell |
| Local API | Express (Node) on `:8787` | Hold Notion token server-side; never ship token to browser |
| Notion | `@notionhq/client` + Internal Integration Token | PRD: Notion = source of truth |
| Config | `.env.local` (gitignored) | Token / DB IDs stay on machine |

## Notion integration (required before M1 green)

1. Notion → **My integrations** → New **Internal Integration** → copy token → `NOTION_TOKEN`
2. Open Task database → **⋯ → Connections** → invite the integration
3. Copy database ID from URL → `NOTION_TASK_DB_ID`
4. Same for Doc root page or Doc DB (`NOTION_DOC_ROOT_PAGE_ID` / `NOTION_DOC_DB_ID`)

Auth model for MVP: **local Integration Token only** (no OAuth / multi-user). Later can add OAuth if multi-workspace needed.

## Run locally

```bash
cd efficiency-docs
.env.local.example .env.local   # fill token + ids
npm install                  # root (concurrently)
npm run install:all          # server + web
npm run dev                  # api :8787 + web :5173
```

- Web proxies `/api/*` → `http://localhost:8787`
- **Do not push** remotes / publish until 老板 says so
- Never commit `.env` / `.env.local`

## Milestone map

- **M1 (this scaffold):** health + `/api/notion/ping` read one Task row + shell UI with sync chip
- **M2:** Today list CRUD + sync states (SYNC_STATES.md)
- **M3:** Doc browse/edit (root children or DB)
- **M4:** Search + tags/projects

## Out of scope (locked)

Team permissions, native app, self-hosted KB backend, remote deploy.
