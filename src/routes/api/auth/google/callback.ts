import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";

import {
  exchangeCodeForProfile,
  googleOAuthConfig,
  OAUTH_STATE_COOKIE,
  readOAuthState,
  sessionSecret,
} from "@/server/auth/google";
import { createSession } from "@/server/auth/session";
import { getDb, mutate, newId, nowIso } from "@/server/db/store";
import { verifyPayload } from "@/server/auth/crypto";

/**
 * Google OAuth callback.
 *
 * - Verifies the signed `state` plus the httpOnly nonce cookie.
 * - Links the Google account to an existing email or creates a new member.
 * - Starts a session and redirects to onboarding or the original target.
 */
export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const fail = (reason: string) =>
          Response.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`, 302);

        if (error) return fail(error);
        if (!code || !state) return fail("google_missing_code");
        if (!googleOAuthConfig().configured) return fail("google_not_configured");

        const parsed = await readOAuthState(state);
        const verified = await verifyPayload<{ nonce?: string; redirectTo?: string }>(
          state,
          sessionSecret(),
        );
        if (!parsed || !verified?.nonce) return fail("google_invalid_state");

        const cookieNonce = getCookie(OAUTH_STATE_COOKIE);
        deleteCookie(OAUTH_STATE_COOKIE, { path: "/" });
        if (!cookieNonce || cookieNonce !== verified.nonce) return fail("google_state_mismatch");

        let profile;
        try {
          profile = await exchangeCodeForProfile(code);
        } catch (exchangeError) {
          console.error("[heal-connect] Google OAuth exchange failed", exchangeError);
          return fail("google_exchange_failed");
        }

        const database = await getDb();
        const existing = database.users.find(
          (row) => row.email.toLowerCase() === profile.email || row.providerId === profile.sub,
        );

        let userId: string;
        let needsOnboarding: boolean;

        if (existing) {
          userId = existing.id;
          needsOnboarding = !existing.onboardingComplete;
          await mutate((db) => {
            const row = db.users.find((item) => item.id === existing.id);
            if (!row) return;
            row.provider = "google";
            row.providerId = profile.sub;
            row.avatarUrl = row.avatarUrl ?? profile.picture;
            row.lastLoginAt = nowIso();
            row.updatedAt = nowIso();
          });
        } else {
          userId = newId("usr");
          needsOnboarding = true;
          const timestamp = nowIso();
          await mutate((db) => {
            db.users.push({
              id: userId,
              email: profile.email,
              name: profile.name,
              passwordHash: null,
              provider: "google",
              providerId: profile.sub,
              avatarUrl: profile.picture,
              role: "recipient",
              isAdmin: false,
              isDemo: false,
              accountStatus: "active",
              suspendedReason: null,
              onboardingComplete: false,
              createdAt: timestamp,
              updatedAt: timestamp,
              lastLoginAt: timestamp,
            });
            db.profiles.push({
              userId,
              phone: null,
              city: null,
              area: null,
              approxLat: null,
              approxLng: null,
              bio: null,
              age: null,
              sharePhoneWithMatches: false,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          });
        }

        const user = database.users.find((row) => row.id === userId);
        if (user?.accountStatus === "suspended") {
          return fail("account_suspended");
        }

        await createSession(userId);

        const target = needsOnboarding
          ? `/onboarding?redirect=${encodeURIComponent(parsed.redirectTo)}`
          : parsed.redirectTo;
        return Response.redirect(`${origin}${target}`, 302);
      },
    },
  },
});
