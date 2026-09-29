/**
 * One entry per push type in the sidebar, ported from the Claude Design mockup
 * (`push-tool-console v2.dc.html`, `TYPES` array) — that file is the spec for `fields`,
 * `blank`, `samples` and `preview`, not an example to riff on.
 *
 * Auto App Push is the only type with a confirmed backend contract (`backendConfirmed: true`).
 * For the other five, nothing on either server (ecs-api or express) implements them yet, so
 * `ecsForwardPath`/`routeSlug`/`expressPath` are guesses built from the `auto_app_push` naming
 * pattern. Three more things are guessed, not confirmed, about the PAYLOAD shape itself
 * (see `buildPayload` in `src/lib/api.ts`):
 *   - whether `sub_type` is really sent as a payload key for these five (unlike Auto App, whose
 *     sub type is implied by the endpoint and never sent)
 *   - whether Score really omits `login_ids` entirely in favor of a per-edition `target_user`
 *   - whether `exclude_login_ids` is the right key name for Order's exclusion list
 * All three are reasonable extrapolations from the backend's internal `NOTIFICATIONS.md`, none
 * are backend-confirmed.
 */

import {
  eventField,
  HOUR,
  MIN,
  wordField,
  type FieldConfig,
} from "@/lib/fields";
import { LINKS, type LinkKind } from "@/lib/types";

export type PushTypeId =
  | "auto_app_push"
  | "normal_push"
  | "last_minute_push"
  | "score_push"
  | "news_push"
  | "order_push";

export interface PreviewCard {
  title: string;
  line: string;
  meta: string;
}

export interface PushTypeConfig {
  id: PushTypeId;
  /** Sidebar label and page heading. */
  label: string;
  /** Japanese subtitle, shown next to the sidebar label and the page heading. */
  jp: string;
  /** AAP/NRM/LMP/SCR/NWS/ORD — used only in the done-screen's client-generated run label. */
  code: string;
  /** Shown as a "CATEGORY · {category}" badge next to the page heading. */
  category: string;
  /** Drives "+ Add {noun}", "{noun}s" section heading, and each row's card label. */
  noun: "Notification" | "Order";
  /** Shown under the page heading. */
  description: string;
  /** Short chips under the heading/category badge, e.g. "push_score_weekly is ON". */
  prereqs: string[];
  /** False only for Score — it targets one user per row via `target_user`, not a shared list. */
  recipients: boolean;
  /** True only for Order — one shared Hour/Minute for the whole run, no per-row time fields. */
  globalTime: boolean;
  /** The JST window a delivery time must fall inside, in minutes from midnight. */
  windowStartMin: number;
  windowEndMin: number;
  /** How far ahead of now a time may be. Only Auto App's contract documents this. */
  leadMs?: number;
  /** The row's real fields, in render order. `HOUR`/`MIN` are included for validation/payload
   *  purposes but are rendered by a dedicated time-group widget, not the generic field loop. */
  fields: FieldConfig[];
  /** Default values for a freshly added row. */
  blank: () => Record<string, string>;
  /** Seed rows shown the first time this type is opened. */
  samples: Record<string, string>[];
  /** The review-rail / done-screen card body for one row. Bespoke copy per type, not mechanically derived from `fields`. */
  preview: (values: Record<string, string>) => PreviewCard;
  /** Path our own route handler forwards to on ecs-api. */
  ecsForwardPath: string;
  /** Path segment for our proxy route: `/api/push/{routeSlug}`. */
  routeSlug: string;
  /** Path express is called at directly. */
  expressPath: string;
  /** False until a backend team confirms the endpoint exists. */
  backendConfirmed: boolean;
}

const WEB_KOGYO_WORD: FieldConfig = {
  key: "kind",
  label: "Where should the tap go?",
  span: 12,
  required: true,
  seg: [
    { value: "web", label: "Web page" },
    { value: "kogyo", label: "Kogyo" },
    { value: "word", label: "Word" },
  ],
};

const LINK_VALUE: FieldConfig = {
  key: "linkValue",
  label: "link",
  span: 12,
  required: true,
  link: true,
};

const dash = (v: string | undefined) => v || "—";

export const PUSH_TYPES: Record<PushTypeId, PushTypeConfig> = {
  auto_app_push: {
    id: "auto_app_push",
    label: "Auto App Push",
    jp: "自動App_Push通知",
    code: "AAP",
    category: "push",
    noun: "Notification",
    description:
      "A deep-link notification with your own text. The tap opens an e+ web page, a kogyo or a word page.",
    prereqs: ["push_score_weekly is ON", "Push is enabled for the user in DB"],
    recipients: true,
    globalTime: false,
    windowStartMin: 8 * 60,
    windowEndMin: 22 * 60,
    leadMs: 2 * 60 * 60 * 1000,
    fields: [
      HOUR,
      MIN,
      {
        key: "deliv_id",
        label: "Delivery ID (deliv_id)",
        span: 4,
        required: true,
        placeholder: "H020064377",
        requiredMessage:
          "Enter a delivery ID. The batch uses it to find the campaign.",
      },
      { key: "_sub", label: "Sub type", span: 4, fixed: "auto_app_push" },
      {
        key: "title",
        label: "Notification text (title)",
        span: 12,
        required: true,
        placeholder: "イープラスのWEBページへ遷移します。",
        requiredMessage: "Enter the notification text.",
      },
      WEB_KOGYO_WORD,
      LINK_VALUE,
    ],
    blank: () => ({
      hour: "15",
      min: "40",
      deliv_id: "",
      title: "",
      kind: "web",
      linkValue: "",
    }),
    samples: [
      {
        hour: "15",
        min: "30",
        deliv_id: "H020064377",
        title: "イープラスのWEBページへ遷移します。",
        kind: "web",
        linkValue: "https://eplus.jp/",
      },
      {
        hour: "15",
        min: "35",
        deliv_id: "H020064378",
        title: "スマチケ公演バンドルをご紹介",
        kind: "kogyo",
        linkValue: "9041480001-P0030001P021001",
      },
    ],
    preview: (v) => {
      const kind = (v.kind || "web") as LinkKind;
      const L = LINKS[kind];
      return {
        title: v.title || "(no notification text)",
        line: `${L.line} — ${v.linkValue || "(empty)"}`,
        meta: `deliv_id ${dash(v.deliv_id)} · sub_type auto_app_push · link_type ${L.code}`,
      };
    },
    ecsForwardPath: "/api/test_notification/auto_app_pushes",
    routeSlug: "auto-app-push",
    expressPath: "/api/notifications/auto-app-pushes",
    backendConfirmed: true,
  },

  normal_push: {
    id: "normal_push",
    label: "Normal Push",
    jp: "通常PUSH通知",
    code: "NRM",
    category: "check",
    noun: "Notification",
    description:
      "Sale-start alert for subscribers of a word — first-come, pre-order, or a mixed sale.",
    prereqs: [
      "Notification setting (check) is ON",
      "User subscribes to the word",
    ],
    recipients: true,
    globalTime: false,
    windowStartMin: 8 * 60,
    windowEndMin: 21 * 60 + 59,
    fields: [
      HOUR,
      MIN,
      {
        key: "sub_type",
        label: "Type (sub_type)",
        span: 8,
        required: true,
        seg: [
          { value: "firstcome", label: "firstcome" },
          { value: "preorder", label: "preorder" },
          { value: "mixed", label: "mixed (sale, word)" },
        ],
      },
      eventField(6),
      wordField(6, ["2762", "1533", "75223", "405"]),
    ],
    blank: () => ({
      hour: "15",
      min: "40",
      sub_type: "preorder",
      target_event: "",
      word_id: "2762",
    }),
    samples: [
      {
        hour: "15",
        min: "30",
        sub_type: "preorder",
        target_event: "1610580031-P0030114",
        word_id: "2762",
      },
      {
        hour: "15",
        min: "30",
        sub_type: "firstcome",
        target_event: "9044500001-P0030001",
        word_id: "2762",
      },
    ],
    preview: (v) => ({
      title: `${v.sub_type || ""} · ${v.target_event || "(no event)"}`,
      line: `Subscribers of word ${dash(v.word_id)}`,
      meta: "category check",
    }),
    ecsForwardPath: "/api/test_notification/normal_pushes",
    routeSlug: "normal-push",
    expressPath: "/api/notifications/normal-pushes",
    backendConfirmed: false,
  },

  last_minute_push: {
    id: "last_minute_push",
    label: "Last minute Push",
    jp: "直前PUSH通知",
    code: "LMP",
    category: "check",
    noun: "Notification",
    description:
      "Final-call alert for in-store sales, sent to subscribers of the word shortly before the event.",
    prereqs: [
      "Notification setting (check) is ON",
      "User subscribes to the word",
    ],
    recipients: true,
    globalTime: false,
    windowStartMin: 8 * 60,
    windowEndMin: 22 * 60,
    fields: [
      HOUR,
      MIN,
      {
        key: "sub_type",
        label: "Type (sub_type)",
        span: 8,
        required: true,
        seg: [
          { value: "in_store", label: "in_store" },
          { value: "in_store_mixed", label: "in_store (sale, word)" },
        ],
      },
      eventField(6),
      wordField(6, ["75223", "23542", "2762"]),
    ],
    blank: () => ({
      hour: "15",
      min: "40",
      sub_type: "in_store",
      target_event: "",
      word_id: "23542",
    }),
    samples: [
      {
        hour: "15",
        min: "30",
        sub_type: "in_store",
        target_event: "1610580031-P0030114",
        word_id: "23542",
      },
      {
        hour: "15",
        min: "35",
        sub_type: "in_store",
        target_event: "9044500001-P0030001",
        word_id: "23542",
      },
    ],
    preview: (v) => ({
      title: `${v.sub_type || ""} · ${v.target_event || "(no event)"}`,
      line: `Subscribers of word ${dash(v.word_id)}`,
      meta: "category check",
    }),
    ecsForwardPath: "/api/test_notification/last_minute_pushes",
    routeSlug: "last-minute-push",
    expressPath: "/api/notifications/last-minute-pushes",
    backendConfirmed: false,
  },

  score_push: {
    id: "score_push",
    label: "Score Push",
    jp: "スコアPUSH通知",
    code: "SCR",
    category: "score",
    noun: "Notification",
    description:
      "Recommendation push driven by a user's score. Each row targets one user directly.",
    prereqs: ["push_score_weekly is ON", "Push is enabled for the user in DB"],
    recipients: false,
    globalTime: false,
    windowStartMin: 8 * 60,
    windowEndMin: 21 * 60 + 59,
    fields: [
      HOUR,
      MIN,
      {
        key: "sub_type",
        label: "Type (sub_type)",
        span: 8,
        required: true,
        seg: [
          { value: "score_preorder", label: "score_preorder" },
          { value: "score_firstcome", label: "score_firstcome" },
          { value: "score_mixed", label: "score_mixed" },
        ],
      },
      {
        key: "target_user",
        label: "Target user (login ID)",
        span: 4,
        required: true,
        placeholder: "e-plus-test01",
      },
      eventField(4),
      wordField(4),
    ],
    blank: () => ({
      hour: "15",
      min: "40",
      sub_type: "score_preorder",
      target_user: "e-plus-test01",
      target_event: "",
      word_id: "",
    }),
    samples: [
      {
        hour: "15",
        min: "30",
        sub_type: "score_preorder",
        target_user: "e-plus-test01",
        target_event: "1610580031-P0030114",
        word_id: "23542",
      },
      {
        hour: "15",
        min: "35",
        sub_type: "score_firstcome",
        target_user: "e-plus-test02",
        target_event: "9044500001-P0030001",
        word_id: "23542",
      },
    ],
    preview: (v) => ({
      title: `${v.sub_type || ""} → ${v.target_user || "(no user)"}`,
      line: `Event ${dash(v.target_event)}`,
      meta: `word_id ${dash(v.word_id)}`,
    }),
    ecsForwardPath: "/api/test_notification/score_pushes",
    routeSlug: "score-push",
    expressPath: "/api/notifications/score-pushes",
    backendConfirmed: false,
  },

  news_push: {
    id: "news_push",
    label: "News Push",
    jp: "ニュース通知",
    code: "NWS",
    category: "news",
    noun: "Notification",
    description:
      "Links a SPICE news article to followers of a word. The title is what appears on the lock screen.",
    prereqs: [
      "Notification setting (by_word) is ON",
      "User subscribes to the word",
    ],
    recipients: true,
    globalTime: false,
    windowStartMin: 8 * 60,
    windowEndMin: 22 * 60,
    fields: [
      HOUR,
      MIN,
      {
        key: "article_id",
        label: "Article ID (article_id)",
        span: 4,
        required: true,
        numeric: true,
        check: "digits",
        placeholder: "239541",
      },
      { key: "_sub", label: "Type", span: 4, fixed: "spice" },
      {
        key: "title",
        label: "Headline (title)",
        span: 12,
        required: true,
        placeholder: "2020_06_GA確認用_ワードへ",
      },
      wordField(6, ["2762"]),
    ],
    blank: () => ({
      hour: "15",
      min: "40",
      article_id: "",
      word_id: "2762",
      title: "",
    }),
    samples: [
      {
        hour: "15",
        min: "35",
        article_id: "239541",
        word_id: "2762",
        title: "2020_06_GA確認用_ワードへ",
      },
    ],
    preview: (v) => ({
      title: v.title || "(no headline)",
      line: `Opens SPICE article ${dash(v.article_id)}`,
      meta: `word_id ${dash(v.word_id)} · type spice`,
    }),
    ecsForwardPath: "/api/test_notification/news_pushes",
    routeSlug: "news-push",
    expressPath: "/api/notifications/news-pushes",
    backendConfirmed: false,
  },

  order_push: {
    id: "order_push",
    label: "Order Push",
    jp: "申込み公演通知",
    code: "ORD",
    category: "order",
    noun: "Order",
    description:
      "Status update on a ticket order — lottery result, payment, or ticketing. One row per order.",
    prereqs: [
      "Notification setting (order) is ON",
      "User meets the order condition",
    ],
    recipients: true,
    globalTime: true,
    windowStartMin: 8 * 60,
    windowEndMin: 21 * 60 + 59,
    fields: [
      {
        key: "sub_type",
        label: "Order status (sub_type)",
        span: 12,
        required: true,
        seg: [
          { value: "preorder_win", label: "preorder_win" },
          { value: "preorder_lose", label: "preorder_lose" },
          { value: "money", label: "money" },
          { value: "ticketing_notyet", label: "ticketing_notyet" },
          { value: "ticketing_now", label: "ticketing_now" },
          { value: "smaticket_now", label: "smaticket_now" },
          { value: "smaticket_notyet", label: "smaticket_notyet" },
        ],
      },
      {
        key: "member_id",
        label: "Member ID (member_id)",
        span: 6,
        required: true,
        numeric: true,
        check: "digits",
        placeholder: "502001185",
      },
      {
        key: "management_number",
        label: "Management number",
        span: 6,
        required: true,
        numeric: true,
        check: "digits",
        placeholder: "509344479",
      },
      {
        key: "kogyo_code",
        label: "Kogyo code",
        span: 4,
        required: true,
        numeric: true,
        check: "digits",
        placeholder: "161058",
      },
      {
        key: "kogyo_sub_code",
        label: "Kogyo sub code",
        span: 4,
        required: true,
        numeric: true,
        check: "digits",
        placeholder: "0106",
      },
      {
        key: "event_code",
        label: "Event code",
        span: 4,
        required: true,
        numeric: true,
        check: "digits",
        placeholder: "001",
      },
    ],
    blank: () => ({
      sub_type: "preorder_win",
      member_id: "",
      kogyo_code: "",
      kogyo_sub_code: "",
      event_code: "",
      management_number: "",
    }),
    samples: [
      {
        sub_type: "preorder_win",
        member_id: "502001185",
        kogyo_code: "161058",
        kogyo_sub_code: "0106",
        event_code: "001",
        management_number: "509344479",
      },
      {
        sub_type: "preorder_lose",
        member_id: "502001222",
        kogyo_code: "161058",
        kogyo_sub_code: "0106",
        event_code: "001",
        management_number: "509340622",
      },
    ],
    preview: (v) => ({
      title: `${v.sub_type || ""} · member ${dash(v.member_id)}`,
      line: `Kogyo ${dash(v.kogyo_code)}-${dash(v.kogyo_sub_code)} · event ${dash(v.event_code)}`,
      meta: `management_number ${dash(v.management_number)}`,
    }),
    ecsForwardPath: "/api/test_notification/order_pushes",
    routeSlug: "order-push",
    expressPath: "/api/notifications/order-pushes",
    backendConfirmed: false,
  },
};

/** Sidebar order. */
export const PUSH_TYPE_ORDER: PushTypeId[] = [
  "auto_app_push",
  "normal_push",
  "last_minute_push",
  "score_push",
  "news_push",
  "order_push",
];

export function pushTypeForSlug(slug: string): PushTypeConfig | null {
  return Object.values(PUSH_TYPES).find((p) => p.routeSlug === slug) ?? null;
}
