import { createContext, useContext } from 'react'

/**
 * The part of the page state that the header needs: whether the push-type list is open and how
 * to toggle it. It lives above the page because `Header` is rendered by the root layout, while
 * the list itself is rendered by `PushConsole`. Everything else stays in `PushConsole`.
 * `ShellProvider` (`src/components/ShellProvider.tsx`) owns the values.
 */
export interface Shell {
  /** Below `NARROW_QUERY`: the list and the review rail are drawers, not grid columns. */
  narrow: boolean
  /** The wide layout's sidebar column. */
  sideOpen: boolean
  /** The narrow layout's left drawer. Kept apart from `sideOpen` so a list hidden on desktop does
   *  not turn into a drawer that is already open after a resize. */
  sideDrawer: boolean
  toggleSide: () => void
  closeSideDrawer: () => void
  /** False on the done screen, which has no list to show. `PushConsole` flips it. */
  sideToggle: boolean
  setSideToggle: (on: boolean) => void
}

export const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error('useShell needs a <ShellProvider> above it (see app/layout.tsx)')
  return shell
}
