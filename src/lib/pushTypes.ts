/**
 * One entry per push type in the sidebar. Which fields each form has comes from the e+ Cloud
 * guideline's Rails commands (`PushTest::Common.create_*_edition`) — see
 * `docs/PUSH-TYPES-FIELD-REFERENCE.md`.
 *
 * Confirmed contracts: Auto App Push (`../fe-docs/API-DOC-auto-app-push.md`) and Normal Push
 * (`../fe-docs/API-DOC-normal-push.md`). The other four have no endpoint on either server yet, so their
 * paths and request keys are guesses (`backendConfirmed: false`):
 *   - In store and Score reuse Normal's show keys (`code` / `performer_id` / `hook`), because the
 *     guideline builds all three from the same `[code, word, type]` show triple.
 *   - News keeps `article_id` / `word_id` / `title`; Order uses `status` and `order_lines[]`.
 */

import {
  codeField,
  requiredTextField,
  HOUR,
  MIN,
  performerField,
  wordField,
  type FieldConfig,
} from "@/lib/fields";
import { hookMix, LINKS, type FormRow, type LinkKind } from "@/lib/types";

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

/** Run-level values a preview may need, beyond the row itself. */
export interface PreviewContext {
  /** Order's excluded list — an order line whose member is on it is dropped by the server. */
  excludedIds?: string[];
}

/**
 * Order's status → the `01`–`07` number the server writes as the CSV filename prefix
 * (`TYPE_BY_FILEPREFIX`; the guideline's `data_01`–`data_07`). It comes from the status, never
 * from the block's position, and the form never sends it.
 */
export const ORDER_STATUS_NUMBER: Record<string, string> = {
  preorder_win: "01",
  preorder_lose: "02",
  money: "03",
  ticketing_notyet: "04",
  ticketing_now: "05",
  smaticket_now: "06",
  smaticket_notyet: "07",
};

/**
 * How a push type finds its readers:
 * - `list`  — the Recipients list the form sends as `login_ids` (Auto App, Score).
 * - `word`  — everyone who follows the word; the form sends no `login_ids` (Normal, In store, News).
 * - `order` — the member on each order line; the form sends only `exclude_login_ids` (Order).
 */
export type Readers = "list" | "word" | "order";

/** A list of sub-items inside one notification: Normal/In store/Score shows, Order's order lines. */
export interface ItemGroupConfig {
  /** The payload key the list is sent under. */
  key: "shows" | "order_lines";
  /** "Show" / "Order line" — the sub-panel title and the "+ Add …" button. */
  noun: string;
  fields: FieldConfig[];
  blank: () => Record<string, string>;
  /** Values every item carries without an input (In store's `hook: in_store`). Shown read-only, sent. */
  fixed?: Record<string, string>;
}

/** A seed row: the row's own values, plus its items when the type has an item list. */
export interface SampleRow {
  values: Record<string, string>;
  items?: Record<string, string>[];
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
  noun: "Notification" | "Status block";
  /** Shown under the page heading. */
  description: string;
  /** Short chips under the heading/category badge, e.g. "push_score_weekly is ON". */
  prereqs: string[];
  readers: Readers;
  /** Shown in place of the Recipients list for `word` and `order` types. */
  readersNote?: string;
  /** True only for Order — one shared start time for the whole run, no per-row time fields. */
  globalTime: boolean;
  /**
   * The JST window a delivery time must fall inside, in minutes from midnight — only where
   * ecs-api enforces one (Auto App `AP-0209`, Normal `NP-0207`). Unset: any time is accepted.
   */
  windowStartMin?: number;
  windowEndMin?: number;
  /** How far ahead of now a time may be — only Auto App (`AP-0208`). A past time is always fine. */
  leadMs?: number;
  /** The grey line under the hour/minute inputs. */
  timeHelp: string;
  /** The row's own fields, in render order. `HOUR`/`MIN` are rendered by the time widget. */
  fields: FieldConfig[];
  /** The list of sub-items inside each notification, when the type has one. */
  items?: ItemGroupConfig;
  /** Default values for a freshly added row (its first item comes from `items.blank()`). */
  blank: () => Record<string, string>;
  /** Seed rows shown the first time this type is opened. */
  samples: SampleRow[];
  /** The review-rail / done-screen card body for one row. */
  preview: (row: FormRow, ctx?: PreviewContext) => PreviewCard;
  /**
   * The `rails c` command a person must run on STAG at the delivery time, for a type whose
   * notifications nothing sends by itself (In store, Score, News, Order). Undefined = the type's
   * own cron sends it.
   */
  manualPublish?: string;
  /** Path our own route handler forwards to on ecs-api. */
  ecsForwardPath: string;
  /** Path segment for our proxy route: `/api/push/{routeSlug}`. */
  routeSlug: string;
  /** Path express is called at directly. */
  expressPath: string;
  /** False until a backend team confirms the endpoint exists. */
  backendConfirmed: boolean;
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

/** For a type ecs-api sets no time limits on (In store, Score, News). */
const ANY_TIME_HELP =
  "Any time, JST. The server sets no time limits for this type.";

const WORD_NOTE =
  "No recipient list for this type. The server sends to every account subscribed to the show's word ID — make sure your test accounts subscribe to it.";

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

const HOOK_FIELD: FieldConfig = {
  key: "hook",
  label: "Type (hook)",
  span: 12,
  required: true,
  seg: [
    { value: "preorder", label: "preorder" },
    { value: "firstcome", label: "firstcome" },
  ],
};

const dash = (v: string | undefined) => v || "—";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Up to two values, then "+N more" — keeps a preview line short. */
function listShort(values: string[]): string {
  const shown = values.filter(Boolean);
  if (!shown.length) return "—";
  const head = shown.slice(0, 2).join(", ");
  return shown.length > 2 ? `${head} +${shown.length - 2} more` : head;
}

const show = (
  code: string,
  performer_id: string,
  hook?: string,
): Record<string, string> =>
  hook ? { code, performer_id, hook } : { code, performer_id };

/**
 * The preview card for a list of shows. `byWord` is true for a type whose readers are a word's
 * subscribers, so the push kind is judged per word (see `hookMix`).
 */
const showsPreview =
  (byWord: boolean) =>
  (row: FormRow): PreviewCard => {
    const mix = hookMix(row.items, byWord);
    const kind = !mix
      ? "—"
      : mix.kind === "single"
        ? mix.hook
        : mix.kind === "mixed"
          ? "mixed"
          : "mixed for some";
    return {
      title: `${kind} · ${plural(row.items.length, "show")}`,
      line: listShort(row.items.map((i) => i.values.code)),
      meta: `word ${listShort([...new Set(row.items.map((i) => i.values.performer_id))])}`,
    };
  };

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
    readers: "list",
    globalTime: false,
    windowStartMin: 8 * 60,
    windowEndMin: 22 * 60,
    leadMs: TWO_HOURS,
    timeHelp: "08:00 to 22:00 JST, and no more than 2 hours from now.",
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
        values: {
          hour: "15",
          min: "30",
          deliv_id: "H020064377",
          title: "イープラスのWEBページへ遷移します。",
          kind: "web",
          linkValue: "https://eplus.jp/",
        },
      },
      {
        values: {
          hour: "15",
          min: "35",
          deliv_id: "H020064378",
          title: "スマチケ公演バンドルをご紹介",
          kind: "kogyo",
          linkValue: "9041480001-P0030001P021001",
        },
      },
    ],
    preview: ({ values: v }) => {
      const kind = (v.kind || "web") as LinkKind;
      const L = LINKS[kind];
      return {
        title: v.title || "(no notification text)",
        line: `${L.line} — ${v.linkValue || "(empty)"}`,
        meta: `deliv_id ${dash(v.deliv_id)} · link_type ${L.code}`,
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
      "Sale-start alert for subscribers of a word. One notification holds one or more shows; two shows of the same word with different types make a mixed push.",
    prereqs: [
      "Notification setting (check) is ON",
      "User subscribes to the word",
    ],
    readers: "word",
    readersNote: WORD_NOTE,
    globalTime: false,
    // The time starts a one-hour window, and the server only publishes until 22:00.
    windowStartMin: 8 * 60,
    windowEndMin: 21 * 60,
    timeHelp:
      "08:00 to 21:00 JST. Starts a one-hour window; a time that has already started is fine.",
    fields: [HOUR, MIN],
    items: {
      key: "shows",
      noun: "Show",
      fields: [
        codeField(6),
        performerField(6, ["2762", "1533", "75223", "405"]),
        HOOK_FIELD,
      ],
      blank: () => ({ code: "", performer_id: "2762", hook: "preorder" }),
    },
    blank: () => ({ hour: "17", min: "00" }),
    samples: [
      // mixed(受付): one word, two hooks — a mixed push for everyone subscribed to 2762.
      {
        values: { hour: "17", min: "00" },
        items: [
          show("9014500001-P0030056", "2762", "firstcome"),
          show("9014500001-P0030065", "2762", "preorder"),
        ],
      },
      {
        values: { hour: "18", min: "00" },
        items: [show("9011910001-P0030007P021005", "75223", "preorder")],
      },
      // mixed(ワード): two words, one hook — a preorder push naming both words, never `mixed`.
      // Only a test account subscribed to both words sees both.
      {
        values: { hour: "19", min: "00" },
        items: [
          show("9014500001-P0030056", "2762", "preorder"),
          show("9011910001-P0030007P021005", "75223", "preorder"),
        ],
      },
    ],
    preview: showsPreview(true),
    ecsForwardPath: "/api/test_notification/normal_pushes",
    routeSlug: "normal-push",
    expressPath: "/api/notifications/normal-pushes",
    backendConfirmed: true,
  },

  last_minute_push: {
    id: "last_minute_push",
    label: "Last minute Push",
    jp: "直前PUSH通知",
    code: "LMP",
    category: "check",
    noun: "Notification",
    description:
      "Final-call alert for in-store sales (\"In store\" in the guideline). One notification holds one or more shows.",
    prereqs: [
      "Notification setting (check) is ON",
      "User subscribes to the word",
    ],
    readers: "word",
    readersNote: WORD_NOTE,
    globalTime: false,
    timeHelp: ANY_TIME_HELP,
    fields: [HOUR, MIN],
    items: {
      key: "shows",
      noun: "Show",
      fields: [
        codeField(6, { check: false }),
        performerField(6, ["75223", "23542"]),
      ],
      blank: () => ({ code: "", performer_id: "75223" }),
      fixed: { hook: "in_store" },
    },
    blank: () => ({ hour: "16", min: "05" }),
    samples: [
      {
        values: { hour: "16", min: "05" },
        items: [show("9063440001-P0030012P021001", "75223")],
      },
      {
        values: { hour: "16", min: "10" },
        items: [
          show("1610580031-P0030117", "23542"),
          show("9032420001-P0030001", "23542"),
        ],
      },
    ],
    preview: (row) => ({ ...showsPreview(true)(row), title: `in_store · ${plural(row.items.length, "show")}` }),
    // Its queuer runs only at 08:00 on Mondays and Thursdays, so in practice a person publishes it.
    manualPublish: "edition.notifications.each(&:publish)",
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
      "Recommendation push sent to the Recipients list. One notification holds one or more shows.",
    prereqs: ["push_score_weekly is ON", "Push is enabled for the user in DB"],
    readers: "list",
    globalTime: false,
    timeHelp: ANY_TIME_HELP,
    fields: [HOUR, MIN],
    items: {
      key: "shows",
      noun: "Show",
      fields: [
        codeField(6, { check: false }),
        performerField(6, ["2762", "1533", "75223"]),
        HOOK_FIELD,
      ],
      blank: () => ({ code: "", performer_id: "2762", hook: "preorder" }),
    },
    blank: () => ({ hour: "17", min: "50" }),
    samples: [
      {
        values: { hour: "17", min: "50" },
        items: [
          show("9014500001-P0030056", "2762", "firstcome"),
          show("9014500001-P0030065", "2762", "preorder"),
        ],
      },
      {
        values: { hour: "18", min: "00" },
        items: [show("1610580031-P0030118P021001", "75223", "preorder")],
      },
    ],
    preview: showsPreview(false),
    // The test helper leaves the edition at :edited, so the 10-minute queuer never picks it up.
    manualPublish: "edition.publish!(at: Time.zone.now)",
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
    readers: "word",
    readersNote:
      "No recipient list for this type. The server sends to every account subscribed to the word ID — make sure your test accounts subscribe to it.",
    globalTime: false,
    timeHelp: ANY_TIME_HELP,
    fields: [
      HOUR,
      MIN,
      {
        key: "article_id",
        label: "Article ID (article_id)",
        span: 6,
        required: true,
        numeric: true,
        check: "digits",
        sendAs: "number",
        placeholder: "239541",
      },
      wordField(6, ["2762"]),
      {
        key: "title",
        label: "Title (title)",
        span: 12,
        required: true,
        placeholder: "2020_06_GA確認用_ワードへ",
      },
    ],
    blank: () => ({
      hour: "16",
      min: "40",
      article_id: "",
      word_id: "2762",
      title: "",
    }),
    samples: [
      {
        values: {
          hour: "16",
          min: "40",
          article_id: "239541",
          word_id: "2762",
          title: "2020_06_GA確認用_ワードへ",
        },
      },
    ],
    preview: ({ values: v }) => ({
      title: v.title || "(no title)",
      line: `Opens SPICE article ${dash(v.article_id)}`,
      meta: `word_id ${dash(v.word_id)}`,
    }),
    manualPublish: "Epica::ArticleEdition.find(id).publish!",
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
    noun: "Status block",
    description:
      "Status update on ticket orders. Each status block is one notification holding one or more order lines; block times are 10 minutes apart.",
    prereqs: [
      "Notification setting (order) is ON",
      "User meets the order condition",
    ],
    readers: "order",
    readersNote:
      "No recipient list for this type. The member ID on each order line decides who gets it. Accounts in the excluded list are skipped.",
    globalTime: true,
    // Order has no per-card time widget; its shared start time has its own copy (GlobalTimeSection).
    timeHelp: "",
    fields: [
      {
        key: "status",
        label: "Order status (status)",
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
    ],
    items: {
      key: "order_lines",
      noun: "Order line",
      fields: [
        requiredTextField("member_id", "Member ID (member_id)", 4, "502001185"),
        requiredTextField("kogyo_code", "Kogyo code", 4, "161058"),
        requiredTextField("kogyo_sub_code", "Kogyo sub code", 4, "0106"),
        requiredTextField("event_code", "Event code", 4, "001"),
        requiredTextField(
          "management_number",
          "Management number",
          4,
          "509344479",
        ),
      ],
      blank: () => ({
        member_id: "",
        kogyo_code: "",
        kogyo_sub_code: "",
        event_code: "",
        management_number: "",
      }),
    },
    blank: () => ({ status: "preorder_win" }),
    samples: [
      {
        values: { status: "preorder_win" },
        items: [
          {
            member_id: "502001185",
            kogyo_code: "161058",
            kogyo_sub_code: "0106",
            event_code: "001",
            management_number: "509344479",
          },
          {
            member_id: "602031013",
            kogyo_code: "901522",
            kogyo_sub_code: "0003",
            event_code: "001",
            management_number: "509344444",
          },
        ],
      },
      {
        values: { status: "preorder_lose" },
        items: [
          {
            member_id: "502001185",
            kogyo_code: "161058",
            kogyo_sub_code: "0105",
            event_code: "001",
            management_number: "509344478",
          },
          {
            member_id: "602031013",
            kogyo_code: "901522",
            kogyo_sub_code: "0002",
            event_code: "001",
            management_number: "509344436",
          },
        ],
      },
    ],
    preview: ({ values: v, items }, ctx) => {
      const number = ORDER_STATUS_NUMBER[v.status];
      const excluded = new Set(ctx?.excludedIds ?? []);
      // The server skips these lines while writing the CSV — say so, or the tester counts a push as lost.
      const dropped = items.filter((i) => excluded.has(i.values.member_id)).length;
      return {
        title: `${v.status || "—"}${number ? ` (${number})` : ""} · ${plural(items.length, "order line")}`,
        line: `Members ${listShort(items.map((i) => i.values.member_id))}${dropped ? ` · ${dropped} dropped (excluded)` : ""}`,
        meta: `Kogyo ${listShort([...new Set(items.map((i) => `${dash(i.values.kogyo_code)}-${dash(i.values.kogyo_sub_code)}`))])}`,
      };
    },
    manualPublish: "Epica::OrderedShowsList.find(id).publish!",
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
