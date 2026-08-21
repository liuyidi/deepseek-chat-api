# OpenAI Auth 路由参考

这份文档整理了 `auth.openai.com` 和相关 `chatgpt.com` 页面里，和 `mini-auth` 设计最相关的公开可观察路由。

目标不是复刻 OpenAI，而是提炼出可借鉴的路由分层、交互态和桌面端登录桥接方式。

## 1. 已观察到的路由

### 1.1 站点入口

- [`https://auth.openai.com/`](https://auth.openai.com/)
  - 会重定向到 `https://chatgpt.com/auth/login_with?callback_path=/`

### 1.2 账号选择

- [`https://auth.openai.com/choose-an-account`](https://auth.openai.com/choose-an-account)
  - 明确存在的独立页面。

### 1.3 授权与同意

- [`https://auth.openai.com/oauth/authorize`](https://auth.openai.com/oauth/authorize)
  - OAuth 授权入口。
  - 直接访问会提示缺少必填参数，说明它是标准授权端点。

- [`https://auth.openai.com/sign-in-with-chatgpt/codex/consent`](https://auth.openai.com/sign-in-with-chatgpt/codex/consent)
  - Codex 的 consent 页面。
  - 看起来依赖有效登录态或会话上下文。

### 1.4 桌面端回调与桥接

- [`https://auth.openai.com/deviceauth/callback`](https://auth.openai.com/deviceauth/callback)
  - 在桌面登录流程里作为 `redirect_uri` 使用。
  - 典型回调样例如：
    - [`https://auth.openai.com/deviceauth/callback?code=...&scope=openid+profile+email+offline_access&state=...`](https://auth.openai.com/deviceauth/callback?code=ac_y4lwHGkt_vzXi9Xl0d_TITNE1_iwOvfXuvJdSdcZEe0.jgAPVOASxYAQoKw1M6XdNrYNhvz0btU76yZVU2qQ0RU&scope=openid+profile+email+offline_access&state=kmtlMnEzogy88NcRkTQA17QDua4pWGANTlWaYsBnD_4)
  - 这个形态说明它是标准 OAuth 授权码回调，核心参数是：
    - `code`
    - `state`
    - `scope`
  - 其中 `state` 用来绑定发起方上下文，`code` 用来继续完成换 token。

- [`https://chatgpt.com/codex/desktop-auth`](https://chatgpt.com/codex/desktop-auth)
  - 桌面端登录桥接页。
  - 负责把复杂的 OAuth 参数打包后再交给 `auth.openai.com/oauth/authorize`。

### 1.5 错误页

- [`https://auth.openai.com/error`](https://auth.openai.com/error)
  - 授权失败后可见的站内错误页。

### 1.6 相关登录页

- [`https://chatgpt.com/auth/login_with?callback_path=/`](https://chatgpt.com/auth/login_with?callback_path=/)
  - `auth.openai.com/` 的重定向落点。

## 1.7 路由状态分级

### 已确认

- `https://auth.openai.com/`
- `https://auth.openai.com/choose-an-account`
- `https://auth.openai.com/log-in`
- `https://auth.openai.com/log-in/password`
- `https://auth.openai.com/sign-in-with-chatgpt/codex/consent`
- `https://auth.openai.com/sign-in-with-chatgpt/consent`
- `https://auth.openai.com/add-phone`
- `https://auth.openai.com/phone-otp/select-channel`
- `https://auth.openai.com/oauth/authorize`
- `https://auth.openai.com/oauth/token`
- `https://auth.openai.com/oauth/revoke`
- `https://auth.openai.com/deviceauth/callback`
- `https://auth.openai.com/codex/device`
- `https://auth.openai.com/api/accounts/deviceauth/usercode`
- `https://auth.openai.com/api/accounts/deviceauth/token`
- `https://auth.openai.com/api/accounts/phone-otp/send`
- `https://auth.openai.com/error`
- `https://chatgpt.com/auth/login_with?callback_path=/`
- `https://chatgpt.com/codex/desktop-auth`

### 待验证

下面这些从运行时行为、问题反馈或链路上下文里能较强推断存在，但我没有在这次扫描里拿到足够强的直接证据去单独确认更多细节：

- `https://auth.openai.com/sign-in-with-chatgpt/consent`
- `https://auth.openai.com/add-phone`
- `https://auth.openai.com/phone-otp/select-channel`
- `https://auth.openai.com/log-in`
- `https://auth.openai.com/log-in/password`

### 说明

- `sign-in-with-chatgpt/codex/consent` 已经被公开页面直接观察到，属于已确认。
- `sign-in-with-chatgpt/consent` 更像是通用分支名，和 Codex 专用 consent 并列出现的可能性较高，但我建议把它继续视为待验证。

## 2. 路由模式提炼

OpenAI 这套链路可以抽成几类页面：

1. 入口页
2. 账号选择页
3. 授权/同意页
4. OAuth 授权端点
5. 桌面端桥接页
6. 回调页
7. 错误页

这个结构的优点是：

- 页面职责清晰
- OAuth 的标准参数不会和 UI 逻辑搅在一起
- 桌面端和 Web 可以共用同一套授权后端
- 错误态有单独承接点，便于统一处理

## 3. 对 mini-auth 的借鉴建议

### 3.1 可以直接对齐的点

- `select-account` 独立成页面，而不是塞进登录页内部。
- `oauth/authorize` 保持为标准 OAuth 入口，不把 UI 逻辑耦进去。
- 为桌面端登录保留独立桥接页或桥接路由。
- 给失败场景保留独立错误页。

### 3.2 适合在 mini-auth 里加的别名

- `/choose-an-account`
  - 可以作为 `/oauth/select-account` 的语义别名，便于产品沟通和文档引用。

- `/oauth/consent`
  - 如果后续需要明确展示“授权同意”步骤，可以和 `select-account` 分开。

- `/oauth/error`
  - 统一承接 OAuth 失败状态，比复用普通登录错误页更清晰。

### 3.3 不建议直接照搬的点

- 不建议把具体品牌名写死在路由里。
- 不建议把桌面端桥接参数直接暴露给所有网页路由。
- 不建议为了对齐 OpenAI 而强行拆得过细；如果 `mini-auth` 当前没有复杂多账号场景，可以先保留最小集合。

## 4. mini-auth 现状映射

结合当前仓库，最接近的现有页面是：

- 登录页：`/login`
- 注册页：`/register`
- 选账号页：`/oauth/select-account`
- 退出登录：`/logout`
- 安全中心：`/accounts/security`

对应实现位置：

- [frontend/apps/web/src/App.tsx](/Users/liuyidi/github/mini-auth/frontend/apps/web/src/App.tsx)
- [frontend/apps/web/src/select-account/SelectAccountPage.tsx](/Users/liuyidi/github/mini-auth/frontend/apps/web/src/select-account/SelectAccountPage.tsx)
- [app/routers/web.py](/Users/liuyidi/github/mini-auth/app/routers/web.py)
- [app/main.py](/Users/liuyidi/github/mini-auth/app/main.py)

## 5. 结论

如果你要用 OpenAI 作为参考，最值得借鉴的不是具体路径字符串，而是它的页面分层方式：

- 登录入口和 OAuth 授权分开
- 账号选择单独成页
- 桌面端有独立桥接层
- 错误态独立承接

对 `mini-auth` 来说，`/oauth/select-account` 已经是一个很接近的起点，后面最自然的扩展是把 `consent` 和 `error` 也拆出来，但不必一开始就做满。
