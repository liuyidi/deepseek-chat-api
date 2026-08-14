# mini-auth

统一身份认证服务（原 deepseek-chat-api）。公网：`https://auth.liuyidi.me`。

FastAPI：注册 / 登录 / GitHub OAuth / JWT 刷新 / 登出。演进规划见 docs。

## 文档

- [auth.liuyidi.me 第一版设计](docs/auth-platform-design.md)
- [腾讯云部署](docs/tencent-auth-deploy.md)

## 技术栈

- FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL
- JWT（access + refresh）
- Alembic 迁移
- 生产：腾讯云 CVM + Docker Compose + Caddy

## 本地开发

### 1. 启动 PostgreSQL

```bash
docker run --name mini-auth-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mini_auth \
  -p 5432:5432 -d postgres:16
```

### 2. 安装依赖

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mini_auth
```

### 3. 迁移 & 启动

```bash
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

文档：http://127.0.0.1:8000/docs

启动后会自动补一个本地 demo OIDC client：

- `client_id`: `minibot`
- `redirect_uri`: `http://127.0.0.1:8000/oidc/demo/callback`

可直接走这条链路验证完整登录和鉴权：

1. 打开 `http://127.0.0.1:8000/oidc/demo`
2. 如果没有账号，先点登录页里的“去注册”
3. 注册或登录后回到 OIDC demo
4. 点击 `Start OIDC Demo`
5. 在 callback 页查看 `authorize -> token -> userinfo` 结果

## API（当前）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 `{ email, password, nickname? }` |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 `{ refresh_token }` |
| POST | `/api/v1/auth/logout` | 登出 `{ refresh_token }` |
| GET | `/api/v1/auth/github/start` | 发起 GitHub 登录（配置启用后） |
| GET | `/api/v1/auth/github/callback` | GitHub OAuth 回调 |
| GET | `/api/v1/me` | 当前用户信息 |
| GET | `/login` | 登录页 |
| GET | `/register` | 注册页 |
| GET | `/oidc/demo` | 本地 OIDC demo 入口 |
| POST | `/api/v1/admin/clients` | 注册 OIDC 客户端 |
| GET | `/api/v1/admin/clients` | 查看 OIDC 客户端 |
| GET | `/health` | 健康检查 |

## 生产部署

见 [`docs/tencent-auth-deploy.md`](docs/tencent-auth-deploy.md) 与 [`deploy/`](deploy/)。

## 环境变量

见 [`.env.example`](.env.example) 与 [`deploy/.env.example`](deploy/.env.example)。
