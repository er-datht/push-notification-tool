'use client'

import { useCallback, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { RecipientsSection } from '@/components/RecipientsSection'
import { NotificationRowCard } from '@/components/NotificationRowCard'
import { ReviewRail } from '@/components/ReviewRail'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DoneView } from '@/components/DoneView'
import { errorsFor, SERVER_LABEL, type NotificationRow, type Server } from '@/lib/types'

const DEFAULT_LOGIN_IDS = ['e-plus-test01', 'e-plus-test02', 'e-plus-test03']

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
  newRow(1, { min: '30', delivId: 'H020064377', title: 'イープラスのWEBページへ遷移します。', kind: 'web', linkValue: 'https://eplus.jp/' }),
  newRow(2, { min: '35', delivId: 'H020064378', title: 'スマチケ公演バンドルをご紹介', kind: 'kogyo', linkValue: '9041480001-P0030001P021001', collapsed: true }),
]

export function PushConsole() {
  const [done, setDone] = useState(false)
  const [server, setServer] = useState<Server>('ecs-api')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const [sideOpen, setSideOpen] = useState(true)
  const [recipientsOpen, setRecipientsOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loginIds, setLoginIds] = useState<string[]>(DEFAULT_LOGIN_IDS)
  const [rows, setRows] = useState<NotificationRow[]>(INITIAL_ROWS)
  const [nextId, setNextId] = useState(3)

  const rowErrors = useMemo(() => rows.map((r) => (checked ? errorsFor(r) : [])), [rows, checked])
  const noRecipients = checked && loginIds.length === 0
  const hasErrors = noRecipients || rowErrors.some((e) => e.length > 0)

  const patchRow = useCallback(<K extends keyof NotificationRow>(id: number, field: K, value: NotificationRow[K]) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }, [])

  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))

  const addRow = () => {
    setRows((rs) => [...rs.map((r) => ({ ...r, collapsed: true })), newRow(nextId)])
    setNextId((n) => n + 1)
  }

  const tryExecute = () => {
    const errs = rows.map(errorsFor)
    const noIds = loginIds.length === 0
    setChecked(true)
    if (errs.some((e) => e.length > 0) || noIds) {
      if (noIds) setRecipientsOpen(true)
      setRows((rs) => rs.map((r, i) => (errs[i].length ? { ...r, collapsed: false } : r)))
      return
    }
    setConfirmOpen(true)
  }

  const execute = () => {
    setConfirmOpen(false)
    setDone(true)
  }

  const startOver = () => {
    setDone(false)
    setChecked(false)
    setConfirmOpen(false)
  }

  const closeConfirm = useCallback(() => setConfirmOpen(false), [])

  return (
    <div className="ptc-app">
      <Header showSideToggle={!done} sideOpen={sideOpen} onToggleSide={() => setSideOpen((v) => !v)} />

      {done ? (
        <DoneView rows={rows} recipientCount={loginIds.length} server={server} runId={`STAG-AAP-${4820 + rows.length}`} onStartOver={startOver} />
      ) : (
        <div
          className={`ptc-shell${sideOpen ? '' : ' ptc-noside'}`}
          style={{ '--rail-track': railOpen ? '400px' : '64px' } as React.CSSProperties}
        >
          {sideOpen && <Sidebar />}

          <main className="ptc-main">
            <h2 className="ptc-page-title">Auto App Push</h2>
            <p className="ptc-lede">
              Build one or more notifications here. Recipients only receive a push if their <em>push_score_weekly</em> setting is ON — everything runs against staging.
            </p>

            <RecipientsSection
              loginIds={loginIds}
              open={recipientsOpen}
              onToggle={() => setRecipientsOpen((v) => !v)}
              onAdd={(id) => setLoginIds((ids) => (ids.includes(id) ? ids : [...ids, id]))}
              onRemove={(id) => setLoginIds((ids) => ids.filter((x) => x !== id))}
            />

            <div className="ptc-rows-head">
              <h3>Notifications</h3>
            </div>

            <div className="ptc-rows">
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

            <button className="ptc-btn-dashed" onClick={addRow}>+ Add notification</button>
          </main>

          <ReviewRail
            open={railOpen}
            onToggle={() => setRailOpen((v) => !v)}
            rows={rows}
            recipientCount={loginIds.length}
            server={server}
            onServerChange={setServer}
            hasErrors={hasErrors}
            noRecipients={noRecipients}
            onExecute={tryExecute}
          />
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={`Execute ${rows.length} push notification(s)?`}
          body={`This enqueues the run on ${SERVER_LABEL[server]} in STAG and delivers to ${loginIds.length} test account(s). It cannot be recalled once the batch picks it up.`}
          onCancel={closeConfirm}
          onConfirm={execute}
        />
      )}
    </div>
  )
}
