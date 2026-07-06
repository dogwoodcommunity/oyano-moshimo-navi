"use client";

import { useRouter } from "next/navigation";
import { STATUSES, type ParentStatus } from "@oyano/shared";
import { createCase } from "@/lib/store";

const statusDescriptions: Record<ParentStatus, string> = {
  preparing: "元気なうちに、連絡先や書類の場所をまとめます。",
  hospitalized: "病院で聞くこと、支払い、退院後のことを整理します。",
  facility: "介護や施設のこと、家族の役割を整理します。",
  cognitive_decline: "もの忘れや判断が心配な時に、相談先を整理します。",
  end_of_life: "看取りや緊急連絡について、家族で確認します。",
  after_death: "葬儀、親族連絡、役所手続きの初動を整理します。",
  after_funeral: "年金、保険、名義変更などを確認します。",
  inheritance: "相続前に、書類や相談先を整理します。",
  home_clearance: "実家の写真、鍵、書類、片付けを整理します。",
  completed: "完了した情報を保管し、家族で見返せる状態にします。"
};

const statusDisplayLabels: Record<ParentStatus, string> = {
  preparing: "元気なうちに準備したい",
  hospitalized: "入院した",
  facility: "介護・施設のこと",
  cognitive_decline: "もの忘れが心配",
  end_of_life: "看取り・終末期のこと",
  after_death: "亡くなった直後",
  after_funeral: "葬儀が終わった後",
  inheritance: "相続前に整理したい",
  home_clearance: "実家を片付けたい",
  completed: "整理が終わった"
};

const priorityStatuses: ParentStatus[] = ["hospitalized", "facility", "after_death"];

const statusGroups: Array<{ title: string; lead: string; keys: ParentStatus[] }> = [
  {
    title: "急いで確認したい",
    lead: "入院、介護、亡くなった直後など",
    keys: ["hospitalized", "facility", "cognitive_decline", "end_of_life", "after_death"]
  },
  {
    title: "前もって準備したい",
    lead: "元気なうちの準備、相続前、実家の整理など",
    keys: ["preparing", "inheritance", "home_clearance"]
  },
  {
    title: "葬儀の後の手続き",
    lead: "役所、年金、保険、名義変更など",
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
          <p className="eyebrow">はじめに</p>
          <h1 className="page-title">親はいま、どの状況に近いですか？</h1>
          <p className="lead">
            ぴったり合わなくても大丈夫です。近いものを選ぶと、次に確認することを分かりやすく整理します。
          </p>
          <div className="start-steps" aria-label="利用の流れ">
            <span>1. 選ぶ</span>
            <span>2. 少し入力</span>
            <span>3. リストを見る</span>
          </div>
        </div>
        <aside className="start-help panel">
          <p className="pill">迷ったら</p>
          <h2>まずは近いものを選んでください。</h2>
          <p>あとから家族で見ながら直せます。</p>
        </aside>
      </section>

      <section className="quick-start panel elevated" aria-label="よく選ばれる入口">
        <div>
          <p className="eyebrow">よく選ばれます</p>
          <h2>急いでいる時はこちら</h2>
        </div>
        <div className="quick-status-row">
          {priorityStatuses.map((key) => {
            const item = statusByKey.get(key);
            if (!item) return null;
            return (
              <button className="quick-status-button" key={key} onClick={() => choose(key)}>
                <strong>{statusDisplayLabels[key] ?? item.label}</strong>
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
                    <strong>{statusDisplayLabels[key] ?? item.label}</strong>
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
