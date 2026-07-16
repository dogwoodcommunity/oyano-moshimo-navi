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

const statusVisuals: Record<ParentStatus, { icon: string; tone: string }> = {
  preparing: { icon: "書", tone: "leaf" },
  hospitalized: { icon: "病", tone: "rose" },
  facility: { icon: "介", tone: "blue" },
  cognitive_decline: { icon: "心", tone: "gold" },
  end_of_life: { icon: "話", tone: "leaf" },
  after_death: { icon: "届", tone: "rose" },
  after_funeral: { icon: "役", tone: "blue" },
  inheritance: { icon: "家", tone: "gold" },
  home_clearance: { icon: "鍵", tone: "leaf" },
  completed: { icon: "済", tone: "blue" }
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
          <p className="eyebrow">入口</p>
          <h1 className="page-title">親はいま、どの状況に近いですか？</h1>
          <p className="lead">
            下のカードから、当てはまるものを1つ押してください。ぴったり合わなくても大丈夫です。
            近いものを選ぶと、次に確認することを分かりやすく整理します。
          </p>
          <div className="start-steps" aria-label="利用の流れ">
            <span>1. カードを押す</span>
            <span>2. 少し入力</span>
            <span>3. リストを見る</span>
          </div>
        </div>
        <aside className="start-guide-card" aria-label="案内">
          <div className="start-mascot" aria-hidden="true">
            <span className="mascot-face">
              <span className="mascot-eye left" />
              <span className="mascot-eye right" />
              <span className="mascot-smile" />
            </span>
            <span className="mascot-paper paper-one" />
            <span className="mascot-paper paper-two" />
          </div>
          <p className="pill">迷ったら近いものを</p>
          <h2>家族で確認することを、短いリストにします。</h2>
          <p>入院、介護、亡くなった後の手続きも、まずは1つ選ぶだけで大丈夫です。</p>
        </aside>
      </section>

      <section className="start-select-guide" aria-label="選び方">
        <div className="select-guide-icon" aria-hidden="true">押</div>
        <div>
          <p className="eyebrow">選び方</p>
          <h2>当てはまるカードを1つタップしてください。</h2>
          <p>カード全体が押せます。選ぶと、3分ほどの確認画面へ進みます。</p>
        </div>
      </section>

      <section className="quick-start panel" aria-label="よく選ばれる入口">
        <div>
          <p className="eyebrow">まずここから</p>
          <h2>急いでいる時は、近いカードを押してください。</h2>
        </div>
        <div className="quick-status-row">
          {priorityStatuses.map((key) => {
            const item = statusByKey.get(key);
            if (!item) return null;
            return (
              <button className="quick-status-button" key={key} onClick={() => choose(key)}>
                <span className="status-card-top">
                  <span className={`status-visual ${statusVisuals[key].tone}`} aria-hidden="true">
                    {statusVisuals[key].icon}
                  </span>
                  <span className="tap-badge">タップ</span>
                </span>
                <strong>{statusDisplayLabels[key] ?? item.label}</strong>
                <span>{statusDescriptions[key]}</span>
                <em>この状況で始める <b aria-hidden="true">→</b></em>
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
                    <span className="status-card-top">
                      <span className={`status-visual ${statusVisuals[key].tone}`} aria-hidden="true">
                        {statusVisuals[key].icon}
                      </span>
                      <span className="tap-badge">タップ</span>
                    </span>
                    <strong>{statusDisplayLabels[key] ?? item.label}</strong>
                    <span>{statusDescriptions[key]}</span>
                    <em>これを選ぶ <b aria-hidden="true">→</b></em>
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
