import type { ApiError, ApiFieldError } from '@/lib/api'
import { DELIV_ID_MAX, LINKS, type LinkKind } from '@/lib/types'

/**
 * What the tester reads for each `error_id` the API can send. The API's own `message` names
 * payload keys ("link_item is required (AP-0204)") that mean nothing on the form, so it is only a
 * fallback for an id we do not know. Ids are stable, wording is not, so key on the id.
 *
 * The full table, with the field each id lands on, is `../fe-docs/UI-FIELD-MAPPING.md`. Keep both in step.
 */
type Wording = string | ((ctx: { label: string }) => string)

const WORDING_BY_ERROR_ID: Record<string, Wording> = {
  // Whole request
  'AP-0001': 'Some values were not accepted.',
  'AP-0002': 'The API token was not accepted. Check it and try again.',
  'AP-0003': 'Something went wrong. Reload the page and try again.',
  'AP-0004': 'Something went wrong. Reload the page and try again.',
  'AP-0006': 'Could not upload the delivery file. Try again in a moment.',
  // Run settings
  'AP-0101': 'Enter a valid date.',
  'AP-0102': 'Add at least one login ID.',
  'AP-0103': 'Add at least one notification.',
  'AP-0104': 'distribute_now must be true or false.',
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

  // Normal Push (../fe-docs/API-DOC-normal-push.md). Whole request
  'NP-0001': 'Some values were not accepted.',
  'NP-0002': 'The API token was not accepted. Check it and try again.',
  'NP-0003': 'Something went wrong. Reload the page and try again.',
  'NP-0004': 'Something went wrong. Reload the page and try again.',
  'NP-0005':
    'The server could not create the push. Some notifications may already exist, so ask the backend team before sending again.',
  'NP-0006':
    'The e+ search API did not answer, so a show code could not be expanded. Notifications before it may already exist. A full code with a P021… part avoids the search.',
  // Run settings (NP-0104 is ExpressJS only)
  'NP-0101': 'Enter a valid date.',
  'NP-0103': 'Add at least one notification.',
  'NP-0104': 'distribute_now must be true or false.',
  // One notification, or one show in it
  'NP-0201': 'Add at least one show.',
  'NP-0202': 'Enter the show code.',
  'NP-0203': 'Enter a valid show code, like 9014500001-P0030056. Leave out the [公演] prefix.',
  'NP-0204': 'Word ID must be a whole number above 0, at most 16 digits.',
  'NP-0205': 'Pick preorder or firstcome.',
  'NP-0206': 'Enter a valid delivery time.',
  'NP-0207': 'Delivery time must be between 08:00 and 21:00 JST, so the one-hour window ends by 22:00.',
  'NP-0208': 'That hour is already taken by another notification. Pick a different hour.',

  // In store Push (../fe-docs/API-DOC-in-store-push.md). Whole request. IS-0001 is not in that
  // doc's tables; it is the 422 envelope's own id, as NP-0001 is for Normal.
  'IS-0001': 'Some values were not accepted.',
  'IS-0002': 'The API token was not accepted. Check it and try again.',
  'IS-0003': 'Something went wrong. Reload the page and try again.',
  'IS-0004': 'Something went wrong. Reload the page and try again.',
  'IS-0005':
    'The server could not create the push. Some notifications may already exist, so ask the backend team before sending again.',
  'IS-0006':
    'The e+ search API did not answer, so a show code could not be expanded. Notifications before it may already exist. A full code with a P021… part avoids the search.',
  // Run settings
  'IS-0101': 'Enter a valid date.',
  'IS-0103': 'Add at least one notification.',
  // One notification, or one show in it
  'IS-0201': 'Add at least one show.',
  'IS-0202': 'Enter the show code.',
  'IS-0203': 'Enter a valid show code, like 9063440001-P0030012. Leave out the [公演] prefix.',
  'IS-0204': 'Word ID must be a whole number above 0, at most 16 digits.',
  'IS-0205': 'Enter a valid delivery time.',
  'IS-0206': 'That time is already used by another in-store notification. Pick a different time.',

  // Score Push (../fe-docs/API-DOC-score-push.md). Whole request. SP-0001 is assumed to be the 422
  // envelope's own id, as IS-0001 is for In store.
  'SP-0001': 'Some values were not accepted.',
  'SP-0002': 'The API token was not accepted. Check it and try again.',
  'SP-0003': 'Something went wrong. Reload the page and try again.',
  'SP-0004': 'Something went wrong. Reload the page and try again.',
  'SP-0005':
    'The server could not create the push. Some notifications may already exist, so ask the backend team before sending again.',
  'SP-0006':
    'The e+ search API did not answer, so a show code could not be expanded. Notifications before it may already exist. A full code with a P021… part avoids the search.',
  // Run settings
  'SP-0101': 'Enter a valid date.',
  'SP-0102': 'Add at least one login ID.',
  'SP-0103': 'Add at least one notification.',
  // One notification, or one show in it
  'SP-0201': 'Add at least one show.',
  'SP-0202': 'Enter the show code.',
  'SP-0203': 'Enter a valid show code, like 9014500001-P0030056. Leave out the [公演] prefix.',
  'SP-0204': 'Word ID must be a whole number above 0, at most 16 digits.',
  'SP-0205': 'Pick preorder or firstcome.',
  'SP-0206': 'Enter a valid delivery time.',
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
