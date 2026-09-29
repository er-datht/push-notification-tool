import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { FieldError, FieldHelp, Req } from "@/components/FieldText";
import { TruncatedText } from "@/components/TruncatedText";
import {
  DELIV_ID_MAX,
  errorsForField,
  LINKS,
  rowDomId,
  type FormRow,
  type LinkKind,
  type RowError,
} from "@/lib/types";
import type { FieldConfig } from "@/lib/fields";
import type { PushTypeConfig } from "@/lib/pushTypes";
import { cn } from "@/lib/utils";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

interface Props {
  row: FormRow;
  index: number;
  pushType: PushTypeConfig;
  errors: RowError[];
  canRemove: boolean;
  onPatch: (key: string, value: string) => void;
  onToggleCollapse: () => void;
  onRemove: () => void;
  /** Only set when `pushType.globalTime` — there are no per-row hour/min inputs then, so the
   *  header's time badge shows this instead. */
  computedTime?: string;
}

/** 12-col grid at >=700px, 6-col (i.e. full width) below — every field is full width on mobile. */
const SPAN_CLASS: Record<FieldConfig["span"], string> = {
  4: "col-span-6 min-[700px]:col-span-4",
  6: "col-span-6 min-[700px]:col-span-6",
  8: "col-span-6 min-[700px]:col-span-8",
  12: "col-span-6 min-[700px]:col-span-12",
};

export function NotificationRowCard({
  row,
  index,
  pushType,
  errors,
  canRemove,
  onPatch,
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
  // A message we could not match to an input still has to show somewhere.
  const unplaced = errors.filter((e) => e.field === null).map((e) => e.message);
  const summary = pushType.preview(v).title;

  /** The id of one input's error text, used both on the text and in the input's `aria-describedby`. */
  const errId = (slot: string) => `${uid}-${slot}-err`;
  /** Links an input to its error text, so screen readers read the two together. */
  const describedBy = (slot: string, messages: string[]) =>
    messages.length ? errId(slot) : undefined;

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
            : `${v.hour || "0"}`.padStart(2, "0") +
              ":" +
              `${v.min || "0"}`.padStart(2, "0")}
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
                    aria-describedby={describedBy("time", timeErrors)}
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
                    aria-describedby={describedBy("time", timeErrors)}
                    value={v.min ?? ""}
                    onChange={(e) => onPatch("min", e.target.value)}
                  />
                </div>
                <FieldError id={errId("time")} messages={timeErrors} />
                {!timeErrors.length && (
                  <FieldHelp>
                    {`${Math.floor(pushType.windowStartMin / 60)}`.padStart(
                      2,
                      "0",
                    )}
                    :{`${pushType.windowStartMin % 60}`.padStart(2, "0")} to{" "}
                    {`${Math.floor(pushType.windowEndMin / 60)}`.padStart(
                      2,
                      "0",
                    )}
                    :{`${pushType.windowEndMin % 60}`.padStart(2, "0")} JST
                    {pushType.leadMs
                      ? ", and no more than 2 hours from now."
                      : "."}
                  </FieldHelp>
                )}
              </div>
            )}

            {pushType.fields
              .filter((f) => f.key !== "hour" && f.key !== "min")
              .map((f) => {
                const fieldErrors = errorsForField(errors, f.key);
                const bad = fieldErrors.length > 0;

                if (f.fixed !== undefined) {
                  return (
                    <div key={f.key} className={SPAN_CLASS[f.span]}>
                      <Label htmlFor={`${uid}-${f.key}`} className="mb-1.5">
                        {f.label}
                      </Label>
                      <Input
                        id={`${uid}-${f.key}`}
                        value={f.fixed}
                        readOnly
                        title="Fixed for this push type"
                      />
                    </div>
                  );
                }

                if (f.seg) {
                  const value = v[f.key] ?? f.seg[0]?.value ?? "";
                  return (
                    <div key={f.key} className={SPAN_CLASS[f.span]}>
                      <Label asChild className="mb-2">
                        <span id={`${uid}-${f.key}-label`}>
                          {f.label} {f.required && <Req />}
                        </span>
                      </Label>
                      {/* Segmented control: the radios stay for keyboard and screen readers, the labels carry the look.
                          The bare Radix item is used on purpose — the styled `RadioGroupItem` keeps its 16px box even under `sr-only`. */}
                      <RadioGroup
                        className={cn(
                          "inline-flex w-auto flex-wrap gap-1 rounded-lg bg-muted p-1",
                          bad &&
                            "bg-red-tint ring-1 ring-destructive ring-inset",
                        )}
                        value={value}
                        onValueChange={(val) => onPatch(f.key, val)}
                        aria-labelledby={`${uid}-${f.key}-label`}
                        aria-describedby={describedBy(f.key, fieldErrors)}
                      >
                        {f.seg.map((o) => (
                          <label
                            key={o.value}
                            className={cn(
                              "relative inline-flex cursor-pointer items-center justify-center rounded-lg px-3.5 py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                              value === o.value
                                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(24,33,53,0.10)]"
                                : "text-ink-3",
                            )}
                          >
                            <RadioGroupPrimitive.Item
                              value={o.value}
                              className="sr-only"
                            />
                            {o.label}
                          </label>
                        ))}
                      </RadioGroup>
                      <FieldError id={errId(f.key)} messages={fieldErrors} />
                    </div>
                  );
                }

                if (f.link) {
                  const kind = (v.kind || "web") as LinkKind;
                  const L = LINKS[kind];
                  return (
                    <div key={f.key} className={SPAN_CLASS[f.span]}>
                      <Label htmlFor={`${uid}-link`} className="mb-1.5">
                        {L.label} {L.required && <Req />}
                      </Label>
                      <Input
                        id={`${uid}-link`}
                        placeholder={L.placeholder}
                        aria-invalid={bad || undefined}
                        aria-describedby={describedBy(f.key, fieldErrors)}
                        value={v.linkValue ?? ""}
                        onChange={(e) => onPatch("linkValue", e.target.value)}
                      />
                      <FieldError id={errId(f.key)} messages={fieldErrors} />
                      <FieldHelp>{L.help}</FieldHelp>
                    </div>
                  );
                }

                const value = v[f.key] ?? "";
                return (
                  <div key={f.key} className={SPAN_CLASS[f.span]}>
                    <Label htmlFor={`${uid}-${f.key}`} className="mb-1.5">
                      {f.label} {f.required && <Req />}
                    </Label>
                    <Input
                      id={`${uid}-${f.key}`}
                      placeholder={f.placeholder}
                      inputMode={f.numeric ? "numeric" : undefined}
                      maxLength={
                        f.key === "deliv_id" ? DELIV_ID_MAX : undefined
                      }
                      aria-invalid={bad || undefined}
                      aria-describedby={describedBy(f.key, fieldErrors)}
                      value={value}
                      onChange={(e) => onPatch(f.key, e.target.value)}
                    />
                    <FieldError id={errId(f.key)} messages={fieldErrors} />
                    {f.chips && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-light text-ink-4">
                          Defaults
                        </span>
                        {f.chips.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors hover:border-primary",
                              value === c
                                ? "border-primary bg-accent text-primary"
                                : "border-line-3 bg-card text-ink-3",
                            )}
                            onClick={() => onPatch(f.key, c)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                    {!fieldErrors.length && f.key === "deliv_id" && (
                      <FieldHelp>
                        Up to {DELIV_ID_MAX} characters. Use a different one in
                        each row.
                      </FieldHelp>
                    )}
                    {!fieldErrors.length && f.help && (
                      <FieldHelp>{f.help}</FieldHelp>
                    )}
                  </div>
                );
              })}
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
