export type ConsultPerson = {
  relationship?: string;
  careStatus?: string;
  /** クライアントから外部AIへ渡す前に「70代」などへ丸める。サーバー側も生年月日は年代化して扱う。 */
  birthDate?: string;
  hospitalOrFacility?: string;
  medicationNote?: string;
  familyStructureNote?: string;
  carePreference?: string;
};

export type ConsultEntry = {
  date?: string;
  mood?: "stable" | "changed" | "urgent";
  body?: string;
};

export type ConsultTask = {
  title?: string;
  dueDate?: string;
};

/** 同じ相談の続きで、前回までのやりとりを短くまとめたもの。AIが文脈を引き継ぐために送る。 */
export type ConsultHistoryTurn = {
  question: string;
  situation?: string;
  nextChecks?: string[];
};

/**
 * クラウド手帳を根拠に組み立てた「この人専用AI」の記憶です。
 * sourceEventId は、利用者が根拠の記録を確認・除外できるよう必ず保持します。
 */
export type ConsultImportantChange = {
  sourceEventId: string;
  date?: string;
  mood: "changed" | "urgent";
  summary: string;
};

export type ConsultSourceRecord = {
  sourceEventId: string;
  date?: string;
  mood?: "stable" | "changed" | "urgent";
  body: string;
  createdAt?: string;
};

export type ConsultMemoryContext = {
  /** 手帳の記録から機械的に作った事実の要約。AIの推測は混ぜない。 */
  longTermSummary?: string;
  /** 利用者が自分で確認・訂正できる補足。 */
  userSummary?: string;
  importantChanges?: ConsultImportantChange[];
  latestRecords?: ConsultSourceRecord[];
  relevantOlderRecords?: ConsultSourceRecord[];
  /** 保存済み相談を全件集計した長期概要。手帳の事実ではなく、過去の相談・AI提案として扱う。 */
  consultationOverview?: string;
  /** 過去のAI回答。手帳の事実とは別欄でプロンプトへ渡す。 */
  priorSuggestions?: ConsultHistoryTurn[];
  memoryVersion?: number;
};

export type ConsultRequest = {
  question: string;
  /** ログイン済みクラウド手帳では personId、または familyId と localCaseId の組を送る。 */
  personId?: string;
  localCaseId?: string;
  familyId?: string;
  /** 長期記憶へ保存する同意。durable modeでは現行versionとの完全一致が必要。 */
  memoryConsentVersion?: string;
  person?: ConsultPerson;
  entries?: ConsultEntry[];
  tasks?: ConsultTask[];
  history?: ConsultHistoryTurn[];
  /** サーバーだけが設定する。クライアントから届いた値は採用しない。 */
  memory?: ConsultMemoryContext;
};

export type ConsultAnswer = {
  situation: string;
  nextChecks: Array<{ title: string; why: string }>;
  askQuestions: string[];
  providerCategories: string[];
  watchOuts: string[];
  recordSuggestion: string;
};

export const CONSULT_MAX_QUESTION_LENGTH = 600;
/** 多いほど読む時間が伸びる。本番の所要時間から12件に落とした。 */
export const CONSULT_MAX_ENTRIES = 12;
export const CONSULT_MAX_ENTRY_LENGTH = 400;
/** 続きの相談で遡って渡す前回までのやりとりの数。増やすほど読む時間と費用が伸びる。 */
export const CONSULT_MAX_HISTORY = 4;
/** durable modeは直近4件に加え、今回の質問に関連する古い相談を最大4件渡す。 */
export const CONSULT_MAX_DURABLE_HISTORY = 8;

/** v01の「外部AIへ送る同意」と区別し、長期記憶への永続保存を明示した同意。 */
export const CONSULT_MEMORY_CONSENT_VERSION = "consult-memory-v02-2026-09-01";
export const CONSULT_MEMORY_CONSENT_TEXT =
  "手帳の記録から作る長期要約と、私の質問・AIの回答を対象者ごとにクラウドへ保存し、次回以降の相談に利用することに同意します。AIの記憶は確認・補足・訂正でき、自分の相談履歴は確認・削除できます。家族共有の記憶の一括削除はオーナーまたは管理者が行います。";

export const CONSULT_DISCLAIMER =
  "これは家族が次に動くための整理メモです。診断、法律判断、税務判断ではありません。医療は主治医や看護師へ、手続きは役所や専門家へ確認してください。";

/**
 * 送信前に落とす情報の一覧。UIでそのまま利用者に見せる。
 */
export const CONSULT_SENT_FIELDS = [
  "続柄（母・父など）と、いまの状態",
  "年代（生年月日そのものは送りません）",
  "病院・施設のメモ、薬・注意点のメモ",
  "家族構成メモ、本人の希望メモ",
  "クラウド保存時は、全期間の事実要約・重要な変化と、最新12件＋相談に関連する過去6件（未保存時は最近の記録最大12件）",
  "期限が近い確認リスト",
  "入力した相談内容",
  "あなた自身の過去相談は全件をクラウド保存し、全履歴の長期概要＋直近4回＋今回に関連する古い相談最大4回"
];

export const CONSULT_WITHHELD_FIELDS = [
  "プロフィールの氏名・呼び名（自由記述に書いた氏名は自動判定できないため、相談や記録には入力しないでください）",
  "生年月日（年代だけに変換します）",
  "連絡先、緊急連絡先",
  "書類・鍵の保管場所メモ",
  "写真・PDFの中身",
  "記録の中に書かれた電話番号・メールアドレス（自動で伏せます）",
  "10桁以上の数字、カード番号の形の文字列、暗証番号の近くの数字（自動で伏せます）"
];

/** 相談を受け付ける最低条件。記録もプロフィールも無い状態では一般論しか返せない。 */
export const CONSULT_MIN_PROFILE_FIELDS = 2;

export function hasNotebookSubstance(request: ConsultRequest): boolean {
  const entries = Array.isArray(request.entries) ? request.entries : [];
  const hasEntry = entries.some((entry) => typeof entry?.body === "string" && entry.body.trim().length >= 4);
  if (hasEntry) return true;

  const person = request.person ?? {};
  const filled = ([
    "relationship",
    "careStatus",
    "birthDate",
    "hospitalOrFacility",
    "medicationNote",
    "familyStructureNote",
    "carePreference"
  ] as const).filter((field) => {
    const value = person[field];
    return typeof value === "string" && value.trim().length > 0;
  }).length;

  return filled >= CONSULT_MIN_PROFILE_FIELDS;
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

export function normalizeConsultAnswer(input: unknown): ConsultAnswer | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const situation = typeof raw.situation === "string" ? raw.situation.trim() : "";
  if (!situation) return null;

  const nextChecks = Array.isArray(raw.nextChecks)
    ? raw.nextChecks
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          title: typeof item.title === "string" ? item.title.trim() : "",
          why: typeof item.why === "string" ? item.why.trim() : ""
        }))
        .filter((item) => item.title.length > 0)
        .slice(0, 6)
    : [];

  return {
    situation,
    nextChecks,
    askQuestions: asStringArray(raw.askQuestions, 6),
    providerCategories: asStringArray(raw.providerCategories, 5),
    watchOuts: asStringArray(raw.watchOuts, 5),
    recordSuggestion: typeof raw.recordSuggestion === "string" ? raw.recordSuggestion.trim() : ""
  };
}

/** 相談の回答を、次の相談へ渡す短い履歴に畳む。全文ではなく要点だけを残す。 */
export function consultAnswerToHistoryTurn(question: string, answer: ConsultAnswer): ConsultHistoryTurn {
  return {
    question: question.trim(),
    situation: answer.situation,
    nextChecks: answer.nextChecks.map((check) => check.title).filter((title) => title.length > 0)
  };
}

export function consultAnswerToDiaryBody(question: string, answer: ConsultAnswer): string {
  const lines = [`相談メモ: ${question.trim()}`, "", answer.situation, ""];

  if (answer.nextChecks.length > 0) {
    lines.push("次に確認すること");
    answer.nextChecks.forEach((check) => lines.push(`・${check.title}`));
    lines.push("");
  }
  if (answer.askQuestions.length > 0) {
    lines.push("窓口で聞くこと");
    answer.askQuestions.forEach((item) => lines.push(`・${item}`));
    lines.push("");
  }
  if (answer.recordSuggestion) {
    lines.push(`次に残すこと: ${answer.recordSuggestion}`);
  }

  return lines.join("\n").trim();
}
