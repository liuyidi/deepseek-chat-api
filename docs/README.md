# mini-auth docs

| 文档 | 说明 |
|------|------|
| [auth-platform-design.md](./auth-platform-design.md) | 身份平台设计（手机/微信/邮箱、JWT、与 minibot 对接） |
| [tencent-auth-deploy.md](./tencent-auth-deploy.md) | 腾讯云 `auth.liuyidi.me` 部署（Docker / Caddy / 境内镜像） |

### 证书

auth.liuyidi.me 已成功签发新证书
证书路径是：[fullchain.pem](/etc/letsencrypt/live/auth.liuyidi.me/fullchain.pem)
[privkey.pem](/etc/letsencrypt/live/auth.liuyidi.me/privkey.pem)

Certbot 已经把证书部署到 /etc/nginx/sites-enabled/liuyidi-demo
HTTPS 已启用，证书有效期到 2026-11-11