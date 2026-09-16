import { toast } from 'react-toastify'

/**
 * Problems with the whole run, not with one field: a bad token, a host we cannot reach, a `400`
 * about `login_ids`. Messages about one field stay on their input instead.
 *
 * `autoClose: false` on purpose. These messages are the only copy of what the API said, and some
 * of them (a missing env var, a token missing from SSM) take a while to read.
 * `toastId` stops a second Execute from stacking up the same message again.
 */
export function toastApiError(messages: string[]): void {
  if (!messages.length) return
  const [summary, ...detail] = messages
  toast.error(
    <div>
      <p className="mb-1.5 text-[13.5px] font-semibold text-red-ink">The API did not take this run</p>
      <p className="text-[13px] leading-relaxed font-light text-ink-2">{summary}</p>
      {detail.map((t) => (
        <p key={t} className="mt-1.5 text-[12.5px] leading-relaxed font-light break-words text-ink-4">{t}</p>
      ))}
    </div>,
    { toastId: messages.join('|'), autoClose: false },
  )
}

/** Closes any open error toast. Once the run is sent again, the old answer is out of date. */
export function dismissApiErrors(): void {
  toast.dismiss()
}
