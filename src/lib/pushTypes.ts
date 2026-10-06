/**
 * One entry per push type in the sidebar. Which fields each form has comes from the e+ Cloud
 * guideline's Rails commands (`PushTest::Common.create_*_edition`) — see
 * `docs/PUSH-TYPES-FIELD-REFERENCE.md`.
 *
 * Confirmed contracts, per server (`backendConfirmed`): Auto App Push
 * (`../fe-docs/API-DOC-auto-app-push.md`) and Normal Push (`../fe-docs/API-DOC-normal-push.md`) on
 * both; In store, Score and News Push (`../fe-docs/API-DOC-{in-store,score,news}-push.md`) on
 * ecs-api only. Order has no endpoint yet, so its path and request keys (`status`,
 * `order_lines[]`) are guesses.
 */

import {
  codeField,
  requiredTextField,
  HOUR,
  MIN,
  performerField,
  type FieldConfig,
} from "@/lib/fields";
import {
  DELIV_ID_MAX,
  hookMix,
  JST_OFFSET_MS,
  LINKS,
  nextDelivId,
  pad,
  validateRows,
  type FormRow,
  type LinkKind,
  type Server,
} from "@/lib/types";

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
  /**
   * Values the server gives every item itself (In store's `hook: in_store`). Shown read-only, never
   * sent: In store's API rejects a `hook` key with `400 IS-0004`.
   */
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
  /**
   * Default values for a freshly added row (its first item comes from `items.blank()`). A field
   * left empty here is filled from its placeholder on add (`newRowValues` / `withPlaceholders`).
   */
  blank: () => Record<string, string>;
  /** Seed rows shown the first time this type is opened. */
  samples: SampleRow[];
  /** The review-rail / done-screen card body for one row. */
  preview: (row: FormRow, ctx?: PreviewContext) => PreviewCard;
  /**
   * What the server does with `distribute_now: true`, for a type where it acts on it. `help` is
   * the line under the checkbox; `line` the review rail's delivery summary. Undefined: the server
   * accepts the flag but does nothing with it (Auto App).
   *
   * `required`: no cron sends this type (In store, Score, News, Order), so distribute_now is the
   * tool's publish step, the one a developer would otherwise run in `rails c`. With it off the
   * server only creates the notifications and nothing is sent. Testers never publish by hand.
   */
  distributeNow?: { help: string; line: string; required?: boolean };
  /** Path our own route handler forwards to on ecs-api. */
  ecsForwardPath: string;
  /** Path segment for our proxy route: `/api/push/{routeSlug}`. */
  routeSlug: string;
  /** Path express is called at directly. */
  expressPath: string;
  /** Per server: false until that server's team confirms the endpoint exists. */
  backendConfirmed: Record<Server, boolean>;
  /**
   * Servers with no endpoint for this type at all (express, for every type but Auto App and
   * Normal): the review rail disables them and the run goes to ecs-api.
   */
  unavailableOn?: Server[];
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
        maxLength: DELIV_ID_MAX,
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
    backendConfirmed: { "ecs-api": true, express: true },
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
    distributeNow: {
      help: "distribute_now. The server tries to publish 30 seconds after the request instead of at the next 10-minute tick — only for a window that has already started.",
      line: "distribute_now ON, the job runs right away",
    },
    ecsForwardPath: "/api/test_notification/normal_pushes",
    routeSlug: "normal-push",
    expressPath: "/api/notifications/normal-pushes",
    backendConfirmed: { "ecs-api": true, express: true },
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
    timeHelp:
      "Any time, JST, even one that has passed. Each notification needs its own time: the server rejects a time another in-store notification already uses.",
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
    // No queuer sends an in-store edition: its time is only its will_publish_at.
    distributeNow: {
      help: "distribute_now. Turn it on to send: the server publishes each notification about 30 seconds after it is ready. Leave it off and nothing is sent.",
      line: "distribute_now ON, published about 30 seconds after it is ready",
      required: true,
    },
    // Only ecs-api has it (`../fe-docs/API-DOC-in-store-push.md`). The express path is a guess and
    // unused until express has the endpoint: `unavailableOn` keeps every run on ecs-api.
    ecsForwardPath: "/api/test_notification/in_store_pushes",
    routeSlug: "last-minute-push",
    expressPath: "/api/notifications/last-minute-pushes",
    backendConfirmed: { "ecs-api": true, express: false },
    unavailableOn: ["express"],
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
    distributeNow: {
      help: "distribute_now. Turn it on to send: the server publishes each notification at its time, or right away if that time has passed. Leave it off and nothing is sent.",
      line: "distribute_now ON, published at each notification's time",
      required: true,
    },
    // Only ecs-api has it (`../fe-docs/API-DOC-score-push.md`). The express path is a guess and
    // unused until express has the endpoint: `unavailableOn` keeps every run on ecs-api.
    ecsForwardPath: "/api/test_notification/score_pushes",
    routeSlug: "score-push",
    expressPath: "/api/notifications/score-pushes",
    backendConfirmed: { "ecs-api": true, express: false },
    unavailableOn: ["express"],
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
      "User has signed in to the v2 app",
    ],
    readers: "word",
    readersNote:
      "No recipient list for this type. The server sends to every account that follows the word ID, has signed in to the v2 app and has by_word on — make sure your test accounts do.",
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
        check: "id",
        sendAs: "number",
        placeholder: "239541",
      },
      performerField(6, ["2762"]),
      {
        key: "title",
        label: "Title (title)",
        span: 12,
        required: true,
        maxLength: 255,
        placeholder: "2020_06_GA確認用_ワードへ",
      },
    ],
    blank: () => ({
      hour: "16",
      min: "40",
      article_id: "",
      performer_id: "2762",
      title: "",
    }),
    samples: [
      {
        values: {
          hour: "16",
          min: "40",
          article_id: "239541",
          performer_id: "2762",
          title: "2020_06_GA確認用_ワードへ",
        },
      },
    ],
    preview: ({ values: v }) => ({
      title: v.title || "(no title)",
      line: `Opens SPICE article ${dash(v.article_id)}`,
      meta: `performer_id ${dash(v.performer_id)}`,
    }),
    distributeNow: {
      help: "distribute_now. Turn it on to send: the server publishes each notification at its time, or right away if that time has passed. Leave it off and nothing is sent.",
      line: "distribute_now ON, published at each notification's time",
      required: true,
    },
    // Only ecs-api has it (`../fe-docs/API-DOC-news-push.md`). The express path is a guess and
    // unused until express has the endpoint: `unavailableOn` keeps every run on ecs-api.
    ecsForwardPath: "/api/test_notification/news_pushes",
    routeSlug: "news-push",
    expressPath: "/api/notifications/news-pushes",
    backendConfirmed: { "ecs-api": true, express: false },
    unavailableOn: ["express"],
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
    distributeNow: {
      help: "distribute_now. Turn it on to send: the server publishes every status block for you. Leave it off and nothing is sent.",
      line: "distribute_now ON, the server publishes each status block",
      required: true,
    },
    ecsForwardPath: "/api/test_notification/order_pushes",
    routeSlug: "order-push",
    expressPath: "/api/notifications/order-pushes",
    backendConfirmed: { "ecs-api": false, express: false },
    unavailableOn: ["express"],
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

/**
 * `values` with every empty field set to the example its input shows as a placeholder, so a new
 * card or item starts out sendable. The link field takes the placeholder of the row's link kind.
 */
export function withPlaceholders(
  fields: FieldConfig[],
  values: Record<string, string>,
): Record<string, string> {
  const out = { ...values };
  for (const f of fields) {
    if (out[f.key]) continue;
    const example = f.link
      ? LINKS[(out.kind || "web") as LinkKind].placeholder
      : f.placeholder;
    if (example) out[f.key] = example;
  }
  return out;
}

/** Minutes between the times `newRowTime` tries. */
const NEW_ROW_STEP_MIN = 5;

/**
 * The time for a row added after `rows`: `blank()`'s default when it passes this type's time rules,
 * else the nearest time that does. The rules are the form's own (`validateRows`: Auto App's window
 * and 2-hour cap, Normal's window and overlap), plus In store's `IS-0206`: no two notifications in
 * one run at the same time. Auto App starts looking at now, the rest at the default; both step
 * forward 5 minutes at a time and wrap past midnight. When nothing passes (e.g. Auto App on a
 * future date), the default is kept and Execute reports it as usual.
 */
function newRowTime(
  pushType: PushTypeConfig,
  rows: FormRow[],
  values: Record<string, string>,
  date: string,
  now: Date,
): { hour: string; min: string } {
  const fallback = { hour: values.hour, min: values.min };
  const passes = (minutes: number) => {
    const time = { hour: pad(Math.floor(minutes / 60)), min: pad(minutes % 60) };
    if (
      pushType.id === "last_minute_push" &&
      rows.some(
        (r) =>
          Number(r.values.hour) * 60 + Number(r.values.min) === minutes,
      )
    )
      return null;
    const row: FormRow = {
      id: -1,
      collapsed: false,
      values: { ...values, ...time },
      items: [],
    };
    // Normal's overlap mark goes on the later of two rows, and the new row is the last one.
    const errors = validateRows([...rows, row], pushType, date, now).at(-1) ?? [];
    return errors.some((e) => ["time", "hour", "min"].includes(e.field ?? ""))
      ? null
      : time;
  };

  const byDefault = Number(values.hour) * 60 + Number(values.min);
  if (Number.isInteger(byDefault) && passes(byDefault)) return fallback;

  // Auto App's 2-hour cap is counted from now, so its search starts at now, rounded up.
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const nowMin = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  const from =
    pushType.leadMs !== undefined
      ? Math.ceil(nowMin / NEW_ROW_STEP_MIN) * NEW_ROW_STEP_MIN
      : Number.isInteger(byDefault)
        ? byDefault
        : 0;
  for (let step = 0; step < (24 * 60) / NEW_ROW_STEP_MIN; step++) {
    const time = passes((from + step * NEW_ROW_STEP_MIN) % (24 * 60));
    if (time) return time;
  }
  return fallback;
}

/**
 * `rows` with each time moved, where needed, to one that passes the type's time rules
 * (`newRowTime`). Rows are checked in order, each against the ones before it. Once a row moves, the
 * rows after it first try the same shift, so samples keep their spacing: Auto App's 15:30 / 15:35
 * become now / now + 5. Rows that already pass are returned as they are.
 */
export function retimeRows(
  pushType: PushTypeConfig,
  rows: FormRow[],
  date: string,
  now: Date = new Date(),
): FormRow[] {
  if (pushType.globalTime) return rows;
  const DAY = 24 * 60;
  let shift = 0;
  const out: FormRow[] = [];
  for (const row of rows) {
    const own = Number(row.values.hour) * 60 + Number(row.values.min);
    if (!Number.isInteger(own)) {
      out.push(row);
      continue;
    }
    const start = (((own + shift) % DAY) + DAY) % DAY;
    const time = newRowTime(
      pushType,
      out,
      { ...row.values, hour: pad(Math.floor(start / 60)), min: pad(start % 60) },
      date,
      now,
    );
    shift = Number(time.hour) * 60 + Number(time.min) - own;
    out.push(
      shift === 0 ? row : { ...row, values: { ...row.values, ...time } },
    );
  }
  return out;
}

/**
 * A freshly added row's values: `blank()` filled from the placeholders, at a time that passes the
 * type's time rules (`newRowTime`). A delivery ID is stepped past every one already in `rows`,
 * because each row needs its own.
 */
export function newRowValues(
  pushType: PushTypeConfig,
  rows: FormRow[],
  date: string,
  now: Date = new Date(),
): Record<string, string> {
  const values = withPlaceholders(pushType.fields, pushType.blank());
  // Order has one shared start time and no hour/minute on the row.
  if (!pushType.globalTime)
    Object.assign(values, newRowTime(pushType, rows, values, date, now));
  if (values.deliv_id) {
    const used = new Set(rows.map((r) => (r.values.deliv_id ?? "").trim()));
    while (used.has(values.deliv_id)) {
      const next = nextDelivId(values.deliv_id);
      // An ID with no number at the end cannot be stepped; keep it rather than loop forever.
      if (next === values.deliv_id) break;
      values.deliv_id = next;
    }
  }
  return values;
}
