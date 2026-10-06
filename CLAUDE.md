# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn install
yarn dev        # start the Next.js dev server at http://localhost:3000
yarn build      # next build (type-checks as part of the build)
yarn start      # serve the production build
yarn lint       # runs oxlint, not eslint
yarn typecheck  # tsc --noEmit
```

Use yarn (1.22.22). `package-lock.json` and `pnpm-lock.yaml` are ignored by git on purpose.

There are no tests and no test command in this project yet.

**Docker (dev only).** `Dockerfile.dev` here is built and run as the `web` service by `../be-push-notification-tool/docker-compose.yml` (`docker compose up -d` there starts MySQL, the API and this console). The image holds only `node_modules`; the repo is bind-mounted for hot reload, with `node_modules` and `.next` kept in container volumes. Compose sets `NEXT_PUBLIC_EXPRESS_API_URL=http://localhost:${PORT}` — the host-published API port, because the browser calls express directly, never `http://api:…`. `ECS_API_URL` still comes from `.env.local`; inside the container `localhost` is the container, so a local ecs-api is `http://host.docker.internal:<port>`. No production image yet.

## What this app is

One page where a person fills in push notifications and sends them to the **STAG environment only**. It came from the Claude Design project `push-tool-console`.

It is Next.js 16 (App Router) + React 19 + TypeScript. There is one page route (`src/app/page.tsx`) plus one route handler, no state library, no CSS framework, and no data-fetching library — `fetch` only. Everything is plain `useState`. Imports use the `@/` alias for `src/`.

All 6 push types in the sidebar work, each with its own fields — they are genuinely different forms, not one shared shape with a different label. **Which fields each form has comes from the e+ Cloud guideline** (`[e+ Cloud] Push notification guideline.pptx`, one folder above this repo — its `PushTest::Common.create_*_edition` Rails commands); `../common/PUSH-TYPES-FIELD-REFERENCE.md` is the readable version. A type's whole spec — label, Japanese subtitle (`jp`), category, `noun` (card label), `prereqs` chips, who receives it (`readers`), whether it has a shared start time (`globalTime`), its card `fields: FieldConfig[]`, its list of sub-items (`items`: shows or order lines), seed rows (`samples`), default row (`blank()`), review/done-screen copy (`preview()`), its JST window and time rules, and both servers' endpoint paths — lives in `src/lib/pushTypes.ts` (`PUSH_TYPES`, keyed by `PushTypeId`). The field descriptors themselves (`FieldConfig`: text/segmented-control/quick-fill-chips/Auto-App's link pair) are in `src/lib/fields.ts`.

Every form has two sections: **Common settings** (shared by all types and kept across a type switch — run settings, environment, the notification-setting prerequisites, and the Recipients area) and **{type} settings** (Order's start time, then the notification cards). That split follows the proposal's §4.2 / §4.3.

**`backendConfirmed` is per server** (`Record<Server, boolean>`). Auto App Push (`../fe-docs/API-DOC-auto-app-push.md`) and Normal Push (`../fe-docs/API-DOC-normal-push.md`) are confirmed on both. In store Push (`last_minute_push`, `../fe-docs/API-DOC-in-store-push.md`) is confirmed on ecs-api only. The other 3 (`score_push`, `news_push`, `order_push`) are confirmed nowhere, so their paths and request keys are guesses: Score reuses Normal's show keys (`code` / `performer_id` / `hook`), News sends `article_id` / `word_id` / `title`, Order sends `status` and `order_lines[]`. `ReviewRail` shows an "endpoint not yet confirmed" note when the selected server's flag is false. Update the registry (and flip that server's flag) once a real endpoint exists.

**Express is switched off in the UI for now, for every push type.** `SERVERS` in `ReviewRail.tsx` marks it `disabled: true`, so the Dispatch target shows it greyed out with the SOON badge and every run goes to ecs-api. The express code path (`submitPush`, `NEXT_PUBLIC_EXPRESS_API_URL`) is untouched; removing that flag brings Express back for Auto App and Normal, the only two types express has. The other 4 types also set `unavailableOn: ["express"]`, so they stay on ecs-api even then: the rail disables Express for them and `PushConsole` sends the run to ecs-api, keeping the tester's own server choice for when they switch back to a type that has express. Their `expressPath` values are unused guesses; when express gains one of them, drop `unavailableOn` from that type and flip its `backendConfirmed.express`.

## Talking to the API

`../fe-docs/API-DOC-auto-app-push.md` and `../fe-docs/API-DOC-normal-push.md` are the contracts for `ecs-api` — the same payload shapes and envelope also serve `express` (`be-push-notification-tool`), which reimplements both at different paths; that repo's own docs are the contract source for its divergences (see the 404 bullet below). The same envelope is _assumed_ to hold for the other 4 push types (see `src/lib/pushTypes.ts`), pending backend confirmation. `execute()` in `PushConsole.tsx` builds the payload with `buildPayload` and posts it through `submitPush` (`src/lib/api.ts`, taking `server` and `pushType` as its third and fourth arguments), which picks the target by server:

- **`ecs-api`** — through our own dynamic route handler at `src/app/api/push/[type]/route.ts`, which resolves the `type` slug against `PUSH_TYPES` and forwards to `POST {ECS_API_URL}{pushType.ecsForwardPath}` (e.g. `/api/test_notification/auto_app_pushes`). When the route handler itself has a problem (env not set, no token on the request, body not JSON, host unreachable, or an unrecognized `type` slug) it answers with the same `{ error: { code, title, message, errors[] } }` object as the API's failures (the house shape from the EMO API Specification Summary sheet, repeated in `../fe-docs/API-DOC-auto-app-push.md`) — `title` is the headline, `message` the sentence under it, `errors[]` raw detail — so `src/lib/api.ts` reads both the same way.
- **`express`** — straight from the browser to `POST {NEXT_PUBLIC_EXPRESS_API_URL}{pushType.expressPath}` (e.g. `/api/notifications/auto-app-pushes`), no proxy hop. This is a deliberate asymmetry, not an oversight: see the CORS paragraph below.

**The token is typed in, not configured.** The `X-APIToken` is the "API token" field in the review rail (`ReviewRail.tsx`), shown for either server. It is required, lives only in `PushConsole` state (`apiToken`) — never in `localStorage`, never in env — and travels as an `X-APIToken` header on the request, unchanged either way. A `401` marks that field (`tokenError` on the failed `SubmitResult`), the way a `422` marks a card, and keeps the rail open so the tester can fix it. `tryExecute` checks the token after the form, because the field is in the rail, not on the form the drawer would be covering.

**`ecs-api` is proxied; `express` is not — on purpose.** `ecs-api`'s path is not in that API's CORS allowlist, so the browser must never call it directly: `ECS_API_URL` is read only inside the route handler and must never be prefixed `NEXT_PUBLIC_`. `express`'s CORS _does_ allow this app's origin directly, and its base URL is not a secret the way `ECS_API_URL` is (the token is page state either way, never a server-side secret), so `NEXT_PUBLIC_EXPRESS_API_URL` is read straight from the browser in `src/lib/api.ts` with no route handler at all. Don't "fix" this into a second proxy route, and don't flip it the other way for `ecs-api` — the two are proxied differently because their CORS configs actually differ. Copy `.env.example` to `.env.local` to run against staging.

**Auto App's success has no body; Normal Push's does.** Failures always carry the EMO envelope `{ error: { error_id, code, title, message, errors[] } }` (see the Responses section of `../fe-docs/API-DOC-auto-app-push.md`). Four responses matter, and `src/lib/api.ts` is the only place that branches on them:

- **201** — accepted. For Auto App it is empty: the API writes the delivery file on the server and (while the S3 upload is switched off) stops there — no id, no filename, no resolved time. `PushConsole` keeps the exact payload it posted (`sent`) and `DoneView` draws the confirmation from that: the time from `date` + `publish_hour_min`, and a `link_type: "01"` show id reduced with `shortShowId` (`9041480001-P0030001P021001` → `904148-0001`) the way the server does it internally. For Normal Push the `201` is `{ editions: [{ id, period_start, period_end, status, topics_count }] }`, for In store `{ editions: [{ id, will_publish_at, status, topics_count }] }` — `submitPush` reads it only when the body is non-empty and hands it back as `created`, and `DoneView` shows each edition's number, its one-hour window (Normal) or time (In store), and topic count. `DoneView` says _scheduled_ (配信予約しました), never _sent_, and its copy depends on the type and server (`whatHappened`).
- **422 / 400** — `error.errors[]` is a flat list of `{ error_id, field, message }`; an entry about one edition has a `field` like `editions[n].deliv_id`, or one about a show `editions[n].shows[m].code`. `splitErrors` routes those to the matching card — a nested path keeps its item part, so it lands on that show's input — and keeps the rest in `error.errors` for the toast, which shows `error.title`, `error.message` and that remainder. 422 is validation; 400 is a body the API could not read (not JSON, or an unknown key — extra keys are rejected, not ignored). Row errors are stored in `PushConsole` as an `ApiVerdict` together with the JSON of the exact payload they answered, and are merged into the `rowErrors` memo only while the current payload still matches that key — so the verdict drops out on its own once anything in the payload changes, without every input handler having to clear it. Only `tryExecute` resets it explicitly, so a re-run of the same payload gets a fresh answer.
- **401** — same error envelope (`AP-0002` / `NP-0002`; Express answers `AP-0002` for every route). The API token field turns red, the toast says the token was not accepted, and the SSM hint goes to the browser console.
- **404** — empty, like the 201, but only for `ecs-api`: that API's `404` means "disabled in prod on purpose" and is always zero bytes, so the route handler and `src/lib/api.ts` never call `res.json()` on either. `express` has no such concept — a `404` there is an ordinary envelope with a body — so `src/lib/api.ts` guards the empty-body assumption with `server === 'ecs-api'` and lets an `express` `404` fall through to the same parsing every other status gets.

**Who receives a push depends on `pushType.readers`, and so does the request.** `list` (Auto App, Score) sends the Recipients list as `login_ids`; `word` (Normal, In store, News) sends no `login_ids` key at all — Normal's API rejects it with `400 NP-0004` — and the page shows a plain note instead of a list; `order` (Order) sends only `exclude_login_ids`, because each order line names its own member. Login IDs are filtered against the notification setting later with no error anywhere, which `DoneView` spells out. `distribute_now` does nothing on the server for Auto App until the upload is back; for Normal Push on ecs-api it asks the server to publish 30 seconds later; for In store on ecs-api it publishes each edition about 30 seconds after its notifications are ready. `pushType.distributeNow` holds that wording for the types where the server acts on the flag; the checkbox, the review rail, the confirm dialog and `DoneView` all say which.

## How the code is put together

### All state sits in `PushConsole.tsx`

`src/app/page.tsx` is a server component that only renders `<PushConsole />`. `PushConsole` is marked `'use client'`, and rows, recipients, the chosen server, the active push type, the API token, which panels are open, the `checked` flag — all of it is `useState` inside it. The other files in `src/components/` only take props and call functions back up. Don't add local state that copies page state. The one fine exception is the text box in `RecipientsSection`, which is only a draft value.

**Every push type keeps its own row list.** `rowsByType: Record<PushTypeId, FormRow[]>` holds one independent list per type, seeded from that type's `samples`; one `nextId` counter is shared across all of them. **Switching push type** (`switchPushType` in `PushConsole.tsx`, called from `Sidebar`'s `onSelect`) does _not_ touch `rowsByType` — a half-filled Score Push row survives clicking over to check Normal Push's fields and back. It only resets what belongs to one specific submission attempt against the type that's about to change shape: `checked`, `done`, `confirmOpen`, `sent`, `created`, `apiVerdict`, `apiTokenError`, `scrollTo` — a stale API verdict from a different payload shape would be actively misleading. It leaves `loginIds`, `excludedIds`, `recipientsOpen`, `date`/`minDate`, `distributeNow`, `globalHour`/`globalMin`, `apiToken`, `server`, `railOpen`/`reviewDrawer` alone — those are about the tester's session, not the push type. Keep new state in whichever bucket it belongs to if you add more.

The one thing that lives above the page is the push-type list's open flag. `Header` is rendered by `src/app/layout.tsx`, not by the page, so its menu button cannot get a prop from `PushConsole`; `ShellProvider` (`src/components/ShellProvider.tsx`, wrapped around `<Header />` and `{children}` in the layout) holds `narrow`, `sideOpen`, `sideDrawer` and `sideToggle`, and both `Header` and `PushConsole` read them through `useShell()` (`src/lib/shell.ts`). `PushConsole` turns `sideToggle` off when it shows `DoneView` (no list there) and back on in `startOver`. Keep the provider to that — don't grow it into a store.

### A push type's fields, in `src/lib/fields.ts` and `src/lib/pushTypes.ts`

A row is one notification: `FormRow = { id, collapsed, values, items }`, where `values` holds the card's own fields and `items: FormItem[]` its shows or order lines (`[]` for a type without a list). Item ids come from the same `nextId` counter as rows, so every DOM id on the page is unique. What's on the card is a `FieldConfig[]` per type (`pushType.fields`) plus, when the type has one, `pushType.items` (`{ key: "shows" | "order_lines", noun, fields, blank(), fixed? }`). `FieldControl.tsx` renders one field generically — a plain text input, a segmented control (`seg`), quick-fill buttons (`chips`), or Auto App's bespoke `kind`+`linkValue` link pair (`link: true`) — and is used both for the card's fields and for each item's. `ItemList.tsx` renders the item list: a sub-panel per show / order line with a remove button (disabled at one) and "+ Add …". `items.fixed` is a value the server gives every item itself (In store's `hook: in_store`): shown read-only, **never sent** — In store's API rejects a `hook` key with `400 IS-0004`. `HOUR`/`MIN` are in every non-`globalTime` type's `fields` (for validation and `buildPayload`) but are rendered by a dedicated "Delivery time" widget instead.

A new row, show or order line starts sendable: `addRow`/`addItem` run `blank()` through `withPlaceholders` (`pushTypes.ts`), which puts each empty field's `placeholder` into the input as its value (the link field takes `LINKS[kind].placeholder`). `newRowValues` also steps Auto App's `deliv_id` with `nextDelivId` past every ID already in the list, since each row needs its own, and picks the new row's time with `newRowTime`: `blank()`'s default when it passes the type's time rules, else the nearest time that does, found by running candidates (5-minute steps, from now for Auto App and from the default otherwise) through `validateRows` itself plus In store's no-same-time rule (`IS-0206`). So the picker can never disagree with what Execute checks; a rule added to `validateRows` is followed here for free. When nothing passes (Auto App on a future date), the default is kept and Execute reports it. Order, with its one shared start time, is untouched. The seed samples get the same treatment once, in the mount effect: `retimeRows` moves any sample whose fixed time fails a rule (in practice Auto App's 2-hour cap) to the nearest passing time, shifting the samples after it by the same amount so they keep their spacing. It runs after mount, never in `buildInitialRows`, because the page is prerendered. So the placeholder is the default value — change one and you change what a new card holds.

`buildPayload` sends each row as one edition, with its items under `items.key`. Blank items are sent too, so the API's `shows[j]` always means `row.items[j]`. A field is sent as typed text unless it has `sendAs: "number"` (`performer_id`, `article_id`, `word_id`) — Order's codes like `0106` must keep their leading zeros. A `check: "event"` value goes through `normalizeCode`, which drops a pasted `[公演]` prefix the API would reject — only Normal's show code has that check; In store and Score build theirs with `codeField(span, { check: false })` and send it as typed.

The `LINKS` object (`src/lib/types.ts`) maps each link kind (`web`, `kogyo`, `word`) to its `link_type` code and to every word the user sees for that kind: the field label, the placeholder, the help text, and the short `line` used in previews. `FieldControl`, `ReviewRail`, and `DoneView` (via `pushType.preview()`) all read the same entry. Adding a new link kind means editing the `LinkKind` type and `LINKS` here, plus the matching check inside `errorsFor` — it's still Auto-App-only, so nothing in `pushTypes.ts` needs to change.

**The form checks what ecs-api checks, plus a few team decisions — nothing more.** The full rule list, field by field, is `../fe-docs/PUSH-FIELD-VALIDATION.md`; why each rule is kept or dropped is in `../fe-docs/SCHEDULING-MISMATCH-FE-VS-ECS-API.md`. Don't add a rule that ecs-api does not have without a team decision.

`errorsFor` walks a row's `pushType.fields` and each item's `items.fields` (required / `check: 'digits'` / `check: 'event'` / `check: 'performer'` / the link field's URL-or-word-id check), plus the time rules ecs-api has: a JST window where `windowStartMin`/`windowEndMin` are set (Auto App 08:00–22:00, Normal 08:00–21:00) and the two-hour cap `leadMs` (Auto App only). In store, Score and News have no time rule at all. No type rejects a past time — ecs-api sends it at once. `validateRows` wraps it and adds one cross-row rule, Normal's overlap mirror of `NP-0208` — two notifications less than an hour apart put an error on the later one. (Auto App has no duplicate-`deliv_id` rule: ecs-api only needs the file name, which includes the time, to be unique.) `dateErrorFor` covers the one date field shared by every row; `globalTimeErrorFor(hour, min)` is Order's equivalent for its one shared start time and only rejects a malformed hour or minute — ecs-api's Order `8..21` gate reads the moment the request arrives, not this time. Order's block times are still start + `ORDER_BLOCK_STEP_MIN` (10 min) × position. The grey line under each card's time inputs is `pushType.timeHelp`. The messages are plain sentences in simple words, shown to the user word for word, so write new ones in the same tone: "Enter a delivery ID. The batch uses it to find the campaign."

Those rules mirror limits ecs-api enforces (its `AP-*`/`NP-*` checks for Auto App and Normal, its models for the rest), so the tester finds out without a round trip: `deliv_id` ≤ 24 chars, Auto App's delivery time inside 08:00–22:00 and no more than 2 hours ahead of now, and Normal's window start between 08:00 and 21:00. The team-decision extras are Auto App's http(s) web link and digits-only word link, and the word ID checks on News (digits), In store and Score (1–16 digits). Rules ecs-api checks but the form does not (`AP-0206`, `NP-0208` against existing editions, Order's duplicate management number) come back as API errors on the input they name.

### Every error names the input it came from

`errorsFor` returns `RowError[]`, not strings: each message carries a `RowField` (now just `string`, since the set of valid fields is type-dependent) so `NotificationRowCard` can put it under the right input and set `aria-invalid` on it. A message with no visible field is useless — the tester reads "must be within 2 hours" and has nothing to click. So when you add a rule, give it a field.

`time` is the field for rules about the hour and minute **together** (the JST window, Auto App's 2-hour lead); `hour` and `min` are only for a malformed value in one of the two boxes. `errorsForField(errors, 'hour', 'time')` is how the card asks which marks an input gets, and that pairing is why both boxes redden on a window error but only one does on "Hour must be a whole number".

An item input's `RowField` is its payload path inside the edition, `shows[1].code` (`itemField` in `src/lib/types.ts`); an error about the list as a whole uses the list key, `shows`. `splitErrors` gives the API's `422` entries the same treatment: it strips `editions[n].` and keeps the rest, so `editions[0].shows[1].code` lands on exactly that input. `FIELD_BY_PAYLOAD_KEY` only renames the three top-level keys that don't equal a field key: `publish_hour_min` → the synthetic `time` field, and `link_type`/`link_item` → Auto App's `kind`/`linkValue` pair. `NotificationRowCard` shows any error whose field no rendered input owns (e.g. a `time` error on an Order card, which has no time inputs) in its "The API also said" block — it must never be silently dropped.

The API's own `message` text names payload keys ("link_item is required (AP-0204)") the tester has no input for, so it is never shown when the `error_id` is known. `src/lib/apiMessages.ts` maps each id to our own sentence (`WORDING_BY_ERROR_ID`), with the link field's label filled in from the row's `link_type` — "Destination URL is required." — `../fe-docs/UI-FIELD-MAPPING.md` is the readable table of inputs, payload keys, ids and wording, and `../fe-docs/ERROR-MESSAGES.md` is the one table of `error_id` → field → label → cause → BE message → FE message. Update them together.

A collapsed card hides its inputs and therefore its marks, so a card with errors gets a red stripe down its left edge (a `before:` pseudo-element on the `Card` in `NotificationRowCard`). That stripe is the whole indicator — an earlier "N to fix" count in the header was removed as noise; don't reintroduce a badge there.

**Times are Asia/Tokyo, not the browser's timezone.** `todayInTokyo` and `tokyoEpoch` convert against a fixed UTC+9 (Japan has no DST); `formatPublishAt` reads the API's `+09:00` timestamp with a regex rather than letting `Date` re-render it locally. Anything read from the clock or `localStorage` is set in a mount effect, never seeded into `useState` — the page is prerendered, so a build-time date would hydrate against a different one.

### Errors only appear after Execute

`rowErrors` stays empty until `checked` turns true, so no red text shows while someone is still typing. When Execute is pressed, `tryExecute`:

1. sets `checked`,
2. runs `validateRows` and `dateErrorFor` again on its own instead of reading the memo, because the memo is still stale in that render,
3. opens any collapsed row that has an error,
4. opens the recipients panel if a `list` type's ID list is empty,
5. scrolls to the first problem: a card, then the Recipients card, Order's start time (`ptc-global-time`), then the date.

Only when nothing is wrong does it open `ConfirmDialog`, whose confirm button calls `execute` — the one place that posts anything. Keep this order if you add more checks.

`startOver` clears `checked`, `done`, and the API result, and bumps `deliv_id` with `bumpDelivId` (a no-op for every type except Auto App, the only one with that field), because the API treats a repeated `deliv_id` as the same delivery. Rows and recipients otherwise survive, so the user can send a similar run again (Normal Push's hours are then taken on the server, which `DoneView` warns about). Login IDs, `excludedIds`, and `distribute_now` also persist to `localStorage` via `src/lib/storage.ts` on each Execute; the defaults are ecs-api's `PushTest::Common` lists (7 login IDs from `lib/push_test/common.rb:8` — not the guideline deck's 10 — and 4 excluded IDs), and the storage key is versioned (`ptc.settings.v3`) so a change of defaults reaches everyone once.

Four types — In store, Score, News and Order — are not sent by any cron. **The tester never publishes by hand:** ticking `distribute_now` makes the server do the publish step a developer would otherwise run in `rails c` (`distributeNow.required: true` in their `PushTypeConfig`). With it off the server only creates the notifications and nothing is sent, so the checkbox's help line turns red, and the `ReviewRail` subline, the confirm dialog and `DoneView` all say nothing will be sent; without that a tester reads "scheduled" as "sent" and reports the push as lost. Don't show `rails c` commands to the tester. Order's preview also takes the excluded list (`preview(row, { excludedIds })`) to mark order lines the server will drop, and shows the status's own `01`–`07` number (`ORDER_STATUS_NUMBER`), which is never sent.

### Styling is Tailwind v4 + shadcn/ui

There is no hand-written CSS for components. Every component is styled with Tailwind utility classes, and the interactive pieces (buttons, inputs, labels, checkbox, radio groups, cards, badges, the confirm `Dialog`, the narrow-screen `Sheet` drawers) come from shadcn/ui, generated into `src/components/ui/`. Those files are ours: they have already been tuned to the mockup (6px radius, the blue primary, a `muted` button variant, a flat `Card` with the soft shadow), so edit them there rather than fighting them with `className` overrides at every call site. Add more with `npx shadcn@latest add <name>` (the project is on the Radix-based `radix-nova` preset; see `components.json`). One deliberate deviation: `class-variance-authority` is not used. `Button` and `Badge` keep their variants in plain `as const` lookup objects instead of `cva()`, so if a newly added component imports `cva`, rewrite it the same way and don't add the package back.

`src/app/globals.css` holds only three things: the Tailwind/shadcn imports, the design tokens, and the react-toastify re-theme. The tokens are the mockup's palette written onto shadcn's variable names (`--primary`, `--border`, `--sidebar`, …) in `:root`, plus a few extra `--color-ink-*` / `--color-red-ink` style shades under `@theme inline` for tints shadcn has no slot for — use `text-ink-3`, `bg-red-tint`, `shadow-card` and so on rather than raw hex values. The font is loaded with `next/font/google` in `layout.tsx` as `--font-source-sans`, which the theme maps to `font-sans`.

react-toastify is the one thing still themed with plain CSS: its `.Toastify__*` classes come from the library, so the toast section of `globals.css` maps its `--toastify-*` variables onto the tokens. Restyle it there rather than overriding `.Toastify__*` rules elsewhere.

`FieldText.tsx` has the three tiny helpers every form shares (`FieldHelp`, `FieldError`, `Req`), so the muted help line and the red error line look the same on every input.

### Layout and the narrow-screen drawers

`useMediaQuery(NARROW_QUERY)` (`src/lib/useMediaQuery.ts`, 1180px), read once in `ShellProvider` and handed down as `narrow`, decides which shell `PushConsole` renders. It returns `false` during hydration on purpose, so the prerendered HTML always matches; the narrow layout arrives one frame after mount.

`<body>` is `h-dvh flex flex-col`: the header takes its own height and the page box under it (`min-h-0 flex-1`) fills the rest. On wide screens that box is `overflow-hidden` and each column scrolls on its own; on narrow ones the box itself is `overflow-y-auto`, so the document never scrolls and the bottom action bar sticks to the box.

Wide: a three-column CSS grid — `--side-track` (232px, or 0 with the sidebar closed, in which case the `<Sidebar>` is not rendered at all), the main column, and `--rail-track` (400px, or 64px when the rail is collapsed to its "Show review" stub). Each column scrolls on its own.

Narrow: a single column with a sticky action bar at the bottom (run summary + "Review & execute"). The sidebar becomes a left `Sheet` opened by the hamburger, and the whole `ReviewRail` renders inside a right `Sheet` with `onClose` set, which switches it to drawer mode (no Hide toggle, a Cancel button under Execute). `tryExecute` closes that sheet when validation fails, because the problems are marked on the form it would be covering.

Inside a notification card, fields sit on a 12-column grid above 700px (`min-[700px]:col-span-4` / `-12`) and a 6-column one below.

## Words from the business side

The field names match the backend payload, so keep them exactly as they are:

- `deliv_id` — the delivery ID that ties the push to a campaign (Auto App only)
- `shows` — Normal, In store and Score: one notification holds one or more shows, each `{ code, performer_id, hook }` — the 興行コード, the ワード id, and `preorder`/`firstcome` (In store: always `in_store`). There is no `mixed` value to pick; the server sets `type` per recipient from the topics that recipient gets, and a recipient gets a show's topic only by subscribing to its ワード. So `hookMix` (`src/lib/types.ts`) compares hooks **within each word** for a `word`-reader type: two shows of the same word with different hooks are the test sheet's `mixed(受付)` ("mixed push" badge); different words with the same hook are its `mixed(ワード)` — that hook, naming several words, never `mixed`; different words with different hooks only come out mixed for an account subscribed to both ("mixed for some accounts"). A card naming more than one word warns that the test account must subscribe to all of them — with only some it silently gets fewer words. Score (`list` readers, endpoint unconfirmed) still compares hooks across all shows. Normal's third sample is the `mixed(ワード)` case. A `code` with no `P021…` part makes the server look up every performance under it (slow); the card hints at that.
- `order_lines` / `status` — Order: one status block (one of 7 statuses, the guideline's `data_01`–`data_07`) holds one or more order lines of `member_id`, `kogyo_code`, `kogyo_sub_code`, `event_code`, `management_number`, all sent as text.
- `link_type` — `01` kogyo / SmaTicket bundle, `02` subscribed word ID, `03` e+ web page (Auto App only)
- `push_score_weekly` / `check` / `by_word` / `order` — the user setting that must be ON, or that person gets nothing
- Servers: `ecs-api` (the old Rails batch path, proxied through our route handler) and `express` (`be-push-notification-tool`, called straight from the browser); both implement Auto App Push and Normal Push, dispatched by the `server` state passed into `submitPush` along with the active `pushType`. Express only validates and records Normal Push — it does not deliver it.
- The batch worker checks for jobs every 10 minutes, so a push can arrive up to ten minutes late. `DoneView` tells the user this.

The interface text is English. The notification text itself, and its placeholders, are Japanese (`イープラスのWEBページへ遷移します。`).

## TypeScript settings that can break the build

`tsconfig.json` turns on:

- `verbatimModuleSyntax` — types must be imported as types. This code uses the inline form: `import { fn, type Type }`.
- `erasableSyntaxOnly` — no enums, no namespaces, no constructor parameter properties.
- `noUnusedLocals` and `noUnusedParameters` — an unused variable is an error.

These fail `yarn build`, not just `yarn lint`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
