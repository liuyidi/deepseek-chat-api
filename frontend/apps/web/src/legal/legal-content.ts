export type LegalDocumentId = "privacy" | "terms";
export type LegalLanguage = "zh" | "en";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

type LegalCatalog = Record<LegalDocumentId, Record<LegalLanguage, LegalDocument>>;

export const LEGAL_DOCUMENTS: LegalCatalog = {
  privacy: {
    zh: {
      title: "隐私政策",
      updatedAt: "2026-08-20",
      intro:
        "Mini Auth（auth.liuyidi.me）是 Mini 产品族的统一身份认证服务。本政策说明我们如何处理与你账号相关的信息。",
      sections: [
        {
          title: "我们收集的信息",
          paragraphs: [
            "账号信息：邮箱地址、昵称，以及你主动填写或授权提供的头像等基础资料。",
            "第三方登录信息：当你使用 Google、GitHub 等外部登录方式时，我们会接收该平台返回的已验证邮箱、用户标识（subject）及公开资料快照，用于创建或关联本地账号。",
            "认证与会话信息：登录时间、会话标识、客户端应用标识（如 minibot）、以及为保障安全所需的 Cookie 或令牌元数据。",
            "通信记录：用于邮箱验证码登录的发送记录与限流信息；我们不会把验证码明文长期保存。",
          ],
        },
        {
          title: "我们如何使用信息",
          paragraphs: [
            "提供注册、登录、登出、令牌刷新与 OIDC 授权等核心认证能力。",
            "识别账号、绑定外部身份、撤销其它设备会话，以及在账号安全中心展示必要的账号状态。",
            "检测滥用、限流与安全防护；在必要时记录审计事件。",
            "我们不会出售你的个人信息，也不会将认证数据用于与身份服务无关的广告定向。",
          ],
        },
        {
          title: "信息共享与存储",
          paragraphs: [
            "Mini Auth 为接入的业务应用（例如 Minibot、MiniKB）签发访问令牌；这些应用只能在其被授权的范围内访问你的账号信息。",
            "外部 OAuth 提供商（Google、GitHub）仅在你主动选择对应登录方式时参与身份验证；除完成登录所必需的信息外，我们不会长期保存第三方 access token。",
            "数据存储在受控的服务器环境中。具体托管位置与备份策略可能随部署环境调整，但我们会保持合理的访问控制与传输加密（HTTPS）。",
          ],
        },
        {
          title: "你的权利",
          paragraphs: [
            "你可以在账号安全中心查看部分账号与登录方式信息，并撤销其它设备的活跃会话。",
            "如需更正邮箱、删除账号或导出数据，请通过下方联系方式与我们联系。",
            "你也可以停止使用服务，并通过登出或联系我们来终止新的会话签发。",
          ],
        },
        {
          title: "联系我们",
          paragraphs: [
            "如有隐私相关问题，请发送邮件至 support@liuyidi.me（占位邮箱，可替换为你的实际支持地址）。",
            "本页面地址：https://auth.liuyidi.me/privacy",
          ],
        },
      ],
    },
    en: {
      title: "Privacy Policy",
      updatedAt: "2026-08-20",
      intro:
        "Mini Auth (auth.liuyidi.me) is the shared identity service for the Mini product family. This policy explains how we handle information related to your account.",
      sections: [
        {
          title: "Information we collect",
          paragraphs: [
            "Account details such as email address, nickname, and optional profile fields you provide or authorize.",
            "External sign-in data from providers such as Google or GitHub, including verified email, provider subject ID, and public profile snapshots used to create or link a local account.",
            "Authentication and session metadata such as login timestamps, session identifiers, client application IDs (for example minibot), and security cookies or token metadata.",
            "Email verification delivery and rate-limit records. Verification codes are not stored in plain text long term.",
          ],
        },
        {
          title: "How we use information",
          paragraphs: [
            "To provide registration, sign-in, sign-out, token refresh, and OIDC authorization.",
            "To identify accounts, link external identities, revoke other device sessions, and show essential account status in the security center.",
            "To detect abuse, enforce rate limits, and maintain service security.",
            "We do not sell personal information or use authentication data for unrelated advertising.",
          ],
        },
        {
          title: "Sharing and storage",
          paragraphs: [
            "Mini Auth issues access tokens to connected applications such as Minibot and MiniKB. Each application can only access account information within its approved scopes.",
            "External OAuth providers participate only when you choose that sign-in method. We do not persist third-party access tokens beyond what is needed for the login exchange.",
            "Data is stored in controlled server environments with HTTPS in transit and reasonable access controls.",
          ],
        },
        {
          title: "Your choices",
          paragraphs: [
            "You can review parts of your account in the security center and revoke active sessions on other devices.",
            "Contact us to correct your email, request deletion, or ask about data handling.",
            "You may stop using the service and sign out to prevent new sessions from being issued.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            "Privacy questions: support@liuyidi.me (placeholder support address).",
            "Canonical URL: https://auth.liuyidi.me/privacy",
          ],
        },
      ],
    },
  },
  terms: {
    zh: {
      title: "服务条款",
      updatedAt: "2026-08-20",
      intro:
        "使用 Mini Auth 即表示你同意以下条款。若你代表组织使用本服务，你声明有权使该组织受本条款约束。",
      sections: [
        {
          title: "服务说明",
          paragraphs: [
            "Mini Auth 提供统一账号注册、登录、外部 OAuth 登录、JWT/OIDC 授权，以及供 Mini 产品接入的身份接口。",
            "我们可能持续更新功能、接口与安全策略；重大变更会通过站点或接入应用合理通知。",
          ],
        },
        {
          title: "账号与安全",
          paragraphs: [
            "你应使用真实、可接收的邮箱，并妥善保管验证码、密码与会话。",
            "不得尝试未授权访问、批量注册、绕过限流、冒用他人身份或破坏服务稳定性。",
            "如发现账号异常，请尽快登出其它设备并通过支持渠道联系我们。",
          ],
        },
        {
          title: "第三方登录",
          paragraphs: [
            "使用 Google、GitHub 等第三方登录时，你还需遵守相应平台的服务条款与隐私政策。",
            "当外部身份返回的已验证邮箱与已有 Mini Auth 账号匹配时，系统可能自动绑定，以避免重复账号。",
          ],
        },
        {
          title: "接入应用",
          paragraphs: [
            "通过 Mini Auth 登录的下游应用（例如 Minibot）有各自的使用规则。Mini Auth 仅负责身份验证与令牌签发，不对下游应用中的具体操作承担产品责任。",
            "接入方应仅请求完成登录所必需的最小权限范围（scope）。",
          ],
        },
        {
          title: "免责声明与终止",
          paragraphs: [
            "服务按「现状」提供。我们会尽力保障可用性与安全，但不保证完全无中断或无错误。",
            "对于违反条款、存在安全风险或长期未使用的账号，我们可能限制、暂停或终止访问。",
            "你随时可以通过停止使用、登出或联系支持来终止继续使用。",
          ],
        },
        {
          title: "联系我们",
          paragraphs: [
            "条款相关问题：support@liuyidi.me（占位邮箱，可替换为你的实际支持地址）。",
            "本页面地址：https://auth.liuyidi.me/terms",
          ],
        },
      ],
    },
    en: {
      title: "Terms of Service",
      updatedAt: "2026-08-20",
      intro:
        "By using Mini Auth you agree to these terms. If you use the service on behalf of an organization, you represent that you have authority to bind that organization.",
      sections: [
        {
          title: "Service",
          paragraphs: [
            "Mini Auth provides unified registration, sign-in, external OAuth sign-in, JWT/OIDC authorization, and identity APIs for Mini applications.",
            "We may update features, APIs, and security controls over time. Material changes will be communicated through the site or connected applications when reasonable.",
          ],
        },
        {
          title: "Accounts and security",
          paragraphs: [
            "Use a valid email address you control and protect your verification codes, credentials, and active sessions.",
            "Do not attempt unauthorized access, bulk registration, rate-limit evasion, impersonation, or actions that degrade service stability.",
            "If you suspect compromise, sign out other devices and contact support promptly.",
          ],
        },
        {
          title: "Third-party sign-in",
          paragraphs: [
            "When using Google, GitHub, or other providers you must also comply with their terms and privacy policies.",
            "If a verified external email matches an existing Mini Auth account, the system may link identities to prevent duplicate accounts.",
          ],
        },
        {
          title: "Connected applications",
          paragraphs: [
            "Downstream apps such as Minibot have their own product rules. Mini Auth is responsible for authentication and token issuance, not for every action inside those apps.",
            "Connected clients should request only the minimum scopes required for sign-in.",
          ],
        },
        {
          title: "Disclaimer and termination",
          paragraphs: [
            "The service is provided as is. We aim for reliability and security but do not guarantee uninterrupted or error-free operation.",
            "We may restrict, suspend, or terminate access for violations, security risks, or prolonged inactivity.",
            "You may stop using the service at any time by signing out or contacting support.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            "Terms questions: support@liuyidi.me (placeholder support address).",
            "Canonical URL: https://auth.liuyidi.me/terms",
          ],
        },
      ],
    },
  },
};

export function getLegalDocument(documentId: LegalDocumentId, language: LegalLanguage): LegalDocument {
  return LEGAL_DOCUMENTS[documentId][language];
}
