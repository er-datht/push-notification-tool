import type { CreatedEdition, PushPayload } from "@/lib/api";
import type { PreviewContext, PushTypeConfig } from "@/lib/pushTypes";
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
  /** The exact body the API said 201 to — the record of the run when the 201 is empty. */
  payload: PushPayload;
  /** What a 201 with a body handed back (Normal, In store), in the order the editions were sent. */
  created: CreatedEdition[] | null;
  server: Server;
  pushType: PushTypeConfig;
  onStartOver: () => void;
}

const tableHeaderClass =
  "border-b border-line-2 px-5 py-3.5 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase";
const tableDataCellClass = "border-b border-line-3 px-5 py-4 align-top";

/** `HH:MM` out of an ISO time with its `+09:00` offset, read as written rather than re-rendered locally. */
const clock = (iso: string) => /T(\d{2}:\d{2})/.exec(iso)?.[1] ?? iso;

/** The time a created edition reports: Normal's one-hour window, or In store's single time. */
function createdTime(made: CreatedEdition): string | null {
  if (made.period_start && made.period_end)
    return `${clock(made.period_start)}–${clock(made.period_end)}`;
  return made.will_publish_at ? clock(made.will_publish_at) : null;
}

/** Auto App's kogyo link is reduced by the server before it writes the file, and the empty 201
 *  doesn't say so — show the value it will actually use. Every other type reads `pushType.preview`. */
function detailsFor(
  pushType: PushTypeConfig,
  row: FormRow | undefined,
  ctx: PreviewContext,
): { title: string; line: string } {
  if (!row) return { title: "—", line: "—" };
  const p = pushType.preview(row, ctx);
  if (pushType.id === "auto_app_push" && row.values.kind === "kogyo") {
    return {
      title: p.title,
      line: `${LINKS.kogyo.line} — ${shortShowId(row.values.linkValue ?? "")}`,
    };
  }
  return p;
}

/** What happened on the server, in plain words. It differs by push type and by server. */
function whatHappened(
  pushType: PushTypeConfig,
  server: Server,
  distributeNow: boolean,
): string {
  if (pushType.id === "auto_app_push")
    return `The API accepted the run and wrote the delivery file on the server. Nothing has been sent. Right now the upload to S3 is switched off on the server, so the file goes no further and no push will arrive.${
      distributeNow
        ? " distribute_now was on; it has no effect until that upload is back."
        : " Once it is back, the import job checks every 10 minutes, so a push can arrive up to ten minutes after the time you set."
    }`;
  if (pushType.id === "normal_push") {
    if (server === "express")
      return "ExpressJS checked the run and saved it in its own database. It does not deliver pushes, so nothing will arrive from this run.";
    return `The API created the notifications and started delivery. Each one goes out during its one-hour window, only to accounts that follow the word.${
      distributeNow
        ? " distribute_now was on, so the server tries to publish 30 seconds after the request — for a window that has already started."
        : " The server publishes at the next 10-minute tick inside each window."
    }`;
  }
  // No cron sends these types: distribute_now is the publish step, so say plainly when it was off.
  const notSent =
    " distribute_now was off, so nothing was sent: the server only created the notifications. To send, run it again with distribute_now on.";
  if (pushType.id === "last_minute_push" && server === "ecs-api")
    return `The API created the in-store notifications. Background workers now find each word's subscribers and write one notification per account; the time you set is only a label, nothing sends at it.${
      distributeNow
        ? " distribute_now was on, so the server publishes each one about 30 seconds after its notifications are ready, waiting up to about 5 minutes. If they never get ready, nothing is sent and the server raises an alert."
        : notSent
    }`;
  const sending = !pushType.distributeNow
    ? ""
    : distributeNow
      ? " distribute_now was on, so the server publishes it for you."
      : notSent;
  return `The API accepted the run.${sending} This push type's endpoint is not confirmed with the backend team yet, so ask them what happens next.`;
}

/** Why the numbers above are not a delivery count. */
function readersNote(pushType: PushTypeConfig): string {
  if (pushType.readers === "list")
    return "“Login IDs sent” is not a count of people: each id has to match an active customer with the right notification setting on, and anyone who fails is dropped quietly.";
  if (pushType.readers === "word")
    return "Only accounts that follow the word receive it. If your test account does not follow it, nothing arrives and nothing says so.";
  return "Each order line's member still has to meet the order condition and have the order setting on. Excluded accounts are skipped.";
}

export function DoneView({
  rows,
  payload,
  created,
  server,
  pushType,
  onStartOver,
}: Props) {
  const { date, editions, login_ids, exclude_login_ids, distribute_now } =
    payload;
  const runLabel = `STAG-${pushType.code}-${4820 + editions.length}`;
  const noun = pushType.noun.toLowerCase();
  const ctx: PreviewContext = { excludedIds: exclude_login_ids };

  return (
    <div className="w-full overflow-y-auto px-5 py-9 sm:px-10 sm:py-14">
      <Badge className="bg-blue-chip text-[11px] font-semibold tracking-[0.08em] text-blue-dark">
        SCHEDULED
      </Badge>
      <h2 className="mt-4 mb-2 text-[28px] font-semibold tracking-tight">
        配信予約しました — {editions.length} {pushType.label} {noun}
        {editions.length === 1 ? "" : "s"} scheduled
      </h2>
      <p className="mb-8 text-[15px] leading-relaxed font-light text-ink-2">
        {whatHappened(pushType, server, distribute_now)} Nothing here touched
        PROD.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Scheduled for</th>
              <th className={tableHeaderClass}>Details</th>
              <th className={tableHeaderClass}>Opens / includes</th>
              <th className={tableHeaderClass}>Reference</th>
            </tr>
          </thead>
          <tbody>
            {editions.map((edition, i) => {
              const row = rows[i];
              const made = created?.[i];
              const madeTime = made ? createdTime(made) : null;
              const [hour, min] = edition.publish_hour_min as [number, number];
              const d = detailsFor(pushType, row, ctx);
              return (
                <tr key={i}>
                  <td
                    className={`${tableDataCellClass} font-semibold whitespace-nowrap tabular-nums`}
                  >
                    {`${date} ${madeTime ?? `${pad(hour)}:${pad(min)}`} JST`}
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
                    {made
                      ? `Edition #${made.id} · ${made.topics_count} topic${made.topics_count === 1 ? "" : "s"}`
                      : row
                        ? pushType.preview(row, ctx).meta
                        : "—"}
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
        {login_ids && <span>Login IDs sent — {login_ids.length}</span>}
        {exclude_login_ids && <span>Excluded — {exclude_login_ids.length}</span>}
        <span>distribute_now — {distribute_now ? "yes" : "no"}</span>
        {!created && <span>Run label — {runLabel}</span>}
      </div>
      <p className="mt-6 text-[13.5px] leading-relaxed font-light text-ink-2">
        {readersNote(pushType)}{" "}
        {created
          ? "The edition numbers come from the server — give them to a backend engineer to look the delivery up."
          : "“Run label” is generated here for reference, not by the API — the API itself returns no id."}
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
      {pushType.id === "normal_push" && (
        <FieldHelp className="mt-3">
          The same hours are now taken. Pick new times before sending again, or
          the server rejects them.
        </FieldHelp>
      )}
      {pushType.id === "last_minute_push" && created && (
        <FieldHelp className="mt-3">
          The same times are now taken by these in-store notifications. Pick new
          times before sending again, or the server rejects them.
        </FieldHelp>
      )}
    </div>
  );
}
