import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHelp, Req } from "@/components/FieldText";
import { cn } from "@/lib/utils";

interface Props {
  date: string;
  minDate: string;
  dateError: string | null;
  onDateChange: (v: string) => void;
  distributeNow: boolean;
  onDistributeNowChange: (v: boolean) => void;
  /** What the server does with distribute_now, where it acts on it (Normal, In store). */
  distributeHelp?: string;
  /** True where nothing sends the push without distribute_now (In store, Score, News, Order). */
  distributeRequired: boolean;
  /** The user settings that must be ON for this push type, shown read-only. */
  prereqs: string[];
}

/** The settings every push type shares (proposal §4.2): environment, date, distribute_now, prerequisites. */
export function RunSettings({
  date,
  minDate,
  dateError,
  onDateChange,
  distributeNow,
  onDistributeNowChange,
  distributeHelp,
  distributeRequired,
  prereqs,
}: Props) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-5.5 pt-[18px]">
        <span className="text-[15px] font-semibold">Run settings</span>
        <Badge variant="secondary">Asia/Tokyo</Badge>
      </div>
      <div className="grid grid-cols-1 items-start gap-x-7 gap-y-[22px] px-5.5 pt-4 pb-6 min-[700px]:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]">
        <div>
          <Label htmlFor="ptc-date" className="mb-1.5">
            Delivery date <Req />
          </Label>
          <Input
            id="ptc-date"
            type="date"
            value={date}
            min={minDate || undefined}
            aria-invalid={dateError ? true : undefined}
            onChange={(e) => onDateChange(e.target.value)}
          />
          {dateError ? (
            <FieldError messages={[dateError]} />
          ) : (
            <FieldHelp className="min-[700px]:max-w-[34ch]">
              All times on this page are JST. Defaults to today.
            </FieldHelp>
          )}
        </div>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            distributeNow ? "bg-accent" : "bg-surface-alt",
          )}
        >
          <Checkbox
            className="mt-0.5"
            checked={distributeNow}
            onCheckedChange={(v) => onDistributeNowChange(v === true)}
          />
          <span className="text-[13.5px] leading-normal">
            配信を今すぐ実行 — run the job right away
            <br />
            <span
              className={cn(
                "text-xs font-light",
                // Off on a type nothing else sends: the run would create notifications and send none.
                distributeRequired && !distributeNow
                  ? "text-red-ink"
                  : "text-ink-4",
              )}
            >
              {distributeHelp ??
                "distribute_now. Skips the 10-minute wait once delivery is on. The server accepts it but it does nothing yet."}
            </span>
          </span>
        </label>

        <div className="min-[700px]:col-span-2">
          <span className="text-[12.5px] font-medium text-ink-4">
            Environment
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-line-3 bg-card px-2.5 py-1 text-[12.5px] font-semibold text-ink-2">
              STAG
            </span>
            <span className="text-[12.5px] font-light text-ink-4">
              Fixed for now. Nothing here touches PROD.
            </span>
          </div>
        </div>

        <div className="min-[700px]:col-span-2">
          <span className="text-[12.5px] font-medium text-ink-4">
            Must be ON for the test account
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {prereqs.map((p) => (
              <span
                key={p}
                className="rounded-lg border border-line-3 bg-card px-2.5 py-1 text-[12.5px] text-ink-2"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
