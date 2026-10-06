import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Heart, Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BloodGroupChip, InfoNote, Pill, UrgencyBadge } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { COMPATIBILITY_DISCLAIMER, MEDICAL_DECISION_DISCLAIMER } from "@/lib/blood";
import { dueLabel } from "@/lib/format";
import { invalidationGroups } from "@/lib/query-keys";
import type { RequestSearchItem } from "@/server/api/requests";
import { createDonorResponse } from "@/server/api/responses";

export function RespondDialog({
  item,
  open,
  onOpenChange,
}: {
  item: RequestSearchItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [shareContact, setShareContact] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setMessage("");
      setShareContact(false);
      setConfirmed(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("Missing request");
      return unwrapAction(
        await createDonorResponse({
          data: {
            requestId: item.id,
            ...(message.trim() ? { message: message.trim() } : {}),
            shareContact,
          },
        }),
      );
    },
    onSuccess: () => {
      toast.success("Offer sent", {
        description:
          "The requester has been notified. You can withdraw your offer any time from My Activity.",
      });
      onOpenChange(false);
      for (const key of invalidationGroups.afterResponseChange) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (item) void queryClient.invalidateQueries({ queryKey: ["request", item.id] });
    },
    onError: (error) => toast.error("Could not send your offer", { description: errorMessage(error) }),
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm you can help</DialogTitle>
          <DialogDescription>
            The requester or coordinator is notified as soon as you send this. Nothing is final — you can withdraw
            at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="surface space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <UrgencyBadge urgency={item.urgency} />
              <BloodGroupChip group={item.bloodGroup} />
            </div>
            <p className="font-display text-sm font-bold">{item.hospitalName}</p>
            <p className="text-xs text-muted-foreground">
              {[item.area, item.city].filter(Boolean).join(", ")} · {item.unitsRequired} unit
              {item.unitsRequired === 1 ? "" : "s"} · {dueLabel(item.requiredBy)}
            </p>
            <p className="text-xs text-muted-foreground">Request {item.reference}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="response-message">Message to the coordinator (optional)</Label>
            <Textarea
              id="response-message"
              rows={3}
              maxLength={400}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="e.g. I can reach the hospital blood bank tomorrow morning between 9 and 11."
            />
            <p className="text-xs text-muted-foreground">{message.length}/400 characters</p>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input accent-primary"
              checked={shareContact}
              onChange={(event) => setShareContact(event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 font-semibold">
                <PhoneCall className="size-4 text-primary" aria-hidden="true" />
                Share my contact number with the coordinator
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Only the person coordinating this request can see it, and only if they accept your offer.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input accent-primary"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                I understand the medical boundary
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{MEDICAL_DECISION_DISCLAIMER}</span>
            </span>
          </label>

          <InfoNote tone="warning" icon={AlertTriangle} title="Before you travel">
            {COMPATIBILITY_DISCLAIMER} Confirm the ward, timing and documents with the hospital blood bank, and
            never share money, bank details or identity documents with anyone you met here.
          </InfoNote>

          <div className="flex flex-wrap gap-2">
            <Pill tone="primary">Free — never paid</Pill>
            <Pill tone="neutral">Your address stays hidden</Pill>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Not now
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !confirmed}
            title={!confirmed ? "Please confirm the medical boundary first" : undefined}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Heart className="size-4" aria-hidden="true" />
            )}
            Send my offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
