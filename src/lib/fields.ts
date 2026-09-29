/** One row's fields, per push type. Ported from the Claude Design mockup's `TYPES[].fields`. */

export type FieldCheck = "digits" | "event";

export interface SegOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  /** Property name inside a row's `values`. Matches the (guessed) payload key 1:1, except a
   *  `_`-prefixed key, which is display-only and never sent (see `buildPayload`). */
  key: string;
  label: string;
  /** 12-col grid at >=700px, 6-col below — same breakpoint the card already uses. */
  span: 4 | 6 | 8 | 12;
  required?: boolean;
  /** Overrides the generic "Enter the {label}." message — used to preserve Auto App's existing wording. */
  requiredMessage?: string;
  placeholder?: string;
  /** inputMode="numeric". Purely a UX hint; `check: 'digits'` is what actually validates. */
  numeric?: boolean;
  check?: FieldCheck;
  /** Segmented control instead of a text input. */
  seg?: SegOption[];
  /** Quick-fill buttons shown under the field. */
  chips?: string[];
  /** Read-only fixed value, e.g. 'auto_app_push', 'spice'. */
  fixed?: string;
  /** True only for Auto App's kind+linkValue pair — rendered via the existing `LINKS` map. */
  link?: boolean;
  help?: string;
}

export const HOUR: FieldConfig = {
  key: "hour",
  label: "Hour",
  span: 4,
  required: true,
  numeric: true,
  placeholder: "15",
};
export const MIN: FieldConfig = {
  key: "min",
  label: "Minute",
  span: 4,
  required: true,
  numeric: true,
  placeholder: "30",
};

export const eventField = (span: FieldConfig["span"]): FieldConfig => ({
  key: "target_event",
  label: "Target event (target_event)",
  span,
  required: true,
  placeholder: "1610580031-P0030114",
  check: "event",
  help: "Kogyo code + P-number, e.g. 1610580031-P0030114.",
});

export const wordField = (
  span: FieldConfig["span"],
  chips?: string[],
): FieldConfig => ({
  key: "word_id",
  label: "Word ID (word_id)",
  span,
  required: true,
  numeric: true,
  placeholder: chips ? chips[0] : "23542",
  check: "digits",
  chips,
});

const EVENT_RE = /^\d+-P\d+$/;
const DIGITS_RE = /^\d+$/;

export function checkError(field: FieldConfig, value: string): string | null {
  const label = field.label.replace(/ \(.*\)$/, "");
  if (field.check === "digits" && !DIGITS_RE.test(value))
    return `${label} must be numeric.`;
  if (field.check === "event" && !EVENT_RE.test(value))
    return `${label} should look like 1610580031-P0030114.`;
  return null;
}
