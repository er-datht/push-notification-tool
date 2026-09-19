import type { ApiError, ApiFieldError } from '@/lib/api'
import { DELIV_ID_MAX, LINKS, type LinkKind } from '@/lib/types'

/**
 * What the tester reads for each `error_id` the API can send. The API's own `message` names
 * payload keys ("link_item is required (AP-0204)") that mean nothing on the form, so it is only a
 * fallback for an id we do not know. Ids are stable, wording is not, so key on the id.
 *
 * The full table, with the field each id lands on, is `docs/UI-FIELD-MAPPING.md`. Keep both in step.
 */
type Wording = string | ((ctx: { label: string }) => string)

const WORDING_BY_ERROR_ID: Record<string, Wording> = {
  // Whole request
  'AP-0001': 'Some values were not accepted.',
  'AP-0002': 'The API token was not accepted. Check it and try again.',
  'AP-0003': 'Something went wrong. Reload the page and try again.',
  'AP-0004': 'Something went wrong. Reload the page and try again.',
  // Run settings
  'AP-0101': 'Enter a valid date.',
  'AP-0102': 'Add at least one login ID.',
  'AP-0103': 'Add at least one notification.',
  // One edition. `label` is the link field's label for the row's kind.
  'AP-0201': 'Enter a delivery ID.',
  'AP-0202': `Delivery ID must be ${DELIV_ID_MAX} characters or fewer.`,
  'AP-0203': 'Enter the notification text.',
  'AP-0204': ({ label }) => `${label} is required.`,
  'AP-0205': 'Choose where the link should go.',
  'AP-0206': ({ label }) => `Enter a valid ${label}.`,
  'AP-0207': 'Enter a valid delivery time.',
  'AP-0208': 'Delivery time must be within 2 hours from now.',
  'AP-0209': 'Delivery time must be between 08:00 and 22:00 JST.',
}

const KIND_BY_CODE = Object.fromEntries(
  (Object.keys(LINKS) as LinkKind[]).map((kind) => [LINKS[kind].code, kind]),
) as Record<string, LinkKind>

/** The link field's label for a `link_type` code, so "link_item" can be read as "Destination URL". */
export function linkLabelFor(linkType: string | undefined): string {
  const kind = linkType ? KIND_BY_CODE[linkType] : undefined
  return kind ? LINKS[kind].label : 'Link'
}

/** The message to show for one entry, in our words when we know the id, the API's otherwise. */
export function messageFor(err: Pick<ApiFieldError, 'error_id' | 'field' | 'message'>, label: string): string {
  const wording = err.error_id ? WORDING_BY_ERROR_ID[err.error_id] : undefined
  if (!wording) return err.message
  return typeof wording === 'function' ? wording({ label }) : wording
}

/** Same for the top-level `error`: the toast banner text. */
export function bannerFor(error: Pick<ApiError, 'error_id' | 'message'>): string {
  const wording = error.error_id ? WORDING_BY_ERROR_ID[error.error_id] : undefined
  return typeof wording === 'string' ? wording : error.message
}
