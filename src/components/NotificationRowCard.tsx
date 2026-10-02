import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldControl } from "@/components/FieldControl";
import { FieldError, FieldHelp, Req } from "@/components/FieldText";
import { ItemList } from "@/components/ItemList";
import { TruncatedText } from "@/components/TruncatedText";
import {
  errorsForField,
  itemField,
  pad,
  rowDomId,
  type FormRow,
  type RowError,
  type RowField,
} from "@/lib/types";
import type { PushTypeConfig } from "@/lib/pushTypes";
import { cn } from "@/lib/utils";

interface Props {
  row: FormRow;
  index: number;
  pushType: PushTypeConfig;
  errors: RowError[];
  canRemove: boolean;
  onPatch: (key: string, value: string) => void;
  onPatchItem: (itemId: number, key: string, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: number) => void;
  onToggleCollapse: () => void;
  onRemove: () => void;
  /** Only set when `pushType.globalTime` — there are no per-row hour/min inputs then, so the
   *  header's time badge shows this instead. */
  computedTime?: string;
}

/** Every RowField an input on this card shows errors for. Anything else goes to the summary block. */
function ownedFields(row: FormRow, pushType: PushTypeConfig): Set<RowField> {
  const owned = new Set<RowField>();
  if (!pushType.globalTime) ["hour", "min", "time"].forEach((f) => owned.add(f));
  for (const f of pushType.fields) owned.add(f.link ? "linkValue" : f.key);
  const group = pushType.items;
  if (group) {
    owned.add(group.key);
    row.items.forEach((_, j) =>
      group.fields.forEach((f) => owned.add(itemField(group, j, f.key))),
    );
  }
  return owned;
}

export function NotificationRowCard({
  row,
  index,
  pushType,
  errors,
  canRemove,
  onPatch,
  onPatchItem,
  onAddItem,
  onRemoveItem,
  onToggleCollapse,
  onRemove,
  computedTime,
}: Props) {
  const v = row.values;
  const open = !row.collapsed;
  const uid = rowDomId(row.id);
  const toggle = onToggleCollapse;

  // A `time` error is about the hour and the minute together, so both inputs get marked.
  const timeErrors = errorsForField(errors, "hour", "min", "time");
  const hourBad = errorsForField(errors, "hour", "time").length > 0;
  const minBad = errorsForField(errors, "min", "time").length > 0;
  // A message no input on this card owns (e.g. an Order `time` error from the API) still has to show.
  const owned = ownedFields(row, pushType);
  const unplaced = errors
    .filter((e) => e.field === null || !owned.has(e.field))
    .map((e) => e.message);
  const summary = pushType.preview(row).title;
  const timeErrId = `${uid}-time-err`;

  return (
    <Card
      id={uid}
      className={cn(
        // scroll-mt keeps a little air above the card when the page scrolls to it.
        "relative scroll-mt-4",
        errors.length &&
          "before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-[3px] before:rounded-l-lg before:bg-destructive",
      )}
    >
      <div
        className="flex cursor-pointer flex-wrap items-center gap-3 px-5.5 py-4"
        onClick={toggle}
      >
        <span className="text-[15px] font-semibold">
          {pushType.noun} {index + 1}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {pushType.globalTime
            ? (computedTime ?? "--:--")
            : `${pad(v.hour || "0")}:${pad(v.min || "0")}`}
        </Badge>
        <TruncatedText className="order-5 min-w-0 flex-1 basis-full text-[13.5px] font-light text-ink-3 min-[860px]:order-none min-[860px]:basis-auto">
          {summary}
        </TruncatedText>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          {row.collapsed ? "Edit" : "Collapse"}
        </Button>
        <Button
          variant="muted"
          size="sm"
          disabled={!canRemove}
          title={canRemove ? undefined : "A run needs at least one row"}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          Remove
        </Button>
      </div>

      {open && (
        <div className="border-t border-line-3 px-5.5 pt-2 pb-6.5">
          <div className="mt-5.5 grid grid-cols-6 gap-x-5 gap-y-4.5 min-[700px]:grid-cols-12">
            {!pushType.globalTime && (
              <div className="col-span-6 min-[700px]:col-span-4">
                {/* A caption for a group of inputs, not a label for one, so it is a span with the Label look. */}
                <Label asChild className="mb-1.5">
                  <span id={`${uid}-time-label`}>
                    Delivery time (JST) <Req />
                  </span>
                </Label>
                <div
                  className="flex items-center gap-1.5"
                  role="group"
                  aria-labelledby={`${uid}-time-label`}
                >
                  <Input
                    id={`${uid}-hour`}
                    className="px-1.5 text-center"
                    inputMode="numeric"
                    aria-label="Hour"
                    aria-invalid={hourBad || undefined}
                    aria-describedby={timeErrors.length ? timeErrId : undefined}
                    value={v.hour ?? ""}
                    onChange={(e) => onPatch("hour", e.target.value)}
                  />
                  <span
                    className="text-[15px] font-semibold text-ink-4"
                    aria-hidden="true"
                  >
                    :
                  </span>
                  <Input
                    id={`${uid}-min`}
                    className="px-1.5 text-center"
                    inputMode="numeric"
                    aria-label="Minute"
                    aria-invalid={minBad || undefined}
                    aria-describedby={timeErrors.length ? timeErrId : undefined}
                    value={v.min ?? ""}
                    onChange={(e) => onPatch("min", e.target.value)}
                  />
                </div>
                <FieldError id={timeErrId} messages={timeErrors} />
                {!timeErrors.length && (
                  <FieldHelp>{pushType.timeHelp}</FieldHelp>
                )}
              </div>
            )}

            {pushType.fields
              .filter((f) => f.key !== "hour" && f.key !== "min")
              .map((f) => (
                <FieldControl
                  key={f.key}
                  field={f}
                  values={v}
                  idPrefix={uid}
                  messages={errorsForField(errors, f.link ? "linkValue" : f.key)}
                  onChange={onPatch}
                />
              ))}

            {pushType.items && (
              <ItemList
                row={row}
                group={pushType.items}
                pushType={pushType}
                errors={errors}
                onPatchItem={onPatchItem}
                onAddItem={onAddItem}
                onRemoveItem={onRemoveItem}
              />
            )}
          </div>

          {unplaced.length > 0 && (
            <div
              className="mt-5 rounded-lg bg-red-tint px-4 py-3.5"
              role="alert"
            >
              <div className="mb-1.5 text-[13px] font-semibold text-red-ink">
                The API also said
              </div>
              {unplaced.map((t) => (
                <div
                  key={t}
                  className="text-[13px] leading-relaxed font-light text-red-ink"
                >
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
