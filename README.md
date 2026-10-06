# Heal Connect

**Give. Receive. Save lives.**

Heal Connect is a privacy-first platform that connects people willing to help with people who need
legitimate medical donation assistance — blood, platelets and other verified medical assistance —
starting in India. It is a coordination product, not a medical one: every eligibility and
compatibility decision stays with qualified clinicians, hospitals and licensed blood banks.

- **Donors** keep a private donor profile (blood group, availability, donation preferences, travel
  distance) and see requests ranked by blood-group compatibility, distance, availability and urgency.
- **Recipients and coordinators** raise clear, structured requests and coordinate offers without
  ever publishing a home address, phone number or medical document.
- **Moderators** work from a protected dashboard covering users, requests, reports, verifications and
  platform statistics.

## What is implemented

| Area                                                                                                 | Status |
| ---------------------------------------------------------------------------------------------------- | ------ |
| Google OAuth + password sign-in, role choice (Donor / Recipient / Both), sessions                    | ✅     |
| Landing page (hero, how it works, trust & safety, emergency, FAQ, footer) with subtle motion         | ✅     |
| Role-aware dashboard: matches, quick actions, active requests, activity, notifications, completion   | ✅     |
| Donor profile, availability, preferences, verification, privacy controls                             | ✅     |
| Help requests: guided six-step wizard, **private drafts**, edit, cancel, reopen, fulfilment tracking | ✅     |
| Discovery with filters (group, city, area, distance, urgency, type, date), match scoring and reasons | ✅     |
| Request responses: offer, withdraw, accept, decline, complete, contact reveal on acceptance          | ✅     |
| Notifications for matches, responses, request updates, cancellations and verification changes        | ✅     |
| Emergency surface with strict disclaimer and parallel-contact guidance                               | ✅     |
| Reporting, blocking, safety centre, Terms and Privacy (clearly marked draft legal copy)              | ✅     |
| Verification workflow (Unverified / Pending / Verified) with a moderator queue                       | ✅     |
| Admin dashboard: users, requests, reports, verifications, stats, demo-data reset                     | ✅     |
| PWA: manifest, icons, service worker, offline fallback page, install prompts                         | ✅     |
| Backend: file-backed JSON store behind a single adapter, RBAC, rate limits, audit log                | ✅     |
| Tests: 56-check backend smoke suite, 25 unit/component tests, route-link checker                     | ✅     |

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev          # http://localhost:8080
```

Demo accounts (only enabled when Google OAuth is not configured, or when
`HEAL_CONNECT_DEMO_LOGIN=1`):

| Role      | Email                        | Password    |
| --------- | ---------------------------- | ----------- |
| Donor     | `donor@healconnect.demo`     | `demo1234`  |
| Recipient | `recipient@healconnect.demo` | `demo1234`  |
| Both      | `both@healconnect.demo`      | `demo1234`  |
| Moderator | `admin@healconnect.demo`     | `admin1234` |

## Scripts

| Command                           | What it does                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server (TanStack Start, SSR).                                                                                                       |
| `npm run build`                   | Production build (Nitro, Cloudflare Workers target) into `.output/`.                                                                         |
| `npm run preview`                 | Preview the production build.                                                                                                                |
| `npm test`                        | Vitest unit + component suites (medical rules, wizard, routing).                                                                             |
| `npm run smoke`                   | Backend smoke suite: 56 checks over auth, RBAC, drafts, requests, offers, safety, verification, moderation, rate limits and demo-data reset. |
| `npm run check:links`             | Verifies every internal link resolves to a route.                                                                                            |
| `npm run check`                   | Link check + backend smoke suite.                                                                                                            |
| `npm run lint` / `npm run format` | ESLint (0 errors) and Prettier.                                                                                                              |

## Architecture

```
src/
  routes/             file-based routes (public pages, auth, /_app authenticated shell, /api OAuth)
  components/         design-system primitives, layouts, request/donor UI
  lib/                domain model, blood compatibility, matching rules, validation, formatting
  server/
    api/              typed server functions (the only client→server boundary)
    auth/             PBKDF2 hashing, sessions, OAuth state/signature helpers
    db/               JSON store adapter + demo seed data
    services/         views/projections, notifications, expiry sweep, rate limits, audit log
public/               PWA manifest, service worker, offline page, icons, robots, sitemap
scripts/              api-smoke.mjs, check-links.mjs
```

- **Storage**: everything goes through `src/server/db/store.ts` (`getDb()` / `mutate()`), so swapping
  the JSON file for Postgres or Supabase is a contained change — no API or UI code touches the store
  directly. Set `HEAL_CONNECT_DATA_DIR` to relocate the data file; without a filesystem the store
  degrades to an in-memory database, which keeps edge deployments working.
- **Authorization** is enforced server-side in every server function; the client only mirrors it for
  UX. Contact details, coordinates and donor phone numbers are projected per viewer.
- **Matching** weights blood-group compatibility (40), distance (25), availability (20) and urgency
  (15), and always explains _why_ a request is shown. Incompatible groups are surfaced as blockers
  with the reminder that the blood bank decides the final match.

## Safety, privacy and legal boundaries

- No payments, gifts or compensation for blood, blood components or organs — requests that hint at
  payment are removed and accounts can be suspended.
- No organ buying, selling, brokering or private organ transactions; organ-donation questions point
  to government-authorised systems only.
- Exact addresses, phone numbers and medical documents are never public. Coordinates are rounded and
  distances are shown in bands.
- Heal Connect does not replace doctors, hospitals, blood banks or emergency services, and does not
  make medical eligibility decisions.
- Terms and Privacy pages are explicitly marked as drafts pending legal review.

## Deployment

`npm run build` produces a Nitro bundle (`.output/`) targeting Cloudflare Workers by default; the
same build runs on Node hosts. Configure Google OAuth with `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
and set `HEAL_CONNECT_DEMO_LOGIN=0` in production so demo sign-in is disabled.

This project was built with [Lovable](https://lovable.dev) and continues to sync with the
[Lovable editor](https://lovable.dev/projects/c3b03c47-3746-460e-8549-7f95e48c1177).

## Storage: JSON file store vs Lovable Cloud (Postgres)

All data access goes through `src/server/db/store.ts`, a small facade that picks a driver at call time:

| Driver | When it is used | Where data lives |
| --- | --- | --- |
| Postgres (`src/server/db/drivers/postgres.ts`) | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (always true on the deployed app) | Lovable Cloud database |
| JSON (`src/server/db/drivers/json.ts`) | Neither is set — zero-config local default | `.data/heal-connect-db.json` |

Force one with `HEAL_CONNECT_STORE=json` or `HEAL_CONNECT_STORE=postgres`.

- Schema: `supabase/migrations/20261006210000_heal_connect_schema.sql` (copy in `db/schema.sql`). All timestamps and dates are ISO-8601 UTC `text`.
- Every table has RLS enabled with no policies; only the server (service-role key) can read or write.
- Each `mutate()` is diffed and sent as one change set to the `heal_connect_apply` SQL function, which runs in a single transaction. If the action throws, nothing is written and the in-memory copy is discarded.
- The edge runtime has no raw TCP, so the driver uses the service-role Data API rather than `pg`.
- On first boot against an empty database the demo data in `src/server/db/seed.ts` is seeded unless `HEAL_CONNECT_SEED_DEMO=false`.

See `.env.example` for every variable. Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; register `<origin>/api/auth/google/callback` as an authorized redirect URI for every origin you use.
