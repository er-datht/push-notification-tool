import { useState } from 'react'

interface Props {
  loginIds: string[]
  open: boolean
  onToggle: () => void
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}

export function RecipientsSection({ loginIds, open, onToggle, onAdd, onRemove }: Props) {
  const [newId, setNewId] = useState('')

  const add = () => {
    const v = newId.trim()
    if (!v) return
    onAdd(v)
    setNewId('')
  }

  return (
    <section className="ptc-card" style={{ marginTop: 32 }}>
      <button className="ptc-section-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="ptc-section-title">Recipients</span>
        <span className="ptc-count">{loginIds.length} accounts</span>
        <span className="ptc-link-text" style={{ marginLeft: 'auto' }}>{open ? 'Hide' : 'Edit'}</span>
      </button>
      {open && (
        <div className="ptc-recipients-body">
          <p className="ptc-help">
            These test accounts are pre-loaded for every run. Remove any you don't want to disturb, or add a login ID to include a teammate.
          </p>
          <div className="ptc-chips">
            {loginIds.map((id) => (
              <span key={id} className="ptc-chip">
                {id}
                <button className="ptc-chip-x" onClick={() => onRemove(id)} aria-label={`Remove ${id}`}>×</button>
              </span>
            ))}
          </div>
          <div className="ptc-add-id">
            <div>
              <label className="ptc-label" htmlFor="ptc-new-id">Add login ID</label>
              <input
                id="ptc-new-id"
                className="ptc-input"
                placeholder="e-plus-test04"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    add()
                  }
                }}
              />
            </div>
            <button className="ptc-btn-outline" onClick={add}>Add</button>
          </div>
        </div>
      )}
    </section>
  )
}
