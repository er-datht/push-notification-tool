---
name: open-pull-request
description: Use when the user asks to open, create, submit or raise the pull request for the current branch of fe-push-notification-tool, or asks to push the branch and make a PR.
argument-hint: "[target-branch] e.g. develop"
---

# Open Pull Request — fe-push-notification-tool

## Overview

Push the current feature branch and open a pull request on **`er-datht/push-notification-tool`**
(this repo's `origin`), with a body built from `.github/pull_request_template.md`.

GitHub is reached **only through the GitHub MCP server `github-personal-datht`**
(`mcp__github-personal-datht__*` tools). The `gh` CLI is not authenticated on this machine — do not
use it, and do not look for another way to reach the remote.

Target/base branch: takes the branch as an optional argument (`argument-hint` above) — e.g.
`/open-pull-request develop` — or the user can name it in the request ("open the PR against
feature/update-ui-for-6-push-notification-types"). Either way, use it as-is and skip step 1b's
detection. With no argument and nothing named, step 1b works one out, defaulting to **`develop`** —
this repo's feature PRs merge into `develop`, not `main`.

## Steps

### 0. Check the GitHub MCP server

- Load the tools if needed (tool search `github-personal-datht`):
  `mcp__github-personal-datht__list_pull_requests`, `mcp__github-personal-datht__create_pull_request`,
  and `mcp__github-personal-datht__update_issue` (sets an open PR's body).
- If they are not available, or the first call fails with a permission/auth error, stop and report
  that the GitHub MCP server is not usable. Nothing gets pushed.

### 1. Pre-flight — read only, change nothing

- `git branch --show-current`. If the branch is `main` or `develop`, stop: a PR needs a feature branch.
- `git status --porcelain`. If anything is uncommitted, list the files and ask whether to open the PR
  without them or stop. **Never commit for the user.** Untracked local-only files such as
  `.claude/settings.local.json` and `.env.local` are not part of any PR — never stage them.
- List the open PRs once: `mcp__github-personal-datht__list_pull_requests` with
  `owner: er-datht`, `repo: push-notification-tool`, `state: open`. Use this one result for both checks:
  - If any PR's head branch (`head.ref`) is the current branch, it is already open. Report its URL.
    If the user asked for its description (or it doesn't follow the template), build the body with
    steps 2–3 and, after a yes, set it with `mcp__github-personal-datht__update_issue`
    (`issue_number: <PR number>`, `body`). Don't push or open anything else. Otherwise stop.
  - Work out the base branch (next step) from the same list.
- `git log <base>..HEAD --oneline`. These are the commits the PR will contain. If empty, stop —
  there is nothing to open a PR for.

### 1b. Work out the base branch — do not assume `develop`

If the user already named a target/base branch, use it and go to step 2.

Otherwise, work it out. Branches here are sometimes stacked — e.g.
`feature/normal-push-api-integration` is cut from `feature/update-ui-for-6-push-notification-types`.
Basing a stacked branch on `develop` puts the parent branch's commits in this PR's diff.

- `git fetch origin` first, so `origin/develop` and the other remote refs are current.
- For each open PR's head branch (`head.ref`), test `git merge-base --is-ancestor origin/<head branch> HEAD`.
  Also test any local branch this one was clearly cut from if it has no PR yet, and say so.
- If one passes, that branch is the parent of this work — propose it as the base.
- If several pass, propose the one with the most recent commit.
- If none pass, **default to `develop`.**

Always show the base — user-named or detected — in step 5 and let the user change it.

### 2. Build the PR body from `.github/pull_request_template.md`

**Read the template file in this run** (`cat .github/pull_request_template.md`) — never write the
body from memory or from an earlier PR, because the template can change. If the file is missing,
stop and ask. The body is that file with the answers filled in, nothing else:

- **Keep the template's text as it is.** Every heading at its level (`# Pull Request`, `## What
  Changed?`, `### Type of Impact`, …) in the same order, every guidance line ("Brief description of
  what you changed and why.", "List affected areas here:"), and every checkbox with its emoji and
  wording. Don't rename, merge, reorder or drop a section, and don't add new `##` sections — extra
  notes go inside the section they belong to.
- **Replace each `<!-- … -->` comment with the answer** in the section it sits in. A comment you
  leave in place means "not filled" (step 3 counts them).
- **Tick a box by changing `- [ ]` to `- [x]`.** Never delete the unticked ones — reviewers read
  them as "no".
- **`❓ Other: **\_**`** — tick it only when nothing above it fits, and replace `\_` with a short
  description of the impact. Otherwise leave the line exactly as it is.

Fill each section only from what the branch shows (`git log <base>..HEAD`,
`git diff <base>...HEAD --stat`, and `git diff <base>...HEAD` for details):

- **What Changed?** — one or two sentences on why, then one bullet per change in plain words. Name
  the push types touched (Auto App, Normal, Last minute/In store, Score, News, Order), the servers
  affected (`ecs-api` proxy, `express`) and the key names a reviewer will grep for (constants,
  config keys, storage keys).
- **Screenshots/Videos** — leave the `<!-- -->` placeholder for the user. Never invent evidence, and
  don't write "None" in its place either.
- **Impact Area Identification** — under "List affected areas here:", one bullet per area the diff
  can reach and how, e.g. `src/lib/pushTypes.ts` (every form, preview), `src/lib/api.ts` (request
  bodies, error mapping), `src/app/api/push/[type]/route.ts` (the ecs-api proxy), `src/lib/storage.ts`
  (saved settings — a key bump resets everyone's once). Tick **Type of Impact** boxes only when the
  diff shows it: shared code for `src/lib/*` or shared components; Database/Config for
  `.env.example` / `next.config.*`; External integrations when a request body or endpoint path
  changes.
- **Type of Change** — tick from the commit prefixes (`feat:` → new feature, `fix:` → bug fix,
  `docs:` → documentation; also documentation when the diff touches `docs/` or `CLAUDE.md`).
  Breaking change only when a request body or contract changed shape. Translation never — there are
  no translation files.
- **Related Documentation** — the docs the branch adds, changes or is based on: `docs/API-DOC-*.md`,
  `docs/PUSH-TYPES-FIELD-REFERENCE.md`, `docs/UI-FIELD-MAPPING.md`, `docs/ERROR-MESSAGES.md`,
  `docs/superpowers/specs/*.md`, `CLAUDE.md`, and outside sources the commits cite (the guideline
  `.pptx`, an ecs-api file and line).
- **How to Test?** — numbered steps. First the setup (`yarn install`, `yarn dev`, the `.env.local`
  keys the tester needs — `ECS_API_URL`, `NEXT_PUBLIC_EXPRESS_API_URL` — without values), then one
  step per change: which push type, which server, what to do, what they should see.
- **Checklist** — tick a box only with evidence from this run:
  - 📝 Code follows project style, ⚠️ No new warnings introduced — `yarn typecheck` and `yarn lint`
    both exit 0 with no warnings, output in front of you. Run them in step 1 if you haven't.
  - 📚 Updated documentation if needed — the diff touches `docs/` or `CLAUDE.md`, or the change
    needs no docs.
  - 💬 Added comments for complex logic — the diff adds comments on the non-obvious parts.
  - 👀 Self-reviewed my code — never; that is the author's call.
  - 🧪 Added/updated tests, ✅ All tests pass locally — never; this repo has no test suite.

  Under the checklist, add one plain line naming the commands that ran and their result, and that
  the project has no tests yet.

End the body with the PR attribution line from the session's instructions, if there is one.

### 3. Check the body against the template

- `grep -E '^#{1,3} ' .github/pull_request_template.md` and the same on the body must print the
  same headings in the same order. If not, fix the body before going on.
- Grep the body for `<!--`. Name each section that still holds an empty template comment — usually
  **Screenshots/Videos**. Report them and ask whether to open the PR anyway. Never fill them in
  yourself.

### 4. Title

Default to the newest commit's subject (`git log -1 --pretty=%s`), which follows this repo's
`feat: …` / `fix: …` / `docs: …` style. If the PR holds several commits, offer a one-line summary
in the same style. Show it and let the user change it.

### 5. Confirm before touching the remote — always summarise both branches

Print this summary every run, naming both branches in full, then the body:

```
Repo:            er-datht/push-notification-tool
Push to remote:  <current branch>  →  origin/<current branch>
Base branch:     <base from step 1b>   (why: <user-specified | ancestor test passed | no ancestor, defaulted to develop>)
Commits in PR:   <n>  (git log <base>..HEAD)
Title:           <title from step 4>
Unfilled:        <sections still holding <!-- --> , or "none">
```

### 5b. Ask the user to approve — straight after the summary, every run

The summary alone is not approval. Immediately after it, ask with `AskUserQuestion` whether to push
and open the PR — one question for both actions, because a push with no PR leaves the branch
half-landed. Name both branches in the question text. Offer at least:

- **Yes** — push `<branch>` to origin and open the PR against `<base>`.
- **No** — stop, push nothing, open nothing.

Add a third option when something is worth changing (a base that fell back to `develop`, unfilled
Screenshots/Videos), so the user can redirect.

Do not push on an approval given earlier in the conversation, on the original "open the PR"
request, or on silence. A "no" ends the run: report that nothing was pushed and no PR was opened.

### 6. Push

`git push -u origin <branch>`

Run it bare — no `| tail`, no `2>&1`. A pipe or redirect changes the command string the permission
rules match against, and the push gets blocked.

If the push is denied, stop. Do not retry more than once and never reach for another route to the
remote. Report that nothing was pushed and no PR exists, and offer the user two options: run the push
themselves with a leading `!` in the prompt, or allow it and retry.

### 7. Open the PR

`mcp__github-personal-datht__create_pull_request` with `owner: er-datht`,
`repo: push-notification-tool`, `base: <base from step 1b>`, `head: <branch>`, the title from
step 4, and the body from step 2.

If it fails, report the error as-is. The branch is already pushed, so say so, and offer to retry
or let the user open the PR on GitHub. Never use `gh`.

### 8. Report

Lead with the PR URL: `Opened: <PR URL>`. Then the head and base branches by name (the same two as
step 5), and the sections the user still has to fill in on GitHub.

## Red flags — stop and ask

- About to run `git commit` or `git add` — the user commits, not you.
- About to `git push --force`, or push to `main` / `develop`.
- About to write content into the Screenshots/Videos placeholder.
- About to write the body without reading `.github/pull_request_template.md` in this run, or to
  rename, reorder, drop or add a `#`/`##`/`###` heading, or delete an unticked checkbox.
- About to tick a Checklist box or write "tests pass" without the command output — and this repo has
  no test suite, so never tick "Added/updated tests" or "All tests pass locally" for it.
- About to push without an explicit yes to the step 5b question, asked after the step 5 summary.
- About to default the base to `develop` without running the step 1b ancestor test — or to `main`
  at all: feature PRs here go to `develop`.
- About to use the `gh` CLI — it is not authenticated here; the GitHub MCP server is the only client.
- About to stage `.claude/settings.local.json`, `.env.local` or any other local-only file.
