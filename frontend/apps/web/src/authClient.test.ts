import { afterEach, describe, expect, it, vi } from "vitest";

import { createWebAuthClient } from "./authClient";

describe("createWebAuthClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "mini_auth_access_token=; Path=/; Max-Age=0";
    document.cookie = "mini_auth_refresh_token=; Path=/; Max-Age=0";
  });

  it("falls back to the dev mock code flow when local fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    vi.stubEnv("VITE_AUTH_MOCK", "true");

    const client = createWebAuthClient("http://127.0.0.1:8000");
    const result = await client.startEmailLogin("Hello@Mini.Dev");

    expect(result).toMatchObject({
      email: "hello@mini.dev",
      debug_code: "123456",
    });

    await expect(client.verifyEmailLogin("hello@mini.dev", "123456")).resolves.toBeUndefined();
    expect(document.cookie).toContain("mini_auth_access_token=mini-auth-dev-access-token");
  });

  it("keeps backend validation errors instead of using mock fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Too many requests" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = createWebAuthClient("http://127.0.0.1:8000");

    await expect(client.startEmailLogin("hello@mini.dev")).rejects.toThrow("Too many requests");
  });

  it("sends nickname when verifying an email code with a username", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tokens: {
            access_token: "access",
            refresh_token: "refresh",
            token_type: "bearer",
            expires_in: 1800,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createWebAuthClient("http://127.0.0.1:8000");
    await client.verifyEmailLogin("hello@mini.dev", "123456", { username: "Yidi" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "hello@mini.dev",
      code: "123456",
      nickname: "Yidi",
    });
  });

  it("requests a backend demo session without email verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "00000000-0000-0000-0000-000000000001",
            email: "demo@mini-auth.dev",
            nickname: "demo",
            created_at: "2026-08-14T00:00:00Z",
          },
          tokens: {
            access_token: "access",
            refresh_token: "refresh",
            token_type: "bearer",
            expires_in: 1800,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createWebAuthClient("http://127.0.0.1:8000");

    await client.demoLogin({
      email: "demo@mini-auth.dev",
      username: "demo",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/v1/auth/demo-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "demo@mini-auth.dev",
        nickname: "demo",
      }),
    });
    expect(document.cookie).toContain("mini_auth_access_token=access");
  });

  it("reads the current authenticated user from the backend session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createWebAuthClient("https://auth.liuyidi.me");
    await expect(client.getCurrentUser()).resolves.toMatchObject({
      email: "demo@mini-auth.dev",
      nickname: "demo",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://auth.liuyidi.me/api/v1/me", {
      credentials: "include",
    });
  });

  it("refreshes an expired access cookie before reading the current user", async () => {
    document.cookie = "mini_auth_refresh_token=old-refresh; Path=/; SameSite=Lax";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            token_type: "bearer",
            expires_in: 1800,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
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
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = createWebAuthClient("https://auth.liuyidi.me");
    await expect(client.getCurrentUser()).resolves.toMatchObject({
      email: "demo@mini-auth.dev",
      nickname: "demo",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://auth.liuyidi.me/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: "old-refresh" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://auth.liuyidi.me/api/v1/me", {
      credentials: "include",
    });
    expect(document.cookie).toContain("mini_auth_access_token=new-access");
  });

  it("refreshes with an HttpOnly cookie when JavaScript cannot read the token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Not authenticated" }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 1800 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ email: "person@example.com", nickname: "Octo" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = createWebAuthClient("https://auth.liuyidi.me");
    await expect(client.getCurrentUser()).resolves.toEqual({ email: "person@example.com", nickname: "Octo" });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://auth.liuyidi.me/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });
});
