# Error messages

What the API sends for each `error_id`, and what the tester reads instead. Wording lives in
`WORDING_BY_ERROR_ID` (`src/lib/apiMessages.ts`); which input it lands on is `FIELD_BY_PAYLOAD_KEY`
(`src/lib/api.ts`). `{label}` is the link field's label for the card's kind: *Destination URL*
(Web), *Kogyo / bundle code* (Kogyo) or *Word ID* (Word). An id not in this table shows the BE
message as-is. A success (`201`) has no body and no message; the done screen is drawn from the
payload the form sent. Where each error lands on the page is in `docs/UI-FIELD-MAPPING.md`.

| Error id  | Field                          | Label                   | Cause                                   | BE message                                                                 | FE message                                                                 |
| --------- | ------------------------------ | ----------------------- | --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `AP-0001` | —                              | — (toast headline)      | Any bad payload                         | Some of the request parameters are wrong. See errors for each field. (AP-0001) | Some values were not accepted.                                        |
| `AP-0002` | `X-APIToken` header            | API token (review rail) | `X-APIToken` missing or wrong           | The X-APIToken header is missing or wrong. (AP-0002)                       | The API token was not accepted. Check it and try again. *(toast; the field says "The API did not accept this token.")* |
| `AP-0003` | —                              | — (toast)               | Body is not valid JSON                  | request body is not valid JSON (AP-0003)                                   | Something went wrong. Reload the page and try again.                       |
| `AP-0004` | the unknown key                | — (toast)               | A parameter the endpoint does not know  | unknown parameter `<key>` (AP-0004)                                        | Something went wrong. Reload the page and try again.                       |
| `AP-0101` | `date`                         | Delivery date           | `date` not parseable                    | date is invalid (AP-0101)                                                  | Enter a valid date.                                                        |
| `AP-0102` | `login_ids`                    | Login IDs (Recipients)  | `login_ids` missing or empty            | login_ids must not be empty (AP-0102)                                      | Add at least one login ID. *(toast; the Recipients panel opens)*           |
| `AP-0103` | `editions`                     | Notifications           | `editions` missing or empty             | editions must not be empty (AP-0103)                                       | Add at least one notification.                                             |
| `AP-0104` | `distribute_now`               | — (toast)                | `distribute_now` present but not boolean | distribute_now must be true or false (AP-0104)                            | distribute_now must be true or false. *(express only — not in the ecs-api contract)* |
| `AP-0201` | `editions[n].deliv_id`         | Delivery ID             | Blank `deliv_id`                        | deliv_id is required (AP-0201)                                             | Enter a delivery ID.                                                       |
| `AP-0202` | `editions[n].deliv_id`         | Delivery ID             | Longer than 24 characters               | deliv_id must be 24 characters or less (AP-0202)                           | Delivery ID must be 24 characters or fewer.                                |
| `AP-0203` | `editions[n].title`            | Notification text       | Blank `title`                           | title is required (AP-0203)                                                | Enter the notification text.                                               |
| `AP-0204` | `editions[n].link_item`        | {label}                 | Blank `link_item`                       | link_item is required (AP-0204)                                            | {label} is required.                                                       |
| `AP-0205` | `editions[n].link_type`        | Where should the tap go? | Not `01`, `02` or `03`                 | link_type must be one of 01, 02, 03 (AP-0205)                              | Choose where the link should go.                                           |
| `AP-0206` | `editions[n].link_item`        | {label}                 | `link_type: "01"` with a non-show-id    | link_item is not a valid show id (AP-0206)                                 | Enter a valid {label}.                                                     |
| `AP-0207` | `editions[n].publish_hour_min` | Delivery time (JST)     | Malformed or out-of-range pair          | publish_hour_min must be [hour, minute] (AP-0207)                          | Enter a valid delivery time.                                               |
| `AP-0208` | `editions[n].publish_hour_min` | Delivery time (JST)     | More than 2 hours ahead                 | publish_hour_min must be within 2 hours from now (AP-0208)                 | Delivery time must be within 2 hours from now.                             |
| `AP-0209` | `editions[n].publish_hour_min` | Delivery time (JST)     | Outside 08:00–22:00                     | publish_hour_min must be between 08:00 and 22:00 (AP-0209)                 | Delivery time must be between 08:00 and 22:00 JST.                         |

Our own route handler answers in the same envelope but without an `error_id`, so its `title` and
`message` show as written:

| Code              | HTTP | Field / label            | Cause                                      | FE message                                                                          |
| ----------------- | ---- | ------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `NOT_CONFIGURED`  | 500  | — (toast)                | `ECS_API_URL` missing from `.env.local`    | The tool is not set up yet — Copy .env.example to .env.local and fill it in.        |
| `NO_TOKEN`        | 401  | API token (review rail)  | Request sent with no `X-APIToken` (by hand) | API token missing — Enter the API token and try again.                             |
| `INVALID_JSON`    | 400  | — (toast)                | Our request body was not JSON              | Bad request — The request body is not valid JSON.                                   |
| `API_UNREACHABLE` | 502  | — (toast)                | ecs-api did not answer                     | Could not reach the API — `<url>` did not answer. Check ECS_API_URL and whether staging is up. |

`express` has no route handler — the browser calls it directly — so `src/lib/api.ts` synthesizes
its own "can't even ask" messages instead of reading a `code` off a response:

| When                                             | FE message                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_EXPRESS_API_URL` not set              | The tool is not set up yet — Set NEXT_PUBLIC_EXPRESS_API_URL in .env.local and restart the dev server. |
| `fetch` to express threw                           | Could not reach the express API — Check NEXT_PUBLIC_EXPRESS_API_URL and whether the express service is running. |
