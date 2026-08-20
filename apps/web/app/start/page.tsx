"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type ParentStatus } from "@oyano/shared";
import { createCase } from "@/lib/store";

type TocItem = {
  num: string;
  key: ParentStatus;
  title: string;
  hint: string;
  icon: "note" | "chat" | "bed" | "home" | "care" | "heart" | "bell" | "paper" | "tree" | "box" | "check";
};

const tocGroups: Array<{ label: string; tone: "teal" | "sand"; items: TocItem[] }> = [
  {
    label: "これからに そなえる",
    tone: "teal",
    items: [
      { num: "01", key: "preparing", title: "元気なうちに準備したい", hint: "連絡先や書類の場所をまとめる", icon: "note" },
      { num: "02", key: "cognitive_decline", title: "もの忘れが心配", hint: "相談先や家族で決めることを整理", icon: "chat" }
    ]
  },
  {
    label: "入院・退院のとき",
    tone: "teal",
    items: [
      { num: "03", key: "hospitalized", title: "入院した", hint: "病院で聞くこと、支払い、退院後のこと", icon: "bed" },
      { num: "04", key: "post_discharge_home", title: "退院後、家で過ごす", hint: "通院、在宅生活、訪問サービス", icon: "home" }
    ]
  },
  {
    label: "介護と看取り",
    tone: "teal",
    items: [
      { num: "05", key: "facility", title: "介護・施設のこと", hint: "介護や施設、家族の役割分担", icon: "care" },
      { num: "06", key: "end_of_life", title: "看取り・終末期のこと", hint: "緊急連絡や希望を家族で確認", icon: "heart" }
    ]
  },
  {
    label: "亡くなったあと",
    tone: "sand",
    items: [
      { num: "07", key: "after_death", title: "亡くなった直後", hint: "葬儀、親族連絡、役所手続きの初動", icon: "bell" },
      { num: "08", key: "after_funeral", title: "葬儀が終わった後", hint: "年金、保険、名義変更など", icon: "paper" }
    ]
  },
  {
    label: "整理と かたづけ",
    tone: "sand",
    items: [
      { num: "09", key: "inheritance", title: "相続前に整理したい", hint: "書類や専門家に相談する前の確認", icon: "tree" },
      { num: "10", key: "home_clearance", title: "実家を片付けたい", hint: "写真、鍵、書類、家の状態", icon: "box" },
      { num: "11", key: "completed", title: "整理が終わった", hint: "家族で見返せるように保管", icon: "check" }
    ]
  }
];

export default function StartPage() {
  const router = useRouter();
  const [choosingStatus, setChoosingStatus] = useState<ParentStatus | null>(null);

  useEffect(() => {
    router.prefetch("/diagnosis");
  }, [router]);

  async function choose(status: ParentStatus) {
    if (choosingStatus) return;
    setChoosingStatus(status);
    const record = await createCase(status);
    router.push(`/diagnosis?caseId=${record.id}&status=${status}`);
  }

  return (
    <main className="paper-bg notebook-start-page">
      <section className="toc-header">
        <button className="toc-back" type="button" onClick={() => router.push("/home")}>
          ‹ もどる
        </button>
        <p className="toc-kicker">最初の質問</p>
        <h1>親は今、どの状況に近いですか？</h1>
        <p>当てはまるカードを1つだけ選んでください。文字の上でも、余白でも、カード全体をタップできます。</p>
      </section>

      <section className="notebook-card toc-book" aria-label="親の状況を選ぶ">
        {tocGroups.map((group) => (
          <div className="toc-chapter" key={group.label}>
            <h2 className={`chapter-tab ${group.tone}`}>{group.label}</h2>
            <div className="toc-list">
              {group.items.map((item) => {
                const isChoosing = choosingStatus === item.key;
                return (
                  <button
                    className={`toc-row ${group.tone} ${isChoosing ? "is-opening" : ""}`}
                    disabled={Boolean(choosingStatus)}
                    key={item.key}
                    type="button"
                    onClick={() => choose(item.key)}
                  >
                    <span className={`toc-num toc-icon ${item.icon}`} aria-hidden="true">
                      {isChoosing ? <span className="toc-checkmark">✓</span> : <span className="toc-symbol" />}
                    </span>
                    <span className="toc-main">
                      <span className="toc-helper">このカードを押す</span>
                      <strong className="toc-title">{item.title}</strong>
                      <span className="toc-hint">{item.hint}</span>
                    </span>
                    <span className="current-chip">{isChoosing ? "開いています" : "選択"}</span>
                    <span className="toc-arrow" aria-hidden="true">
                      →
                    </span>
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
