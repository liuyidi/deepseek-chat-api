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

## 硬性发布规则（必须遵守）

**所有部署必须：commit → `git push`（到 `main`）→ 由 GitHub Actions workflow 发布。**

- **允许**：commit / push；`gh run list` / `gh run watch`；验收 `https://auth.liuyidi.me/health`。
- **禁止**：本机 `ssh` / `rsync` / `scp` 同步源码或 `frontend-dist`；在 CVM 上手动 `docker compose build/up` 当发布路径；绕过 workflow 的热修。
- **例外**：用户明确要求只读排障（日志）且不是发版时，才可只读 SSH。代码 / SPA 上线仍走 push → workflow。

Workflow：`.github/workflows/publish-auth-tencent.yml`（`Publish Auth (Tencent CVM)`）。

触发：

1. `git push origin main`（命中 `app/` / `alembic/` / `frontend/` / `deploy/` 等）
2. 或：`gh workflow run "Publish Auth (Tencent CVM)" --ref main`

API 容器启动会跑 `alembic upgrade head`（见 `deploy/Dockerfile.ecs`）。机上 `/opt/auth/.env` 由 workflow 保留，不要从本机覆盖进 commit。

## Agent 发布步骤

```bash
git status -sb
git push -u origin HEAD

gh workflow run "Publish Auth (Tencent CVM)" --ref main   # 若 push 未自动触发
gh run list --workflow "Publish Auth (Tencent CVM)" --limit 3
gh run watch
```

## 验收

```bash
curl -fsS https://auth.liuyidi.me/health
curl -fsS -o /dev/null -w "login %{http_code}\n" https://auth.liuyidi.me/login
```

## 约定

1. 不要在阿里云 minibot compose 里起 auth。
2. 不要在 mlf 那台腾讯云轻量上起 auth。
3. minibot 只依赖 `MINIBOT_SERVER_MINI_AUTH_BASE_URL=https://auth.liuyidi.me`。
4. 不要把 pem / 生产 `.env` 写入 commit。

细节见 `deploy/README.md`、`docs/tencent-auth-deploy.md`。
