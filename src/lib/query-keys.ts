/** Centralised React Query keys so every screen invalidates the same targets. */
export const queryKeys = {
  session: ["session"] as const,
  authConfig: ["auth-config"] as const,
  dashboard: ["dashboard"] as const,
  matchedRequests: ["matched-requests"] as const,
  emergencyRequests: ["emergency-requests"] as const,
  myRequests: ["my-requests"] as const,
  myActivity: ["my-activity"] as const,
  myVerification: ["my-verification"] as const,
  myReports: ["my-reports"] as const,
  blockedUsers: ["blocked-users"] as const,
  /**
   * `bell` is the shared badge/popover feed in the app shell. Every notification
   * query lives under the `["notifications"]` prefix so a single invalidation
   * refreshes the badge, the popover and the notifications page together.
   */
  notifications: (filter: "all" | "unread" | "bell" = "all") => ["notifications", filter] as const,
  notificationsRoot: ["notifications"] as const,
  requests: (filters: Record<string, unknown>) => ["requests", filters] as const,
  request: (id: string) => ["request", id] as const,
  requestFiltersMeta: ["request-filters-meta"] as const,
  volunteers: (filters: Record<string, unknown>) => ["volunteers", filters] as const,
  publicProfile: (id: string) => ["public-profile", id] as const,
  cityOptions: ["city-options"] as const,
  admin: (section: string, filters: Record<string, unknown>) =>
    ["admin", section, filters] as const,
} as const;

type QueryKey = readonly unknown[];

/** Keys to invalidate after a member changes something that affects many screens. */
export const invalidationGroups = {
  afterRequestChange: [
    queryKeys.dashboard,
    queryKeys.myRequests,
    queryKeys.matchedRequests,
    queryKeys.emergencyRequests,
    queryKeys.notificationsRoot,
    queryKeys.session,
  ] as QueryKey[],
  afterResponseChange: [
    queryKeys.dashboard,
    queryKeys.myActivity,
    queryKeys.myRequests,
    queryKeys.matchedRequests,
    queryKeys.notificationsRoot,
  ] as QueryKey[],
  afterProfileChange: [
    queryKeys.session,
    queryKeys.dashboard,
    queryKeys.myVerification,
  ] as QueryKey[],
  afterModeration: [
    ["admin"] as QueryKey,
    queryKeys.dashboard,
    queryKeys.notificationsRoot,
    queryKeys.session,
  ] as QueryKey[],
} as const;
