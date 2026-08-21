import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrisisMessageTemplate, CrisisSteps } from "@/components/CrisisSteps";
import { CRISIS_EMERGENCY_NOTE, CRISIS_SAFETY_NOTE, crisisScenarios, getCrisisScenario } from "@oyano/shared";
import { getGuide } from "@/lib/guides";

export function generateStaticParams() {
  return crisisScenarios.map((scenario) => ({ key: scenario.key }));
}

export function generateMetadata({ params }: { params: { key: string } }): Metadata {
  const scenario = getCrisisScenario(params.key);
  if (!scenario) return {};

  return {
    title: scenario.title,
    description: scenario.lead
  };
}

export default function CrisisScenarioPage({ params }: { params: { key: string } }) {
  const scenario = getCrisisScenario(params.key);
  if (!scenario) notFound();

  const relatedGuides = scenario.guideSlugs
    .map((slug) => getGuide(slug))
    .filter((guide): guide is NonNullable<ReturnType<typeof getGuide>> => Boolean(guide));

  return (
    <main className="container crisis-page crisis-detail">
      <Link className="crisis-back" href="/crisis">‹ 別の状況を選ぶ</Link>

      <section className="crisis-hero">
        <p className="crisis-eyebrow">{scenario.situation}</p>
        <h1>{scenario.title}</h1>
        <p className="crisis-lead">{scenario.lead}</p>
        <div className="crisis-reassurance">
          <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
          <p>{scenario.reassurance}</p>
        </div>
      </section>

      <CrisisSteps scenario={scenario} />

      <section className="crisis-panel crisis-template-panel" aria-label="家族への第一報">
        <h2>家族への第一報は、この文面で送れます</h2>
        <p>一人ずつ電話すると内容がずれます。同じ文面を一度に送るほうが、後の行き違いを防げます。</p>
        <CrisisMessageTemplate template={scenario.messageTemplate} />
      </section>

      <section className="crisis-panel crisis-not-yet" aria-label="いまはやらなくていいこと">
        <h2>いまはやらなくていいこと</h2>
        <p>周りから言われても、今日決める必要はありません。</p>
        <ul>
          {scenario.notYet.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="crisis-panel crisis-asked" aria-label={scenario.asked.title}>
        <h2>{scenario.asked.title}</h2>
        <p>{scenario.asked.note}</p>
        <ul>
          {scenario.asked.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="crisis-panel crisis-keep" aria-label="捨てない・消さないもの">
        <h2>捨てない・消さないもの</h2>
        <p>後から取り戻せないものだけを挙げています。暗証番号やパスワードは、どこにも書き残さないでください。</p>
        <ul>
          {scenario.keepItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="crisis-panel crisis-next" aria-label="このあと">
        <h2>落ち着いてからで大丈夫です</h2>
        <p>今日の記録を手帳に残しておくと、この先の相談で毎回ゼロから説明せずに済みます。</p>
        <div className="crisis-next-actions">
          <Link className="button" href="/home">手帳を開く</Link>
          <Link className="secondary" href="/checklists">確認リストを見る</Link>
        </div>
        {relatedGuides.length > 0 ? (
          <div className="crisis-guide-links">
            {relatedGuides.map((guide) => (
              <Link href={`/guides/${guide.slug}`} key={guide.slug}>
                <span>{guide.category}</span>
                <strong>{guide.title}</strong>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <p className="crisis-emergency">{CRISIS_EMERGENCY_NOTE}</p>
      <p className="crisis-safety">{CRISIS_SAFETY_NOTE}</p>
    </main>
  );
}
