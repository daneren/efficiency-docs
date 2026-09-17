#!/usr/bin/env node
/**
 * 本机冒烟：health +（可选）ping。不打印密钥。
 * 需先 npm run dev；API 默认 :8787
 */
const base = process.env.SMOKE_BASE || "http://localhost:8787";

async function get(pathname) {
  const res = await fetch(`${base}${pathname}`);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

function summarize(label, { status, body }) {
  const sync = body?.syncState ?? "?";
  const ok = body?.ok;
  const err = body?.error ? String(body.error).slice(0, 80) : "";
  console.log(
    `  ${label}: HTTP ${status} ok=${ok} syncState=${sync}${err ? ` error=${err}` : ""}`,
  );
}

try {
  console.log(`efficiency-docs · smoke @ ${base}`);
  const health = await get("/api/health");
  summarize("GET /api/health", health);
  const ping = await get("/api/notion/ping");
  summarize("GET /api/notion/ping", ping);
  const today = await get("/api/tasks/today");
  summarize("GET /api/tasks/today", today);

  // 配置未齐时 error 是预期；服务可达即 smoke 过
  if (health.status >= 500 && health.body?.ok === undefined) {
    console.error("API 无响应体，确认已 npm run dev");
    process.exit(1);
  }
  console.log("smoke 完成（配置未齐时 syncState=error 属预期）");
  process.exit(0);
} catch (e) {
  console.error(`smoke 失败: ${e?.cause?.code || e?.message || e}`);
  console.error("请先在另一终端: npm run install:all && npm run dev");
  process.exit(1);
}
