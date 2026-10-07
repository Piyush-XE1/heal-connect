import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HeartHandshake, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { PageHeader, Pill } from "@/components/common/primitives";
import { RequestForm } from "@/components/requests/request-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { URGENCIES, type Urgency } from "@/lib/domain";
import { pageHead } from "@/lib/seo";

const searchSchema = z.object({
  urgency: z.enum(URGENCIES).optional(),
});

export const Route = createFileRoute("/_app/requests/new")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () =>
    pageHead({
      title: "Request help — Heal Connect",
      description:
        "Raise a blood, platelet or medical assistance request with clear urgency, hospital and coordination details.",
      noIndex: true,
    }),
  component: NewRequestPage,
});

function NewRequestPage() {
  const { urgency } = Route.useSearch();
  const { user } = useAuth();

  return (
    <div className="page-shell max-w-3xl space-y-6 page-y">
      <PageHeader
        title="Request help"
        description="Tell donors exactly what is needed. The clearer the request, the faster a compatible donor can act."
        actions={
          <Button asChild variant="outline">
            <Link to="/my-requests">
              <ArrowLeft className="size-4" aria-hidden="true" />
              My requests
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Pill tone="primary">
            <HeartHandshake className="size-3.5" aria-hidden="true" />
            For recipients and coordinators
          </Pill>
          <Pill tone="success">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Reviewed for safety
          </Pill>
        </div>
      </PageHeader>

      <RequestForm
        mode="create"
        defaults={{
          contactName: user?.name ?? "",
          contactPhone: user?.profile.phone ?? "",
          city: user?.profile.city ?? "",
          area: user?.profile.area ?? "",
          ...(urgency ? { urgency: urgency as Urgency } : {}),
        }}
        onCancel={() => window.history.back()}
      />
    </div>
  );
}
