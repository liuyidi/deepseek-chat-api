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
  it("shows loading before rendering the complete security overview", async () => {
    render(<SecurityCenterPage dataSource={createMockSecurityCenterDataSource()} />);

    expect(screen.getByText("正在加载安全中心…")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "你好，Mini Auth 用户" });
    expect(screen.getByText("账号安全体检分")).toBeInTheDocument();
    expect(screen.getByText("账号保护")).toBeInTheDocument();
    expect(screen.getByText("登录设备")).toBeInTheDocument();
  });

  it("offers retry after the initial data load fails", async () => {
    const source = createMockSecurityCenterDataSource();
    source.getSnapshot = async () => {
      throw new Error("mock unavailable");
    };

    render(<SecurityCenterPage dataSource={source} />);

    expect(await screen.findByText("安全中心加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("updates the score after enabling two-step verification", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("switch", { name: "两步验证" }));

    await waitFor(() => {
      expect(screen.getByLabelText("安全评分 82 分")).toBeInTheDocument();
    });
    expect(screen.getByTestId("two-factor-status")).toHaveTextContent("已设置");
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
      expect(dialog).toHaveTextContent("邮箱验证码登录");
      expect(dialog).toHaveTextContent("浙江省杭州市");
    });
  });

  it("loads authorized applications and closes the dialog with Escape", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: /应用授权管理/ }));
    const dialog = await screen.findByRole("dialog", { name: "应用授权管理" });
    await waitFor(() => expect(dialog).toHaveTextContent("Minibot"));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "应用授权管理" })).not.toBeInTheDocument();
  });

  it("moves focus to the first unset setting when optimizing", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("button", { name: "前往优化" }));

    expect(screen.getByRole("button", { name: /登录密码/ })).toHaveFocus();
  });
});
