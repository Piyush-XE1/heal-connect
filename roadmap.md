# Heal Connect roadmap

## Shipped

- [x] Landing page with hero, how it works, trust & safety, emergency and FAQ sections.
- [x] Google OAuth + password auth, role choice, sessions, authenticated shell and mobile bottom nav.
- [x] Donor profiles, availability, donation preferences and privacy controls.
- [x] Help-request lifecycle: six-step wizard, private drafts, edit, cancel, reopen, fulfil.
- [x] Discovery with filters, match scoring and explanations; donor directory and public profiles.
- [x] Donor responses: offer, withdraw, accept, decline, complete, contact reveal on acceptance.
- [x] In-app notifications for matches, responses, request changes and verification updates.
- [x] Verification workflow with a moderator queue; admin dashboard for users, requests, reports and stats.
- [x] Safety tooling: reporting, blocking, prohibited-content copy, draft legal pages.
- [x] PWA shell: manifest, icons, service worker, offline fallback, install prompts.
- [x] Verification harnesses: backend smoke suite, unit/component tests, link checker, lint and format.

## Next

- [ ] Launch checklist: set `VITE_SITE_URL` to the production origin, confirm `SESSION_SECRET` and
      Google OAuth credentials in the production environment, and keep `HEAL_CONNECT_DEMO_LOGIN=false`.
- [ ] Swap the JSON store adapter in `src/server/db/store.ts` for Postgres/Supabase and add migrations.
- [ ] Real Google OAuth credentials and production session/cookie hardening review.
- [ ] Web-push delivery on top of the existing notification records (`pushEnabled` flag already surfaced).
- [ ] Verified organisation accounts (hospital / blood bank / NGO) with document review and badges.
- [ ] Legal review of the Terms, Privacy and safety copy before public launch.
- [ ] Observability: structured request logging, error reporting and audit-log export.

<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->
