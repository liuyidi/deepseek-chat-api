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
  it("renders the original compact approval layout with device details", async () => {
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
    expect(screen.queryByLabelText("Device code preview")).not.toBeInTheDocument();
    expect(screen.getByText("mini-auth")).toBeInTheDocument();
    expect(screen.getByText("demo@mini-auth.dev")).toBeInTheDocument();
    expect(screen.getByLabelText("Device information")).toBeInTheDocument();
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
              setTimeout(() => resolve(confirmResponse), 100);
            }),
        ),
    );
    window.history.replaceState({}, "", "/oauth/device?user_code=lckr-jrgx");

    render(<DevicePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Approve a login from your device" })).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole("button", { name: "Allow" }).closest("form")!);

    const loadingButton = await screen.findByRole("button", { name: "Allowing..." });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton.querySelector(".device-spinner")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "You can return to your device now" })).toBeInTheDocument();
    });
    expect(screen.getByText("Approved for demo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Device information")).not.toBeInTheDocument();
  });
});
