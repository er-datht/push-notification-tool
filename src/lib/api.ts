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

/** One item from the `201 Created` body, in the same order the editions were sent. */
export interface ScheduledEdition {
  deliv_id: string
  filename: string
  will_publish_at: string
  /** How many ids we *sent*. Not how many people get the push. */
  login_ids_count: number
}

export interface AutoAppPushResult {
  editions: ScheduledEdition[]
  distributed: boolean
}

export type SubmitResult =
  | { ok: true; data: AutoAppPushResult }
  /** `rowErrors[i]` belongs to edition `i`. It is empty when the failure is not about any row. */
  | { ok: false; rowErrors: RowError[][]; generalMessages: string[] }

/** The API's 400 shape. Our route handler emits the same `messages[]` for its own problems. */
interface ApiErrorBody {
  error_description?: string
  messages?: unknown
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

const EDITION_PREFIX = /^editions\[(\d+)\]\.\s*/

/** The payload key a message starts with, and the input it belongs to. */
const FIELD_BY_PAYLOAD_KEY: Record<string, RowField> = {
  publish_hour_min: 'time',
  deliv_id: 'delivId',
  title: 'title',
  link_type: 'kind',
  link_item: 'linkValue',
}

/**
 * `messages` is one flat list. A message about a single edition starts with `editions[n].` and
 * then names the payload key. We split them up so each card shows its own message, without the
 * prefix and pointed at the right input. A key we do not know still shows, just with no field.
 */
export function splitMessages(messages: string[], rowCount: number) {
  const rowErrors = Array.from({ length: rowCount }, (): RowError[] => [])
  const generalMessages: string[] = []
  for (const message of messages) {
    const m = EDITION_PREFIX.exec(message)
    const i = m ? Number(m[1]) : -1
    if (!m || i < 0 || i >= rowCount) {
      generalMessages.push(message)
      continue
    }
    const rest = message.slice(m[0].length)
    const key = /^([a-z_]+)\b/.exec(rest)
    rowErrors[i].push({ field: (key && FIELD_BY_PAYLOAD_KEY[key[1]]) ?? null, message: rest })
  }
  return { rowErrors, generalMessages }
}

async function readBody<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** `messages[]` is the content. The API's `error_description` is filler, so it is only a last resort. */
function messagesFrom(body: ApiErrorBody | null, fallback: string): string[] {
  const detail = Array.isArray(body?.messages) ? body.messages.map(String).filter(Boolean) : []
  return detail.length ? detail : [body?.error_description ?? fallback]
}

export async function submitAutoAppPush(payload: AutoAppPushPayload): Promise<SubmitResult> {
  const rowCount = payload.editions.length
  // A run-level failure has nothing to say about any row, so `rowErrors` stays empty.
  const fail = (...generalMessages: string[]): SubmitResult => ({ ok: false, rowErrors: [], generalMessages })

  let res: Response
  try {
    res = await fetch(AUTO_APP_PUSH_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return fail('Could not reach this tool’s own server. Check that the dev server is still running, then try again.')
  }

  if (res.status === 201) {
    const data = await readBody<AutoAppPushResult>(res)
    if (data && Array.isArray(data.editions)) return { ok: true, data }
    return fail('The API took the run (201) but we could not read its answer. Check the ecs-api logs before you send again. The file may already be on S3.')
  }

  if (res.status === 400) {
    const messages = messagesFrom(await readBody<ApiErrorBody>(res), 'The API did not accept these values.')
    const { rowErrors, generalMessages } = splitMessages(messages, rowCount)
    return { ok: false, rowErrors, generalMessages }
  }

  // 401 and 404 come back with no body at all, so never parse them.
  if (res.status === 401) {
    return fail('401 Unauthorized. The X-APIToken was missing or wrong. On staging this usually means the token is not in SSM at /epica/stg/api, not that .env.local is wrong.')
  }
  if (res.status === 404) {
    return fail('404 Not Found. The endpoint is turned off on production on purpose. On staging it means the deploy is not out yet.')
  }

  return fail(...messagesFrom(await readBody<ApiErrorBody>(res), `The request failed with HTTP ${res.status}.`))
}
