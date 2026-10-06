import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";

import { signPayload, verifyPayload } from "./crypto";

/**
 * Google OAuth 2.0 (authorization code flow).
 *
 * Configure with environment variables:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI   (optional — defaults to <origin>/api/auth/google/callback)
 *   SESSION_SECRET        (optional — falls back to a development key)
 *
 * When credentials are absent the login screen explains that Google sign-in is
 * not configured for this deployment and offers the demo sign-in instead, so the
 * product can still be evaluated end to end.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
export const OAUTH_STATE_COOKIE = "hc_oauth_state";

function readEnv(key: string): string | null {
  const fromProcess = typeof process !== "undefined" && process.env ? process.env[key] : undefined;
  if (fromProcess) return fromProcess;
  return null;
}

export function sessionSecret(): string {
  return readEnv("SESSION_SECRET") ?? "heal-connect-development-secret";
}

export function googleOAuthConfig() {
  const clientId = readEnv("GOOGLE_CLIENT_ID");
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET");
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
    redirectUri: readEnv("GOOGLE_REDIRECT_URI"),
  };
}

export function isGoogleConfigured(): boolean {
  return googleOAuthConfig().configured;
}

function currentOrigin(): string {
  try {
    const url = new URL(getRequestUrl());
    const forwardedHost = getRequestHeader("x-forwarded-host");
    const forwardedProto = getRequestHeader("x-forwarded-proto");
    if (forwardedHost) {
      return `${forwardedProto ?? url.protocol.replace(":", "")}://${forwardedHost}`;
    }
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function resolveRedirectUri(): string {
  const configured = readEnv("GOOGLE_REDIRECT_URI");
  if (configured) return configured;
  return `${currentOrigin()}/api/auth/google/callback`;
}

export async function buildGoogleAuthorizationUrl(redirectTo: string): Promise<string> {
  const { clientId } = googleOAuthConfig();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");

  const state = await signPayload(
    { redirectTo, nonce: crypto.randomUUID(), issuedAt: Date.now() },
    sessionSecret(),
  );

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", resolveRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return url.toString();
}

export async function readOAuthState(state: string): Promise<{ redirectTo: string } | null> {
  const payload = await verifyPayload<{ redirectTo?: string }>(state, sessionSecret());
  if (!payload) return null;
  return { redirectTo: payload.redirectTo ?? "/dashboard" };
}

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  emailVerified: boolean;
};

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = googleOAuthConfig();
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: resolveRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status})`);
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) throw new Error("Google did not return an access token");

  const userResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${tokenPayload.access_token}` },
  });
  if (!userResponse.ok) throw new Error(`Google userinfo failed (${userResponse.status})`);

  const profile = (await userResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };

  if (!profile.sub || !profile.email) throw new Error("Google profile is missing required claims");

  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name?.trim() || profile.email.split("@")[0] || "Heal Connect member",
    picture: profile.picture ?? null,
    emailVerified: Boolean(profile.email_verified),
  };
}
