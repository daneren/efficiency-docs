import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@notionhq/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

// Load .env then .env.local (local overrides)
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const PORT = Number(process.env.PORT || 8787);
const SYNC_STATES = new Set([
  "syncing",
  "synced",
  "error",
  "offline_readonly",
]);
const DONE_STATUSES = new Set(["done", "完成", "已完成", "complete", "completed"]);
const DUE_PROP_NAMES = ["Due", "due", "Date", "date", "日期", "截止"];

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function getNotion() {
  const token = process.env.NOTION_TOKEN;
  if (!token || token.startsWith("secret_xxx") || token === "secret_xxx") {
    return null;
  }
  return new Client({ auth: token });
}

/** Dev/UI test hook: ?forceSyncState=syncing|synced|error|offline_readonly */
function forcedSyncState(req) {
  const q = req.query?.forceSyncState;
  const h = req.get("X-Force-Sync-State");
  const raw = (typeof q === "string" && q) || (typeof h === "string" && h) || "";
  return SYNC_STATES.has(raw) ? raw : null;
}

function applyForce(req, body) {
  const forced = forcedSyncState(req);
  if (forced) return { ...body, syncState: forced, forcedSyncState: true };
  return body;
}

function syncMeta(extra = {}) {
  const notion = getNotion();
  return {
    syncState: notion ? "synced" : "error",
    sourceOfTruth: "notion",
    configured: Boolean(notion),
    taskDbId: Boolean(process.env.NOTION_TASK_DB_ID),
    docRoot: Boolean(process.env.NOTION_DOC_ROOT_PAGE_ID),
    docDb: Boolean(process.env.NOTION_DOC_DB_ID),
    ...extra,
  };
}

function isNetworkError(err) {
  const code = err?.code || err?.cause?.code || "";
  const msg = String(err?.message || err || "").toLowerCase();
  const networkCodes = new Set([
    "ENOTFOUND",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENETUNREACH",
    "UND_ERR_CONNECT_TIMEOUT",
  ]);
  if (networkCodes.has(code)) return true;
  if (networkCodes.has(err?.cause?.code)) return true;
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("getaddrinfo") ||
    msg.includes("socket hang up") ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  );
}

function failureSyncState(err) {
  return isNetworkError(err) ? "offline_readonly" : "error";
}

function todayYmdShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDueProp(props) {
  for (const name of DUE_PROP_NAMES) {
    if (props[name]?.type === "date") return props[name];
  }
  return Object.values(props).find((p) => p?.type === "date") || null;
}

function extractStatus(props) {
  const statusProp =
    props.Status ||
    props.status ||
    Object.values(props).find((p) => p.type === "status" || p.type === "select");
  if (statusProp?.type === "status") return statusProp.status?.name || "";
  if (statusProp?.type === "select") return statusProp.select?.name || "";
  return "";
}

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || "").trim().toLowerCase()) ||
    DONE_STATUSES.has(String(status || "").trim());
}

/** Today list rule (PRD A3): due=today OR overdue, not done; no due → include if not done. */
function includeInToday(page, todayYmd) {
  const props = page.properties || {};
  const status = extractStatus(props);
  if (isDoneStatus(status)) return false;

  const dueProp = getDueProp(props);
  const start = dueProp?.date?.start || null;
  if (!start) return true; // no due: actionable undoned

  const dueDay = String(start).slice(0, 10); // YYYY-MM-DD
  return dueDay <= todayYmd; // today or overdue
}

function mapTask(page) {
  const props = page.properties || {};
  const titleProp = Object.values(props).find((p) => p.type === "title");
  const title =
    titleProp?.title?.map((t) => t.plain_text).join("") || "(untitled)";
  const status = extractStatus(props);
  const dueProp = getDueProp(props);
  const due = dueProp?.date?.start || null;
  return { id: page.id, title, status, url: page.url, due };
}

app.get("/api/health", (req, res) => {
  res.json(applyForce(req, { ok: true, ...syncMeta() }));
});

/** M1: auth + read one task (or diagnose config) */
app.get("/api/notion/ping", async (req, res) => {
  const notion = getNotion();
  if (!notion) {
    return res.status(503).json(
      applyForce(req, {
        ok: false,
        syncState: "error",
        error: "NOTION_TOKEN missing. Set it in .env.local (see .env.example).",
        setup: [
          "1. Create Notion Internal Integration → copy token",
          "2. Share Task DB (and Doc root/DB) with the integration",
          "3. Put NOTION_TOKEN + NOTION_TASK_DB_ID in .env.local",
          "4. Restart API (npm run dev)",
        ],
      })
    );
  }

  const dbId = process.env.NOTION_TASK_DB_ID;
  if (!dbId) {
    return res.status(503).json(
      applyForce(req, {
        ok: false,
        syncState: "error",
        error: "NOTION_TASK_DB_ID missing",
        configuredToken: true,
      })
    );
  }

  try {
    const q = await notion.databases.query({
      database_id: dbId.replace(/-/g, ""),
      page_size: 1,
    });
    const page = q.results[0] || null;
    let sample = null;
    if (page) {
      const props = page.properties || {};
      const titleProp =
        Object.values(props).find((p) => p.type === "title") || null;
      const title =
        titleProp?.title?.map((t) => t.plain_text).join("") || "(untitled)";
      sample = { id: page.id, title, url: page.url };
    }
    res.json(
      applyForce(req, {
        ok: true,
        syncState: "synced",
        hasRow: Boolean(page),
        sample,
        message: page
          ? "M1 OK: token + Task DB readable"
          : "M1 OK: DB reachable but empty (add one Task row in Notion)",
      })
    );
  } catch (err) {
    const syncState = failureSyncState(err);
    res.status(syncState === "offline_readonly" ? 503 : 502).json(
      applyForce(req, {
        ok: false,
        syncState,
        error: err?.message || String(err),
        hint:
          syncState === "offline_readonly"
            ? "Notion unreachable; UI should stay offline_readonly (cache if any)"
            : "Check token, DB id, and that the integration is invited to the DB",
      })
    );
  }
});

/** Today list: due=today/overdue or undated actionable; exclude done */
app.get("/api/tasks/today", async (req, res) => {
  const notion = getNotion();
  if (!notion) {
    return res.status(503).json(
      applyForce(req, {
        ok: false,
        syncState: "error",
        tasks: [],
        error: "NOTION_TOKEN missing",
      })
    );
  }
  const dbId = process.env.NOTION_TASK_DB_ID;
  if (!dbId) {
    return res.status(503).json(
      applyForce(req, {
        ok: false,
        syncState: "error",
        tasks: [],
        error: "NOTION_TASK_DB_ID missing",
      })
    );
  }

  try {
    const q = await notion.databases.query({
      database_id: dbId.replace(/-/g, ""),
      page_size: 50,
    });
    const todayYmd = todayYmdShanghai();
    const tasks = q.results
      .filter((page) => includeInToday(page, todayYmd))
      .map(mapTask);
    res.json(
      applyForce(req, {
        ok: true,
        syncState: "synced",
        tasks,
        today: todayYmd,
      })
    );
  } catch (err) {
    const syncState = failureSyncState(err);
    res.status(syncState === "offline_readonly" ? 503 : 502).json(
      applyForce(req, {
        ok: false,
        syncState,
        tasks: [],
        error: err?.message || String(err),
      })
    );
  }
});

/** Stub: list docs (A5 skeleton; no real Notion Doc read yet) */
const STUB_DOCS = [
  {
    id: "doc-001",
    title: "产品路线图 2026 Q3-Q4",
    updatedAt: "2026-09-15T08:30:00.000Z",
  },
  {
    id: "doc-002",
    title: "团队周报模板",
    updatedAt: "2026-09-10T14:22:00.000Z",
  },
  {
    id: "doc-003",
    title: "开发规范与代码审查清单",
    updatedAt: "2026-09-01T10:15:00.000Z",
  },
];

app.get("/api/docs", (req, res) => {
  res.json(
    applyForce(req, {
      ok: true,
      syncState: "synced",
      stub: true,
      docs: STUB_DOCS,
    })
  );
});

app.get("/api/docs/:id", (req, res) => {
  const { id } = req.params;
  const doc = STUB_DOCS.find((d) => d.id === id);

  if (!doc) {
    return res.status(404).json(
      applyForce(req, {
        ok: false,
        syncState: "error",
        stub: true,
        error: "doc not found",
      })
    );
  }

  res.json(
    applyForce(req, {
      ok: true,
      syncState: "synced",
      stub: true,
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      bodyMarkdown: `# ${doc.title}\n\n这是存根数据。Notion Doc 真实读取将在后续实现。\n\n## 示例章节\n\n- 要点一\n- 要点二\n- 要点三\n\n**注意：** 此内容为前端骨架验收用的硬编码数据。`,
    })
  );
});

app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}`);
  console.log(
    `[api] Notion token: ${getNotion() ? "set" : "MISSING — edit .env.local"}`
  );
});
