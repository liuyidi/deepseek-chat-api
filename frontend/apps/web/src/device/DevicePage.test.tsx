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
  it("renders a Vercel-like device approval page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user_code: "LCKR-JRGX",
            client_id: "minibot",
            scope: "openid profile email",
            verification_uri: "https://auth.liuyidi.me/oauth/device",
            device_label: "DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)",
            location: "Tuenmen, Hong Kong",
            created_at: "2026-08-20T15:48:00.000Z",
            ip_address: "219.77.144.7",
            user_agent: "DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)",
            status: "pending",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    window.history.replaceState({}, "", "/oauth/device?user_code=lckr-jrgx");

    render(<DevicePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Approve a login from your device" })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Device code")).toHaveValue("LCKR-JRGX");
    expect(screen.getByRole("button", { name: "Allow" })).toBeInTheDocument();
    expect(screen.getByLabelText("Device code preview")).toBeInTheDocument();
    expect(screen.getByText("MINI-AUTH")).toBeInTheDocument();
    expect(screen.getByText("DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)")).toBeInTheDocument();
  });

  it("shows a completion state after approval", async () => {
    const requestResponse = new Response(
      JSON.stringify({
        user_code: "LCKR-JRGX",
        client_id: "minibot",
        scope: "openid profile email",
        verification_uri: "https://auth.liuyidi.me/oauth/device",
        device_label: "DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)",
        location: "Tuenmen, Hong Kong",
        created_at: "2026-08-20T15:48:00.000Z",
        ip_address: "219.77.144.7",
        user_agent: "DdeMacBook-Pro.local @ vercel 59.1.4 node-v22.23.1 darwin (arm64)",
        status: "pending",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    const confirmResponse = new Response(JSON.stringify({ status: "approved", user_code: "LCKR-JRGX" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(requestResponse)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(confirmResponse), 10);
            }),
        ),
    );
    window.history.replaceState({}, "", "/oauth/device?user_code=lckr-jrgx");

    render(<DevicePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Approve a login from your device" })).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole("button", { name: "Allow" }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Allowing..." })).toBeDisabled();
    });
    const loadingButton = screen.getByRole("button", { name: "Allowing..." });
    expect(loadingButton.querySelector(".device-spinner")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Approval complete" })).toBeInTheDocument();
    });
    expect(screen.getByText("demo")).toBeInTheDocument();
  });
});
