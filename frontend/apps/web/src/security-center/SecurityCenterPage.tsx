import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import "./security-center.css";

import type {
  AuthorizedApplication,
  SecurityCenterDataSource,
  SecurityCenterSnapshot,
  SecurityDevice,
  SecurityOperation,
} from "./types";
import { isSecurityUnauthorizedError } from "./apiDataSource";

export type SecurityCenterPageProps = {
  dataSource: SecurityCenterDataSource;
};

type DialogState =
  | { type: "device"; device: SecurityDevice }
  | { type: "device-detail"; device: SecurityDevice }
  | { type: "devices" }
  | { type: "operations"; items: SecurityOperation[] | null }
  | { type: "applications"; items: AuthorizedApplication[] | null }
  | { type: "revoke-app"; app: AuthorizedApplication }
  | null;

function formatOperationTime(occurredAt: string): string {
  const parts = occurredAt.trim().split(/\s+/);
  return parts.length > 1 ? parts[1]! : occurredAt;
}

function formatOperationDate(occurredAt: string): string {
  return occurredAt.trim().split(/\s+/)[0] || occurredAt;
}

function operationLocationLine(item: SecurityOperation): string {
  if (item.location && item.ipMasked) {
    return `${item.location} (${item.ipMasked})`;
  }
  if (item.location && item.location !== "-") {
    return item.location;
  }
  return item.ipMasked || item.location || "-";
}

function deviceLoginMethod(device: SecurityDevice): string {
  return [device.appName, device.system].filter(Boolean).join(" · ");
}

function deviceListSubtitle(device: SecurityDevice): string {
  const ip = deviceIpLine(device);
  const parts = [ip !== "-" ? ip : null, `最近活跃 ${device.lastSeenAt}`].filter(Boolean);
  return parts.join(" · ");
}

function groupOperationsByDate(items: SecurityOperation[]): { date: string; items: SecurityOperation[] }[] {
  const groups = new Map<string, SecurityOperation[]>();
  for (const item of items) {
    const date = formatOperationDate(item.occurredAt);
    const bucket = groups.get(date);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(date, [item]);
    }
  }
  return Array.from(groups.entries()).map(([date, groupItems]) => ({ date, items: groupItems }));
}

function MinibotMark() {
  return (
    <span className="security-brand-mark" aria-hidden="true">
      <img src="/brand/minibot_mark.svg" alt="" width={40} height={40} />
    </span>
  );
}

function LineIcon({ name }: { name: "globe" | "desktop" | "chevron" | "apps" }) {
  if (name === "chevron") {
    return (
      <span className="security-chevron" aria-hidden="true">
        ›
      </span>
    );
  }

  const paths: Record<Exclude<typeof name, "chevron">, ReactNode> = {
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </>
    ),
    desktop: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    apps: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  };

  return (
    <svg
      className="security-line-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`security-panel ${className}`.trim()}>
      <div className="security-panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="security-panel-body">{children}</div>
    </section>
  );
}

function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const titleId = `security-dialog-${title.replace(/\s/g, "-")}`;
  return (
    <div
      className="security-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="security-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="security-modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="security-icon-button" aria-label="关闭弹窗" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="security-modal-body">{children}</div>
        {footer ? <div className="security-modal-footer">{footer}</div> : null}
      </section>
    </div>
  );
}

function buildLogoutHref(): string {
  return `/logout?next=${encodeURIComponent("/login")}`;
}

export function SecurityCenterPage({ dataSource }: SecurityCenterPageProps) {
  const [snapshot, setSnapshot] = useState<SecurityCenterSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadSnapshot = useCallback(async () => {
    setLoadError(false);
    try {
      setSnapshot(await dataSource.getSnapshot());
    } catch (error) {
      if (isSecurityUnauthorizedError(error)) {
        window.location.replace(`/login?next=${encodeURIComponent("/accounts/security/")}`);
        return;
      }
      setLoadError(true);
    }
  }, [dataSource]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Minibot 账号中心";
    document.body.classList.add("security-body");
    return () => {
      document.title = previousTitle;
      document.body.classList.remove("security-body");
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleRevokeDevice = async (device: SecurityDevice) => {
    setPendingAction(`device-${device.id}`);
    try {
      await dataSource.revokeDevice(device.id);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              devices: current.devices.filter(
                (item) => item.name !== device.name || item.isCurrent,
              ),
            }
          : current,
      );
      setDialog(null);
      setToast(`${device.name} 已退出登录`);
    } catch {
      setToast("设备退出失败，请稍后重试");
    } finally {
      setPendingAction(null);
    }
  };

  const openOperations = async () => {
    setDialog({ type: "operations", items: null });
    try {
      const items = await dataSource.getOperations();
      setDialog((current) => (current?.type === "operations" ? { ...current, items } : current));
    } catch {
      setDialog(null);
      setToast("操作记录加载失败");
    }
  };

  const openApplications = async () => {
    setDialog({ type: "applications", items: null });
    try {
      const items = await dataSource.getAuthorizedApplications();
      setDialog((current) => (current?.type === "applications" ? { ...current, items } : current));
    } catch {
      setDialog(null);
      setToast("授权应用加载失败");
    }
  };

  const handleRevokeApplication = async (app: AuthorizedApplication) => {
    setPendingAction(`app-${app.id}`);
    try {
      await dataSource.revokeApplication(app.id);
      setDialog({ type: "applications", items: null });
      const items = await dataSource.getAuthorizedApplications();
      setDialog({ type: "applications", items });
      setSnapshot((current) =>
        current
          ? {
              ...current,
              devices: current.devices.filter((device) => device.clientId !== app.id || device.isCurrent),
            }
          : current,
      );
      setToast(`${app.name} 授权已取消`);
    } catch {
      setToast("取消授权失败，请稍后重试");
    } finally {
      setPendingAction(null);
    }
  };

  function renderAvatar(size: "hero" | "small", initials: string, avatarUrl?: string | null) {
    const className = size === "hero" ? "security-avatar" : "security-avatar security-avatar--small";
    if (avatarUrl) {
      return <img className={className} src={avatarUrl} alt="" />;
    }
    return <span className={className}>{initials}</span>;
  }

  if (!snapshot) {
    return (
      <main className="security-page security-page--state">
        <MinibotMark />
        {loadError ? (
          <div className="security-state-card" role="alert">
            <h1>账号中心加载失败</h1>
            <p>暂时无法读取账号信息，请稍后重试。</p>
            <button type="button" onClick={() => void loadSnapshot()}>
              重新加载
            </button>
          </div>
        ) : (
          <p>正在加载账号中心…</p>
        )}
      </main>
    );
  }

  const { user, devices } = snapshot;

  return (
    <div className="security-page">
      <header className="security-topbar">
        <a className="security-brand" href="/accounts/security/">
          <MinibotMark />
          <span>Minibot账号中心</span>
        </a>
        <div className="security-topbar-actions">
          <div className="security-account-menu" ref={menuRef}>
            <button
              type="button"
              className="security-avatar-button"
              aria-label={`当前用户：${user.nickname}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {renderAvatar("small", user.avatarInitials, user.avatarUrl)}
            </button>
            {menuOpen ? (
              <div className="security-account-menu-panel" role="menu">
                <a className="security-account-menu-item" role="menuitem" href={buildLogoutHref()}>
                  退出登录
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="security-main">
        <section className="security-hero">
          {renderAvatar("hero", user.avatarInitials, user.avatarUrl)}
          <h1>你好，{user.nickname}</h1>
          <p>管理登录设备与应用授权</p>
        </section>

        <div className="security-grid">
          <div className="security-column">
            <Panel
              title="登录设备"
              action={
                <button type="button" className="security-text-button" onClick={() => void openOperations()}>
                  使用记录 <LineIcon name="chevron" />
                </button>
              }
            >
              <div className="security-device-list">
                {devices.length === 0 ? (
                  <p className="security-empty">暂无登录设备</p>
                ) : (
                  devices.slice(0, 3).map((device) => (
                    <button
                      type="button"
                      className="security-device-row security-device-row--button"
                      key={device.id}
                      onClick={() => setDialog({ type: "device-detail", device })}
                    >
                      <span className="security-device-icon">
                        <LineIcon name={device.kind === "browser" ? "globe" : "desktop"} />
                      </span>
                      <div className="security-device-content">
                        <strong>
                          {device.name}
                          {device.isCurrent ? (
                            <span className="security-current-device">本机</span>
                          ) : null}
                        </strong>
                        <span>
                          {deviceListSubtitle(device)}
                        </span>
                      </div>
                      <LineIcon name="chevron" />
                    </button>
                  ))
                )}
              </div>
              {devices.length > 0 ? (
                <div className="security-panel-footer">
                  <button
                    type="button"
                    className="security-text-button"
                    onClick={() => setDialog({ type: "devices" })}
                  >
                    查看全部设备 <LineIcon name="chevron" />
                  </button>
                </div>
              ) : null}
            </Panel>
          </div>

          <div className="security-column">
            <Panel title="授权管理">
              <button type="button" className="security-management-row" onClick={() => void openApplications()}>
                <span className="security-management-icon">
                  <LineIcon name="apps" />
                </span>
                <span>
                  <strong>应用授权管理</strong>
                  <small>查看并管理有权访问你账号信息的应用</small>
                </span>
                <LineIcon name="chevron" />
              </button>
            </Panel>
          </div>
        </div>

        <footer className="security-footer">
          当前登录账号：{user.nickname}（{user.email}）
        </footer>
      </main>

      {dialog?.type === "device" ? (
        <Modal
          title="退出此设备？"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className="security-secondary-button" onClick={() => setDialog(null)}>
                取消
              </button>
              <button
                type="button"
                className="security-danger-button"
                disabled={pendingAction === `device-${dialog.device.id}`}
                onClick={() => void handleRevokeDevice(dialog.device)}
              >
                {pendingAction ? "正在退出…" : "确认退出"}
              </button>
            </>
          }
        >
          <p>退出后，{dialog.device.name} 需要重新完成身份验证才能访问 Minibot。</p>
        </Modal>
      ) : null}

      {dialog?.type === "device-detail" ? (
        <Modal
          title="登录设备详情"
          onClose={() => setDialog(null)}
          footer={
            dialog.device.isCurrent ? undefined : (
              <button
                type="button"
                className="security-danger-button security-danger-button--wide"
                onClick={() => setDialog({ type: "device", device: dialog.device })}
              >
                退出该设备
              </button>
            )
          }
        >
          <div className="security-device-detail">
            <span className="security-device-detail-icon" aria-hidden="true">
              <LineIcon name={dialog.device.kind === "browser" ? "globe" : "desktop"} />
            </span>
            <h2 className="security-device-detail-name">{dialog.device.name}</h2>
            {dialog.device.isCurrent ? (
              <span className="security-current-device security-current-device--badge">本机</span>
            ) : null}
            <dl className="security-device-detail-card">
              <div>
                <dt>最近使用</dt>
                <dd>{dialog.device.lastSeenAt}</dd>
              </div>
              {deviceLoginMethod(dialog.device) ? (
                <div>
                  <dt>登录方式</dt>
                  <dd>{deviceLoginMethod(dialog.device)}</dd>
                </div>
              ) : null}
              <div>
                <dt>IP</dt>
                <dd>{deviceIpLine(dialog.device)}</dd>
              </div>
            </dl>
          </div>
        </Modal>
      ) : null}

      {dialog?.type === "devices" ? (
        <Modal title="全部登录设备" onClose={() => setDialog(null)}>
          {devices.length === 0 ? (
            <p className="security-empty">暂无登录设备</p>
          ) : (
            <div className="security-dialog-list">
              {devices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  className="security-dialog-device-row security-dialog-device-row--button"
                  onClick={() => setDialog({ type: "device-detail", device })}
                >
                  <div>
                    <strong>
                      {device.name}
                      {device.isCurrent ? (
                        <span className="security-current-device security-current-device--inline">本机</span>
                      ) : null}
                    </strong>
                    <span>
                      {deviceListSubtitle(device)}
                    </span>
                  </div>
                  <LineIcon name="chevron" />
                </button>
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      {dialog?.type === "operations" ? (
        <Modal title="最近使用记录" onClose={() => setDialog(null)}>
          {dialog.items === null ? (
            <p>正在加载使用记录…</p>
          ) : dialog.items.length === 0 ? (
            <p className="security-empty">暂无使用记录</p>
          ) : (
            <div className="security-operations">
              <p className="security-operations-lead">
                以下为近 30 天内最近的 10 条账号登录、切换或主动登出记录
              </p>
              {groupOperationsByDate(dialog.items).map((group) => (
                <section key={group.date} className="security-operations-group">
                  <h3 className="security-operations-date">{group.date}</h3>
                  <div className="security-operations-card">
                    {group.items.map((item) => (
                      <div key={item.id} className="security-operations-row security-operations-row--rich">
                        <span className="security-operations-icon" aria-hidden="true">
                          <LineIcon name={item.kind === "browser" ? "globe" : "desktop"} />
                        </span>
                        <div className="security-operations-row-body">
                          <strong>{item.device}</strong>
                          {item.appName ? <span className="security-operations-app">{item.appName}</span> : null}
                          <span className="security-operations-place">{operationLocationLine(item)}</span>
                        </div>
                        <div className="security-operations-trailing">
                          <span>{formatOperationTime(item.occurredAt)}</span>
                          <strong>{item.status || item.action}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      {dialog?.type === "applications" ? (
        <Modal title="应用授权管理" onClose={() => setDialog(null)}>
          {dialog.items === null ? (
            <p>正在加载授权应用…</p>
          ) : dialog.items.length === 0 ? (
            <p className="security-empty">暂无授权应用</p>
          ) : (
            <div className="security-dialog-list">
              {dialog.items.map((item) => (
                <div key={item.id} className="security-dialog-app-row">
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <div className="security-dialog-app-meta">
                    <time>授权于 {item.authorizedAt}</time>
                    <button
                      type="button"
                      className="security-danger-button"
                      disabled={pendingAction === `app-${item.id}`}
                      onClick={() => void handleRevokeApplication(item)}
                    >
                      {pendingAction === `app-${item.id}` ? "取消中…" : "取消授权"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      {toast ? (
        <div className="security-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
