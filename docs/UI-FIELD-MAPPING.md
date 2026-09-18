# UI field mapping

How each input on the page maps to the payload sent to `POST /api/test_notification/auto_app_pushes`,
and what the tester reads when the API rejects it.

The API's own `errors[].message` names payload keys — `link_item is required (AP-0204)` — that do
not exist on the form. So the frontend keys on `error_id` (stable) and shows its own sentence, in
the same tone as the local rules in `src/lib/types.ts`. The API text is only shown for an id this
table does not list. Code: `src/lib/apiMessages.ts` (wording) and `splitErrors` in
`src/lib/api.ts` (which card and input an entry lands on).

## Fields

| UI label                | Where on the page  | Payload key                    | `errors[].field`               | Marked input (`RowField`) |
| ----------------------- | ------------------ | ------------------------------ | ------------------------------ | ------------------------- |
| Delivery date           | Run settings       | `date`                         | `date`                         | — (toast)                 |
| Login IDs               | Recipients         | `login_ids[]`                  | `login_ids`                    | — (toast, opens panel)    |
| Distribute now          | Run settings       | `distribute_now`               | —                              | —                         |
| Notifications           | Cards              | `editions[]`                   | `editions`                     | — (toast)                 |
| Delivery time (JST)     | Card               | `editions[n].publish_hour_min` | `editions[n].publish_hour_min` | `time` (hour + minute)    |
| Delivery ID (deliv_id)  | Card               | `editions[n].deliv_id`         | `editions[n].deliv_id`         | `delivId`                 |
| Notification text       | Card               | `editions[n].title`            | `editions[n].title`            | `title`                   |
| Where should the tap go | Card (Web/Kogyo/Word) | `editions[n].link_type`     | `editions[n].link_type`        | `kind`                    |
| Destination URL         | Card, kind = Web   | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`               |
| Kogyo / bundle code     | Card, kind = Kogyo | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`               |
| Word ID                 | Card, kind = Word  | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`               |

The link field's label comes from `LINKS[kind].label` in `src/lib/types.ts`. `link_type` is
`03` for Web, `01` for Kogyo, `02` for Word.

## Error messages

`error_id` → what the tester reads. `{label}` is the link field's label for the row's `link_type`.

### Whole request (toast)

| `error_id` | API says                                                                | Shown on UI                                                                |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `AP-0001`  | Some of the request parameters are wrong. See errors for each field.    | Some values were not accepted.                                             |
| `AP-0002`  | The X-APIToken header is missing or wrong.                              | Something went wrong. Please try again later or contact the administrator. |
| `AP-0003`  | body is not valid JSON                                                  | Something went wrong. Reload the page and try again.                       |
| `AP-0004`  | unknown parameter `<key>`                                               | Something went wrong. Reload the page and try again.                       |
| `AP-0101`  | date is invalid                                                         | Enter a valid date.                                                        |
| `AP-0102`  | login_ids must not be empty                                             | Add at least one login ID. *(the Recipients panel opens)*                  |
| `AP-0103`  | editions must not be empty                                              | Add at least one notification.                                             |

### One notification (under the input on its card)

| `error_id` | `field`            | API says                                   | Shown on UI                                                            |
| ---------- | ------------------ | ------------------------------------------ | ---------------------------------------------------------------------- |
| `AP-0201`  | `deliv_id`         | deliv_id is required                       | Enter a delivery ID.                                                   |
| `AP-0202`  | `deliv_id`         | deliv_id must be 24 characters or less     | Delivery ID must be 24 characters or fewer.                            |
| `AP-0203`  | `title`            | title is required                          | Enter the notification text.                                           |
| `AP-0204`  | `link_item`        | link_item is required                      | {label} is required. — e.g. *Destination URL is required.*             |
| `AP-0205`  | `link_type`        | link_type must be one of 01, 02, 03        | Choose where the link should go.                                       |
| `AP-0206`  | `link_item`        | link_item is not a valid show id           | Enter a valid {label}. — e.g. *Enter a valid Kogyo / bundle code.*     |
| `AP-0207`  | `publish_hour_min` | publish_hour_min must be [hour, minute]    | Enter a valid delivery time.                                           |
| `AP-0208`  | `publish_hour_min` | publish_hour_min must be within 2 hours    | Delivery time must be within 2 hours from now.                         |
| `AP-0209`  | `publish_hour_min` | publish_hour_min must be between …         | Delivery time must be between 08:00 and 22:00 JST.                     |

An id not in this table falls back to the API's `message` as-is (it ends with the id, which is
enough for support to look up). `AP-0002`–`AP-0004` are setup or code problems the tester cannot
fix, so they all get the same plain sentence; the technical cause goes to the browser console. A `field` under `editions[n].` that is not in the table above
still shows on card `n`, in its "The API also said" block, so nothing is dropped.

## Adding a field or an error

1. Payload key → input: `FIELD_BY_PAYLOAD_KEY` in `src/lib/api.ts`.
2. Wording: `WORDING_BY_ERROR_ID` in `src/lib/apiMessages.ts`.
3. This file.
