import { useEffect, useRef } from 'react'

interface Props {
  title: string
  body: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ title, body, onCancel, onConfirm }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="ptc-overlay" onClick={onCancel}>
      <div className="ptc-dialog" role="dialog" aria-modal="true" aria-labelledby="ptc-confirm-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="ptc-confirm-title">{title}</h3>
        <p>{body}</p>
        <div className="ptc-dialog-actions">
          <button className="ptc-btn-outline" onClick={onCancel}>Cancel</button>
          <button ref={confirmRef} className="ptc-btn" onClick={onConfirm}>Yes, execute</button>
        </div>
      </div>
    </div>
  )
}
