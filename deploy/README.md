# mini-auth deploy assets (Tencent CVM)

Aligned with [`docs/auth-platform-design.md`](../docs/auth-platform-design.md) §9 / §14 and
[`docs/tencent-auth-deploy.md`](../docs/tencent-auth-deploy.md).

## Layout on server (`/opt/auth`)

```text
/opt/auth/
  docker-compose.yml   ← copy from deploy/docker-compose.yml
  Caddyfile            ← copy from deploy/Caddyfile
  frontend-dist/       ← build output from frontend/apps/web/dist
  .env                 ← from deploy/.env.example (secrets)
  mini-auth/           ← git clone of this repo (build context)
```

## Services

| Service | Image (DaoCloud) | Role |
|---------|------------------|------|
| `caddy` | `library/caddy:2` | Static frontend + reverse proxy → `api:8000` |
| `api` | build `Dockerfile.ecs` | FastAPI mini-auth |
| `db` | `library/postgres:16` | Persistent identity / sessions |
| `redis` | `library/redis:7-alpine` | OTP, OAuth state, PKCE, rate limit |

Postgres / Redis are on the compose `internal` network only (no host ports).

`/login` and `/login/email` are served by the frontend SPA from `frontend-dist`.
OIDC, discovery and API routes still proxy to FastAPI.

## Quick start

```bash
cd /opt/auth
cp mini-auth/deploy/docker-compose.yml .
cp mini-auth/deploy/Caddyfile .
cp mini-auth/deploy/.env.example .env
# edit .env — strong POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, CADDY_ACME_EMAIL

cd /path/to/local/mini-auth
npm run build -w @mini-auth/web
ssh -i deploy/tencent_cloud.pem ubuntu@<TENCENT_PUBLIC_IP> 'mkdir -p /opt/auth/frontend-dist'
rsync -a --delete frontend/apps/web/dist/ ubuntu@<TENCENT_PUBLIC_IP>:/opt/auth/frontend-dist/

docker compose pull db redis caddy
docker compose build api
docker compose up -d
docker compose ps
curl -fsS https://auth.liuyidi.me/health
```

邮件验证码生产配置建议：

```bash
EMAIL_PROVIDER=aliyun_directmail
EMAIL_FROM=Minibot <noreply@mail.liuyidi.me>
EMAIL_SENDER_DOMAIN=mail.liuyidi.me
EMAIL_SENDER_ACCOUNT=noreply
EMAIL_FROM_ALIAS=Minibot
EMAIL_TEMPLATE_LOGIN_CODE=auth_login_code
EMAIL_SERVICE_API_KEY=<Aliyun AccessKey ID>
EMAIL_SERVICE_SECRET=<Aliyun AccessKey Secret>
EMAIL_SERVICE_REGION=cn-hangzhou
EMAIL_DEBUG_RETURN_CODE=false
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Full stack |
| `Dockerfile.ecs` | CN-friendly API image |
| `Caddyfile` | Static frontend + API proxy |
| `nginx.auth.liuyidi.me.conf.example` | Aliyun nginx reverse proxy template |
| `setup-docker-mirror.sh` | DaoCloud registry mirrors |
| `.env.example` | Env template |
| `host.env.example` | Local SSH hints (copy to gitignored `host.env`) |
