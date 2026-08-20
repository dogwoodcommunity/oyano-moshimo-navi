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
  icon: string;
};

const tocGroups: Array<{ label: string; tone: "teal" | "sand"; items: TocItem[] }> = [
  {
    label: "これからに そなえる",
    tone: "teal",
    items: [
      { num: "01", key: "preparing", title: "元気なうちに準備したい", hint: "連絡先や書類の場所をまとめる", icon: "準備" },
      { num: "02", key: "cognitive_decline", title: "もの忘れが心配", hint: "相談先や家族で決めることを整理", icon: "相談" }
    ]
  },
  {
    label: "入院・退院のとき",
    tone: "teal",
    items: [
      { num: "03", key: "hospitalized", title: "入院した", hint: "病院で聞くこと、支払い、退院後のこと", icon: "入院" },
      { num: "04", key: "post_discharge_home", title: "退院後、家で過ごす", hint: "通院、在宅生活、訪問サービス", icon: "在宅" }
    ]
  },
  {
    label: "介護と看取り",
    tone: "teal",
    items: [
      { num: "05", key: "facility", title: "介護・施設のこと", hint: "介護や施設、家族の役割分担", icon: "介護" },
      { num: "06", key: "end_of_life", title: "看取り・終末期のこと", hint: "緊急連絡や希望を家族で確認", icon: "看取り" }
    ]
  },
  {
    label: "亡くなったあと",
    tone: "sand",
    items: [
      { num: "07", key: "after_death", title: "亡くなった直後", hint: "葬儀、親族連絡、役所手続きの初動", icon: "初動" },
      { num: "08", key: "after_funeral", title: "葬儀が終わった後", hint: "年金、保険、名義変更など", icon: "手続き" }
    ]
  },
  {
    label: "整理と かたづけ",
    tone: "sand",
    items: [
      { num: "09", key: "inheritance", title: "相続前に整理したい", hint: "書類や専門家に相談する前の確認", icon: "相続" },
      { num: "10", key: "home_clearance", title: "実家を片付けたい", hint: "写真、鍵、書類、家の状態", icon: "実家" },
      { num: "11", key: "completed", title: "整理が終わった", hint: "家族で見返せるように保管", icon: "保管" }
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
        <button className="toc-back" type="button" onClick={() => router.push("/install")}>
          ‹ もどる
        </button>
        <p className="toc-kicker">最初の質問</p>
        <h1>親は今、どの状況に近いですか？</h1>
        <p>下のカードから、いちばん近いものを1つタップしてください。カード全体を押せます。</p>
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
                    <span className="toc-num" aria-hidden="true">
                      {isChoosing ? "✓" : item.icon}
                    </span>
                    <span className="toc-main">
                      <strong className="toc-title">{item.title}</strong>
                      <span className="toc-hint">{item.hint}</span>
                    </span>
                    <span className="current-chip">{isChoosing ? "開いています" : "これを選ぶ"}</span>
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
