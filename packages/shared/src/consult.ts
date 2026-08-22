export type ConsultPerson = {
  relationship?: string;
  careStatus?: string;
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

export type ConsultRequest = {
  question: string;
  person?: ConsultPerson;
  entries?: ConsultEntry[];
  tasks?: ConsultTask[];
  history?: ConsultHistoryTurn[];
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
export const CONSULT_MAX_HISTORY = 6;

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
  "最近の記録（最大12件）と、期限が近い確認リスト",
  "入力した相談内容",
  "続けて相談する場合は、この画面での前回までの相談と回答の要点"
];

export const CONSULT_WITHHELD_FIELDS = [
  "氏名・呼び名",
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
