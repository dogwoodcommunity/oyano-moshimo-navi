import { type NextRequest } from "next/server";
import {
  CONSULT_MEMORY_CONSENT_VERSION,
  consultAnswerToHistoryTurn,
  normalizeConsultAnswer,
  type ConsultAnswer,
  type ConsultHistoryTurn,
  type ConsultImportantChange,
  type ConsultMemoryContext,
  type ConsultPerson,
  type ConsultSourceRecord,
  type ConsultTask
} from "@oyano/shared";
import { redactSensitive } from "@/lib/consult";
import { getServerSupabase } from "@/lib/serverSupabase";

type JsonRecord = Record<string, unknown>;
type ServerSupabase = NonNullable<ReturnType<typeof getServerSupabase>>;

/** 1日1件なら約54年分。上限超過は要約にも明記し、黙って「全件」とは扱わない。 */
export const CONSULT_MEMORY_MAX_RECORDS = 20_000;
export const CONSULT_MEMORY_MAX_IMPORTANT_CHANGES = CONSULT_MEMORY_MAX_RECORDS;
export const CONSULT_MEMORY_MAX_USER_SUMMARY_LENGTH = 2_000;
export const CONSULT_MEMORY_MAX_OVERVIEW_LENGTH = 4_000;

export const CONSULT_MEMORY_NOT_READY_MESSAGE =
  "この人専用AIの長期記憶は、ただいま準備中です。準備が完了するまで、手帳の記録はこれまで通り利用できます。";

export class ConsultMemoryNotReadyError extends Error {
  readonly code = "memory_not_ready";

  constructor(message = CONSULT_MEMORY_NOT_READY_MESSAGE) {
    super(message);
    this.name = "ConsultMemoryNotReadyError";
  }
}

export class ConsultMemoryConflictError extends Error {
  readonly code = "memory_conflict";

  constructor() {
    super("別の家族が同時に記憶を更新しました。最新の内容を読み直して、もう一度お試しください。");
    this.name = "ConsultMemoryConflictError";
  }
}

export class ConsultMemoryConsentRequiredError extends Error {
  readonly code = "memory_consent_required";
  readonly status = 422;

  constructor() {
    super("長期記憶へ保存する内容を確認し、同意欄にチェックしてからお試しください。");
    this.name = "ConsultMemoryConsentRequiredError";
  }
}

export class ConsultMemoryConsentConflictError extends Error {
  readonly code = "consent_conflict";
  readonly status = 409;

  constructor() {
    super("別の画面で同意状態が変更されました。最新の状態を読み直して、もう一度お試しください。");
    this.name = "ConsultMemoryConsentConflictError";
  }
}

export class ConsultMemoryAccessError extends Error {
  constructor(
    readonly code: "login_required" | "person_not_found" | "person_ambiguous" | "family_required" | "forbidden" | "invalid_request",
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ConsultMemoryAccessError";
  }
}

export type NormalizedPersonMemory = {
  personId: string;
  longTermSummary: string;
  userSummary: string;
  importantChanges: ConsultImportantChange[];
  excludedEventIds: string[];
  sourceEventIds: string[];
  recordCount: number;
  firstRecordDate: string | null;
  lastRecordDate: string | null;
  memoryVersion: number;
  memoryResetAt: string | null;
  updatedAt: string | null;
};

export type AuthorizedConsultPerson = {
  supabase: ServerSupabase;
  userId: string;
  familyId: string;
  memberRole: "owner" | "admin" | "member" | "viewer";
  personId: string;
  personRow: JsonRecord;
};

export function canManageSharedConsultMemory(authorized: AuthorizedConsultPerson): boolean {
  return authorized.memberRole === "owner" || authorized.memberRole === "admin";
}

export function canEditSharedConsultMemory(authorized: AuthorizedConsultPerson): boolean {
  return authorized.memberRole !== "viewer";
}

/** DBに想定外の権限値が入っても、共有記憶の編集権限を付与しない。 */
export function normalizeConsultMemberRole(value: unknown): AuthorizedConsultPerson["memberRole"] {
  const role = asString(value, 20);
  return role === "owner" || role === "admin" || role === "member" || role === "viewer"
    ? role
    : "viewer";
}

export type DurableConsultContext = {
  personId: string;
  familyId: string;
  person: ConsultPerson;
  tasks: ConsultTask[];
  memory: ConsultMemoryContext;
  memoryState: NormalizedPersonMemory;
  sourceEventIds: string[];
  threadId: string;
  historyTurns: number;
};

export type PersistentConsultTurn = {
  id: string;
  question: string;
  answer: ConsultAnswer;
  sourceEventIds: string[];
  memoryVersion: number;
  savedToNotebookAt: string | null;
  createdAt: string | null;
};

/** 1日5回を約11年分。超過時も概要に明記し、黙って全件扱いしない。 */
export const CONSULT_MEMORY_MAX_TURNS = 20_000;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown, maxLength = 4_000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength).trim() : "";
}

function asStringArray(value: unknown, limit = CONSULT_MEMORY_MAX_RECORDS): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

function safeDate(value: unknown): string | undefined {
  const text = asString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function safeIso(value: unknown): string | undefined {
  const text = asString(value, 40);
  return Number.isNaN(Date.parse(text)) ? undefined : text;
}

function safeMood(value: unknown): ConsultSourceRecord["mood"] {
  return value === "urgent" || value === "changed" || value === "stable" ? value : "stable";
}

/** Pure: DB行やテストfixtureを、安全な根拠付き記録へ正規化する。 */
export function normalizeSourceRecord(input: unknown): ConsultSourceRecord | null {
  const row = asRecord(input);
  const sourceEventId = asString(row.sourceEventId ?? row.id, 80);
  const body = redactSensitive(asString(row.body ?? row.title, 1_000)).slice(0, 400).trim();
  if (!sourceEventId || !body) return null;
  return {
    sourceEventId,
    date: safeDate(row.date ?? row.event_date),
    mood: safeMood(row.mood),
    body,
    createdAt: safeIso(row.createdAt ?? row.created_at)
  };
}

function recordSortValue(record: ConsultSourceRecord): string {
  return `${record.date ?? "0000-00-00"}T${record.createdAt ?? "00:00:00"}`;
}

export function sortSourceRecords(records: ConsultSourceRecord[]): ConsultSourceRecord[] {
  return [...records].sort((a, b) => recordSortValue(b).localeCompare(recordSortValue(a)));
}

function compactRecordBody(body: string, maxLength = 180): string {
  return body.replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function questionTokens(input: string): Set<string> {
  const normalized = input.normalize("NFKC").toLowerCase();
  const tokens = new Set<string>();
  const domainTopics: Array<[RegExp, string]> = [
    [/薬|服薬|処方|飲み忘れ|投薬/, "topic:medication"],
    [/食事|食欲|ごはん|水分|飲水|脱水/, "topic:nutrition"],
    [/病院|通院|受診|入院|退院|医師|看護/, "topic:hospital"],
    [/物忘れ|認知|記憶|発言|会話|行動/, "topic:memory-behavior"],
    [/介護|施設|ケア|訪問|デイサービス|ヘルパー|支援/, "topic:care"],
    [/転倒|痛み|発熱|呼吸|睡眠|排泄|血圧/, "topic:condition"]
  ];
  domainTopics.forEach(([pattern, token]) => {
    if (pattern.test(normalized)) tokens.add(token);
  });
  const chunks = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}a-z0-9]+/gu) ?? [];
  const stop = new Set([
    "について", "こと", "これ", "それ", "どの", "どう", "です", "ます", "した", "して",
    "いる", "ある", "ない", "相談", "確認", "必要", "ため", "たい", "前に", "今回"
  ]);
  chunks.forEach((chunk) => {
    if (chunk.length >= 2 && !stop.has(chunk)) tokens.add(chunk);
    // 「薬について」と「薬の飲み忘れ」のように助詞が変わっても一致させる。
    // 全1文字を入れるとノイズになるため、介護相談で意味を持つ漢字だけに限定する。
    [...chunk].forEach((character) => {
      if ("薬食水痛熱血便眠咳痰傷骨歯目耳".includes(character)) tokens.add(character);
    });
    // 日本語は空白で分かれないため、2文字gramでも一致を取る。
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(chunk)) {
      for (let index = 0; index < chunk.length - 1; index += 1) {
        const token = chunk.slice(index, index + 2);
        if (!stop.has(token)) tokens.add(token);
      }
    }
  });
  return tokens;
}

/** Pure: 最新12件と重複しない古い記録を、質問一致・急ぎ・変化の順で最大6件選ぶ。 */
export function selectRelevantOlderRecords(
  records: ConsultSourceRecord[],
  question: string,
  latestCount = 12,
  olderLimit = 6
): ConsultSourceRecord[] {
  const sorted = sortSourceRecords(records);
  const latestIds = new Set(sorted.slice(0, latestCount).map((record) => record.sourceEventId));
  const tokens = questionTokens(question);

  return sorted
    .filter((record) => !latestIds.has(record.sourceEventId))
    .map((record, index) => {
      const bodyTokens = questionTokens(record.body);
      let overlap = 0;
      tokens.forEach((token) => {
        if (bodyTokens.has(token)) overlap += token.length >= 4 ? 4 : 1;
      });
      const moodBoost = record.mood === "urgent" ? 8 : record.mood === "changed" ? 4 : 0;
      return { record, overlap, moodBoost, index };
    })
    .filter((item) => item.overlap > 0)
    // まず質問と実際に語が重なる記録を優先し、その中で急ぎ・変化を押し上げる。
    // 無関係な古い「急ぎ」が、関連する通常記録を押し出さないようにする。
    .sort((a, b) =>
      Number(b.overlap > 0) - Number(a.overlap > 0)
      || b.overlap - a.overlap
      || b.moodBoost - a.moodBoost
      || a.index - b.index
      || a.record.sourceEventId.localeCompare(b.record.sourceEventId))
    .slice(0, olderLimit)
    .map((item) => item.record);
}

/** Pure: 変化あり・急ぎの記録だけを、根拠ID付きで履歴化する。 */
export function buildImportantChanges(
  records: ConsultSourceRecord[],
  limit = CONSULT_MEMORY_MAX_IMPORTANT_CHANGES
): ConsultImportantChange[] {
  return sortSourceRecords(records)
    .filter((record): record is ConsultSourceRecord & { mood: "changed" | "urgent" } =>
      record.mood === "changed" || record.mood === "urgent")
    .slice(0, limit)
    .map((record) => ({
      sourceEventId: record.sourceEventId,
      date: record.date,
      mood: record.mood,
      summary: compactRecordBody(record.body, 300)
    }));
}

/** Pure: 全件数・期間・変化件数と直近の事実から、推測を含まない長期要約を作る。 */
export function buildLongTermOverview(records: ConsultSourceRecord[], truncated = false): string {
  const sorted = sortSourceRecords(records);
  if (sorted.length === 0) return "手帳の記録はまだありません。";
  const dates = sorted.map((record) => record.date).filter((date): date is string => Boolean(date)).sort();
  const changed = sorted.filter((record) => record.mood === "changed").length;
  const urgent = sorted.filter((record) => record.mood === "urgent").length;
  const lines = [
    `保存済みの手帳記録は${sorted.length}件です。記録期間は${dates[0] ?? "日付不明"}から${dates.at(-1) ?? "日付不明"}までです。`,
    `内訳は、変化ありが${changed}件、急ぎが${urgent}件です。`
  ];

  lines.push("記録開始時の内容（記録IDは根拠の確認用です）:");
  [...sorted].reverse().slice(0, 2).forEach((record) => {
    lines.push(`- ${record.date ?? "日付なし"} [記録ID:${record.sourceEventId}] ${compactRecordBody(record.body)}`);
  });

  const topicDefinitions: Array<{ label: string; pattern: RegExp }> = [
    { label: "食事・水分", pattern: /食事|食欲|ごはん|水分|飲水|脱水/ },
    { label: "薬・服薬", pattern: /薬|服薬|処方|飲み忘れ|投薬/ },
    { label: "体調・身体", pattern: /体調|痛み|発熱|熱|呼吸|転倒|睡眠|排泄|便|血圧/ },
    { label: "物忘れ・発言・行動", pattern: /物忘れ|認知|記憶|発言|会話|行動|様子/ },
    { label: "病院・通院・入院", pattern: /病院|通院|受診|入院|退院|医師|看護/ },
    { label: "介護・施設・支援", pattern: /介護|施設|ケア|訪問|デイサービス|ヘルパー|支援/ },
    { label: "家族・暮らし", pattern: /家族|同居|独居|一人暮らし|生活|住まい|連絡/ }
  ];
  const topicRows = topicDefinitions.flatMap(({ label, pattern }) => {
    const matches = sorted.filter((record) => pattern.test(record.body));
    if (matches.length === 0) return [];
    const topicDates = matches.map((record) => record.date).filter((date): date is string => Boolean(date)).sort();
    const latest = matches[0];
    return [{ label, matches, topicDates, latest }];
  });
  if (topicRows.length > 0) {
    lines.push("全期間の記録に出てきた主な話題（決めた単語との一致を数えたもので、AIの推測ではありません）:");
    topicRows.forEach(({ label, matches, topicDates, latest }) => {
      const period = topicDates.length > 0 ? `${topicDates[0]}〜${topicDates.at(-1)}` : "日付不明";
      lines.push(`- ${label}: ${matches.length}件（${period}）。最新 ${latest.date ?? "日付なし"} [記録ID:${latest.sourceEventId}] ${compactRecordBody(latest.body, 120)}`);
    });
  }

  lines.push("直近の記録:");
  sorted.slice(0, 3).forEach((record) => {
    lines.push(`- ${record.date ?? "日付なし"} [記録ID:${record.sourceEventId}] ${compactRecordBody(record.body)}`);
  });
  if (truncated) {
    lines.push(`※安全上限の${CONSULT_MEMORY_MAX_RECORDS.toLocaleString("ja-JP")}件を超えた古い記録があります。長期記憶の再構築が必要です。`);
  }
  return lines.join("\n").slice(0, CONSULT_MEMORY_MAX_OVERVIEW_LENGTH).trim();
}

function normalizeImportantChanges(value: unknown): ConsultImportantChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const sourceEventId = asString(row.sourceEventId ?? row.source_event_id, 80);
    const summary = asString(row.summary, 300);
    const mood = row.mood === "urgent" ? "urgent" as const : row.mood === "changed" ? "changed" as const : null;
    if (!sourceEventId || !summary || !mood) return [];
    return [{ sourceEventId, date: safeDate(row.date), mood, summary }];
  }).slice(0, CONSULT_MEMORY_MAX_IMPORTANT_CHANGES);
}

/** Pure: API/DBのsnake_case行を、UIへ返す安定したcamelCase形へ揃える。 */
export function normalizeMemoryState(input: unknown, personId = ""): NormalizedPersonMemory {
  const row = asRecord(input);
  return {
    personId: asString(row.personId ?? row.person_id, 80) || personId,
    longTermSummary: asString(row.longTermSummary ?? row.long_term_summary, CONSULT_MEMORY_MAX_OVERVIEW_LENGTH),
    userSummary: asString(row.userSummary ?? row.user_summary, CONSULT_MEMORY_MAX_USER_SUMMARY_LENGTH),
    importantChanges: normalizeImportantChanges(row.importantChanges ?? row.important_changes),
    excludedEventIds: asStringArray(row.excludedEventIds ?? row.excluded_event_ids),
    sourceEventIds: asStringArray(row.sourceEventIds ?? row.source_event_ids),
    recordCount: Math.max(0, Number(row.recordCount ?? row.record_count) || 0),
    firstRecordDate: safeDate(row.firstRecordDate ?? row.first_record_date) ?? null,
    lastRecordDate: safeDate(row.lastRecordDate ?? row.last_record_date) ?? null,
    memoryVersion: Math.max(1, Number(row.memoryVersion ?? row.memory_version) || 1),
    memoryResetAt: safeIso(row.memoryResetAt ?? row.memory_reset_at) ?? null,
    updatedAt: safeIso(row.updatedAt ?? row.updated_at) ?? null
  };
}

export function isConsultMemorySchemaMissing(error: unknown): boolean {
  const row = asRecord(error);
  const code = asString(row.code, 40);
  const message = asString(row.message, 1_000).toLowerCase();
  return code === "42P01"
    || code === "PGRST205"
    || ((code === "42703" || code === "PGRST204")
      && message.includes("ai_memory_consents")
      && message.includes("revision"))
    || message.includes("person_ai_memories") && (message.includes("does not exist") || message.includes("schema cache"))
    || message.includes("ai_consult_threads") && (message.includes("does not exist") || message.includes("schema cache"))
    || message.includes("ai_consult_turns") && (message.includes("does not exist") || message.includes("schema cache"))
    || message.includes("ai_memory_consents") && (message.includes("does not exist") || message.includes("schema cache"));
}

function throwIfMemorySchemaMissing(error: unknown): void {
  if (isConsultMemorySchemaMissing(error)) throw new ConsultMemoryNotReadyError();
}

function readBearerToken(request: NextRequest): string | null {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

/** 長期記憶は従来の外部AI送信同意(v01)を流用せず、現行versionを明示必須にする。 */
export function assertConsultMemoryConsent(version: unknown): asserts version is string {
  if (version !== CONSULT_MEMORY_CONSENT_VERSION) throw new ConsultMemoryConsentRequiredError();
}

export async function readConsultMemoryConsent(authorized: AuthorizedConsultPerson) {
  const { data, error } = await authorized.supabase
    .from("ai_memory_consents")
    .select("consent_version,revision,accepted_at,revoked_at,updated_at")
    .eq("person_id", authorized.personId)
    .eq("user_id", authorized.userId)
    .maybeSingle();
  if (error) {
    throwIfMemorySchemaMissing(error);
    throw error;
  }
  const row = asRecord(data);
  const rawRevision = Number(row.revision);
  if (data && (!Number.isInteger(rawRevision) || rawRevision < 1)) {
    throw new ConsultMemoryNotReadyError();
  }
  const version = asString(row.consent_version, 100);
  const revokedAt = safeIso(row.revoked_at) ?? null;
  return {
    active: version === CONSULT_MEMORY_CONSENT_VERSION && !revokedAt,
    revision: data ? rawRevision : 0,
    version: version || null,
    acceptedAt: safeIso(row.accepted_at) ?? null,
    revokedAt,
    updatedAt: safeIso(row.updated_at) ?? null
  };
}

/** 記憶の取得・生成前に、利用者×対象者単位の有効な同意をサーバーで確認する。 */
export async function recordConsultMemoryConsent(
  authorized: AuthorizedConsultPerson,
  version: string,
  _acceptedVia: "memory-api" | "consult-api"
): Promise<void> {
  assertConsultMemoryConsent(version);
  const consent = await readConsultMemoryConsent(authorized);
  if (!consent.active) throw new ConsultMemoryConsentRequiredError();
}

export async function setConsultMemoryConsent(
  authorized: AuthorizedConsultPerson,
  action: "accept" | "revoke",
  version: string,
  acceptedVia: "web" | "mobile" | "unknown",
  expectedRevision: number
) {
  assertConsultMemoryConsent(version);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new ConsultMemoryAccessError("invalid_request", "同意状態の版番号が正しくありません。", 400);
  }
  const current = await readConsultMemoryConsent(authorized);
  if (current.revision !== expectedRevision) throw new ConsultMemoryConsentConflictError();
  const now = new Date().toISOString();
  const payload = {
    person_id: authorized.personId,
    user_id: authorized.userId,
    consent_version: version,
    revision: expectedRevision + 1,
    accepted_at: action === "revoke" && current.acceptedAt ? current.acceptedAt : now,
    revoked_at: action === "revoke" ? now : null,
    updated_at: now
  };

  const { data: saved, error: saveError } = expectedRevision === 0
    ? await authorized.supabase
      .from("ai_memory_consents")
      .insert(payload)
      .select("revision")
      .single()
    : await authorized.supabase
      .from("ai_memory_consents")
      .update(payload)
      .eq("person_id", authorized.personId)
      .eq("user_id", authorized.userId)
      .eq("revision", expectedRevision)
      .select("revision")
      .maybeSingle();
  if (saveError) {
    throwIfMemorySchemaMissing(saveError);
    if (asString(asRecord(saveError).code, 40) === "23505") {
      throw new ConsultMemoryConsentConflictError();
    }
    throw saveError;
  }
  if (!saved) throw new ConsultMemoryConsentConflictError();
  const { error: auditError } = await authorized.supabase.from("audit_logs").insert({
    actor_user_id: authorized.userId,
    action: action === "accept" ? "ai_memory_consent_accepted" : "ai_memory_consent_revoked",
    target_type: "person",
    target_id: authorized.personId,
    metadata: {
      memory_consent_version: version,
      previous_revision: expectedRevision,
      revision: expectedRevision + 1,
      changed_at: now,
      accepted_via: acceptedVia
    }
  });
  if (auditError) console.error("[consult-memory] failed to audit consent change", auditError);
  return readConsultMemoryConsent(authorized);
}

/** personId/localCaseIdを解決し、本人が属する家族のメンバーであることを必ずサーバーで確認する。 */
export async function authorizeConsultPerson(
  request: NextRequest,
  identifier: { personId?: string; localCaseId?: string; familyId?: string }
): Promise<AuthorizedConsultPerson> {
  const personId = asString(identifier.personId, 80);
  const localCaseId = asString(identifier.localCaseId, 120);
  const requestedFamilyId = asString(identifier.familyId, 80);
  if (!personId && !localCaseId) {
    throw new ConsultMemoryAccessError("invalid_request", "対象者を確認できませんでした。", 400);
  }
  if (!personId && !requestedFamilyId) {
    throw new ConsultMemoryAccessError(
      "family_required",
      "この手帳の家族を確認できませんでした。家族ボードでクラウド保存を確認してください。",
      400
    );
  }
  const token = readBearerToken(request);
  if (!token) {
    throw new ConsultMemoryAccessError(
      "login_required",
      "この人専用AIを使うには、家族ボードでメール確認をしてください。",
      401
    );
  }
  const supabase = getServerSupabase();
  if (!supabase) throw new ConsultMemoryNotReadyError();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    throw new ConsultMemoryAccessError("login_required", "ログインを確認できませんでした。もう一度メール確認をしてください。", 401);
  }
  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id,role")
    .eq("user_id", authData.user.id);
  if (membershipError) throw membershipError;
  const familyIds = (memberships ?? []).map((row) => asString(row.family_id, 80)).filter(Boolean);
  if (familyIds.length === 0) {
    throw new ConsultMemoryAccessError("forbidden", "この手帳を見る家族権限がありません。", 403);
  }
  if (requestedFamilyId && !familyIds.includes(requestedFamilyId)) {
    throw new ConsultMemoryAccessError("forbidden", "この手帳を見る家族権限がありません。", 403);
  }

  let personRow: JsonRecord | undefined;
  if (personId) {
    const personFamilyIds = requestedFamilyId ? [requestedFamilyId] : familyIds;
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .in("family_id", personFamilyIds)
      .maybeSingle();
    if (error) throw error;
    personRow = data ? asRecord(data) : undefined;
  } else {
    // localCaseIdは家族内だけで一意な移行ID。同じ利用者が複数家族に所属しても
    // 別家族の同名IDを拾わないよう、端末が固定したfamilyIdを必須条件にする。
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("family_id", requestedFamilyId);
    if (error) throw error;
    const matchedPeople = (data ?? []).map(asRecord).filter((row) =>
      asString(asRecord(row.profile).localCaseId, 120) === localCaseId
      || asString(row.id, 120) === localCaseId);
    if (matchedPeople.length > 1) {
      throw new ConsultMemoryAccessError(
        "person_ambiguous",
        "同じ識別子の手帳が複数あるため対象者を決められません。クラウド保存を開き直してください。",
        409
      );
    }
    personRow = matchedPeople[0];
  }
  if (!personRow) {
    throw new ConsultMemoryAccessError("person_not_found", "対象者のクラウド手帳が見つかりませんでした。", 404);
  }
  const familyId = asString(personRow.family_id, 80);
  if (!familyIds.includes(familyId)) {
    throw new ConsultMemoryAccessError("forbidden", "この手帳を見る家族権限がありません。", 403);
  }
  return {
    supabase,
    userId: authData.user.id,
    familyId,
    memberRole: (() => {
      const role = asString((memberships ?? []).find((row) => asString(row.family_id, 80) === familyId)?.role, 20);
      return normalizeConsultMemberRole(role);
    })(),
    personId: asString(personRow.id, 80),
    personRow
  };
}

function canonicalPerson(row: JsonRecord): ConsultPerson {
  const profile = asRecord(row.profile);
  const personProfile = asRecord(profile.personProfile);
  return {
    relationship: asString(personProfile.relationship ?? row.relationship_to_family, 40) || undefined,
    careStatus: asString(personProfile.careStatus ?? row.current_status, 80) || undefined,
    birthDate: asString(personProfile.birthDate ?? row.age_band, 20) || undefined,
    hospitalOrFacility: asString(personProfile.hospitalOrFacility, 200) || undefined,
    medicationNote: asString(personProfile.medicationNote, 300) || undefined,
    familyStructureNote: asString(personProfile.familyStructureNote, 300) || undefined,
    carePreference: asString(personProfile.carePreference, 300) || undefined
  };
}

function memoryRowsEqual(a: NormalizedPersonMemory, b: Omit<NormalizedPersonMemory, "updatedAt">): boolean {
  return a.longTermSummary === b.longTermSummary
    && a.userSummary === b.userSummary
    && JSON.stringify(a.importantChanges) === JSON.stringify(b.importantChanges)
    && JSON.stringify(a.excludedEventIds) === JSON.stringify(b.excludedEventIds)
    && JSON.stringify(a.sourceEventIds) === JSON.stringify(b.sourceEventIds)
    && a.recordCount === b.recordCount
    && a.firstRecordDate === b.firstRecordDate
    && a.lastRecordDate === b.lastRecordDate
    && a.memoryResetAt === b.memoryResetAt;
}

/**
 * 外部AIの処理中に記憶が訂正・除外・削除されていないことを、保存直前に確認する。
 * 古い記憶から作った回答を、削除後の履歴へ戻さないためのfail-closed判定。
 */
export async function assertConsultMemorySnapshot(
  authorized: AuthorizedConsultPerson,
  expected: { memoryVersion: number; memoryResetAt: string | null }
) {
  const { data, error } = await authorized.supabase
    .from("person_ai_memories")
    .select("memory_version,memory_reset_at")
    .eq("person_id", authorized.personId)
    .maybeSingle();
  if (error) {
    throwIfMemorySchemaMissing(error);
    throw error;
  }
  const current = normalizeMemoryState(data, authorized.personId);
  if (
    current.memoryVersion !== expected.memoryVersion
    || current.memoryResetAt !== expected.memoryResetAt
  ) {
    throw new ConsultMemoryConflictError();
  }
}

export async function refreshPersonMemory(
  authorized: AuthorizedConsultPerson,
  options: {
    userSummary?: string;
    excludedEventIds?: string[];
    excludeEventId?: string;
    includeEventId?: string;
    memoryResetAt?: string | null;
    expectedMemoryVersion?: number;
  } = {},
  retryCount = 0
): Promise<{ memoryState: NormalizedPersonMemory; records: ConsultSourceRecord[] }> {
  const { data: currentData, error: currentError } = await authorized.supabase
    .from("person_ai_memories")
    .select("*")
    .eq("person_id", authorized.personId)
    .maybeSingle();
  if (currentError) {
    throwIfMemorySchemaMissing(currentError);
    throw currentError;
  }
  const current = normalizeMemoryState(currentData, authorized.personId);
  if (options.expectedMemoryVersion !== undefined && current.memoryVersion !== options.expectedMemoryVersion) {
    throw new ConsultMemoryConflictError();
  }
  const memoryResetAt = options.memoryResetAt !== undefined ? options.memoryResetAt : current.memoryResetAt;
  const excludedEventIdSet = new Set(options.excludedEventIds ?? current.excludedEventIds);
  if (options.excludeEventId) excludedEventIdSet.add(options.excludeEventId);
  if (options.includeEventId) excludedEventIdSet.delete(options.includeEventId);
  const excludedEventIds = [...excludedEventIdSet];
  const excludedSet = new Set(excludedEventIds);
  const eventData: JsonRecord[] = [];
  const pageSize = 500;
  // PostgRESTの既定行数制限で古い記録が黙って欠けないよう、明示的にページングする。
  for (let from = 0; from <= CONSULT_MEMORY_MAX_RECORDS; from += pageSize) {
    const { data: page, error: eventError } = await authorized.supabase
      .from("timeline_events")
      .select("id,event_date,mood,body,title,created_at,event_type,metadata")
      .eq("person_id", authorized.personId)
      .eq("event_type", "diary")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, Math.min(from + pageSize - 1, CONSULT_MEMORY_MAX_RECORDS));
    if (eventError) throw eventError;
    eventData.push(...(page ?? []).map(asRecord));
    if ((page ?? []).length < pageSize || eventData.length > CONSULT_MEMORY_MAX_RECORDS) break;
  }
  const truncated = eventData.length > CONSULT_MEMORY_MAX_RECORDS;
  if (truncated) eventData.length = CONSULT_MEMORY_MAX_RECORDS;
  const resetTime = memoryResetAt ? Date.parse(memoryResetAt) : Number.NaN;
  const records = (eventData ?? []).flatMap((row) => {
    const record = normalizeSourceRecord(row);
    if (!record || excludedSet.has(record.sourceEventId)) return [];
    // 「AIの記憶を削除」は生の手帳を消さず、削除時点より前を記憶対象外にする。
    // その後に新しく追加した記録は、次回から再び記憶される。
    if (Number.isFinite(resetTime) && (!record.createdAt || Date.parse(record.createdAt) <= resetTime)) return [];
    const metadata = asRecord(row.metadata);
    // 手動保存された過去のAI回答を本人の事実として再学習させない。
    if (record.body.trimStart().startsWith("相談メモ:") || metadata.source === "ai_consult") return [];
    return [record];
  });
  const sorted = sortSourceRecords(records);
  const dates = sorted.map((record) => record.date).filter((date): date is string => Boolean(date)).sort();
  const nextBase: Omit<NormalizedPersonMemory, "updatedAt"> = {
    personId: authorized.personId,
    longTermSummary: buildLongTermOverview(sorted, truncated),
    userSummary: options.userSummary !== undefined
      ? redactSensitive(options.userSummary.trim()).slice(0, CONSULT_MEMORY_MAX_USER_SUMMARY_LENGTH).trim()
      : current.userSummary,
    importantChanges: buildImportantChanges(sorted),
    excludedEventIds: [...new Set(excludedEventIds)].slice(0, CONSULT_MEMORY_MAX_RECORDS),
    sourceEventIds: sorted.map((record) => record.sourceEventId),
    recordCount: sorted.length,
    firstRecordDate: dates[0] ?? null,
    lastRecordDate: dates.at(-1) ?? null,
    memoryVersion: current.memoryVersion,
    memoryResetAt
  };
  const changed = !currentData || !memoryRowsEqual(current, nextBase);
  if (!changed && currentData && options.expectedMemoryVersion === undefined) {
    return { memoryState: current, records: sorted };
  }
  // 明示PATCHは内容が同じでもversionを進める。これにより同じversionを読んだ
  // 別の家族の更新をCASで検知でき、後勝ちで黙って上書きしない。
  const memoryVersion = currentData ? current.memoryVersion + 1 : 1;
  const now = new Date().toISOString();
  const savePayload = {
      person_id: authorized.personId,
      long_term_summary: nextBase.longTermSummary,
      user_summary: nextBase.userSummary,
      important_changes: nextBase.importantChanges,
      excluded_event_ids: nextBase.excludedEventIds,
      source_event_ids: nextBase.sourceEventIds,
      record_count: nextBase.recordCount,
      first_record_date: nextBase.firstRecordDate,
      last_record_date: nextBase.lastRecordDate,
      memory_version: memoryVersion,
      memory_reset_at: memoryResetAt,
      updated_by: authorized.userId,
      updated_at: now
  };
  const saveResult = currentData
    ? await authorized.supabase
        .from("person_ai_memories")
        .update(savePayload)
        .eq("person_id", authorized.personId)
        .eq("memory_version", current.memoryVersion)
        .select("*")
        .maybeSingle()
    : await authorized.supabase
        .from("person_ai_memories")
        .insert(savePayload)
        .select("*")
        .single();
  const { data: saved, error: saveError } = saveResult;
  if (saveError) {
    throwIfMemorySchemaMissing(saveError);
    if (asString(asRecord(saveError).code, 40) === "23505") {
      if (options.expectedMemoryVersion !== undefined || retryCount >= 3) throw new ConsultMemoryConflictError();
      return refreshPersonMemory(authorized, options, retryCount + 1);
    }
    throw saveError;
  }
  // UPDATE ... WHERE memory_version が0行なら、別リクエストが先に更新した。
  if (!saved) {
    if (options.expectedMemoryVersion !== undefined || retryCount >= 3) throw new ConsultMemoryConflictError();
    return refreshPersonMemory(authorized, options, retryCount + 1);
  }
  return { memoryState: normalizeMemoryState(saved, authorized.personId), records: sorted };
}

async function findPrivateThreadId(authorized: AuthorizedConsultPerson): Promise<string | null> {
  const { data: existing, error: existingError } = await authorized.supabase
    .from("ai_consult_threads")
    .select("id")
    .eq("person_id", authorized.personId)
    .eq("owner_user_id", authorized.userId)
    .maybeSingle();
  if (existingError) {
    throwIfMemorySchemaMissing(existingError);
    throw existingError;
  }
  const existingId = asString(existing?.id, 80);
  return existingId || null;
}

async function ensurePrivateThread(authorized: AuthorizedConsultPerson): Promise<string> {
  const existingId = await findPrivateThreadId(authorized);
  if (existingId) return existingId;
  const { data: inserted, error: insertError } = await authorized.supabase
    .from("ai_consult_threads")
    .insert({ person_id: authorized.personId, owner_user_id: authorized.userId })
    .select("id")
    .single();
  if (insertError) {
    throwIfMemorySchemaMissing(insertError);
    // 並行作成時はunique競合後に既存行を読み直す。
    if (asString(asRecord(insertError).code, 40) === "23505") return ensurePrivateThread(authorized);
    throw insertError;
  }
  return asString(inserted.id, 80);
}

function normalizePersistentConsultTurn(input: unknown): PersistentConsultTurn | null {
  const row = asRecord(input);
  const answer = normalizeConsultAnswer(row.answer);
  const question = asString(row.question, 600);
  const id = asString(row.id, 80);
  if (!answer || !question || !id) return null;
  return {
    id,
    question,
    answer,
    sourceEventIds: asStringArray(row.source_event_ids),
    memoryVersion: Math.max(1, Number(row.memory_version) || 1),
    savedToNotebookAt: safeIso(row.saved_to_notebook_at) ?? null,
    createdAt: safeIso(row.created_at) ?? null
  };
}

export async function readPersistentConsultTurns(
  authorized: AuthorizedConsultPerson,
  threadId: string,
  limit = 4,
  offset = 0
): Promise<PersistentConsultTurn[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, Math.floor(offset));
  const { data, error } = await authorized.supabase
    .from("ai_consult_turns")
    .select("id,question,answer,source_event_ids,memory_version,saved_to_notebook_at,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);
  if (error) {
    throwIfMemorySchemaMissing(error);
    throw error;
  }
  return (data ?? []).flatMap((row) => {
    const turn = normalizePersistentConsultTurn(row);
    return turn ? [turn] : [];
  }).reverse();
}

async function readAllPersistentConsultTurns(
  authorized: AuthorizedConsultPerson,
  threadId: string
): Promise<{ turns: PersistentConsultTurn[]; truncated: boolean }> {
  const descending: PersistentConsultTurn[] = [];
  const pageSize = 500;
  for (let from = 0; from <= CONSULT_MEMORY_MAX_TURNS; from += pageSize) {
    const { data, error } = await authorized.supabase
      .from("ai_consult_turns")
      .select("id,question,answer,source_event_ids,memory_version,saved_to_notebook_at,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .range(from, Math.min(from + pageSize - 1, CONSULT_MEMORY_MAX_TURNS));
    if (error) {
      throwIfMemorySchemaMissing(error);
      throw error;
    }
    descending.push(...(data ?? []).flatMap((row) => {
      const turn = normalizePersistentConsultTurn(row);
      return turn ? [turn] : [];
    }));
    if ((data ?? []).length < pageSize || descending.length > CONSULT_MEMORY_MAX_TURNS) break;
  }
  const truncated = descending.length > CONSULT_MEMORY_MAX_TURNS;
  if (truncated) descending.length = CONSULT_MEMORY_MAX_TURNS;
  return { turns: descending.reverse(), truncated };
}

function consultTurnSearchText(turn: PersistentConsultTurn): string {
  return [
    turn.question,
    turn.answer.situation,
    ...turn.answer.nextChecks.flatMap((item) => [item.title, item.why]),
    ...turn.answer.askQuestions,
    ...turn.answer.providerCategories,
    ...turn.answer.watchOuts,
    turn.answer.recordSuggestion
  ].join(" ");
}

/** Pure: 直近分と重複しない古い相談から、今回の質問と関連するものを選ぶ。 */
export function selectRelevantPriorTurns(
  turns: PersistentConsultTurn[],
  question: string,
  latestCount = 4,
  olderLimit = 4
): PersistentConsultTurn[] {
  const latestIds = new Set(turns.slice(-latestCount).map((turn) => turn.id));
  const queryTokens = questionTokens(question);
  return turns
    .map((turn, index) => {
      const bodyTokens = questionTokens(consultTurnSearchText(turn));
      let overlap = 0;
      queryTokens.forEach((token) => {
        if (bodyTokens.has(token)) overlap += token.length >= 4 ? 4 : 1;
      });
      return { turn, index, overlap };
    })
    // 2文字gramが1つ偶然一致しただけの相談は関連扱いしない。
    .filter((item) => !latestIds.has(item.turn.id) && item.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap || b.index - a.index || a.turn.id.localeCompare(b.turn.id))
    .slice(0, olderLimit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.turn);
}

function topFrequency(values: string[], limit: number): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  values.forEach((value) => {
    const label = compactRecordBody(value, 80);
    if (!label) return;
    const key = label.normalize("NFKC").toLowerCase();
    const current = counts.get(key);
    counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"))
    .slice(0, limit)
    .map((item) => `${item.label}${item.count > 1 ? `（${item.count}回）` : ""}`);
}

/** Pure: 保存済み相談全体を、手帳の事実と混ぜない長期概要へ集計する。 */
export function buildConsultationOverview(
  turns: PersistentConsultTurn[],
  truncated = false
): string {
  if (turns.length === 0) return "過去の相談はまだありません。";
  const topicDefinitions: Array<[string, string]> = [
    ["topic:medication", "薬・服薬"],
    ["topic:nutrition", "食事・水分"],
    ["topic:hospital", "病院・受診"],
    ["topic:memory-behavior", "物忘れ・発言・行動"],
    ["topic:care", "介護・施設・支援"],
    ["topic:condition", "体調・転倒・睡眠など"]
  ];
  const topicCounts = new Map<string, number>();
  turns.forEach((turn) => {
    const tokens = questionTokens(consultTurnSearchText(turn));
    topicDefinitions.forEach(([token, label]) => {
      if (tokens.has(token)) topicCounts.set(label, (topicCounts.get(label) ?? 0) + 1);
    });
  });
  const dates = turns.map((turn) => turn.createdAt).filter((value): value is string => Boolean(value)).sort();
  const lines = [
    `保存済みの過去相談${turns.length}件を全件集計しています${truncated ? `（安全上の上限${CONSULT_MEMORY_MAX_TURNS}件まで）` : ""}。`
  ];
  if (dates.length > 0) lines.push(`相談期間: ${dates[0].slice(0, 10)}から${dates.at(-1)?.slice(0, 10)}。`);
  const topics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([label, count]) => `${label} ${count}件`);
  if (topics.length > 0) lines.push(`これまでの相談テーマ: ${topics.join("、")}。`);
  const nextChecks = topFrequency(turns.flatMap((turn) => turn.answer.nextChecks.map((item) => item.title)), 8);
  if (nextChecks.length > 0) lines.push(`これまでAIが提案した主な確認: ${nextChecks.join(" / ")}。`);
  const providers = topFrequency(turns.flatMap((turn) => turn.answer.providerCategories), 6);
  if (providers.length > 0) lines.push(`これまで候補に挙がった相談先: ${providers.join(" / ")}。`);
  lines.push("上記は過去の相談とAI提案の集計であり、本人について確認済みの事実ではありません。");
  return lines.join("\n").slice(0, 3_000).trim();
}

export async function loadDurableConsultContext(
  authorized: AuthorizedConsultPerson,
  question: string
): Promise<DurableConsultContext> {
  const [{ memoryState, records }, taskResult] = await Promise.all([
    refreshPersonMemory(authorized),
    authorized.supabase
      .from("tasks")
      .select("title,due_date,status")
      .eq("person_id", authorized.personId)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(12)
  ]);
  if (taskResult.error) throw taskResult.error;
  const threadId = await ensurePrivateThread(authorized);
  const { turns: allTurns, truncated: turnsTruncated } = await readAllPersistentConsultTurns(authorized, threadId);
  const latestTurns = allTurns.slice(-4);
  const relatedOlderTurns = selectRelevantPriorTurns(allTurns, question, 4, 4);
  const selectedTurnIds = new Set([...relatedOlderTurns, ...latestTurns].map((turn) => turn.id));
  const turns = allTurns.filter((turn) => selectedTurnIds.has(turn.id));
  const latestRecords = sortSourceRecords(records).slice(0, 12);
  const relevantOlderRecords = selectRelevantOlderRecords(records, question, 12, 6);
  const priorSuggestions: ConsultHistoryTurn[] = turns.map((turn) =>
    consultAnswerToHistoryTurn(turn.question, turn.answer));
  return {
    personId: authorized.personId,
    familyId: authorized.familyId,
    person: canonicalPerson(authorized.personRow),
    tasks: (taskResult.data ?? []).map((task) => ({
      title: asString(task.title, 120) || undefined,
      dueDate: safeDate(task.due_date)
    })),
    memory: {
      longTermSummary: memoryState.longTermSummary,
      userSummary: memoryState.userSummary,
      importantChanges: memoryState.importantChanges,
      latestRecords,
      relevantOlderRecords,
      consultationOverview: buildConsultationOverview(allTurns, turnsTruncated),
      priorSuggestions,
      memoryVersion: memoryState.memoryVersion
    },
    memoryState,
    sourceEventIds: [...new Set([...latestRecords, ...relevantOlderRecords].map((record) => record.sourceEventId))],
    threadId,
    historyTurns: allTurns.length
  };
}

export async function persistConsultTurn(input: {
  authorized: AuthorizedConsultPerson;
  threadId: string;
  question: string;
  answer: ConsultAnswer;
  sourceEventIds: string[];
  memoryVersion: number;
}): Promise<{ id: string; createdAt: string | null }> {
  const now = new Date().toISOString();
  // 外部AIへ送る時だけでなく、永続履歴へ保存する前にも必ず伏せる。
  // 端末から届いた質問をそのままDBへ残さない。
  const safeQuestion = persistentConsultQuestion(input.question);
  const { data, error } = await input.authorized.supabase
    .from("ai_consult_turns")
    .insert({
      thread_id: input.threadId,
      question: safeQuestion,
      answer: input.answer,
      source_event_ids: input.sourceEventIds.slice(0, 18),
      memory_version: input.memoryVersion
    })
    .select("id,created_at")
    .single();
  if (error) {
    throwIfMemorySchemaMissing(error);
    throw error;
  }
  const { error: threadError } = await input.authorized.supabase
    .from("ai_consult_threads")
    .update({ updated_at: now })
    .eq("id", input.threadId)
    .eq("owner_user_id", input.authorized.userId);
  if (threadError) console.error("[consult-memory] failed to touch thread", threadError);
  return { id: asString(data.id, 80), createdAt: safeIso(data.created_at) ?? null };
}

function persistentConsultQuestion(question: string): string {
  return redactSensitive(question.trim()).slice(0, 600).trim()
    || "相談内容（機密情報を除外しました）";
}

/**
 * Free plan only: persist the private turn and consume the reserved daily
 * allowance in one database transaction. The same claim token is retried once
 * so an RPC response lost after commit returns the already-created turn instead
 * of creating a second paid call/turn or reopening the allowance.
 */
export async function persistAndFinalizeFreeConsultTurn(input: {
  authorized: AuthorizedConsultPerson;
  threadId: string;
  claimToken: string;
  question: string;
  answer: ConsultAnswer;
  sourceEventIds: string[];
  memoryVersion: number;
}): Promise<{ id: string; createdAt: string | null }> {
  const args = {
    p_answer: input.answer,
    p_claim_token: input.claimToken,
    p_consent_version: CONSULT_MEMORY_CONSENT_VERSION,
    p_family_id: input.authorized.familyId,
    p_memory_version: input.memoryVersion,
    p_person_id: input.authorized.personId,
    p_redacted_question: persistentConsultQuestion(input.question),
    p_source_event_ids: input.sourceEventIds.slice(0, 18),
    p_thread_id: input.threadId,
    p_user_id: input.authorized.userId
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await input.authorized.supabase
      .rpc("persist_and_finalize_daily_free_consult", args);
    if (error) {
      lastError = error;
      continue;
    }

    const result = asRecord(data);
    if (asString(result.result, 40) === "persisted") {
      const id = asString(result.turnId, 80);
      if (id) return { id, createdAt: safeIso(result.createdAt) ?? null };
    }
    if (asString(result.result, 40) === "forbidden") {
      throw new ConsultMemoryAccessError(
        "forbidden",
        "この手帳でAI相談を保存する権限を確認できませんでした。",
        403
      );
    }
    if (asString(result.result, 40) === "memory_consent_required") {
      throw new ConsultMemoryConsentRequiredError();
    }
    lastError = new Error(`Unexpected free consultation persistence result: ${asString(result.result, 80) || "empty"}`);
  }

  throwIfMemorySchemaMissing(lastError);
  throw lastError instanceof Error ? lastError : new Error("Free consultation persistence failed");
}

export async function listConsultMemory(
  authorized: AuthorizedConsultPerson,
  options: { historyOffset?: number; historyLimit?: number } = {}
) {
  const { memoryState } = await refreshPersonMemory(authorized);
  const threadId = await findPrivateThreadId(authorized);
  const historyOffset = Math.max(0, Math.floor(options.historyOffset ?? 0));
  const historyLimit = Math.max(1, Math.min(Math.floor(options.historyLimit ?? 50), 100));
  const historyResult = threadId
    ? await readAllPersistentConsultTurns(authorized, threadId)
    : { turns: [] as PersistentConsultTurn[], truncated: false };
  const newestFirst = [...historyResult.turns].reverse();
  const history = newestFirst.slice(historyOffset, historyOffset + historyLimit).reverse();
  return {
    personId: authorized.personId,
    memory: memoryState,
    history,
    historyTotal: historyResult.turns.length,
    historyOffset,
    historyHasMore: historyOffset + history.length < historyResult.turns.length,
    historyTruncated: historyResult.truncated
  };
}
