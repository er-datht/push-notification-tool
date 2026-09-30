# Normal Push Notification API

API reference for the normal push (preorder / firstcome / mixed) test tool. Hand-off document
for the frontend team.

- **Repo:** `est-rouge/ecs-api`
- **Branch:** `feature/create_api_for_normal_push_notification`
- **Environment:** staging only

> ### ⚠️ This one really creates things
>
> Unlike [the auto app push endpoint](./API-DOC-auto-app-push.md), which only writes a CSV that
> is never uploaded, this endpoint **creates real database records and starts the real delivery
> pipeline**. A `201` means the editions and their topics exist and the background workers have
> been kicked off.
>
> It still does not mean a push was sent. See [What happens after a 201](#what-happens-after-a-201).
>
> `TEST_NOTIFICATION_API_TOKEN` must be present in SSM at `/epica/stg/api` — the same token as
> the auto app push endpoint, so if that one works, this one works.

---

## Endpoint

```
POST /api/test_notification/normal_pushes
```

| | |
|---|---|
| **Auth** | `X-APIToken: <token>` header — a shared secret |
| **Content-Type** | `application/json` |
| **Timezone** | All times are `Asia/Tokyo` |
| **Availability** | Staging and below. Returns `404` on production. |

This is the only endpoint. The common settings (`date`) are sent in this same request body.

---

## ⚠️ Call this from the server, not the browser

The token is a shared secret and this path is **not** in the API's CORS allowlist. A client-side
`fetch` would both leak the token into the JS bundle and fail the CORS preflight.

Route the form submit through a Next.js **route handler**:

```ts
// app/api/push/normal-push/route.ts
export async function POST(req: Request) {
  const res = await fetch(
    `${process.env.ECS_API_URL}/api/test_notification/normal_pushes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APIToken': process.env.TEST_NOTIFICATION_API_TOKEN!,
      },
      body: JSON.stringify(await req.json()),
    }
  );

  // 404 (disabled) has an empty body — calling res.json() on it will throw.
  if (res.status === 404) {
    return new Response(null, { status: 404 });
  }

  // Everything else — including the 201 — carries JSON.
  return Response.json(await res.json(), { status: res.status });
}
```

The env var must **not** be prefixed `NEXT_PUBLIC_` — that would inline the token into the
client bundle.

> **Give this request a long timeout.** A show code without a `P021…` part makes the server call
> the live e+ search API before it answers. See [the expansion rule](#the-expansion-rule).

---

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | `string` | No | `YYYY-MM-DD`. Defaults to today when omitted. |
| `editions` | `object[]` | **Yes** | One entry per notification. Must not be empty. |
| `distribute_now` | `boolean` | No | Default `false`. Asks the server to try publishing 30 seconds later instead of waiting for the next 10-minute cron tick. Only affects editions whose window has already started. |

### ⚠️ There is no `login_ids` field

This is the biggest difference from the auto app push endpoint. **Sending `login_ids` is a `400`**
(`NP-0004`), not a silent drop.

Who receives this push is not something the request controls. Recipients are whoever is already
subscribed to that ワード in the database, with an `anywhere` area, is an active customer, and has
news receiving turned on. If the tester's account is not subscribed to that word, **they receive
nothing and no error is reported anywhere**. That subscription is a precondition the tester sets
up in the app beforehand.

### Each entry in `editions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `publish_hour_min` | `[int, int]` | **Yes** | `[hour, minute]`. Combines with `date` to form the start of a **one-hour** delivery window. See [timing rules](#timing-rules). |
| `shows` | `object[]` | **Yes** | One entry per show in this notification. Must not be empty. |

### Each entry in `shows`

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | `string` | **Yes** | The 興行コード. See [the expansion rule](#the-expansion-rule). |
| `performer_id` | `number` | **Yes** | The ワード id. A positive whole number — the server zero-pads it to 10 digits. |
| `hook` | `string` | **Yes** | `"preorder"` or `"firstcome"` — exactly those two spellings. |

### `hook`, and how you get `mixed`

Only two values are accepted:

| `hook` | Meaning |
|---|---|
| `"preorder"` | プレオーダー |
| `"firstcome"` | 先着 |

**There is no `"mixed"` value, and `"in_store"` is rejected** (`in_store` belongs to a different
endpoint that does not exist yet). Watch the spelling — `"firstcom"` without the trailing `e` is a
`422`, on purpose: the server would otherwise store it happily and produce a push no app understands.

A **mixed** push is something you *build*, not something you ask for. Put two shows with **different
hooks** into one edition and the resulting notification is typed `mixed`:

```json
{
  "publish_hour_min": [17, 0],
  "shows": [
    { "code": "9014500001-P0030056", "performer_id": 2762, "hook": "firstcome" },
    { "code": "9014500001-P0030065", "performer_id": 2762, "hook": "preorder" }
  ]
}
```

Note that two shows with **different ワード but the same hook** is *not* `mixed` — it produces a
push of that hook carrying two words. Both are worth testing, and the form should make it clear
which one the tester is building.

### The expansion rule

How the `code` is written decides how much work the server does:

| Code shape | Example | What happens |
|---|---|---|
| Ends with `P021<koen>` | `9011910001-P0030007P021005` | Points at one performance. **One topic. Fast.** |
| Ends with `P003<sub>` only | `9014500001-P0030056` | The server calls the live e+ search API and expands it into **every performance under it, up to 200**. Slow, and it can fail with a `502`. |

Prefer the full form when the tester wants one specific show. If the form has a "expand to all
performances" affordance, warn that it may take several seconds and produce a lot of topics.

**Do not send the `[公演]` prefix** that appears in the test spreadsheet's 対象ID column. The server
rejects it (`NP-0203`). Strip it in the form.

### Timing rules

`publish_hour_min` is the **start of a one-hour window**, not an exact send time. All of these are
enforced server-side and return `422`. **Mirror them in the form** so the tester doesn't need a
round trip to find out.

| Rule | Why |
|---|---|
| Between **08:00 and 21:00** | The window is one hour long, and the publishing cron only runs 08:00–22:59. A window starting at 21:30 would end at 22:30, past the point where the server refuses to publish at all. |
| Must not overlap an edition that already exists | Two editions covering the same minute shadow each other and only one is ever published. See [the overlap rule](#the-overlap-rule). |

A time **in the past is allowed** — that is the normal way to use `distribute_now` (create at 15:52
for a 15:50 window, then publish immediately instead of waiting for the next tick).

### The overlap rule

Staging has a cron that builds the *real* push editions every hour, and it shares a table with the
test ones. If the window you ask for collides with an edition that already exists, the request is
rejected with `NP-0208` rather than creating something that will silently swallow — or be swallowed
by — another edition.

Practically: **a tester cannot book two pushes in the same hour**, and cannot book an hour that
staging's own cron has already claimed. Surfacing "that hour is taken, pick another" is a good use
of this error.

### Example request

```http
POST /api/test_notification/normal_pushes
Content-Type: application/json
X-APIToken: <token>
```

```json
{
  "date": "2026-09-29",
  "editions": [
    {
      "publish_hour_min": [17, 0],
      "shows": [
        { "code": "9014500001-P0030056", "performer_id": 2762, "hook": "firstcome" },
        { "code": "9014500001-P0030065", "performer_id": 2762, "hook": "preorder" }
      ]
    },
    {
      "publish_hour_min": [18, 0],
      "shows": [
        { "code": "9011910001-P0030007P021005", "performer_id": 75223, "hook": "preorder" }
      ]
    }
  ],
  "distribute_now": false
}
```

---

## Responses

| | Shape |
|---|---|
| Success (`201`) | `{ "editions": [ … ] }` |
| Failure | `{ "error": { "error_id", "code", "title", "message", "errors": [ … ] } }` |

The failure envelope is the one from the **[EMO] API Specification Summary** sheet, so error
handling is identical to the rest of the EMO APIs and to the auto app push endpoint. All keys are
`snake_case`.

**`404` is the only response with no body at all.** Everything else can be parsed.

### `201 Created` — accepted

```json
{
  "editions": [
    {
      "id": 41,
      "period_start": "2026-09-29T17:00:00+09:00",
      "period_end": "2026-09-29T18:00:00+09:00",
      "status": "edited",
      "topics_count": 2
    }
  ]
}
```

One entry per edition, in the order they were sent.

| Field | Notes |
|---|---|
| `id` | The database id. Show it — it is what a backend engineer needs to look the delivery up. |
| `period_start` / `period_end` | The one-hour window, ISO 8601 with the `+09:00` offset. |
| `status` | Always `"edited"` at this point. It becomes `"set"` a few seconds later, in the background — the response cannot show that. |
| `topics_count` | How many topics were actually created. **Worth showing**: for an expandable code this is the only way the tester learns that one line in the form became 137 topics. |

### `422 Unprocessable Entity` — validation failed

**Every** problem in the payload is reported at once, one entry per field, not just the first.

```json
{
  "error": {
    "error_id": "NP-0001",
    "code": "INVALID_PARAMETER",
    "title": "Invalid parameter",
    "message": "Some of the request parameters are wrong. See errors for each field. (NP-0001)",
    "errors": [
      {
        "error_id": "NP-0203",
        "field": "editions[0].shows[0].code",
        "title": "Invalid parameter",
        "message": "code is not a valid show id (NP-0203)"
      },
      {
        "error_id": "NP-0205",
        "field": "editions[0].shows[0].hook",
        "title": "Invalid parameter",
        "message": "hook must be one of preorder, firstcome (NP-0205)"
      }
    ]
  }
}
```

| Field | Notes |
|---|---|
| `error.error_id` | Identifies the failure as a whole. `NP-0001` for any bad payload. |
| `error.code` | Machine-readable: `INVALID_PARAMETER`, `UNAUTHORIZED`, `SEARCH_UNAVAILABLE` or `INTERNAL_ERROR`. |
| `error.message` | Summary for a toast/banner. Ends with its own `error_id` in brackets. |
| `error.errors[].field` | Dotted path of the offending field — `date`, `editions[0].publish_hour_min`, `editions[0].shows[1].hook`. Map straight onto the form control. |
| `error.errors[].error_id` | **Key off this, not the message text.** Ids are stable; wording is not. |
| `error.errors[].message` | Plain-English fallback for display, with the id appended. |

Full list of field errors:

| `error_id` | `field` | Cause |
|---|---|---|
| `NP-0101` | `date` | `date` not parseable |
| `NP-0103` | `editions` | `editions` missing or `[]` |
| `NP-0201` | `editions[n].shows` | `shows` missing or `[]` |
| `NP-0202` | `editions[n].shows[m].code` | blank `code` |
| `NP-0203` | `editions[n].shows[m].code` | `code` is not a valid show id — including the `[公演]` prefix case |
| `NP-0204` | `editions[n].shows[m].performer_id` | not a positive whole number, or more than 16 digits |
| `NP-0205` | `editions[n].shows[m].hook` | not `preorder` or `firstcome` |
| `NP-0206` | `editions[n].publish_hour_min` | malformed or out-of-range pair |
| `NP-0207` | `editions[n].publish_hour_min` | window outside 08:00–22:00. The message names the exact window. |
| `NP-0208` | `editions[n].publish_hour_min` | the window overlaps an edition that already exists — including another edition in the same request |

When `date` is unusable (`NP-0101`) the editions are **not** checked, so that one error can arrive
on its own. Fix it and resubmit to see the rest.

### `400 Bad Request` — the body itself is wrong

Same envelope, but the request never got as far as validation.

| `error_id` | `field` | Cause |
|---|---|---|
| `NP-0003` | `null` | The body is not valid JSON |
| `NP-0004` | the key | A parameter this endpoint does not know. **`login_ids` lands here.** Send only the documented keys — an extra one is rejected, not ignored. |

### `401 Unauthorized`

Missing, wrong, or unconfigured `X-APIToken`.

```json
{
  "error": {
    "error_id": "NP-0002",
    "code": "UNAUTHORIZED",
    "title": "Unauthorized",
    "message": "The X-APIToken header is missing or wrong. (NP-0002)",
    "errors": []
  }
}
```

If this fires for every request after deploy, the token is most likely absent from SSM rather
than wrong in your environment.

### `404 Not Found`

**Empty body.** The endpoint is disabled on production by design, and answers with nothing at all
so it cannot be told apart from a route that does not exist. Seeing this on staging means the
deploy has not landed yet.

### `502 Bad Gateway` — the e+ search API failed

Only possible when at least one `code` had no `P021…` part and therefore needed expanding.

```json
{
  "error": {
    "error_id": "NP-0006",
    "code": "SEARCH_UNAVAILABLE",
    "title": "Search API unavailable",
    "message": "The e+ search API could not be reached, so the show codes could not be expanded. (NP-0006)",
    "errors": []
  }
}
```

Nothing the tester did wrong. Retrying is reasonable here — unlike a `500`. Suggest switching to a
full `P021…` code, which needs no search call at all.

⚠️ **Editions earlier in the same request were already created** before the failing one. The request
is not a transaction. Do not blindly resubmit the whole payload — that will now also hit `NP-0208`
for the editions that did get through.

### `500 Internal Server Error`

The payload was fine but creating the editions failed.

```json
{
  "error": {
    "error_id": "NP-0005",
    "code": "INTERNAL_ERROR",
    "title": "Internal error",
    "message": "The request was valid but the push could not be created. (NP-0005)",
    "errors": []
  }
}
```

Nothing the tester can fix — surface it as "server error, contact the backend team" and do not
retry automatically. The same partial-creation warning as the `502` applies.

---

## What happens after a `201`

A `201` means **the editions and topics exist in the database and the background pipeline has been
started** — nothing more. Delivery then runs through four asynchronous stages after the request has
already returned.

| # | Stage | When | What |
|---|---|---|---|
| 1 | Subscribers resolved | Seconds after the response | Background workers look up who is subscribed to each ワード with an `anywhere` area. |
| 2 | Notifications written | Seconds later | One notification row per matching user. Users who are not active customers, or who have news receiving off, are dropped here. |
| 3 | Edition marked `set` | When stage 2 finishes | Only now is the edition eligible to be published. |
| 4 | Push sent | At the next cron tick inside the window | The cron runs at minutes 0/10/20/30/40/50/59, 08:00–22:59. It publishes the edition whose window covers that moment. |

`distribute_now: true` asks for stage 4 to be attempted 30 seconds after the response instead of at
the next tick. It only helps for a window that has already started.

---

## Things that will bite

### A `201` does not mean the push was sent

Word the success state as **scheduled**, not sent — 「配信予約しました」rather than「送信しました」.
Show `period_start`, and say the push goes out during that hour rather than at an exact second.

### Nobody may receive it, and nothing will say so

This is the single most likely support question. There is no `login_ids` to target — recipients come
from real subscription rows. If the tester's account is not subscribed to that ワード (with an
`anywhere` area, as an active customer, with news receiving on), the push simply reaches nobody.
`topics_count` will still be cheerfully positive.

The API cannot warn about this. If the tool needs to answer *"will I actually get this?"* up front,
it needs a separate lookup endpoint — worth raising now rather than after launch.

### `status` in the response is always `"edited"`

It becomes `"set"` in the background moments later. Do not render it as a final state, and do not
poll for it — there is no endpoint to poll.

### An expandable code can turn one form row into 200 topics

`9014500001-P0030056` (no `P021…`) means "every performance under this 興行". The request blocks on a
live e+ API call while that happens. Check `topics_count` in the response and show it back.

### Editions are created one by one, not all or nothing

If the third edition in a payload fails, the first two already exist. Show which ones succeeded —
the `502` and `500` bodies do not tell you, so keep your own record of the submitted order.

### Resubmitting the same hour is rejected

By design (`NP-0208`). To re-run a test, pick a different hour or ask a backend engineer to delete
the previous edition.

### Extra keys are rejected, not ignored

A parameter the endpoint does not know is a `400` (`NP-0004`), not a silent drop. In particular
**`login_ids` is not accepted here** even though the auto app push endpoint requires it — the two
forms cannot share a payload builder.

### Only one tester at a time

The server keeps `date` in process-level state while it builds the editions. Two submissions landing
in the same second can mix each other's values. Not something the form can guard against — just do
not run a second tester in parallel.

---

## Form checklist

Things the UI should do, derived from the above:

- [ ] Date picker defaulting to today
- [ ] Per-edition: a time picker constrained to **08:00–21:00**, plus a repeatable list of shows
- [ ] Per-show fields: `code`, `performer_id`, `hook` select (`preorder` / `firstcome` only)
- [ ] Strip a leading `[公演]` from a pasted `code` before sending
- [ ] Make "two different hooks in one edition = mixed push" visible in the UI, since there is no
      `mixed` option to pick
- [ ] Warn when a `code` has no `P021…` part: slow, and may create many topics
- [ ] Long client timeout on the submit, for exactly that case
- [ ] **No `login_ids` field** — and say in the UI that recipients come from real subscriptions
- [ ] Optional `distribute_now` toggle ("配信を今すぐ実行")
- [ ] Map `error.errors[].field` back onto the matching form control, keyed by `error_id`
- [ ] Show `error.message` as the banner and `errors[].message` per field
- [ ] Treat `NP-0208` as "that hour is already taken" and prompt for another
- [ ] Send only the documented keys — an unknown one is a `400`
- [ ] On `201`, show the returned `id`, the window, and `topics_count` per edition
- [ ] Success copy says *scheduled*, naming the one-hour window
- [ ] Keep a local history of submissions, including which editions of a failed multi-edition
      request had already been created

---

## Contacts / source of truth

| | |
|---|---|
| Controller, error envelope **and validation** | `app/controllers/epica/api/test_notification/normal_pushes_controller.rb` — `VALIDATION_ERRORS` is the catalog above |
| Auth, envelope and helpers shared with the app push endpoint | `app/controllers/epica/api/test_notification/base_controller.rb` |
| Edition and topic creation | `lib/push_test/common.rb` — `create_topics_edition` |
| What that method does, step by step | `doc/misc/create_topics_edition_flow.md` (and `.vi.md`) |
| Route | `config/routes.rb` — `namespace :test_notification` |
| Spec | `spec/requests/epica/api/test_notification/normal_pushes_spec.rb` |
| The sibling endpoint | [API-DOC-auto-app-push.md](./API-DOC-auto-app-push.md) |
