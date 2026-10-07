import { Check, Minus } from "lucide-react";

import { COMPATIBILITY_DISCLAIMER, canDonateTo } from "@/lib/blood";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/domain";
import { InfoNote } from "@/components/common/primitives";

/**
 * General red-blood-cell compatibility reference. Presented as education only —
 * every surface that shows this also states that the blood bank confirms the
 * final match.
 */
export function CompatibilityMatrix({ highlight }: { highlight?: BloodGroup | null }) {
  return (
    /*
     * `min-w-0` matters here: without it the 34rem table below sets the
     * min-content width of whatever grid/flex track this component sits in, so
     * the whole section was pushed wider than a phone screen.
     */
    <div className="min-w-0 space-y-4">
      <div className="scroll-thin -mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[30rem] border-separate border-spacing-0 text-sm sm:min-w-[34rem]">
          <caption className="sr-only">
            General red-blood-cell compatibility: rows are donor blood groups, columns are recipient
            blood groups. A tick means the donor group can often donate to that recipient group. The
            blood bank always confirms the final match.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 bg-card p-2 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase"
              >
                Donor ↓ / Recipient →
              </th>
              {BLOOD_GROUPS.map((group) => (
                <th
                  key={group}
                  scope="col"
                  className={
                    highlight === group
                      ? "bg-blood/10 p-2 text-center font-display text-sm font-extrabold text-blood"
                      : "p-2 text-center font-display text-sm font-extrabold"
                  }
                >
                  {group}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BLOOD_GROUPS.map((donor) => (
              <tr key={donor}>
                <th
                  scope="row"
                  className={
                    highlight === donor
                      ? "sticky left-0 bg-blood/10 p-2 text-left font-display text-sm font-extrabold text-blood"
                      : "sticky left-0 bg-card p-2 text-left font-display text-sm font-extrabold"
                  }
                >
                  {donor}
                </th>
                {BLOOD_GROUPS.map((recipient) => {
                  const compatible = canDonateTo(donor, recipient);
                  return (
                    <td
                      key={`${donor}-${recipient}`}
                      className={
                        compatible
                          ? "border-t border-border/70 bg-success/10 p-2 text-center text-success"
                          : "border-t border-border/70 p-2 text-center text-muted-foreground/50"
                      }
                    >
                      {compatible ? (
                        <>
                          <Check className="mx-auto size-4" aria-hidden="true" />
                          <span className="sr-only">Compatible</span>
                        </>
                      ) : (
                        <>
                          <Minus className="mx-auto size-4" aria-hidden="true" />
                          <span className="sr-only">Not a routine match</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InfoNote tone="warning" title="General information, not a medical decision">
        {COMPATIBILITY_DISCLAIMER}
      </InfoNote>
    </div>
  );
}
