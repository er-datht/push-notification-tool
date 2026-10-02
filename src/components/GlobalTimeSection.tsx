import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, Req } from "@/components/FieldText";
import { ORDER_BLOCK_STEP_MIN, timeFor, type FormRow } from "@/lib/types";
import type { PushTypeConfig } from "@/lib/pushTypes";

interface Props {
  pushType: PushTypeConfig;
  rows: FormRow[];
  hour: string;
  min: string;
  onHourChange: (v: string) => void;
  onMinChange: (v: string) => void;
  error: string | null;
}

/** Order push only: one shared start time for the whole run — rows are auto-staggered `ORDER_BLOCK_STEP_MIN` apart. */
export function GlobalTimeSection({
  pushType,
  rows,
  hour,
  min,
  onHourChange,
  onMinChange,
  error,
}: Props) {
  const preview =
    rows
      .slice(0, 3)
      .map(
        (r, i) =>
          `${pushType.noun} ${i + 1} at ${timeFor(r.values, i, pushType, hour, min)}`,
      )
      .join(" · ") + (rows.length > 3 ? " …" : "");

  return (
    <Card id="ptc-global-time" className="scroll-mt-4">
      <div className="px-5.5 pt-[18px]">
        <span className="text-[15px] font-semibold">Start time</span>
        <p className="mt-1 max-w-[64ch] text-[13.5px] leading-relaxed font-light text-ink-2">
          One start time for the whole run. Each{" "}
          {pushType.noun.toLowerCase()} is timed {ORDER_BLOCK_STEP_MIN} minutes
          after the one before it. The times are only labels: Order is
          published by hand.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5.5 pt-4 pb-6">
        <div>
          <Label htmlFor="ptc-global-hour" className="mb-1.5">
            Hour <Req />
          </Label>
          <Input
            id="ptc-global-hour"
            className="w-20 px-1.5 text-center"
            inputMode="numeric"
            aria-invalid={error ? true : undefined}
            value={hour}
            onChange={(e) => onHourChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ptc-global-min" className="mb-1.5">
            Minute <Req />
          </Label>
          <Input
            id="ptc-global-min"
            className="w-20 px-1.5 text-center"
            inputMode="numeric"
            aria-invalid={error ? true : undefined}
            value={min}
            onChange={(e) => onMinChange(e.target.value)}
          />
        </div>
        <p className="pb-2 text-[13px] font-light text-ink-4">{preview}</p>
      </div>
      {error && (
        <div className="mx-5.5 mb-5 rounded-lg bg-red-tint px-4 py-3">
          <FieldError messages={[error]} />
        </div>
      )}
    </Card>
  );
}
