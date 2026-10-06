import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";

import {
  buildGoogleAuthorizationUrl,
  googleOAuthConfig,
  OAUTH_STATE_COOKIE,
  sessionSecret,
} from "@/server/auth/google";
import { redirectResponse } from "@/server/auth/google";
import { randomToken, signPayload } from "@/server/auth/crypto";

/** Sanitises the post-login redirect so it can never leave the site. */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export const Route = createFileRoute("/api/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectTo = safeRedirect(url.searchParams.get("redirect"));

        if (!googleOAuthConfig().configured) {
          return redirectResponse(
            new URL(
              "/login?error=google_not_configured",
              `${url.protocol}//${url.host}`,
            ).toString(),
            302,
          );
        }

        const nonce = randomToken(16);
        const state = await signPayload({ redirectTo, nonce }, sessionSecret());

        setCookie(OAUTH_STATE_COOKIE, nonce, {
          httpOnly: true,
          sameSite: "lax",
          secure: url.protocol === "https:",
          path: "/",
          maxAge: 600,
        });

        const authorizationUrl = await buildGoogleAuthorizationUrl(redirectTo);
        const withState = new URL(authorizationUrl);
        withState.searchParams.set("state", state);

        return redirectResponse(withState.toString(), 302);
      },
    },
  },
});
