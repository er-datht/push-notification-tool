export type LinkKind = 'web' | 'kogyo' | 'word'
export type Server = 'ecs-api' | 'express'

export interface NotificationRow {
  id: number
  hour: string
  min: string
  delivId: string
  title: string
  kind: LinkKind
  linkValue: string
  collapsed: boolean
}

export interface LinkMeta {
  code: string
  label: string
  placeholder: string
  help: string
  line: string
}

export const LINKS: Record<LinkKind, LinkMeta> = {
  web: {
    code: '03',
    label: 'Destination URL',
    placeholder: 'https://eplus.jp/',
    help: 'link_type 03. Tapping the push opens this e+ web page inside the app.',
    line: 'Opens web page',
  },
  kogyo: {
    code: '01',
    label: 'Kogyo / bundle code',
    placeholder: '9041480001-P0030001P021001',
    help: 'link_type 01. Tapping the push opens the show or SmaTicket bundle with this code. The API only takes a real show id.',
    line: 'Opens kogyo',
  },
  word: {
    code: '02',
    label: 'Word ID',
    placeholder: '2762',
    help: 'link_type 02. Tapping the push opens the subscribed word page.',
    line: 'Opens word',
  },
}

export const SUB_TYPE = 'auto_app_push'

export const SERVER_LABEL: Record<Server, string> = {
  express: 'ExpressJS',
  'ecs-api': 'ecs-api',
}

export const COMING_SOON = ['Normal Push', 'Last minute Push', 'Score Push', 'News Push', 'Order Push']

/** The API checks these too. We check them here so the tester finds out without sending. */
export const DELIV_ID_MAX = 24
const WINDOW_START_MIN = 8 * 60
const WINDOW_END_MIN = 22 * 60
const MAX_LEAD_MS = 2 * 60 * 60 * 1000

export const pad = (v: string | number) => String(v).padStart(2, '0')
export const timeLabel = (r: Pick<NotificationRow, 'hour' | 'min'>) => `${pad(r.hour || '0')}:${pad(r.min || '0')}`

/** The API reads every time as Asia/Tokyo. Japan stays at UTC+9 all year, so there is no DST. */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** Today in Asia/Tokyo as `YYYY-MM-DD`, no matter what timezone the browser is in. */
export function todayInTokyo(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
}

/**
 * Turns a `YYYY-MM-DD` date plus an hour and minute in Tokyo time into epoch ms.
 * Gives back null when the date is not a real day.
 */
export function tokyoEpoch(date: string, hour: number, min: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = Date.UTC(y, mo - 1, d, hour, min)
  const back = new Date(utc)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== mo || back.getUTCDate() !== d) return null
  return utc - JST_OFFSET_MS
}

/** `will_publish_at` comes back with a +09:00 offset. We read the text as it is, so `Date`
 *  cannot redraw it in the browser's timezone. */
export function formatPublishAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]} JST` : iso
}

/** Adds 1 to the number at the end of a delivery ID, so the next run gets a new one. */
export function nextDelivId(id: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(id.trim())
  if (!m) return id.trim()
  return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}${m[3]}`
}

/** Every row shares one delivery date, so we report it once here instead of on each card. */
export function dateErrorFor(date: string): string | null {
  if (!date.trim()) return 'Pick a delivery date. Every notification in this run uses it.'
  if (tokyoEpoch(date, 0, 0) === null) return 'That date is not a real day. Use YYYY-MM-DD.'
  return null
}

/**
 * Which input an error points at, so the card can mark it. `time` means the hour and the minute
 * together, because the rules about the window and the lead time use both.
 * A null field means we could not match an input, so the card shows it in its summary block.
 */
export type RowField = 'hour' | 'min' | 'time' | 'delivId' | 'title' | 'kind' | 'linkValue'

export interface RowError {
  field: RowField | null
  message: string
}

/** All messages for one input, in the order they were added. */
export function errorsForField(errors: RowError[], ...fields: RowField[]): string[] {
  return errors.filter((e) => e.field !== null && fields.includes(e.field)).map((e) => e.message)
}

export function errorsFor(r: NotificationRow, date: string, now: Date = new Date()): RowError[] {
  const e: RowError[] = []
  const add = (field: RowField | null, message: string) => e.push({ field, message })

  const h = Number(r.hour)
  const m = Number(r.min)
  const hourOk = r.hour !== '' && Number.isInteger(h) && h >= 0 && h <= 23
  const minOk = r.min !== '' && Number.isInteger(m) && m >= 0 && m <= 59
  if (!hourOk) add('hour', 'Hour must be a whole number between 0 and 23.')
  if (!minOk) add('min', 'Minute must be a whole number between 0 and 59.')

  if (hourOk && minOk) {
    const minutes = h * 60 + m
    if (minutes < WINDOW_START_MIN || minutes > WINDOW_END_MIN) {
      add('time', 'Pick a time between 08:00 and 22:00 JST. The import job never picks up a file outside those hours.')
    }
    // A missing or unreadable date is reported once by dateErrorFor, so we skip it here.
    const at = tokyoEpoch(date, h, m)
    if (at !== null) {
      // Compare with the start of this minute, so picking the current time still counts as later.
      const floor = Math.floor(now.getTime() / 60_000) * 60_000
      if (at < floor) add('time', 'This time has already passed in JST. Pick a later one.')
      else if (at - floor > MAX_LEAD_MS) add('time', 'Pick a time within the next 2 hours. The import job only takes files that close to now.')
    }
  }

  const delivId = r.delivId.trim()
  if (!delivId) add('delivId', 'Enter a delivery ID. The batch uses it to find the campaign.')
  else if (delivId.length > DELIV_ID_MAX) add('delivId', `Delivery ID must be ${DELIV_ID_MAX} characters or fewer.`)

  if (!r.title.trim()) add('title', 'Enter the notification text.')

  const link = r.linkValue.trim()
  if (!link) add('linkValue', `Enter the ${LINKS[r.kind].label}.`)
  else if (r.kind === 'web' && !/^https?:\/\//.test(link)) add('linkValue', 'The URL must start with http:// or https://.')
  else if (r.kind === 'word' && !/^\d+$/.test(link)) add('linkValue', 'Word ID must be numbers only.')
  return e
}

/** Checks each row, then checks across rows: the API treats the same deliv_id twice as one delivery. */
export function validateRows(rows: NotificationRow[], date: string, now: Date = new Date()): RowError[][] {
  const out = rows.map((r) => errorsFor(r, date, now))
  const firstSeen = new Map<string, number>()
  rows.forEach((r, i) => {
    const id = r.delivId.trim()
    if (!id) return
    const first = firstSeen.get(id)
    if (first === undefined) firstSeen.set(id, i)
    else out[i].push({
      field: 'delivId',
      message: `Delivery ID "${id}" is already used by notification ${first + 1}. The same ID twice counts as one delivery, so give this one its own ID.`,
    })
  })
  return out
}
