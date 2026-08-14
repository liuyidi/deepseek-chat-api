import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import App, { resolveAppRoute } from "./App";

describe("resolveAppRoute", () => {
  it.each([
    ["/", "login"],
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

    expect(screen.getByRole("heading", { name: "账号安全中心" })).toBeInTheDocument();
    expect(screen.queryByText("欢迎来到Minibot")).not.toBeInTheDocument();
  });
});
