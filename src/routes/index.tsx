import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Droplet,
  Filter,
  HeartHandshake,
  HeartPulse,
  Info,
  Lock,
  MapPin,
  MessageSquareQuote,
  PhoneCall,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";

import careImage from "@/assets/livora-care.jpg";
import { CompatibilityMatrix } from "@/components/common/compatibility-matrix";
import { BloodGroupChip, InfoNote, Pill, Reveal, SectionHeading, StatTile, UrgencyBadge } from "@/components/common/primitives";
import { MarketingHeader } from "@/components/layout/marketing";
import { SiteFooter } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { BRAND, EMERGENCY_DISCLAIMER, ORGAN_DONATION_NOTICE, PAYMENT_PROHIBITION, PRIVACY_PROMISE } from "@/lib/brand";
import { FAQ_ITEMS, LANDING_FAQ_IDS } from "@/lib/faq";
import { MATCHING_WEIGHTS } from "@/lib/blood";
import { queryKeys } from "@/lib/query-keys";
import { fetchPublicStats, type PublicStats } from "@/server/api/requests";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Heal Connect — Give. Receive. Save lives." },
      {
        name: "description",
        content:
          "Heal Connect connects people willing to help with people who need legitimate medical donation assistance: verified blood, platelet and medical assistance requests, matched safely with nearby donors.",
      },
      { property: "og:title", content: "Heal Connect — Give. Receive. Save lives." },
      {
        property: "og:description",
        content:
          "One platform to connect people willing to help with people who need legitimate medical donation assistance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async (): Promise<{ stats: PublicStats | null }> => {
    try {
      const stats = await fetchPublicStats();
      return { stats };
    } catch {
      return { stats: null };
    }
  },
  component: LandingPage,
});

const STEPS = [
  {
    icon: UserPlus,
    title: "Create your account",
    description:
      "Sign in with Google and choose how you want to take part — as a donor, a recipient, or both. You can change this any time in Settings.",
  },
  {
    icon: Search,
    title: "Raise or find a request",
    description:
      "Recipients describe the need — blood group, units, hospital, city, date and urgency. Donors see requests that fit their group, location and availability.",
  },
  {
    icon: MessageSquareQuote,
    title: "Match and connect",
    description:
      "A donor taps “I can help”. The requester confirms, and coordination details are shared only with the people involved — never publicly.",
  },
  {
    icon: Building2,
    title: "Donate at an authorised centre",
    description:
      "The hospital or blood bank completes screening, cross-matching and the donation. Then the request is closed and the loop is complete.",
  },
] as const;

const TRUST_CARDS = [
  {
    icon: Lock,
    title: "Privacy by default",
    description:
      "Requests show a city and area only — never a street address. Your phone number is shared only with the person coordinating a request you are matched to.",
  },
  {
    icon: BadgeCheck,
    title: "Verified accounts",
    description:
      "Verified information is visually separated from self-reported details. Hospitals, blood banks, NGOs and authorised organisations can hold verified accounts.",
  },
  {
    icon: ShieldCheck,
    title: "No money for donation",
    description:
      "Payment, compensation and brokerage are prohibited. Reported listings are reviewed by moderators and removed, and repeat offenders are suspended.",
  },
  {
    icon: Stethoscope,
    title: "Hospitals stay in charge",
    description:
      "We never screen donors, decide eligibility or confirm compatibility. Those decisions belong to qualified medical professionals and licensed blood banks.",
  },
  {
    icon: BellRing,
    title: "Clear updates, no chasing",
    description:
      "Every offer, status change and verification decision produces a notification, so donors and families always know where things stand.",
  },
  {
    icon: HeartPulse,
    title: "Human moderation",
    description:
      "Reports, blocks and an admin workspace let our team act quickly on unsafe, misleading or illegal activity.",
  },
] as const;

const PREVIEW_REQUESTS = [
  {
    title: "Urgent O+ blood required",
    hospital: "Sanjeevani Multispeciality Hospital",
    location: "Indirapuram, Ghaziabad",
    units: "2 units",
    urgency: "emergency" as const,
    group: "O+" as const,
  },
  {
    title: "B+ platelets needed for a child",
    hospital: "Meridian Children's Hospital",
    location: "Sector 62, Noida",
    units: "1 single-donor unit",
    urgency: "urgent" as const,
    group: "B+" as const,
  },
  {
    title: "AB- blood for transplant ward",
    hospital: "Garden City Blood Centre",
    location: "Indiranagar, Bengaluru",
    units: "2 units",
    urgency: "urgent" as const,
    group: "AB-" as const,
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

function LandingPage() {
  const { stats: initialStats } = Route.useLoaderData();
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => fetchPublicStats(),
    initialData: initialStats ?? undefined,
    staleTime: 60_000,
  });

  const faqItems = LANDING_FAQ_IDS.map((id) => FAQ_ITEMS.find((item) => item.id === id)).filter(
    (item): item is (typeof FAQ_ITEMS)[number] => Boolean(item),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero ------------------------------------------------------- */}
        <section className="relative overflow-hidden grid-mesh">
          <div className="page-shell grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div className="space-y-6">
              <Pill tone="primary" className="px-3 py-1.5 text-xs">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Give. Receive. Save lives.
              </Pill>
              <h1 className="font-display text-4xl leading-[1.05] font-extrabold text-balance sm:text-5xl lg:text-[3.4rem]">
                One platform to connect people willing to help with people who need{" "}
                <span className="text-gradient-brand">legitimate medical donation assistance</span>.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Raise a clear request for blood, platelets or medical assistance. Offer help if you are eligible.
                Coordinate safely — with privacy built in, hospitals in charge, and no money changing hands.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gradient-life h-12 text-white hover:opacity-95">
                  <Link to={user ? "/requests/new" : "/register"}>
                    Request Help
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 bg-card">
                  <Link to={user ? "/donors" : "/register"}>
                    <Droplet className="size-4 text-blood" aria-hidden="true" />
                    Become a Donor
                  </Link>
                </Button>
              </div>

              <ul className="grid gap-2 pt-2 text-sm text-muted-foreground sm:grid-cols-2">
                {[
                  "Exact addresses are never public",
                  "Payments for donation are blocked",
                  "Verified hospitals, blood banks & NGOs",
                  "Works offline once installed",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                to="/emergency"
                className="inline-flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"
              >
                <Siren className="size-4" aria-hidden="true" />
                In an emergency, contact emergency services and the hospital blood bank first
              </Link>
            </div>

            {/* Product preview */}
            <div className="relative" aria-hidden="true">
              <div className="surface lift-on-hover relative z-10 space-y-4 p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Matched for you
                  </p>
                  <Pill tone="success">
                    <BadgeCheck className="size-3.5" />
                    Verified requester
                  </Pill>
                </div>
                {PREVIEW_REQUESTS.map((request, index) => (
                  <article
                    key={request.title}
                    className={`surface surface-hover space-y-3 p-4 ${index > 0 ? "hidden sm:block" : ""}`}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-bold">{request.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{request.hospital}</p>
                      </div>
                      <BloodGroupChip group={request.group} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5 text-primary" />
                        {request.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Droplet className="size-3.5 text-blood" />
                        {request.units}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <UrgencyBadge urgency={request.urgency} />
                      <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                        I can help
                      </span>
                    </div>
                  </article>
                ))}
                <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Info className="size-3.5" aria-hidden="true" />
                  Product preview with sample data. Contact details stay hidden until a match is confirmed.
                </p>
              </div>

              <div className="surface absolute -bottom-6 -left-4 z-20 hidden w-56 gap-3 p-4 sm:flex">
                <BellRing className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold">Instant alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Matching donors are notified the moment a request goes live.
                  </p>
                </div>
              </div>
              <div className="absolute -top-10 right-4 hidden size-40 rounded-full bg-primary/10 blur-3xl lg:block" />
            </div>
          </div>

          {/* Live counters */}
          <div className="page-shell pb-12">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Open requests"
                value={stats ? stats.openRequests : "—"}
                hint="Blood, platelet and assistance needs live now"
                icon={HeartHandshake}
                tone="primary"
              />
              <StatTile
                label="Emergency needs"
                value={stats ? stats.emergencyRequests : "—"}
                hint="Prioritised and highlighted for donors"
                icon={Siren}
                tone="danger"
              />
              <StatTile
                label="Registered donors"
                value={stats ? stats.donors : "—"}
                hint="With donor profiles and availability set"
                icon={Users}
                tone="info"
              />
              <StatTile
                label="Units coordinated"
                value={stats ? stats.unitsCoordinated : "—"}
                hint={`Across ${stats ? stats.cities : 0} cities in this workspace`}
                icon={Droplet}
                tone="blood"
              />
            </div>
          </div>
        </section>

        {/* How it works --------------------------------------------- */}
        <section id="how-it-works" className="page-shell scroll-mt-24 py-16 lg:py-20">
          <SectionHeading
            eyebrow="How it works"
            title="From a request in a hospital corridor to a confirmed donor"
            description="Four steps, no guesswork. Every step keeps private information private and leaves medical judgement with the professionals."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 80}>
                <article className="surface surface-hover h-full space-y-3 p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                      <step.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-3xl font-extrabold text-muted/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Participate ---------------------------------------------- */}
        <section id="participate" className="scroll-mt-24 border-y border-border bg-muted/40 py-16 lg:py-20">
          <div className="page-shell space-y-10">
            <SectionHeading
              eyebrow="Two ways to take part"
              title="Donors give and receive. Recipients find help and coordinate."
              description="Most members are both over time — you can donate when you are able and raise a request when you need one. Your role decides which tools you see first."
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <Reveal>
                <article className="surface h-full space-y-5 p-7">
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-blood/10 text-blood">
                      <Droplet className="size-6" aria-hidden="true" />
                    </span>
                    <Pill tone="blood">For donors</Pill>
                  </div>
                  <h3 className="font-display text-2xl font-extrabold">Build a donor profile once, help when it matters</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Store your blood group, city, availability, donation preferences and last donation date. We use it to
                    show requests that plausibly fit you — and nothing else. You can pause availability at any time.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {[
                      "Matched requests ranked by group, distance, availability and urgency",
                      "One-tap “I can help”, and withdraw whenever you need to",
                      "Notification when a coordinator accepts your offer",
                      "Donation history kept in one place",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full sm:w-auto">
                    <Link to={user ? "/profile" : "/register"}>
                      {user ? "Manage donor profile" : "Become a Donor"}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </article>
              </Reveal>

              <Reveal delay={100}>
                <article className="surface h-full space-y-5 p-7">
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                      <HeartHandshake className="size-6" aria-hidden="true" />
                    </span>
                    <Pill tone="primary">For recipients</Pill>
                  </div>
                  <h3 className="font-display text-2xl font-extrabold">A structured request that donors can act on</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Raise a request for yourself or someone you are coordinating for: request type, blood group, units,
                    hospital, city and area, the date help is needed and how a donor should reach you.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {[
                      "Urgency levels with an emergency flow that is clearly highlighted",
                      "Track every offer, accept the donor that fits, and close the loop",
                      "Edit, cancel or reopen your request at any time",
                      "Contact details revealed only to a confirmed donor",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link to={user ? "/requests/new" : "/register"}>
                      Request Help
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Matching ------------------------------------------------- */}
        <section className="page-shell py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
            <div className="space-y-6">
              <SectionHeading
                eyebrow="Smart matching"
                title="The right requests reach the right donors first"
                description="Donor discovery ranks every open request on four transparent factors, in this order of importance."
              />
              <div className="space-y-3">
                {[
                  { label: "Compatible blood group", weight: MATCHING_WEIGHTS.bloodGroup, icon: Droplet },
                  { label: "Location and travel distance", weight: MATCHING_WEIGHTS.distance, icon: MapPin },
                  { label: "Donor availability", weight: MATCHING_WEIGHTS.availability, icon: CalendarCheck },
                  { label: "Request urgency", weight: MATCHING_WEIGHTS.urgency, icon: Timer },
                ].map((factor) => (
                  <div key={factor.label} className="surface flex items-center gap-4 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                      <factor.icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{factor.label}</p>
                        <span className="text-xs font-bold text-muted-foreground">{factor.weight}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full gradient-brand"
                          style={{ width: `${factor.weight}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <InfoNote title="Ranking, not a medical decision">
                Matching only decides which requests are shown first. Compatibility and eligibility are always
                confirmed by qualified medical professionals and the blood bank — the platform never makes that call.
              </InfoNote>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-extrabold">General compatibility reference</h3>
                <Pill tone="info">
                  <Filter className="size-3.5" aria-hidden="true" />
                  Educational
                </Pill>
              </div>
              <CompatibilityMatrix />
            </div>
          </div>
        </section>

        {/* Trust --------------------------------------------------- */}
        <section id="trust" className="scroll-mt-24 border-y border-border bg-muted/40 py-16 lg:py-20">
          <div className="page-shell space-y-10">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <SectionHeading
                  eyebrow="Trust & safety"
                  title="Built for a situation where trust is everything"
                  description="A family searching for donors is already under pressure. The platform should make that moment safer, not riskier."
                />
                <div className="flex flex-wrap gap-2">
                  <Pill tone="primary">
                    <ShieldCheck className="size-3.5" aria-hidden="true" /> Privacy-first
                  </Pill>
                  <Pill tone="success">Verified organisations</Pill>
                  <Pill tone="warning">Human moderation</Pill>
                  <Pill tone="danger">Zero tolerance for trade</Pill>
                </div>
                <img
                  src={careImage}
                  alt="A clinician speaking with a patient in a bright consultation room"
                  className="h-56 w-full rounded-3xl object-cover shadow-lg sm:h-64"
                  loading="lazy"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {TRUST_CARDS.map((card, index) => (
                  <Reveal key={card.title} delay={index * 60}>
                    <article className="surface h-full space-y-2 p-5">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                        <card.icon className="size-5" aria-hidden="true" />
                      </span>
                      <h3 className="font-display text-base font-bold">{card.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <InfoNote tone="primary" icon={Lock} title="What we never publish">
                {PRIVACY_PROMISE}
              </InfoNote>
              <InfoNote tone="warning" icon={ShieldCheck} title="Donation is never a transaction">
                {PAYMENT_PROHIBITION}
              </InfoNote>
              <InfoNote tone="info" icon={Stethoscope} title="Organ donation is different">
                {ORGAN_DONATION_NOTICE}
              </InfoNote>
            </div>
          </div>
        </section>

        {/* Emergency ---------------------------------------------- */}
        <section id="emergency-assistance" className="scroll-mt-24 py-16 lg:py-20">
          <div className="page-shell">
            <div className="surface relative overflow-hidden border-destructive/30 p-6 sm:p-10">
              <div className="absolute -top-16 -right-10 size-52 rounded-full bg-destructive/10 blur-3xl" />
              <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div className="space-y-5">
                  <Pill tone="danger" className="animate-pulse-ring px-3 py-1.5">
                    <Siren className="size-3.5" aria-hidden="true" />
                    Emergency assistance
                  </Pill>
                  <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">
                    Emergency requests are visible, structured and clearly labelled
                  </h2>
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Emergency requests carry a strong visual label with the hospital, required blood group, units,
                    location and a timestamp — so a donor can decide quickly whether they can help.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { icon: Siren, label: "Highlighted priority ordering" },
                      { icon: PhoneCall, label: "Hospital and coordinator details" },
                      { icon: Timer, label: "Timestamped and date-driven" },
                      { icon: BellRing, label: "Instant donor notifications" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                        <item.icon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                        {item.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild className="gradient-life h-11 text-white hover:opacity-95">
                      <RaiseEmergencyLink>
                        Raise an emergency request
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </RaiseEmergencyLink>
                    </Button>
                    <Button asChild variant="outline" className="h-11">
                      <Link to="/emergency">See emergency requests</Link>
                    </Button>
                  </div>
                </div>
                <InfoNote tone="danger" title="Heal Connect does not provide emergency care">
                  {EMERGENCY_DISCLAIMER} Contact your local emergency number, the hospital blood bank, or the treating
                  hospital's help desk. Never delay treatment to wait for a platform response.
                </InfoNote>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ ----------------------------------------------------- */}
        <section id="faq" className="scroll-mt-24 border-t border-border bg-muted/40 py-16 lg:py-20">
          <div className="page-shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <SectionHeading
                eyebrow="FAQ"
                title="Questions people ask before they sign up"
                description="If something is still unclear, the safety guidelines go deeper — and our support inbox is open."
              />
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/faq">Read all questions</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/safety">Safety guidelines</Link>
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {faqItems.map((item) => (
                <details key={item.id} className="surface group p-5 open:shadow-md">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-bold">
                    {item.question}
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA -------------------------------------------- */}
        <section className="page-shell py-16 lg:py-20">
          <div className="surface overflow-hidden">
            <div className="gradient-brand relative p-8 text-center text-white sm:p-14">
              <h2 className="font-display text-3xl font-extrabold text-balance sm:text-4xl">
                Somebody nearby can help. Somebody nearby needs help.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
                {BRAND.positioning} Join in less than a minute — choose your role, add what matters, and start saving
                lives responsibly.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-white text-primary hover:bg-white/90">
                  <Link to={user ? "/dashboard" : "/register"}>
                    {user ? "Go to dashboard" : "Create your free account"}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12 border border-white/40 text-white hover:bg-white/10">
                  <Link to="/find-help">Browse open requests</Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-white/80">
                {BRAND.name} does not replace doctors, hospitals, blood banks or emergency services.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
