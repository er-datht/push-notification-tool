/** The fields on a card, per push type. See `docs/PUSH-TYPES-FIELD-REFERENCE.md` for the source. */

export type FieldCheck = "digits" | "event" | "performer";

export interface SegOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  /** Property name inside a row's (or item's) `values`. Equals the payload key 1:1, except
   *  `hour`/`min` (sent together as `publish_hour_min`) and Auto App's `kind`/`linkValue` pair. */
  key: string;
  label: string;
  /** 12-col grid at >=700px, 6-col below — same breakpoint the card already uses. */
  span: 4 | 6 | 8 | 12;
  required?: boolean;
  /** Overrides the generic "Enter the {label}." message — used to preserve Auto App's existing wording. */
  requiredMessage?: string;
  placeholder?: string;
  /** inputMode="numeric". Purely a UX hint; `check` is what validates and `sendAs` what converts. */
  numeric?: boolean;
  check?: FieldCheck;
  /** Sent as a JSON number instead of the typed text. Only for real ids; codes like `0106` stay text. */
  sendAs?: "number";
  /** Segmented control instead of a text input. */
  seg?: SegOption[];
  /** Quick-fill buttons shown under the field. */
  chips?: string[];
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

/** One show's code (興行コード). Same key for Normal, In store and Score Push. */
export const codeField = (span: FieldConfig["span"]): FieldConfig => ({
  key: "code",
  label: "Show code (code)",
  span,
  required: true,
  placeholder: "9014500001-P0030056",
  check: "event",
});

/** One show's word (ワード id). The API calls it `performer_id`. */
export const performerField = (
  span: FieldConfig["span"],
  chips?: string[],
): FieldConfig => ({
  key: "performer_id",
  label: "Word ID (performer_id)",
  span,
  required: true,
  numeric: true,
  placeholder: chips ? chips[0] : "2762",
  check: "performer",
  sendAs: "number",
  chips,
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
  placeholder: chips ? chips[0] : "2762",
  check: "digits",
  sendAs: "number",
  chips,
});

/** A text field that must be digits, but is sent as typed so leading zeros survive (`0106`). */
export const digitsField = (
  key: string,
  label: string,
  span: FieldConfig["span"],
  placeholder: string,
): FieldConfig => ({
  key,
  label,
  span,
  required: true,
  numeric: true,
  check: "digits",
  placeholder,
});

/** A show code, optionally followed by one `P021…` performance part. */
const EVENT_RE = /^\d+-P\d+(?:P\d+)?$/;
const DIGITS_RE = /^\d+$/;
/** The API takes a positive whole number of at most 16 digits. */
const PERFORMER_RE = /^[1-9]\d{0,15}$/;

/** The test sheet's 対象ID column starts with `[公演]`; the API rejects it, so it is dropped. */
export function normalizeCode(value: string): string {
  return value.trim().replace(/^\[公演\]\s*/, "");
}

/** True when a code names a whole kogyo (no `P021…` part), which the server expands — slowly. */
export function isExpandableCode(value: string): boolean {
  const code = normalizeCode(value);
  return EVENT_RE.test(code) && !/P\d+P\d+$/.test(code);
}

export function checkError(field: FieldConfig, value: string): string | null {
  const label = field.label.replace(/ \(.*\)$/, "");
  if (field.check === "digits" && !DIGITS_RE.test(value))
    return `${label} must be numbers only.`;
  if (field.check === "event" && !EVENT_RE.test(normalizeCode(value)))
    return `${label} should look like 9014500001-P0030056 or 9011910001-P0030007P021005.`;
  if (field.check === "performer") {
    if (!PERFORMER_RE.test(value))
      return `${label} must be a whole number above 0, at most 16 digits.`;
    if (!Number.isSafeInteger(Number(value)))
      return `${label} is too large to send exactly. Check the number.`;
  }
  return null;
}
