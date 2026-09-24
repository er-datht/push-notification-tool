import { COMING_SOON } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

/** The push-type list. Lives in the left column on wide screens and in the left Sheet on narrow ones. */
export function Sidebar({ className }: Props) {
  return (
    <aside className={cn('overflow-y-auto bg-sidebar py-7 text-sidebar-foreground', className)}>
      <div className="px-5 pb-3.5 text-[11px] font-semibold tracking-[0.09em] text-navy-label uppercase">Push types</div>
      <div className="flex flex-col gap-0.5 px-3">
        <div className="flex items-center rounded-lg bg-sidebar-primary px-3.5 py-[11px] text-sm font-semibold text-sidebar-primary-foreground">
          Auto App Push
        </div>
        {COMING_SOON.map((name) => (
          <div
            key={name}
            className="flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3.5 py-[11px] text-sm font-light text-navy-muted"
            aria-disabled="true"
          >
            <span>{name}</span>
            <span className="rounded-lg bg-sidebar-foreground/10 px-[7px] py-0.5 text-[10px] font-semibold tracking-[0.06em] text-navy-muted">SOON</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
