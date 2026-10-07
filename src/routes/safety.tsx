import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  FileText,
  HandCoins,
  HeartHandshake,
  Lock,
  ShieldCheck,
  Siren,
  Stethoscope,
  UserCheck,
} from "lucide-react";

import { InfoNote, Pill } from "@/components/common/primitives";
import { PublicPage } from "@/components/layout/public-page";
import { Button } from "@/components/ui/button";
import {
  EMERGENCY_DISCLAIMER,
  MEDICAL_DISCLAIMER,
  ORGAN_DONATION_NOTICE,
  PAYMENT_PROHIBITION,
  PRIVACY_PROMISE,
  SAFETY_RULES,
} from "@/lib/brand";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/safety")({
  head: () => ({
    ...pageHead({
      title: "Safety & privacy guidelines — Heal Connect",
      description:
        "How Heal Connect protects donors and recipients: privacy by default, no payments, reporting and blocking, and clear medical boundaries.",
      path: "/safety",
    }),
  }),
  component: SafetyPage,
});

const PILLARS = [
  {
    icon: Lock,
    title: "Privacy by default",
    body: "Requests show city and area only. No street addresses, no ward numbers, no personal documents. Phone numbers are shared only with the person coordinating a request you are matched to, and only if you allow it.",
  },
  {
    icon: HandCoins,
    title: "Donation is never a transaction",
    body: "Paying for blood, blood components or organs is illegal in many places and prohibited here. Requests asking for money are removed, and accounts can be suspended.",
  },
  {
    icon: Stethoscope,
    title: "Medical decisions stay medical",
    body: "Compatibility information is general guidance for ranking requests. Screening, eligibility and cross-matching are always performed by qualified professionals and licensed blood banks.",
  },
  {
    icon: UserCheck,
    title: "Verification with clear labelling",
    body: "Verified accounts are visually separated from self-reported information. Verification is a trust signal, not a medical certification, and it never guarantees availability.",
  },
  {
    icon: Ban,
    title: "Reporting, blocking and moderation",
    body: "Every request and profile can be reported. You can block any member instantly, which hides each other's requests and offers. Moderators review reports, remove listings and suspend accounts.",
  },
  {
    icon: Siren,
    title: "Emergency boundaries are explicit",
    body: "Emergency requests are highlighted, but the platform cannot dispatch help or provide care. Emergency services and the hospital blood bank always come first.",
  },
];

const DOS = [
  "Coordinate through the hospital blood bank or a licensed blood centre.",
  "Confirm the requirement, ward and timing with the hospital before travelling.",
  "Keep your availability accurate and withdraw offers you cannot honour.",
  "Report anything that looks misleading, unsafe or paid.",
];

const DONTS = [
  "Do not share ID documents, medical reports, OTPs or bank details.",
  "Do not send or accept money, gifts or favours for a donation.",
  "Do not arrange organ donations privately — use authorised transplant systems only.",
  "Do not post someone else's personal details without their consent.",
];

function SafetyPage() {
  return (
    <PublicPage
      eyebrow="Trust & safety"
      title="Safety and privacy, built into the product"
      description="Heal Connect handles a moment when people are anxious and generous at the same time. These are the rules that keep that moment safe."
      actions={
        <>
          <Button asChild>
            <Link to="/find-help">
              <HeartHandshake className="size-4" aria-hidden="true" />
              Find requests
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/settings">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Block or report someone
            </Link>
          </Button>
        </>
      }
      badges={
        <>
          <Pill tone="primary">Privacy-first</Pill>
          <Pill tone="success">Human moderation</Pill>
          <Pill tone="warning">No payments</Pill>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PILLARS.map((pillar) => (
          <article key={pillar.title} className="surface h-full space-y-3 p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
              <pillar.icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="font-display text-lg font-bold">{pillar.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface space-y-3 p-4 sm:p-6">
          <h2 className="font-display text-lg font-extrabold">Do this</h2>
          <ul className="space-y-2">
            {DOS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="surface space-y-3 p-4 sm:p-6">
          <h2 className="font-display text-lg font-extrabold">Never do this</h2>
          <ul className="space-y-2">
            {DONTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">
          Safety rules shown inside the product
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SAFETY_RULES.map((rule) => (
            <li
              key={rule}
              className="surface flex items-start gap-3 p-4 text-sm text-muted-foreground"
            >
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <InfoNote tone="primary" icon={Lock} title="Privacy promise">
          {PRIVACY_PROMISE}
        </InfoNote>
        <InfoNote tone="warning" icon={HandCoins} title="No payment for donation">
          {PAYMENT_PROHIBITION}
        </InfoNote>
        <InfoNote tone="info" icon={Stethoscope} title="Medical boundary">
          {MEDICAL_DISCLAIMER}
        </InfoNote>
        <InfoNote tone="danger" icon={Siren} title="Emergency boundary">
          {EMERGENCY_DISCLAIMER}
        </InfoNote>
        <InfoNote tone="neutral" icon={HeartHandshake} title="Organ donation">
          {ORGAN_DONATION_NOTICE}
        </InfoNote>
        <div className="surface space-y-3 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <FileText className="size-4 text-primary" aria-hidden="true" />
            Read the details
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/terms">Terms &amp; Conditions</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/privacy">Privacy Policy</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/faq">FAQ</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
