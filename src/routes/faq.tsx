import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { InfoNote, Pill } from "@/components/common/primitives";
import { PublicPage } from "@/components/layout/public-page";
import { Button } from "@/components/ui/button";
import { FAQ_ITEMS, type FaqItem } from "@/lib/faq";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Frequently asked questions — Heal Connect" },
      {
        name: "description",
        content:
          "Answers about medical boundaries, privacy, verification, payments, emergency requests and how matching works on Heal Connect.",
      },
    ],
  }),
  component: FaqPage,
});

const CATEGORIES: { id: FaqItem["category"] | "all"; label: string }[] = [
  { id: "all", label: "All questions" },
  { id: "general", label: "General" },
  { id: "donors", label: "For donors" },
  { id: "recipients", label: "For recipients" },
  { id: "safety", label: "Safety & privacy" },
];

function FaqPage() {
  const [category, setCategory] = useState<FaqItem["category"] | "all">("all");
  const items = FAQ_ITEMS.filter((item) => (category === "all" ? true : item.category === category));

  return (
    <PublicPage
      eyebrow="FAQ"
      title="Frequently asked questions"
      description={`Everything people usually want to know before using ${BRAND.name}. If something is still unclear, our support inbox is open.`}
      actions={
        <>
          <Button asChild>
            <Link to="/register">Create an account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/safety">Safety guidelines</Link>
          </Button>
        </>
      }
      badges={<Pill tone="primary">{FAQ_ITEMS.length} questions</Pill>}
    >
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="FAQ categories">
        {CATEGORIES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={category === option.id}
            onClick={() => setCategory(option.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              category === option.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <details key={item.id} className="surface group p-5" open={category !== "all"}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-bold">
              {item.question}
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </details>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions in this category yet.</p>
        ) : null}
      </div>

      <InfoNote tone="warning" title="Still not sure about a medical decision?">
        Please speak to the treating doctor, the hospital blood bank or a licensed clinician. {BRAND.name} does not
        provide medical advice, and our team cannot tell you whether you are eligible to donate.
      </InfoNote>

      <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-display text-lg font-extrabold">Have a question we missed?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Email{" "}
            <a className="font-semibold text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>{" "}
            and we will add it to this list.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`mailto:${BRAND.supportEmail}`}>Contact support</a>
        </Button>
      </div>
    </PublicPage>
  );
}
