import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WebLoginPage } from "./WebLoginPage";

describe("WebLoginPage", () => {
  it("starts email login and reveals the verification code field", async () => {
    const user = userEvent.setup();
    const onSendCode = vi.fn().mockResolvedValue({
      email: "hello@mini.dev",
      expires_in: 300,
      resend_after_seconds: 30,
      debug_code: "123456",
    });

    render(
      <WebLoginPage
        brand="Minibot"
        headline="Hey friend! Welcome back"
        demoEmail=""
        onSendCode={onSendCode}
        onVerifyCode={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("邮箱"), "Hello@Mini.Dev");
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(onSendCode).toHaveBeenCalledWith("hello@mini.dev");
    expect(await screen.findByLabelText("验证码已发送至 hello@mini.dev")).toBeInTheDocument();
    expect(screen.getByText("调试验证码：123456")).toBeInTheDocument();
  });

  it("renders Chinese by default and switches to English", async () => {
    const user = userEvent.setup();

    render(
      <WebLoginPage
        brand="Minibot"
        headline="Hey friend! Welcome back"
        demoEmail=""
        demoLoginHref="/demo-login"
        onSendCode={vi.fn()}
        onVerifyCode={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用 Google 继续，暂未接入" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "使用 GitHub 继续，暂未接入" })).toBeDisabled();
    expect(screen.getAllByText("暂未接入")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Demo 账号登录" })).toHaveAttribute("href", "/demo-login");
    expect(screen.getByRole("button", { name: "Switch to English" })).toBeInTheDocument();
    expect(screen.queryByText("Sign in with SSO")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Minibot")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to English" }));

    expect(screen.getByRole("heading", { name: "Hey friend! Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google, coming soon" })).toBeDisabled();
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Demo account login" })).toHaveAttribute("href", "/demo-login");
    expect(screen.getByRole("button", { name: "切换到中文" })).toBeInTheDocument();
  });

  it("requires username when registering", async () => {
    const user = userEvent.setup();
    const onSendCode = vi.fn();

    render(
      <WebLoginPage
        brand="Minibot"
        headline="Create your Minibot account"
        mode="register"
        demoEmail=""
        onSendCode={onSendCode}
        onVerifyCode={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("用户名")).toBeInTheDocument();
    expect(screen.getByText("已有账号？")).toBeInTheDocument();

    await user.type(screen.getByLabelText("邮箱"), "hello@mini.dev");
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(onSendCode).not.toHaveBeenCalled();
    expect(screen.getByText("请输入用户名。")).toBeInTheDocument();
  });

  it("passes username when verifying a registration code", async () => {
    const user = userEvent.setup();
    const onSendCode = vi.fn().mockResolvedValue({
      email: "hello@mini.dev",
      expires_in: 300,
      resend_after_seconds: 30,
      debug_code: "123456",
    });
    const onVerifyCode = vi.fn().mockResolvedValue(undefined);

    render(
      <WebLoginPage
        brand="Minibot"
        headline="Create your Minibot account"
        mode="register"
        demoEmail=""
        onSendCode={onSendCode}
        onVerifyCode={onVerifyCode}
      />,
    );

    await user.type(screen.getByLabelText("用户名"), "Yidi");
    await user.type(screen.getByLabelText("邮箱"), "hello@mini.dev");
    await user.click(screen.getByRole("button", { name: "继续" }));
    await screen.findByLabelText("验证码已发送至 hello@mini.dev");
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(onVerifyCode).toHaveBeenCalledWith("hello@mini.dev", "123456", { username: "Yidi" });
  });
});
