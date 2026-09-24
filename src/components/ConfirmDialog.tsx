import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  title: string
  body: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ open, title, body, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent showCloseButton={false} onOpenAutoFocus={(e) => {
        // Land on the primary action, like the mockup.
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('[data-confirm]')?.focus()
      }}>
        <DialogHeader>
          <DialogTitle className="text-[19px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed font-light text-ink-2">{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-1.5">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button data-confirm onClick={onConfirm}>Yes, execute</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
