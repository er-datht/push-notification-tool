import { LINKS, SERVER_LABEL, SUB_TYPE, timeLabel, type NotificationRow, type Server } from '@/lib/types'

interface Props {
  open: boolean
  onToggle: () => void
  rows: NotificationRow[]
  recipientCount: number
  server: Server
  onServerChange: (s: Server) => void
  hasErrors: boolean
  noRecipients: boolean
  onExecute: () => void
}

const SERVERS: { value: Server; sub: string; disabled?: boolean }[] = [
  { value: 'ecs-api', sub: 'Legacy Rails batch path' },
  { value: 'express', sub: 'New service — not available yet', disabled: true },
]

export function ReviewRail({ open, onToggle, rows, recipientCount, server, onServerChange, hasErrors, noRecipients, onExecute }: Props) {
  if (!open) {
    return (
      <aside className="ptc-rail">
        <div className="ptc-rail-stub">
          <button onClick={onToggle}>Show review</button>
        </div>
      </aside>
    )
  }

  const note = hasErrors
    ? noRecipients
      ? 'Add at least one recipient before executing.'
      : 'Blocked — fix the flagged notifications first.'
    : 'Validation runs when you press Execute; you get one confirmation.'

  return (
    <aside className="ptc-rail">
      <div className="ptc-rail-inner">
        <div className="ptc-rail-head">
          <h3>Review</h3>
          <button className="ptc-btn-ghost" onClick={onToggle}>Hide</button>
        </div>
        <p className="ptc-rail-verdict">
          {hasErrors ? 'Some notifications need fixing — details are on the cards on the left.' : 'A live preview of what each recipient will see.'}
        </p>

        <div className="ptc-rail-cards">
          {rows.map((r, i) => {
            const L = LINKS[r.kind]
            return (
              <article key={r.id} className="ptc-card ptc-preview">
                <div className="ptc-preview-top">
                  <span className="ptc-kicker">Auto App Push · {i + 1}</span>
                  <span className="ptc-preview-time">{timeLabel(r)}</span>
                </div>
                <div className="ptc-preview-title">{r.title || '(no notification text)'}</div>
                <div className="ptc-preview-link">{L.line} — {r.linkValue || '(empty)'}</div>
                <div className="ptc-preview-meta">
                  deliv_id {r.delivId || '—'} · sub_type {SUB_TYPE} · link_type {L.code} · {recipientCount} recipients
                </div>
              </article>
            )
          })}
        </div>

        <div className="ptc-rail-foot">
          <div className="ptc-card ptc-target">
            <h4>Dispatch target</h4>
            {SERVERS.map((s) => (
              <label
                key={s.value}
                className={`ptc-radio${server === s.value ? ' is-on' : ''}${s.disabled ? ' is-disabled' : ''}`}
                title={s.disabled ? 'Coming soon' : undefined}
              >
                <input type="radio" name="ptc-server" checked={server === s.value} disabled={s.disabled} onChange={() => onServerChange(s.value)} />
                <span className="ptc-radio-dot" aria-hidden="true" />
                <span className="ptc-radio-text">
                  {SERVER_LABEL[s.value]}
                  {s.disabled && <span className="ptc-soon-tag ptc-soon-tag-light">SOON</span>}
                  <br />
                  <span className="ptc-radio-sub">{s.sub}</span>
                </span>
              </label>
            ))}
          </div>

          <div>
            <button className="ptc-btn ptc-execute" onClick={onExecute}>Execute on {SERVER_LABEL[server]}</button>
            <p className={`ptc-execute-note${hasErrors ? ' is-error' : ''}`}>{note}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
