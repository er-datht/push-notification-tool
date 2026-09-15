interface Props {
  showSideToggle: boolean
  sideOpen: boolean
  onToggleSide: () => void
}

export function Header({ showSideToggle, sideOpen, onToggleSide }: Props) {
  const label = sideOpen ? 'Hide push type list' : 'Show push type list'
  return (
    <header className="ptc-head">
      {showSideToggle && (
        <button className="ptc-icon-btn" onClick={onToggleSide} aria-label={label} title={label}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
        </button>
      )}
      <span className="ptc-head-title">Push Notification Tool</span>
      <span className="ptc-head-env">STAG ONLY</span>
    </header>
  )
}
