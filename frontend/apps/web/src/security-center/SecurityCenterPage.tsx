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
  | { type: "devices" }
  | { type: "operations"; items: SecurityOperation[] | null }
  | { type: "applications"; items: AuthorizedApplication[] | null }
  | { type: "revoke-app"; app: AuthorizedApplication }
  | null;

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
      {children}
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
        current ? { ...current, devices: current.devices.filter((item) => item.id !== device.id) } : current,
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
          <span>账号中心</span>
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
          <p>欢迎来到账号中心，你可以在这里管理登录设备与应用授权</p>
        </section>

        <div className="security-grid">
          <div className="security-column">
            <Panel
              title="登录设备"
              action={
                <button type="button" className="security-text-button" onClick={() => void openOperations()}>
                  操作记录 <LineIcon name="chevron" />
                </button>
              }
            >
              <div className="security-device-list">
                {devices.length === 0 ? (
                  <p className="security-empty">暂无登录设备</p>
                ) : (
                  devices.slice(0, 3).map((device) => (
                    <div className="security-device-row" key={device.id}>
                      <span className="security-device-icon">
                        <LineIcon name={device.kind === "browser" ? "globe" : "desktop"} />
                      </span>
                      <div className="security-device-content">
                        <strong>{device.name}</strong>
                        <span>
                          系统：{device.system}
                          {device.appName ? ` · 来自 ${device.appName}` : ""}
                        </span>
                        <span>登录：{device.loggedInAt}</span>
                        <span>最近活跃：{device.lastSeenAt}</span>
                      </div>
                      {device.isCurrent ? (
                        <span className="security-current-device">本机</span>
                      ) : (
                        <button
                          type="button"
                          className="security-outline-button"
                          aria-label={`退出 ${device.name} 登录`}
                          onClick={() => setDialog({ type: "device", device })}
                        >
                          退出登录
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {devices.length > 0 ? (
                <button type="button" className="security-view-all" onClick={() => setDialog({ type: "devices" })}>
                  <span />
                  查看全部设备 <LineIcon name="chevron" />
                  <span />
                </button>
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
                  <small>查看有权获取你账号信息的应用授权详情，并管理授权</small>
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

      {dialog?.type === "devices" ? (
        <Modal title="全部登录设备" onClose={() => setDialog(null)}>
          {devices.length === 0 ? (
            <p className="security-empty">暂无登录设备</p>
          ) : (
            <div className="security-dialog-list">
              {devices.map((device) => (
                <div key={device.id} className="security-dialog-device-row">
                  <div>
                    <strong>{device.name}</strong>
                    <span>
                      {device.system} · 登录 {device.loggedInAt}
                      {device.isCurrent ? " · 本机" : ""}
                    </span>
                  </div>
                  {device.isCurrent ? null : (
                    <button
                      type="button"
                      className="security-outline-button"
                      aria-label={`退出 ${device.name} 登录`}
                      onClick={() => setDialog({ type: "device", device })}
                    >
                      退出登录
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      {dialog?.type === "operations" ? (
        <Modal title="操作记录" onClose={() => setDialog(null)}>
          {dialog.items === null ? (
            <p>正在加载操作记录…</p>
          ) : dialog.items.length === 0 ? (
            <p className="security-empty">暂无操作记录</p>
          ) : (
            <div className="security-dialog-list">
              {dialog.items.map((item) => (
                <div key={item.id}>
                  <strong>{item.action}</strong>
                  <span>
                    {item.device} · {item.location}
                  </span>
                  <time>{item.occurredAt}</time>
                </div>
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
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                    <time>授权于 {item.authorizedAt}</time>
                  </div>
                  <button
                    type="button"
                    className="security-danger-button"
                    disabled={pendingAction === `app-${item.id}`}
                    onClick={() => void handleRevokeApplication(item)}
                  >
                    {pendingAction === `app-${item.id}` ? "取消中…" : "取消授权"}
                  </button>
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
