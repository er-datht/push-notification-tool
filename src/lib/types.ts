import { checkError, type FieldConfig } from "@/lib/fields";
import type { ItemGroupConfig, PushTypeConfig } from "@/lib/pushTypes";

export type LinkKind = "web" | "kogyo" | "word";
export type Server = "ecs-api" | "express";

/** One sub-item of a notification: a show, or an order line. `values` is keyed by `FieldConfig.key`. */
export interface FormItem {
  id: number;
  values: Record<string, string>;
}

/**
 * One notification on the form. `values` holds the row's own fields; `items` its shows or order
 * lines (empty for a type without an item list). Item ids share the row id counter, so every id on
 * the page is unique.
 */
export interface FormRow {
  id: number;
  collapsed: boolean;
  values: Record<string, string>;
  items: FormItem[];
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

/**
 * What kind of push a notification's shows make.
 *
 * - `single`: every show has the same hook. With several words this is the test sheet's
 *   `mixed(ワード)`. The text names several words, but `type` is still that one hook.
 * - `mixed`: some word carries two different hooks, so everyone subscribed to it gets a mixed push.
 *   This is the sheet's `mixed(受付)`.
 * - `depends`: each word has only one hook, but the words' hooks differ. Only an account that
 *   subscribes to words with different hooks gets a mixed push; the rest get a single hook.
 */
export interface HookMix {
  kind: "single" | "mixed" | "depends";
  /** The shared hook when `kind` is `single`, else null. */
  hook: string | null;
  /** The distinct ワード ids (`performer_id`) among the shows, blanks left out. */
  words: string[];
}

/**
 * Classifies a notification's shows. The server sets `type` per recipient, from the topics that
 * recipient actually gets, and a recipient gets a show's topic only by subscribing to its ワード.
 * So hooks are compared within each word. `byWord: false` (Score, sent to a login-ID list, not
 * to subscribers) compares hooks across all shows. Null when no show has a hook.
 */
export function hookMix(items: FormItem[], byWord: boolean): HookMix | null {
  const words = showWords(items);
  const hooks = new Set(items.map((i) => i.values.hook).filter(Boolean));
  if (hooks.size === 0) return null;
  if (hooks.size === 1) return { kind: "single", hook: [...hooks][0], words };
  if (!byWord) return { kind: "mixed", hook: null, words };

  const hooksByWord = new Map<string, Set<string>>();
  for (const { values } of items) {
    if (!values.hook) continue;
    const word = (values.performer_id ?? "").trim();
    hooksByWord.set(word, (hooksByWord.get(word) ?? new Set()).add(values.hook));
  }
  const sameWordMixed = [...hooksByWord.values()].some((h) => h.size > 1);
  return { kind: sameWordMixed ? "mixed" : "depends", hook: null, words };
}

/** The distinct ワード ids (`performer_id`) among a notification's shows, blanks left out. */
export function showWords(items: FormItem[]): string[] {
  return [...new Set(items.map((i) => (i.values.performer_id ?? "").trim()).filter(Boolean))];
}

/** The badge text for a `HookMix`: "mixed push", "preorder push", "mixed for some accounts". */
export function hookMixLabel(mix: HookMix): string {
  if (mix.kind === "single") return `${mix.hook} push`;
  return mix.kind === "mixed" ? "mixed push" : "mixed for some accounts";
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
 * together, because the rules about the window and the lead time use both. An item's input is
 * named by its payload path inside the edition, e.g. `shows[1].code`; the whole list by its key,
 * e.g. `shows`. A null field means we could not match an input, so the card shows it in its
 * summary block.
 */
export type RowField = string;

export interface RowError {
  field: RowField | null;
  message: string;
}

/** The `RowField` of one item input: `shows[1].code`. */
export const itemField = (group: ItemGroupConfig, index: number, key: string) =>
  `${group.key}[${index}].${key}`;

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

/** Required / format checks for one plain field. `link` fields are handled by the caller. */
function fieldErrors(
  f: FieldConfig,
  raw: string,
  field: RowField,
  add: (field: RowField, message: string) => void,
) {
  if (!raw) {
    if (f.required)
      add(field, f.requiredMessage ?? `Enter the ${cleanLabel(f).toLowerCase()}.`);
    return;
  }
  if (f.key === "deliv_id" && raw.length > DELIV_ID_MAX) {
    add(field, `Delivery ID must be ${DELIV_ID_MAX} characters or fewer.`);
    return;
  }
  if (f.check) {
    const msg = checkError(f, raw);
    if (msg) add(field, msg);
  }
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
          `Pick a time between ${windowLabel(pushType.windowStartMin, pushType.windowEndMin)} JST. The server does not send outside those hours.`,
        );
      }
      // A missing or unreadable date is reported once by dateErrorFor, so we skip it here.
      const at = tokyoEpoch(date, h, m);
      if (at !== null) {
        // Compare with the start of this minute, so picking the current time still counts as later.
        const floor = Math.floor(now.getTime() / 60_000) * 60_000;
        if (at < floor && !pushType.allowPast)
          add("time", "This time has already passed in JST. Pick a later one.");
        else if (
          pushType.leadMs !== undefined &&
          at - floor > pushType.leadMs
        ) {
          add(
            "time",
            "Pick a time within the next 2 hours. The server only takes a time that close to now.",
          );
        }
      }
    }
  }

  for (const f of pushType.fields) {
    if (f.key === "hour" || f.key === "min") continue;

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

    fieldErrors(f, (v[f.key] ?? "").trim(), f.key, add);
  }

  const group = pushType.items;
  if (group) {
    if (row.items.length === 0)
      add(group.key, `Add at least one ${group.noun.toLowerCase()}.`);
    row.items.forEach((item, j) => {
      for (const f of group.fields) {
        fieldErrors(
          f,
          (item.values[f.key] ?? "").trim(),
          itemField(group, j, f.key),
          add,
        );
      }
    });
  }
  return e;
}

/** Normal Push: each notification is a one-hour window, and two windows must not overlap. */
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Checks each row, then across rows:
 * - Auto App — the API treats the same deliv_id twice as one delivery.
 * - Normal — the API rejects two one-hour windows that overlap (NP-0208), including two in the
 *   same request. The later notification gets the error, the same one the server would name.
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
  if (pushType.id === "normal_push") {
    const starts = rows.map((r) =>
      r.values.hour !== "" && r.values.min !== ""
        ? tokyoEpoch(date, Number(r.values.hour), Number(r.values.min))
        : null,
    );
    starts.forEach((at, i) => {
      if (at === null || Number.isNaN(at)) return;
      const clash = starts.findIndex(
        (other, j) =>
          j < i && other !== null && Math.abs(other - at) < WINDOW_MS,
      );
      if (clash >= 0)
        out[i].push({
          field: "time",
          message: `This hour overlaps notification ${clash + 1} (${timeLabel(rows[clash].values)}). Each one covers a full hour, so keep them at least 1 hour apart.`,
        });
    });
  }
  return out;
}

/**
 * Minutes between two Order status blocks (`doc/misc/プッシュ通知テスト配信.md:280-289` in ecs-api).
 * Only a label in the filename and `will_publish_at` — Order is published by hand.
 */
export const ORDER_BLOCK_STEP_MIN = 10;

/**
 * Order's one shared start time. Every status block is `ORDER_BLOCK_STEP_MIN` after the one before
 * it, so the window and the two-hour rule are checked on the first and the last block, not just the
 * start.
 */
export function globalTimeErrorFor(
  hour: string,
  min: string,
  pushType: PushTypeConfig,
  date: string,
  blocks: number,
  now: Date = new Date(),
): string | null {
  const h = Number(hour);
  const m = Number(min);
  const hourOk = hour !== "" && Number.isInteger(h) && h >= 0 && h <= 23;
  const minOk = min !== "" && Number.isInteger(m) && m >= 0 && m <= 59;
  if (!hourOk) return "Hour must be a whole number between 0 and 23.";
  if (!minOk) return "Minute must be a whole number between 0 and 59.";
  const first = h * 60 + m;
  const last = first + Math.max(blocks - 1, 0) * ORDER_BLOCK_STEP_MIN;
  const window = windowLabel(pushType.windowStartMin, pushType.windowEndMin);
  if (first < pushType.windowStartMin || first > pushType.windowEndMin)
    return `Pick a start time between ${window} JST.`;
  if (last > pushType.windowEndMin)
    return `The last status block would go out at ${pad(Math.floor(last / 60))}:${pad(last % 60)}, after ${window}. Start earlier or use fewer blocks.`;
  const at = tokyoEpoch(date, h, m);
  if (at === null) return null;
  const floor = Math.floor(now.getTime() / 60_000) * 60_000;
  if (at < floor) return "This start time has already passed in JST. Pick a later one.";
  if (
    pushType.leadMs !== undefined &&
    at + (last - first) * 60_000 - floor > pushType.leadMs
  )
    return "Every status block's time must be within the next 2 hours. Start earlier or use fewer blocks.";
  return null;
}

/**
 * The `[hour, min]` a row publishes at: its own hour/min, or — for a `globalTime` type (Order) —
 * the shared start time plus `ORDER_BLOCK_STEP_MIN` per row before it. Used both for display
 * (`timeFor` below) and for the payload itself.
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
      (Number(globalHour) || 0) * 60 +
      (Number(globalMin) || 0) +
      index * ORDER_BLOCK_STEP_MIN;
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
