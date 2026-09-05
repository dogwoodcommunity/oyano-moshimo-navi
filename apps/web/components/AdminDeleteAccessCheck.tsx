"use client";

import { useEffect, useRef, useState } from "react";
import { ADMIN_BEARER_TOKEN_STORAGE_KEY, adminBearerHeaders } from "@/lib/adminClientAuth";

type OperatorMethod = "supabase_app_admin" | "supabase_account_delete_executor";
type AccessResult = {
  label: string;
  status: number | null;
  expectedStatus: number;
};

const accessChecks = [
  { path: "/api/admin/delete-requests/auth-status", label: "削除担当者のログイン確認", scoped: true },
  { path: "/api/admin/delete-requests", label: "削除依頼の一覧", scoped: true },
  { path: "/api/admin/monitor-feedback", label: "モニター回答の管理", scoped: false },
  { path: "/api/admin/ai-usage", label: "AI利用状況の管理", scoped: false },
  { path: "/api/admin/env-check", label: "本番設定の管理", scoped: false }
] as const;

// Only response status is used. In particular, an unexpected generic-API 200
// must never cause monitor answers, usage details, or configuration to be read.
export async function checkDeleteOperatorAccess(
  operatorMethod: OperatorMethod,
  headers: HeadersInit,
  signal: AbortSignal,
  request: typeof fetch = fetch
): Promise<AccessResult[]> {
  const results: AccessResult[] = [];
  for (const check of accessChecks) {
    signal.throwIfAborted();
    const expectedStatus = check.scoped || operatorMethod === "supabase_app_admin" ? 200 : 403;
    let status: number | null = null;
    try {
      const response = await request(check.path, {
        method: "GET",
        headers,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal
      });
      status = response.status;
      await response.body?.cancel().catch(() => undefined);
    } catch {
      // Do not expose error text that might include request headers or URLs.
      signal.throwIfAborted();
    }
    signal.throwIfAborted();
    results.push({ label: check.label, status, expectedStatus });
    // If scoped authentication/list access fails, do not probe unrelated APIs.
    if (check.scoped && status !== 200) break;
  }
  return results;
}

export function AdminDeleteAccessCheck({ operatorMethod }: { operatorMethod: OperatorMethod | null }) {
  const generation = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const verifiedMethod = useRef<OperatorMethod | null>(null);
  const [sessionValid, setSessionValid] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AccessResult[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const invalidate = () => {
      verifiedMethod.current = null;
      setSessionValid(false);
      generation.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
      setRunning(false);
      setResults(null);
      setMessage("");
    };
    const invalidateAfterStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage
        && (event.key === ADMIN_BEARER_TOKEN_STORAGE_KEY || event.key === null)) invalidate();
    };
    invalidate();
    verifiedMethod.current = operatorMethod;
    setSessionValid(Boolean(operatorMethod));
    window.addEventListener("admin-auth-changed", invalidate);
    window.addEventListener("storage", invalidateAfterStorageChange);
    return () => {
      generation.current += 1;
      verifiedMethod.current = null;
      activeRequest.current?.abort();
      activeRequest.current = null;
      window.removeEventListener("admin-auth-changed", invalidate);
      window.removeEventListener("storage", invalidateAfterStorageChange);
    };
  }, [operatorMethod]);

  async function runCheck() {
    if (!operatorMethod || verifiedMethod.current !== operatorMethod || activeRequest.current) return;
    const requestGeneration = ++generation.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    setRunning(true);
    setResults(null);
    setMessage("");
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const nextResults = await checkDeleteOperatorAccess(operatorMethod, adminBearerHeaders(), controller.signal);
      if (requestGeneration !== generation.current) return;
      setResults(nextResults);
    } catch {
      if (requestGeneration !== generation.current) return;
      setMessage("確認を完了できませんでした。通信状態とログインを確認して、もう一度お試しください。");
    } finally {
      window.clearTimeout(timeout);
      if (requestGeneration === generation.current) {
        activeRequest.current = null;
        setRunning(false);
      }
    }
  }

  if (!operatorMethod) return null;
  const currentSessionValid = sessionValid && verifiedMethod.current === operatorMethod;
  const visibleResults = currentSessionValid ? results : null;
  const matched = visibleResults?.length === accessChecks.length
    && visibleResults.every((result) => result.status === result.expectedStatus);

  return (
    <details className="admin-erasure-control">
      <summary>ログイン後のアクセス権限を確認する（読み取り専用）</summary>
      <p className="hint">
        {operatorMethod === "supabase_account_delete_executor"
          ? "削除担当者は、削除依頼だけ確認できます。ほかの管理機能が拒否されることを確認します。"
          : "管理者は、削除依頼とほかの管理機能にアクセスできます。各機能の応答を確認します。"}
        記録・設定・削除状態は変更しません。回答内容や設定値は読み取らず、HTTPの応答番号だけを表示します。
      </p>
      <button className="secondary compact" disabled={running || !currentSessionValid} onClick={runCheck} type="button">
        {running ? "アクセス権限を確認中…" : "アクセス権限を確認する"}
      </button>
      <div aria-live="polite" aria-atomic="true">
        {message && currentSessionValid ? <p className="hint">{message}</p> : null}
        {visibleResults ? (
          <>
            <p>{matched ? "すべて想定どおりの応答でした。" : "想定と異なる応答があります。再ログイン後も続く場合はシステム責任者に確認してください。"}</p>
            <ul>
              {visibleResults.map((result) => (
                <li key={result.label}>
                  {result.label}：{result.status === null ? "通信できませんでした" : `HTTP ${result.status}`}
                  {`（想定 ${result.expectedStatus}・${result.status === result.expectedStatus ? "一致" : "要確認"}）`}
                </li>
              ))}
            </ul>
            <p className="hint">この確認はアクセス時の応答だけを調べます。実際の削除・復旧の完了を確認するものではありません。結果は保存しません。</p>
          </>
        ) : null}
      </div>
    </details>
  );
}
