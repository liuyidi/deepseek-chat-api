import {
  SecurityCenterError,
  type AuthorizedApplication,
  type SecurityCenterDataSource,
  type SecurityCenterSnapshot,
  type SecurityDevice,
  type SecurityOperation,
  type SecurityOverview,
  type SecuritySetting,
} from "./types";

const MOCK_DELAY_MS = 40;

const initialDevices: SecurityDevice[] = [
  {
    id: "chrome-mac-current",
    name: "Chrome",
    system: "Mac",
    loggedInAt: "2026/08/14 10:36:24",
    kind: "browser",
    isCurrent: true,
  },
  {
    id: "safari-iphone",
    name: "Safari",
    system: "iPhone",
    loggedInAt: "2026/08/13 21:08:55",
    kind: "mobile",
    isCurrent: false,
  },
  {
    id: "mini-auth-desktop",
    name: "Liu 的 MacBook Pro",
    system: "macOS 26.0",
    loggedInAt: "2026/08/12 09:42:18",
    kind: "desktop",
    isCurrent: false,
  },
];

const initialSettings: SecuritySetting[] = [
  {
    id: "two-factor",
    title: "两步验证",
    description: "启用后，登录 Mini Auth 时需完成身份和密码的双重验证，确保账号安全",
    status: "unset",
    icon: "shield",
    tone: "blue",
    toggle: true,
  },
  {
    id: "login-methods",
    title: "登录方式",
    description: "管理用于登录 Mini Auth 和身份验证的手机号码与邮箱等",
    status: "set",
    icon: "user-settings",
    tone: "blue",
  },
  {
    id: "login-password",
    title: "登录密码",
    description: "设置登录 Mini Auth 的密码",
    status: "unset",
    icon: "password",
    tone: "orange",
  },
  {
    id: "passkey",
    title: "通行密钥",
    description: "可通过设备指纹、面容识别等方式快速进行身份验证",
    status: "unset",
    icon: "passkey",
    tone: "violet",
  },
  {
    id: "otp",
    title: "动态口令",
    description: "OTP 动态口令可用于完成身份验证",
    status: "unset",
    icon: "otp",
    tone: "violet",
  },
  {
    id: "backup-verification",
    title: "备用验证方式",
    description: "设置后，可使用备用手机号或邮箱进行身份验证",
    status: "unset",
    icon: "backup",
    tone: "blue",
  },
  {
    id: "secure-password",
    title: "安全密码",
    description: "查看敏感信息时，需要输入安全密码进行验证，确保信息安全",
    status: "unset",
    icon: "secure-password",
    tone: "teal",
  },
];

const operations: SecurityOperation[] = [
  {
    id: "operation-1",
    action: "账号登录",
    device: "Chrome · Mac",
    occurredAt: "2026/08/14 10:36:24",
    location: "浙江省杭州市",
  },
  {
    id: "operation-2",
    action: "邮箱验证码登录",
    device: "Safari · iPhone",
    occurredAt: "2026/08/13 21:08:55",
    location: "浙江省杭州市",
  },
  {
    id: "operation-3",
    action: "刷新登录状态",
    device: "Mini Auth Desktop · macOS",
    occurredAt: "2026/08/12 09:42:18",
    location: "浙江省杭州市",
  },
];

const applications: AuthorizedApplication[] = [
  {
    id: "minibot",
    name: "Minibot",
    description: "访问你的基础账号信息和邮箱地址",
    authorizedAt: "2026/08/10",
  },
  {
    id: "minikb",
    name: "MiniKB",
    description: "访问你的基础账号信息",
    authorizedAt: "2026/08/08",
  },
];

function waitForMock(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, MOCK_DELAY_MS));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMockSecurityCenterDataSource(): SecurityCenterDataSource {
  let twoFactorEnabled = false;
  let devices = clone(initialDevices);
  let settings = clone(initialSettings);

  function getOverview(): SecurityOverview {
    return {
      score: twoFactorEnabled ? 82 : 70,
      level: twoFactorEnabled ? "高" : "中",
      optimizableItems: twoFactorEnabled ? 5 : 6,
      twoFactorEnabled,
    };
  }

  return {
    async getSnapshot() {
      await waitForMock();
      return clone({
        user: {
          nickname: "Mini Auth 用户",
          email: "demo@mini-auth.dev",
          avatarInitials: "MA",
        },
        overview: getOverview(),
        devices,
        settings,
      });
    },

    async setTwoFactorEnabled(enabled) {
      await waitForMock();
      twoFactorEnabled = enabled;
      settings = settings.map((setting) =>
        setting.id === "two-factor" ? { ...setting, status: enabled ? "set" : "unset" } : setting,
      );
      return clone(getOverview());
    },

    async revokeDevice(deviceId) {
      await waitForMock();
      const device = devices.find((candidate) => candidate.id === deviceId);
      if (!device) {
        throw new SecurityCenterError("NOT_FOUND", "未找到该登录设备");
      }
      if (device.isCurrent) {
        throw new SecurityCenterError("CURRENT_DEVICE", "无法退出当前设备");
      }
      devices = devices.filter((candidate) => candidate.id !== deviceId);
    },

    async getOperations() {
      await waitForMock();
      return clone(operations);
    },

    async getAuthorizedApplications() {
      await waitForMock();
      return clone(applications);
    },
  };
}
