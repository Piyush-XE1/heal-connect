import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, FileText, Scale, ShieldCheck } from "lucide-react";

import { InfoNote, Pill } from "@/components/common/primitives";
import { PublicPage } from "@/components/layout/public-page";
import { Button } from "@/components/ui/button";
import { BRAND, LEGAL_REVIEW_NOTICE, PAYMENT_PROHIBITION } from "@/lib/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Heal Connect" },
      {
        name: "description",
        content:
          "Terms and conditions for using Heal Connect. Draft content prepared for legal review before launch.",
      },
    ],
  }),
  component: TermsPage,
});

type Section = { id: string; title: string; body: string[]; placeholder?: boolean };

const SECTIONS: Section[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of these terms",
    body: [
      `By accessing or using ${BRAND.name} (the "Platform"), you agree to these Terms & Conditions and to our Privacy Policy. If you do not agree, please do not use the Platform.`,
    ],
    placeholder: true,
  },
  {
    id: "what-heal-connect-is",
    title: "2. What Heal Connect is — and is not",
    body: [
      `${BRAND.name} is a coordination platform that connects volunteers willing to donate blood or platelets (and, in limited cases, to offer non-clinical assistance) with people who have raised a legitimate medical donation request.`,
      `The Platform is not a hospital, blood bank, medical provider, diagnostic service, ambulance service or emergency service. We do not provide medical advice, we do not screen donors, we do not confirm compatibility and we do not guarantee that any request will be fulfilled. All medical decisions — including donor eligibility, screening, cross-matching and the donation itself — are made by qualified medical professionals and licensed blood banks.`,
      "In any medical emergency you must contact your local emergency services and the hospital blood bank directly.",
    ],
    placeholder: true,
  },
  {
    id: "eligibility",
    title: "3. Eligibility to use the Platform",
    body: [
      "You must be at least 18 years old to create an account or raise a request. By registering you confirm that the information you provide is accurate and that you have the right to share the details of any patient on whose behalf you are coordinating.",
      "You must not use the Platform if you have been suspended previously for policy violations, or if doing so would breach any law that applies to you.",
    ],
    placeholder: true,
  },
  {
    id: "prohibited",
    title: "4. Prohibited activity",
    body: [
      PAYMENT_PROHIBITION,
      "The following are strictly prohibited and will result in removal of content and suspension or termination of your account:",
      "• Offering, requesting or facilitating payment, compensation, gifts or favours for blood, blood components or organs; • any organ buying, selling, brokering or private organ arrangement; • posting false, misleading or duplicated requests; • impersonating a hospital, blood bank, clinician, NGO or another member; • harassment, threats, discriminatory behaviour or unsolicited marketing; • publishing another person's private information (including phone numbers, addresses, medical reports or identity documents) without their consent; • using the Platform for any unlawful purpose.",
    ],
    placeholder: true,
  },
  {
    id: "user-content",
    title: "5. Your content and licence",
    body: [
      "You keep ownership of the content you submit (requests, profile details, messages). By submitting content you grant us a limited licence to store, display and process it so the Platform can function — for example, showing your request to matching donors and sending notifications.",
      "You are responsible for the accuracy of your content and for having consent from anyone whose information you include.",
    ],
    placeholder: true,
  },
  {
    id: "verification",
    title: "6. Verification and badges",
    body: [
      "Optional verification is a manual review process in this MVP. A verified badge indicates that our trust & safety team reviewed the information supplied. It is a trust signal only: it is not a medical certification, it does not confirm donor eligibility and it does not guarantee that a donor or requester will act in good faith.",
    ],
    placeholder: true,
  },
  {
    id: "moderation",
    title: "7. Moderation, suspension and removal",
    body: [
      "We may review, edit, restrict or remove any content, and suspend or terminate any account, where we believe these terms have been breached or where keeping the content online would put members at risk.",
      "You can report a request or member from within the product, and you can block other members. Reports are visible to moderators only.",
    ],
    placeholder: true,
  },
  {
    id: "no-warranty",
    title: "8. No warranty; limitation of liability",
    body: [
      "The Platform is provided on an “as is” and “as available” basis. To the maximum extent permitted by law, we disclaim all warranties, express or implied, including fitness for a particular purpose and uninterrupted availability.",
      "To the maximum extent permitted by law, we are not liable for indirect, incidental or consequential losses, or for any loss arising from reliance on information posted by members, from a donation or from a failure to find a donor. Nothing in these terms excludes liability that cannot lawfully be excluded.",
    ],
    placeholder: true,
  },
  {
    id: "changes",
    title: "9. Changes and governing law",
    body: [
      "We may update these terms as the product evolves. Material changes will be highlighted in the product. Continued use after an update constitutes acceptance.",
      "[GOVERNING LAW AND JURISDICTION — to be completed by legal counsel, together with the registered entity name, address and dispute resolution process.]",
    ],
    placeholder: true,
  },
];

function TermsPage() {
  return (
    <PublicPage
      eyebrow="Legal"
      title="Terms & Conditions"
      description="The rules for using Heal Connect. This draft is published for product development and must be reviewed by a qualified lawyer before launch."
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/privacy">Privacy Policy</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/safety">Safety guidelines</Link>
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
            Last updated {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </Pill>
        </>
      }
      maxWidth="56rem"
    >
      <InfoNote tone="warning" icon={Scale} title="Placeholder / legal-review content">
        {LEGAL_REVIEW_NOTICE}
      </InfoNote>

      <nav aria-label="Sections" className="surface p-5">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">On this page</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a className="text-sm text-primary hover:underline" href={`#${section.id}`}>
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="surface space-y-3 p-6 scroll-mt-24">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <FileText className="size-4 text-primary" aria-hidden="true" />
              {section.title}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.placeholder ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                Reviewer note: confirm wording with legal counsel for your jurisdiction before launch.
              </p>
            ) : null}
          </section>
        ))}
      </div>

      <InfoNote tone="primary" icon={ShieldCheck} title="Questions about these terms">
        Email{" "}
        <a className="font-semibold underline" href={`mailto:${BRAND.supportEmail}`}>
          {BRAND.supportEmail}
        </a>{" "}
        and we will route your question to the right person.
      </InfoNote>
    </PublicPage>
  );
}
