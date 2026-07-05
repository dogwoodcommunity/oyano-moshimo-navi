"use client";

import { useRouter } from "next/navigation";
import { STATUSES, type ParentStatus } from "@oyano/shared";
import { createCase } from "@/lib/store";

export default function StartPage() {
  const router = useRouter();

  async function choose(status: ParentStatus) {
    const record = await createCase(status);
    router.push(`/diagnosis?caseId=${record.id}&status=${status}`);
  }

  return (
    <main className="container">
      <h1 className="page-title">親の現在ステータスを選択</h1>
      <p className="lead">ログイン不要です。選択後に匿名caseを作成し、5分診断へ進みます。</p>
      <section className="grid status-grid" aria-label="親の状態">
        {STATUSES.filter((item) => item.key !== "completed").map((item) => (
          <button className="status-button" key={item.key} onClick={() => choose(item.key)}>
            {item.label}
          </button>
        ))}
      </section>
    </main>
  );
}
