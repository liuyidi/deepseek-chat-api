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
    system: "macOS",
    loggedInAt: "2026/08/14 10:36:24",
    lastSeenAt: "2026/08/14 10:36:24",
    kind: "browser",
    isCurrent: true,
    location: "浙江省杭州市",
  },
  {
    id: "chrome-mac-other",
    name: "Chrome",
    system: "macOS",
    loggedInAt: "2026/08/14 09:00:00",
    lastSeenAt: "2026/08/14 09:00:00",
    kind: "browser",
    isCurrent: false,
    location: "浙江省杭州市",
  },
  {
    id: "safari-iphone",
    name: "Safari",
    system: "iOS",
    loggedInAt: "2026/08/13 21:08:55",
    lastSeenAt: "2026/08/13 21:08:55",
    kind: "mobile",
    isCurrent: false,
    location: "浙江省杭州市",
  },
  {
    id: "safari-iphone-old",
    name: "Safari",
    system: "iOS",
    loggedInAt: "2026/08/11 12:00:00",
    lastSeenAt: "2026/08/11 12:00:00",
    kind: "mobile",
    isCurrent: false,
    location: "上海市",
  },
  {
    id: "mini-auth-desktop",
    name: "Liu 的 MacBook Pro",
    system: "macOS",
    loggedInAt: "2026/08/12 09:42:18",
    lastSeenAt: "2026/08/12 09:42:18",
    kind: "desktop",
    isCurrent: false,
    appName: "Minibot",
    clientId: "minibot",
    location: "浙江省杭州市",
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
    action: "登录/切换账号",
    device: "Chrome · macOS",
    occurredAt: "2026/08/21 12:42:24",
    location: "杭州市",
    kind: "desktop",
    appName: "Minibot",
    ipAddress: "115.196.84.12",
    ipMasked: "115.196.84.***",
    status: "设备活跃",
  },
  {
    id: "operation-2",
    action: "退出登录",
    device: "Chrome · macOS",
    occurredAt: "2026/08/21 12:41:58",
    location: "杭州市",
    kind: "desktop",
    appName: "Minibot",
    ipAddress: "115.196.84.12",
    ipMasked: "115.196.84.***",
    status: "已退出",
  },
  {
    id: "operation-3",
    action: "登录/切换账号",
    device: "Safari · iOS",
    occurredAt: "2026/08/20 21:08:55",
    location: "杭州市",
    kind: "mobile",
    appName: "Minibot",
    ipAddress: "115.196.84.20",
    ipMasked: "115.196.84.***",
    status: "设备活跃",
  },
];

function dedupeDevicesByName(devices: SecurityDevice[]): SecurityDevice[] {
  const bestByName = new Map<string, SecurityDevice>();
  for (const device of devices) {
    const current = bestByName.get(device.name);
    if (!current || (device.isCurrent && !current.isCurrent)) {
      bestByName.set(device.name, device);
    }
  }
  const seen = new Set<string>();
  const deduped: SecurityDevice[] = [];
  for (const device of devices) {
    if (seen.has(device.name)) {
      continue;
    }
    seen.add(device.name);
    deduped.push(bestByName.get(device.name)!);
  }
  return deduped;
}

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
  let apps = clone(applications);

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
        devices: dedupeDevicesByName(devices),
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
      devices = devices.filter(
        (candidate) => candidate.name !== device.name || candidate.isCurrent,
      );
    },

    async getOperations() {
      await waitForMock();
      return clone(operations);
    },

    async getAuthorizedApplications() {
      await waitForMock();
      return clone(apps);
    },

    async revokeApplication(clientId) {
      await waitForMock();
      const before = apps.length;
      apps = apps.filter((item) => item.id !== clientId);
      if (apps.length === before) {
        throw new SecurityCenterError("NOT_FOUND", "未找到该授权应用");
      }
    },
  };
}
