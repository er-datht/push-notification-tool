import { bannerFor, linkLabelFor, messageFor } from '@/lib/apiMessages'
import { LINKS, type NotificationRow, type RowError, type RowField } from '@/lib/types'

/** Our own route handler. It keeps the X-APIToken, so the browser never sees it. */
const AUTO_APP_PUSH_ROUTE = '/api/push/auto-app-push'

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

/** One item from `data.editions[]` in a success body, in the same order the editions were sent. */
export interface ScheduledEdition {
  deliv_id: string
  title: string
  link_type: string
  /** The cleaned-up value: a `link_type: "01"` show id comes back shortened to `904148-0001`. */
  link_item: string
  will_publish_at: string
  /** `null` while the endpoint is validation-only; the file written to S3 once delivery is on. */
  filename: string | null
}

/** The `data` of a `200` / `201` body. */
export interface AutoAppPushResult {
  /** `validated` = the payload was checked and nothing was written; `created` = the file is on S3. */
  status: 'validated' | 'created'
  date: string
  /** How many ids we *sent*. Not how many people get the push. */
  login_ids_count: number
  editions: ScheduledEdition[]
  distributed: boolean
}

/** The success envelope. `status_code` is a string that repeats the HTTP status. */
interface SuccessBody {
  status_code?: string
  message?: string
  data?: Partial<AutoAppPushResult>
}

export type SubmitResult =
  | { ok: true; data: AutoAppPushResult }
  /**
   * `rowErrors[i]` belongs to edition `i`. `error.errors` keeps only the entries that were not
   * about a row, so the toast never repeats what a card already shows.
   */
  | { ok: false; rowErrors: RowError[][]; error: ApiError }

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

export async function submitAutoAppPush(payload: AutoAppPushPayload): Promise<SubmitResult> {
  // A run-level failure has nothing to say about any row, so `rowErrors` stays empty.
  const fail = (title: string, message: string, code?: string): SubmitResult => ({
    ok: false,
    rowErrors: [],
    error: { code, title, message, errors: [] },
  })

  let res: Response
  try {
    res = await fetch(AUTO_APP_PUSH_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return fail('Could not reach this tool’s own server', 'Check that the dev server is still running, then try again.')
  }

  // 200 while the endpoint is validation-only, 201 once delivery is switched on. Same body.
  if (res.status === 200 || res.status === 201) {
    const data = (await readBody<SuccessBody>(res))?.data
    if (data && Array.isArray(data.editions)) return { ok: true, data: data as AutoAppPushResult }
    return fail(
      'The API took the run but we could not read its answer',
      `It answered ${res.status}, so the file may already be on S3. Check the ecs-api logs before you send again.`,
    )
  }

  // 422 is validation, one entry per field. 400 is a body the API could not read at all (not
  // JSON, or a key it does not know) and uses the same envelope, so both are split the same way.
  if (res.status === 422 || res.status === 400) {
    const error = errorFrom(await readBody<ApiErrorBody>(res), {
      title: 'The API did not accept these values',
      message: `It answered ${res.status} without saying which values.`,
    })
    const { rowErrors, general } = splitErrors(error.errors, payload.editions)
    return { ok: false, rowErrors, error: { ...error, errors: general } }
  }

  if (res.status === 401) {
    const error = errorFrom(await readBody<ApiErrorBody>(res), {
      title: 'Unauthorized',
      message: 'The X-APIToken header is missing or wrong.',
    })
    // Where the token went wrong (SSM on staging, .env.local here) is for the console, not the tester.
    console.error('401 from the API: X-APIToken missing or wrong. On staging check SSM at /epica/stg/api.')
    return { ok: false, rowErrors: [], error }
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
  return { ok: false, rowErrors: [], error }
}
