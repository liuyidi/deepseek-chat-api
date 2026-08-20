import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App, { createExternalLoginUrl, getNextUrl, resolveAppRoute } from "./App";

beforeEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/accounts/security/");
  vi.restoreAllMocks();
});

describe("createExternalLoginUrl", () => {
  it("targets the backend GitHub start route and encodes next once", () => {
    expect(
      createExternalLoginUrl(
        "https://auth.example/",
        "github",
        "https://auth.example/oauth/authorize?client_id=minibot&scope=openid profile",
      ),
    ).toBe(
      "https://auth.example/api/v1/auth/github/start?next=https%3A%2F%2Fauth.example%2Foauth%2Fauthorize%3Fclient_id%3Dminibot%26scope%3Dopenid+profile",
    );
  });

  it("targets the backend Google start route and encodes next once", () => {
    expect(
      createExternalLoginUrl(
        "https://auth.example/",
        "google",
        "/accounts/security/",
      ),
    ).toBe("https://auth.example/api/v1/auth/google/start?next=%2Faccounts%2Fsecurity%2F");
  });
});

describe("resolveAppRoute", () => {
  it.each([
    ["/", "login"],
    ["/demo-login", "demo-login"],
    ["/demo-login/", "demo-login"],
    ["/register", "register"],
    ["/register/", "register"],
    ["/oauth/select-account", "select-account"],
    ["/oauth/select-account/", "select-account"],
    ["/accounts", "security-redirect"],
    ["/accounts/", "security-redirect"],
    ["/accounts/security", "security"],
    ["/accounts/security/", "security"],
    ["/privacy", "privacy"],
    ["/privacy/", "privacy"],
    ["/terms", "terms"],
    ["/terms/", "terms"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(resolveAppRoute(pathname)).toBe(expected);
  });
});

describe("App", () => {
  it("renders the security center on its canonical route", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );

    render(<App />);

    expect(screen.getByText("正在加载安全中心…")).toBeInTheDocument();
    expect(screen.queryByText("Hey friend! Welcome back")).not.toBeInTheDocument();
  });

  it("does not show the login page when the auth session is already valid", async () => {
    window.history.replaceState({}, "", "/login?next=%2Faccounts%2Fsecurity%2F");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "00000000-0000-0000-0000-000000000001",
            email: "demo@mini-auth.dev",
            nickname: "demo",
            created_at: "2026-08-14T00:00:00Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    render(<App />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/v1/me", {
        credentials: "include",
      });
    });
    expect(screen.queryByRole("heading", { name: "欢迎回来" })).not.toBeInTheDocument();
  });

  it("redirects auth visits to minibot when the bot session is already valid", async () => {
    window.history.replaceState({}, "", "/login");
    const replaceSpy = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      hostname: "auth.liuyidi.me",
      search: "",
      replace: replaceSpy,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ detail: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ detail: "Refresh token required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ authenticated: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );

    render(<App />);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith("https://bot.liuyidi.me/");
    });
    expect(screen.queryByLabelText("邮箱")).not.toBeInTheDocument();
  });

  it("does not prefill the login email with the demo account", async () => {
    window.history.replaceState({}, "", "/login");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<App />);

    const email = await screen.findByLabelText("邮箱");
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("placeholder", "请输入邮箱");
  });
});

describe("getNextUrl", () => {
  it("defaults successful direct sign-in to the security center", () => {
    window.history.replaceState({}, "", "/");

    expect(getNextUrl()).toBe("/accounts/security/");
  });

  it("defaults production auth visits to minibot", () => {
    vi.stubGlobal("location", {
      ...window.location,
      search: "",
      hostname: "auth.liuyidi.me",
    });

    expect(getNextUrl()).toBe("https://bot.liuyidi.me/");
  });

  it("keeps an explicit next URL for OAuth sign-in", () => {
    const next = "https://auth.liuyidi.me/oauth/authorize?client_id=minibot";
    window.history.replaceState({}, "", `/?next=${encodeURIComponent(next)}`);

    expect(getNextUrl()).toBe(next);
  });
});
