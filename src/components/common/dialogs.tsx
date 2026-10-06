import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2, ShieldBan } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/domain";
import { REPORT_REASON_LABELS } from "@/lib/labels";
import { errorMessage, unwrapAction } from "@/lib/actions";
import { queryKeys } from "@/lib/query-keys";
import { blockUser, createReport, unblockUser } from "@/server/api/safety";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={async (event) => {
              event.preventDefault();
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReportDialog({
  targetType,
  targetId,
  trigger,
  label = "Report",
}: {
  targetType: ReportTarget;
  targetId: string;
  trigger: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("misleading_information");
  const [details, setDetails] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      unwrapAction(
        await createReport({
          data: {
            targetType,
            targetId,
            reason,
            ...(details.trim() ? { details: details.trim() } : {}),
          },
        }),
      ),
    onSuccess: () => {
      toast.success("Report sent", {
        description: "Our trust & safety team will review this. Thank you for keeping the platform safe.",
      });
      setOpen(false);
      setDetails("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.myReports });
    },
    onError: (error) => {
      toast.error("Could not send report", { description: errorMessage(error) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report {targetType === "user" ? "a member" : "a request"}</DialogTitle>
          <DialogDescription>
            Reports go to platform moderators only. Nothing is shared with the person you are reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {REPORT_REASON_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">What happened? (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={600}
              rows={4}
              placeholder="Share the details that help a moderator review this quickly."
            />
            <p className="text-xs text-muted-foreground">{details.length}/600 characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {label} {targetType === "user" ? "member" : "request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportButton({
  targetType,
  targetId,
  className,
  label = "Report",
}: {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
  label?: string;
}) {
  return (
    <ReportDialog
      targetType={targetType}
      targetId={targetId}
      label={label}
      trigger={
        <Button variant="ghost" size="sm" className={className}>
          <Flag className="size-4" aria-hidden="true" />
          {label}
        </Button>
      }
    />
  );
}

export function BlockUserButton({
  userId,
  name,
  blocked,
  className,
}: {
  userId: string;
  name: string;
  blocked: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapAction(
        blocked ? await unblockUser({ data: { userId } }) : await blockUser({ data: { userId } }),
      ),
    onSuccess: () => {
      toast.success(blocked ? `${name} unblocked` : `${name} blocked`, {
        description: blocked
          ? "They can appear in your matches again."
          : "You will not see their requests or offers, and they cannot respond to yours.",
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => toast.error("Could not update block", { description: errorMessage(error) }),
  });

  return (
    <ConfirmDialog
      title={blocked ? `Unblock ${name}?` : `Block ${name}?`}
      description={
        blocked
          ? "Their requests and offers will be visible to you again."
          : "You will no longer see each other's requests or offers. Existing pending offers are withdrawn."
      }
      confirmLabel={blocked ? "Unblock" : "Block"}
      destructive={!blocked}
      onConfirm={async () => {
        await mutation.mutateAsync();
      }}
      trigger={
        <Button variant="outline" size="sm" className={className}>
          <ShieldBan className="size-4" aria-hidden="true" />
          {blocked ? "Unblock" : "Block"}
        </Button>
      }
    />
  );
}
