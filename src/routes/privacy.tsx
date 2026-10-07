import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Database, Eye, Lock, Scale, Share2, Trash2, UserCheck } from "lucide-react";

import { InfoNote, Pill } from "@/components/common/primitives";
import { PublicPage } from "@/components/layout/public-page";
import { Button } from "@/components/ui/button";
import { BRAND, LEGAL_REVIEW_NOTICE, PRIVACY_PROMISE } from "@/lib/brand";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    ...pageHead({
      title: "Privacy Policy — Heal Connect",
      description:
        "How Heal Connect collects, uses, protects and retains personal data. Draft content prepared for legal review.",
      path: "/privacy",
    }),
  }),
  component: PrivacyPage,
});

const COLLECTED = [
  {
    icon: UserCheck,
    title: "Account and profile data",
    body: "Name, email address (from Google sign-in or your email registration), optional profile photo, city, area, age, a contact number you choose to provide, and a short introduction.",
  },
  {
    icon: Database,
    title: "Donor details",
    body: "Blood group, availability status, donation preferences, maximum travel distance, last donation date and optional notes for coordinators — all self-reported.",
  },
  {
    icon: Eye,
    title: "Activity data",
    body: "Requests you raise, offers you send, status changes, notifications, verification submissions, reports you file, and members you block.",
  },
  {
    icon: Lock,
    title: "Technical data",
    body: "A session cookie that keeps you signed in, approximate location only if you explicitly allow browser geolocation (rounded to about one kilometre), and service-worker caches that let the app work offline on your device.",
  },
];

const VISIBILITY = [
  {
    label: "Your name, area, city, blood group, availability, verified status",
    visible: "Visible to signed-in members",
  },
  {
    label: "Your phone number",
    visible:
      "Only you, moderators, and a donor or requester whose match is confirmed (and only if you allow sharing)",
  },
  {
    label: "Request contact details",
    visible: "Only the requester, moderators, and a donor whose offer the requester accepted",
  },
  {
    label: "Your exact address or street location",
    visible: "Never collected on requests, never displayed",
  },
  {
    label: "Your stored coordinates",
    visible: "Never displayed. Rounded to ~1 km and used only for distance ranking",
  },
  { label: "Your reports and blocks", visible: "Only you and platform moderators" },
];

const SECTIONS = [
  {
    id: "data-use",
    title: "How we use your data",
    body: [
      "To operate the platform: creating your account, publishing requests, matching donors, delivering notifications, and letting coordinators confirm donors.",
      "To keep the platform safe: reviewing reports, moderating content, verifying accounts and preventing misuse such as payment-for-blood listings.",
      "To improve the product: aggregated, non-identifying statistics such as the number of open requests, units coordinated and cities covered.",
      "We do not sell personal data, and we do not use your data for advertising.",
    ],
  },
  {
    id: "privacy-rules",
    title: "Privacy rules built into the product",
    body: [PRIVACY_PROMISE],
  },
  {
    id: "storage",
    title: "Where data is stored",
    body: [
      "In this MVP, data is stored in a structured JSON database on the application server, with an in-memory fallback in environments without a filesystem. Passwords, when used, are stored only as salted PBKDF2 hashes; session tokens are stored as SHA-256 hashes.",
      "[PRODUCTION NOTE — to be completed by the engineering and legal teams: hosting region, database vendor, encryption at rest, backups, sub-processors, and cross-border transfer details.]",
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: [
      "Active account data is retained while your account exists. Notifications are capped and older entries are removed automatically. Sessions expire after 30 days.",
      "When you ask us to delete your account, we remove your profile, contact details and any open requests. Aggregated counts of completed donations are retained in a non-identifying form for reporting.",
      "[RETENTION SCHEDULE — to be finalised with legal counsel, including statutory record-keeping requirements.]",
    ],
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: [
      "You can view and edit your profile and donor details at any time. You can export your account and profile data as JSON from Settings. You can turn phone sharing off, hide yourself from the donor directory, block members and report content.",
      "To request deletion or a copy of your full record, email us from your registered address. [RESPONSE TIMELINES AND STATUTORY RIGHTS — to be completed per jurisdiction.]",
    ],
  },
  {
    id: "children",
    title: "Children",
    body: [
      "The platform is intended for people aged 18 and over. We do not knowingly collect data from children. If you believe a minor has created an account, contact us and we will remove it.",
    ],
  },
];

function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="What we collect, why we collect it, who can see it, and the choices you control. This draft is published for product development and requires legal review."
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/terms">Terms &amp; Conditions</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/settings">
              <Lock className="size-4" aria-hidden="true" />
              Manage my privacy
            </Link>
          </Button>
        </>
      }
      badges={
        <>
          <Pill tone="warning">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Draft — pending legal review
          </Pill>
          <Pill tone="neutral">
            Last updated{" "}
            {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </Pill>
        </>
      }
      maxWidth="56rem"
    >
      <InfoNote tone="warning" icon={Scale} title="Placeholder / legal-review content">
        {LEGAL_REVIEW_NOTICE}
      </InfoNote>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-extrabold">What we collect</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {COLLECTED.map((item) => (
            <article key={item.title} className="surface space-y-2 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-base font-bold">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
        <InfoNote tone="primary" icon={Lock} title="What we never collect">
          ID documents, medical reports, prescriptions, bank details, card details or payment
          information. If anyone asks you for these on Heal Connect, report it immediately —
          legitimate coordination never needs them.
        </InfoNote>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-extrabold">Who can see what</h2>
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">Data visibility by field and audience</caption>
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="p-3 text-left font-semibold">
                  Information
                </th>
                <th scope="col" className="p-3 text-left font-semibold">
                  Who can see it
                </th>
              </tr>
            </thead>
            <tbody>
              {VISIBILITY.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <th scope="row" className="p-3 text-left font-medium">
                    {row.label}
                  </th>
                  <td className="p-3 text-muted-foreground">{row.visible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="surface space-y-3 p-4 sm:p-6 scroll-mt-24"
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Share2 className="size-4 text-primary" aria-hidden="true" />
              {section.title}
            </h2>
            {section.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <InfoNote tone="info" icon={Trash2} title="Deleting your account">
        Email{" "}
        <a className="tap-link font-semibold underline" href={`mailto:${BRAND.supportEmail}`}>
          {BRAND.supportEmail}
        </a>{" "}
        from your registered address. We remove your account, profile and contact details, and any
        open requests you raised. Completed donation counts are kept anonymously for reporting.
      </InfoNote>
    </PublicPage>
  );
}
