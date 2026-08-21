import { describe, expect, it, vi } from "vitest";

import { createApiSecurityCenterDataSource } from "./apiDataSource";
import { SecurityCenterError } from "./types";

describe("createApiSecurityCenterDataSource", () => {
  it("maps snapshot payloads into the page contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: {
              nickname: "Demo User",
              email: "demo@example.com",
              avatar_initials: "DU",
            },
            overview: {
              score: 72,
              level: "中",
              optimizable_items: 5,
              two_factor_enabled: false,
            },
            devices: [
              {
                id: "session-1",
                name: "Chrome",
                system: "macOS",
                logged_in_at: "2026/08/14 10:36:24",
                last_seen_at: "2026/08/14 11:00:00",
                kind: "browser",
                is_current: true,
                client_id: "minibot",
                app_name: "Minibot",
              },
            ],
            settings: [
              {
                id: "login-methods",
                title: "登录方式",
                description: "已绑定 GitHub",
                status: "set",
                icon: "user-settings",
                tone: "blue",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const source = createApiSecurityCenterDataSource("https://auth.example");
    const snapshot = await source.getSnapshot();

    expect(snapshot.user.avatarInitials).toBe("DU");
    expect(snapshot.overview.optimizableItems).toBe(5);
    expect(snapshot.devices[0].loggedInAt).toBe("2026/08/14 10:36:24");
    expect(snapshot.devices[0].lastSeenAt).toBe("2026/08/14 11:00:00");
    expect(snapshot.devices[0].appName).toBe("Minibot");
  });

  it("surfaces unauthorized responses as SecurityCenterError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const source = createApiSecurityCenterDataSource("https://auth.example");
    await expect(source.getSnapshot()).rejects.toEqual(
      expect.objectContaining<Partial<SecurityCenterError>>({ code: "UNAUTHORIZED" }),
    );
  });

  it("rejects two-factor updates until backend support exists", async () => {
    const source = createApiSecurityCenterDataSource("https://auth.example");
    await expect(source.setTwoFactorEnabled(true)).rejects.toEqual(
      expect.objectContaining<Partial<SecurityCenterError>>({ code: "NOT_SUPPORTED" }),
    );
  });
});
