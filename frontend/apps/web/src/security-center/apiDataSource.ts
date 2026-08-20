import type {
  AuthorizedApplication,
  SecurityCenterDataSource,
  SecurityCenterSnapshot,
  SecurityDevice,
  SecurityIconName,
  SecurityIconTone,
  SecurityOperation,
  SecurityOverview,
  SecuritySetting,
  SecuritySettingStatus,
} from "./types";
import { SecurityCenterError } from "./types";

type ApiSecurityUser = {
  nickname: string;
  email: string;
  avatar_initials: string;
};

type ApiSecurityOverview = {
  score: number;
  level: "低" | "中" | "高";
  optimizable_items: number;
  two_factor_enabled: boolean;
};

type ApiSecurityDevice = {
  id: string;
  name: string;
  system: string;
  logged_in_at: string;
  kind: "browser" | "desktop" | "mobile";
  is_current: boolean;
};

type ApiSecuritySetting = {
  id: string;
  title: string;
  description: string;
  status: SecuritySettingStatus;
  icon: SecurityIconName;
  tone: SecurityIconTone;
  toggle?: boolean;
};

type ApiSecuritySnapshot = {
  user: ApiSecurityUser;
  overview: ApiSecurityOverview;
  devices: ApiSecurityDevice[];
  settings: ApiSecuritySetting[];
};

type ApiSecurityOperation = {
  id: string;
  action: string;
  device: string;
  occurred_at: string;
  location: string;
};

type ApiAuthorizedApplication = {
  id: string;
  name: string;
  description: string;
  authorized_at: string;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function mapSnapshot(payload: ApiSecuritySnapshot): SecurityCenterSnapshot {
  return {
    user: {
      nickname: payload.user.nickname,
      email: payload.user.email,
      avatarInitials: payload.user.avatar_initials,
    },
    overview: {
      score: payload.overview.score,
      level: payload.overview.level,
      optimizableItems: payload.overview.optimizable_items,
      twoFactorEnabled: payload.overview.two_factor_enabled,
    },
    devices: payload.devices.map(
      (device): SecurityDevice => ({
        id: device.id,
        name: device.name,
        system: device.system,
        loggedInAt: device.logged_in_at,
        kind: device.kind,
        isCurrent: device.is_current,
      }),
    ),
    settings: payload.settings.map(
      (setting): SecuritySetting => ({
        id: setting.id,
        title: setting.title,
        description: setting.description,
        status: setting.status,
        icon: setting.icon,
        tone: setting.tone,
        toggle: setting.toggle,
      }),
    ),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    throw new SecurityCenterError("UNAUTHORIZED", "Not authenticated");
  }
  if (!response.ok) {
    throw new SecurityCenterError("MOCK_FAILURE", "Security API request failed");
  }
  return (await response.json()) as T;
}

export function createApiSecurityCenterDataSource(baseUrl: string): SecurityCenterDataSource {
  const snapshotUrl = joinUrl(baseUrl, "/api/v1/security/snapshot");
  const operationsUrl = joinUrl(baseUrl, "/api/v1/security/operations");
  const applicationsUrl = joinUrl(baseUrl, "/api/v1/security/applications");

  return {
    async getSnapshot() {
      const response = await fetch(snapshotUrl, { credentials: "include" });
      return mapSnapshot(await readJson<ApiSecuritySnapshot>(response));
    },

    async setTwoFactorEnabled() {
      throw new SecurityCenterError("NOT_SUPPORTED", "Two-factor authentication is not available yet");
    },

    async revokeDevice(deviceId) {
      const response = await fetch(joinUrl(baseUrl, `/api/v1/security/sessions/${deviceId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (response.status === 401) {
        throw new SecurityCenterError("UNAUTHORIZED", "Not authenticated");
      }
      if (response.status === 409) {
        throw new SecurityCenterError("CURRENT_DEVICE", "Cannot revoke the current session");
      }
      if (response.status === 404) {
        throw new SecurityCenterError("NOT_FOUND", "Session not found");
      }
      if (!response.ok) {
        throw new SecurityCenterError("MOCK_FAILURE", "Failed to revoke session");
      }
    },

    async getOperations() {
      const response = await fetch(operationsUrl, { credentials: "include" });
      const payload = await readJson<ApiSecurityOperation[]>(response);
      return payload.map(
        (item): SecurityOperation => ({
          id: item.id,
          action: item.action,
          device: item.device,
          occurredAt: item.occurred_at,
          location: item.location,
        }),
      );
    },

    async getAuthorizedApplications() {
      const response = await fetch(applicationsUrl, { credentials: "include" });
      const payload = await readJson<ApiAuthorizedApplication[]>(response);
      return payload.map(
        (item): AuthorizedApplication => ({
          id: item.id,
          name: item.name,
          description: item.description,
          authorizedAt: item.authorized_at,
        }),
      );
    },
  };
}

export function isSecurityUnauthorizedError(error: unknown): boolean {
  return error instanceof SecurityCenterError && error.code === "UNAUTHORIZED";
}
