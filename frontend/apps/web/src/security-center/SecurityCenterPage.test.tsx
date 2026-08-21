import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SecurityCenterPage } from "./SecurityCenterPage";
import { createMockSecurityCenterDataSource } from "./mockDataSource";

async function renderLoadedPage() {
  const user = userEvent.setup();
  render(<SecurityCenterPage dataSource={createMockSecurityCenterDataSource()} />);
  await screen.findByRole("heading", { name: "你好，Mini Auth 用户" });
  return user;
}

describe("SecurityCenterPage", () => {
  it("shows loading before rendering the account center overview", async () => {
    render(<SecurityCenterPage dataSource={createMockSecurityCenterDataSource()} />);

    expect(screen.getByText("正在加载账号中心…")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "你好，Mini Auth 用户" });
    expect(screen.getByText("Minibot账号中心")).toBeInTheDocument();
    expect(screen.getByText("登录设备")).toBeInTheDocument();
    expect(screen.getByText("授权管理")).toBeInTheDocument();
    expect(screen.queryByText("账号安全体检分")).not.toBeInTheDocument();
    expect(screen.queryByText("账号保护")).not.toBeInTheDocument();
    expect(screen.queryByText("账号管理")).not.toBeInTheDocument();
    expect(screen.queryByText("安全指引")).not.toBeInTheDocument();
  });

  it("offers retry after the initial data load fails", async () => {
    const source = createMockSecurityCenterDataSource();
    source.getSnapshot = async () => {
      throw new Error("mock unavailable");
    };

    render(<SecurityCenterPage dataSource={source} />);

    expect(await screen.findByText("账号中心加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("opens a logout action from the account menu", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "当前用户：Mini Auth 用户" }));
    const logout = screen.getByRole("menuitem", { name: "退出登录" });
    expect(logout).toHaveAttribute("href", "/logout?next=%2Flogin");
  });

  it("dedupes login devices by title name", async () => {
    await renderLoadedPage();
    expect(screen.getAllByText("Chrome")).toHaveLength(1);
    expect(screen.getAllByText("Safari")).toHaveLength(1);
  });

  it("confirms and removes a non-current login device", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "退出 Safari 登录" }));
    expect(screen.getByRole("dialog", { name: "退出此设备？" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "确认退出" }));

    await waitFor(() => {
      expect(screen.queryByText("Safari")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Safari 已退出登录");
  });

  it("loads operation history in an accessible dialog", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "操作记录" }));

    const dialog = await screen.findByRole("dialog", { name: "操作记录" });
    await waitFor(() => {
      expect(dialog).toHaveTextContent("以下为近 30 天内最近的 10 条账号登录、切换或主动登出记录");
      expect(dialog).toHaveTextContent("登录/切换账号");
      expect(dialog).toHaveTextContent("2026/08/21");
      expect(dialog).toHaveTextContent("杭州市");
    });
  });

  it("loads authorized applications and closes the dialog with Escape", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: /应用授权管理/ }));
    const dialog = await screen.findByRole("dialog", { name: "应用授权管理" });
    await waitFor(() => expect(dialog).toHaveTextContent("Minibot"));
    expect(await screen.findAllByRole("button", { name: "取消授权" })).not.toHaveLength(0);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "应用授权管理" })).not.toBeInTheDocument();
  });

  it("revokes an authorized application", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: /应用授权管理/ }));
    const revokeButtons = await screen.findAllByRole("button", { name: "取消授权" });
    await user.click(revokeButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Minibot 授权已取消");
    });
  });
});
