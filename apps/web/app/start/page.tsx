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

const priorityStatuses: ParentStatus[] = ["hospitalized", "facility", "after_death"];

const statusGroups: Array<{ title: string; lead: string; keys: ParentStatus[] }> = [
  {
    title: "いま起きている",
    lead: "急ぎで家族の役割と期限を整理したい時",
    keys: ["hospitalized", "facility", "cognitive_decline", "end_of_life", "after_death"]
  },
  {
    title: "これから備える",
    lead: "元気なうちに、連絡先・書類・希望をまとめたい時",
    keys: ["preparing", "inheritance", "home_clearance"]
  },
  {
    title: "葬儀後・手続き中",
    lead: "役所、年金、保険、名義変更などを抜け漏れなく進めたい時",
    keys: ["after_funeral"]
  }
];

const statusByKey = new Map(STATUSES.map((item) => [item.key, item]));

export default function StartPage() {
  const router = useRouter();

  async function choose(status: ParentStatus) {
    const record = await createCase(status);
    router.push(`/diagnosis?caseId=${record.id}&status=${status}`);
  }

  return (
    <main className="container start-page">
      <section className="start-hero">
        <div>
          <p className="eyebrow">最初にやること</p>
          <h1 className="page-title">親の状況を1つ選ぶだけで、家族のやることリストを作ります。</h1>
          <p className="lead">
            診断名を決めるページではありません。いま近い状況を選ぶと、期限、家族に聞くこと、相談先カテゴリをログインなしで整理します。
          </p>
          <div className="start-steps" aria-label="利用の流れ">
            <span>1. 状況を選ぶ</span>
            <span>2. 5分で入力</span>
            <span>3. 結果を保存・共有</span>
          </div>
        </div>
        <aside className="start-help panel">
          <p className="pill">迷ったら</p>
          <h2>いちばん近いものを選んで大丈夫です。</h2>
          <p>後から結果画面で、確認事項やタスクを見ながら家族で直せます。</p>
        </aside>
      </section>

      <section className="quick-start panel elevated" aria-label="よく選ばれる入口">
        <div>
          <p className="eyebrow">Quick start</p>
          <h2>急いでいる人はここから</h2>
        </div>
        <div className="quick-status-row">
          {priorityStatuses.map((key) => {
            const item = statusByKey.get(key);
            if (!item) return null;
            return (
              <button className="quick-status-button" key={key} onClick={() => choose(key)}>
                <strong>{item.label}</strong>
                <span>{statusDescriptions[key]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="start-groups" aria-label="親の状態">
        {statusGroups.map((group) => (
          <div className="start-group panel" key={group.title}>
            <div className="start-group-head">
              <h2>{group.title}</h2>
              <p>{group.lead}</p>
            </div>
            <div className="grid status-grid">
              {group.keys.map((key) => {
                const item = statusByKey.get(key);
                if (!item) return null;
                return (
                  <button className="status-button" key={key} onClick={() => choose(key)}>
                    <strong>{item.label}</strong>
                    <span>{statusDescriptions[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
