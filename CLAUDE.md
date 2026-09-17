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

## What this app is

One page where a person fills in push notifications and sends them to the **STAG environment only**. It came from the Claude Design project `push-tool-console`.

It is Next.js 16 (App Router) + React 19 + TypeScript. There is one page route (`src/app/page.tsx`) plus one route handler, no state library, no CSS framework, and no data-fetching library — `fetch` only. Everything is plain `useState`. Imports use the `@/` alias for `src/`.

Only **Auto App Push** works. The other push types in the sidebar are grey and disabled; their names come from `COMING_SOON` in `src/lib/types.ts`.

## Talking to the API

`docs/API-DOC-auto-app-push.md` is the contract. `execute()` in `PushConsole.tsx` builds the payload with `buildPayload` and posts it through `submitAutoAppPush` (`src/lib/api.ts`) to our own route handler at `src/app/api/push/auto-app-push/route.ts`, which adds `X-APIToken` and forwards to `POST {ECS_API_URL}/api/test_notification/auto_app_pushes`. When the route handler itself has a problem (env not set, body not JSON, host unreachable) it answers with the same `{ error: { code, title, message, errors[] } }` object as the API's failures (the house shape from the EMO API Specification Summary sheet, repeated in `docs/API-DOC-auto-app-push.md`) — `title` is the headline, `message` the sentence under it, `errors[]` raw detail — so `src/lib/api.ts` reads both the same way.

**The browser must never call ecs-api directly.** The token is a shared secret and that path is not in the API's CORS allowlist. `ECS_API_URL` and `TEST_NOTIFICATION_API_TOKEN` are read only inside the route handler and must never be prefixed `NEXT_PUBLIC_`. Copy `.env.example` to `.env.local` to run against staging.

Every body follows the EMO envelope (see the Responses section of `docs/API-DOC-auto-app-push.md`): success is `{ status_code, message, data }`, failure is `{ error: { error_id, code, title, message, errors[] } }`. Four responses matter, and `src/lib/api.ts` is the only place that branches on them:

- **200 / 201** — `data.status` is `validated` (the endpoint is validation-only for now: nothing written, `filename` null, HTTP 200) or `created` (the delivery file reached S3, HTTP 201). Nothing has been sent either way. `DoneView` says *checked* or *scheduled*, never *sent*, and shows `will_publish_at` / `filename` / the cleaned-up `link_item` from `data.editions[]` rather than the local rows. `login_ids_count` sits on `data`, not per edition.
- **422 / 400** — `error.errors[]` is a flat list of `{ error_id, field, message }`; an entry about one edition has a `field` like `editions[n].deliv_id`. `splitErrors` routes those to the matching card and keeps the rest in `error.errors` for the toast, which shows `error.title`, `error.message` and that remainder. 422 is validation; 400 is a body the API could not read (not JSON, or an unknown key — extra keys are rejected, not ignored). Row errors are stored in `PushConsole` as an `ApiVerdict` together with the JSON of the exact payload they answered, and are merged into the `rowErrors` memo only while the current payload still matches that key — so the verdict drops out on its own once anything in the payload changes, without every input handler having to clear it. Only `tryExecute` resets it explicitly, so a re-run of the same payload gets a fresh answer.
- **401** — same error envelope (`AP-0002`); the SSM hint goes to the browser console, not the toast.
- **404** — **empty body**, the only response without one. Never call `res.json()` on it, in the route handler or the client.

`data.login_ids_count` echoes what was sent; it is not a recipient count. IDs are filtered against `push_score_weekly` later with no error anywhere, which `DoneView` spells out.

## How the code is put together

### All state sits in `PushConsole.tsx`

`src/app/page.tsx` is a server component that only renders `<PushConsole />`. `PushConsole` is marked `'use client'`, and rows, recipients, the chosen server, which panels are open, the `checked` flag — all of it is `useState` inside it. The other files in `src/components/` only take props and call functions back up. Don't add local state that copies page state. The one fine exception is the text box in `RecipientsSection`, which is only a draft value.

### `src/lib/types.ts` holds the shared facts

The `LINKS` object maps each link kind (`web`, `kogyo`, `word`) to its `link_type` code and to every word the user sees for that kind: the field label, the placeholder, the help text, and the short `line` used in previews. Three components read the same entry for different screens — `NotificationRowCard` (the form), `ReviewRail` (the live preview), and `DoneView` (the results table).

So adding a new link kind means editing three spots:

1. the `LinkKind` type and the `LINKS` object here,
2. the `KINDS` array in `NotificationRowCard.tsx`, which sets the radio buttons and their order,
3. the matching check inside `errorsFor`.

`errorsFor` holds the per-row rules, `validateRows` wraps it and adds the cross-row duplicate-`deliv_id` check, and `dateErrorFor` covers the one date field shared by every row (so a bad date is reported once, not repeated on every card). The messages are plain sentences in simple words, shown to the user word for word, so write new ones in the same tone: "Enter a delivery ID. The batch uses it to find the campaign."

Some of those rules mirror limits the API enforces server-side, so the tester finds out without a round trip: `deliv_id` ≤ 24 chars, delivery time inside 08:00–22:00 JST, and no more than 2 hours ahead of now.

### Every error names the input it came from

`errorsFor` returns `RowError[]`, not strings: each message carries a `RowField` so `NotificationRowCard` can put it under the right input and set `aria-invalid` on it. A message with no visible field is useless — the tester reads "must be within 2 hours" and has nothing to click. So when you add a rule, give it a field.

`time` is the field for rules about the hour and minute **together** (the 08:00–22:00 window, the 2-hour lead); `hour` and `min` are only for a malformed value in one of the two boxes. `errorsForField(errors, 'hour', 'time')` is how the card asks which marks an input gets, and that pairing is why both boxes redden on a window error but only one does on "Hour must be a whole number".

`splitErrors` gives the API's `422` entries the same treatment, mapping the payload key in each `field` (`deliv_id`, `publish_hour_min`, `link_item`, `link_type`, `title`) onto the matching input via `FIELD_BY_PAYLOAD_KEY`. A key it doesn't recognise still shows, with `field: null`, in the card's fallback summary block — it must never be silently dropped. Add to that map when the API grows a field.

A collapsed card hides its inputs and therefore its marks, so a card with errors gets a red stripe down its left edge (a `before:` pseudo-element on the `Card` in `NotificationRowCard`). That stripe is the whole indicator — an earlier "N to fix" count in the header was removed as noise; don't reintroduce a badge there.

**Times are Asia/Tokyo, not the browser's timezone.** `todayInTokyo` and `tokyoEpoch` convert against a fixed UTC+9 (Japan has no DST); `formatPublishAt` reads the API's `+09:00` timestamp with a regex rather than letting `Date` re-render it locally. Anything read from the clock or `localStorage` is set in a mount effect, never seeded into `useState` — the page is prerendered, so a build-time date would hydrate against a different one.

### Errors only appear after Execute

`rowErrors` stays empty until `checked` turns true, so no red text shows while someone is still typing. When Execute is pressed, `tryExecute`:

1. sets `checked`,
2. runs `validateRows` and `dateErrorFor` again on its own instead of reading the memo, because the memo is still stale in that render,
3. opens any collapsed row that has an error,
4. opens the recipients panel if the ID list is empty.

Only when nothing is wrong does it open `ConfirmDialog`, whose confirm button calls `execute` — the one place that posts anything. Keep this order if you add more checks.

`startOver` clears `checked`, `done`, and the API result, and bumps each `deliv_id` with `nextDelivId`, because the API treats a repeated `deliv_id` as the same delivery. Rows and recipients otherwise survive, so the user can send a similar run again. Login IDs and `distribute_now` also persist to `localStorage` via `src/lib/storage.ts` on each Execute.

### Styling is Tailwind v4 + shadcn/ui

There is no hand-written CSS for components. Every component is styled with Tailwind utility classes, and the interactive pieces (buttons, inputs, labels, checkbox, radio groups, cards, badges, the confirm `Dialog`, the narrow-screen `Sheet` drawers) come from shadcn/ui, generated into `src/components/ui/`. Those files are ours: they have already been tuned to the mockup (6px radius, the blue primary, a `muted` button variant, a flat `Card` with the soft shadow), so edit them there rather than fighting them with `className` overrides at every call site. Add more with `npx shadcn@latest add <name>` (the project is on the Radix-based `radix-nova` preset; see `components.json`). One deliberate deviation: `class-variance-authority` is not used. `Button` and `Badge` keep their variants in plain `as const` lookup objects instead of `cva()`, so if a newly added component imports `cva`, rewrite it the same way and don't add the package back.

`src/app/globals.css` holds only three things: the Tailwind/shadcn imports, the design tokens, and the react-toastify re-theme. The tokens are the mockup's palette written onto shadcn's variable names (`--primary`, `--border`, `--sidebar`, …) in `:root`, plus a few extra `--color-ink-*` / `--color-red-ink` style shades under `@theme inline` for tints shadcn has no slot for — use `text-ink-3`, `bg-red-tint`, `shadow-card` and so on rather than raw hex values. The font is loaded with `next/font/google` in `layout.tsx` as `--font-source-sans`, which the theme maps to `font-sans`.

react-toastify is the one thing still themed with plain CSS: its `.Toastify__*` classes come from the library, so the toast section of `globals.css` maps its `--toastify-*` variables onto the tokens. Restyle it there rather than overriding `.Toastify__*` rules elsewhere.

`FieldText.tsx` has the three tiny helpers every form shares (`FieldHelp`, `FieldError`, `Req`), so the muted help line and the red error line look the same on every input.

### Layout and the narrow-screen drawers

`useMediaQuery(NARROW_QUERY)` (`src/lib/useMediaQuery.ts`, 1180px) decides which shell `PushConsole` renders. It returns `false` during hydration on purpose, so the prerendered HTML always matches; the narrow layout arrives one frame after mount.

Wide: a three-column CSS grid — `--side-track` (232px, or 0 with the sidebar closed, in which case the `<Sidebar>` is not rendered at all), the main column, and `--rail-track` (400px, or 64px when the rail is collapsed to its "Show review" stub). The app is `h-screen` and each column scrolls on its own.

Narrow: a single column with a sticky action bar at the bottom (run summary + "Review & execute"). The sidebar becomes a left `Sheet` opened by the hamburger, and the whole `ReviewRail` renders inside a right `Sheet` with `onClose` set, which switches it to drawer mode (no Hide toggle, a Cancel button under Execute). `tryExecute` closes that sheet when validation fails, because the problems are marked on the form it would be covering.

Inside a notification card, fields sit on a 12-column grid above 700px (`min-[700px]:col-span-4` / `-12`) and a 6-column one below.

## Words from the business side

The field names match the backend payload, so keep them exactly as they are:

- `deliv_id` — the delivery ID that ties the push to a campaign
- `sub_type` — always `auto_app_push` for this push type, shown as read-only
- `link_type` — `01` kogyo / SmaTicket bundle, `02` subscribed word ID, `03` e+ web page
- `push_score_weekly` — the user setting that must be ON, or that person gets nothing
- Servers: `ecs-api` (the old Rails batch path, and the only one that works) and `express` (disabled, "coming soon")
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
