import type { VercelRequest, VercelResponse } from "@vercel/node";

type ExchangeRequestBody = {
  code?: unknown;
  code_verifier?: unknown;
};

type GoogleProfile = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
};

function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

function jsonError(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ error });
}

async function exchangeWithGoogle(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<GoogleProfile> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "mini-auth-google-oauth-relay",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as
    | { access_token?: unknown; error?: unknown }
    | null;

  if (!tokenResponse.ok) {
    throw new Error("provider_exchange_failed");
  }

  const accessToken = tokenPayload?.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("provider_exchange_failed");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "mini-auth-google-oauth-relay",
    },
  });

  const profile = (await profileResponse.json().catch(() => null)) as GoogleProfile | null;
  if (!profileResponse.ok || !profile || typeof profile !== "object") {
    throw new Error("provider_exchange_failed");
  }

  return profile;
}

function normalizeProfile(profile: GoogleProfile) {
  const subject = profile.sub;
  const email = profile.email;
  const emailVerified = profile.email_verified;
  if (typeof subject !== "string" || !subject) {
    throw new Error("provider_identity_invalid");
  }
  if (emailVerified !== true || typeof email !== "string" || !email.trim()) {
    throw new Error("verified_email_required");
  }

  const name = profile.name;
  const picture = profile.picture;
  return {
    sub: subject,
    email: email.trim().toLowerCase(),
    email_verified: true,
    name: typeof name === "string" && name.trim() ? name.trim() : undefined,
    picture: typeof picture === "string" ? picture : undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "method_not_allowed");
  }

  let sharedSecret: string;
  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;
  try {
    sharedSecret = requiredEnv("GOOGLE_RELAY_SHARED_SECRET");
    clientId = requiredEnv("GOOGLE_CLIENT_ID");
    clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
    redirectUri = requiredEnv("GOOGLE_REDIRECT_URI");
  } catch {
    return jsonError(res, 500, "relay_misconfigured");
  }

  const token = readBearerToken(req.headers.authorization);
  if (!token || token !== sharedSecret) {
    return jsonError(res, 401, "unauthorized");
  }

  const body = (req.body ?? {}) as ExchangeRequestBody;
  const code = typeof body.code === "string" ? body.code : "";
  const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier : "";
  if (!code || !codeVerifier) {
    return jsonError(res, 400, "invalid_request");
  }

  try {
    const profile = await exchangeWithGoogle(clientId, clientSecret, redirectUri, code, codeVerifier);
    return res.status(200).json(normalizeProfile(profile));
  } catch (error) {
    const codeName = error instanceof Error ? error.message : "provider_exchange_failed";
    if (codeName === "verified_email_required") {
      return jsonError(res, 422, "verified_email_required");
    }
    if (codeName === "provider_identity_invalid") {
      return jsonError(res, 502, "provider_identity_invalid");
    }
    return jsonError(res, 502, "provider_exchange_failed");
  }
}
