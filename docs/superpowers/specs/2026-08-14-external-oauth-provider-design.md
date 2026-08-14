# External OAuth Provider 设计

## 1. 目标

为 `mini-auth` 建立可复用的外部身份登录底座，并以 GitHub 作为第一个实现。后续接入 Google、微信等第三方时，只新增 provider adapter、配置和显式路由，不重复设计账号绑定、OAuth 临时状态、会话签发与错误处理。

本期交付 GitHub Web OAuth 登录；微信仍保持关闭，等待开放平台资质齐备后接入。

## 2. 范围

本期包含：

- GitHub Authorization Code 登录并使用 PKCE。
- 通用外部身份模型与 provider adapter 接口。
- 通用 OAuth flow orchestration service。
- 首次 GitHub 登录创建本地用户。
- 已绑定 GitHub 身份重复登录。
- 已有同邮箱账号的安全冲突处理。
- 登录成功后签发既有 mini-auth access/refresh token。
- GitHub 登录按钮按配置启用。
- 安全回跳、稳定错误码和自动化测试。

本期不包含：

- 已有账号主动绑定或解绑 GitHub 的设置页面和接口。
- Google、微信 provider 的具体实现。
- 长期保存或刷新 GitHub access token。
- GitHub 仓库、组织等业务授权。
- Redis。首版 OAuth 临时状态使用短期签名 HttpOnly Cookie；未来多实例或更严格的一次性消费需求可迁移到 Redis，而不改变 provider 接口。

## 3. 架构边界

`mini-auth` 同时扮演两个不同角色：

- 对业务客户端，它是 OIDC Identity Provider / Authorization Server。
- 对 GitHub、Google、微信，它是 OAuth client / relying party。

外部 provider 登录只负责确认用户身份，随后仍由现有 token service 签发 mini-auth 会话和 token。不得将 GitHub access token 作为 mini-auth token，也不得将 provider secret 暴露给前端。

内部拆分为四个单一职责单元：

1. `ExternalAuthProvider`：封装 provider 协议差异，包括授权 URL、code 换 token、获取并归一化身份。
2. `ExternalAuthFlowService`：生成和校验 OAuth 上下文，调用 provider，并协调账号登录。
3. `ExternalIdentityService`：按 provider identity 查找、创建或拒绝账号。
4. 显式 provider router：公开稳定路由、读写临时 Cookie、设置登录 Cookie 和完成回跳。

## 4. 数据模型

新增 `user_identities` 表：

| 字段 | 类型 | 约束 / 说明 |
|------|------|-------------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 外键到 `users.id`，删除用户时级联删除 |
| `provider` | varchar(32) | `github` / `google` / `wechat` |
| `provider_subject` | varchar(255) | GitHub user id、Google `sub`、微信 `openid` |
| `provider_union_id` | varchar(255), nullable | 微信 `unionid` 等跨应用标识 |
| `email` | varchar(255), nullable | provider 返回的规范化邮箱 |
| `email_verified` | boolean, nullable | provider 未提供时为 null |
| `display_name` | varchar(255), nullable | 展示名快照 |
| `avatar_url` | varchar(500), nullable | 头像 URL 快照 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束：

- `UNIQUE(provider, provider_subject)`。
- 对非空 `provider_union_id` 建立 `UNIQUE(provider, provider_union_id)`；PostgreSQL 允许多个 null。
- `provider_subject` 必须使用 provider 的稳定 ID，不能使用用户名或邮箱。

当前 `users.password_hash` 保持非空。由外部身份创建的用户写入高熵随机密码散列，因此用户无法通过密码猜测登录；本期不扩大为凭据模型重构。

## 5. Provider 抽象

所有 adapter 实现统一接口：

```python
class ExternalAuthProvider(Protocol):
    name: str
    supports_pkce: bool

    def build_authorization_url(self, context: OAuthStartContext) -> str: ...
    async def exchange_identity(self, callback: OAuthCallbackContext) -> ProviderIdentity: ...
```

归一化身份：

```python
@dataclass(frozen=True)
class ProviderIdentity:
    provider: str
    subject: str
    union_id: str | None
    email: str | None
    email_verified: bool | None
    display_name: str | None
    avatar_url: str | None
```

Adapter 只能返回身份数据或受控 provider 错误，不能创建本地用户、签发 mini-auth token 或决定账号合并策略。

首版 provider registry 只注册已配置且启用的 GitHub adapter。未配置返回 `provider_not_configured`，明确关闭返回 `provider_disabled`。微信未来可增加 `qualification_pending` 状态。

## 6. GitHub Adapter

授权请求只申请：

```text
read:user user:email
```

流程：

1. 将浏览器重定向到 GitHub authorize endpoint，并携带 `client_id`、`redirect_uri`、`scope`、`state`、`code_challenge`、`code_challenge_method=S256`。
2. 回调后用 `code`、`client_secret`、`redirect_uri` 和 `code_verifier` 换取短期 access token。
3. 每次登录都调用 `GET /user`，以 numeric `id` 作为 `provider_subject`。
4. 调用 `GET /user/emails`，选择 `primary=true` 且 `verified=true` 的邮箱。
5. 若没有符合条件的邮箱，返回 `verified_email_required`，不创建账号。
6. 登录结束后不持久化 GitHub access token。

所有 GitHub HTTP 请求设置超时、`Accept: application/json`、明确的 GitHub API media type 和 API version。上游拒绝、响应缺字段、超时或无效响应统一映射为稳定错误，不把 token 或上游响应正文返回浏览器或写入普通日志。

## 7. 账号解析与冲突策略

通用解析顺序：

1. 按 `(provider, provider_subject)` 查询身份。
2. 若已绑定且本地用户有效，更新允许变化的身份快照并登录该用户。
3. 若未绑定，调用该 provider 的首次登录策略。
4. 不得只凭未经验证的邮箱合并账号。
5. 绑定到已有用户必须在未来的账号设置流程中完成本地重新认证。

GitHub 首次登录策略：

- 必须存在 primary + verified 邮箱。
- 若本地不存在同邮箱用户：创建用户和 `user_identities`，用户昵称优先使用 GitHub name，其次 login，头像使用 GitHub avatar。
- 若本地已存在同邮箱用户但没有该 GitHub 身份：在邮箱已验证的前提下自动绑定并登录该用户（不新建账号）。
- 数据库唯一约束冲突时重新查询身份；若仍无法解析，则安全失败，避免并发请求创建重复账号。

未来 provider 策略：

- Google 同样要求 `email_verified=true`。
- 微信通常没有邮箱，可在微信实现设计中选择创建待补全用户或要求补充手机号/邮箱；这一差异不能进入通用 adapter 或 GitHub 流程。

## 8. OAuth 临时状态与安全回跳

`GET /api/v1/auth/github/start` 接受可选 `next`：

- 站内相对路径允许。
- 绝对 URL 只允许 HTTPS，且 origin 必须存在于 `EXTERNAL_AUTH_ALLOWED_RETURN_ORIGINS`。
- 非法 `next` 在开始授权前拒绝，不能静默接受开放重定向。

Start 生成：

- 不可预测的 `state`。
- PKCE `code_verifier` 和 S256 `code_challenge`。
- 包含 provider、state、verifier、规范化 next、签发与过期时间的短期签名上下文。

签名上下文放入专用 Cookie：

- `HttpOnly=true`
- `SameSite=Lax`
- 生产环境 `Secure=true`
- 限定 path 到对应 callback
- 有效期 10 分钟

Callback 必须同时验证 query `state`、Cookie 中 state、provider 和过期时间。无论成功或失败都删除临时 Cookie。OAuth 错误和用户取消授权返回受控错误。

签名可复用现有 `JWT_SECRET`，但使用独立 audience / token purpose，不能作为 access 或 refresh token 被接受。

## 9. 路由与会话

首版公开：

```text
GET /api/v1/auth/github/start
GET /api/v1/auth/github/callback
```

未来保持显式路由：

```text
GET /api/v1/auth/wechat/start
GET /api/v1/auth/wechat/callback
```

不公开动态 `/auth/{provider}`，避免任意 provider 名称进入配置和路由逻辑。显式 router 内部复用 flow service。

登录成功后：

1. 调用现有 `issue_tokens` 创建 `AuthSession`、access token 和 refresh token。
2. 后端设置 `mini_auth_access_token` 与 `mini_auth_refresh_token` Cookie。
3. Cookie 使用 `HttpOnly`、`SameSite=Lax`、生产 `Secure` 和 path `/`。
4. 302 到已验证的 `next`；未提供时返回 `/`。

现有前端写 Cookie 的邮箱登录行为不在本期重构范围内。

失败后 302 到登录页并附带稳定、非敏感错误码，例如：

```text
/login?oauth_error=account_link_required
```

若原始请求属于业务 OIDC authorize 流程，登录页仍保留原始安全 `next`，让用户改用邮箱登录。

## 10. 前端与配置

新增配置：

```text
GITHUB_ENABLED=false
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://auth.liuyidi.me/api/v1/auth/github/callback
EXTERNAL_AUTH_ALLOWED_RETURN_ORIGINS=https://auth.liuyidi.me
```

`GITHUB_ENABLED` 只有在凭据齐全时才允许入口可用。生产部署额外加入实际业务站点 origin。

登录页继续使用 provider 数据结构：

- 有 URL 的 GitHub provider 渲染可点击链接。
- 未配置的 GitHub 和 Google 保持灰显及“暂未接入”。
- GitHub start URL 携带当前 `next`，但最终仍由后端重新验证。

本期不引入 provider discovery API；服务端或构建配置直接提供 GitHub start URL。等 provider 数量或运行时管理需求增加后，再引入公开 capabilities endpoint。

## 11. 可观测性与错误处理

记录结构化安全事件，但不记录 provider access token、client secret、code verifier、完整授权 code 或签名上下文。

至少区分：

- `provider_disabled`
- `provider_not_configured`
- `oauth_state_invalid`
- `oauth_callback_denied`
- `provider_exchange_failed`
- `provider_identity_invalid`
- `verified_email_required`
- `account_link_required`

成功登录可写现有 `AuditLog`，action 为 `external_login_succeeded`，target type 为 `user_identity`。失败事件写应用日志；审计失败不得阻断成功登录。

## 12. 测试与验收

后端单元测试覆盖：

- GitHub authorize URL scope、state 和 PKCE。
- GitHub token、profile、email 响应归一化。
- 无 primary verified email。
- 已绑定身份重复登录。
- 首次登录创建用户及身份。
- 同邮箱已验证则自动绑定并登录。
- 上游拒绝、超时、异常响应。
- 非法或过期 state、provider 不匹配。
- 安全 next 校验。

路由测试覆盖：

- Start 设置符合安全属性的临时 Cookie 并重定向 GitHub。
- Callback 成功设置 mini-auth HttpOnly Cookie、删除临时 Cookie并安全回跳。
- Callback 失败删除临时 Cookie且不泄露内部错误。
- Provider 未启用时入口不可用。

前端测试覆盖：

- GitHub URL 存在时按钮为链接且可用。
- GitHub URL 缺失时仍灰显。
- Google 行为不变。
- 当前 `next` 被附加到 GitHub start URL。

验收条件：

1. 配置 GitHub OAuth App 后可完成首次登录并创建 mini-auth 会话。
2. 同一 GitHub 用户再次登录复用相同本地用户。
3. 已有同邮箱账号不会被自动绑定或登录。
4. GitHub access token 不落库、不进入浏览器、不出现在日志。
5. 登录后能继续原来的安全 OIDC `next` 流程。
6. 关闭或缺失 GitHub 配置时，入口不假装可用。
7. 新增 Google 或微信无需修改身份表、账号解析主流程或 mini-auth token service。

## 13. 与现有平台设计的关系

本设计落实 `docs/auth-platform-design.md` 中的 Provider 可扩展、账号绑定和 `user_identities` 方向，并补充 GitHub 作为首个外部 OAuth adapter 的具体边界。

实现时同步更新平台设计：

- 将 provider 示例从 `phone / wechat` 扩充为 `github / google / wechat / phone`。
- 明确 OAuth provider 与短信/邮箱验证码 credential provider 的协议差异，但共用用户和身份绑定模型。
- 保留微信的 `provider_union_id` 与资质开关。
- 纠正文档中“Login UI 支持 Google”与当前实际优先接入 GitHub之间的阶段性差异。
