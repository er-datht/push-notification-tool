import type { ReactNode } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { FieldError, FieldHelp, Req } from "@/components/FieldText";
import type { FieldConfig } from "@/lib/fields";
import { DELIV_ID_MAX, LINKS, type LinkKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 12-col grid at >=700px, 6-col (i.e. full width) below — every field is full width on mobile. */
const SPAN_CLASS: Record<FieldConfig["span"], string> = {
  4: "col-span-6 min-[700px]:col-span-4",
  6: "col-span-6 min-[700px]:col-span-6",
  8: "col-span-6 min-[700px]:col-span-8",
  12: "col-span-6 min-[700px]:col-span-12",
};

interface Props {
  field: FieldConfig;
  /** The row's or the item's values. The link field reads `kind` and `linkValue` from here. */
  values: Record<string, string>;
  /** Unique per row or item, e.g. `ptc-row-4` or `ptc-row-4-item-7`, so every DOM id is unique. */
  idPrefix: string;
  /** This input's error messages (already filtered by its RowField). */
  messages: string[];
  onChange: (key: string, value: string) => void;
  /** Extra help under the input, shown only while it has no error. */
  hint?: ReactNode;
}

/** One input on a card: a text box (with optional quick-fill chips), a segmented control, or Auto App's link field. */
export function FieldControl({
  field: f,
  values: v,
  idPrefix,
  messages,
  onChange,
  hint,
}: Props) {
  const bad = messages.length > 0;
  const errId = `${idPrefix}-${f.key}-err`;
  const describedBy = bad ? errId : undefined;

  if (f.seg) {
    const value = v[f.key] ?? f.seg[0]?.value ?? "";
    return (
      <div className={SPAN_CLASS[f.span]}>
        <Label asChild className="mb-2">
          <span id={`${idPrefix}-${f.key}-label`}>
            {f.label} {f.required && <Req />}
          </span>
        </Label>
        {/* Segmented control: the radios stay for keyboard and screen readers, the labels carry the look.
            The bare Radix item is used on purpose — the styled `RadioGroupItem` keeps its 16px box even under `sr-only`. */}
        <RadioGroup
          className={cn(
            "inline-flex w-auto flex-wrap gap-1 rounded-lg bg-muted p-1",
            bad && "bg-red-tint ring-1 ring-destructive ring-inset",
          )}
          value={value}
          onValueChange={(val) => onChange(f.key, val)}
          aria-labelledby={`${idPrefix}-${f.key}-label`}
          aria-describedby={describedBy}
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
              <RadioGroupPrimitive.Item value={o.value} className="sr-only" />
              {o.label}
            </label>
          ))}
        </RadioGroup>
        <FieldError id={errId} messages={messages} />
      </div>
    );
  }

  if (f.link) {
    const L = LINKS[(v.kind || "web") as LinkKind];
    return (
      <div className={SPAN_CLASS[f.span]}>
        <Label htmlFor={`${idPrefix}-link`} className="mb-1.5">
          {L.label} {L.required && <Req />}
        </Label>
        <Input
          id={`${idPrefix}-link`}
          placeholder={L.placeholder}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy}
          value={v.linkValue ?? ""}
          onChange={(e) => onChange("linkValue", e.target.value)}
        />
        <FieldError id={errId} messages={messages} />
        <FieldHelp>{L.help}</FieldHelp>
      </div>
    );
  }

  const value = v[f.key] ?? "";
  return (
    <div className={SPAN_CLASS[f.span]}>
      <Label htmlFor={`${idPrefix}-${f.key}`} className="mb-1.5">
        {f.label} {f.required && <Req />}
      </Label>
      <Input
        id={`${idPrefix}-${f.key}`}
        placeholder={f.placeholder}
        inputMode={f.numeric ? "numeric" : undefined}
        maxLength={f.maxLength}
        aria-invalid={bad || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(f.key, e.target.value)}
      />
      <FieldError id={errId} messages={messages} />
      {f.chips && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-light text-ink-4">Defaults</span>
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
              onClick={() => onChange(f.key, c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {!bad && f.key === "deliv_id" && (
        <FieldHelp>
          Up to {DELIV_ID_MAX} characters. Use a different one in each row.
        </FieldHelp>
      )}
      {!bad && f.help && <FieldHelp>{f.help}</FieldHelp>}
      {!bad && hint && <FieldHelp>{hint}</FieldHelp>}
    </div>
  );
}
