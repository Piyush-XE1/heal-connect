import { Link } from "@tanstack/react-router";
import { ArrowLeft, Droplet, Lock, ShieldCheck, Stethoscope } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/common/logo";
import { Pill } from "@/components/common/primitives";
import { BRAND, MEDICAL_DISCLAIMER } from "@/lib/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  badges = true,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  badges?: boolean;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden gradient-brand p-10 text-white lg:flex">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <Logo className="[&_span]:text-white" />
          </Link>
          <p className="mt-10 max-w-sm font-display text-3xl leading-tight font-extrabold">
            {BRAND.tagline}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/85">{BRAND.positioning}</p>
        </div>

        <ul className="space-y-4">
          {[
            { icon: Lock, text: "City-level locations only — never your street address." },
            { icon: Stethoscope, text: "Hospitals and blood banks make every medical decision." },
            { icon: ShieldCheck, text: "Payment for donation is prohibited and moderated." },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-3 text-sm text-white/90">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white/15">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed text-white/70">{MEDICAL_DISCLAIMER}</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex items-center">
              <Logo compact />
            </Link>
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to home
          </Link>

          <h1 className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

          {badges ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill tone="blood">
                <Droplet className="size-3.5" aria-hidden="true" /> Blood &amp; platelets
              </Pill>
              <Pill tone="primary">
                <ShieldCheck className="size-3.5" aria-hidden="true" /> Privacy-first
              </Pill>
              <Pill tone="success">No payments</Pill>
            </div>
          ) : null}

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
