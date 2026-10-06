import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { onboardingSchema } from "@/lib/validation";
import { USER_ROLES } from "@/lib/domain";

import { hashPassword, verifyPassword } from "../auth/crypto";
import { isGoogleConfigured } from "../auth/google";
import {
  createSession,
  destroySession,
  getSessionUser,
  requireActiveUser,
  requireUser,
} from "../auth/session";
import { getDb, mutate, newId, nowIso } from "../db/store";
import { AppError, forbidden, invalid, unauthorized } from "../errors";
import { enforceRateLimit, resetRateLimit } from "../services/rate-limit";
import { action } from "./result";

/* ------------------------------------------------------------------ */
/* Environment awareness                                               */
/* ------------------------------------------------------------------ */

export function demoLoginEnabled(): boolean {
  const explicit = process.env["HEAL_CONNECT_DEMO_LOGIN"];
  if (explicit === "false") return false;
  if (explicit === "true") return true;
  return process.env["NODE_ENV"] !== "production";
}

export type DemoAccount = {
  name: string;
  email: string;
  roleLabel: string;
  description: string;
};

const DEMO_LOGIN_EMAILS = [
  "donor@healconnect.demo",
  "recipient@healconnect.demo",
  "both@healconnect.demo",
  "admin@healconnect.demo",
] as const;

const DEMO_DESCRIPTIONS: Record<string, { roleLabel: string; description: string }> = {
  "donor@healconnect.demo": {
    roleLabel: "Donor · Verified",
    description: "O+ donor in Ghaziabad with matching requests and donor history.",
  },
  "recipient@healconnect.demo": {
    roleLabel: "Recipient · Verified",
    description: "Has an active emergency request and donor offers to review.",
  },
  "both@healconnect.demo": {
    roleLabel: "Donor & Recipient · Verified",
    description: "Gives platelets and also coordinates a family request in Noida.",
  },
  "admin@healconnect.demo": {
    roleLabel: "Administrator",
    description: "Trust & safety workspace: users, requests, reports, verifications.",
  },
};

export type AuthConfig = {
  googleConfigured: boolean;
  demoLoginEnabled: boolean;
  demoAccounts: DemoAccount[];
  demoPassword: string;
  demoAdminPassword: string;
};

export const fetchAuthConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthConfig> => {
    const database = await getDb();
    const enabled = demoLoginEnabled();
    const accounts: DemoAccount[] = enabled
      ? DEMO_LOGIN_EMAILS.flatMap((email) => {
          const user = database.users.find((row) => row.email === email);
          if (!user) return [];
          const meta = DEMO_DESCRIPTIONS[email];
          return [
            {
              name: user.name,
              email: user.email,
              roleLabel: meta?.roleLabel ?? "Demo account",
              description: meta?.description ?? "Sample account for evaluation.",
            },
          ];
        })
      : [];

    return {
      googleConfigured: isGoogleConfigured(),
      demoLoginEnabled: enabled,
      demoAccounts: accounts,
      demoPassword: "demo1234",
      demoAdminPassword: "admin1234",
    };
  },
);

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  return await getSessionUser();
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true as const, data: null };
});

/* ------------------------------------------------------------------ */
/* Credentials sign-in (used by demo accounts and early access)        */
/* ------------------------------------------------------------------ */

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signInWithPassword = createServerFn({ method: "POST" })
  .validator(credentialsSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const email = data.email.toLowerCase();
      enforceRateLimit(`signin:${email}`, 8, 5 * 60_000);

      const database = await getDb();
      const user = database.users.find((row) => row.email.toLowerCase() === email);
      const valid = user ? await verifyPassword(data.password, user.passwordHash) : false;
      if (!user || !valid) {
        throw invalid("Email or password is incorrect.");
      }
      if (user.accountStatus === "suspended") {
        throw forbidden(
          user.suspendedReason
            ? `This account is suspended: ${user.suspendedReason}`
            : "This account is suspended. Contact support.",
        );
      }

      await createSession(user.id);
      resetRateLimit(`signin:${email}`);
      return {
        redirectTo: user.onboardingComplete ? "/dashboard" : "/onboarding",
      };
    }),
  );

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "Enter your full name").max(80),
});

export const signUpWithPassword = createServerFn({ method: "POST" })
  .validator(signUpSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const email = data.email.toLowerCase();
      enforceRateLimit(`signup:${email}`, 3, 60 * 60_000);

      const database = await getDb();
      if (database.users.some((row) => row.email.toLowerCase() === email)) {
        throw invalid("An account with this email already exists.", {
          email: "An account with this email already exists.",
        });
      }

      const passwordHash = await hashPassword(data.password);
      const userId = newId("usr");
      const timestamp = nowIso();

      await mutate((db) => {
        db.users.push({
          id: userId,
          email,
          name: data.name.trim(),
          passwordHash,
          provider: "password",
          providerId: null,
          avatarUrl: null,
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

      await createSession(userId);
      return { redirectTo: "/onboarding" };
    }),
  );

/** One-tap access to the seeded demo accounts (never available in production). */
export const signInAsDemoAccount = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().trim().email() }))
  .handler(async ({ data }) =>
    action(async () => {
      if (!demoLoginEnabled()) {
        throw forbidden("Demo sign-in is disabled on this deployment.");
      }
      const database = await getDb();
      const user = database.users.find((row) => row.email === data.email && row.isDemo);
      if (!user) throw invalid("That demo account is not available.");

      await createSession(user.id);
      return {
        redirectTo: user.isAdmin
          ? "/admin"
          : user.onboardingComplete
            ? "/dashboard"
            : "/onboarding",
      };
    }),
  );

/* ------------------------------------------------------------------ */
/* Onboarding & role management                                        */
/* ------------------------------------------------------------------ */

export const completeOnboarding = createServerFn({ method: "POST" })
  .validator(onboardingSchema)
  .handler(async ({ data }) =>
    action(async () => {
      const user = await requireUser();
      const timestamp = nowIso();

      await mutate((db) => {
        const userRow = db.users.find((row) => row.id === user.id);
        if (!userRow) throw unauthorized();
        userRow.role = data.role;
        userRow.onboardingComplete = true;
        userRow.updatedAt = timestamp;

        const profile = db.profiles.find((row) => row.userId === user.id);
        if (profile) {
          profile.city = data.city;
          profile.area = data.area ? data.area : null;
          profile.phone = data.phone ? data.phone : null;
          profile.sharePhoneWithMatches = data.sharePhoneWithMatches;
          profile.updatedAt = timestamp;
        }

        if ((data.role === "donor" || data.role === "both") && data.bloodGroup) {
          const existing = db.donorProfiles.find((row) => row.userId === user.id);
          if (existing) {
            existing.bloodGroup = data.bloodGroup;
            existing.availability = data.availability ?? existing.availability;
            existing.updatedAt = timestamp;
          } else {
            db.donorProfiles.push({
              userId: user.id,
              bloodGroup: data.bloodGroup,
              lastDonationDate: null,
              availability: data.availability ?? "available",
              preferences: ["whole_blood"],
              maxTravelKm: 30,
              isVisibleToRecipients: true,
              notes: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        }

        if (data.role === "recipient") {
          db.donorProfiles = db.donorProfiles.filter((row) => row.userId !== user.id);
        }
      });

      return { role: data.role };
    }),
  );

export const updateRole = createServerFn({ method: "POST" })
  .validator(z.object({ role: z.enum(USER_ROLES) }))
  .handler(async ({ data }) =>
    action(async () => {
      const user = await requireActiveUser();
      const timestamp = nowIso();

      await mutate((db) => {
        const userRow = db.users.find((row) => row.id === user.id);
        if (!userRow) throw unauthorized();
        userRow.role = data.role;
        userRow.updatedAt = timestamp;

        if (data.role === "recipient") {
          db.donorProfiles = db.donorProfiles.filter((row) => row.userId !== user.id);
        }
      });

      return { role: data.role };
    }),
  );

export const requestAccountReview = createServerFn({ method: "POST" })
  .validator(z.object({ note: z.string().trim().max(300).optional() }))
  .handler(async ({ data }) =>
    action(async () => {
      const user = await requireUser();
      if (user.accountStatus !== "suspended") {
        throw new AppError("Your account is already active.", { status: 400 });
      }
      await mutate((db) => {
        const profile = db.profiles.find((row) => row.userId === user.id);
        if (profile) profile.updatedAt = nowIso();
      });
      console.info("[heal-connect] account review requested", user.id, data.note ?? "");
      return { received: true };
    }),
  );
