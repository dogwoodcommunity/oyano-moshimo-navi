"use client";

import { useRouter } from "next/navigation";
import { STATUSES, type ParentStatus } from "@oyano/shared";
import { createCase } from "@/lib/store";

const statusDescriptions: Record<ParentStatus, string> = {
  preparing: "元気なうちに、連絡先・書類・希望を整理します。",
  hospitalized: "退院見込み、支払い、保険請求の確認を急ぎます。",
  facility: "契約、費用、緊急連絡先、実家の扱いを整理します。",
  cognitive_decline: "本人確認、相談先、家族の役割分担を慎重に進めます。",
  end_of_life: "緊急連絡、看取り方針、必要書類を家族で共有します。",
  after_death: "死亡診断書、葬儀、親族連絡の初動を整理します。",
  after_funeral: "公的手続き、年金、保険、名義変更の期限を確認します。",
  inheritance: "相続人、財産、負債、不動産の存在を一覧化します。",
  home_clearance: "鍵、ライフライン、家財量、写真、管理方針を記録します。",
  completed: "完了した情報を保管し、家族で見返せる状態にします。"
};

export default function StartPage() {
  const router = useRouter();

  async function choose(status: ParentStatus) {
    const record = await createCase(status);
    router.push(`/diagnosis?caseId=${record.id}&status=${status}`);
  }

  return (
    <main className="container">
      <p className="eyebrow">Step 1</p>
      <h1 className="page-title">親の現在ステータスを選択</h1>
      <p className="lead">ログイン不要です。いちばん近い状態を選ぶだけで、匿名caseを作成して5分診断へ進みます。</p>
      <section className="grid status-grid" aria-label="親の状態">
        {STATUSES.filter((item) => item.key !== "completed").map((item) => (
          <button className="status-button" key={item.key} onClick={() => choose(item.key)}>
            <strong>{item.label}</strong>
            <span>{statusDescriptions[item.key]}</span>
          </button>
        ))}
      </section>
    </main>
  );
}
