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

It is Next.js 16 (App Router) + React 19 + TypeScript. There is one route (`src/app/page.tsx`), no state library, no CSS framework, and no network code. Everything is plain `useState`. Imports use the `@/` alias for `src/`.

Only **Auto App Push** works. The other push types in the sidebar are grey and disabled; their names come from `COMING_SOON` in `src/lib/types.ts`.

**Nothing is sent anywhere yet.** `execute()` in `src/components/PushConsole.tsx` only switches the screen to "done", and the `runId` shown on that screen is a made-up string. To connect a real API, change that function (and probably make `DoneView` show what the server returned instead of the local rows).

## How the code is put together

### All state sits in `PushConsole.tsx`

`src/app/page.tsx` is a server component that only renders `<PushConsole />`. `PushConsole` is marked `'use client'`, and rows, recipients, the chosen server, which panels are open, the `checked` flag — all of it is `useState` inside it. The other files in `src/components/` only take props and call functions back up. Don't add local state that copies page state. The one fine exception is the text box in `RecipientsSection`, which is only a draft value.

### `src/lib/types.ts` holds the shared facts

The `LINKS` object maps each link kind (`web`, `kogyo`, `word`) to its `link_type` code and to every word the user sees for that kind: the field label, the placeholder, the help text, and the short `line` used in previews. Three components read the same entry for different screens — `NotificationRowCard` (the form), `ReviewRail` (the live preview), and `DoneView` (the results table).

So adding a new link kind means editing three spots:

1. the `LinkKind` type and the `LINKS` object here,
2. the `KINDS` array in `NotificationRowCard.tsx`, which sets the radio buttons and their order,
3. the matching check inside `errorsFor`.

`errorsFor` is the only validation. It returns full sentences that are shown to the user word for word, so write new ones in the same tone: "Delivery ID is required — the batch needs it to match the campaign."

### Errors only appear after Execute

`rowErrors` stays empty until `checked` turns true, so no red text shows while someone is still typing. When Execute is pressed, `tryExecute`:

1. sets `checked`,
2. runs `errorsFor` again on its own instead of reading the memo, because the memo is still stale in that render,
3. opens any collapsed row that has an error,
4. opens the recipients panel if the ID list is empty.

Only when nothing is wrong does it open `ConfirmDialog`. Keep this order if you add more checks.

`startOver` clears `checked` and `done` but keeps the rows and recipients, so the user can send a similar run again.

### Styling is one CSS file

`src/app/globals.css` (imported once from `layout.tsx`) has the colors and other design values as CSS variables on `:root` (plus `--radius` and `--shadow`), followed by every rule. Every class name starts with `ptc-`. There are no CSS modules, and almost no inline styles. The font is loaded with `next/font/google` in `layout.tsx`, which exposes it as the `--font-sans` variable that `body` reads.

The three-column layout is a CSS grid whose column widths come from variables. `--rail-track` is set inline from React state in `PushConsole.tsx` (400px when open, 64px when closed), and `--side-track` is set to 0 by the `.ptc-noside` class. Note the difference: closing the review rail only makes it narrow — `ReviewRail` still renders, just as a small stub. Closing the sidebar removes it from the page.

Inside a notification card, fields sit on a 12-column grid using the `span-2`, `span-4`, and `span-12` classes.

Screen sizes: at 1180px the rail moves below the main column and the page scrolls normally instead of being a fixed-height app; at 860px the sidebar turns into a row that scrolls sideways; 700px makes a few more small changes.

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
