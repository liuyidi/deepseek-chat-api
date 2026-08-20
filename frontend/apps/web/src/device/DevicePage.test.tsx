import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DevicePage, buildDeviceVerificationUrl } from "./DevicePage";

vi.mock("../authClient", () => ({
  createWebAuthClient: () => ({
    getCurrentUser: async () => ({
      email: "demo@mini-auth.dev",
      nickname: "demo",
    }),
  }),
}));

describe("buildDeviceVerificationUrl", () => {
  it("normalizes user codes into the verification url", () => {
    expect(buildDeviceVerificationUrl("lckr-jrgx")).toBe("/oauth/device?user_code=LCKR-JRGX");
  });
});

describe("DevicePage", () => {
  it("renders a Vercel-like device approval card", async () => {
    window.history.replaceState({}, "", "/oauth/device?user_code=lckr-jrgx");

    render(<DevicePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Approve a login from your device" })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Device code")).toHaveValue("LCKR-JRGX");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByText("demo@mini-auth.dev")).toBeInTheDocument();
  });

  it("shows a completion state after approval", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "approved", user_code: "LCKR-JRGX" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    window.history.replaceState({}, "", "/oauth/device?user_code=lckr-jrgx");

    render(<DevicePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Approve a login from your device" })).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole("button", { name: "Continue" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "You can return to your device now" })).toBeInTheDocument();
    });
    expect(screen.getByText("Approved for demo")).toBeInTheDocument();
  });
});
