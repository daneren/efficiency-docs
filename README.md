# 效率文档工具（MVP scaffold）

本机 Web + Notion 为 source of truth。见 `docs/PRD_MVP.md`、`docs/TECH_STACK.md`、`docs/design/*`。

## 快速启动

```bash
cp .env.local.example .env.local   # 填 NOTION_TOKEN / NOTION_TASK_DB_ID
npm run setup                      # 或: npm install && npm run install:all
npm run check:env                  # 配置未齐自检（不打印密钥）
npm run dev
```

配置自检失败时同步态应为 **error**；服务起来后可另开终端 `npm run smoke`。

- Web: http://localhost:5173  
- API: http://localhost:8787  
- M1 验收：设置页 →「鉴权并读一条」，或 `curl localhost:8787/api/notion/ping`

**勿推远程、勿提交 token。**

填写说明见 `docs/NOTION_SETUP.md`；示例文件：`.env.local.example`。
