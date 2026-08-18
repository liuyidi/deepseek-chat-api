---
name: deploying-tencent-mini-auth
description: >-
  Use when the user asks to 发布、部署、更新 mini-auth、auth.liuyidi.me、
  Publish Auth, Tencent CVM auth, or the login SPA. Not for
  bot.liuyidi.me, mlf, kb, Aliyun minibot compose, or serverless-ship.
---

# Tencent mini-auth Deploy（只 auth）

应用已经拆开，**先选仓**。本 skill 只覆盖 auth。

| 域名 | 仓 | 云 | Skill |
|------|----|----|-------|
| `liuyidi.me` / `bot.liuyidi.me` | minibot | 阿里云 ECS | minibot `aliyun-ecs-demo-deploy` |
| `kb.liuyidi.me` | minikb | 火山引擎 | minikb `deploying-volcengine-minikb` |
| `mlf.liuyidi.me` | mini-langfuse | 腾讯云轻量 | mini-langfuse `deploying-tencent-mlf` |
| `auth.liuyidi.me` | mini-auth | 腾讯云 CVM `/opt/auth` | **本文件** |
| `serverless-ship.liuyidi.me` | serverless-ship | Vercel | serverless-ship `deploying-vercel-serverless-ship` |

DNS / TLS 入口可以仍在阿里云 nginx 反代到腾讯云（模板 `deploy/nginx.auth.liuyidi.me.conf.example`）。改反代去阿里云 nginx；改 API / 登录页走本仓。

机上布局：`/opt/auth/`（compose、Caddyfile、`.env`、`frontend-dist/`、`mini-auth/` 代码）。SSH 以本机 `deploy/host.env`（gitignore）为准；没有就读 `.github/workflows/publish-auth-tencent.yml` 的 `AUTH_HOST` / `AUTH_SSH_USER` 默认值。不要把 pem / `.env` 写入 commit。

## 发布（优先）

GitHub Actions → `Publish Auth (Tencent CVM)`（`publish-auth-tencent.yml`）。

- push `main`（`app/` / `frontend/` / `deploy/` 等）或 `workflow_dispatch`
- CI 构建登录 SPA → 上传 `frontend-dist` → `docker compose build api && up -d` → `https://auth.liuyidi.me/health`

## 约定

1. 不要在阿里云 minibot compose 里起 auth。
2. 不要在 mlf 那台腾讯云轻量上起 auth（auth 是另一台 CVM）。
3. minibot 只依赖运行时 `MINIBOT_SERVER_MINI_AUTH_BASE_URL=https://auth.liuyidi.me`。

## 验收

```bash
curl -fsS https://auth.liuyidi.me/health
```

细节见 `deploy/README.md`、`docs/tencent-auth-deploy.md`。
