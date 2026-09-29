'use client'

import { useState } from 'react'
import { ShellContext, type Shell } from '@/lib/shell'
import { NARROW_QUERY, useMediaQuery } from '@/lib/useMediaQuery'

/** Rendered once by the root layout, around the header and the page. See `src/lib/shell.ts`. */
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const narrow = useMediaQuery(NARROW_QUERY)
  const [sideOpen, setSideOpen] = useState(true)
  const [sideDrawer, setSideDrawer] = useState(false)
  const [sideToggle, setSideToggle] = useState(true)

  const shell: Shell = {
    narrow,
    sideOpen,
    sideDrawer,
    toggleSide: () => (narrow ? setSideDrawer((v) => !v) : setSideOpen((v) => !v)),
    closeSideDrawer: () => setSideDrawer(false),
    sideToggle,
    setSideToggle,
  }
  return <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>
}
