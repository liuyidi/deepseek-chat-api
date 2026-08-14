import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import App, { getNextUrl, resolveAppRoute } from "./App";

describe("resolveAppRoute", () => {
  it.each([
    ["/", "login"],
    ["/demo-login", "demo-login"],
    ["/demo-login/", "demo-login"],
    ["/register", "register"],
    ["/register/", "register"],
    ["/accounts", "security-redirect"],
    ["/accounts/", "security-redirect"],
    ["/accounts/security", "security"],
    ["/accounts/security/", "security"],
  ] as const)("maps %s to %s", (pathname, expected) => {
    expect(resolveAppRoute(pathname)).toBe(expected);
  });
});

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/accounts/security/");
  });

  it("renders the security center on its canonical route", () => {
    render(<App />);

    expect(screen.getByText("正在加载安全中心…")).toBeInTheDocument();
    expect(screen.queryByText("Hey friend! Welcome back")).not.toBeInTheDocument();
  });
});

describe("getNextUrl", () => {
  it("defaults successful direct sign-in to the security center", () => {
    window.history.replaceState({}, "", "/");

    expect(getNextUrl()).toBe("/accounts/security/");
  });

  it("keeps an explicit next URL for OAuth sign-in", () => {
    const next = "https://auth.liuyidi.me/oauth/authorize?client_id=minibot";
    window.history.replaceState({}, "", `/?next=${encodeURIComponent(next)}`);

    expect(getNextUrl()).toBe(next);
  });
});
