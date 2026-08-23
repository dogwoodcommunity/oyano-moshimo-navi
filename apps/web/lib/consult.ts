import {
  CONSULT_MAX_ENTRIES,
  CONSULT_MAX_ENTRY_LENGTH,
  CONSULT_MAX_HISTORY,
  CONSULT_MAX_QUESTION_LENGTH,
  type ConsultEntry,
  type ConsultRequest
} from "@oyano/shared";

const MASK = "［伏字］";

/**
 * 口座番号、マイナンバー、カード番号、暗証番号のような数字列を落とす。
 * 日付（2026-08-21）や短い数字は文脈として必要なので残す。
 */
export function redactSensitive(input: string): string {
  return input
    .replace(/(暗証番号|パスワード|パスコード|PIN|ピン番号)([^\n]{0,12}?)\d{3,}/gi, `$1$2${MASK}`)
    .replace(/(?:\d{4}[\s-]){3}\d{3,4}/g, MASK)
    .replace(/0\d{1,4}[-‐(（\s]\d{1,4}[-‐)）\s]\d{3,4}/g, MASK)
    .replace(/\d{10,}/g, MASK)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, MASK);
}

function clean(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = redactSensitive(value.trim()).slice(0, maxLength).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ageBand(birthDate?: string): string | undefined {
  if (!birthDate) return undefined;
  if (/^\d{2,3}代$/.test(birthDate.trim())) return birthDate.trim();
  const year = Number(birthDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return undefined;
  const age = new Date().getFullYear() - year;
  if (age < 0 || age > 130) return undefined;
  return `${Math.floor(age / 10) * 10}代`;
}

const moodLabel: Record<NonNullable<ConsultEntry["mood"]>, string> = {
  stable: "いつも通り",
  changed: "変化あり",
  urgent: "急ぎ"
};

/**
 * 外部へ送る本文を組み立てる。ここを通らない情報はAPIへ渡さない。
 */
export function buildConsultPrompt(request: ConsultRequest): string {
  const question = clean(request.question, CONSULT_MAX_QUESTION_LENGTH) ?? "";
  const person = request.person ?? {};
  const lines: string[] = [];

  lines.push("# 相談したいこと");
  lines.push(question);
  lines.push("");
  lines.push("# 対象者");

  const profileRows: Array<[string, string | undefined]> = [
    ["続柄", clean(person.relationship, 40)],
    ["年代", ageBand(person.birthDate)],
    ["いまの状態", clean(person.careStatus, 80)],
    ["病院・施設", clean(person.hospitalOrFacility, 200)],
    ["薬・注意点", clean(person.medicationNote, 300)],
    ["家族構成", clean(person.familyStructureNote, 300)],
    ["本人の希望", clean(person.carePreference, 300)]
  ];
  const filledRows = profileRows.filter(([, value]) => Boolean(value));

  if (filledRows.length === 0) {
    lines.push("（プロフィールは未入力です）");
  } else {
    filledRows.forEach(([label, value]) => lines.push(`- ${label}: ${value}`));
  }

  const entries = (request.entries ?? [])
    .slice(0, CONSULT_MAX_ENTRIES)
    .map((entry) => ({
      date: clean(entry.date, 10),
      mood: entry.mood && moodLabel[entry.mood] ? moodLabel[entry.mood] : "いつも通り",
      body: clean(entry.body, CONSULT_MAX_ENTRY_LENGTH)
    }))
    .filter((entry) => Boolean(entry.body));

  lines.push("");
  lines.push("# 最近の記録（新しい順）");
  if (entries.length === 0) {
    lines.push("（記録はまだありません）");
  } else {
    entries.forEach((entry) => lines.push(`- ${entry.date ?? "日付なし"}（${entry.mood}）: ${entry.body}`));
  }

  const tasks = (request.tasks ?? [])
    .slice(0, 12)
    .map((task) => ({ title: clean(task.title, 120), dueDate: clean(task.dueDate, 10) }))
    .filter((task) => Boolean(task.title));

  lines.push("");
  lines.push("# 確認リスト");
  if (tasks.length === 0) {
    lines.push("（確認リストはまだありません）");
  } else {
    tasks.forEach((task) => lines.push(`- ${task.title}${task.dueDate ? `（期限 ${task.dueDate}）` : ""}`));
  }

  // 件数も長さもここで必ず絞る。クライアントを信用せず、巨大な履歴が
  // そのまま外部APIへ流れて費用が跳ねる事故を防ぐ。
  const history = (Array.isArray(request.history) ? request.history : [])
    .slice(-CONSULT_MAX_HISTORY)
    .map((turn) => ({
      question: clean(turn.question, CONSULT_MAX_QUESTION_LENGTH),
      situation: clean(turn.situation, 400),
      nextChecks: (Array.isArray(turn.nextChecks) ? turn.nextChecks : [])
        .slice(0, 6)
        .filter((title): title is string => typeof title === "string")
        .map((title) => clean(title, 120))
        .filter((title): title is string => Boolean(title))
    }))
    .filter((turn) => Boolean(turn.question));

  lines.push("");
  lines.push("# これまでの相談（古い順・今回はこの続き）");
  if (history.length === 0) {
    lines.push("（今回が最初の相談です）");
  } else {
    history.forEach((turn, index) => {
      lines.push(`## ${index + 1}回目`);
      lines.push(`相談: ${turn.question}`);
      if (turn.situation) lines.push(`前回の整理: ${turn.situation}`);
      if (turn.nextChecks.length > 0) lines.push(`前回案内した次の確認: ${turn.nextChecks.join(" / ")}`);
    });
  }

  return lines.join("\n");
}

export const CONSULT_SYSTEM_PROMPT = `あなたは、日本で親の入院・介護・看取り・死後手続きに直面している家族を支える相談員です。医師でも弁護士でも税理士でもありません。

利用者は、自分の親についての手帳（プロフィールと日々の記録）を持っています。その内容と相談内容を読み、家族が次に動くための整理を返してください。

## 守ること

- 日本語の敬体で、短く具体的に書く。専門用語は使うたびに一言で補う。
- 診断名、治療方針、余命、介護度、相続の分け方、税額、法的な結論を断定しない。これらは「確認する相手」と「聞くべきこと」に変換する。
- 手帳に書かれていない事実を作らない。情報が足りない時は、足りないと書いて、何を確認すればよいかを示す。
- 暗証番号、パスワード、口座番号、マイナンバーは、絶対に聞き出さない。利用者が書いていても使わない。
- 記録に、呼吸の異常、意識がない、強い痛み、出血、転倒後の様子の変化など、急を要する可能性がある記述があれば、最初の項目で「まず主治医・看護師・救急へ相談する」ことを書く。
- 家族の誰かを責めない。介護を担っている人の負担を軽く扱わない。
- 「AIが判断しました」という書き方をしない。利用者が自分で判断するための材料として書く。
- 「これまでの相談」がある場合は、その続きとして答える。前回すでに案内したことを最初から繰り返さず、今回の質問と、前回からの状況の変化に焦点を当てる。必要なら前回の案内がその後どうなったかを一言確認する。同じ人と会話を続けている前提で、毎回はじめましてのようには書かない。

## 出力

必ず write_consultation ツールを呼び出して返してください。ツールを使わずに文章だけで答えてはいけません。

- situation: いまの状況を、記録から読み取れる事実だけで2〜3文にまとめる。憶測は書かない。
- nextChecks: 次に確認するとよいことを3個。title は動詞で終わる短い行動。why はなぜ今それを見るのかを1文。
- askQuestions: 病院、施設、役所、専門家に聞くとよい質問を2〜3個。そのまま口に出せる文にする。
- providerCategories: 相談先のカテゴリを2個。特定の事業者名や商品名は出さない。
- watchOuts: 気をつけることを2個。やらなくてよいこと、急がなくてよいことも含めてよい。
- recordSuggestion: 次に手帳へ残しておくとよいことを1文。

回答全体は読みやすさを優先し、同じ説明を繰り返さず、日本語で1,000文字程度までに収めてください。`;

export const CONSULT_TOOL = {
  name: "write_consultation",
  description: "家族向けの相談メモを、決められた形式で返す。",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      situation: { type: "string", description: "記録から読み取れる事実だけでまとめた、いまの状況" },
      nextChecks: {
        type: "array",
        description: "次に確認するとよいこと",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "動詞で終わる短い行動" },
            why: { type: "string", description: "なぜ今それを見るのか" }
          },
          required: ["title", "why"],
          additionalProperties: false
        }
      },
      askQuestions: {
        type: "array",
        description: "窓口でそのまま聞ける質問",
        items: { type: "string" }
      },
      providerCategories: {
        type: "array",
        description: "相談先のカテゴリ。事業者名は出さない",
        items: { type: "string" }
      },
      watchOuts: {
        type: "array",
        description: "気をつけること、急がなくてよいこと",
        items: { type: "string" }
      },
      recordSuggestion: { type: "string", description: "次に手帳へ残しておくとよいこと" }
    },
    required: ["situation", "nextChecks", "askQuestions", "providerCategories", "watchOuts", "recordSuggestion"],
    additionalProperties: false
  }
};
