import { checkError, type FieldConfig } from "@/lib/fields";
import type { PushTypeConfig } from "@/lib/pushTypes";

export type LinkKind = "web" | "kogyo" | "word";
export type Server = "ecs-api" | "express";

/** One row of a form. `values` is keyed by each field's `FieldConfig.key` — generic across all 6 push types. */
export interface FormRow {
  id: number;
  collapsed: boolean;
  values: Record<string, string>;
}

export interface LinkMeta {
  code: string;
  label: string;
  placeholder: string;
  help: string;
  line: string;
  /** Whether the tester must fill in `link_item`. Every kind needs one today; a kind that does not can turn this off. */
  required: boolean;
}

export const LINKS: Record<LinkKind, LinkMeta> = {
  web: {
    code: "03",
    label: "Destination URL",
    placeholder: "https://eplus.jp/",
    help: "link_type 03. Tapping the push opens this e+ web page inside the app.",
    line: "Opens web page",
    required: true,
  },
  kogyo: {
    code: "01",
    label: "Kogyo / bundle code",
    placeholder: "9041480001-P0030001P021001",
    help: "link_type 01. Tapping the push opens the show or SmaTicket bundle with this code. The API only takes a real show id.",
    line: "Opens kogyo",
    required: true,
  },
  word: {
    code: "02",
    label: "Word ID",
    placeholder: "2762",
    help: "link_type 02. Tapping the push opens the subscribed word page.",
    line: "Opens word",
    required: true,
  },
};

/** The DOM id of one row's card, so the page can scroll to it after a blocked Execute. */
export const rowDomId = (rowId: number) => `ptc-row-${rowId}`;

export const SERVER_LABEL: Record<Server, string> = {
  express: "ExpressJS",
  "ecs-api": "ecs-api",
};

/** The API checks these too. We check them here so the tester finds out without sending. */
export const DELIV_ID_MAX = 24;

export const pad = (v: string | number) => String(v).padStart(2, "0");

/** `values.hour`/`values.min` as `HH:MM`. Only meaningful for a per-row time — a `globalTime` type computes its display time elsewhere, see `timeFor`. */
export const timeLabel = (values: Record<string, string>) =>
  `${pad(values.hour || "0")}:${pad(values.min || "0")}`;

/** The API reads every time as Asia/Tokyo. Japan stays at UTC+9 all year, so there is no DST. */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Today in Asia/Tokyo as `YYYY-MM-DD`, no matter what timezone the browser is in. */
export function todayInTokyo(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
}

/**
 * Turns a `YYYY-MM-DD` date plus an hour and minute in Tokyo time into epoch ms.
 * Gives back null when the date is not a real day.
 */
export function tokyoEpoch(
  date: string,
  hour: number,
  min: number,
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d, hour, min);
  const back = new Date(utc);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() + 1 !== mo ||
    back.getUTCDate() !== d
  )
    return null;
  return utc - JST_OFFSET_MS;
}

/**
 * What the server makes of a `link_type: "01"` show id: the first 6 digits (興行コード), a dash,
 * and the 4 digits after `P003` (興行サブコード). `9041480001-P0030001P021001` → `904148-0001`.
 * The 201 is empty, so this is the only way to show the tester the reduced value. A value that
 * does not fit the pattern is given back as typed.
 */
export function shortShowId(item: string): string {
  const m = /^(\d{6})\d*-P003(\d{4})/.exec(item.trim());
  return m ? `${m[1]}-${m[2]}` : item;
}

/** Adds 1 to the number at the end of a delivery ID, so the next run gets a new one. */
export function nextDelivId(id: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(id.trim());
  if (!m) return id.trim();
  return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, "0")}${m[3]}`;
}

/** Every row shares one delivery date, so we report it once here instead of on each card. */
export function dateErrorFor(date: string): string | null {
  if (!date.trim())
    return "Pick a delivery date. Every notification in this run uses it.";
  if (tokyoEpoch(date, 0, 0) === null)
    return "That date is not a real day. Use YYYY-MM-DD.";
  return null;
}

/**
 * `HH:MM`–`HH:MM`, for a window given in minutes-from-midnight — used to word a per-type JST
 * window error without hardcoding "08:00 to 22:00" for every type.
 */
function windowLabel(startMin: number, endMin: number): string {
  return `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}–${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
}

/**
 * Which input an error points at, so the card can mark it. `time` means the hour and the minute
 * together, because the rules about the window and the lead time use both. The set of possible
 * fields is type-dependent (each push type has its own `FieldConfig[]`), so this is just `string`.
 * A null field means we could not match an input, so the card shows it in its summary block.
 */
export type RowField = string;

export interface RowError {
  field: RowField | null;
  message: string;
}

/** All messages for one input, in the order they were added. */
export function errorsForField(
  errors: RowError[],
  ...fields: RowField[]
): string[] {
  return errors
    .filter((e) => e.field !== null && fields.includes(e.field))
    .map((e) => e.message);
}

/** A field's label with any trailing `(payload_key)` stripped, for use inside a sentence. */
function cleanLabel(f: FieldConfig): string {
  return f.label.replace(/ \(.*\)$/, "");
}

export function errorsFor(
  row: FormRow,
  pushType: PushTypeConfig,
  date: string,
  now: Date = new Date(),
): RowError[] {
  const e: RowError[] = [];
  const add = (field: RowField | null, message: string) =>
    e.push({ field, message });
  const v = row.values;

  if (!pushType.globalTime) {
    const h = Number(v.hour);
    const m = Number(v.min);
    const hourOk = v.hour !== "" && Number.isInteger(h) && h >= 0 && h <= 23;
    const minOk = v.min !== "" && Number.isInteger(m) && m >= 0 && m <= 59;
    if (!hourOk) add("hour", "Hour must be a whole number between 0 and 23.");
    if (!minOk) add("min", "Minute must be a whole number between 0 and 59.");

    if (hourOk && minOk) {
      const minutes = h * 60 + m;
      if (
        minutes < pushType.windowStartMin ||
        minutes > pushType.windowEndMin
      ) {
        add(
          "time",
          `Pick a time between ${windowLabel(pushType.windowStartMin, pushType.windowEndMin)} JST. The import job never picks up a file outside those hours.`,
        );
      }
      // A missing or unreadable date is reported once by dateErrorFor, so we skip it here.
      const at = tokyoEpoch(date, h, m);
      if (at !== null) {
        // Compare with the start of this minute, so picking the current time still counts as later.
        const floor = Math.floor(now.getTime() / 60_000) * 60_000;
        if (at < floor)
          add("time", "This time has already passed in JST. Pick a later one.");
        else if (
          pushType.leadMs !== undefined &&
          at - floor > pushType.leadMs
        ) {
          add(
            "time",
            "Pick a time within the next 2 hours. The import job only takes files that close to now.",
          );
        }
      }
    }
  }

  for (const f of pushType.fields) {
    if (f.fixed !== undefined || f.key === "hour" || f.key === "min") continue;

    if (f.link) {
      const kind = (v.kind || "web") as LinkKind;
      const link = (v.linkValue ?? "").trim();
      if (!link) {
        if (LINKS[kind].required)
          add("linkValue", `Enter the ${LINKS[kind].label}.`);
      } else if (kind === "web" && !/^https?:\/\//.test(link))
        add("linkValue", "The URL must start with http:// or https://.");
      else if (kind === "word" && !/^\d+$/.test(link))
        add("linkValue", "Word ID must be numbers only.");
      continue;
    }

    const raw = (v[f.key] ?? "").trim();
    if (!raw) {
      if (f.required)
        add(
          f.key,
          f.requiredMessage ?? `Enter the ${cleanLabel(f).toLowerCase()}.`,
        );
      continue;
    }
    if (f.key === "deliv_id" && raw.length > DELIV_ID_MAX) {
      add(f.key, `Delivery ID must be ${DELIV_ID_MAX} characters or fewer.`);
      continue;
    }
    if (f.check) {
      const msg = checkError(f, raw);
      if (msg) add(f.key, msg);
    }
  }
  return e;
}

/**
 * Checks each row, then — for Auto App only — checks across rows: the API treats the same
 * deliv_id twice as one delivery. No other type has a documented analogue of that rule, so it
 * is not generalized (see the plan's rationale — Normal's own sample data legitimately repeats
 * target_event+word_id with a different sub_type across rows).
 */
export function validateRows(
  rows: FormRow[],
  pushType: PushTypeConfig,
  date: string,
  now: Date = new Date(),
): RowError[][] {
  const out = rows.map((r) => errorsFor(r, pushType, date, now));
  if (pushType.id === "auto_app_push") {
    const firstSeen = new Map<string, number>();
    rows.forEach((r, i) => {
      const id = (r.values.deliv_id ?? "").trim();
      if (!id) return;
      const first = firstSeen.get(id);
      if (first === undefined) firstSeen.set(id, i);
      else {
        out[i].push({
          field: "deliv_id",
          message: `Delivery ID "${id}" is already used by notification ${first + 1}. The same ID twice counts as one delivery, so give this one its own ID.`,
        });
      }
    });
  }
  return out;
}

/** Order's one shared Hour/Minute for the whole run, checked once instead of per row. */
export function globalTimeErrorFor(
  hour: string,
  min: string,
  pushType: PushTypeConfig,
): string | null {
  const h = Number(hour);
  const m = Number(min);
  const hourOk = hour !== "" && Number.isInteger(h) && h >= 0 && h <= 23;
  const minOk = min !== "" && Number.isInteger(m) && m >= 0 && m <= 59;
  if (!hourOk) return "Hour must be a whole number between 0 and 23.";
  if (!minOk) return "Minute must be a whole number between 0 and 59.";
  const minutes = h * 60 + m;
  if (minutes < pushType.windowStartMin || minutes > pushType.windowEndMin) {
    return `Pick a start time between ${windowLabel(pushType.windowStartMin, pushType.windowEndMin)} JST.`;
  }
  return null;
}

/**
 * The `[hour, min]` a row publishes at: its own hour/min, or — for a `globalTime` type (Order) —
 * the shared start time plus 5 minutes per row before it, wrapping at 24h. Ported from the
 * mockup's `timeFor`. Used both for display (`timeFor` below) and for the payload itself.
 */
export function publishHourMinFor(
  values: Record<string, string>,
  index: number,
  pushType: PushTypeConfig,
  globalHour: string,
  globalMin: string,
): [number, number] {
  if (pushType.globalTime) {
    const base =
      (Number(globalHour) || 0) * 60 + (Number(globalMin) || 0) + index * 5;
    const total = ((base % (24 * 60)) + 24 * 60) % (24 * 60);
    return [Math.floor(total / 60), total % 60];
  }
  return [Number(values.hour), Number(values.min)];
}

/** The `HH:MM` shown on a row's time badge, from `publishHourMinFor`. */
export function timeFor(
  values: Record<string, string>,
  index: number,
  pushType: PushTypeConfig,
  globalHour: string,
  globalMin: string,
): string {
  const [h, m] = publishHourMinFor(
    values,
    index,
    pushType,
    globalHour,
    globalMin,
  );
  return `${pad(h)}:${pad(m)}`;
}

/** Bumps `deliv_id` for a fresh run, only for the one type that has that field. */
export function bumpDelivId(row: FormRow, pushType: PushTypeConfig): FormRow {
  if (!pushType.fields.some((f) => f.key === "deliv_id")) return row;
  return {
    ...row,
    values: { ...row.values, deliv_id: nextDelivId(row.values.deliv_id ?? "") },
  };
}
