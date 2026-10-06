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

- Keep the landing page at the index route and its visual tokens in the global stylesheet, with shared Button variants for CTAs; this preserves consistent presentation without introducing functional flows.
- All data access goes through the `src/server/db/store.ts` facade. It picks the Postgres driver (Lovable Cloud, reached through the service-role Data API because the edge runtime has no TCP) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, and the JSON file store otherwise. This keeps the API modules unaware of which storage is in use.
- Each Postgres `mutate()` is diffed and written as a single change set through the `heal_connect_apply` SQL function, so a failed action never leaves half-saved data behind.
- Every table has RLS on with no policies, so only the server can read or write data.
