import type { ReactNode } from "react";

import { PageHeader, Pill } from "@/components/common/primitives";
import { SiteFooter } from "@/components/layout/app-shell";
import { MarketingHeader } from "@/components/layout/marketing";
import { BRAND } from "@/lib/brand";

/**
 * Public (unauthenticated) page shell used by the marketing, legal, FAQ and
 * emergency-guidance pages. Keeps the header, spacing and footer consistent.
 */
export function PublicPage({
  eyebrow,
  title,
  description,
  actions,
  badges,
  children,
  maxWidth = "72rem",
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1" style={{ maxWidth: "100%" }}>
        <div className="page-shell page-y" style={{ maxWidth }}>
          <PageHeader title={title} description={description} actions={actions}>
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow ? <Pill tone="primary">{eyebrow}</Pill> : null}
              {badges}
            </div>
          </PageHeader>
          <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">{children}</div>
          <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground sm:mt-10 sm:text-xs">
            {BRAND.name} is a coordination platform. It does not provide medical care, emergency
            services or medical advice, and it never replaces doctors, hospitals, blood banks or
            government organ donation systems.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
