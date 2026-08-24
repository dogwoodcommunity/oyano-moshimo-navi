"use client";

import { useEffect, useState } from "react";
import { listLocalCases, readPlan } from "@/lib/store";

/**
 * 役目を終えた家族に、こちらから見直しを案内する。
 *
 * 出す条件は「対象者が全員『完了』ステータス」。docs/MONETIZATION.md の
 * 追加機能Cで決めた線をそのまま使う。
 *
 * 以前はタスクが全部done/skippedかどうかで判定していた。これだと、親がまだ
 * 入院中でも初期タスクを片付けただけで「役目を終えた」と出てしまう。
 * 看取りを扱う画面でそれを出すのは、ただ間違っているだけでは済まない。
 *
 * 通知は出さない。プラン画面を開いた人にだけ見せる。自動で解約もしない。
 */
export function PlanCompletionNotice() {
  // localStorage を読むので、サーバー描画との食い違いを避けて描画後に判定する。
  const [state, setState] = useState<{ show: boolean; plus: boolean }>({ show: false, plus: false });

  useEffect(() => {
    const cases = listLocalCases();
    setState({
      show: cases.length > 0 && cases.every((caseRecord) => caseRecord.selectedStatus === "completed"),
      plus: readPlan() === "plus"
    });
  }, []);

  if (!state.show) return null;

  return (
    <section className="panel plan-complete-notice" role="status">
      <p className="pill">一区切りついた家族へ</p>
      <h2>役目を終えたようです。</h2>
      {state.plus ? (
        <p>
          Plusをやめても、これまでの記録はずっと読み返せます。
          追加の相談や容量が要らなくなったら、プランを見直してください。
        </p>
      ) : (
        <p>
          これまでの記録は、このままずっと読み返せます。
          いつでも見返せる場所として残しておいてください。
        </p>
      )}
      <p className="plan-complete-note">
        こちらで勝手に解約することはありません。この案内も、この画面を開いたときだけ出ます。
      </p>
    </section>
  );
}
