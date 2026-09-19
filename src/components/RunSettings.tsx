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
}

export function RunSettings({
  date,
  minDate,
  dateError,
  onDateChange,
  distributeNow,
  onDistributeNowChange,
}: Props) {
  return (
    <Card className="mt-8">
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
              All times on this page are JST. The import job only takes files
              due within 2 hours, so in practice this is always today.
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
            <span className="text-xs font-light text-ink-4">
              distribute_now. Skips the 10-minute wait once delivery is on.
              The server accepts it but it does nothing yet.
            </span>
          </span>
        </label>
      </div>
    </Card>
  );
}
