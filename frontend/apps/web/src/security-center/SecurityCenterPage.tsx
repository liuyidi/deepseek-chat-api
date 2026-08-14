import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import "./security-center.css";

import type {
  AuthorizedApplication,
  SecurityCenterDataSource,
  SecurityCenterSnapshot,
  SecurityDevice,
  SecurityIconName,
  SecurityOperation,
  SecuritySetting,
} from "./types";

export type SecurityCenterPageProps = {
  dataSource: SecurityCenterDataSource;
};

type DialogState =
  | { type: "device"; device: SecurityDevice }
  | { type: "devices" }
  | { type: "operations"; items: SecurityOperation[] | null }
  | { type: "applications"; items: AuthorizedApplication[] | null }
  | { type: "info"; title: string; description: string }
  | null;

function BrandMark() {
  return (
    <span className="security-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <path d="M20 3.5 34 9v9.2c0 8.8-5.9 15.2-14 18.3C11.9 33.4 6 27 6 18.2V9l14-5.5Z" fill="currentColor" opacity=".16" />
        <path d="M20 7.8 30 11.7v6.4c0 6.3-3.9 11.1-10 14-6.1-2.9-10-7.7-10-14v-6.4l10-3.9Z" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="m14.5 19.5 3.4 3.4 7.8-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      </svg>
    </span>
  );
}

function LineIcon({ name }: { name: SecurityIconName | "globe" | "desktop" | "chevron" | "headset" | "apps" }) {
  if (name === "chevron") {
    return <span className="security-chevron" aria-hidden="true">›</span>;
  }

  const paths: Record<Exclude<typeof name, "chevron">, ReactNode> = {
    shield: <><path d="M12 3 20 6v5.5c0 5-3.2 8.4-8 10.5-4.8-2.1-8-5.5-8-10.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    "user-settings": <><circle cx="10" cy="8" r="3" /><path d="M4 19c.5-4 2.5-6 6-6 1.8 0 3.2.5 4.3 1.5" /><circle cx="17.5" cy="17.5" r="3" /><path d="M17.5 12.7v1.4m0 6.8v1.4m4.8-4.8h-1.4m-6.8 0h-1.4m8.2-3.4-1 1m-4.8 4.8-1 1m6.8 0-1-1m-4.8-4.8-1-1" /></>,
    password: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="15.5" r="1" /></>,
    passkey: <><circle cx="9" cy="9" r="4" /><path d="m12 12 7 7m-3-3 2-2m-5 5 2-2" /></>,
    otp: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 12h1m3 0h1m3 0h1" /></>,
    backup: <><path d="M5 5h12v14H5z" /><path d="M8 2h12v14M8.5 12l2 2 4-4" /></>,
    "secure-password": <><path d="M12 3 20 6v5.5c0 5-3.2 8.4-8 10.5-4.8-2.1-8-5.5-8-10.5V6l8-3Z" /><rect x="13" y="14" width="7" height="6" rx="1" /><path d="M15 14v-1.5a1.5 1.5 0 0 1 3 0V14" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    headset: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><path d="M4 12h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5ZM17 20c-1 1-2.5 1-4 1" /></>,
    apps: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  };

  return (
    <svg className="security-line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
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

function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  const titleId = `security-dialog-${title.replace(/\s/g, "-")}`;
  return (
    <div className="security-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="security-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="security-modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="security-icon-button" aria-label="关闭弹窗" onClick={onClose}>×</button>
        </div>
        <div className="security-modal-body">{children}</div>
        {footer ? <div className="security-modal-footer">{footer}</div> : null}
      </section>
    </div>
  );
}

function StatusTag({ isSet, testId }: { isSet: boolean; testId?: string }) {
  return <span className={`security-status security-status--${isSet ? "set" : "unset"}`} data-testid={testId}>{isSet ? "已设置" : "未设置"}</span>;
}

export function SecurityCenterPage({ dataSource }: SecurityCenterPageProps) {
  const [snapshot, setSnapshot] = useState<SecurityCenterSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const firstUnsetRef = useRef<HTMLButtonElement>(null);

  const loadSnapshot = useCallback(async () => {
    setLoadError(false);
    try {
      setSnapshot(await dataSource.getSnapshot());
    } catch {
      setLoadError(true);
    }
  }, [dataSource]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Mini Auth 账号安全中心";
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

  const showInfo = (title: string, description: string) => setDialog({ type: "info", title, description });

  const handleTwoFactor = async () => {
    if (!snapshot || pendingAction) return;
    const enabled = !snapshot.overview.twoFactorEnabled;
    setPendingAction("two-factor");
    try {
      const overview = await dataSource.setTwoFactorEnabled(enabled);
      setSnapshot((current) => current ? {
        ...current,
        overview,
        settings: current.settings.map((setting) => setting.id === "two-factor" ? { ...setting, status: enabled ? "set" : "unset" } : setting),
      } : current);
      setToast(enabled ? "两步验证已开启" : "两步验证已关闭");
    } catch {
      setToast("操作失败，请稍后重试");
    } finally {
      setPendingAction(null);
    }
  };

  const handleRevokeDevice = async (device: SecurityDevice) => {
    setPendingAction(`device-${device.id}`);
    try {
      await dataSource.revokeDevice(device.id);
      setSnapshot((current) => current ? { ...current, devices: current.devices.filter((item) => item.id !== device.id) } : current);
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
      setDialog((current) => current?.type === "operations" ? { ...current, items } : current);
    } catch {
      setDialog(null);
      setToast("操作记录加载失败");
    }
  };

  const openApplications = async () => {
    setDialog({ type: "applications", items: null });
    try {
      const items = await dataSource.getAuthorizedApplications();
      setDialog((current) => current?.type === "applications" ? { ...current, items } : current);
    } catch {
      setDialog(null);
      setToast("授权应用加载失败");
    }
  };

  if (!snapshot) {
    return (
      <main className="security-page security-page--state">
        <BrandMark />
        {loadError ? (
          <div className="security-state-card" role="alert">
            <h1>安全中心加载失败</h1>
            <p>暂时无法读取账号安全信息，请稍后重试。</p>
            <button type="button" onClick={() => void loadSnapshot()}>重新加载</button>
          </div>
        ) : <p>正在加载安全中心…</p>}
      </main>
    );
  }

  const { user, overview, devices, settings } = snapshot;
  const firstUnsetId = settings.find((setting) => setting.status === "unset" && !setting.toggle)?.id;

  return (
    <div className="security-page">
      <header className="security-topbar">
        <a className="security-brand" href="/accounts/security/">
          <BrandMark />
          <span>Mini Auth 账号安全中心</span>
        </a>
        <div className="security-topbar-actions">
          <button className="security-icon-button" type="button" aria-label="帮助中心" onClick={() => showInfo("帮助中心", "安全中心帮助文档将在后端能力接入后开放。")}><LineIcon name="headset" /></button>
          <span className="security-avatar security-avatar--small" aria-label={`当前用户：${user.nickname}`}>{user.avatarInitials}</span>
        </div>
      </header>

      <main className="security-main">
        <section className="security-hero">
          <span className="security-avatar">{user.avatarInitials}</span>
          <h1>你好，{user.nickname}</h1>
          <p>欢迎来到账号安全中心，你可以在这里配置你的 <strong>Mini Auth</strong> 账号安全设置</p>
        </section>

        <div className="security-grid">
          <div className="security-column">
            <Panel title="账号安全体检分" className="security-score-card">
              <div className="security-score-layout">
                <div className="security-gauge" aria-label={`安全评分 ${overview.score} 分`} style={{ "--security-score": overview.score } as React.CSSProperties}>
                  <div className="security-gauge-number">{overview.score}</div>
                  <span>安全等级：{overview.level}</span>
                </div>
                <div className="security-score-summary">
                  <div>可优化项： <strong>{overview.optimizableItems}</strong></div>
                  <p>请及时优化确保账号安全</p>
                  <button type="button" className="security-primary-button" onClick={() => firstUnsetRef.current?.focus()}>前往优化</button>
                </div>
              </div>
            </Panel>

            <Panel title="登录设备" action={<button type="button" className="security-text-button" onClick={() => void openOperations()}>操作记录 <LineIcon name="chevron" /></button>}>
              <div className="security-device-list">
                {devices.slice(0, 3).map((device) => (
                  <div className="security-device-row" key={device.id}>
                    <span className="security-device-icon"><LineIcon name={device.kind === "browser" ? "globe" : "desktop"} /></span>
                    <div className="security-device-content">
                      <strong>{device.name}</strong>
                      <span>系统：{device.system}</span>
                      <span>登录时间：{device.loggedInAt}</span>
                    </div>
                    {device.isCurrent ? <span className="security-current-device">本机</span> : (
                      <button type="button" className="security-outline-button" aria-label={`退出 ${device.name} 登录`} onClick={() => setDialog({ type: "device", device })}>退出登录</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="security-view-all" onClick={() => setDialog({ type: "devices" })}><span />查看全部设备 <LineIcon name="chevron" /><span /></button>
            </Panel>

            <Panel title="账号管理">
              <div className="security-simple-list">
                <button type="button" onClick={() => showInfo("账号申诉", "如果无法修改邮箱或重置密码，可通过账号申诉恢复访问。")}> 
                  <span><strong>账号申诉</strong><small>如果你无法修改邮箱，或无法重置密码，可点击申诉</small></span><LineIcon name="chevron" />
                </button>
                <button type="button" className="security-danger-row" onClick={() => showInfo("账号注销", "账号注销功能将在真实身份校验与数据删除能力接入后开放。")}> 
                  <span><strong>账号注销</strong><small>永久注销你的 Mini Auth 账号，注销成功后账号将无法使用</small></span><LineIcon name="chevron" />
                </button>
              </div>
            </Panel>
          </div>

          <div className="security-column">
            <Panel title="账号保护" className="security-protection-card">
              <div className="security-setting-list">
                {settings.map((setting) => {
                  const isTwoFactor = setting.id === "two-factor";
                  const isFirstUnset = setting.id === firstUnsetId;
                  return (
                    <div className={`security-setting-row security-setting-row--${setting.tone}`} key={setting.id}>
                      <span className="security-setting-icon"><LineIcon name={setting.icon} /></span>
                      <div className="security-setting-copy">
                        <div><strong>{setting.title}</strong><StatusTag isSet={setting.status === "set"} testId={isTwoFactor ? "two-factor-status" : undefined} /></div>
                        <p>{setting.description}</p>
                      </div>
                      {isTwoFactor ? (
                        <button type="button" role="switch" aria-label="两步验证" aria-checked={overview.twoFactorEnabled} disabled={pendingAction === "two-factor"} className="security-switch" onClick={() => void handleTwoFactor()}><span /></button>
                      ) : (
                        <button ref={isFirstUnset ? firstUnsetRef : undefined} type="button" className="security-row-action" aria-label={`${setting.title}，${setting.status === "set" ? "已设置" : "未设置"}`} onClick={() => showInfo(setting.title, `${setting.description}。当前为前端演示，暂未连接后端。`)}><LineIcon name="chevron" /></button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="安全管理">
              <button type="button" className="security-management-row" onClick={() => void openApplications()}>
                <span className="security-management-icon"><LineIcon name="apps" /></span>
                <span><strong>应用授权管理</strong><small>查看有权获取你账号信息的应用授权详情，并管理授权</small></span>
                <LineIcon name="chevron" />
              </button>
            </Panel>

            <Panel title="安全指引">
              <div className="security-guide-grid">
                <button type="button" onClick={() => showInfo("帮助中心", "这里将提供登录、验证方式与账号恢复相关的安全指引。")}>帮助中心 <span className="security-guide-art"><BrandMark /></span></button>
                <button type="button" onClick={() => showInfo("在线客服", "在线客服正在建设中，当前页面仅展示交互效果。")}>在线客服 <span className="security-guide-art"><LineIcon name="headset" /></span></button>
              </div>
            </Panel>
          </div>
        </div>

        <footer className="security-footer">当前登录账号：{user.nickname}（{user.email}）</footer>
      </main>

      {dialog?.type === "device" ? (
        <Modal title="退出此设备？" onClose={() => setDialog(null)} footer={<><button type="button" className="security-secondary-button" onClick={() => setDialog(null)}>取消</button><button type="button" className="security-danger-button" disabled={pendingAction === `device-${dialog.device.id}`} onClick={() => void handleRevokeDevice(dialog.device)}>{pendingAction ? "正在退出…" : "确认退出"}</button></>}>
          <p>退出后，{dialog.device.name} 需要重新完成身份验证才能访问 Mini Auth。</p>
        </Modal>
      ) : null}

      {dialog?.type === "devices" ? (
        <Modal title="全部登录设备" onClose={() => setDialog(null)}>
          <div className="security-dialog-list">{devices.map((device) => <div key={device.id}><strong>{device.name}</strong><span>{device.system} · {device.loggedInAt}{device.isCurrent ? " · 本机" : ""}</span></div>)}</div>
        </Modal>
      ) : null}

      {dialog?.type === "operations" ? (
        <Modal title="操作记录" onClose={() => setDialog(null)}>
          {dialog.items ? <div className="security-dialog-list">{dialog.items.map((item) => <div key={item.id}><strong>{item.action}</strong><span>{item.device} · {item.location}</span><time>{item.occurredAt}</time></div>)}</div> : <p>正在加载操作记录…</p>}
        </Modal>
      ) : null}

      {dialog?.type === "applications" ? (
        <Modal title="应用授权管理" onClose={() => setDialog(null)}>
          {dialog.items ? <div className="security-dialog-list">{dialog.items.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.description}</span><time>授权于 {item.authorizedAt}</time></div>)}</div> : <p>正在加载授权应用…</p>}
        </Modal>
      ) : null}

      {dialog?.type === "info" ? <Modal title={dialog.title} onClose={() => setDialog(null)}><p>{dialog.description}</p></Modal> : null}
      {toast ? <div className="security-toast" role="status">{toast}</div> : null}
    </div>
  );
}
