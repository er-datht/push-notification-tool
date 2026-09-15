import { LINKS, SUB_TYPE, timeLabel, type LinkKind, type NotificationRow } from '@/lib/types'

interface Props {
  row: NotificationRow
  index: number
  errors: string[]
  canRemove: boolean
  onPatch: <K extends keyof NotificationRow>(field: K, value: NotificationRow[K]) => void
  onRemove: () => void
}

const KINDS: { kind: LinkKind; label: string }[] = [
  { kind: 'web', label: 'Web page' },
  { kind: 'kogyo', label: 'Kogyo' },
  { kind: 'word', label: 'Word' },
]

export function NotificationRowCard({ row, index, errors, canRemove, onPatch, onRemove }: Props) {
  const L = LINKS[row.kind]
  const open = !row.collapsed
  const uid = `ptc-row-${row.id}`
  const toggle = () => onPatch('collapsed', !row.collapsed)

  return (
    <section className="ptc-card">
      <div className="ptc-row-head" onClick={toggle}>
        <span className="ptc-row-label">Notification {index + 1}</span>
        <span className="ptc-count">{timeLabel(row)}</span>
        <span className="ptc-row-summary">{row.title || 'No notification text yet'}</span>
        <button
          className="ptc-btn-ghost"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
        >
          {row.collapsed ? 'Edit' : 'Collapse'}
        </button>
        <button
          className="ptc-btn-ghost is-muted"
          disabled={!canRemove}
          title={canRemove ? undefined : 'A run needs at least one notification'}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="ptc-row-body">
          <div className="ptc-fields">
            <div className="span-2">
              <label className="ptc-label" htmlFor={`${uid}-hour`}>Hour <span className="ptc-req">*</span></label>
              <input id={`${uid}-hour`} className="ptc-input" inputMode="numeric" value={row.hour} onChange={(e) => onPatch('hour', e.target.value)} />
            </div>
            <div className="span-2">
              <label className="ptc-label" htmlFor={`${uid}-min`}>Minute <span className="ptc-req">*</span></label>
              <input id={`${uid}-min`} className="ptc-input" inputMode="numeric" value={row.min} onChange={(e) => onPatch('min', e.target.value)} />
            </div>
            <div className="span-4">
              <label className="ptc-label" htmlFor={`${uid}-deliv`}>Delivery ID (deliv_id) <span className="ptc-req">*</span></label>
              <input id={`${uid}-deliv`} className="ptc-input" placeholder="H020064377" value={row.delivId} onChange={(e) => onPatch('delivId', e.target.value)} />
            </div>
            <div className="span-4">
              <label className="ptc-label" htmlFor={`${uid}-sub`}>Sub type</label>
              <input id={`${uid}-sub`} className="ptc-input" value={SUB_TYPE} readOnly title="Fixed for this push type" />
            </div>
            <div className="span-12">
              <label className="ptc-label" htmlFor={`${uid}-title`}>Notification text (title) <span className="ptc-req">*</span></label>
              <input id={`${uid}-title`} className="ptc-input" placeholder="イープラスのWEBページへ遷移します。" value={row.title} onChange={(e) => onPatch('title', e.target.value)} />
            </div>
            <div className="span-12">
              <span className="ptc-label" style={{ marginBottom: 8 }} id={`${uid}-kind-label`}>Where should the tap go? <span className="ptc-req">*</span></span>
              <div className="ptc-seg" role="radiogroup" aria-labelledby={`${uid}-kind-label`}>
                {KINDS.map((k) => (
                  <label key={k.kind} className={row.kind === k.kind ? 'is-on' : ''}>
                    <input type="radio" name={`${uid}-kind`} checked={row.kind === k.kind} onChange={() => onPatch('kind', k.kind)} />
                    {k.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="span-12">
              <label className="ptc-label" htmlFor={`${uid}-link`}>{L.label} <span className="ptc-req">*</span></label>
              <input id={`${uid}-link`} className="ptc-input" placeholder={L.placeholder} value={row.linkValue} onChange={(e) => onPatch('linkValue', e.target.value)} />
              <p className="ptc-field-help">{L.help}</p>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="ptc-errors" role="alert">
              <div className="ptc-errors-title">{errors.length} field(s) need attention</div>
              {errors.map((t) => (
                <div key={t} className="ptc-error-line">{t}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
