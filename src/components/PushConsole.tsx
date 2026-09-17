'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { RunSettings } from '@/components/RunSettings'
import { RecipientsSection } from '@/components/RecipientsSection'
import { NotificationRowCard } from '@/components/NotificationRowCard'
import { ReviewRail } from '@/components/ReviewRail'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DoneView } from '@/components/DoneView'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { NARROW_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { buildPayload, submitAutoAppPush, type AutoAppPushResult } from '@/lib/api'
import { dismissApiErrors, toastApiError } from '@/lib/toast'
import { loadSettings, saveSettings } from '@/lib/storage'
import {
  dateErrorFor,
  nextDelivId,
  SERVER_LABEL,
  todayInTokyo,
  validateRows,
  type NotificationRow,
  type RowError,
  type Server,
} from '@/lib/types'

const DEFAULT_LOGIN_IDS = ['e-plus-test01', 'e-plus-test02', 'e-plus-test03']

/** What the API said about one exact payload. Shown only while the form still matches it. */
interface ApiVerdict {
  payloadKey: string
  rowErrors: RowError[][]
}

const NO_API_ERRORS: RowError[][] = []

const newRow = (id: number, overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id,
  hour: '15',
  min: '40',
  delivId: '',
  title: '',
  kind: 'web',
  linkValue: '',
  collapsed: false,
  ...overrides,
})

const INITIAL_ROWS: NotificationRow[] = [
  newRow(1, {
    min: '30',
    delivId: 'H020064377',
    title: 'イープラスのWEBページへ遷移します。',
    kind: 'web',
    linkValue: 'https://eplus.jp/',
  }),
  newRow(2, {
    min: '35',
    delivId: 'H020064378',
    title: 'スマチケ公演バンドルをご紹介',
    kind: 'kogyo',
    linkValue: '9041480001-P0030001P021001',
    collapsed: true,
  }),
]

export function PushConsole() {
  const [done, setDone] = useState(false)
  const [server, setServer] = useState<Server>('ecs-api')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const [sideOpen, setSideOpen] = useState(true)
  // Narrow screens swap the sidebar and the rail for drawers. Those have their own open flags so a
  // rail hidden on desktop does not turn into a drawer that is already open after a resize.
  const narrow = useMediaQuery(NARROW_QUERY)
  const [sideDrawer, setSideDrawer] = useState(false)
  const [reviewDrawer, setReviewDrawer] = useState(false)
  const [recipientsOpen, setRecipientsOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loginIds, setLoginIds] = useState<string[]>(DEFAULT_LOGIN_IDS)
  const [rows, setRows] = useState<NotificationRow[]>(INITIAL_ROWS)
  const [nextId, setNextId] = useState(3)
  // These start empty and are filled in by the mount effect below, never here.
  const [date, setDate] = useState('')
  const [minDate, setMinDate] = useState('')
  const [distributeNow, setDistributeNow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AutoAppPushResult | null>(null)
  const [apiVerdict, setApiVerdict] = useState<ApiVerdict | null>(null)

  /** Today in Tokyo, for the date box and its `min`. Only ever called after mount. */
  const resetDate = () => {
    const today = todayInTokyo()
    setDate(today)
    setMinDate(today)
  }

  // The page is prerendered, so the HTML knows nothing about the clock or about localStorage.
  // We read both after mount. Putting them in useState would ship the build-time date and then
  // hydrate against a different one.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    resetDate()
    const saved = loadSettings()
    if (!saved) return
    setLoginIds(saved.loginIds)
    setDistributeNow(saved.distributeNow)
  }, [])
  /* oxlint-enable react/set-state-in-effect */

  const payload = buildPayload(rows, loginIds, date, distributeNow)
  const payloadKey = JSON.stringify(payload)
  // The server's verdict is about one payload. Once any part of it changes, the verdict is stale,
  // so it drops out here on its own instead of being cleared from every input handler.
  const apiRowErrors = apiVerdict?.payloadKey === payloadKey ? apiVerdict.rowErrors : NO_API_ERRORS
  useEffect(() => {
    dismissApiErrors()
  }, [payloadKey])

  const rowErrors = useMemo(() => {
    const local = checked ? validateRows(rows, date) : rows.map((): RowError[] => [])
    return local.map((e, i) => [...e, ...(apiRowErrors[i] ?? [])])
  }, [rows, checked, date, apiRowErrors])

  const noRecipients = checked && loginIds.length === 0
  const dateError = checked ? dateErrorFor(date) : null
  // Only form problems block Execute. A bad token or a host we cannot reach is worth trying
  // again, so it must not turn into a "fix the cards" note when the cards are already fine.
  const hasErrors = noRecipients || !!dateError || rowErrors.some((e) => e.length > 0)

  const patchRow = <K extends keyof NotificationRow>(id: number, field: K, value: NotificationRow[K]) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))

  const addRow = () => {
    setRows((rs) => [...rs.map((r) => ({ ...r, collapsed: true })), newRow(nextId)])
    setNextId((n) => n + 1)
  }

  const tryExecute = () => {
    const errs = validateRows(rows, date)
    const noIds = loginIds.length === 0
    const badDate = dateErrorFor(date)
    setChecked(true)
    // A fresh Execute asks for a fresh verdict, even on the same payload.
    setApiVerdict(null)
    dismissApiErrors()
    if (errs.some((e) => e.length > 0) || noIds || badDate) {
      if (noIds) setRecipientsOpen(true)
      setRows((rs) => rs.map((r, i) => (errs[i].length ? { ...r, collapsed: false } : r)))
      // The problems are marked on the form, which the drawer would be covering.
      setReviewDrawer(false)
      return
    }
    setConfirmOpen(true)
  }

  const execute = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    saveSettings({ loginIds, distributeNow })

    const res = await submitAutoAppPush(payload)
    setSubmitting(false)

    setReviewDrawer(false)
    if (res.ok) {
      setResult(res.data)
      setDone(true)
      return
    }

    setApiVerdict({ payloadKey, rowErrors: res.rowErrors })
    toastApiError(res.error)
    setRows((rs) => rs.map((r, i) => (res.rowErrors[i]?.length ? { ...r, collapsed: false } : r)))
    if (res.error.errors.some((e) => e.field?.startsWith('login_ids'))) setRecipientsOpen(true)
  }

  const startOver = () => {
    setDone(false)
    setChecked(false)
    setConfirmOpen(false)
    setResult(null)
    resetDate()
    // The same deliv_id twice counts as one delivery, so give every row a new one.
    setRows((rs) => rs.map((r) => ({ ...r, delivId: nextDelivId(r.delivId) })))
  }

  const review = (
    <ReviewRail
      open={railOpen}
      onToggle={() => setRailOpen((v) => !v)}
      onClose={narrow ? () => setReviewDrawer(false) : undefined}
      rows={rows}
      recipientCount={loginIds.length}
      date={date}
      distributeNow={distributeNow}
      server={server}
      onServerChange={setServer}
      hasErrors={hasErrors}
      noRecipients={noRecipients}
      badDate={!!dateError}
      submitting={submitting}
      onExecute={tryExecute}
    />
  )

  return (
    <div className={cn('flex flex-col bg-background', narrow ? 'min-h-screen' : 'h-screen overflow-hidden')}>
      <Header
        showSideToggle={!done}
        sideOpen={narrow ? sideDrawer : sideOpen}
        onToggleSide={() => (narrow ? setSideDrawer((v) => !v) : setSideOpen((v) => !v))}
      />

      {done && result ? (
        <DoneView rows={rows} result={result} server={server} onStartOver={startOver} />
      ) : (
        <div
          className={cn(
            'grid min-h-0 flex-1',
            narrow
              ? 'grid-cols-1'
              : sideOpen
                ? 'grid-cols-[232px_minmax(0,1fr)_var(--rail-track)]'
                : // The sidebar is not rendered when closed, so its column must go too — otherwise
                  // <main> lands in an empty first track and the rail takes the 1fr one.
                  'grid-cols-[minmax(0,1fr)_var(--rail-track)]',
          )}
          style={{ '--rail-track': railOpen ? '400px' : '64px' } as React.CSSProperties}
        >
          {sideOpen && !narrow && <Sidebar />}

          <main className={cn('min-w-0 px-5 pt-7 pb-[72px] sm:px-10 sm:pt-9 sm:pb-24', !narrow && 'overflow-y-auto')}>
            <h2 className="mb-2 text-[26px] font-semibold tracking-tight">Auto App Push</h2>
            <p className="max-w-[64ch] text-[15px] leading-relaxed font-light text-ink-2">
              Build one or more notifications here. A person only gets the push if their <em>push_score_weekly</em> setting is ON.
              Everything here runs on staging.
            </p>

            <RunSettings
              date={date}
              minDate={minDate}
              dateError={dateError}
              onDateChange={setDate}
              distributeNow={distributeNow}
              onDistributeNowChange={setDistributeNow}
            />

            <RecipientsSection
              loginIds={loginIds}
              open={recipientsOpen}
              onToggle={() => setRecipientsOpen((v) => !v)}
              onAdd={(id) => setLoginIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
              onRemove={(id) => setLoginIds((ids) => ids.filter((x) => x !== id))}
            />

            <div className="mt-10 mb-4 flex items-baseline justify-between">
              <h3 className="text-[17px] font-semibold">Notifications</h3>
            </div>

            <div className="flex flex-col gap-[18px]">
              {rows.map((row, i) => (
                <NotificationRowCard
                  key={row.id}
                  row={row}
                  index={i}
                  errors={rowErrors[i]}
                  canRemove={rows.length > 1}
                  onPatch={(field, value) => patchRow(row.id, field, value)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              className="mt-5 h-auto border border-dashed border-[#cfd5e0] px-[18px] py-3 text-sm font-medium hover:border-primary"
              onClick={addRow}
            >
              + Add notification
            </Button>
          </main>

          {narrow ? (
            <div className="sticky bottom-0 z-[5] flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t bg-card px-5 py-3 shadow-bar sm:px-8">
              <p className="flex-[1_1_240px] text-[13px] leading-normal font-light text-ink-3">
                <strong className="font-semibold text-foreground">
                  {rows.length} notification{rows.length === 1 ? '' : 's'}
                </strong>{' '}
                · {loginIds.length} recipient
                {loginIds.length === 1 ? '' : 's'} · {date || '—'} JST · {SERVER_LABEL[server]}
              </p>
              <Button
                size="lg"
                className="w-full sm:ml-auto sm:w-auto sm:min-w-[200px]"
                onClick={() => setReviewDrawer(true)}
                disabled={submitting}
              >
                {submitting ? 'Executing…' : 'Review & execute'}
              </Button>
            </div>
          ) : (
            review
          )}
        </div>
      )}

      {narrow && !done && (
        <>
          <Drawer direction="left" open={sideDrawer} onOpenChange={(o) => !o && setSideDrawer(false)}>
            <DrawerContent
              showCloseButton
              className="bg-sidebar text-sidebar-foreground [&_[data-slot=drawer-close]]:text-sidebar-foreground [&_[data-slot=drawer-close]]:hover:bg-sidebar-accent [&_[data-slot=drawer-close]]:hover:text-white"
            >
              <DrawerTitle className="sr-only">Push types</DrawerTitle>
              <Sidebar className="h-full pt-[22px]" />
            </DrawerContent>
          </Drawer>
          <Drawer direction="right" open={reviewDrawer} onOpenChange={(o) => !o && setReviewDrawer(false)}>
            <DrawerContent showCloseButton>
              <DrawerTitle className="sr-only">Review</DrawerTitle>
              {review}
            </DrawerContent>
          </Drawer>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Execute ${rows.length} push notification(s)?`}
        body={`This writes the delivery file on ${SERVER_LABEL[server]} in STAG for ${date} JST, for ${loginIds.length} test account(s). ${
          distributeNow ? 'distribute_now is ON, so the job runs right away.' : 'The import job picks it up within the next 10 minutes.'
        } After that you cannot take it back.`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={execute}
      />
    </div>
  )
}
