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
    help: 'link_type 03 — the tap opens this e+ web page inside the app browser.',
    line: 'Opens web page',
  },
  kogyo: {
    code: '01',
    label: 'Kogyo / bundle code',
    placeholder: '9041480001-P0030001P021001',
    help: 'link_type 01 — the tap opens the performance or SmaTicket bundle with this code.',
    line: 'Opens kogyo',
  },
  word: {
    code: '02',
    label: 'Word ID',
    placeholder: '2762',
    help: 'link_type 02 — the tap opens the subscribed word page.',
    line: 'Opens word',
  },
}

export const SUB_TYPE = 'auto_app_push'

export const SERVER_LABEL: Record<Server, string> = {
  express: 'ExpressJS',
  'ecs-api': 'ecs-api',
}

export const COMING_SOON = ['Normal Push', 'Last minute Push', 'Score Push', 'News Push', 'Order Push']

export const pad = (v: string | number) => String(v).padStart(2, '0')
export const timeLabel = (r: Pick<NotificationRow, 'hour' | 'min'>) => `${pad(r.hour || '0')}:${pad(r.min || '0')}`

export function errorsFor(r: NotificationRow): string[] {
  const e: string[] = []
  const h = Number(r.hour)
  const m = Number(r.min)
  if (r.hour === '' || !Number.isInteger(h) || h < 0 || h > 23) e.push('Hour must be a whole number between 0 and 23.')
  if (r.min === '' || !Number.isInteger(m) || m < 0 || m > 59) e.push('Minute must be a whole number between 0 and 59.')
  if (!r.delivId.trim()) e.push('Delivery ID is required — the batch needs it to match the campaign.')
  if (!r.title.trim()) e.push('Notification text is required.')
  const link = r.linkValue.trim()
  if (!link) e.push(`${LINKS[r.kind].label} is required.`)
  else if (r.kind === 'web' && !/^https?:\/\//.test(link)) e.push('Destination URL must start with http:// or https://.')
  else if (r.kind === 'word' && !/^\d+$/.test(link)) e.push('Word ID must be numeric.')
  return e
}
