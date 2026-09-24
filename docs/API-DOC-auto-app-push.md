# Auto App Push Notification API

API reference for the push notification test tool. Hand-off document for the frontend team.

- **Repo:** `est-rouge/ecs-api`
- **Branch:** `feature/create_api_for_auto_app_push_notification`
- **Environment:** staging only

> ### ⚠️ A `201` does not mean a push was sent
>
> The endpoint validates the payload and **writes the CSV delivery file** — but the upload of
> that file to S3 is still switched off server-side. Nothing is imported and no push is ever
> delivered. A valid request answers `201 Created` with an **empty body**.
>
> Turning the upload back on is a one-line change in `lib/push_test/common.rb` and **does not
> change this contract**: still `201`, still no body. So build the form against what is written
> here now — nothing about it changes when delivery goes live.
>
> `TEST_NOTIFICATION_API_TOKEN` also still needs to be added to SSM at `/epica/stg/api` before
> the endpoint can answer anything but `401` on staging.

---

## Endpoint

```
POST /api/test_notification/auto_app_pushes
```

|                  |                                                 |
| ---------------- | ----------------------------------------------- |
| **Auth**         | `X-APIToken: <token>` header — a shared secret  |
| **Content-Type** | `application/json`                              |
| **Timezone**     | All times are `Asia/Tokyo`                      |
| **Availability** | Staging and below. Returns `404` on production. |

This is the only endpoint. There is no separate "setup" call — the common settings (`date`,
`login_ids`) are sent in this same request body.

---

## ⚠️ Call this from the server, not the browser

The token is a shared secret and this path is **not** in the API's CORS allowlist. A client-side
`fetch` would both leak the token into the JS bundle and fail the CORS preflight.

Route the form submit through a Next.js **route handler**:

```ts
// app/api/push/auto-app-push/route.ts
export async function POST(req: Request) {
  const res = await fetch(
    `${process.env.ECS_API_URL}/api/test_notification/auto_app_pushes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-APIToken": process.env.TEST_NOTIFICATION_API_TOKEN!,
      },
      body: JSON.stringify(await req.json()),
    },
  );

  // 201 (success) and 404 (disabled) both have empty bodies —
  // calling res.json() on either will throw.
  if (res.status === 201 || res.status === 404) {
    return new Response(null, { status: res.status });
  }

  // Everything else is an error envelope.
  return Response.json(await res.json(), { status: res.status });
}
```

**Only failures carry a body.** The success path returns nothing, so branch on the status code,
never on the parsed body.

The env var must **not** be prefixed `NEXT_PUBLIC_` — that would inline the token into the
client bundle.

---

## Request body

| Field            | Type       | Required | Notes                                                                                                                                                                                |
| ---------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `date`           | `string`   | No       | `YYYY-MM-DD`. Defaults to today when omitted.                                                                                                                                        |
| `login_ids`      | `string[]` | **Yes**  | Who receives the push. Must not be empty. Send as strings — leading zeros matter.                                                                                                    |
| `editions`       | `object[]` | **Yes**  | One entry per notification. Must not be empty.                                                                                                                                       |
| `distribute_now` | `boolean`  | No       | Default `false`. Still accepted, but **currently does nothing** — the worker it triggers has nothing to import while the S3 upload is off. See [Stage 1](#what-happens-after-a-201). |

### Each entry in `editions`

| Field              | Type         | Required | Notes                                                                                                |
| ------------------ | ------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `publish_hour_min` | `[int, int]` | **Yes**  | `[hour, minute]`. Combines with `date` to form the delivery time. See [timing rules](#timing-rules). |
| `deliv_id`         | `string`     | **Yes**  | Max 24 characters. Must be unique per test — a repeat is treated as the same delivery.               |
| `title`            | `string`     | **Yes**  | The notification body text. Japanese is fine (UTF-8).                                                |
| `link_type`        | `string`     | **Yes**  | `"01"`, `"02"` or `"03"` — quoted strings, not numbers.                                              |
| `link_item`        | `string`     | **Yes**  | Meaning depends on `link_type`. See below.                                                           |

### `link_item` by `link_type`

| `link_type` | Destination                    | `link_item` example          |
| ----------- | ------------------------------ | ---------------------------- |
| `"01"`      | 公演 — a show page             | `9041480001-P0030001P021001` |
| `"02"`      | ワード — a keyword / performer | `23542`                      |
| `"03"`      | WEB — an external URL          | `https://eplus.jp/`          |

For `link_type: "01"` the value must be a valid show id, or the request is rejected. The server
reduces it to `904148-0001` internally.

### Timing rules

Both are enforced server-side and return `422`. **Mirror them in the form** so the tester
doesn't need a round trip to find out.

| Rule                                        | Why                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| No more than **2 hours ahead** of now       | The delivery pipeline only imports files inside that window. A later time would be silently ignored. |
| Between **08:00 and 22:00** on the same day | Same import filter. Outside those hours the file is never picked up.                                 |

### Example request

```http
POST /api/test_notification/auto_app_pushes
Content-Type: application/json
X-APIToken: <token>
```

```json
{
  "date": "2026-01-21",
  "login_ids": ["502001185", "602028303"],
  "editions": [
    {
      "publish_hour_min": [15, 30],
      "deliv_id": "H020064377",
      "title": "イープラスのWEBページへ遷移します。",
      "link_type": "03",
      "link_item": "https://eplus.jp/"
    }
  ],
  "distribute_now": false
}
```

---

## Responses

**Success has no body. Only failures do.**

|                 | Shape                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Success (`201`) | _empty_ — zero bytes                                                       |
| Failure         | `{ "error": { "error_id", "code", "title", "message", "errors": [ … ] } }` |

The failure envelope is the one from the **[EMO] API Specification Summary** sheet, so error
handling is identical to the rest of the EMO APIs. All keys are `snake_case`.

**`201` and `404` have no body at all.** Calling `res.json()` on either will throw — branch on
the status code first.

### `201 Created` — accepted

```http
HTTP/1.1 201 Created
Content-Length: 0
```

That is the whole response. There is deliberately nothing to read:

- The endpoint creates a **file**, not a database record, so there is no id to hand back.
- Everything else you might want to echo — the times, the titles, the ids — is what you just
  sent. Render the confirmation from your own form state.

One consequence worth planning for: the server reduces a `link_type: "01"` show id internally
(`9041480001-P0030001P021001` → `904148-0001`) and **no longer reports that back**. If the
tester needs to see the reduced value, compute it client-side (first 6 digits, `-`, then the 4
digits after `P003`) or ask a backend engineer to read the generated CSV on the server at
`tmp/push_test/<YYYYMMDD>/app_push/`.

### `422 Unprocessable Entity` — validation failed

**Every** problem in the payload is reported at once, one entry per field, not just the first.

```json
{
  "error": {
    "error_id": "AP-0001",
    "code": "INVALID_PARAMETER",
    "title": "Invalid parameter",
    "message": "Some of the request parameters are wrong. See errors for each field. (AP-0001)",
    "errors": [
      {
        "error_id": "AP-0201",
        "field": "editions[0].deliv_id",
        "title": "Invalid parameter",
        "message": "deliv_id is required (AP-0201)"
      },
      {
        "error_id": "AP-0205",
        "field": "editions[0].link_type",
        "title": "Invalid parameter",
        "message": "link_type must be one of 01, 02, 03 (AP-0205)"
      }
    ]
  }
}
```

| Field                     | Notes                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `error.error_id`          | Identifies the failure as a whole. `AP-0001` for any bad payload.                                                     |
| `error.code`              | Machine-readable: `INVALID_PARAMETER` or `UNAUTHORIZED`.                                                              |
| `error.message`           | Summary for a toast/banner. Ends with its own `error_id` in brackets.                                                 |
| `error.errors[].field`    | Dotted path of the offending field — `date`, `login_ids`, `editions[0].deliv_id`. Map straight onto the form control. |
| `error.errors[].error_id` | **Key off this, not the message text.** Ids are stable; wording is not.                                               |
| `error.errors[].message`  | Plain-English fallback for display, with the id appended.                                                             |

Full list of field errors:

| `error_id` | `field`                        | Cause                                                    |
| ---------- | ------------------------------ | -------------------------------------------------------- |
| `AP-0101`  | `date`                         | `date` not parseable                                     |
| `AP-0102`  | `login_ids`                    | `login_ids` missing or `[]`                              |
| `AP-0103`  | `editions`                     | `editions` missing or `[]`                               |
| `AP-0201`  | `editions[n].deliv_id`         | blank `deliv_id`                                         |
| `AP-0202`  | `editions[n].deliv_id`         | longer than 24 characters                                |
| `AP-0203`  | `editions[n].title`            | blank `title`                                            |
| `AP-0204`  | `editions[n].link_item`        | blank `link_item`                                        |
| `AP-0205`  | `editions[n].link_type`        | not `01`, `02` or `03`                                   |
| `AP-0206`  | `editions[n].link_item`        | `link_type: "01"` with a non-show-id                     |
| `AP-0207`  | `editions[n].publish_hour_min` | malformed or out-of-range pair                           |
| `AP-0208`  | `editions[n].publish_hour_min` | more than 2h ahead                                       |
| `AP-0209`  | `editions[n].publish_hour_min` | outside 08:00–22:00. The message names the exact window. |

When `date` is unusable (`AP-0101`) the editions are **not** checked, so that one error can
arrive on its own. Fix it and resubmit to see the rest.

### `400 Bad Request` — the body itself is wrong

Same envelope, but the request never got as far as validation.

| `error_id` | `field` | Cause                                                                                                           |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `AP-0003`  | `null`  | The body is not valid JSON                                                                                      |
| `AP-0004`  | the key | A parameter this endpoint does not know. Send only the documented keys — an extra one is rejected, not ignored. |

### `401 Unauthorized`

Missing, wrong, or unconfigured `X-APIToken`. **This now returns a body**, unlike the earlier
version of this document:

```json
{
  "error": {
    "error_id": "AP-0002",
    "code": "UNAUTHORIZED",
    "title": "Unauthorized",
    "message": "The X-APIToken header is missing or wrong. (AP-0002)",
    "errors": []
  }
}
```

If this fires for every request after deploy, the token is most likely absent from SSM rather
than wrong in your environment.

### `404 Not Found`

**Empty body**, like the `201`. The endpoint is disabled on production by design, and answers
with nothing at all so it cannot be told apart from a route that does not exist. Seeing this on
staging means the deploy has not landed yet.

### `500 Internal Server Error`

The payload was fine but writing the delivery file failed — a full or unwritable disk on the
server. Same envelope as every other error:

```json
{
  "error": {
    "error_id": "AP-0005",
    "code": "INTERNAL_ERROR",
    "title": "Internal error",
    "message": "The request was valid but the push could not be created. (AP-0005)",
    "errors": []
  }
}
```

Nothing the tester can fix — surface it as "server error, contact the backend team" and do not
retry automatically.

---

## What happens after a `201`

**Today: nothing.** The delivery file is written on the server but the upload to S3 is switched
off, so none of the stages below ever start. No push will arrive, however long you wait.

Once the upload is switched back on, a `201` means **a file reached S3** — nothing more.
Delivery then runs through four asynchronous stages after the request has already returned.

| #   | Stage               | When                          | What                                                                                                                                                                                     |
| --- | ------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pickup              | Every 10 min, 06:00–22:50 JST | A scheduled worker scans S3 and imports files due within 2 hours and inside 08:00–22:00. Until a tick runs, nothing has happened. `distribute_now: true` would trigger this immediately. |
| 2   | Edition created     | Seconds after pickup          | The file is parsed and a delivery record is stored.                                                                                                                                      |
| 3   | Recipients resolved | Seconds later                 | Each login_id is matched to a user who is an active customer **and** has `push_score_weekly` enabled. Anyone failing either check is dropped here.                                       |
| 4   | Push sent           | At the requested time         | Notifications are batched and delivered. If pickup ran late, delivery slips past the requested time rather than being skipped.                                                           |

---

## Things that will bite

### A `201` does not mean the push was sent

It means the delivery file was written. It is not a send — and right now it is not even a
scheduling, because the upload to S3 is off and nothing downstream ever runs.

Word the success state as **scheduled**, not sent — 「配信予約しました」rather than
「送信しました」. Otherwise the tester will report a bug when nothing arrives for ten minutes.
While the upload is still off, consider saying so explicitly in the success copy.

### There is no way to confirm anything from the response

The `201` is empty, so the API gives you no id, no filename, and no server-side echo of what it
understood. If something looks wrong, the only way to check is for a backend engineer to read
the generated CSV on the server. Keep a local record of what was submitted.

### login_ids are filtered later, silently

An id whose user has `push_score_weekly` turned off — or who is excluded, or not a customer —
is discarded at stage 3 with **no error anywhere**: not in the response, not in the logs.

This is the most likely cause of _"I submitted but received nothing"_, and this API cannot warn
about it. If the tool needs to answer this up front, it needs a separate lookup endpoint —
worth raising now rather than after launch.

### Reusing a `deliv_id` is treated as the same delivery

Resending requires a new `deliv_id` **and** a new time. Consider generating or incrementing it
in the form rather than making the tester retype it. A repeat also overwrites the previous
delivery file on the server, silently and with a `201`.

### Only one tester at a time

The server keeps `date` and `login_ids` in process-level state while it builds the files. Two
submissions landing in the same second can mix each other's values. Not something the form can
guard against — just do not run a second tester in parallel.

### Extra keys are rejected, not ignored

A parameter the endpoint does not know is a `400` (`AP-0004`), not a silent drop. Send exactly
the documented keys — no `id`, no UI-only fields, no leftovers from the form state.

---

## Form checklist

Things the UI should do, derived from the above:

- [ ] Date picker defaulting to today
- [ ] `login_ids` list editor (strings, at least one)
- [ ] Per-edition fields: time, `deliv_id`, `title`, `link_type` select, `link_item`
- [ ] `link_item` label and placeholder change with the selected `link_type`
- [ ] Time picker constrained to 08:00–22:00 and ≤ 2 hours ahead
- [ ] Optional `distribute_now` toggle ("配信を今すぐ実行") — note it currently does nothing
- [ ] Remember the last-used `login_ids` and settings between submissions
- [ ] Map `error.errors[].field` back onto the matching form control, keyed by `error_id`
- [ ] Show `error.message` as the banner and `errors[].message` per field
- [ ] Send only the documented keys — an unknown one is a `400`
- [ ] **Branch on the status code, never on a parsed body** — `201` and `404` have none
- [ ] Treat `201` as success without reading a response; render the confirmation from the
      submitted form state, not from the server
- [ ] Success copy says _scheduled_, showing the time you submitted
- [ ] Keep a local history of submissions — the API cannot tell you what it received

---

## Contacts / source of truth

|                                               |                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Controller, error envelope **and validation** | `app/controllers/epica/api/test_notification/auto_app_pushes_controller.rb` — `VALIDATION_ERRORS` is the catalog above |
| File writing, and the commented-out S3 upload | `lib/push_test/common.rb` — `create_auto_app_push_edition`                                                             |
| Route                                         | `config/routes.rb` — `namespace :test_notification`                                                                    |
| Spec                                          | `spec/requests/epica/api/test_notification/auto_app_pushes_spec.rb`                                                    |

> `lib/push_test/auto_app_push.rb`, referenced by earlier versions of this document, has been
> removed. It duplicated `PushTest::Common`; the endpoint now calls that shared module directly
> and holds the validation rules itself.
