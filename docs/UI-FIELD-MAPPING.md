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
| Login IDs               | Recipients         | `login_ids[]`                  | `login_ids`                    | — (toast; the panel opens and the page scrolls to it) |
| Distribute now          | Run settings       | `distribute_now`               | —                              | — (accepted by the API, does nothing until the S3 upload is on) |
| Notifications           | Cards              | `editions[]`                   | `editions`                     | — (toast)                 |
| Delivery time (JST)     | Card               | `editions[n].publish_hour_min` | `editions[n].publish_hour_min` | `time` (hour + minute)    |
| Delivery ID (deliv_id)  | Card               | `editions[n].deliv_id`         | `editions[n].deliv_id`         | `delivId`                 |
| Notification text       | Card               | `editions[n].title`            | `editions[n].title`            | `title`                   |
| Where should the tap go | Card (Web/Kogyo/Word) | `editions[n].link_type`     | `editions[n].link_type`        | `kind`                    |
| Destination URL         | Card, kind = Web   | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`               |
| Kogyo / bundle code     | Card, kind = Kogyo | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`               |
| Word ID                 | Card, kind = Word  | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`               |
| API token               | Review rail        | `X-APIToken` header            | — (HTTP 401)                   | the token field           |

The link field's label comes from `LINKS[kind].label` in `src/lib/types.ts`. `link_type` is
`03` for Web, `01` for Kogyo, `02` for Word.

Every notification goes in the same request as one entry of `editions[]`, in card order, so
`editions[n]` is always card `n + 1` on the page.

## After a 201

The API answers a success with an **empty body**, so nothing on the done screen comes from the
server. `PushConsole` keeps the exact payload it posted and `DoneView` draws the table from it:

| Done screen column | Comes from                                               |
| ------------------ | -------------------------------------------------------- |
| Scheduled for      | `date` + `editions[n].publish_hour_min`, shown as JST    |
| Delivery ID        | `editions[n].deliv_id`                                   |
| Notification       | `editions[n].title`                                      |
| Opens              | `editions[n].link_item`; for Kogyo, reduced with `shortShowId` (`9041480001-P0030001P021001` → `904148-0001`) the way the server does before it writes the file |
| Login IDs sent     | `login_ids.length` — what was sent, not who will get it  |

## Where a rejected run lands

Execute is blocked locally first (`errorsFor` in `src/lib/types.ts`); the API is only reached
when the form is clean. Either way the page scrolls to the first problem, top of the view, and
focuses its first red input: the first card with an error, else the Recipients card, else the
date box. A rejected token (`401`) keeps the review rail open instead, with the token field red.

## Error messages

`error_id` → what the tester reads. `{label}` is the link field's label for the row's `link_type`.

### Whole request (toast)

| `error_id` | API says                                                                | Shown on UI                                                                |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `AP-0001`  | Some of the request parameters are wrong. See errors for each field.    | Some values were not accepted.                                             |
| `AP-0002`  | The X-APIToken header is missing or wrong.                              | The API token was not accepted. Check it and try again. *(the API token field turns red)* |
| `AP-0003`  | body is not valid JSON                                                  | Something went wrong. Reload the page and try again.                       |
| `AP-0004`  | unknown parameter `<key>`                                               | Something went wrong. Reload the page and try again.                       |
| `AP-0006`  | The delivery file could not be uploaded to S3.                          | Could not upload the delivery file. Try again in a moment. *(express only)* |
| `AP-0101`  | date is invalid                                                         | Enter a valid date.                                                        |
| `AP-0102`  | login_ids must not be empty                                             | Add at least one login ID. *(the Recipients panel opens and the page scrolls to it)* |
| `AP-0103`  | editions must not be empty                                              | Add at least one notification.                                             |
| `AP-0104`  | distribute_now must be true or false                                    | distribute_now must be true or false. *(express only — not in the ecs-api contract; only reachable by hand)* |

### One notification (under the input on its card; the page scrolls to the first such card)

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
enough for support to look up). `AP-0002` points at the API token field in the review rail, which
the tester fills in; the toast carries the sentence, the field says "The API did not accept this
token." `AP-0003` and `AP-0004` are code problems the tester cannot fix, so they get the same plain
sentence; the technical cause goes to the browser console. A `field` under `editions[n].` that is
not in the table above still shows on card `n`, in its "The API also said" block, so nothing is
dropped.

Our own route handler (`src/app/api/push/auto-app-push/route.ts`) answers in the same envelope,
without an `error_id`, so its `title` / `message` are shown as written:

| `code`            | HTTP | When                                   | Shown on UI                                                    |
| ----------------- | ---- | -------------------------------------- | -------------------------------------------------------------- |
| `NOT_CONFIGURED`  | 500  | `ECS_API_URL` not set in `.env.local`  | The tool is not set up yet — Copy .env.example to .env.local and fill it in. |
| `NO_TOKEN`        | 401  | No `X-APIToken` on the request (only by hand; the page blocks an empty token) | API token missing — Enter the API token and try again. *(the token field turns red)* |
| `INVALID_JSON`    | 400  | Our own request body was not JSON      | Bad request — The request body is not valid JSON.              |
| `API_UNREACHABLE` | 502  | ecs-api did not answer                 | Could not reach the API — `<url>` did not answer. Check ECS_API_URL and whether staging is up. |

`express` has no route handler of its own — the browser calls it directly — so `src/lib/api.ts`
synthesizes the same two "can't even ask" cases itself instead of reading them off a response:

| When                                              | Shown on UI                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_EXPRESS_API_URL` not set              | The tool is not set up yet — Set NEXT_PUBLIC_EXPRESS_API_URL in .env.local and restart the dev server. |
| `fetch` to express threw (host down, CORS, etc.)   | Could not reach this tool's own server — Check that the dev server is still running, then try again. *(same message as ecs-api's `API_UNREACHABLE`)* |

## Adding a field or an error

1. Payload key → input: `FIELD_BY_PAYLOAD_KEY` in `src/lib/api.ts`.
2. Wording: `WORDING_BY_ERROR_ID` in `src/lib/apiMessages.ts`.
3. This file, and the one table in `docs/ERROR-MESSAGES.md`.
