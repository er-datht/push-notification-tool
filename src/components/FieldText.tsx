import { cn } from '@/lib/utils'

/** Muted helper line under an input. */
export function FieldHelp({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn('mt-2 text-[12.5px] font-light text-ink-4', className)}>{children}</p>
}

/** Error line(s) under an input. Renders nothing when there is nothing to say. */
export function FieldError({ id, messages }: { id?: string; messages: string[] }) {
  if (!messages.length) return null
  return (
    <div id={id} className="mt-2 space-y-1 text-[12.5px] text-red-ink" role="alert">
      {messages.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  )
}

/** The red asterisk after a required label. */
export function Req() {
  return <span className="text-destructive">*</span>
}
