#!/usr/bin/env node
/**
 * 配置未齐自检：只报缺什么，不打印密钥值。
 * 与 server getNotion() 占位判定对齐。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath, into) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    into[k] = v;
  }
}

const env = {};
loadEnvFile(path.join(root, ".env"), env);
loadEnvFile(path.join(root, ".env.local"), env); // local overrides

const token = env.NOTION_TOKEN || "";
const taskDb = env.NOTION_TASK_DB_ID || "";
const tokenOk =
  Boolean(token) &&
  !token.startsWith("secret_xxx") &&
  token !== "secret_xxx";
const taskDbOk = Boolean(taskDb.trim());

const missing = [];
if (!tokenOk) missing.push("NOTION_TOKEN（缺失或仍为占位 secret_xxx…）");
if (!taskDbOk) missing.push("NOTION_TASK_DB_ID");

const optional = [];
if (!(env.NOTION_DOC_ROOT_PAGE_ID || "").trim()) {
  optional.push("NOTION_DOC_ROOT_PAGE_ID（可选）");
}
if (!(env.NOTION_DOC_DB_ID || "").trim()) {
  optional.push("NOTION_DOC_DB_ID（可选，MVP 可空）");
}

console.log("efficiency-docs · 配置自检");
console.log(
  `  .env.local: ${fs.existsSync(path.join(root, ".env.local")) ? "存在" : "缺失（可从 .env.local.example 复制）"}`,
);
console.log(`  NOTION_TOKEN: ${tokenOk ? "已配置" : "未齐"}`);
console.log(`  NOTION_TASK_DB_ID: ${taskDbOk ? "已配置" : "未齐"}`);
console.log(`  PORT: ${env.PORT || "8787（默认）"}`);
if (optional.length) {
  console.log(`  可选未填: ${optional.join("；")}`);
}

if (missing.length) {
  console.log("");
  console.log("配置未齐 → 同步态应为 error。填写说明: docs/NOTION_SETUP.md");
  for (const m of missing) console.log(`  - ${m}`);
  process.exit(1);
}

console.log("");
console.log("配置已齐。下一步: npm run dev，再 curl localhost:8787/api/notion/ping");
process.exit(0);
