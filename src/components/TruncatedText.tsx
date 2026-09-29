'use client'

import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * One line of text, cut with an ellipsis when it does not fit. The full text shows in a tooltip,
 * but only while it is actually cut: a tooltip that repeats what is already on screen is noise.
 * Needs the `TooltipProvider` in `layout.tsx`.
 */
export function TruncatedText({ children, className, ...props }: { children: string } & Omit<ComponentProps<'span'>, 'children'>) {
  const ref = useRef<HTMLSpanElement>(null)
  const [clipped, setClipped] = useState(false)
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setClipped(el.scrollWidth > el.clientWidth)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])

  return (
    <Tooltip open={clipped && open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn('block truncate', className)} {...props}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-words whitespace-pre-line">{children}</TooltipContent>
    </Tooltip>
  )
}
