import { bannerFor, linkLabelFor, messageFor } from "@/lib/apiMessages";
import { normalizeCode, type FieldConfig } from "@/lib/fields";
import type { PushTypeConfig } from "@/lib/pushTypes";
import {
  LINKS,
  publishHourMinFor,
  type FormRow,
  type LinkKind,
  type RowError,
  type RowField,
  type Server,
} from "@/lib/types";

/** The header both APIs expect the token in. */
const TOKEN_HEADER = "X-APIToken";

function expressBase(): string | null {
  const base = process.env.NEXT_PUBLIC_EXPRESS_API_URL;
  return base ? base.replace(/\/+$/, "") : null;
}

/** One show or order line in an edition. */
export type PushItemPayload = Record<string, string | number>;

/**
 * One edition's payload. Keys match a `FieldConfig.key` 1:1, plus `publish_hour_min` and — for a
 * type with an item list — `shows` / `order_lines`. See `src/lib/pushTypes.ts` for which shapes are
 * confirmed.
 */
export type PushEditionPayload = Record<
  string,
  string | number | [number, number] | PushItemPayload[]
>;

export interface PushPayload {
  date: string;
  /** Only for types whose readers are the Recipients list (Auto App, Score). Left out otherwise. */
  login_ids?: string[];
  /** Order push only. */
  exclude_login_ids?: string[];
  editions: PushEditionPayload[];
  distribute_now: boolean;
}

/**
 * One edition a `201` hands back (Normal Push, In store Push; Auto App's 201 is empty). Normal's
 * has a one-hour window (`period_start`/`period_end`), In store's a single `will_publish_at`.
 */
export interface CreatedEdition {
  id: number;
  period_start?: string;
  period_end?: string;
  will_publish_at?: string;
  status: string;
  topics_count: number;
}

export type SubmitResult =
  /**
   * Auto App's `201` has no body, so the done screen is drawn from the payload. Normal and In
   * store Push's `201` lists the editions it created, handed back as `created`.
   */
  | { ok: true; created?: CreatedEdition[] }
  /**
   * `rowErrors[i]` belongs to edition `i` and `tokenError` to the API token field, the same way a
   * row error belongs to its card. `error.errors` keeps only the entries that were about neither,
   * so the toast never repeats what an input already shows.
   */
  | {
      ok: false;
      rowErrors: RowError[][];
      tokenError: string | null;
      error: ApiError;
    };

/** One entry in `error.errors[]`. `field` is the payload key; `editions[n].deliv_id` for a row. */
export interface ApiFieldError {
  error_id?: string;
  field?: string;
  title?: string;
  message: string;
}

/**
 * The `error` object every failed response carries (the EMO envelope, see the Responses section
 * of `../fe-docs/API-DOC-auto-app-push.md`). Our route handler emits the same shape for its own problems.
 */
export interface ApiError {
  error_id?: string;
  code?: string;
  title: string;
  message: string;
  errors: ApiFieldError[];
}

interface ApiErrorBody {
  error?: Partial<Omit<ApiError, "errors">> & { errors?: unknown };
}

/** One plain field's value as sent: trimmed text, a cleaned show code, or a number when asked. */
function sendValue(f: FieldConfig, value: string | undefined): string | number {
  const raw = (value ?? "").trim();
  if (f.check === "event") return normalizeCode(raw);
  return f.sendAs === "number" ? Number(raw) : raw;
}

export function buildPayload(
  rows: FormRow[],
  loginIds: string[],
  excludedIds: string[],
  date: string,
  distributeNow: boolean,
  pushType: PushTypeConfig,
  globalTime: { hour: string; min: string },
): PushPayload {
  const group = pushType.items;
  const editions = rows.map((r, i): PushEditionPayload => {
    const edition: PushEditionPayload = {
      publish_hour_min: publishHourMinFor(
        r.values,
        i,
        pushType,
        globalTime.hour,
        globalTime.min,
      ),
    };
    for (const f of pushType.fields) {
      // `kind` is only the switch that picks `link_type`; the link field sends both keys.
      if (f.key === "hour" || f.key === "min" || f.key === "kind") continue;
      if (f.link) {
        const kind = (r.values.kind || "web") as LinkKind;
        edition.link_type = LINKS[kind].code;
        edition.link_item = (r.values.linkValue ?? "").trim();
        continue;
      }
      edition[f.key] = sendValue(f, r.values[f.key]);
    }
    // Every item is sent, blank or not, so the API's `shows[j]` always means `row.items[j]`.
    if (group) {
      edition[group.key] = r.items.map((item) => {
        const out: PushItemPayload = {};
        for (const f of group.fields) out[f.key] = sendValue(f, item.values[f.key]);
        return out;
      });
    }
    return edition;
  });
  return {
    date,
    ...(pushType.readers === "list" ? { login_ids: loginIds } : {}),
    ...(pushType.readers === "order" ? { exclude_login_ids: excludedIds } : {}),
    editions,
    distribute_now: distributeNow,
  };
}

/** `editions[n].rest`, where `rest` is `deliv_id` or a nested path like `shows[0].code`. */
const EDITION_FIELD = /^editions\[(\d+)\]\.(.+)$/;

/**
 * Payload keys that don't match a `FieldConfig.key` directly — `publish_hour_min` is the
 * synthetic `time` field, and Auto App's `kind`+`linkValue` pair expands to `link_type`/
 * `link_item`. Every other key now equals the row field's own key, so no map entry is needed.
 */
const FIELD_BY_PAYLOAD_KEY: Record<string, RowField> = {
  publish_hour_min: "time",
  link_type: "kind",
  link_item: "linkValue",
};

/**
 * `errors[]` is one flat list. An entry about a single edition has a `field` like
 * `editions[n].deliv_id`. We hand those to the matching card, pointed at the right input, and keep
 * the rest for the toast. A key we do not know still reaches the card, just with no field.
 *
 * Every message is reworded through `messageFor` on the way, so the tester never sees a payload
 * key. `editions` is the payload that was sent, so a `link_item` message can name the link field
 * by the label the row shows for its `link_type`.
 */
export function splitErrors(
  errors: ApiFieldError[],
  editions: PushEditionPayload[],
) {
  const rowErrors = Array.from(
    { length: editions.length },
    (): RowError[] => [],
  );
  const general: ApiFieldError[] = [];
  for (const err of errors) {
    const m = err.field ? EDITION_FIELD.exec(err.field) : null;
    const i = m ? Number(m[1]) : -1;
    if (!m || i >= editions.length) {
      general.push({ ...err, message: messageFor(err, err.field ?? "") });
      continue;
    }
    const label = linkLabelFor(editions[i].link_type as string | undefined);
    // A plain key equals the row's own field key, and a nested path (`shows[0].code`) is already
    // the RowField of that item input, so only a special-cased top-level key is renamed. One the
    // card has no input for still reaches it, in its fallback summary block.
    const rest = m[2];
    rowErrors[i].push({
      field: FIELD_BY_PAYLOAD_KEY[rest] ?? rest,
      message: messageFor(err, label),
    });
  }
  return { rowErrors, general };
}

async function readBody<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Reads `error` off a body, filling in what a partial or missing one leaves out. */
function errorFrom(
  body: ApiErrorBody | null,
  fallback: Pick<ApiError, "title" | "message">,
): ApiError {
  const e = body?.error;
  const errors = Array.isArray(e?.errors)
    ? e.errors.filter(
        (x): x is ApiFieldError =>
          typeof x?.message === "string" && x.message !== "",
      )
    : [];
  const error = {
    error_id: e?.error_id,
    code: e?.code,
    title: e?.title || fallback.title,
    message: e?.message || fallback.message,
    errors,
  };
  return { ...error, message: bannerFor(error) };
}

export async function submitPush(
  payload: PushPayload,
  apiToken: string,
  server: Server,
  pushType: PushTypeConfig,
): Promise<SubmitResult> {
  // A run-level failure has nothing to say about any input, so `rowErrors` and `tokenError` stay empty.
  const fail = (
    title: string,
    message: string,
    code?: string,
  ): SubmitResult => ({
    ok: false,
    rowErrors: [],
    tokenError: null,
    error: { code, title, message, errors: [] },
  });

  // Our own route handler for ecs-api adds nothing of its own: the token goes with each request.
  // express's CORS allows this app's origin directly (unlike ecs-api), and its base URL is not a
  // secret the way ECS_API_URL is, so this goes straight from the browser with no proxy hop.
  let url: string;
  if (server === "ecs-api") {
    url = `/api/push/${pushType.routeSlug}`;
  } else {
    const base = expressBase();
    if (!base) {
      return fail(
        "The tool is not set up yet",
        "Set NEXT_PUBLIC_EXPRESS_API_URL in .env.local and restart the dev server.",
        "NOT_CONFIGURED",
      );
    }
    url = `${base}${pushType.expressPath}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TOKEN_HEADER]: apiToken.trim(),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return fail(
      "Could not reach this tool’s own server",
      "Check that the dev server is still running, then try again.",
    );
  }

  // Auto App's 201 is empty — zero bytes. Normal and In store's 201 list the editions created. Read a
  // body only when there is one, and never fail the run over it: the server already said yes.
  if (res.ok) {
    const text = await res.text().catch(() => "");
    if (!text) return { ok: true };
    try {
      const body = JSON.parse(text) as { editions?: unknown };
      return Array.isArray(body.editions)
        ? { ok: true, created: body.editions as CreatedEdition[] }
        : { ok: true };
    } catch {
      return { ok: true };
    }
  }

  // 422 is validation, one entry per field. 400 is a body the API could not read at all (not
  // JSON, or a key it does not know) and uses the same envelope, so both are split the same way.
  if (res.status === 422 || res.status === 400) {
    const error = errorFrom(await readBody<ApiErrorBody>(res), {
      title: "The API did not accept these values",
      message: `It answered ${res.status} without saying which values.`,
    });
    const { rowErrors, general } = splitErrors(error.errors, payload.editions);
    return {
      ok: false,
      rowErrors,
      tokenError: null,
      error: { ...error, errors: general },
    };
  }

  // The API did not take the token the tester typed, so the mark goes on that field.
  if (res.status === 401) {
    const error = errorFrom(await readBody<ApiErrorBody>(res), {
      title: "Unauthorized",
      message: "The API token was not accepted.",
    });
    // Where the right value lives is for the console, not the tester.
    console.error(
      "401 from the API: X-APIToken rejected. The staging value is in SSM at /epica/stg/api.",
    );
    return {
      ok: false,
      rowErrors: [],
      tokenError: "The API did not accept this token.",
      error,
    };
  }

  // ecs-api's 404 means "disabled in prod on purpose" and is always empty — never parse it.
  // express has no such concept: its 404 is an ordinary envelope with a body, so it falls through
  // to the generic handling below like any other status.
  if (res.status === 404 && server === "ecs-api") {
    return fail(
      "404 Not Found",
      "The endpoint is turned off on production on purpose. On staging it means the deploy is not out yet.",
      "NOT_FOUND",
    );
  }

  const error = errorFrom(await readBody<ApiErrorBody>(res), {
    title: `The request failed with HTTP ${res.status}`,
    message: "The response had no error details.",
  });
  // No error_id/code means we could not read this as the shared envelope at all. For a push type
  // whose endpoint is still a guess, that is plausibly why — say so rather than leaving the tester
  // to wonder.
  if (!error.error_id && !error.code && !pushType.backendConfirmed[server]) {
    error.message += ` This push type's endpoint path (${url}) is unconfirmed with the backend team — this may be why.`;
  }
  return { ok: false, rowErrors: [], tokenError: null, error };
}
