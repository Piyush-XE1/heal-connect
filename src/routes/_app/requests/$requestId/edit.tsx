import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";

import { ErrorState, PageHeader, Pill, SkeletonCard } from "@/components/common/primitives";
import { RequestForm } from "@/components/requests/request-form";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";
import { unwrapAction } from "@/lib/actions";
import { fetchRequest } from "@/server/api/requests";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/requests/$requestId/edit")({
  head: () =>
    pageHead({
      title: "Edit request — Heal Connect",
      description:
        "Update the blood group, units, date, urgency or coordination details of your request.",
      noIndex: true,
    }),
  component: EditRequestPage,
});

function EditRequestPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: async () => unwrapAction(await fetchRequest({ data: { id: requestId } })),
  });

  if (isLoading) {
    return (
      <div className="page-shell max-w-3xl py-8">
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-shell max-w-3xl py-10">
        <ErrorState
          title="We could not load this request"
          description="It may have been removed, or you may not have access to it."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!data.isOwner && !data.isAdmin) {
    return (
      <div className="page-shell max-w-3xl py-10">
        <ErrorState
          title="You cannot edit this request"
          description="Only the person who raised the request (or a moderator) can edit it."
        />
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link to="/requests/$requestId" params={{ requestId }}>
              View request
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { request } = data;

  return (
    <div className="page-shell max-w-3xl space-y-6 py-8">
      <PageHeader
        title="Edit request"
        description="Changes to the blood group, units, date or urgency notify every donor who offered help."
        actions={
          <Button asChild variant="outline">
            <Link to="/requests/$requestId" params={{ requestId }}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to request
            </Link>
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Pill tone="neutral">{request.reference}</Pill>
          <Pill tone="primary">
            <Pencil className="size-3.5" aria-hidden="true" />
            Editing
          </Pill>
        </div>
      </PageHeader>

      <RequestForm
        mode="edit"
        requestId={request.id}
        defaults={{
          requestType: request.requestType,
          bloodGroup: request.bloodGroup,
          unitsRequired: request.unitsRequired,
          hospitalName: request.hospitalName,
          city: request.city,
          area: request.area ?? "",
          requiredBy: request.requiredBy,
          urgency: request.urgency,
          additionalInfo: request.additionalInfo ?? "",
          contactName: request.contact?.name ?? request.requesterName,
          contactPhone: request.contact?.phone ?? "",
          contactInstructions: request.contact?.instructions ?? "",
          consent: true,
        }}
        isDraft={request.status === "draft"}
        onCancel={() => void navigate({ to: "/requests/$requestId", params: { requestId } })}
      />
    </div>
  );
}
