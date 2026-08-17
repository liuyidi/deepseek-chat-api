import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SelectAccountPage,
  buildAuthorizeContinueUrl,
  buildSwitchAccountLogoutUrl,
} from "./SelectAccountPage";

describe("select-account URL helpers", () => {
  it("adds account_confirmed=1 for continue", () => {
    expect(
      buildAuthorizeContinueUrl(
        "?response_type=code&client_id=minibot&redirect_uri=minibot%3A%2F%2Fauth%2Fcallback&state=abc",
      ),
    ).toBe(
      "/oauth/authorize?response_type=code&client_id=minibot&redirect_uri=minibot%3A%2F%2Fauth%2Fcallback&state=abc&account_confirmed=1",
    );
  });

  it("builds logout → login → authorize for switch account", () => {
    const url = buildSwitchAccountLogoutUrl(
      "?client_id=minibot&redirect_uri=minibot%3A%2F%2Fauth%2Fcallback",
    );
    expect(url.startsWith("/logout?next=")).toBe(true);
    const next = decodeURIComponent(url.slice("/logout?next=".length));
    expect(next.startsWith("/login?next=")).toBe(true);
    const authorize = decodeURIComponent(next.slice("/login?next=".length));
    expect(authorize).toBe("/oauth/authorize?client_id=minibot&redirect_uri=minibot%3A%2F%2Fauth%2Fcallback");
  });
});

describe("SelectAccountPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the current account and actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "00000000-0000-0000-0000-000000000001",
            email: "demo@mini-auth.dev",
            nickname: "一流的人",
            created_at: "2026-08-14T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    render(
      <SelectAccountPage
        authBaseUrl="http://127.0.0.1:8000"
        search="?client_id=minibot&redirect_uri=minibot%3A%2F%2Fauth%2Fcallback"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "选择账号" })).toBeInTheDocument();
    });
    expect(screen.getByText("一流的人")).toBeInTheDocument();
    expect(screen.getByText("个人版")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /一流的人/ })).toHaveAttribute(
      "href",
      "/oauth/authorize?client_id=minibot&redirect_uri=minibot%3A%2F%2Fauth%2Fcallback&account_confirmed=1",
    );
    expect(screen.getByRole("link", { name: "切换登录用户" }).getAttribute("href")).toContain(
      "/logout?next=",
    );
  });
});
