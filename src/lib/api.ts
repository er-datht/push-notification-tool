import { bannerFor, linkLabelFor, messageFor } from '@/lib/apiMessages'
import { LINKS, type NotificationRow, type RowError, type RowField } from '@/lib/types'

/** Our own route handler. It adds nothing of its own: the token goes with each request. */
const AUTO_APP_PUSH_ROUTE = '/api/push/auto-app-push'

/** The header the route handler forwards to the API unchanged. */
const TOKEN_HEADER = 'X-APIToken'

export interface EditionPayload {
  publish_hour_min: [number, number]
  deliv_id: string
  title: string
  link_type: string
  link_item: string
}

export interface AutoAppPushPayload {
  date: string
  login_ids: string[]
  editions: EditionPayload[]
  distribute_now: boolean
}

export type SubmitResult =
  /** A `201` has no body, so there is nothing to hand back: the done screen is drawn from the payload. */
  | { ok: true }
  /**
   * `rowErrors[i]` belongs to edition `i` and `tokenError` to the API token field, the same way a
   * row error belongs to its card. `error.errors` keeps only the entries that were about neither,
   * so the toast never repeats what an input already shows.
   */
  | { ok: false; rowErrors: RowError[][]; tokenError: string | null; error: ApiError }

/** One entry in `error.errors[]`. `field` is the payload key; `editions[n].deliv_id` for a row. */
export interface ApiFieldError {
  error_id?: string
  field?: string
  title?: string
  message: string
}

/**
 * The `error` object every failed response carries (the EMO envelope, see the Responses section
 * of `docs/API-DOC-auto-app-push.md`). Our route handler emits the same shape for its own problems.
 */
export interface ApiError {
  error_id?: string
  code?: string
  title: string
  message: string
  errors: ApiFieldError[]
}

interface ApiErrorBody {
  error?: Partial<Omit<ApiError, 'errors'>> & { errors?: unknown }
}

export function buildPayload(
  rows: NotificationRow[],
  loginIds: string[],
  date: string,
  distributeNow: boolean,
): AutoAppPushPayload {
  return {
    date,
    login_ids: loginIds,
    editions: rows.map((r): EditionPayload => ({
      publish_hour_min: [Number(r.hour), Number(r.min)],
      deliv_id: r.delivId.trim(),
      title: r.title.trim(),
      link_type: LINKS[r.kind].code,
      link_item: r.linkValue.trim(),
    })),
    distribute_now: distributeNow,
  }
}

const EDITION_FIELD = /^editions\[(\d+)\]\.([a-z_]+)/

/** The payload key inside an edition, and the input it belongs to. */
const FIELD_BY_PAYLOAD_KEY: Record<string, RowField> = {
  publish_hour_min: 'time',
  deliv_id: 'delivId',
  title: 'title',
  link_type: 'kind',
  link_item: 'linkValue',
}

/**
 * `errors[]` is one flat list. An entry about a single edition has a `field` like
 * `editions[n].deliv_id`. We hand those to the matching card, pointed at the right input, and keep
 * the rest for the toast. A key we do not know still reaches the card, just with no field.
 *
 * Every message is reworded through `messageFor` on the way, so the tester never sees a payload
 * key. `editions` is the payload that was sent, so a `link_item` message can name the link field
 * by the label the row shows for its `link_type`.
 */
export function splitErrors(errors: ApiFieldError[], editions: EditionPayload[]) {
  const rowErrors = Array.from({ length: editions.length }, (): RowError[] => [])
  const general: ApiFieldError[] = []
  for (const err of errors) {
    const m = err.field ? EDITION_FIELD.exec(err.field) : null
    const i = m ? Number(m[1]) : -1
    if (!m || i >= editions.length) {
      general.push({ ...err, message: messageFor(err, err.field ?? '') })
      continue
    }
    const label = linkLabelFor(editions[i].link_type)
    rowErrors[i].push({ field: FIELD_BY_PAYLOAD_KEY[m[2]] ?? null, message: messageFor(err, label) })
  }
  return { rowErrors, general }
}

async function readBody<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Reads `error` off a body, filling in what a partial or missing one leaves out. */
function errorFrom(body: ApiErrorBody | null, fallback: Pick<ApiError, 'title' | 'message'>): ApiError {
  const e = body?.error
  const errors = Array.isArray(e?.errors)
    ? e.errors.filter((x): x is ApiFieldError => typeof x?.message === 'string' && x.message !== '')
    : []
  const error = {
    error_id: e?.error_id,
    code: e?.code,
    title: e?.title || fallback.title,
    message: e?.message || fallback.message,
    errors,
  }
  return { ...error, message: bannerFor(error) }
}

export async function submitAutoAppPush(payload: AutoAppPushPayload, apiToken: string): Promise<SubmitResult> {
  // A run-level failure has nothing to say about any input, so `rowErrors` and `tokenError` stay empty.
  const fail = (title: string, message: string, code?: string): SubmitResult => ({
    ok: false,
    rowErrors: [],
    tokenError: null,
    error: { code, title, message, errors: [] },
  })

  let res: Response
  try {
    res = await fetch(AUTO_APP_PUSH_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TOKEN_HEADER]: apiToken.trim() },
      body: JSON.stringify(payload),
    })
  } catch {
    return fail('Could not reach this tool’s own server', 'Check that the dev server is still running, then try again.')
  }

  // 201 is the success, and it is empty — zero bytes, nothing to parse. Branch on the status alone.
  if (res.ok) return { ok: true }

  // 422 is validation, one entry per field. 400 is a body the API could not read at all (not
  // JSON, or a key it does not know) and uses the same envelope, so both are split the same way.
  if (res.status === 422 || res.status === 400) {
    const error = errorFrom(await readBody<ApiErrorBody>(res), {
      title: 'The API did not accept these values',
      message: `It answered ${res.status} without saying which values.`,
    })
    const { rowErrors, general } = splitErrors(error.errors, payload.editions)
    return { ok: false, rowErrors, tokenError: null, error: { ...error, errors: general } }
  }

  // The API did not take the token the tester typed, so the mark goes on that field.
  if (res.status === 401) {
    const error = errorFrom(await readBody<ApiErrorBody>(res), {
      title: 'Unauthorized',
      message: 'The API token was not accepted.',
    })
    // Where the right value lives is for the console, not the tester.
    console.error('401 from the API: X-APIToken rejected. The staging value is in SSM at /epica/stg/api.')
    return { ok: false, rowErrors: [], tokenError: 'The API did not accept this token.', error }
  }

  // 404 is the one response with no body at all, so never parse it.
  if (res.status === 404) {
    return fail(
      '404 Not Found',
      'The endpoint is turned off on production on purpose. On staging it means the deploy is not out yet.',
      'NOT_FOUND',
    )
  }

  const error = errorFrom(await readBody<ApiErrorBody>(res), {
    title: `The request failed with HTTP ${res.status}`,
    message: 'The response had no error details.',
  })
  return { ok: false, rowErrors: [], tokenError: null, error }
}
