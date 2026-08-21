"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  consultAnswerToDiaryBody,
  hasNotebookSubstance,
  type ConsultAnswer
} from "@oyano/shared";
import {
  addDiaryEntry,
  listDiaryEntries,
  listLocalCases,
  type CaseRecord
} from "@/lib/store";

const CONSENT_STORAGE_KEY = "oyano_consult_consent_v01";

const suggestedQuestions = [
  "いまの記録から、見落としていることはありますか",
  "退院後の生活をどう決めればいいですか",
  "介護保険の申請はどう進めればいいですか",
  "家族でどう役割を分ければいいですか",
  "次の受診で何を聞けばいいですか"
];

type Phase = "idle" | "loading" | "done" | "error";

function readConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage?.getItem(CONSENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeConsent(value: boolean) {
  try {
    if (value) {
      window.localStorage?.setItem(CONSENT_STORAGE_KEY, "1");
    } else {
      window.localStorage?.removeItem(CONSENT_STORAGE_KEY);
    }
  } catch {
    // Private browsing rejects writes. The current session still holds the state.
  }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ConsultPanel() {
  const [loaded, setLoaded] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<ConsultAnswer | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasSubstance, setHasSubstance] = useState(true);

  useEffect(() => {
    const localCases = listLocalCases();
    setCases(localCases);
    setActiveCaseId(localCases[0]?.id);
    setConsent(readConsent());
    setLoaded(true);
  }, []);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId),
    [cases, activeCaseId]
  );

  useEffect(() => {
    if (!activeCase) return;
    setHasSubstance(hasNotebookSubstance({
      question: "",
      person: activeCase.personProfile,
      entries: listDiaryEntries(activeCase.id).map((entry) => ({ body: entry.body }))
    }));
  }, [activeCase]);

  function toggleConsent(next: boolean) {
    setConsent(next);
    writeConsent(next);
  }

  async function submit() {
    if (!activeCase || question.trim().length < 4) return;

    setPhase("loading");
    setErrorMessage("");
    setAnswer(null);
    setSaved(false);

    const entries = listDiaryEntries(activeCase.id).slice(0, 20).map((entry) => ({
      date: entry.date,
      mood: entry.mood,
      body: entry.body
    }));
    const tasks = (activeCase.result?.tasks ?? []).slice(0, 12).map((task) => ({
      title: task.title,
      dueDate: task.dueDate
    }));

    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          person: {
            relationship: activeCase.personProfile?.relationship,
            careStatus: activeCase.personProfile?.careStatus,
            birthDate: activeCase.personProfile?.birthDate,
            hospitalOrFacility: activeCase.personProfile?.hospitalOrFacility,
            medicationNote: activeCase.personProfile?.medicationNote,
            familyStructureNote: activeCase.personProfile?.familyStructureNote,
            carePreference: activeCase.personProfile?.carePreference
          },
          entries,
          tasks
        })
      });

      const data = await response.json() as {
        answer?: ConsultAnswer;
        disclaimer?: string;
        message?: string;
      };

      if (!response.ok || !data.answer) {
        setErrorMessage(data.message ?? "うまく整理できませんでした。もう一度お試しください。");
        setPhase("error");
        return;
      }

      setAnswer(data.answer);
      setDisclaimer(data.disclaimer ?? "");
      setPhase("done");
    } catch {
      setErrorMessage("通信できませんでした。電波のよい場所でもう一度お試しください。");
      setPhase("error");
    }
  }

  function saveToNotebook() {
    if (!activeCase || !answer) return;

    addDiaryEntry({
      caseId: activeCase.id,
      date: todayInputValue(),
      mood: "stable",
      body: consultAnswerToDiaryBody(question, answer),
      attachments: []
    });
    setSaved(true);
  }

  if (!loaded) {
    return <p className="consult-loading">読み込み中です</p>;
  }

  if (!activeCase) {
    return (
      <section className="consult-empty">
        <h2>先に1人分の手帳を作ってください</h2>
        <p>相談は、その人のプロフィールと記録を前提に整理します。手帳がないと、一般論しか返せません。</p>
        <Link className="button" href="/start">手帳を作る</Link>
      </section>
    );
  }

  return (
    <div className="consult-panel">
      {cases.length > 1 ? (
        <div className="consult-case-tabs" role="group" aria-label="相談する手帳">
          {cases.map((caseRecord) => (
            <button
              className={caseRecord.id === activeCaseId ? "is-active" : ""}
              key={caseRecord.id}
              onClick={() => setActiveCaseId(caseRecord.id)}
              type="button"
            >
              {caseRecord.personProfile?.displayName?.trim() || caseRecord.personProfile?.relationship || "この手帳"}
            </button>
          ))}
        </div>
      ) : null}

      <section className="consult-disclosure" aria-label="送る情報">
        <h2>送る情報と、送らない情報</h2>
        <p>相談のたびに、下の内容だけを外部の生成AI（Anthropic Claude）へ送ります。送った内容は学習には使われません。</p>
        <div className="consult-disclosure-grid">
          <div>
            <strong>送るもの</strong>
            <ul>
              {CONSULT_SENT_FIELDS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="is-withheld">
            <strong>送らないもの</strong>
            <ul>
              {CONSULT_WITHHELD_FIELDS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
        <label className="consult-consent">
          <input checked={consent} onChange={(event) => toggleConsent(event.target.checked)} type="checkbox" />
          <span>上の内容を送ることに同意します。（いつでも外せます）</span>
        </label>
      </section>

      <section className="consult-form" aria-label="相談する">
        <h2>いま困っていることを書いてください</h2>
        <div className="consult-suggestions">
          {suggestedQuestions.map((item) => (
            <button key={item} onClick={() => setQuestion(item)} type="button">{item}</button>
          ))}
        </div>
        <textarea
          maxLength={CONSULT_MAX_QUESTION_LENGTH}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="例: 退院の話が出ていますが、家に戻れるのか判断がつきません。何から確認すればいいですか。"
          rows={5}
          value={question}
        />
        <p className="consult-count">{question.length} / {CONSULT_MAX_QUESTION_LENGTH}</p>
        <button
          className="consult-submit"
          disabled={!consent || !hasSubstance || question.trim().length < 4 || phase === "loading"}
          onClick={submit}
          type="button"
        >
          {phase === "loading" ? "整理しています…" : "相談メモを作る"}
        </button>
        {!hasSubstance ? (
          <p className="consult-hint">
            先に手帳へ記録を1件書くか、プロフィールを2つ以上埋めてください。記録がないと、一般論しか返せません。
            <Link href="/home#today-diary">今日の記録を書く</Link>
          </p>
        ) : null}
        {!consent ? <p className="consult-hint">送る内容に同意すると押せます。</p> : null}
        {phase === "loading" ? <p className="consult-hint">記録を読んでいます。30秒ほどかかることがあります。</p> : null}
        {phase === "error" ? <p className="consult-error" role="status">{errorMessage}</p> : null}
      </section>

      {answer ? (
        <section className="consult-answer" aria-label="相談メモ">
          <div className="consult-answer-block">
            <h2>いまの状況</h2>
            <p>{answer.situation}</p>
          </div>

          {answer.nextChecks.length > 0 ? (
            <div className="consult-answer-block">
              <h2>次に確認するとよいこと</h2>
              <ol className="consult-checks">
                {answer.nextChecks.map((check) => (
                  <li key={check.title}>
                    <strong>{check.title}</strong>
                    <small>{check.why}</small>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {answer.askQuestions.length > 0 ? (
            <div className="consult-answer-block">
              <h2>窓口で聞くこと</h2>
              <ul className="consult-list">
                {answer.askQuestions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {answer.providerCategories.length > 0 ? (
            <div className="consult-answer-block">
              <h2>相談先の候補</h2>
              <div className="consult-chips">
                {answer.providerCategories.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          ) : null}

          {answer.watchOuts.length > 0 ? (
            <div className="consult-answer-block">
              <h2>気をつけること</h2>
              <ul className="consult-list">
                {answer.watchOuts.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {answer.recordSuggestion ? (
            <div className="consult-answer-block">
              <h2>次に手帳へ残すこと</h2>
              <p>{answer.recordSuggestion}</p>
            </div>
          ) : null}

          <div className="consult-save">
            <button onClick={saveToNotebook} type="button">この相談メモを手帳に残す</button>
            {saved ? (
              <p role="status">手帳に残しました。<Link href="/home#diary-history">手帳で見る</Link></p>
            ) : null}
          </div>

          {disclaimer ? <p className="consult-disclaimer">{disclaimer}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
