import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FieldError, Req } from '@/components/FieldText'
import { LINKS, SERVER_LABEL, SUB_TYPE, timeLabel, type NotificationRow, type Server } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onToggle: () => void
  /** Set when the rail is shown inside the narrow-screen drawer: adds a Cancel button and drops the Hide toggle. */
  onClose?: () => void
  rows: NotificationRow[]
  recipientCount: number
  date: string
  distributeNow: boolean
  server: Server
  onServerChange: (s: Server) => void
  /** The X-APIToken for whichever server is selected. Typed in here for each session; never stored. */
  apiToken: string
  onApiTokenChange: (v: string) => void
  apiTokenError: string | null
  hasErrors: boolean
  submitting: boolean
  onExecute: () => void
}

const SERVERS: { value: Server; sub: string; disabled?: boolean }[] = [
  { value: 'ecs-api', sub: 'The old Rails batch path' },
  { value: 'express', sub: 'The new Node/Express service' },
]

export function ReviewRail({
  open,
  onToggle,
  onClose,
  rows,
  recipientCount,
  date,
  distributeNow,
  server,
  onServerChange,
  apiToken,
  onApiTokenChange,
  apiTokenError,
  hasErrors,
  submitting,
  onExecute,
}: Props) {
  const inDrawer = !!onClose

  const foot = (
    <div className={cn('shrink-0 border-t bg-surface-alt px-4 pt-3.5 pb-4', inDrawer && 'bg-card px-5 pb-[18px]')}>
      <Card className="p-[18px]">
        <h4 className="mb-1 text-sm font-semibold">Dispatch target</h4>
        <RadioGroup value={server} onValueChange={(v) => onServerChange(v as Server)} className="gap-0">
          {SERVERS.map((s) => (
            <label
              key={s.value}
              className={cn(
                'flex items-start gap-2.5 rounded-lg px-2.5 py-[9px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                server === s.value && 'bg-accent',
                s.disabled ? 'cursor-not-allowed text-ink-4' : 'cursor-pointer',
              )}
              title={s.disabled ? 'Coming soon' : undefined}
            >
              <RadioGroupItem value={s.value} disabled={s.disabled} className="mt-0.5" />
              <span className="text-[13.5px]">
                {SERVER_LABEL[s.value]}
                {s.disabled && (
                  <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px] tracking-[0.06em] text-ink-4">
                    SOON
                  </Badge>
                )}
                <span className="block text-xs font-light text-ink-4">{s.sub}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <div className="mt-3 border-t pt-3.5">
          <Label htmlFor="ptc-api-token" className="mb-1.5">
            API token <Req />
          </Label>
          <Input
            id="ptc-api-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the test notification API token"
            value={apiToken}
            aria-invalid={apiTokenError ? true : undefined}
            aria-describedby={apiTokenError ? 'ptc-api-token-error' : undefined}
            onChange={(e) => onApiTokenChange(e.target.value)}
          />
          {apiTokenError && <FieldError id="ptc-api-token-error" messages={[apiTokenError]} />}
        </div>
      </Card>

      <div className="mt-3.5 flex flex-col">
        <Button size="lg" className="w-full" onClick={onExecute} disabled={submitting}>
          {submitting ? 'Executing…' : `Execute on ${SERVER_LABEL[server]}`}
        </Button>
        {onClose && (
          <Button variant="outline" size="lg" className="mt-2.5 w-full" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )

  if (!open && !inDrawer) {
    return (
      <aside className="flex flex-col items-center border-l bg-surface-alt px-3.5 py-6">
        <Button
          variant="ghost"
          className="h-auto w-auto px-2.5 py-4 font-semibold hover:bg-accent hover:text-primary [writing-mode:vertical-rl]"
          onClick={onToggle}
        >
          Show review
        </Button>
      </aside>
    )
  }

  return (
    <aside className={cn('flex min-h-0 flex-col overflow-hidden bg-surface-alt', inDrawer ? 'h-full bg-card' : 'border-l')}>
      <div className={cn('flex min-h-0 flex-1 flex-col p-4', inDrawer && 'px-5 pt-[22px] pb-4')}>
        <div className={cn('mb-1.5 flex items-center gap-2.5', inDrawer && 'pr-10')}>
          <h3 className={cn('text-base font-semibold', inDrawer && 'text-lg')}>Review</h3>
          {!inDrawer && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onToggle}>
              Hide
            </Button>
          )}
        </div>
        <p className="mb-[18px] border-b pb-[18px] text-[13px] leading-relaxed font-light text-ink-3">
          {hasErrors
            ? inDrawer
              ? 'Some notifications need fixing. Close this panel to see the details on each card.'
              : 'Some notifications need fixing. The details are on the cards on the left.'
            : 'A live preview of what each recipient will see.'}
          <span className="mt-2 block text-xs text-ink-4 tabular-nums">
            {date || '—'} JST · {distributeNow ? 'distribute_now ON, the job runs right away' : 'picked up within the next 10 minutes'}
          </span>
        </p>

        <div className={cn('flex min-h-0 w-full flex-1 flex-col gap-3.5 overflow-y-auto pr-1', !inDrawer && 'max-w-[600px]')}>
          {rows.map((r, i) => {
            const L = LINKS[r.kind]
            return (
              <Card key={r.id} className="flex shrink-0 flex-col gap-[9px] px-[18px] py-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-semibold tracking-[0.08em] text-primary uppercase">Auto App Push · {i + 1}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {timeLabel(r)}
                  </Badge>
                </div>
                <div className="text-[14.5px] leading-snug font-semibold text-pretty">{r.title || '(no notification text)'}</div>
                <div className="text-[12.5px] font-light break-all text-ink-3">
                  {L.line} — {r.linkValue || '(empty)'}
                </div>
                <div className="border-t border-line-3 pt-[9px] text-[11.5px] font-light text-ink-4">
                  deliv_id {r.delivId || '—'} · sub_type {SUB_TYPE} · link_type {L.code} · {recipientCount} recipients
                </div>
              </Card>
            )
          })}
        </div>
      </div>
      {foot}
    </aside>
  )
}
