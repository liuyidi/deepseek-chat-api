export type SecuritySettingStatus = "set" | "unset";

export type SecurityIconName =
  | "shield"
  | "user-settings"
  | "password"
  | "passkey"
  | "otp"
  | "backup"
  | "secure-password";

export type SecurityIconTone = "blue" | "orange" | "violet" | "teal";

export type SecurityOverview = {
  score: number;
  level: "低" | "中" | "高";
  optimizableItems: number;
  twoFactorEnabled: boolean;
};

export type SecurityUser = {
  nickname: string;
  email: string;
  avatarInitials: string;
};

export type SecurityDevice = {
  id: string;
  name: string;
  system: string;
  loggedInAt: string;
  kind: "browser" | "desktop" | "mobile";
  isCurrent: boolean;
};

export type SecuritySetting = {
  id: string;
  title: string;
  description: string;
  status: SecuritySettingStatus;
  icon: SecurityIconName;
  tone: SecurityIconTone;
  toggle?: boolean;
};

export type SecurityOperation = {
  id: string;
  action: string;
  device: string;
  occurredAt: string;
  location: string;
};

export type AuthorizedApplication = {
  id: string;
  name: string;
  description: string;
  authorizedAt: string;
};

export type SecurityCenterSnapshot = {
  user: SecurityUser;
  overview: SecurityOverview;
  devices: SecurityDevice[];
  settings: SecuritySetting[];
};

export type SecurityCenterErrorCode =
  | "CURRENT_DEVICE"
  | "NOT_FOUND"
  | "MOCK_FAILURE"
  | "UNAUTHORIZED"
  | "NOT_SUPPORTED";

export class SecurityCenterError extends Error {
  readonly code: SecurityCenterErrorCode;

  constructor(code: SecurityCenterErrorCode, message: string) {
    super(message);
    this.name = "SecurityCenterError";
    this.code = code;
  }
}

export interface SecurityCenterDataSource {
  getSnapshot(): Promise<SecurityCenterSnapshot>;
  setTwoFactorEnabled(enabled: boolean): Promise<SecurityOverview>;
  revokeDevice(deviceId: string): Promise<void>;
  getOperations(): Promise<SecurityOperation[]>;
  getAuthorizedApplications(): Promise<AuthorizedApplication[]>;
}
