import { toast } from 'react-toastify'
import type { ApiError } from '@/lib/api'

/**
 * Problems with the whole run, not with one field: a bad token, a host we cannot reach, a `422`
 * about `login_ids`. Entries about one edition stay on their card instead.
 *
 * Laid out the way the API's `error` object is: `title` as the headline, `message` as the banner
 * text (it already ends with its own `error_id`), then one line per entry left in `errors[]`,
 * each opened with the `field` it is about when it has one.
 *
 * `autoClose: false` on purpose. These messages are the only copy of what the API said, and some
 * of them (a missing env var, a token missing from SSM) take a while to read.
 * `toastId` stops a second Execute from stacking up the same message again.
 */
export function toastApiError(error: ApiError): void {
  const { title, message, errors } = error
  if (!title && !message && !errors.length) return
  toast.error(
    <div>
      <p className="mb-1 text-[13.5px] font-semibold text-red-ink">{title || 'The API did not take this run'}</p>
      {message && <p className="text-[13px] leading-relaxed font-light break-words text-ink-2">{message}</p>}
      {errors.length > 0 && (
        <ul className="mt-1.5 list-disc pl-4">
          {errors.map((e, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed font-light break-words text-ink-3">
              {e.field && <span className="font-mono text-ink-4">{e.field} — </span>}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>,
    { toastId: JSON.stringify(error), autoClose: false },
  )
}

/** Closes any open error toast. Once the run is sent again, the old answer is out of date. */
export function dismissApiErrors(): void {
  toast.dismiss()
}
