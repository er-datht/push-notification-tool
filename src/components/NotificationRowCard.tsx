import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { FieldError, FieldHelp, Req } from "@/components/FieldText";
import {
  DELIV_ID_MAX,
  errorsForField,
  LINKS,
  SUB_TYPE,
  timeLabel,
  type LinkKind,
  type NotificationRow,
  type RowError,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

interface Props {
  row: NotificationRow;
  index: number;
  errors: RowError[];
  canRemove: boolean;
  onPatch: <K extends keyof NotificationRow>(
    field: K,
    value: NotificationRow[K],
  ) => void;
  onRemove: () => void;
}

const KINDS: { kind: LinkKind; label: string }[] = [
  { kind: "web", label: "Web page" },
  { kind: "kogyo", label: "Kogyo" },
  { kind: "word", label: "Word" },
];

export function NotificationRowCard({
  row,
  index,
  errors,
  canRemove,
  onPatch,
  onRemove,
}: Props) {
  const L = LINKS[row.kind];
  const open = !row.collapsed;
  const uid = `ptc-row-${row.id}`;
  const toggle = () => onPatch("collapsed", !row.collapsed);

  // A `time` error is about the hour and the minute together, so both inputs get marked.
  const timeErrors = errorsForField(errors, "hour", "min", "time");
  const hourBad = errorsForField(errors, "hour", "time").length > 0;
  const minBad = errorsForField(errors, "min", "time").length > 0;
  const delivErrors = errorsForField(errors, "delivId");
  const titleErrors = errorsForField(errors, "title");
  const kindErrors = errorsForField(errors, "kind");
  const linkErrors = errorsForField(errors, "linkValue");
  // A message we could not match to an input still has to show somewhere.
  const unplaced = errors.filter((e) => e.field === null).map((e) => e.message);

  /** The id of one input's error text, used both on the text and in the input's `aria-describedby`. */
  const errId = (slot: string) => `${uid}-${slot}-err`;
  /** Links an input to its error text, so screen readers read the two together. */
  const describedBy = (slot: string, messages: string[]) =>
    messages.length ? errId(slot) : undefined;

  return (
    <Card
      className={cn(
        "relative",
        errors.length &&
          "before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-[3px] before:rounded-l-lg before:bg-destructive",
      )}
    >
      <div
        className="flex cursor-pointer flex-wrap items-center gap-3 px-5.5 py-4"
        onClick={toggle}
      >
        <span className="text-[15px] font-semibold">
          Notification {index + 1}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {timeLabel(row)}
        </Badge>
        <span className="order-5 min-w-0 flex-1 basis-full truncate text-[13.5px] font-light text-ink-3 min-[860px]:order-none min-[860px]:basis-auto">
          {row.title || "No notification text yet"}
        </span>
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
          title={
            canRemove ? undefined : "A run needs at least one notification"
          }
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
                  value={row.hour}
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
                  value={row.min}
                  onChange={(e) => onPatch("min", e.target.value)}
                />
              </div>
              <FieldError id={errId("time")} messages={timeErrors} />
              {!timeErrors.length && (
                <FieldHelp>
                  08:00 to 22:00, and no more than 2 hours from now.
                </FieldHelp>
              )}
            </div>
            <div className="col-span-6 min-[700px]:col-span-4">
              <Label htmlFor={`${uid}-deliv`} className="mb-1.5">
                Delivery ID (deliv_id) <Req />
              </Label>
              <Input
                id={`${uid}-deliv`}
                placeholder="H020064377"
                maxLength={DELIV_ID_MAX}
                aria-invalid={delivErrors.length > 0 || undefined}
                aria-describedby={describedBy("deliv", delivErrors)}
                value={row.delivId}
                onChange={(e) => onPatch("delivId", e.target.value)}
              />
              <FieldError id={errId("deliv")} messages={delivErrors} />
              {!delivErrors.length && (
                <FieldHelp>
                  Up to {DELIV_ID_MAX} characters. Use a different one in each
                  row.
                </FieldHelp>
              )}
            </div>
            <div className="col-span-6 min-[700px]:col-span-4">
              <Label htmlFor={`${uid}-sub`} className="mb-1.5">
                Sub type
              </Label>
              <Input
                id={`${uid}-sub`}
                value={SUB_TYPE}
                readOnly
                title="Fixed for this push type"
              />
            </div>
            <div className="col-span-6 min-[700px]:col-span-12">
              <Label htmlFor={`${uid}-title`} className="mb-1.5">
                Notification text (title) <Req />
              </Label>
              <Input
                id={`${uid}-title`}
                placeholder="イープラスのWEBページへ遷移します。"
                aria-invalid={titleErrors.length > 0 || undefined}
                aria-describedby={describedBy("title", titleErrors)}
                value={row.title}
                onChange={(e) => onPatch("title", e.target.value)}
              />
              <FieldError id={errId("title")} messages={titleErrors} />
            </div>
            <div className="col-span-6 min-[700px]:col-span-12">
              <Label asChild className="mb-2">
                <span id={`${uid}-kind-label`}>
                  Where should the tap go? <Req />
                </span>
              </Label>
              {/* Segmented control: the radios stay for keyboard and screen readers, the labels carry the look.
                  The bare Radix item is used on purpose — the styled `RadioGroupItem` keeps its 16px box even under `sr-only`. */}
              <RadioGroup
                className={cn(
                  "inline-grid w-auto auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1",
                  kindErrors.length &&
                    "bg-red-tint ring-1 ring-destructive ring-inset",
                )}
                value={row.kind}
                onValueChange={(v) => onPatch("kind", v as LinkKind)}
                aria-labelledby={`${uid}-kind-label`}
                aria-describedby={describedBy("kind", kindErrors)}
              >
                {KINDS.map((k) => (
                  <label
                    key={k.kind}
                    className={cn(
                      "relative inline-flex cursor-pointer items-center justify-center rounded-lg px-3.5 py-[7px] text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                      row.kind === k.kind
                        ? "bg-card text-foreground shadow-[0_1px_2px_rgba(24,33,53,0.10)]"
                        : "text-ink-3",
                    )}
                  >
                    <RadioGroupPrimitive.Item
                      value={k.kind}
                      className="sr-only"
                    />
                    {k.label}
                  </label>
                ))}
              </RadioGroup>
              <FieldError id={errId("kind")} messages={kindErrors} />
            </div>
            <div className="col-span-6 min-[700px]:col-span-12">
              <Label htmlFor={`${uid}-link`} className="mb-1.5">
                {L.label} <Req />
              </Label>
              <Input
                id={`${uid}-link`}
                placeholder={L.placeholder}
                aria-invalid={linkErrors.length > 0 || undefined}
                aria-describedby={describedBy("link", linkErrors)}
                value={row.linkValue}
                onChange={(e) => onPatch("linkValue", e.target.value)}
              />
              <FieldError id={errId("link")} messages={linkErrors} />
              <FieldHelp>{L.help}</FieldHelp>
            </div>
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
