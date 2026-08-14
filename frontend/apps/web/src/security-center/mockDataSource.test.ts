import { describe, expect, it } from "vitest";

import { createMockSecurityCenterDataSource } from "./mockDataSource";

describe("createMockSecurityCenterDataSource", () => {
  it("returns a medium-risk overview with exactly one current device", async () => {
    const source = createMockSecurityCenterDataSource();

    const snapshot = await source.getSnapshot();

    expect(snapshot.overview).toMatchObject({
      score: 70,
      level: "中",
      optimizableItems: 6,
      twoFactorEnabled: false,
    });
    expect(snapshot.devices.filter((device) => device.isCurrent)).toHaveLength(1);
  });

  it("raises the score and marks two-step verification as configured", async () => {
    const source = createMockSecurityCenterDataSource();

    const overview = await source.setTwoFactorEnabled(true);
    const snapshot = await source.getSnapshot();

    expect(overview).toMatchObject({
      score: 82,
      optimizableItems: 5,
      twoFactorEnabled: true,
    });
    expect(snapshot.settings.find((setting) => setting.id === "two-factor")?.status).toBe("set");
  });

  it("removes a non-current device from subsequent snapshots", async () => {
    const source = createMockSecurityCenterDataSource();

    await source.revokeDevice("safari-iphone");
    const snapshot = await source.getSnapshot();

    expect(snapshot.devices.some((device) => device.id === "safari-iphone")).toBe(false);
  });

  it("rejects attempts to revoke the current device", async () => {
    const source = createMockSecurityCenterDataSource();

    await expect(source.revokeDevice("chrome-mac-current")).rejects.toMatchObject({
      code: "CURRENT_DEVICE",
    });
  });
});
