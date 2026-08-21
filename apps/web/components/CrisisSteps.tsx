"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CrisisScenario } from "@/lib/crisis";
import { addDiaryEntry, listLocalCases, type CaseRecord } from "@/lib/store";

const PROGRESS_STORAGE_KEY = "oyano_crisis_progress_v01";

type ProgressMap = Record<string, string[]>;

type SaveState = "idle" | "saved" | "no-case";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const probeKey = "__oyano_crisis_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function readProgress(): ProgressMap {
  const storage = getLocalStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ProgressMap : {};
  } catch {
    return {};
  }
}

function writeProgress(progress: ProgressMap) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing can reject writes. The in-memory state still works for this session.
  }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function CrisisSteps({ scenario }: { scenario: CrisisScenario }) {
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    setDoneIds(readProgress()[scenario.key] ?? []);
    setCases(listLocalCases());
    setLoaded(true);
  }, [scenario.key]);

  const allSteps = useMemo(() => scenario.groups.flatMap((group) => group.steps), [scenario]);
  const nowSteps = useMemo(
    () => scenario.groups.find((group) => group.key === "now")?.steps ?? [],
    [scenario]
  );
  const nowDoneCount = nowSteps.filter((step) => doneIds.includes(step.id)).length;
  const activeCase = cases[0];

  function toggleStep(stepId: string) {
    setDoneIds((previous) => {
      const next = previous.includes(stepId)
        ? previous.filter((item) => item !== stepId)
        : [...previous, stepId];
      const progress = readProgress();
      writeProgress({ ...progress, [scenario.key]: next });
      return next;
    });
    setSaveState("idle");
  }

  function saveToNotebook() {
    if (!activeCase) {
      setSaveState("no-case");
      return;
    }

    const done = allSteps.filter((step) => doneIds.includes(step.id));
    const remaining = allSteps.filter((step) => !doneIds.includes(step.id));
    const lines = [scenario.recordSeed, ""];

    if (done.length > 0) {
      lines.push("済んだこと");
      done.forEach((step) => lines.push(`・${step.title}`));
      lines.push("");
    }
    if (remaining.length > 0) {
      lines.push("まだのこと");
      remaining.forEach((step) => lines.push(`・${step.title}`));
    }

    addDiaryEntry({
      caseId: activeCase.id,
      date: todayInputValue(),
      mood: "urgent",
      body: lines.join("\n").trim(),
      attachments: []
    });
    setSaveState("saved");
  }

  return (
    <div className="crisis-steps">
      <p className="crisis-progress" aria-live="polite">
        {loaded
          ? nowDoneCount >= nowSteps.length && nowSteps.length > 0
            ? "いますぐの項目は全部済んでいます。ここから先は、明日でも間に合います。"
            : `いますぐの項目 ${nowDoneCount} / ${nowSteps.length} 済み`
          : "読み込み中です"}
      </p>

      {scenario.groups.map((group) => (
        <section className={`crisis-group is-${group.key}`} key={group.key} aria-label={group.label}>
          <div className="crisis-group-head">
            <span className="crisis-timing">{group.timing}</span>
            <h2>{group.label}</h2>
            <p>{group.note}</p>
          </div>
          <ol className="crisis-step-list">
            {group.steps.map((step, index) => {
              const checked = doneIds.includes(step.id);
              return (
                <li className={checked ? "is-done" : ""} key={step.id}>
                  <label>
                    <input
                      checked={checked}
                      onChange={() => toggleStep(step.id)}
                      type="checkbox"
                    />
                    <span className="crisis-step-number" aria-hidden="true">{index + 1}</span>
                    <span className="crisis-step-body">
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <div className="crisis-save">
        <div>
          <strong>ここまでの対応を手帳に残す</strong>
          <p>チェックした内容を、今日の記録として手帳に書き込みます。後から「あの日何をしたか」を家族で確認できます。</p>
        </div>
        {loaded && !activeCase ? (
          <Link className="crisis-save-button" href="/start">まず手帳を作る</Link>
        ) : (
          <button className="crisis-save-button" onClick={saveToNotebook} type="button">
            今日の記録に残す
          </button>
        )}
        {saveState === "saved" ? (
          <p className="crisis-save-note" role="status">
            手帳に記録しました。<Link href="/home#diary-history">手帳で見る</Link>
          </p>
        ) : null}
        {saveState === "no-case" ? (
          <p className="crisis-save-note" role="status">まだ手帳がありません。先に1人分の手帳を作ってください。</p>
        ) : null}
      </div>
    </div>
  );
}

export function CrisisMessageTemplate({ template }: { template: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="crisis-template">
      <pre>{template}</pre>
      <button onClick={copyTemplate} type="button">
        {copyState === "copied" ? "コピーしました" : "この文面をコピーする"}
      </button>
      {copyState === "failed" ? (
        <p className="crisis-template-note" role="status">
          この端末では自動コピーができませんでした。上の文面を長押しして選択してください。
        </p>
      ) : null}
    </div>
  );
}
