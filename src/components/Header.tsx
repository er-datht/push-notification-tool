'use client'

import { MenuIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useShell } from '@/lib/shell'

/** Rendered once by the root layout. The menu button drives the push-type list through `useShell`. */
export function Header() {
  const { narrow, sideOpen, sideDrawer, toggleSide, sideToggle } = useShell()
  const open = narrow ? sideDrawer : sideOpen
  const label = open ? 'Hide push type list' : 'Show push type list'
  return (
    <header className="flex min-h-15 shrink-0 flex-wrap items-center gap-4 bg-sidebar px-4.5 text-[#eef1f6] sm:px-7">
      {sideToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          onClick={toggleSide}
          aria-label={label}
          title={label}
        >
          <MenuIcon className="size-5" />
        </Button>
      )}
      <span className="text-base font-semibold tracking-tight">Push Notification Tool</span>
      <Badge className="bg-sidebar-accent text-[11px] font-semibold tracking-[0.08em] text-sidebar-foreground">STAG ONLY</Badge>
    </header>
  )
}
