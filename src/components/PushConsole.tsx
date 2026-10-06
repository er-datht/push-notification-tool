"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { RunSettings } from "@/components/RunSettings";
import { RecipientsSection } from "@/components/RecipientsSection";
import { GlobalTimeSection } from "@/components/GlobalTimeSection";
import { NotificationRowCard } from "@/components/NotificationRowCard";
import { ReviewRail } from "@/components/ReviewRail";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DoneView } from "@/components/DoneView";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useShell } from "@/lib/shell";
import { cn } from "@/lib/utils";
import {
  buildPayload,
  submitPush,
  type CreatedEdition,
  type PushPayload,
} from "@/lib/api";
import { dismissApiErrors, toastApiError } from "@/lib/toast";
import { loadSettings, saveSettings } from "@/lib/storage";
import {
  newRowValues,
  PUSH_TYPE_ORDER,
  PUSH_TYPES,
  retimeRows,
  withPlaceholders,
  type PushTypeConfig,
  type PushTypeId,
} from "@/lib/pushTypes";
import {
  bumpDelivId,
  dateErrorFor,
  globalTimeErrorFor,
  rowDomId,
  SERVER_LABEL,
  timeFor,
  todayInTokyo,
  validateRows,
  type FormRow,
  type RowError,
  type Server,
} from "@/lib/types";

/**
 * ecs-api's `PushTest::Common.login_ids` (`lib/push_test/common.rb:8`) — the test accounts Auto App
 * and Score send to. The guideline deck lists 10 different ones; the repo's 7 win.
 */
const DEFAULT_LOGIN_IDS = [
  "502001185",
  "502000539",
  "502001222",
  "502001239",
  "602028303",
  "602028310",
  "602031006",
];
/** `PushTest::Common.exclude_login_ids` (`lib/push_test/common.rb:9`) — skipped by Order Push. */
const DEFAULT_EXCLUDED_IDS = ["602031013", "602028327", "502001161", "602003515"];
const DEFAULT_GLOBAL_HOUR = "15";
const DEFAULT_GLOBAL_MIN = "30";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Who a run reaches, in a few words, for the review rail, the bottom bar and the confirm dialog. */
function audienceFor(
  pushType: PushTypeConfig,
  loginIds: string[],
  excludedIds: string[],
): string {
  if (pushType.readers === "list") return plural(loginIds.length, "recipient");
  if (pushType.readers === "word") return "subscribers of the word";
  return excludedIds.length
    ? `the order-line members, skipping ${excludedIds.length} excluded`
    : "the order-line members";
}

/** What the API said about one exact payload. Shown only while the form still matches it. */
interface ApiVerdict {
  payloadKey: string;
  rowErrors: RowError[][];
}

const NO_API_ERRORS: RowError[][] = [];

/** Every type keeps its own row list, seeded from its own `samples`, so switching types never
 *  discards in-progress work. One `id` counter is shared across all of them. */
function buildInitialRows(): {
  rowsByType: Record<PushTypeId, FormRow[]>;
  nextId: number;
} {
  let id = 1;
  const rowsByType = {} as Record<PushTypeId, FormRow[]>;
  for (const typeId of PUSH_TYPE_ORDER) {
    rowsByType[typeId] = PUSH_TYPES[typeId].samples.map((sample, i) => ({
      id: id++,
      collapsed: i > 0,
      values: sample.values,
      items: (sample.items ?? []).map((values) => ({ id: id++, values })),
    }));
  }
  return { rowsByType, nextId: id };
}

const INITIAL = buildInitialRows();

export function PushConsole() {
  const [pushTypeId, setPushTypeId] = useState<PushTypeId>("auto_app_push");
  const pushType = PUSH_TYPES[pushTypeId];
  const [done, setDone] = useState(false);
  const [chosenServer, setServer] = useState<Server>("ecs-api");
  // A type with no endpoint on the chosen server goes to ecs-api. The choice itself is kept, so
  // switching back to a type express has brings it back.
  const server: Server = pushType.unavailableOn?.includes(chosenServer)
    ? "ecs-api"
    : chosenServer;
  // The X-APIToken lives in state only. It is a secret, so it is never written to localStorage.
  const [apiToken, setApiToken] = useState("");
  // What the API said about the last token it was sent. Cleared as soon as the token changes.
  const [apiTokenError, setApiTokenError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  // The push-type list is toggled from the header, which the layout renders above this page, so
  // its open flags live in ShellProvider. The review rail's own flags stay here: a rail hidden on
  // desktop must not turn into a drawer that is already open after a resize.
  const { narrow, sideOpen, sideDrawer, closeSideDrawer, setSideToggle } =
    useShell();
  const [reviewDrawer, setReviewDrawer] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loginIds, setLoginIds] = useState<string[]>(DEFAULT_LOGIN_IDS);
  // Order push only, but kept here (not per-type) — it's the tester's session data, like loginIds.
  const [excludedIds, setExcludedIds] = useState<string[]>(DEFAULT_EXCLUDED_IDS);
  const [rowsByType, setRowsByType] = useState(INITIAL.rowsByType);
  const [nextId, setNextId] = useState(INITIAL.nextId);
  const rows = rowsByType[pushTypeId];
  // These start empty and are filled in by the mount effect below, never here.
  const [date, setDate] = useState("");
  const [minDate, setMinDate] = useState("");
  const [distributeNow, setDistributeNow] = useState(false);
  // Order push's shared start time — a session setting, like date, not per-type.
  const [globalHour, setGlobalHour] = useState(DEFAULT_GLOBAL_HOUR);
  const [globalMin, setGlobalMin] = useState(DEFAULT_GLOBAL_MIN);
  const [submitting, setSubmitting] = useState(false);
  // The payload the API said 201 to. Auto App's 201 is empty, so this is the whole record of that run.
  const [sent, setSent] = useState<PushPayload | null>(null);
  // What a 201 with a body handed back (every type but Auto App): the editions the server created.
  const [created, setCreated] = useState<CreatedEdition[] | null>(null);
  const [apiVerdict, setApiVerdict] = useState<ApiVerdict | null>(null);
  // The DOM id of the first thing that needs fixing. A card below the fold gets marked red
  // without anyone seeing it, so after a blocked Execute the page moves there.
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  /** Today in Tokyo, for the date box and its `min`. Only ever called after mount. */
  const resetDate = () => {
    const today = todayInTokyo();
    setDate(today);
    setMinDate(today);
    return today;
  };

  const setRows = (fn: (rs: FormRow[]) => FormRow[]) =>
    setRowsByType((byType) => ({
      ...byType,
      [pushTypeId]: fn(byType[pushTypeId]),
    }));

  // The page is prerendered, so the HTML knows nothing about the clock or about localStorage.
  // We read both after mount. Putting them in useState would ship the build-time date and then
  // hydrate against a different one.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    const today = resetDate();
    // The samples' fixed times can break a rule read from the clock (Auto App's 2-hour cap), so
    // they are moved to pass it here, after mount, never in the prerendered seed.
    const now = new Date();
    setRowsByType((byType) => {
      const out = { ...byType };
      for (const id of PUSH_TYPE_ORDER)
        out[id] = retimeRows(PUSH_TYPES[id], byType[id], today, now);
      return out;
    });
    const saved = loadSettings();
    if (!saved) return;
    if (saved.loginIds.length) setLoginIds(saved.loginIds);
    setDistributeNow(saved.distributeNow);
    setExcludedIds(saved.excludedIds);
  }, []);

  // Runs after the render that opened the collapsed cards, so the target has its final place.
  // scrollIntoView walks nested scroll containers, so <main> on wide screens works as well as
  // the document on narrow ones.
  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(scrollTo);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // The first red input, so a keyboard user can start typing. The target may be that input
    // itself (the date box) or a card holding several.
    const INVALID = '[aria-invalid="true"]';
    const input = el.matches(INVALID)
      ? el
      : el.querySelector<HTMLElement>(INVALID);
    input?.focus({ preventScroll: true });
    setScrollTo(null);
  }, [scrollTo]);
  /* oxlint-enable react/set-state-in-effect */

  const globalTime = { hour: globalHour, min: globalMin };
  const payload = buildPayload(
    rows,
    loginIds,
    excludedIds,
    date,
    distributeNow,
    pushType,
    globalTime,
  );
  const payloadKey = JSON.stringify(payload);
  // The server's verdict is about one payload. Once any part of it changes, the verdict is stale,
  // so it drops out here on its own instead of being cleared from every input handler.
  const apiRowErrors =
    apiVerdict?.payloadKey === payloadKey
      ? apiVerdict.rowErrors
      : NO_API_ERRORS;
  useEffect(() => {
    dismissApiErrors();
  }, [payloadKey]);

  const rowErrors = useMemo(() => {
    const local = checked
      ? validateRows(rows, pushType, date)
      : rows.map((): RowError[] => []);
    return local.map((e, i) => [...e, ...(apiRowErrors[i] ?? [])]);
  }, [rows, pushType, checked, date, apiRowErrors]);

  const needsIds = pushType.readers === "list";
  const noRecipients = checked && needsIds && loginIds.length === 0;
  const dateError = checked ? dateErrorFor(date) : null;
  const globalTimeError =
    checked && pushType.globalTime
      ? globalTimeErrorFor(globalHour, globalMin)
      : null;
  const audience = audienceFor(pushType, loginIds, excludedIds);
  const itemCount = rows.reduce((n, r) => n + r.items.length, 0);
  const itemsText = pushType.items
    ? plural(itemCount, pushType.items.noun.toLowerCase())
    : null;
  const tokenMissing = !apiToken.trim();
  const tokenError =
    checked && tokenMissing ? "Enter the API token." : apiTokenError;
  // Only form problems block Execute. A rejected token or a host we cannot reach is worth trying
  // again, so it must not turn into a "fix the cards" note when the cards are already fine.
  const hasErrors =
    noRecipients ||
    !!dateError ||
    !!globalTimeError ||
    (checked && tokenMissing) ||
    rowErrors.some((e) => e.length > 0);

  const patchRow = (id: number, key: string, value: string) =>
    setRows((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r,
      ),
    );

  const toggleRow = (id: number) =>
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, collapsed: !r.collapsed } : r)),
    );

  const removeRow = (id: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const addRow = () => {
    const group = pushType.items;
    setRows((rs) => [
      ...rs.map((r) => ({ ...r, collapsed: true })),
      {
        id: nextId,
        collapsed: false,
        values: newRowValues(pushType, rs, date),
        items: group
          ? [
              {
                id: nextId + 1,
                values: withPlaceholders(group.fields, group.blank()),
              },
            ]
          : [],
      },
    ]);
    setNextId((n) => n + 2);
  };

  const patchItem = (rowId: number, itemId: number, key: string, value: string) =>
    setRows((rs) =>
      rs.map((r) =>
        r.id === rowId
          ? {
              ...r,
              items: r.items.map((it) =>
                it.id === itemId
                  ? { ...it, values: { ...it.values, [key]: value } }
                  : it,
              ),
            }
          : r,
      ),
    );

  const addItem = (rowId: number) => {
    const group = pushType.items;
    if (!group) return;
    setRows((rs) =>
      rs.map((r) =>
        r.id === rowId
          ? {
              ...r,
              items: [
                ...r.items,
                {
                  id: nextId,
                  values: withPlaceholders(group.fields, group.blank()),
                },
              ],
            }
          : r,
      ),
    );
    setNextId((n) => n + 1);
  };

  const removeItem = (rowId: number, itemId: number) =>
    setRows((rs) =>
      rs.map((r) =>
        r.id === rowId && r.items.length > 1
          ? { ...r, items: r.items.filter((it) => it.id !== itemId) }
          : r,
      ),
    );

  const tryExecute = () => {
    const errs = validateRows(rows, pushType, date);
    const noIds = needsIds && loginIds.length === 0;
    const badDate = dateErrorFor(date);
    const badGlobalTime = pushType.globalTime
      ? globalTimeErrorFor(globalHour, globalMin)
      : null;
    setChecked(true);
    // A fresh Execute asks for a fresh verdict, even on the same payload.
    setApiVerdict(null);
    setApiTokenError(null);
    dismissApiErrors();
    if (errs.some((e) => e.length > 0) || noIds || badDate || badGlobalTime) {
      if (noIds) setRecipientsOpen(true);
      setRows((rs) =>
        rs.map((r, i) => (errs[i].length ? { ...r, collapsed: false } : r)),
      );
      // The problems are marked on the form, which the drawer would be covering.
      setReviewDrawer(false);
      // A bad card goes to the top of the view. The date box, the Recipients card and the
      // global time are near the top already, so they come after.
      const firstBadRow = rows.find((_, i) => errs[i].length > 0);
      setScrollTo(
        firstBadRow
          ? rowDomId(firstBadRow.id)
          : noIds
            ? "ptc-recipients"
            : badGlobalTime
              ? "ptc-global-time"
              : badDate
                ? "ptc-date"
                : null,
      );
      return;
    }
    // The token field sits in the rail itself, so that stays where it is (and opens if hidden).
    if (tokenMissing) {
      setRailOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const execute = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    saveSettings({ loginIds, distributeNow, excludedIds });

    const res = await submitPush(payload, apiToken, server, pushType);
    setSubmitting(false);

    if (res.ok) {
      setReviewDrawer(false);
      setSent(payload);
      setCreated(res.created ?? null);
      setDone(true);
      // The done screen has no push-type list, so the header's menu button goes with it.
      setSideToggle(false);
      return;
    }

    setApiVerdict({ payloadKey, rowErrors: res.rowErrors });
    setApiTokenError(res.tokenError);
    // A rejected token is marked in the rail, so keep that in view; anything else is on the form.
    if (res.tokenError) setRailOpen(true);
    else setReviewDrawer(false);
    toastApiError(res.error);
    setRows((rs) =>
      rs.map((r, i) =>
        res.rowErrors[i]?.length ? { ...r, collapsed: false } : r,
      ),
    );
    const aboutLoginIds = res.error.errors.some(
      (e) =>
        e.field?.startsWith("login_ids") ||
        e.field?.startsWith("exclude_login_ids"),
    );
    if (aboutLoginIds) setRecipientsOpen(true);
    const firstBadRow = rows.find((_, i) => res.rowErrors[i]?.length);
    setScrollTo(
      firstBadRow
        ? rowDomId(firstBadRow.id)
        : aboutLoginIds
          ? "ptc-recipients"
          : null,
    );
  };

  const startOver = () => {
    setDone(false);
    setSideToggle(true);
    setChecked(false);
    setConfirmOpen(false);
    setSent(null);
    setCreated(null);
    resetDate();
    // The same deliv_id twice counts as one delivery (Auto App only — a no-op for every other
    // type, which has no deliv_id field), so give every row a new one.
    setRows((rs) => rs.map((r) => bumpDelivId(r, pushType)));
  };

  // Recipients, the token, the server choice, and run settings (date/distribute_now/global time)
  // are about the tester's session, not the push type, so they survive a switch. Each type keeps
  // its own row list (rowsByType), so switching no longer discards in-progress work either — only
  // the verdict on one specific submission attempt resets, since it belongs to a payload that's
  // about to change shape entirely.
  const switchPushType = (id: PushTypeId) => {
    if (id === pushTypeId) return;
    setPushTypeId(id);
    setChecked(false);
    setDone(false);
    setConfirmOpen(false);
    setSent(null);
    setCreated(null);
    setApiVerdict(null);
    setApiTokenError(null);
    setScrollTo(null);
    if (narrow) closeSideDrawer();
  };

  const review = (
    <ReviewRail
      open={railOpen}
      onToggle={() => setRailOpen((v) => !v)}
      onClose={narrow ? () => setReviewDrawer(false) : undefined}
      rows={rows}
      pushType={pushType}
      audience={audience}
      excludedIds={excludedIds}
      date={date}
      distributeNow={distributeNow}
      globalHour={globalHour}
      globalMin={globalMin}
      server={server}
      onServerChange={setServer}
      apiToken={apiToken}
      onApiTokenChange={(v) => {
        setApiToken(v);
        setApiTokenError(null);
      }}
      apiTokenError={tokenError}
      hasErrors={hasErrors}
      submitting={submitting}
      onExecute={tryExecute}
    />
  );

  return (
    // Fills what the header leaves. Wide screens scroll per column; narrow ones scroll the whole
    // page here, which keeps the bottom action bar sticky to this box.
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        narrow ? "overflow-y-auto" : "overflow-hidden",
      )}
    >
      {done && sent ? (
        <DoneView
          rows={rows}
          payload={sent}
          created={created}
          server={server}
          pushType={pushType}
          onStartOver={startOver}
        />
      ) : (
        <div
          className={cn(
            "grid min-h-0 flex-1",
            narrow
              ? "grid-cols-1"
              : sideOpen
                ? "grid-cols-[232px_minmax(0,1fr)_var(--rail-track)]"
                : // The sidebar is not rendered when closed, so its column must go too — otherwise
                  // <main> lands in an empty first track and the rail takes the 1fr one.
                  "grid-cols-[minmax(0,1fr)_var(--rail-track)]",
          )}
          style={
            {
              "--rail-track": railOpen ? "400px" : "64px",
            } as React.CSSProperties
          }
        >
          {sideOpen && !narrow && (
            <Sidebar active={pushTypeId} onSelect={switchPushType} />
          )}

          <main
            className={cn(
              "min-w-0 px-5 pt-7 pb-[72px] sm:px-10 sm:pt-9 sm:pb-24",
              !narrow && "overflow-y-auto",
            )}
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[26px] font-semibold tracking-tight">
                {pushType.label}
              </h2>
              <span className="text-[14px] font-light text-ink-4">
                {pushType.jp}
              </span>
              <span className="rounded-lg bg-muted px-[9px] py-[3px] text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                Category · {pushType.category}
              </span>
            </div>
            <p className="max-w-[64ch] text-[15px] leading-relaxed font-light text-ink-2">
              {pushType.description}
            </p>
            <section aria-labelledby="ptc-common-heading" className="mt-9">
              <h3
                id="ptc-common-heading"
                className="text-[17px] font-semibold"
              >
                Common settings
              </h3>
              <p className="mt-1 mb-4 text-[13px] font-light text-ink-4">
                Shared by every push type. These values stay when you switch
                types.
              </p>
              <div className="flex flex-col gap-5">
                <RunSettings
                  date={date}
                  minDate={minDate}
                  dateError={dateError}
                  onDateChange={setDate}
                  distributeNow={distributeNow}
                  onDistributeNowChange={setDistributeNow}
                  distributeHelp={pushType.distributeNow?.help}
                  distributeRequired={pushType.distributeNow?.required ?? false}
                  prereqs={pushType.prereqs}
                />

                {pushType.readersNote && (
                  <div
                    id={
                      pushType.readers === "word" ? "ptc-recipients" : undefined
                    }
                    className="flex items-baseline gap-x-2.5 gap-y-1 rounded-lg bg-blue-tint px-5.5 py-4"
                  >
                    <span className="text-[15px] font-semibold text-blue-dark">
                      Recipients
                    </span>
                    <p className="text-[13.5px] leading-relaxed font-normal text-blue-dark">
                      {pushType.readersNote}
                    </p>
                  </div>
                )}
                {pushType.readers !== "word" && (
                  <RecipientsSection
                    loginIds={pushType.readers === "list" ? loginIds : undefined}
                    open={recipientsOpen}
                    onToggle={() => setRecipientsOpen((v) => !v)}
                    onAdd={(id) =>
                      setLoginIds((ids) =>
                        ids.includes(id) ? ids : [...ids, id],
                      )
                    }
                    onRemove={(id) =>
                      setLoginIds((ids) => ids.filter((x) => x !== id))
                    }
                    excluded={
                      pushType.readers === "order" ? excludedIds : undefined
                    }
                    onExcludeAdd={(id) =>
                      setExcludedIds((ids) =>
                        ids.includes(id) ? ids : [...ids, id],
                      )
                    }
                    onExcludeRemove={(id) =>
                      setExcludedIds((ids) => ids.filter((x) => x !== id))
                    }
                  />
                )}
              </div>
            </section>

            <section aria-labelledby="ptc-specific-heading" className="mt-12">
              <h3
                id="ptc-specific-heading"
                className="text-[17px] font-semibold"
              >
                {pushType.label} settings
              </h3>
              <p className="mt-1 mb-4 text-[13px] font-light text-ink-4">
                Only for this push type.{" "}
                {pushType.items
                  ? `Each ${pushType.noun.toLowerCase()} holds one or more ${pushType.items.noun.toLowerCase()}s.`
                  : `Each ${pushType.noun.toLowerCase()} is one push.`}
              </p>

              {pushType.globalTime && (
                <div className="mb-5">
                  <GlobalTimeSection
                    pushType={pushType}
                    rows={rows}
                    hour={globalHour}
                    min={globalMin}
                    onHourChange={setGlobalHour}
                    onMinChange={setGlobalMin}
                    error={globalTimeError}
                  />
                </div>
              )}

            <div className="flex flex-col gap-[18px]">
              {rows.map((row, i) => (
                <NotificationRowCard
                  key={row.id}
                  row={row}
                  index={i}
                  pushType={pushType}
                  errors={rowErrors[i]}
                  canRemove={rows.length > 1}
                  computedTime={
                    pushType.globalTime
                      ? timeFor(row.values, i, pushType, globalHour, globalMin)
                      : undefined
                  }
                  onPatch={(key, value) => patchRow(row.id, key, value)}
                  onPatchItem={(itemId, key, value) =>
                    patchItem(row.id, itemId, key, value)
                  }
                  onAddItem={() => addItem(row.id)}
                  onRemoveItem={(itemId) => removeItem(row.id, itemId)}
                  onToggleCollapse={() => toggleRow(row.id)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              className="mt-5 h-auto border border-dashed border-[#cfd5e0] px-[18px] py-3 text-sm font-medium hover:border-primary"
              onClick={addRow}
            >
              + Add {pushType.noun.toLowerCase()}
            </Button>
            </section>
          </main>

          {narrow ? (
            <div className="sticky bottom-0 z-[5] flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t bg-card px-5 py-3 shadow-bar sm:px-8">
              <p className="flex-[1_1_240px] text-[13px] leading-normal font-light text-ink-3">
                <strong className="font-semibold text-foreground">
                  {plural(rows.length, pushType.noun.toLowerCase())}
                </strong>
                {itemsText && ` · ${itemsText}`} · {audience} · {date || "—"}{" "}
                JST · {SERVER_LABEL[server]}
              </p>
              <Button
                size="lg"
                className="w-full sm:ml-auto sm:w-auto sm:min-w-[200px]"
                onClick={() => setReviewDrawer(true)}
                disabled={submitting}
              >
                {submitting ? "Executing…" : "Review & execute"}
              </Button>
            </div>
          ) : (
            review
          )}
        </div>
      )}

      {narrow && !done && (
        <>
          <Drawer
            direction="left"
            open={sideDrawer}
            onOpenChange={(o) => !o && closeSideDrawer()}
          >
            <DrawerContent
              showCloseButton
              className="bg-sidebar text-sidebar-foreground [&_[data-slot=drawer-close]]:text-sidebar-foreground [&_[data-slot=drawer-close]]:hover:bg-sidebar-accent [&_[data-slot=drawer-close]]:hover:text-white"
            >
              <DrawerTitle className="sr-only">Push types</DrawerTitle>
              <Sidebar
                active={pushTypeId}
                onSelect={switchPushType}
                className="h-full pt-[22px]"
              />
            </DrawerContent>
          </Drawer>
          <Drawer
            direction="right"
            open={reviewDrawer}
            onOpenChange={(o) => !o && setReviewDrawer(false)}
          >
            <DrawerContent showCloseButton>
              <DrawerTitle className="sr-only">Review</DrawerTitle>
              {review}
            </DrawerContent>
          </Drawer>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Execute ${plural(rows.length, `${pushType.label} ${pushType.noun.toLowerCase()}`)}?`}
        body={`This sends ${plural(rows.length, pushType.noun.toLowerCase())}${
          itemsText ? ` (${itemsText})` : ""
        } to ${SERVER_LABEL[server]} in STAG for ${date} JST, for ${audience}. ${
          distributeNow
            ? pushType.distributeNow
              ? "distribute_now is ON, so the server publishes it for you."
              : "distribute_now is ON, but the server does nothing with it for this push type yet."
            : pushType.distributeNow?.required
              ? "distribute_now is OFF, so the server only creates the notifications and nothing is sent."
              : "The batch picks it up within the next 10 minutes."
        } After that you cannot take it back.`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={execute}
      />
    </div>
  );
}
