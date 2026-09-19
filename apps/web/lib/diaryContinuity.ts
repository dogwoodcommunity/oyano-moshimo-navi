import type { DiaryEntry } from "./store";

// Literal words only: these identify a subject, never a condition or its meaning.
const SPECIFIC_TOPICS = [
  "散歩", "通院", "受診", "入院", "退院", "服薬", "血圧", "食欲", "睡眠", "転倒",
  "通帳", "印鑑", "年金", "相続", "遺言", "補聴器", "入れ歯", "車椅子", "歩行器",
  "デイサービス", "ショートステイ", "訪問介護", "訪問看護", "介護認定", "介護保険",
  "ケアマネジャー", "ケアマネージャー", "福祉用具", "リハビリ", "お薬手帳",
  "保険証", "診察券", "口座振替", "公共料金", "墓参り", "納骨", "買い物", "折り紙", "庭仕事"
] as const;

const GENERIC_WORDS = new Set([
  "今日", "昨日", "明日", "毎日", "今回", "前回", "最近", "以前", "午前", "午後", "一緒",
  "家族", "本人", "両親", "父親", "母親", "病院", "先生", "施設", "自宅", "実家", "近所",
  "記録", "日記", "写真", "追加", "保存", "確認", "相談", "連絡", "報告", "共有", "予定",
  "対象", "状況", "自分", "追記",
  "様子", "状態", "変化", "元気", "大丈夫", "心配", "安心", "気持", "気分", "気がかり",
  "体調", "生活", "食事", "時間", "場所", "必要", "大切", "普通", "いつも", "出来事",
  "安定", "良好", "問題", "特記", "事項", "内容", "その他", "特別", "特記事項",
  "サービス", "メモ", "ノート", "コメント", "ありがとう", "お母さん", "お父さん",
  "today", "yesterday", "tomorrow", "family", "mother", "father", "photo", "photos", "added",
  "record", "diary", "entry", "about", "again", "after", "before", "there", "their", "hello"
]);
const GENERIC_JAPANESE_WORDS = [...GENERIC_WORDS].filter((word) => !/^[a-z]+$/.test(word));

type CurrentEntry = { entry: DiaryEntry; version: number; revision: number; ambiguous: boolean };

function diaryDate(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value : undefined;
}

function timestamp(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-][0-2]\d:[0-5]\d)$/.test(value)
    || !diaryDate(value.slice(0, 10))) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function currentEntries(caseId: string, entries: readonly DiaryEntry[]): Map<string, CurrentEntry> {
  const current = new Map<string, CurrentEntry>();
  const invalid = new Set<string>();
  for (const entry of entries) {
    if (entry.caseId !== caseId) continue;
    const version = timestamp(entry.updatedAt ?? entry.createdAt);
    if (version === undefined) {
      // An unorderable duplicate must never resurrect an older matching body.
      invalid.add(entry.id);
      continue;
    }
    const revision = Number.isSafeInteger(entry.cloudRevision) && (entry.cloudRevision ?? 0) > 0
      ? entry.cloudRevision! : 0;
    const previous = current.get(entry.id);
    if (!previous || version > previous.version || (version === previous.version && revision > previous.revision)) {
      current.set(entry.id, { entry, version, revision, ambiguous: false });
    } else if (version === previous.version && revision === previous.revision
      && (entry.body !== previous.entry.body || entry.date !== previous.entry.date
        || entry.createdAt !== previous.entry.createdAt)) {
      previous.ambiguous = true;
    }
  }
  for (const id of invalid) current.delete(id);
  return current;
}

function normalizedBody(body: string): string {
  let normalized = body.normalize("NFKC").toLowerCase().trim();
  if (normalized.startsWith("【記録のその後】")) {
    // Generated dates/outcomes/labels are not a shared subject. A legacy
    // status-only follow-up has no authored subject and should not match.
    const authored: string[] = [];
    let readingNote = false;
    for (const line of normalized.split(/\r?\n/u).slice(1)) {
      if (readingNote) authored.push(line);
      else if (line.startsWith("気がかり:")) authored.push(line.slice("気がかり:".length));
      else if (line.startsWith("自分の追記:")) {
        authored.push(line.slice("自分の追記:".length));
        readingNote = true;
      }
    }
    normalized = authored.join("\n").trim();
  }
  return /^写真を追加しました[。.!！]?$/u.test(normalized) ? "" : normalized;
}

function subjects(body: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const topic of SPECIFIC_TOPICS) {
    if (body.includes(topic)) result.set(topic, 2);
  }
  const words = body.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}|[a-z]{5,}/gu) ?? [];
  for (const word of words) {
    if (GENERIC_WORDS.has(word)) continue;
    if (/^[一二三四五六七八九十百千万年月日時分秒午前午後今昨明週曜日]+$/u.test(word)) continue;
    let specificPart = word;
    for (const generic of GENERIC_JAPANESE_WORDS) specificPart = specificPart.replaceAll(generic, "");
    if (specificPart.length < 2) continue;
    // Do not count a compound and its known topic twice.
    if (SPECIFIC_TOPICS.some((topic) => word.includes(topic))) continue;
    result.set(word, word.length >= 3 ? 2 : 1);
  }
  return result;
}

function phrases(body: string): Set<string> {
  const result = new Set<string>();
  const compact = body.replace(/[\s\p{P}\p{S}]/gu, "");
  for (const length of [8, 12, 16]) {
    for (let index = 0; index + length <= compact.length; index += 1) {
      result.add(compact.slice(index, index + length));
    }
  }
  return result;
}

/**
 * Find one older record in the caller's current, permission/tombstone-filtered list.
 * A missing or ambiguous source, or weak lexical overlap, deliberately returns nothing.
 * This pure helper does not read storage, infer health status, or call an API.
 */
export function findRelatedDiaryEntry(saved: DiaryEntry, entries: readonly DiaryEntry[]): DiaryEntry | undefined {
  const current = currentEntries(saved.caseId, entries);
  const source = current.get(saved.id);
  if (!source || source.ambiguous) return undefined;
  const sourceDate = diaryDate(source.entry.date);
  const sourceCreatedAt = timestamp(source.entry.createdAt);
  if (!sourceDate || sourceCreatedAt === undefined) return undefined;
  const sourceBody = normalizedBody(source.entry.body);
  const sourceSubjects = subjects(sourceBody);
  if (!sourceBody || !sourceSubjects.size) return undefined;
  const sourcePhrases = phrases(sourceBody);
  let best: { entry: DiaryEntry; score: number; createdAt: number } | undefined;
  for (const candidate of current.values()) {
    if (candidate.ambiguous || candidate.entry.id === saved.id) continue;
    const entry = candidate.entry;
    const date = diaryDate(entry.date);
    const createdAt = timestamp(entry.createdAt);
    if (!date || createdAt === undefined || date > sourceDate
      || (date === sourceDate && createdAt >= sourceCreatedAt)) continue;
    const body = normalizedBody(entry.body);
    if (!body) continue;
    const candidateSubjects = subjects(body);
    let overlap = 0;
    for (const [word, weight] of sourceSubjects) {
      if (candidateSubjects.has(word)) overlap += weight;
    }
    // One specific subject or two distinct, less-specific words are required.
    if (overlap < 2) continue;
    let phraseLength = 0;
    for (const phrase of phrases(body)) {
      if (sourcePhrases.has(phrase)) phraseLength = Math.max(phraseLength, phrase.length);
    }
    const score = overlap * 20 + phraseLength;
    if (!best || score > best.score || (score === best.score && (
      date > best.entry.date || (date === best.entry.date && (
        createdAt > best.createdAt || (createdAt === best.createdAt && entry.id < best.entry.id)
      ))
    ))) best = { entry, score, createdAt };
  }
  return best?.entry;
}
