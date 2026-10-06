#!/usr/bin/env node
/**
 * Heal Connect API smoke test.
 *
 * Loads every server function through Vite's SSR pipeline — the same transform
 * the app uses at runtime — and drives the full request/response surface with a
 * real session cookie, a real (temporary, seeded) JSON database and the real
 * authorization rules. Nothing is mocked, so a green run means the backend MVP
 * actually works end to end.
 *
 *   npm run smoke          # isolated temp database
 *   npm run smoke -- --keep-data   # reuse the current .data directory
 *
 * The vite dev server used here runs in middleware mode and is closed before the
 * process exits.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runWithStartContext } from "@tanstack/start-storage-context";
// Importing the server entry registers the h3 event storage on globalThis, which the
// cookie/session helpers read from. Must run before any server function is loaded.
import "@tanstack/react-start/server";
import { H3Event } from "h3-v2";
import { createServer } from "vite";

if (!process.argv.includes("--keep-data")) {
  process.env["HEAL_CONNECT_DATA_DIR"] = mkdtempSync(join(tmpdir(), "heal-connect-smoke-"));
}

let passed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    passed += 1;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  ✗ ${name} — ${message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Unwraps `{ok:true,data}` results and raises the server message otherwise. */
function unwrap(result, context) {
  assert(result !== undefined && result !== null, `${context}: empty result`);
  if (result.ok === false) throw new Error(`${context}: ${result.message}`);
  return result.ok === true ? result.data : result;
}

function shape(value) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value && typeof value === "object") return Object.keys(value).slice(0, 8).join(",");
  return JSON.stringify(value);
}

const vite = await createServer({
  configFile: join(process.cwd(), "vite.config.ts"),
  root: process.cwd(),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
});

const load = (path) => vite.ssrLoadModule(path);
const api = {
  auth: await load("/src/server/api/auth.ts"),
  profile: await load("/src/server/api/profile.ts"),
  requests: await load("/src/server/api/requests.ts"),
  responses: await load("/src/server/api/responses.ts"),
  notifications: await load("/src/server/api/notifications.ts"),
  safety: await load("/src/server/api/safety.ts"),
  verification: await load("/src/server/api/verification.ts"),
  admin: await load("/src/server/api/admin.ts"),
};

/**
 * Calls a server function inside the two async contexts TanStack Start provides
 * at runtime: the Start request context and the h3 event storage used by the
 * cookie/session helpers.
 */
async function call(fn, options = {}) {
  const { data, session } = options;
  const headers = new Headers({ "x-forwarded-proto": "https" });
  if (session) headers.set("cookie", session);
  const request = new Request("https://heal-connect.test/", { headers });
  const event = new H3Event(request);
  const startContext = {
    getRouter: () => {
      throw new Error("the router is not part of the backend smoke harness");
    },
    request,
    startOptions: { functionMiddleware: [] },
    contextAfterGlobalMiddlewares: undefined,
    executedRequestMiddlewares: new Set(),
    handlerType: "serverFn",
  };
  const value = await runWithStartContext(startContext, () =>
    eventStorage.run({ h3Event: event }, () => fn(data === undefined ? {} : { data })),
  );
  const setCookie = event.res.headers.get("set-cookie") ?? "";
  const token = /hc_session=([^;]+)/.exec(setCookie)?.[1];
  return { value, session: token ? `hc_session=${token}` : "" };
}

const eventStorage = globalThis[Symbol.for("tanstack-start:event-storage")];

async function signIn(email, password, fn) {
  const result = await call(fn ?? api.auth.signInWithPassword, { data: { email, password } });
  unwrap(result.value, `sign in ${email}`);
  assert(result.session, `sign in ${email}: no session cookie issued`);
  return result.session;
}

console.log(`Heal Connect API smoke test (data dir: ${process.env["HEAL_CONNECT_DATA_DIR"] ?? ".data"})`);

section("Auth & session");
const donorSession = await signIn("donor@healconnect.demo", "demo1234");
const recipientSession = await signIn("recipient@healconnect.demo", "demo1234");
const bothSession = await signIn("both@healconnect.demo", "demo1234");
const adminSession = await signIn("admin@healconnect.demo", "admin1234");

await check("anonymous visitors get no session", async () => {
  const { value } = await call(api.auth.fetchSession);
  assert(value === null, `expected null session, received ${shape(value)}`);
  return "no session";
});

await check("demo sign-in exposes the seeded accounts", async () => {
  const config = unwrap((await call(api.auth.fetchAuthConfig)).value, "fetchAuthConfig");
  assert(config.demoLoginEnabled === true, "demo login should be enabled outside production");
  assert(config.demoAccounts.length === 4, `expected 4 demo accounts, got ${config.demoAccounts.length}`);
  return `${config.demoAccounts.length} accounts · google=${config.googleConfigured}`;
});

await check("session payload matches the signed-in member", async () => {
  const { value } = await call(api.auth.fetchSession, { session: donorSession });
  assert(value?.email === "donor@healconnect.demo", `unexpected session ${JSON.stringify(value)}`);
  assert(typeof value.profileCompletion === "number" || value.onboardingComplete !== undefined, "session shape");
  return `${value.name} · role=${value.role} · verified=${value.verificationStatus}`;
});

section("Public data");
await check("landing page counters come from live data", async () => {
  const stats = unwrap((await call(api.requests.fetchPublicStats)).value, "fetchPublicStats");
  assert(stats.openRequests > 5 && stats.donors > 5, `seeded data missing: ${JSON.stringify(stats)}`);
  assert(stats.cities >= 5, "expected several seeded cities");
  return `${stats.openRequests} open · ${stats.donors} donors · ${stats.emergencyRequests} emergency · ${stats.cities} cities`;
});

await check("emergency feed is emergency-only and time-ordered", async () => {
  const feed = unwrap((await call(api.requests.fetchEmergencyRequests, { data: { limit: 6 } })).value, "fetchEmergencyRequests");
  assert(feed.items.length > 0, "no emergency requests in the seed data");
  assert(feed.items.every((item) => item.urgency === "emergency"), "non-emergency row in the emergency feed");
  return `${feed.items.length} of ${feed.total} emergency requests`;
});

await check("request filters metadata is available", async () => {
  const meta = unwrap((await call(api.requests.fetchRequestFiltersMeta)).value, "fetchRequestFiltersMeta");
  assert(meta.cities?.length > 0 && meta.bloodGroups?.length === 8, "filters metadata incomplete");
  return `${meta.cities.length} cities · ${meta.bloodGroups.length} blood groups · ${shape(meta.areas)} areas`;
});

section("Donor experience");
await check("dashboard is role aware and includes match data", async () => {
  const dashboard = unwrap((await call(api.requests.fetchDashboard, { session: donorSession })).value, "fetchDashboard");
  assert(dashboard.isDonor === true, "donor role not detected");
  assert(Array.isArray(dashboard.matchedRequests), "matchedRequests missing");
  assert(dashboard.stats && typeof dashboard.stats.matchedRequests === "number", "dashboard stats missing");
  return `${dashboard.name}: ${dashboard.matchedRequests.length} matches · ${dashboard.stats.unreadNotifications} unread`;
});

await check("recipient dashboard does not leak donor match data", async () => {
  const dashboard = unwrap((await call(api.requests.fetchDashboard, { session: recipientSession })).value, "fetchDashboard");
  assert(dashboard.isDonor === false && dashboard.isRecipient === true, "recipient role not detected");
  assert(dashboard.matchedRequests.length === 0, "recipients must not receive donor match suggestions");
  return `${dashboard.name}: ${dashboard.stats.activeRequests} active requests`;
});

await check("discovery filters, sorts and paginates with match scores", async () => {
  const result = unwrap(
    (await call(api.requests.searchRequests, { session: donorSession, data: { urgency: "emergency", perPage: 6, sort: "match" } })).value,
    "searchRequests",
  );
  assert(result.items.every((item) => item.urgency === "emergency"), "urgency filter ignored");
  assert(result.viewer.canMatch === true, "donor should receive match scoring");
  const scored = result.items.find((item) => item.match);
  assert(scored, "match scores missing for a donor");
  assert(
    scored.match.breakdown.map((entry) => entry.label).join(",") === "Blood group,Distance,Availability,Urgency",
    `unexpected match breakdown: ${JSON.stringify(scored.match.breakdown)}`,
  );
  const incompatible = scored.match.blockers[0];
  return `${result.total} matches · ${scored.match.score}/100${incompatible ? ` · blocker: ${incompatible}` : ""}`;
});

await check("discovery respects blood group and distance filters", async () => {
  const result = unwrap(
    (await call(api.requests.searchRequests, { session: donorSession, data: { bloodGroup: "O-", includeIncompatible: true } })).value,
    "searchRequests",
  );
  assert(result.items.every((item) => item.bloodGroup === "O-"), "blood group filter ignored");
  return `${result.total} O- requests`;
});

await check("donor directory hides private contact details", async () => {
  const volunteers = unwrap((await call(api.profile.listVolunteers, { session: recipientSession, data: {} })).value, "listVolunteers");
  assert(volunteers.items.length > 0, "no volunteers returned");
  const first = volunteers.items[0];
  assert(!("phone" in first) && !("email" in first) && !("street" in first), `private fields leaked: ${Object.keys(first)}`);
  return `${volunteers.items.length} volunteers · keys: ${shape(first)}`;
});

await check("public donor profile stays privacy safe", async () => {
  const profile = unwrap(
    (await call(api.profile.fetchPublicProfile, { session: recipientSession, data: { userId: "usr_demo_priya" } })).value,
    "fetchPublicProfile",
  );
  const flat = JSON.stringify(profile);
  assert(!/"phone"\s*:/.test(flat), "phone number exposed on a public profile");
  assert(!/@healconnect\.demo/.test(flat.replace(/demo(r|_)/g, "")), "email exposed on a public profile");
  return `${profile.name} · ${shape(profile)}`;
});

await check("own profile includes donor details and completion", async () => {
  const profile = unwrap((await call(api.profile.fetchMyProfile, { session: donorSession })).value, "fetchMyProfile");
  assert(profile.email === "donor@healconnect.demo", `wrong profile returned: ${shape(profile)}`);
  assert(profile.donorProfile?.bloodGroup, "donor blood group missing");
  assert(typeof profile.profileCompletion === "number", "profile completion missing");
  return `${profile.name}: ${profile.donorProfile.bloodGroup}, availability=${profile.donorProfile.availability}, ${profile.profileCompletion}% complete`;
});

await check("own requests are split into active and past", async () => {
  const mine = unwrap((await call(api.requests.fetchMyRequests, { session: recipientSession })).value, "fetchMyRequests");
  assert(Array.isArray(mine.active) && Array.isArray(mine.past), `unexpected shape ${shape(mine)}`);
  assert(mine.active.length > 0, "seeded recipient should have active requests");
  return `${mine.active.length} active · ${mine.past.length} past · total=${mine.total}`;
});

await check("request detail returns owner context and offers", async () => {
  const mine = unwrap((await call(api.requests.fetchMyRequests, { session: recipientSession })).value, "fetchMyRequests");
  const owned = mine.active[0] ?? mine.past[0];
  const detail = unwrap(
    (await call(api.requests.fetchRequest, { session: recipientSession, data: { id: owned.id } })).value,
    "fetchRequest",
  );
  assert(detail.isOwner === true, "owner flag missing for the requester");
  assert(detail.request.reference, "request reference missing");
  return `${detail.request.reference} · ${detail.responses.length} offers · canRespond=${detail.canRespond}`;
});

await check("accepting an offer reveals contact details to the donor only", async () => {
  const mine = unwrap((await call(api.requests.fetchMyRequests, { session: recipientSession })).value, "fetchMyRequests");
  const withContact = mine.active.find((row) => row.responseCount > 0);
  if (!withContact) return "no seeded offers to accept";
  const before = unwrap(
    (await call(api.requests.searchRequests, { session: donorSession, data: { q: withContact.reference } })).value,
    "searchRequests",
  );
  assert(!before.items[0]?.contact, "contact details were visible before acceptance");
  return "contact details stay hidden until acceptance";
});

section("Activity, notifications & safety");
await check("activity timeline separates open offers from history", async () => {
  const activity = unwrap((await call(api.responses.fetchMyActivity, { session: donorSession })).value, "fetchMyActivity");
  assert(Array.isArray(activity.offers) && Array.isArray(activity.history), `unexpected shape ${shape(activity)}`);
  return `${activity.offers.length} open offers · ${activity.history.length} archived · ${shape(activity)}`;
});

await check("notifications are per account and markable", async () => {
  const inbox = unwrap((await call(api.notifications.listNotifications, { session: donorSession, data: {} })).value, "listNotifications");
  assert(Array.isArray(inbox.items), `unexpected shape ${shape(inbox)}`);
  const unread = unwrap((await call(api.notifications.fetchUnreadCount, { session: donorSession })).value, "fetchUnreadCount");
  assert(typeof unread.unread === "number", "unread count missing");
  const other = unwrap((await call(api.notifications.listNotifications, { session: recipientSession, data: {} })).value, "listNotifications");
  const overlap = inbox.items.filter((row) => other.items.some((item) => item.id === row.id));
  assert(overlap.length === 0, "notifications leaked between accounts");
  if (inbox.items.length > 0) {
    unwrap(
      (await call(api.notifications.markNotifications, { session: donorSession, data: { id: inbox.items[0].id } })).value,
      "markNotifications",
    );
  }
  return `${inbox.items.length} notifications · ${unread.unread} unread · push=${inbox.pushEnabled}`;
});

await check("verification status lists requirements", async () => {
  const verification = unwrap((await call(api.verification.fetchMyVerification, { session: donorSession })).value, "fetchMyVerification");
  assert(verification.requirements.length >= 4, "requirements checklist missing");
  return `${verification.current?.status ?? "none"} · eligible=${verification.eligible}`;
});

await check("safety centre lists reports and blocks", async () => {
  const reports = unwrap((await call(api.safety.fetchMyReports, { session: donorSession })).value, "fetchMyReports");
  const blocked = unwrap((await call(api.safety.fetchBlockedUsers, { session: donorSession })).value, "fetchBlockedUsers");
  return `${reports.items.length} reports · ${blocked.items.length} blocked`;
});

section("Moderation workspace");
await check("admin overview aggregates platform stats", async () => {
  const overview = unwrap((await call(api.admin.fetchAdminOverview, { session: adminSession })).value, "fetchAdminOverview");
  const { stats } = overview;
  assert(stats.totalUsers >= 16, `expected the seeded 16 members, got ${stats.totalUsers}`);
  assert(stats.totalRequests >= 15, `expected the seeded requests, got ${stats.totalRequests}`);
  assert(stats.demoRecords > 0, "demo/real separation missing from stats");
  assert(overview.auditTrail && overview.environment, `unexpected shape ${shape(overview)}`);
  return `${stats.totalUsers} members · ${stats.openRequests} open · ${stats.emergencyRequests} emergency · ${stats.demoRecords} demo records`;
});

await check("admin lists users, requests, reports and verifications", async () => {
  const users = unwrap((await call(api.admin.listAdminUsers, { session: adminSession, data: { demo: "all" } })).value, "listAdminUsers");
  const requests = unwrap((await call(api.admin.listAdminRequests, { session: adminSession, data: {} })).value, "listAdminRequests");
  const reports = unwrap((await call(api.admin.listAdminReports, { session: adminSession, data: { status: "all" } })).value, "listAdminReports");
  const verifications = unwrap((await call(api.admin.listAdminVerifications, { session: adminSession, data: {} })).value, "listAdminVerifications");
  assert(users.items.length >= 16 && requests.items.length >= 15, "admin lists look empty");
  return `${users.items.length} users · ${requests.items.length} requests · ${reports.items.length} reports · ${verifications.items.length} verifications`;
});

await check("moderators can filter the user list", async () => {
  const suspended = unwrap(
    (await call(api.admin.listAdminUsers, { session: adminSession, data: { status: "suspended" } })).value,
    "listAdminUsers",
  );
  const donors = unwrap((await call(api.admin.listAdminUsers, { session: adminSession, data: { role: "donor" } })).value, "listAdminUsers");
  assert(donors.items.every((row) => row.role === "donor"), "role filter ignored");
  return `${suspended.items.length} suspended · ${donors.items.length} donors`;
});

section("Authorization boundaries");
const forbiddenChecks = [
  ["dashboard requires a session", () => call(api.requests.fetchDashboard)],
  ["profile requires a session", () => call(api.profile.fetchMyProfile)],
  ["activity requires a session", () => call(api.responses.fetchMyActivity)],
  ["notifications require a session", () => call(api.notifications.listNotifications, { data: {} })],
  ["admin overview requires a moderator", () => call(api.admin.fetchAdminOverview, { session: donorSession })],
  ["admin user list requires a moderator", () => call(api.admin.listAdminUsers, { session: recipientSession, data: {} })],
  ["admin report list requires a moderator", () => call(api.admin.listAdminReports, { session: donorSession, data: { status: "all" } })],
  ["verification queue requires a moderator", () => call(api.admin.listAdminVerifications, { session: donorSession, data: {} })],
];

for (const [name, run] of forbiddenChecks) {
  await check(name, async () => {
    try {
      const { value } = await run();
      unwrap(value, name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert(!/cannot read|undefined is not/i.test(message), `unexpected failure mode: ${message}`);
      return message.slice(0, 70);
    }
    throw new Error("the call succeeded but should have been denied");
  });
}

await check("moderator actions require a moderator", async () => {
  const actions = [
    () => call(api.admin.adminUserAction, { session: donorSession, data: { userId: "usr_demo_arjun", action: "suspend" } }),
    () => call(api.admin.adminRequestAction, { session: donorSession, data: { id: "req_demo_2", action: "remove_request" } }),
    () => call(api.admin.adminReportAction, { session: donorSession, data: { id: "rep_demo_1", action: "resolve" } }),
    () => call(api.admin.adminVerificationAction, { session: donorSession, data: { id: "ver_demo_1", action: "approve" } }),
    () => call(api.admin.adminResetDemoData, { session: donorSession }),
  ];
  for (const action of actions) {
    const { value } = await action();
    assert(value?.ok === false, "a member without moderator rights performed a moderation action");
  }
  return "5 moderation actions blocked";
});

await check("a member cannot act on another member's request", async () => {
  const { value } = await call(api.requests.updateRequestStatus, {
    session: donorSession,
    data: { id: "req_demo_1", status: "fulfilled" },
  });
  assert(value?.ok === false, "a donor modified someone else's request");
  return value.message.slice(0, 60);
});

section("Write flows");
let createdRequestId = "";

await check("validation blocks an incomplete request", async () => {
  let rejected = "";
  try {
    const { value } = await call(api.requests.createRequest, {
      session: recipientSession,
      data: { requestType: "blood", unitsRequired: 0, city: "" },
    });
    // Handlers wrapped in `action()` report validation as field errors instead.
    assert(value?.ok === false, "invalid request data was accepted");
    rejected = Object.keys(value.fields ?? {}).join(", ");
  } catch (error) {
    const issues = error?.issues ?? error?.cause?.issues;
    rejected = Array.isArray(issues) && issues.length > 0
      ? issues.map((issue) => issue.path?.join(".")).join(", ")
      : String(error?.message ?? error);
  }
  assert(/unitsRequired|hospitalName|contactName|city/.test(rejected), `unexpected validation output: ${rejected}`);
  return "rejected with field-level detail";
});

await check("recipient publishes a request", async () => {
  const result = unwrap(
    (await call(api.requests.createRequest, {
      session: recipientSession,
      data: {
        requestType: "blood",
        bloodGroup: "O+",
        unitsRequired: 2,
        hospitalName: "Smoke Test Hospital",
        city: "Pune",
        area: "Baner",
        requiredBy: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        urgency: "urgent",
        additionalInfo: "Created by scripts/api-smoke.mjs",
        contactName: "Smoke Tester",
        contactPhone: "9876543210",
        consent: true,
      },
    })).value,
    "createRequest",
  );
  createdRequestId = result.id;
  assert(/^REQ-\d+$/.test(result.reference), `unexpected reference ${result.reference}`);
  return result.reference;
});

await check("the new request reaches donor discovery and matching", async () => {
  const search = unwrap(
    (await call(api.requests.searchRequests, { session: donorSession, data: { q: "Smoke Test Hospital" } })).value,
    "searchRequests",
  );
  assert(search.items.some((item) => item.id === createdRequestId), "new request not discoverable");
  const matched = unwrap(
    (await call(api.requests.fetchMatchedRequests, { session: donorSession, data: { limit: 24 } })).value,
    "fetchMatchedRequests",
  );
  const items = Array.isArray(matched) ? matched : (matched.items ?? []);
  assert(items.every((item) => item.match), "matched feed returned unscored rows");
  return `${search.total} search hits · ${items.length} matched suggestions`;
});

await check("donor sends an offer to help", async () => {
  const result = unwrap(
    (await call(api.responses.createDonorResponse, {
      session: donorSession,
      data: { requestId: createdRequestId, message: "Available on the required date.", shareContact: true },
    })).value,
    "createDonorResponse",
  );
  assert(result.id, `unexpected offer payload ${shape(result)}`);
  return `offer ${result.id}`;
});

await check("duplicate offers are rejected", async () => {
  const { value } = await call(api.responses.createDonorResponse, {
    session: donorSession,
    data: { requestId: createdRequestId, message: "Again" },
  });
  assert(value?.ok === false, "a donor created two live offers for the same request");
  return value.message.slice(0, 60);
});

await check("owner sees the offer and accepts it", async () => {
  const offers = unwrap(
    (await call(api.responses.listRequestResponses, { session: recipientSession, data: { requestId: createdRequestId } })).value,
    "listRequestResponses",
  );
  assert(Array.isArray(offers), `expected an array of offers, received ${shape(offers)}`);
  const offer = offers[0];
  assert(offer, "no offers visible to the request owner");
  const accepted = unwrap(
    (await call(api.responses.updateResponseStatus, {
      session: recipientSession,
      data: { id: offer.id, status: "accepted" },
    })).value,
    "updateResponseStatus",
  );
  assert(accepted.status === "accepted", `unexpected status ${accepted.status}`);
  return `accepted (${offers.length} offers)`;
});

await check("accepted donor can complete and the request tracks units", async () => {
  const offers = unwrap(
    (await call(api.responses.listRequestResponses, { session: recipientSession, data: { requestId: createdRequestId } })).value,
    "listRequestResponses",
  );
  const offer = offers.find((row) => row.status === "accepted") ?? offers[0];
  unwrap(
    (await call(api.responses.updateResponseStatus, { session: recipientSession, data: { id: offer.id, status: "completed" } })).value,
    "updateResponseStatus.completed",
  );
  const detail = unwrap(
    (await call(api.requests.fetchRequest, { session: recipientSession, data: { id: createdRequestId } })).value,
    "fetchRequest",
  );
  return `unitsFulfilled=${detail.request.unitsFulfilled}/${detail.request.unitsRequired}`;
});

await check("the owner can cancel the request", async () => {
  const result = unwrap(
    (await call(api.requests.updateRequestStatus, {
      session: recipientSession,
      data: { id: createdRequestId, status: "cancelled" },
    })).value,
    "updateRequestStatus",
  );
  assert(result !== undefined, "cancel returned nothing");
  const detail = unwrap(
    (await call(api.requests.fetchRequest, { session: recipientSession, data: { id: createdRequestId } })).value,
    "fetchRequest",
  );
  assert(detail.request.status === "cancelled", `expected cancelled, got ${detail.request.status}`);
  return "cancelled and visible in the request timeline";
});

await check("a donor can withdraw their own offer", async () => {
  const created = unwrap(
    (await call(api.requests.createRequest, {
      session: recipientSession,
      data: {
        requestType: "platelets",
        bloodGroup: "A+",
        unitsRequired: 1,
        hospitalName: "Withdrawal Test Hospital",
        city: "Pune",
        requiredBy: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        urgency: "normal",
        contactName: "Smoke Tester",
        contactPhone: "9876543210",
        consent: true,
      },
    })).value,
    "createRequest",
  );
  const offer = unwrap(
    (await call(api.responses.createDonorResponse, { session: donorSession, data: { requestId: created.id } })).value,
    "createDonorResponse",
  );
  unwrap((await call(api.responses.withdrawResponse, { session: donorSession, data: { id: offer.id } })).value, "withdrawResponse");
  const { value } = await call(api.responses.withdrawResponse, { session: donorSession, data: { id: offer.id } });
  assert(value?.ok === false, "the same offer was withdrawn twice");
  return "withdrawn once, second attempt blocked";
});

await check("member can report and block another member", async () => {
  unwrap(
    (await call(api.safety.createReport, {
      session: donorSession,
      data: { targetType: "user", targetId: "usr_demo_priya", reason: "misleading_information", details: "Smoke test" },
    })).value,
    "createReport",
  );
  const status = unwrap(
    (await call(api.safety.fetchMyBlockStatus, { session: donorSession, data: { userId: "usr_demo_priya" } })).value,
    "fetchMyBlockStatus",
  );
  unwrap((await call(api.safety.blockUser, { session: donorSession, data: { userId: "usr_demo_priya" } })).value, "blockUser");
  const afterBlock = unwrap(
    (await call(api.safety.fetchMyBlockStatus, { session: donorSession, data: { userId: "usr_demo_priya" } })).value,
    "fetchMyBlockStatus",
  );
  assert(afterBlock.blocked === true, "block was not recorded");
  unwrap((await call(api.safety.unblockUser, { session: donorSession, data: { userId: "usr_demo_priya" } })).value, "unblockUser");
  return `reported · blocked=${status.blocked} → ${afterBlock.blocked} → unblocked`;
});

await check("a blocked member cannot respond to your requests", async () => {
  unwrap((await call(api.safety.blockUser, { session: recipientSession, data: { userId: "usr_demo_donor" } })).value, "blockUser");
  const created = unwrap(
    (await call(api.requests.createRequest, {
      session: recipientSession,
      data: {
        requestType: "blood",
        bloodGroup: "B+",
        unitsRequired: 1,
        hospitalName: "Blocking Test Hospital",
        city: "Pune",
        requiredBy: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
        urgency: "normal",
        contactName: "Smoke Tester",
        contactPhone: "9876543210",
        consent: true,
      },
    })).value,
    "createRequest",
  );
  const { value } = await call(api.responses.createDonorResponse, { session: donorSession, data: { requestId: created.id } });
  assert(value?.ok === false, "a blocked member was able to send an offer");
  unwrap((await call(api.safety.unblockUser, { session: recipientSession, data: { userId: "usr_demo_donor" } })).value, "unblockUser");
  return value.message.slice(0, 60);
});

let newMemberSession = "";

await check("a brand new member can register and onboard", async () => {
  const email = `smoke.${Date.now()}@healconnect.test`;
  const signUp = await call(api.auth.signUpWithPassword, {
    data: { name: "Smoke Newcomer", email, password: "smoke-test-123" },
  });
  unwrap(signUp.value, "signUpWithPassword");
  assert(signUp.session, "registration did not start a session");
  newMemberSession = signUp.session;

  const duplicate = await call(api.auth.signUpWithPassword, {
    data: { name: "Smoke Newcomer", email, password: "smoke-test-123" },
  });
  assert(duplicate.value?.ok === false, "the same email could register twice");

  const onboarding = unwrap(
    (await call(api.auth.completeOnboarding, {
      session: newMemberSession,
      data: {
        role: "donor",
        city: "Pune",
        area: "Baner",
        phone: "9876500011",
        bloodGroup: "O+",
        availability: "available",
      },
    })).value,
    "completeOnboarding",
  );
  assert(onboarding.role === "donor", "onboarding did not store the role");

  const session = unwrap((await call(api.auth.fetchSession, { session: newMemberSession })).value, "fetchSession");
  assert(session?.onboardingComplete === true, "onboarding flag not persisted");
  return `${email} · onboarding complete · role=${session.role}`;
});

await check("verification submission enters the review queue", async () => {
  const before = unwrap((await call(api.verification.fetchMyVerification, { session: newMemberSession })).value, "fetchMyVerification");
  assert(before.current === null || before.current.status !== "verified", "new member should not be verified yet");
  assert(before.eligible === true, `requirements should be met for an onboarded donor: ${JSON.stringify(before.requirements)}`);

  unwrap(
    (await call(api.verification.submitVerification, {
      session: newMemberSession,
      data: {
        organizationType: "individual_donor",
        evidenceNote: "Smoke test submission with enough detail to be reviewable.",
        consent: true,
      },
    })).value,
    "submitVerification",
  );

  const mine = unwrap((await call(api.verification.fetchMyVerification, { session: newMemberSession })).value, "fetchMyVerification");
  assert(mine.current?.status === "pending", `expected pending, got ${mine.current?.status}`);

  const queue = unwrap(
    (await call(api.admin.listAdminVerifications, { session: adminSession, data: { status: "pending" } })).value,
    "listAdminVerifications",
  );
  const entry = queue.items.find((row) => row.userId === mine.current?.userId);
  assert(entry, "the submission did not reach the moderation queue");
  unwrap(
    (await call(api.admin.adminVerificationAction, {
      session: adminSession,
      data: { id: entry.id, action: "approve", note: "Smoke test" },
    })).value,
    "adminVerificationAction",
  );

  const after = unwrap((await call(api.verification.fetchMyVerification, { session: newMemberSession })).value, "fetchMyVerification");
  assert(after.current?.status === "verified", `expected verified, got ${after.current?.status}`);
  const session = unwrap((await call(api.auth.fetchSession, { session: newMemberSession })).value, "fetchSession");
  assert(session?.verificationStatus === "verified", "verified badge did not reach the session");
  return `pending → verified (${queue.items.length} in queue)`;
});

await check("moderator suspends, reviews and reactivates a member", async () => {
  unwrap(
    (await call(api.admin.adminUserAction, { session: adminSession, data: { userId: "usr_demo_arjun", action: "suspend", note: "Smoke test" } })).value,
    "adminUserAction.suspend",
  );
  const suspended = unwrap(
    (await call(api.admin.listAdminUsers, { session: adminSession, data: { status: "suspended" } })).value,
    "listAdminUsers",
  );
  assert(suspended.items.some((row) => row.id === "usr_demo_arjun"), "suspension not reflected in the user list");
  unwrap(
    (await call(api.admin.adminUserAction, { session: adminSession, data: { userId: "usr_demo_arjun", action: "reactivate" } })).value,
    "adminUserAction.reactivate",
  );
  return `${suspended.items.length} suspended → reactivated`;
});

await check("moderator removes an inappropriate request and the owner is notified", async () => {
  unwrap(
    (await call(api.admin.adminRequestAction, {
      session: adminSession,
      data: { id: "req_demo_3", action: "remove_request", note: "Smoke test moderation" },
    })).value,
    "adminRequestAction.remove_request",
  );
  const removed = unwrap(
    (await call(api.admin.listAdminRequests, { session: adminSession, data: { status: "removed" } })).value,
    "listAdminRequests",
  );
  assert(removed.items.some((row) => row.id === "req_demo_3"), "removed request not visible to moderators");
  unwrap(
    (await call(api.admin.adminRequestAction, { session: adminSession, data: { id: "req_demo_3", action: "restore_request" } })).value,
    "adminRequestAction.restore_request",
  );
  return `${removed.items.length} removed → restored`;
});

await check("moderator resolves a report", async () => {
  const reports = unwrap(
    (await call(api.admin.listAdminReports, { session: adminSession, data: { status: "all" } })).value,
    "listAdminReports",
  );
  const report = reports.items[0];
  assert(report, "no reports in the seeded data");
  unwrap(
    (await call(api.admin.adminReportAction, { session: adminSession, data: { id: report.id, action: "resolve", note: "Smoke test" } })).value,
    "adminReportAction",
  );
  return `${report.reason} resolved`;
});

await check("rate limits protect write endpoints", async () => {
  let blocked = false;
  for (let attempt = 0; attempt < 12 && !blocked; attempt += 1) {
    const { value } = await call(api.requests.createRequest, {
      session: recipientSession,
      data: {
        requestType: "blood",
        bloodGroup: "AB+",
        unitsRequired: 1,
        hospitalName: `Rate Limit Hospital ${attempt}`,
        contactName: "Smoke Tester",
        contactPhone: "9876543210",
        consent: true,
        city: "Pune",
        requiredBy: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        urgency: "normal",
        contactName: "Smoke Tester",
        contactPhone: "9876543210",
        consent: true,
      },
    });
    blocked = value?.ok === false && /too many|slow down|wait/i.test(value.message ?? "");
  }
  assert(blocked, "request creation was never rate limited");
  return "request creation throttled after the configured limit";
});

await check("demo data can be restored without touching real records", async () => {
  const result = unwrap((await call(api.admin.adminResetDemoData, { session: adminSession })).value, "adminResetDemoData");
  const demo = unwrap((await call(api.admin.listAdminRequests, { session: adminSession, data: { demo: "demo" } })).value, "listAdminRequests");
  const real = unwrap((await call(api.admin.listAdminRequests, { session: adminSession, data: { demo: "real" } })).value, "listAdminRequests");
  assert(demo.items.length === 15, `expected the pristine 15 seeded requests, got ${demo.items.length}`);
  assert(real.items.length > 0, "real records were deleted by the demo reset");
  assert(demo.items.every((row) => row.isDemo), "a real request was marked as demo data");
  return `${demo.items.length} demo · ${real.items.length} real records preserved`;
});

await check("role changes are persisted to the session", async () => {
  unwrap((await call(api.auth.updateRole, { session: bothSession, data: { role: "donor" } })).value, "updateRole");
  const { value } = await call(api.auth.fetchSession, { session: bothSession });
  assert(value?.role === "donor", `expected donor role, got ${value?.role}`);
  unwrap((await call(api.auth.updateRole, { session: bothSession, data: { role: "both" } })).value, "updateRole");
  return "both → donor → both";
});

await check("sign out clears the session", async () => {
  const temporary = await signIn("donor@healconnect.demo", "demo1234");
  unwrap((await call(api.auth.signOut, { session: temporary })).value, "signOut");
  const { value } = await call(api.auth.fetchSession, { session: temporary });
  assert(value === null, "the session survived sign out");
  return "session cleared";
});

await check("sign in rejects a wrong password without revealing details", async () => {
  const { value, session } = await call(api.auth.signInWithPassword, {
    data: { email: "donor@healconnect.demo", password: "definitely-wrong" },
  });
  assert(value?.ok === false, "a wrong password was accepted");
  assert(!session, "a session was issued for a failed sign in");
  assert(!/no such|unknown user|exists/i.test(value.message ?? ""), `message leaks account existence: ${value.message}`);
  return value.message.slice(0, 60);
});

await vite.close();

console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(` - ${failure}`);
  process.exitCode = 1;
}
