import type { PushPayload } from "@/lib/api";
import type { PushTypeConfig } from "@/lib/pushTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldHelp } from "@/components/FieldText";
import {
  LINKS,
  pad,
  SERVER_LABEL,
  shortShowId,
  type FormRow,
  type Server,
} from "@/lib/types";

interface Props {
  rows: FormRow[];
  /** The exact body the API said 201 to. The 201 is empty, so this is the only record of the run. */
  payload: PushPayload;
  server: Server;
  pushType: PushTypeConfig;
  onStartOver: () => void;
}

const tableHeaderClass =
  "border-b border-line-2 px-5 py-3.5 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase";
const tableDataCellClass = "border-b border-line-3 px-5 py-4 align-top";

/** Auto App's kogyo link is reduced by the server before it writes the file, and the empty 201
 *  doesn't say so — show the value it will actually use, the way CLAUDE.md documents. Every other
 *  type reads straight off `pushType.preview`. */
function detailsFor(
  pushType: PushTypeConfig,
  row: FormRow | undefined,
): { title: string; line: string } {
  if (!row) return { title: "—", line: "—" };
  const p = pushType.preview(row.values);
  if (pushType.id === "auto_app_push" && row.values.kind === "kogyo") {
    return {
      title: p.title,
      line: `${LINKS.kogyo.line} — ${shortShowId(row.values.linkValue ?? "")}`,
    };
  }
  return p;
}

export function DoneView({
  rows,
  payload,
  server,
  pushType,
  onStartOver,
}: Props) {
  const { date, editions, login_ids, exclude_login_ids, distribute_now } =
    payload;
  const runLabel = `STAG-${pushType.code}-${4820 + editions.length}`;

  return (
    <div className="w-full overflow-y-auto px-5 py-9 sm:px-10 sm:py-14">
      <Badge className="bg-blue-chip text-[11px] font-semibold tracking-[0.08em] text-blue-dark">
        SCHEDULED
      </Badge>
      <h2 className="mt-4 mb-2 text-[28px] font-semibold tracking-tight">
        配信予約しました — {editions.length} {pushType.label} row(s) scheduled
      </h2>
      <p className="mb-8 text-[15px] leading-relaxed font-light text-ink-2">
        The API accepted the run and wrote the delivery file on the server.
        Nothing has been sent. Right now the upload to S3 is switched off on the
        server, so the file goes no further and no push will arrive.
        {distribute_now
          ? " distribute_now was on; it has no effect until that upload is back."
          : " Once it is back, the import job checks every 10 minutes, so a push can arrive up to ten minutes after the time you set."}{" "}
        Nothing here touched PROD.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Scheduled for</th>
              <th className={tableHeaderClass}>Details</th>
              <th className={tableHeaderClass}>Opens</th>
              <th className={tableHeaderClass}>Reference</th>
            </tr>
          </thead>
          <tbody>
            {editions.map((edition, i) => {
              const row = rows[i];
              const [hour, min] = edition.publish_hour_min as [number, number];
              const d = detailsFor(pushType, row);
              return (
                <tr key={i}>
                  <td
                    className={`${tableDataCellClass} font-semibold whitespace-nowrap tabular-nums`}
                  >
                    {date} {pad(hour)}:{pad(min)} JST
                  </td>
                  <td className={tableDataCellClass}>{d.title}</td>
                  <td
                    className={`${tableDataCellClass} font-light break-all text-ink-2`}
                  >
                    {d.line}
                  </td>
                  <td
                    className={`${tableDataCellClass} font-light break-words text-ink-4`}
                  >
                    {row ? pushType.preview(row.values).meta : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-6 flex flex-wrap gap-7 text-[13px] font-light text-ink-3">
        <span>Sent via {SERVER_LABEL[server]}</span>
        <span>Environment — STAG</span>
        {pushType.recipients ? (
          <span>Login IDs sent — {login_ids.length}</span>
        ) : (
          <span>Target users — {editions.length}</span>
        )}
        {exclude_login_ids && exclude_login_ids.length > 0 && (
          <span>Excluded — {exclude_login_ids.length}</span>
        )}
        <span>distribute_now — {distribute_now ? "yes" : "no"}</span>
        <span>Run label — {runLabel}</span>
      </div>
      <p className="mt-6 text-[13.5px] leading-relaxed font-light text-ink-2">
        {pushType.recipients ? (
          <>
            &ldquo;Login IDs sent&rdquo; is not a count of people, either: each
            id has to match an active customer with the right notification
            setting on, and anyone who fails is dropped quietly.
          </>
        ) : (
          "Each target user still has to match the same notification-setting and account checks — a row here is not a guarantee of delivery."
        )}{" "}
        &ldquo;Run label&rdquo; is generated here for reference, not by the API
        — the API itself never returns an id.
      </p>
      <Button className="mt-9" onClick={onStartOver}>
        Start another run
      </Button>
      {pushType.id === "auto_app_push" && (
        <FieldHelp className="mt-3">
          We add 1 to each delivery ID for you, because the API counts the same
          deliv_id twice as one delivery and overwrites the earlier file.
        </FieldHelp>
      )}
    </div>
  );
}
