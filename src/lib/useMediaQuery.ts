import { useSyncExternalStore } from 'react'

/** Below this width the sidebar and the review rail become drawers instead of grid columns. */
export const NARROW_QUERY = '(max-width: 1180px)'

interface Store {
  subscribe: (onChange: () => void) => () => void
  getSnapshot: () => boolean
}

/**
 * One store per query string, so `useSyncExternalStore` sees the same two functions every render
 * and keeps a single `change` listener instead of re-subscribing on each keystroke. The
 * `MediaQueryList` is made on first use, because only the browser has `window.matchMedia`.
 */
const stores = new Map<string, Store>()

function storeFor(query: string): Store {
  let store = stores.get(query)
  if (!store) {
    let mql: MediaQueryList | undefined
    const list = () => (mql ??= window.matchMedia(query))
    store = {
      subscribe: (onChange) => {
        list().addEventListener('change', onChange)
        return () => list().removeEventListener('change', onChange)
      },
      getSnapshot: () => list().matches,
    }
    stores.set(query, store)
  }
  return store
}

const serverSnapshot = () => false

/**
 * `false` on the server and during hydration, so the prerendered HTML always matches. The real
 * value arrives right after mount, which is one frame of the wide layout on a narrow screen.
 */
export function useMediaQuery(query: string): boolean {
  const store = storeFor(query)
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot)
}
