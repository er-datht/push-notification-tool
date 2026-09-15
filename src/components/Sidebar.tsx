import { COMING_SOON } from '@/lib/types'

export function Sidebar() {
  return (
    <aside className="ptc-side">
      <div className="ptc-side-label">Push types</div>
      <div className="ptc-side-list">
        <div className="ptc-side-item is-active">Auto App Push</div>
        {COMING_SOON.map((name) => (
          <div key={name} className="ptc-side-item is-soon" aria-disabled="true">
            <span>{name}</span>
            <span className="ptc-soon-tag">SOON</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
