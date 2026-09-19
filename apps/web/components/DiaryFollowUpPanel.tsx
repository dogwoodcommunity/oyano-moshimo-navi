"use client";

import {
  buildDiaryFollowUpBody,
  DIARY_FOLLOW_UP_OUTCOMES,
  diaryFollowUpSourceVersion,
  type DiaryFollowUpDraft
} from "@/lib/diaryFollowUp";
import type { DiaryEntry } from "@/lib/store";

type Props = {
  draft: DiaryFollowUpDraft;
  source?: DiaryEntry;
  disabled: boolean;
  error?: string;
  onChange: (patch: Partial<Pick<DiaryFollowUpDraft, "date" | "subject" | "mood" | "outcome" | "note">>) => void;
  onRefreshSource: () => void;
  onSave: () => void;
  onSkip: () => void;
};

function sourceDateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function DiaryFollowUpPanel({
  draft, source, disabled, error, onChange, onRefreshSource, onSave, onSkip
}: Props) {
  const currentSource = source?.id === draft.entryId ? source : undefined;
  const sourceChanged = Boolean(currentSource
    && diaryFollowUpSourceVersion(currentSource) !== draft.sourceVersion);
  let canSave = false;
  if (currentSource && !disabled) {
    try {
      buildDiaryFollowUpBody(currentSource, draft);
      canSave = true;
    } catch {
      // The owner also checks the fresh source and permission at save time.
    }
  }

  return (
    <section className="diary-follow-up" aria-labelledby="diary-follow-up-title">
      <h3 id="diary-follow-up-title">その後は、どうなりましたか？</h3>
      <p className="diary-follow-up__intro">元の記録はそのままに、その後を追記します。</p>
      <p className="diary-follow-up__hint" id="diary-follow-up-outcome-hint">
        「確認できた」は、確かめたという意味です。改善・解決の判定ではありません。
      </p>

      {currentSource ? (
        <details className="diary-follow-up__source" open={sourceChanged || undefined}>
          <summary>元の記録を確認する（{sourceDateLabel(currentSource.date)}）</summary>
          <p className="diary-follow-up__source-body">{currentSource.body}</p>
        </details>
      ) : (
        <p className="diary-follow-up__notice" role="alert">
          元の記録が見つかりません。「今は答えない」で閉じて、記録を選び直してください。
        </p>
      )}

      {sourceChanged ? (
        <div className="diary-follow-up__notice" role="status">
          <p>入力中に元の記録が変わりました。上に表示した最新の内容を確認してください。</p>
          <button type="button" disabled={disabled} onClick={onRefreshSource}>最新の記録を確認した</button>
        </div>
      ) : null}

      <fieldset className="diary-follow-up__fields" disabled={disabled || !currentSource}>
        <legend>その後の確認状況</legend>
        <div className="diary-follow-up__choices" role="group" aria-label="確認状況" aria-describedby="diary-follow-up-outcome-hint">
          {DIARY_FOLLOW_UP_OUTCOMES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={draft.outcome === item.value ? "is-selected" : undefined}
              aria-pressed={draft.outcome === item.value}
              onClick={() => onChange({ outcome: item.value })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label htmlFor="diary-follow-up-subject">何についての確認ですか？</label>
        <input
          id="diary-follow-up-subject"
          type="text"
          required
          placeholder="例：杖の高さ、次回の通院日"
          aria-describedby="diary-follow-up-subject-hint"
          value={draft.subject}
          onChange={(event) => onChange({ subject: event.target.value })}
        />
        <small className="diary-follow-up__hint" id="diary-follow-up-subject-hint">
          80文字以内で入力してください（{Array.from(draft.subject.trim()).length}/80文字）。
        </small>
        <label htmlFor="diary-follow-up-mood">記録の種類</label>
        <select
          id="diary-follow-up-mood"
          required
          value={draft.mood ?? ""}
          onChange={(event) => onChange({ mood: event.target.value ? event.target.value as DiaryEntry["mood"] : null })}
        >
          <option value="">選んでください</option>
          <option value="stable">通常（連絡・確認など）</option>
          <option value="changed">変化あり</option>
          <option value="urgent">急ぎ</option>
        </select>
        <label htmlFor="diary-follow-up-date">その後を記録する日付</label>
        <input
          id="diary-follow-up-date"
          type="date"
          required
          value={draft.date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
        <label htmlFor="diary-follow-up-note">わかったこと・次に確認したいこと（任意）</label>
        <textarea
          id="diary-follow-up-note"
          rows={3}
          value={draft.note}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </fieldset>

      {error ? <p className="diary-follow-up__notice" role="alert">{error}</p> : null}
      <div className="diary-follow-up__actions">
        <button type="button" className="is-primary" disabled={!canSave} onClick={onSave}>その後を記録する</button>
        <button type="button" disabled={disabled} onClick={onSkip}>今は答えない</button>
      </div>
    </section>
  );
}
