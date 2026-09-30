# UI field mapping

How each input on the page maps to the payload, and what the tester reads when the API rejects
it — for the two push types with a confirmed contract: Auto App Push
(`POST /api/test_notification/auto_app_pushes`, `AP-xxxx` ids) and Normal Push
(`POST /api/test_notification/normal_pushes`, `NP-xxxx` ids, see the Normal Push section below).

> The other 4 push types have no endpoint yet. Their fields are in
> `docs/PUSH-TYPES-FIELD-REFERENCE.md`; their request keys are a guess — see `src/lib/pushTypes.ts`.

The API's own `errors[].message` names payload keys — `link_item is required (AP-0204)` — that do
not exist on the form. So the frontend keys on `error_id` (stable) and shows its own sentence, in
the same tone as the local rules in `src/lib/types.ts`. The API text is only shown for an id this
table does not list. Code: `src/lib/apiMessages.ts` (wording) and `splitErrors` in
`src/lib/api.ts` (which card and input an entry lands on).

## Fields

| UI label                | Where on the page     | Payload key                    | `errors[].field`               | Marked input (`RowField`)                                       |
| ----------------------- | --------------------- | ------------------------------ | ------------------------------ | --------------------------------------------------------------- |
| Delivery date           | Run settings          | `date`                         | `date`                         | — (toast)                                                       |
| Login IDs               | Recipients            | `login_ids[]`                  | `login_ids`                    | — (toast; the panel opens and the page scrolls to it)           |
| Distribute now          | Run settings          | `distribute_now`               | —                              | — (accepted by the API, does nothing until the S3 upload is on) |
| Notifications           | Cards                 | `editions[]`                   | `editions`                     | — (toast)                                                       |
| Delivery time (JST)     | Card                  | `editions[n].publish_hour_min` | `editions[n].publish_hour_min` | `time` (hour + minute)                                          |
| Delivery ID (deliv_id)  | Card                  | `editions[n].deliv_id`         | `editions[n].deliv_id`         | `deliv_id`                                                      |
| Notification text       | Card                  | `editions[n].title`            | `editions[n].title`            | `title`                                                         |
| Where should the tap go | Card (Web/Kogyo/Word) | `editions[n].link_type`        | `editions[n].link_type`        | `kind`                                                          |
| Destination URL         | Card, kind = Web      | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`                                                     |
| Kogyo / bundle code     | Card, kind = Kogyo    | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`                                                     |
| Word ID                 | Card, kind = Word     | `editions[n].link_item`        | `editions[n].link_item`        | `linkValue`                                                     |
| API token               | Review rail           | `X-APIToken` header            | — (HTTP 401)                   | the token field                                                 |

The link field's label comes from `LINKS[kind].label` in `src/lib/types.ts`. `link_type` is
`03` for Web, `01` for Kogyo, `02` for Word.

Every notification goes in the same request as one entry of `editions[]`, in card order, so
`editions[n]` is always card `n + 1` on the page.

## After a 201

The API answers a success with an **empty body**, so nothing on the done screen comes from the
server. `PushConsole` keeps the exact payload it posted and `DoneView` draws the table from it:

| Done screen column | Comes from                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled for      | `date` + `editions[n].publish_hour_min`, shown as JST                                                                                                           |
| Delivery ID        | `editions[n].deliv_id`                                                                                                                                          |
| Notification       | `editions[n].title`                                                                                                                                             |
| Opens              | `editions[n].link_item`; for Kogyo, reduced with `shortShowId` (`9041480001-P0030001P021001` → `904148-0001`) the way the server does before it writes the file |
| Login IDs sent     | `login_ids.length` — what was sent, not who will get it                                                                                                         |

## Normal Push

Contract: `docs/API-DOC-normal-push.md`. There is **no `login_ids`** — sending it is `400 NP-0004`
— so the Recipients area only shows a note. One card is one edition; its shows are sub-panels.

| UI label              | Where on the page | Payload key                              | `errors[].field`                         | Marked input (`RowField`) |
| --------------------- | ----------------- | ---------------------------------------- | ---------------------------------------- | ------------------------- |
| Delivery date         | Run settings      | `date`                                   | `date`                                   | — (toast)                 |
| Distribute now        | Run settings      | `distribute_now`                         | —                                        | —                         |
| Notifications         | Cards             | `editions[]`                             | `editions`                               | — (toast)                 |
| Delivery time (JST)   | Card              | `editions[n].publish_hour_min`           | `editions[n].publish_hour_min`           | `time` (hour + minute)    |
| Shows                 | Card, show list   | `editions[n].shows[]`                    | `editions[n].shows`                      | `shows` (list error)      |
| Show code (code)      | Show `m`          | `editions[n].shows[m].code`              | `editions[n].shows[m].code`              | `shows[m].code`           |
| Word ID (performer_id)| Show `m`          | `editions[n].shows[m].performer_id`      | `editions[n].shows[m].performer_id`      | `shows[m].performer_id`   |
| Type (hook)           | Show `m`          | `editions[n].shows[m].hook`              | `editions[n].shows[m].hook`              | `shows[m].hook`           |

A pasted `[公演]` prefix is dropped from `code` before it is sent. Every show is sent, blank or not,
so `shows[m]` is always show `m + 1` on the card.

After a `201` the API answers `{ editions: [{ id, period_start, period_end, status, topics_count }] }`,
one entry per edition in the order sent. The done screen shows each edition's number, its one-hour
window (`period_start`–`period_end`, read from the `+09:00` string as written) and `topics_count`.

## Where a rejected run lands

Execute is blocked locally first (`errorsFor` in `src/lib/types.ts`); the API is only reached
when the form is clean. Either way the page scrolls to the first problem, top of the view, and
focuses its first red input: the first card with an error, else the Recipients card, else Order's
start time, else the date box. A rejected token (`401`) keeps the review rail open instead, with the
token field red.

## Error messages

`error_id` → what the tester reads. `{label}` is the link field's label for the row's `link_type`.

### Whole request (toast)

| `error_id` | API says                                                             | Shown on UI                                                                                                  |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AP-0001`  | Some of the request parameters are wrong. See errors for each field. | Some values were not accepted.                                                                               |
| `AP-0002`  | The X-APIToken header is missing or wrong.                           | The API token was not accepted. Check it and try again. _(the API token field turns red)_                    |
| `AP-0003`  | body is not valid JSON                                               | Something went wrong. Reload the page and try again.                                                         |
| `AP-0004`  | unknown parameter `<key>`                                            | Something went wrong. Reload the page and try again.                                                         |
| `AP-0006`  | The delivery file could not be uploaded to S3.                       | Could not upload the delivery file. Try again in a moment. _(express only)_                                  |
| `AP-0101`  | date is invalid                                                      | Enter a valid date.                                                                                          |
| `AP-0102`  | login_ids must not be empty                                          | Add at least one login ID. _(the Recipients panel opens and the page scrolls to it)_                         |
| `AP-0103`  | editions must not be empty                                           | Add at least one notification.                                                                               |
| `AP-0104`  | distribute_now must be true or false                                 | distribute_now must be true or false. _(express only — not in the ecs-api contract; only reachable by hand)_ |

### One notification (under the input on its card; the page scrolls to the first such card)

| `error_id` | `field`            | API says                                | Shown on UI                                                        |
| ---------- | ------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| `AP-0201`  | `deliv_id`         | deliv_id is required                    | Enter a delivery ID.                                               |
| `AP-0202`  | `deliv_id`         | deliv_id must be 24 characters or less  | Delivery ID must be 24 characters or fewer.                        |
| `AP-0203`  | `title`            | title is required                       | Enter the notification text.                                       |
| `AP-0204`  | `link_item`        | link_item is required                   | {label} is required. — e.g. _Destination URL is required._         |
| `AP-0205`  | `link_type`        | link_type must be one of 01, 02, 03     | Choose where the link should go.                                   |
| `AP-0206`  | `link_item`        | link_item is not a valid show id        | Enter a valid {label}. — e.g. _Enter a valid Kogyo / bundle code._ |
| `AP-0207`  | `publish_hour_min` | publish_hour_min must be [hour, minute] | Enter a valid delivery time.                                       |
| `AP-0208`  | `publish_hour_min` | publish_hour_min must be within 2 hours | Delivery time must be within 2 hours from now.                     |
| `AP-0209`  | `publish_hour_min` | publish_hour_min must be between …      | Delivery time must be between 08:00 and 22:00 JST.                 |

### Normal Push (`NP-xxxx`)

| `error_id` | `field`                     | Shown on UI                                                                                    |
| ---------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `NP-0001`  | —                           | Some values were not accepted.                                                                 |
| `NP-0002`  | —                           | The API token was not accepted. Check it and try again. _(the API token field turns red)_      |
| `NP-0003`  | —                           | Something went wrong. Reload the page and try again.                                           |
| `NP-0004`  | the unknown key             | Something went wrong. Reload the page and try again.                                           |
| `NP-0005`  | —                           | The server could not create the push. Some notifications may already exist, so ask the backend team before sending again. |
| `NP-0006`  | —                           | The e+ search API did not answer … A full code with a P021… part avoids the search.           |
| `NP-0101`  | `date`                      | Enter a valid date.                                                                            |
| `NP-0103`  | `editions`                  | Add at least one notification.                                                                |
| `NP-0104`  | `distribute_now`            | distribute_now must be true or false. _(express only)_                                        |
| `NP-0201`  | `editions[n].shows`         | Add at least one show.                                                                         |
| `NP-0202`  | `editions[n].shows[m].code` | Enter the show code.                                                                           |
| `NP-0203`  | `editions[n].shows[m].code` | Enter a valid show code, like 9014500001-P0030056. Leave out the [公演] prefix.                |
| `NP-0204`  | `…shows[m].performer_id`    | Word ID must be a whole number above 0, at most 16 digits.                                     |
| `NP-0205`  | `…shows[m].hook`            | Pick preorder or firstcome.                                                                    |
| `NP-0206`  | `publish_hour_min`          | Enter a valid delivery time.                                                                   |
| `NP-0207`  | `publish_hour_min`          | Delivery time must be between 08:00 and 21:00 JST, so the one-hour window ends by 22:00.      |
| `NP-0208`  | `publish_hour_min`          | That hour is already taken by another notification. Pick a different hour.                     |

The Express server answers a bad token and an unreadable body with `AP-0002` / `AP-0003` on every
route (a shared-middleware quirk there), so those two keep their `AP-` wording.

An id not in this table falls back to the API's `message` as-is (it ends with the id, which is
enough for support to look up). `AP-0002` points at the API token field in the review rail, which
the tester fills in; the toast carries the sentence, the field says "The API did not accept this
token." `AP-0003` and `AP-0004` are code problems the tester cannot fix, so they get the same plain
sentence; the technical cause goes to the browser console. A `field` under `editions[n].` that is
not in the table above still shows on card `n`, in its "The API also said" block, so nothing is
dropped.

Our own route handler (`src/app/api/push/[type]/route.ts`) answers in the same envelope,
without an `error_id`, so its `title` / `message` are shown as written:

| `code`            | HTTP | When                                                                          | Shown on UI                                                                                    |
| ----------------- | ---- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NOT_CONFIGURED`  | 500  | `ECS_API_URL` not set in `.env.local`                                         | The tool is not set up yet — Copy .env.example to .env.local and fill it in.                   |
| `NO_TOKEN`        | 401  | No `X-APIToken` on the request (only by hand; the page blocks an empty token) | API token missing — Enter the API token and try again. _(the token field turns red)_           |
| `INVALID_JSON`    | 400  | Our own request body was not JSON                                             | Bad request — The request body is not valid JSON.                                              |
| `API_UNREACHABLE` | 502  | ecs-api did not answer                                                        | Could not reach the API — `<url>` did not answer. Check ECS_API_URL and whether staging is up. |

`express` has no route handler of its own — the browser calls it directly — so `src/lib/api.ts`
synthesizes the same two "can't even ask" cases itself instead of reading them off a response:

| When                                             | Shown on UI                                                                                                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_EXPRESS_API_URL` not set            | The tool is not set up yet — Set NEXT_PUBLIC_EXPRESS_API_URL in .env.local and restart the dev server.                                               |
| `fetch` to express threw (host down, CORS, etc.) | Could not reach this tool's own server — Check that the dev server is still running, then try again. _(same message as ecs-api's `API_UNREACHABLE`)_ |

## Adding a field or an error

1. Payload key → input: a field's `key` is its payload key, and an item field's `RowField` is its
   path (`shows[m].code`); only a top-level key that differs needs `FIELD_BY_PAYLOAD_KEY` in
   `src/lib/api.ts`.
2. Wording: `WORDING_BY_ERROR_ID` in `src/lib/apiMessages.ts`.
3. This file, and the one table in `docs/ERROR-MESSAGES.md`.
