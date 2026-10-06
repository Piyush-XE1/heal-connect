import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Droplet,
  Hospital,
  PhoneCall,
  Plus,
  ShieldAlert,
  Siren,
  Timer,
} from "lucide-react";

import {
  EmptyState,
  InfoNote,
  Pill,
  SkeletonGrid,
} from "@/components/common/primitives";
import { PublicPage } from "@/components/layout/public-page";
import { RequestCard } from "@/components/requests/request-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { EMERGENCY_DISCLAIMER, SAFETY_RULES } from "@/lib/brand";
import { queryKeys } from "@/lib/query-keys";
import { unwrapAction } from "@/lib/actions";
import { fetchEmergencyRequests } from "@/server/api/requests";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency requests — Heal Connect" },
      {
        name: "description",
        content:
          "Open emergency blood requests with hospital, group, units, location and timestamps. Heal Connect does not provide emergency care — contact emergency services first.",
      },
    ],
  }),
  component: EmergencyPage,
});

const STEPS = [
  {
    icon: PhoneCall,
    title: "1. Call emergency services",
    body: "For any life-threatening situation, call your local emergency number or the hospital's emergency desk first. Platform responses are never a substitute for that call.",
  },
  {
    icon: Hospital,
    title: "2. Speak to the hospital blood bank",
    body: "The blood bank confirms the exact component needed, screening requirements and whether replacement donors are required.",
  },
  {
    icon: Plus,
    title: "3. Raise or share the request",
    body: "Publish an emergency request so matching donors nearby are notified instantly. Share the reference with people you trust as a parallel path.",
  },
  {
    icon: Building2,
    title: "4. Donors arrive at the blood bank",
    body: "Donors go directly to the licensed blood centre or hospital. No money, documents or personal details change hands.",
  },
];

/**
 * "Raise an emergency request" is the one call to action that must pre-fill the
 * urgency field. Signed-out visitors are sent to registration first.
 */
function RaiseEmergencyLink({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user) {
    return (
      <Link to="/requests/new" search={{ urgency: "emergency" }}>
        {children}
      </Link>
    );
  }
  return <Link to="/register">{children}</Link>;
}

function EmergencyPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.emergencyRequests,
    queryFn: async () => unwrapAction(await fetchEmergencyRequests({ data: { limit: 12 } })),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <PublicPage
      eyebrow="Emergency flow"
      title="Emergency requests, clearly labelled"
      description="Emergency needs are prioritised, timestamped and shown with the hospital, blood group, units and location so a donor can decide quickly."
      actions={
        <>
          <Button asChild className="gradient-life text-white hover:opacity-95">
            <RaiseEmergencyLink>
              Raise an emergency request
              <Siren className="size-4" aria-hidden="true" />
            </RaiseEmergencyLink>
          </Button>
          <Button asChild variant="outline">
            <Link to="/find-help">
              <Droplet className="size-4" aria-hidden="true" />
              All open requests
            </Link>
          </Button>
        </>
      }
      badges={
        <>
          <Pill tone="danger">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Not a substitute for emergency care
          </Pill>
          {data ? <Pill tone="primary">{data.total} open emergency requests</Pill> : null}
        </>
      }
    >
      <InfoNote tone="danger" icon={Siren} title="Read this first">
        {EMERGENCY_DISCLAIMER}
      </InfoNote>

      <section aria-labelledby="emergency-steps" className="space-y-4">
        <h2 id="emergency-steps" className="font-display text-xl font-extrabold">
          What to do in an emergency
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step) => (
            <article key={step.title} className="surface h-full space-y-2 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-sm font-bold">{step.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="open-emergencies" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="open-emergencies" className="font-display text-xl font-extrabold">
              Open emergency requests
            </h2>
            <p className="text-sm text-muted-foreground">
              Sorted by the date help is needed. Contact details are only revealed after a match is confirmed.
            </p>
          </div>
          <Pill tone="warning">
            <Timer className="size-3.5" aria-hidden="true" />
            Live list
          </Pill>
        </div>

        {isLoading ? (
          <SkeletonGrid count={3} />
        ) : data && data.items.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.items.map((item) => (
              <RequestCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Droplet}
            title="No open emergency requests right now"
            description="Good news for the community. Non-emergency requests are still open — and you can raise an emergency request instantly if the need changes."
            action={
              <>
                <Button asChild>
                  <RaiseEmergencyLink>Raise an emergency request</RaiseEmergencyLink>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/find-help">Browse all requests</Link>
                </Button>
              </>
            }
          />
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <InfoNote tone="warning" icon={ShieldAlert} title="Before a donor travels">
          <ul className="list-disc space-y-1 pl-4">
            {SAFETY_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </InfoNote>
        <InfoNote tone="neutral" title="How emergency requests are moderated">
          Emergency requests require extra detail (ward, department or coordinating person), are highlighted across the
          platform, and are reviewed by moderators. Requests that mention payment or brokerage are removed and the
          account may be suspended.
        </InfoNote>
      </section>
    </PublicPage>
  );
}
