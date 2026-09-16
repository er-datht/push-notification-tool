# Auto App Push Notification API

API reference for the push notification test tool. Hand-off document for the frontend team.

- **Repo:** `est-rouge/ecs-api`
- **Branch:** `feature/implement-push-notification-tool`
- **Environment:** staging only

> ### ⚠️ Not deployed yet
>
> The endpoint is written but **uncommitted, untested, and not on staging**.
> `TEST_NOTIFICATION_API_TOKEN` also still needs to be added to SSM at `/epica/stg/api`.
>
> You can build against this contract now, but integration testing has to wait for the staging
> deploy. This banner will be removed once it is live.

---

## Endpoint

```
POST /api/test_notification/auto_app_pushes
```

| | |
|---|---|
| **Auth** | `X-APIToken: <token>` header — a shared secret |
| **Content-Type** | `application/json` |
| **Timezone** | All times are `Asia/Tokyo` |
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APIToken': process.env.TEST_NOTIFICATION_API_TOKEN!,
      },
      body: JSON.stringify(await req.json()),
    }
  );

  // 401 and 404 have no body — do not call res.json() on them
  if (res.status === 401 || res.status === 404) {
    return new Response(null, { status: res.status });
  }

  return Response.json(await res.json(), { status: res.status });
}
```

The env var must **not** be prefixed `NEXT_PUBLIC_` — that would inline the token into the
client bundle.

---

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | `string` | No | `YYYY-MM-DD`. Defaults to today when omitted. |
| `login_ids` | `string[]` | **Yes** | Who receives the push. Must not be empty. Send as strings — leading zeros matter. |
| `editions` | `object[]` | **Yes** | One entry per notification. Must not be empty. |
| `distribute_now` | `boolean` | No | Default `false`. Skips the wait for the next 10-minute tick. See [Stage 1](#what-happens-after-the-201). |

### Each entry in `editions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `publish_hour_min` | `[int, int]` | **Yes** | `[hour, minute]`. Combines with `date` to form the delivery time. See [timing rules](#timing-rules). |
| `deliv_id` | `string` | **Yes** | Max 24 characters. Must be unique per test — a repeat is treated as the same delivery. |
| `title` | `string` | **Yes** | The notification body text. Japanese is fine (UTF-8). |
| `link_type` | `string` | **Yes** | `"01"`, `"02"` or `"03"` — quoted strings, not numbers. |
| `link_item` | `string` | **Yes** | Meaning depends on `link_type`. See below. |

### `link_item` by `link_type`

| `link_type` | Destination | `link_item` example |
|---|---|---|
| `"01"` | 公演 — a show page | `9041480001-P0030001P021001` |
| `"02"` | ワード — a keyword / performer | `23542` |
| `"03"` | WEB — an external URL | `https://eplus.jp/` |

For `link_type: "01"` the value must be a valid show id, or the request is rejected. The server
reduces it to `904148-0001` internally.

### Timing rules

Both are enforced server-side and return `400`. **Mirror them in the form** so the tester
doesn't need a round trip to find out.

| Rule | Why |
|---|---|
| No more than **2 hours ahead** of now | The delivery pipeline only imports files inside that window. A later time would be silently ignored. |
| Between **08:00 and 22:00** on the same day | Same import filter. Outside those hours the file is never picked up. |

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

**Only `201` and `400` return a body.** `401` and `404` are empty — calling `res.json()` on
them will throw.

### `201 Created`

One object per edition, in the order sent.

```json
{
  "editions": [
    {
      "deliv_id": "H020064377",
      "filename": "20260121153000_H020064377_app_push.csv",
      "will_publish_at": "2026-01-21T15:30:00+09:00",
      "login_ids_count": 2
    }
  ],
  "distributed": false
}
```

| Field | Notes |
|---|---|
| `filename` | The delivery file written to S3. Useful for support/debugging. |
| `will_publish_at` | ISO 8601 with `+09:00` offset. |
| `login_ids_count` | How many ids you **sent** — not how many people will receive it. See [caveats](#things-that-will-bite). |
| `distributed` | Whether `distribute_now` was honoured. |

### `400 Bad Request`

Validation failed. **Every** problem in the payload is reported at once, not just the first.

```json
{
  "error": "bad_request",
  "error_description": "The request parameters are invalid",
  "messages": [
    "editions[0].deliv_id must not be empty",
    "editions[0].link_type must be one of 01, 02, 03"
  ]
}
```

`messages` is a flat array of strings. Per-edition errors are prefixed `editions[n].`.

> **Note:** mapping these onto individual form fields means parsing that prefix. If you want a
> structured shape instead — e.g. `{"editions": [{"deliv_id": [...]}]}` — say so before you
> integrate; it is a small backend change and much cheaper to make now.

Full list of validation messages:

| Message | Cause |
|---|---|
| `date is invalid` | `date` not parseable |
| `login_ids must not be empty` | `login_ids` missing or `[]` |
| `editions must not be empty` | `editions` missing or `[]` |
| `editions[n].deliv_id must not be empty` | blank `deliv_id` |
| `editions[n].deliv_id must be 24 characters or less` | too long |
| `editions[n].title must not be empty` | blank `title` |
| `editions[n].link_item must not be empty` | blank `link_item` |
| `editions[n].link_type must be one of 01, 02, 03` | unsupported `link_type` |
| `editions[n].link_item is not a valid show id` | `link_type: "01"` with a non-show-id |
| `editions[n].publish_hour_min must be [hour, minute]` | malformed or out-of-range pair |
| `editions[n].publish_hour_min must be within 2 hours from now` | more than 2h ahead |
| `editions[n].publish_hour_min must be between …` | outside 08:00–22:00 |

### `401 Unauthorized`

**Empty body.** Missing, wrong, or unconfigured `X-APIToken`.

If this fires for every request after deploy, the token is most likely absent from SSM rather
than wrong in your environment.

### `404 Not Found`

**Empty body.** The endpoint is disabled on production by design. Seeing this on staging means
the deploy has not landed yet.

---

## What happens after the `201`

The response means **a file reached S3** — nothing more. Delivery runs through four
asynchronous stages after the request has already returned.

| # | Stage | When | What |
|---|---|---|---|
| 1 | Pickup | Every 10 min, 06:00–22:50 JST | A scheduled worker scans S3 and imports files due within 2 hours and inside 08:00–22:00. Until a tick runs, nothing has happened. `distribute_now: true` triggers this immediately. |
| 2 | Edition created | Seconds after pickup | The file is parsed and a delivery record is stored. |
| 3 | Recipients resolved | Seconds later | Each login_id is matched to a user who is an active customer **and** has `push_score_weekly` enabled. Anyone failing either check is dropped here. |
| 4 | Push sent | At the requested time | Notifications are batched and delivered. If pickup ran late, delivery slips past the requested time rather than being skipped. |

---

## Things that will bite

### A `201` does not mean the push was sent

It means the file was accepted. Word the success state as **scheduled**, not sent —
「配信予約しました」rather than「送信しました」. Otherwise the tester will report a bug when
nothing arrives for ten minutes.

### login_ids are filtered later, silently

An id whose user has `push_score_weekly` turned off — or who is excluded, or not a customer —
is discarded at stage 3 with **no error anywhere**: not in the response, not in the logs.

This is the most likely cause of *"I submitted but received nothing"*, and this API cannot warn
about it. If the tool needs to answer this up front, it needs a separate lookup endpoint —
worth raising now rather than after launch.

### Reusing a `deliv_id` is treated as the same delivery

Resending requires a new `deliv_id` **and** a new time. Consider generating or incrementing it
in the form rather than making the tester retype it.

### `login_ids_count` is not a recipient count

It echoes the length of the array you sent. See above.

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
- [ ] Render `messages[]` from a `400` back into the form
- [ ] Handle `401` / `404` without parsing a body
- [ ] Success copy says *scheduled*, showing `will_publish_at`

---

## Contacts / source of truth

| | |
|---|---|
| Controller | `app/controllers/epica/api/test_notification/auto_app_pushes_controller.rb` |
| Validation & file writing | `lib/push_test/auto_app_push.rb` |
| Route | `config/routes.rb` — `namespace :test_notification` |
| Spec | `spec/requests/epica/api/test_notification/auto_app_pushes_spec.rb` |
