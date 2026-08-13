import { AuthSdkError } from "./errors";
import type { BuildAuthorizeUrlParams, PkcePair } from "../types";

type BufferNamespace = {
  from(input: Uint8Array): {
    toString(encoding: "base64"): string;
  };
};

function toBase64(buffer: Uint8Array): string {
  const bufferGlobal = globalThis as typeof globalThis & { Buffer?: BufferNamespace };

  if (bufferGlobal.Buffer) {
    return bufferGlobal.Buffer.from(buffer).toString("base64");
  }

  if (typeof globalThis.btoa === "function") {
    let binary = "";
    for (const byte of buffer) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }

  throw new AuthSdkError("Base64 encoding is not supported in this runtime.");
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createPkcePair(): Promise<PkcePair> {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto.subtle) {
    throw new AuthSdkError("PKCE requires Web Crypto support.");
  }

  const verifierBytes = new Uint8Array(64);
  globalThis.crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(digest);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

export function buildAuthorizeUrl(params: BuildAuthorizeUrlParams): string {
  const search = new URLSearchParams();
  search.set("response_type", params.responseType ?? "code");
  search.set("client_id", params.clientId);
  search.set("redirect_uri", params.redirectUri);
  search.set("scope", Array.isArray(params.scope) ? params.scope.join(" ") : params.scope ?? "openid profile email");
  search.set("code_challenge", params.codeChallenge);
  search.set("code_challenge_method", params.codeChallengeMethod ?? "S256");

  if (params.state) {
    search.set("state", params.state);
  }

  if (params.nonce) {
    search.set("nonce", params.nonce);
  }

  return `${params.authorizationEndpoint.replace(/\/+$/, "")}?${search.toString()}`;
}

