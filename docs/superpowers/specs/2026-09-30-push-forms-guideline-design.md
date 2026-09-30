# Rebuild the 6 push-type forms to match the guideline (+ Normal Push API contract)

**Status:** implemented (2026-09-30). Added during implementation, at the user's request: every
form is split into **Common settings** (run settings, environment, prerequisites, Recipients area)
and **{type} settings** (Order's start time, then the notification cards). Also fixed on the way:
Auto App's request no longer carries a stray `kind` key (both servers reject unknown keys).

## Context

`docs/PUSH-TYPES-FIELD-REFERENCE.md` (built from the e+ Cloud guideline and mirrored by
`Push-Types-Field-Reference.pptx`) lists 10 gaps between today's forms and the guideline. The
biggest: Normal / In store / Score group **several shows under one time**, Order groups **several
order lines under one status**, but the form is one flat row per notification. The user asked to
update the form UI of all 6 types to match.

During design we found `fe/docs/API-DOC-normal-push.md` — the real ecs-api contract for Normal Push.
Decisions made with the user:

| Decision | Choice |
| --- | --- |
| Request body for grouped types | **Nested** — one card = one notification (`shows[]` / `order_lines[]`) |
| login_ids for Normal / In store / News / Order | **Leave the key out** (only Auto App + Score send it) |
| Normal Push contract | **Follow `API-DOC-normal-push.md` on both servers** (ecs-api proxy + Express) |
| Express scope | **Reshape the uncommitted Express normal-push pilot** to that same contract |
| In store / Score show keys | **Same as Normal: `code` / `performer_id` / `hook`** (still unconfirmed) |
| Auto App | **Contract unchanged** (confirmed); only UI clean-up |

Goal: every form collects exactly the guideline's fields, Normal Push works end to end on both
servers per its API doc, and gaps 1–9 in the field reference are closed (gap 10 — time windows —
stays open, except Normal whose window the API doc now defines).

## Request bodies after the change

- **Auto App** — unchanged: `{ date, login_ids, editions: [{ publish_hour_min, deliv_id, title, link_type, link_item }], distribute_now }`.
- **Normal** (API doc) — `{ date, editions: [{ publish_hour_min, shows: [{ code, performer_id, hook }] }], distribute_now }`. `hook` ∈ `preorder`/`firstcome`. No `login_ids` key.
- **In store** — same as Normal, `hook` always `in_store` (shown read-only, sent). No `login_ids`.
- **Score** — same shows shape, `hook` ∈ `preorder`/`firstcome`, **plus `login_ids`**. No `target_user`.
- **News** — `{ date, editions: [{ publish_hour_min, article_id, word_id, title }], distribute_now }`. No `login_ids`.
- **Order** — `{ date, exclude_login_ids, editions: [{ publish_hour_min, status, order_lines: [{ member_id, kogyo_code, kogyo_sub_code, event_code, management_number }] }], distribute_now }`. `publish_hour_min` = global start + 5 min × block index. Order-line values are **strings** (keep `0106`, `001`). No `login_ids`, no `number` key.

Numbers sent: `performer_id`, `article_id`, `word_id` (via new explicit `sendAs: "number"`).
`performer_id` must be a safe integer ≤ 16 digits.

## Frontend design (`fe-push-notification-tool`)

**Model** (`src/lib/types.ts`, `src/lib/pushTypes.ts`, `src/lib/fields.ts`)
- `FormItem = { id: number; values: Record<string,string> }`; `FormRow` gains `items: FormItem[]` (`[]` for flat types). Item ids come from the shared `nextId` (so `addRow` consumes 2 ids).
- `PushTypeConfig`: replace `recipients`/`recipientsNote` with `readers: "list" | "word" | "order"`; add optional `items: { key: "shows" | "order_lines"; noun; fields; blank(); fixed?: Record<string,string> }` (min 1 item per row); `samples: { values; items? }[]`; `preview(row: FormRow)`; `allowPast?` (Normal); widen `noun` (Order rows become a "Status block"). Remove display-only `_sub` fields (Auto App `auto_app_push`, News `spice`) and Score `target_user`.
- `FieldConfig.sendAs?: "number"` replaces the implicit `numeric || digits` cast; `numeric` only sets `inputMode`. `EVENT_RE` → `/^\d+-P\d+(?:P\d+)?$/`; new `normalizeCode()` strips a leading `[公演]` and is used by both validation and `buildPayload`.
- Per type: values from the field reference (Normal hooks `firstcome`/`preorder`, In store fixed `in_store`, Score `firstcome`/`preorder`, Order 7 statuses), chips/samples from the guideline. Normal: `windowEndMin = 21*60`, no `leadMs`, `allowPast`, `backendConfirmed: true`. In store / Score / News / Order: `leadMs` 2 h. Other windows unchanged (gap 10).

**Validation** (`src/lib/types.ts`)
- `errorsFor` checks item fields; item errors use the payload-relative path as `RowError.field` (`shows[1].code`); "at least one show / order line" errors use `shows` / `order_lines`. Past-time check skipped when `allowPast`.
- `validateRows` adds Normal's NP-0208 mirror: two editions < 60 min apart → error on the later one's `time`.
- `globalTimeErrorFor(hour, min, pushType, date, now, rowCount)` checks window, past and 2-hour lead for **every** block time (start + 5×i), not just the start.

**API layer** (`src/lib/api.ts`, `src/lib/apiMessages.ts`, `src/lib/storage.ts`)
- `buildPayload` builds the shapes above; never drops blank items (keeps `shows[j]` aligned with `row.items[j]`); `login_ids` only for `readers === "list"`; `exclude_login_ids` for `"order"`. Payload types allow nested arrays; `login_ids` optional.
- `splitErrors`: `^editions\[(\d+)\]\.(.+)$`; map only the leading `[a-z_]+` segment through `FIELD_BY_PAYLOAD_KEY`, keep the rest (`shows[0].code`).
- `submitPush` reads a 2xx JSON body when present → `SubmitResult.created?: { id, period_start, period_end, status, topics_count }[]`.
- `apiMessages.ts`: wording for NP-0001…0208 (NP-0208 = "that hour is already taken"; NP-0005/0006 warn earlier editions may already exist). Keep AP-0002/AP-0003 wording (Express still answers those).
- `storage.ts`: bump the storage key so the new default lists apply; don't discard a saved excluded list when `loginIds` is empty.
- `PushConsole` defaults: guideline's 10 login IDs; 4 excluded IDs.

**UI** (`src/components/`)
- New `FieldControl.tsx` — extracted from `NotificationRowCard` (text / seg / chips / fixed branches, `aria-invalid`, error ids) with an item-scoped id prefix (`ptc-row-{rowId}-item-{itemId}-…`) and a separate error key.
- New `ItemList.tsx` — sub-panels "Show 1…", remove × (disabled at 1), "+ Add show" / "+ Add order line"; read-only `fixed` values (In store `hook: in_store`). Normal extras: "mixed push" badge when an edition has both hooks; hint when a `code` has no `P021…` part (slow expansion).
- `NotificationRowCard` — uses both; errors whose field no rendered input owns go to the "The API also said" block (fixes silently dropped errors, incl. Order `time`).
- `PushConsole` — `patchItem` / `addItem` / `removeItem`; readers-driven Recipients area (list → `RecipientsSection`; word → blue note; order → `RecipientsSection` with only the excluded list + note); `noIds` only for `list`; `ptc-global-time` scroll target; store `created`, clear it in `startOver` / `switchPushType`; bottom bar + ConfirmDialog copy by `readers` (counts notifications and shows/lines).
- `GlobalTimeSection` (id + "Status block" wording), `RecipientsSection` (login list optional), `ReviewRail` (per-notification cards listing shows/lines; recipients text by `readers`; no `target_user`), `DoneView` (no `login_ids.length` crash; show `created` id / window / topics_count for Normal; readers-based footer; note that re-running the same hour hits NP-0208), `RunSettings` / DoneView copy that assumes "upload is off" made type- and server-aware (Normal on ecs-api creates real records; `distribute_now` publishes after 30 s).
- `src/app/api/push/[type]/route.ts` — comment only (201 can carry a body).

## Express design (`be-push-notification-tool`, `src/modules/normal-push/`, uncommitted pilot)

- Same contract as `API-DOC-normal-push.md`: keys `date` / `editions[{ publish_hour_min, shows[{ code, performer_id, hook }] }]` / `distribute_now`; `login_ids` → 400 `NP-0004` (unknown key).
- Ids renamed to the doc's `NP-` catalogue: NP-0001 (422), NP-0004 (400), NP-0005 (500), NP-0101 date, NP-0103 editions, NP-0104 distribute_now (Express-only extra, like AP-0104), NP-0201 shows empty, NP-0202 code blank, NP-0203 code invalid, NP-0204 performer_id, NP-0205 hook, NP-0206 publish_hour_min malformed, NP-0207 start outside 08:00–21:00, NP-0208 overlap. Known coupling unchanged: 401 / bad JSON still answer AP-0002 / AP-0003.
- NP-0208: in-request check in pure `validate.ts`; DB check in `service.ts` after validation (`publishAt` strictly within ±60 min, compared as UTC `Date` params). 201 body: `{ editions: [{ id: Number(id), period_start, period_end, status: "edited", topics_count: shows.length }] }` with `+09:00` ISO times (new formatter in `src/lib/time.ts`).
- Prisma: `NormalPushShow { editionId, code VarChar(64), performerId BigInt, hook VarChar(16) }`; drop `NormalPushRun.loginIds` and `NormalPushEdition.subType/targetEvent/wordId`; `@@index([publishAt])`. New migration via `--create-only`, review SQL, apply, `yarn db:generate` (no reset of the local DB). Tests truncate shows → editions → runs.

## Implementation order

Once this plan is approved, I'll save the design as
`fe/docs/superpowers/specs/2026-09-30-push-forms-guideline-design.md` (the brainstorming step's
spec) and follow the steps below. I won't commit until you ask.

**FE** — run `yarn typecheck && yarn lint` after each step.
0. Record the Auto App payload for the sample rows (the "golden" payload) so later steps can prove it didn't change.
1. `fields.ts` and `types.ts` model.
2. `pushTypes.ts` (all 6 types).
3. Validation in `types.ts`.
4. `api.ts`, `apiMessages.ts` and `storage.ts`; compare Auto App against the golden payload.
5. Extract `FieldControl` with no behavior change, then add `ItemList` and the unplaced-error fix in `NotificationRowCard`.
6. `PushConsole`, `RecipientsSection` and `GlobalTimeSection`.
7. `ReviewRail`, `DoneView`, `ConfirmDialog`/`RunSettings` copy, then `yarn build`.
8. Docs: `CLAUDE.md`, `PUSH-TYPES-FIELD-REFERENCE.md` (mark gaps 1–9 closed), `UI-FIELD-MAPPING.md`, `ERROR-MESSAGES.md`.

**BE** — run `yarn typecheck && yarn lint && yarn test` after each step.
1. Schema, migration and generate.
2. `errors`, `schema` and `validate`, plus their unit tests.
3. `time` formatter, `service` and `router`, plus integration tests.
4. `CLAUDE.md`, `README` and the design spec.

## Verification

- **BE:** start MySQL (`docker compose up -d`, currently stopped), then `yarn typecheck && yarn lint && yarn test`. Hit the endpoint with curl: expect a nested `201` JSON body, `400 NP-0004` when `login_ids` is sent, `422 NP-0207` for 21:30, and `422 NP-0208` for a second edition in the same hour.
- **FE:** `yarn typecheck && yarn lint && yarn build`. Then open the dev server in the browser pane (port 3001) and walk all 6 types:
  - add/remove shows and order lines
  - errors marked on the right item input
  - mixed badge and the `P021` hint
  - Order block times and the 2-hour check
  - the Recipients area for each reader kind
  - the Review rail and the Done screen

  Check the request body in the network requests for every type. For Auto App, it must be byte-identical to the golden payload.
- **Normal Push end to end on express** against the local BE: success shows the ids, window and topics_count; errors land on the right show input; a repeated hour gives NP-0208.
- **Not verifiable here:** ecs-api staging for Normal (it depends on that branch being deployed), and the 4 guessed endpoints (In store, Score, News, Order).
