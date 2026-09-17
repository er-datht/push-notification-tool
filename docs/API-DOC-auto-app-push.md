# Auto App Push Notification API

API reference for the push notification test tool. Hand-off document for the frontend team.

- **Repo:** `est-rouge/ecs-api`
- **Branch:** `feature/create_api_for_auto_app_push_notification`
- **Environment:** staging only

> ### ⚠️ Validation only for now
>
> The endpoint currently **checks the payload and nothing else** — it does not write the CSV to
> S3 and no push is ever sent. That is why a valid request answers `200`, not `201`: nothing was
> created. The delivery code is written and commented out in the controller, and turning it back
> on only changes `data.status` (`validated` → `created`), `data.editions[].filename`
> (`null` → the real name) and the status code (`200` → `201`).
>
> Build the form against this contract now; it does not change when delivery is switched on.
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

  // 404 has no body — do not call res.json() on it
  if (res.status === 404) {
    return new Response(null, { status: res.status });
  }

  return Response.json(await res.json(), { status: res.status });
}
```

The env var must **not** be prefixed `NEXT_PUBLIC_` — that would inline the token into the
client bundle.

---

## Request body

| Field            | Type       | Required | Notes                                                                                                    |
| ---------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `date`           | `string`   | No       | `YYYY-MM-DD`. Defaults to today when omitted.                                                            |
| `login_ids`      | `string[]` | **Yes**  | Who receives the push. Must not be empty. Send as strings — leading zeros matter.                        |
| `editions`       | `object[]` | **Yes**  | One entry per notification. Must not be empty.                                                           |
| `distribute_now` | `boolean`  | No       | Default `false`. Skips the wait for the next 10-minute tick. See [Stage 1](#what-happens-after-the-201). |

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

Every body follows the common envelope of the **[EMO] API Specification Summary** sheet, so this
endpoint parses the same way as the rest of the EMO APIs:

|         | Shape                                                                      |
| ------- | -------------------------------------------------------------------------- |
| Success | `{ "status_code": "200", "message": "OK", "data": { … } }`                 |
| Failure | `{ "error": { "error_id", "code", "title", "message", "errors": [ … ] } }` |

`status_code` is a **string** and always matches the HTTP status. All keys are `snake_case` and
all datetimes are ISO 8601.

**`404` is the one exception — it has no body at all.** Calling `res.json()` on it will throw.

### `200 OK` — payload accepted

```json
{
  "status_code": "200",
  "message": "OK",
  "data": {
    "status": "validated",
    "date": "2026-01-21",
    "login_ids_count": 2,
    "editions": [
      {
        "deliv_id": "H020064377",
        "title": "イープラスのWEBページへ遷移します。",
        "link_type": "03",
        "link_item": "https://eplus.jp/",
        "will_publish_at": "2026-01-21T15:30:00+09:00",
        "filename": null
      }
    ],
    "distributed": false
  }
}
```

| Field                             | Notes                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data.status`                     | `validated` while delivery is off, `created` once it is on.                                                                                            |
| `data.date`                       | The date the times are anchored to — today when you omitted it.                                                                                        |
| `data.login_ids_count`            | How many ids you **sent** — not how many people will receive it. See [caveats](#things-that-will-bite).                                                |
| `data.editions[]`                 | One object per edition, in the order sent.                                                                                                             |
| `data.editions[].link_item`       | The **cleaned-up** value: a `link_type: "01"` show id comes back shortened to `904148-0001`. Echo this back to the tester rather than what they typed. |
| `data.editions[].will_publish_at` | ISO 8601 with the `+09:00` offset.                                                                                                                     |
| `data.editions[].filename`        | `null` today. The delivery file written to S3 once delivery is on.                                                                                     |
| `data.distributed`                | Whether `distribute_now` was honoured.                                                                                                                 |

### `201 Created` — once delivery is switched on

Identical body, with `status_code` `"201"`, `data.status` `"created"` and a real
`data.editions[].filename`. Treat `200` and `201` the same way in the UI.

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

**Empty body — the only response without one.** The endpoint is disabled on production by
design, and answers with nothing at all so it cannot be told apart from a route that does not
exist. Seeing this on staging means the deploy has not landed yet.

---

## What happens after a `data.status` of `created`

Nothing yet, while the endpoint is validation-only — a `validated` response means the payload
was accepted and no file was written.

Once delivery is switched on, a `created` response means **a file reached S3** — nothing more.
Delivery then runs through four asynchronous stages after the request has already returned.

| #   | Stage               | When                          | What                                                                                                                                                                                |
| --- | ------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pickup              | Every 10 min, 06:00–22:50 JST | A scheduled worker scans S3 and imports files due within 2 hours and inside 08:00–22:00. Until a tick runs, nothing has happened. `distribute_now: true` triggers this immediately. |
| 2   | Edition created     | Seconds after pickup          | The file is parsed and a delivery record is stored.                                                                                                                                 |
| 3   | Recipients resolved | Seconds later                 | Each login_id is matched to a user who is an active customer **and** has `push_score_weekly` enabled. Anyone failing either check is dropped here.                                  |
| 4   | Push sent           | At the requested time         | Notifications are batched and delivered. If pickup ran late, delivery slips past the requested time rather than being skipped.                                                      |

---

## Things that will bite

### A success response does not mean the push was sent

Today it means the payload passed validation; once delivery is on it means the file was
accepted. Neither is a send. Word the success state as **scheduled**, not sent —
「配信予約しました」rather than「送信しました」. Otherwise the tester will report a bug when
nothing arrives for ten minutes.

`data.status` is the honest signal: `validated` = checked only, `created` = file on S3.

### login_ids are filtered later, silently

An id whose user has `push_score_weekly` turned off — or who is excluded, or not a customer —
is discarded at stage 3 with **no error anywhere**: not in the response, not in the logs.

This is the most likely cause of _"I submitted but received nothing"_, and this API cannot warn
about it. If the tool needs to answer this up front, it needs a separate lookup endpoint —
worth raising now rather than after launch.

### Reusing a `deliv_id` is treated as the same delivery

Resending requires a new `deliv_id` **and** a new time. Consider generating or incrementing it
in the form rather than making the tester retype it.

### `login_ids_count` is not a recipient count

It echoes the length of the array you sent. See above.

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
- [ ] Optional `distribute_now` toggle ("配信を今すぐ実行")
- [ ] Remember the last-used `login_ids` and settings between submissions
- [ ] Map `error.errors[].field` back onto the matching form control, keyed by `error_id`
- [ ] Show `error.message` as the banner and `errors[].message` per field
- [ ] Send only the documented keys — an unknown one is a `400`
- [ ] Handle `404` without parsing a body (every other status has one)
- [ ] Read the resource from `data`, not from the top level
- [ ] Success copy says _scheduled_, showing `data.editions[].will_publish_at`

---

## Contacts / source of truth

|                                      |                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Controller & response envelope       | `app/controllers/epica/api/test_notification/auto_app_pushes_controller.rb` |
| Validation, error ids & file writing | `lib/push_test/auto_app_push.rb` — `VALIDATION_ERRORS` is the catalog above |
| Route                                | `config/routes.rb` — `namespace :test_notification`                         |
| Spec                                 | `spec/requests/epica/api/test_notification/auto_app_pushes_spec.rb`         |
