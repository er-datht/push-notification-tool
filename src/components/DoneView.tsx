import { LINKS, SERVER_LABEL, timeLabel, type NotificationRow, type Server } from '@/lib/types'

interface Props {
  rows: NotificationRow[]
  recipientCount: number
  server: Server
  runId: string
  onStartOver: () => void
}

export function DoneView({ rows, recipientCount, server, runId, onStartOver }: Props) {
  return (
    <div className="ptc-done">
      <span className="ptc-tag-queued">QUEUED</span>
      <h2>{rows.length} notification(s) scheduled</h2>
      <p className="ptc-lede">
        The batch worker picks jobs up on a 10-minute interval, so delivery can trail the scheduled time by up to ten minutes. Nothing here touched PROD.
      </p>
      <div className="ptc-card ptc-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scheduled</th>
              <th>Delivery ID</th>
              <th>Notification</th>
              <th>Opens</th>
              <th>Recipients</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td-time">{timeLabel(r)}</td>
                <td className="td-light">{r.delivId}</td>
                <td>{r.title}</td>
                <td className="td-muted">{LINKS[r.kind].line} · {r.linkValue}</td>
                <td className="td-light">{recipientCount} accounts</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ptc-done-meta">
        <span>Run ID — {runId}</span>
        <span>Dispatched via {SERVER_LABEL[server]}</span>
        <span>Environment — STAG</span>
      </div>
      <button className="ptc-btn" onClick={onStartOver}>Compose another run</button>
    </div>
  )
}
