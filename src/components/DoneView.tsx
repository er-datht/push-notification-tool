import type { AutoAppPushResult } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldHelp } from "@/components/FieldText";
import {
  formatPublishAt,
  LINKS,
  SERVER_LABEL,
  type NotificationRow,
  type Server,
} from "@/lib/types";

interface Props {
  rows: NotificationRow[];
  result: AutoAppPushResult;
  server: Server;
  onStartOver: () => void;
}

const tableHeaderClass =
  "border-b border-line-2 px-5 py-3.5 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase";
const tableDataCellClass = "border-b border-line-3 px-5 py-4 align-top";

export function DoneView({ rows, result, server, onStartOver }: Props) {
  const { status, editions, distributed, login_ids_count } = result;
  const created = status === "created";

  return (
    <div className="max-w-[1040px] overflow-y-auto px-5 py-9 sm:px-10 sm:py-14">
      <Badge className="bg-blue-chip text-[11px] font-semibold tracking-[0.08em] text-blue-dark">
        {created ? "SCHEDULED" : "VALIDATED"}
      </Badge>
      <h2 className="mt-4 mb-2 text-[28px] font-semibold tracking-tight">
        {created
          ? `配信予約しました — ${editions.length} notification(s) scheduled`
          : `Payload accepted — ${editions.length} notification(s) checked`}
      </h2>
      <p className="mb-8 max-w-[62ch] text-[15px] leading-relaxed font-light text-ink-2">
        {created ? (
          <>
            The API took the delivery file. Nothing has been sent yet.{" "}
            {distributed
              ? "distribute_now was on, so the job ran right away and the recipients are being worked out now."
              : "The import job checks every 10 minutes, so the push can arrive up to ten minutes after the time you set."}{" "}
          </>
        ) : (
          <>
            The API only checked the values. Delivery is still switched off on
            the server, so no file was written and no push will go out.{" "}
          </>
        )}
        Nothing here touched PROD.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Scheduled for</th>
              <th className={tableHeaderClass}>Delivery ID</th>
              <th className={tableHeaderClass}>Notification</th>
              <th className={tableHeaderClass}>Opens</th>
              <th className={tableHeaderClass}>File</th>
            </tr>
          </thead>
          <tbody>
            {editions.map((edition, i) => {
              const row = rows[i];
              return (
                <tr key={`${edition.deliv_id}-${i}`}>
                  <td
                    className={`${tableDataCellClass} font-semibold whitespace-nowrap tabular-nums`}
                  >
                    {formatPublishAt(edition.will_publish_at)}
                  </td>
                  <td className={`${tableDataCellClass} font-light`}>
                    {edition.deliv_id}
                  </td>
                  <td className={tableDataCellClass}>{edition.title}</td>
                  <td className={`${tableDataCellClass} font-light text-ink-2`}>
                    {row ? `${LINKS[row.kind].line} · ` : ""}
                    {edition.link_item}
                  </td>
                  <td
                    className={`${tableDataCellClass} text-[12.5px] font-light break-all text-ink-2`}
                  >
                    {edition.filename ?? "—"}
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
        <span>Login IDs sent — {login_ids_count}</span>
        <span>distribute_now — {distributed ? "yes" : "no"}</span>
      </div>
      <p className="mt-6 max-w-[74ch] text-[13.5px] leading-relaxed font-light text-ink-2">
        <strong className="font-semibold text-foreground">
          &ldquo;Login IDs sent&rdquo; is not a count of people.
        </strong>{" "}
        It only repeats the list you sent. Later, each id has to match an active
        customer with <em>push_score_weekly</em> ON. Anyone who fails either
        check is dropped quietly, with no error in the response and none in the
        logs. That is the usual reason a push never arrives.
      </p>
      <Button className="mt-9" onClick={onStartOver}>
        Start another run
      </Button>
      <FieldHelp className="mt-3">
        We add 1 to each delivery ID for you, because the API counts the same
        deliv_id twice as one delivery.
      </FieldHelp>
    </div>
  );
}
