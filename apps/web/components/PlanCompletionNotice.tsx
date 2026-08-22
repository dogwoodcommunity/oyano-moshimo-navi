"use client";

import { useMemo } from "react";
import { listLocalCases } from "@/lib/store";

export function PlanCompletionNotice() {
  const shouldShow = useMemo(() => {
    const cases = listLocalCases();
    if (cases.length === 0) return false;

    return cases.every((caseRecord) => {
      const tasks = caseRecord.result?.tasks ?? [];
      if (tasks.length === 0) return false;
      return tasks.every((task) => task.progress === "done" || task.progress === "skipped");
    });
  }, []);

  if (!shouldShow) return null;

  return (
    <section className="panel plan-complete-notice" role="status">
      <p className="pill">一区切りついた家族へ</p>
      <h2>すべて終わったら、Plusを続けるか見直せます。</h2>
      <p>
        手続きや整理が完了したあとも、手帳の基本記録は読み返せます。
        追加の相談、容量、PDFが不要になったら、プランを見直してください。
      </p>
    </section>
  );
}
