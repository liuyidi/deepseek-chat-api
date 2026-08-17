# OAuth 选择账号页（自定义 scheme）设计

## 1. 目标

桌面客户端（`redirect_uri` 为自定义 scheme，如 `minibot://auth/callback`）在 **IdP 会话仍在** 时重新发起登录，不再静默发 code 并立刻跳转 scheme（触发系统「要打开 App 吗？」），而是先展示类似 WorkBuddy 的「选择账号」页：

- 点击当前账号 → 继续 OAuth，再跳转 `redirect_uri`（此时才可能出现打开 App 提示）。
- 点击「切换登录用户」→ 清除 IdP 会话 → 进入登录页 → 登录成功后回到原 authorize。

HTTPS 回调（Web）保持现有静默 SSO，不打断。

## 2. 范围

本期包含：

- `GET /oauth/authorize`：有会话 + 自定义 scheme + 未确认 → 302 到选择账号 SPA，不发 code。
- SPA 路由 `/oauth/select-account`：展示当前账号卡片 +「切换登录用户」。
- 继续：带确认标记重新进入 `/oauth/authorize`，发 code 并 302 到 `redirect_uri`。
- 切换：`GET /logout?next=/login?next=<原 authorize URL>`。
- 自动化测试（authorize 分支 + 前端路由/交互冒烟）。

本期不包含：

- 多账号列表（mini-auth 单会话模型；卡片仅当前用户）。
- 完整 OIDC `prompt=login|select_account|none`（可后续加；本期用显式确认查询参数即可）。
- minibot / desktop 壳代码改动（authorize URL 不变，行为由 IdP 承接）。
- Web HTTPS 静默 SSO 行为变更。

## 3. 判定规则

### 3.1 自定义 scheme

`redirect_uri` 的 URL scheme **不是** `http` / `https`（大小写不敏感）时，视为自定义 scheme。例如：

- `minibot://auth/callback` → 自定义
- `https://bot.liuyidi.me/auth/mini-auth/callback` → HTTPS，静默

非法 / 无法解析的 `redirect_uri` 仍走现有 `validate_client_redirect_uri` 错误路径。

### 3.2 Authorize 分支（有会话时）

```
有会话?
  ├─ 否 → 302 /login?next=<完整 authorize URL>（现状）
  └─ 是
       ├─ HTTPS redirect_uri → 校验 client + 发 code + 302 redirect_uri（现状）
       └─ 自定义 scheme
            ├─ 无确认标记 → 302 /oauth/select-account?<原 authorize 查询串原样保留>
            └─ 有确认标记 → 校验 client + 发 code + 302 redirect_uri
```

确认标记：查询参数 `account_confirmed=1`（仅服务端识别；从 select-account「继续」拼回 authorize 时带上）。发 code 前校验通过后 **不必** 把该参数回传到 `redirect_uri`。

无会话却带 `account_confirmed=1`：忽略确认，按无会话处理（进登录）。

## 4. 前端

### 4.1 路由

- 路径：`/oauth/select-account`（及可选尾斜杠）。
- 查询串：与触发本次登录的 `/oauth/authorize` 查询串一致（含 `client_id`、`redirect_uri`、`state`、`code_challenge` 等），**不含** `account_confirmed`。
- `resolveAppRoute` 增加 `select-account`；Caddy/`try_files` 已回退 `index.html`，无需新后端 HTML 路由。

### 4.2 UI（对齐截图意图，品牌用 Minibot）

- 标题：选择账号
- 一张账号卡片：头像占位（昵称首字）、主文案 `nickname`、副文案可用「个人版」或 email（有 email 优先显示 email 作副文案亦可；首版副文案固定「个人版」以贴近 WorkBuddy，email 不强制展示）
- 主操作：点击整张卡片 = 继续当前账号
- 次操作：蓝色文字链「切换登录用户」

数据：`GET /api/v1/users/me`（现有 `authClient.getCurrentUser()`）。未登录则 `location.replace('/login?next=' + 当前 authorize URL)`。

### 4.3 动作

**继续**

```
location.assign('/oauth/authorize?' + 原查询串 + '&account_confirmed=1')
```

**切换登录用户**

```
/logout?next=/login?next=<urlencoded 完整 /oauth/authorize?原查询串>
```

登录成功后现有 `/login` 会 `replace(next)`，回到无 `account_confirmed` 的 authorize；此时若已换账号则有会话，再次进入 select-account（符合「选一次再跳 App」）；若希望换账号后直接发 code，可在登录成功回到 authorize 时仍无 confirmed → 再点一次卡片。接受这一次额外确认（与 WorkBuddy「先选账号」一致）。

## 5. 安全

- 发 code 仍要求有效会话 + 已注册 `redirect_uri` + PKCE；`account_confirmed` 不能代替会话。
- 客户端继续用 `state` / PKCE 绑定桌面发起方，降低恶意页面带 `account_confirmed=1` 诱导跳 scheme 的风险（与当前静默 SSO 同级；选择页把「意外弹开 App」降为「用户点了继续」）。
- `next` / logout 回跳只允许相对路径或同站 auth 路径；logout 的 `next` 已有约束则沿用，登录 `next` 保持现有行为（authorize 完整 URL 作为 next 已在生产使用）。

## 6. 测试

后端：

- HTTPS + 有会话 → 直接 302 到 redirect_uri（带 code），不经过 select-account。
- 自定义 scheme + 有会话 + 无 confirmed → 302 `/oauth/select-account?...`，Location 不含 code。
- 自定义 scheme + 有会话 + `account_confirmed=1` → 302 到 scheme redirect_uri（带 code）。
- 无会话 + 自定义 scheme → 302 `/login?next=...`。

前端：

- `resolveAppRoute('/oauth/select-account')` → select-account。
- 有用户时渲染标题/卡片/切换链接；继续拼出带 `account_confirmed=1` 的 authorize；切换拼出 logout URL。

## 7. 部署与兼容

- 仅改 `mini-auth`；部署 `auth.liuyidi.me` 后 Desktop 无需发版即可生效。
- minibot 仍请求现有 `/oauth/authorize?...&redirect_uri=minibot://...`。
- Web 行为不变。

## 8. 成功标准

1. Desktop 本地登出后「重新发起登录」：浏览器先停在选择账号，不立刻弹「打开 minibot V2」。
2. 点账号后才出现打开 App / 完成回调。
3. 「切换登录用户」可换账号再授权。
4. Web HTTPS 登录仍一键静默回来。
