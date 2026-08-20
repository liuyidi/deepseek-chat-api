# Google OAuth relay (Vercel)

Runs outside mainland China so `mini-auth` on Tencent CVM can exchange Google OAuth
codes without direct access to `oauth2.googleapis.com`.

## Deploy

```bash
cd deploy/google-oauth-relay
npm install
npx vercel link          # once: create or link a Vercel project
npx vercel env pull .env.local   # optional, for local smoke tests
```

Set **Production** environment variables in Vercel (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_RELAY_SHARED_SECRET` | Bearer token for auth.liuyidi.me → relay |
| `GOOGLE_CLIENT_ID` | Same OAuth client as mini-auth |
| `GOOGLE_CLIENT_SECRET` | Same OAuth client as mini-auth |
| `GOOGLE_REDIRECT_URI` | `https://auth.liuyidi.me/api/v1/auth/google/callback` |

Deploy:

```bash
npx vercel deploy --prod
```

Note the production URL, e.g. `https://mini-auth-google-oauth-relay.vercel.app`.

## Wire mini-auth (Tencent `/opt/auth/.env`)

```bash
GOOGLE_RELAY_URL=https://<your-relay-host>/api/google/exchange
GOOGLE_RELAY_SHARED_SECRET=<same as Vercel>
```

Restart API:

```bash
cd /opt/auth
docker compose --env-file .env up -d api
```

When `GOOGLE_RELAY_URL` is set, the API uses the relay instead of calling Google directly.

## Verify

```bash
curl -fsS https://<your-relay-host>/api/health

# Expect 401 without auth:
curl -i -X POST https://<your-relay-host>/api/google/exchange \
  -H 'Content-Type: application/json' \
  -d '{"code":"x","code_verifier":"y"}'
```

After Google login works end-to-end, no further relay changes are needed for normal traffic.

## Security

- Rotate `GOOGLE_RELAY_SHARED_SECRET` if leaked.
- Relay stores Google client credentials only on Vercel; mainland server sends `code` + PKCE verifier only.
- Do not log request bodies or access tokens.
