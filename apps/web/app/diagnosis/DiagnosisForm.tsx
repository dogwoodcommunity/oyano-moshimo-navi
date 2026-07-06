"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { STATUSES, type DiagnosisAnswers, type ParentStatus } from "@oyano/shared";
import { submitDiagnosis } from "@/lib/store";

const concernOptions = ["期限がある手続き", "家族の役割分担", "実家の片付け", "相続・名義変更", "相談先探し", "お金・保険の把握"];

export function DiagnosisForm() {
  const router = useRouter();
  const params = useSearchParams();
  const caseId = params.get("caseId") ?? crypto.randomUUID();
  const initialStatus = (params.get("status") ?? "preparing") as ParentStatus;
  const [selectedStatus, setSelectedStatus] = useState<ParentStatus>(initialStatus);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const statusLabel = useMemo(() => STATUSES.find((item) => item.key === selectedStatus)?.label, [selectedStatus]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const answers: DiagnosisAnswers = {
      selectedStatus,
      parentSituation: String(form.get("parentSituation") ?? ""),
      familyStructure: String(form.get("familyStructure") ?? ""),
      hasHome: String(form.get("hasHome") ?? "unknown") as DiagnosisAnswers["hasHome"],
      knowsAssets: String(form.get("knowsAssets") ?? "unknown") as DiagnosisAnswers["knowsAssets"],
      concerns,
      homeClearance: String(form.get("homeClearance") ?? ""),
      contactName: String(form.get("contactName") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      consentToContact: form.get("consentToContact") === "on"
    };
    const record = await submitDiagnosis(caseId, answers);
    router.push(`/result/${record.id}`);
  }

  function toggleConcern(value: string) {
    setConcerns((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  return (
    <>
      <section className="diagnosis-intro">
        <div>
          <p className="pill">現在の状態: {statusLabel}</p>
          <p className="lead">分かる範囲だけで大丈夫です。結果画面では、期限のあるタスクと家族で確認することを分けて表示します。</p>
        </div>
        <div className="progress-rail" aria-label="整理チェックの流れ">
          <span className="progress-step active">状態</span>
          <span className="progress-step active">確認</span>
          <span className="progress-step">結果</span>
        </div>
      </section>

      <form className="form diagnosis-form" onSubmit={onSubmit}>
        <section className="panel field form-section">
          <div className="form-section-head">
            <span className="step-badge">01</span>
            <div>
              <h2>いまの状況</h2>
              <p className="hint">あとから変更できます。近いものを選んでください。</p>
            </div>
          </div>
          <label htmlFor="status">親の状況</label>
          <select className="select" id="status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as ParentStatus)}>
            {STATUSES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <textarea className="textarea" name="parentSituation" placeholder="例: 入院中。退院後の生活場所を相談している。" />
        </section>

        <section className="panel form-section">
          <div className="form-section-head">
            <span className="step-badge">02</span>
            <div>
              <h2>家族・実家・資産の把握</h2>
              <p className="hint">正確でなくても、現時点の把握状況を選びます。</p>
            </div>
          </div>
          <div className="columns compact-columns">
            <div className="field">
              <label htmlFor="familyStructure">家族構成</label>
              <input className="input" id="familyStructure" name="familyStructure" placeholder="例: 母、長男、長女" />
            </div>
            <div className="field">
              <label htmlFor="hasHome">不動産・実家の有無</label>
              <select className="select" id="hasHome" name="hasHome" defaultValue="unknown">
                <option value="yes">ある</option>
                <option value="no">ない</option>
                <option value="unknown">分からない</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="knowsAssets">銀行・保険・年金の把握状況</label>
              <select className="select" id="knowsAssets" name="knowsAssets" defaultValue="unknown">
                <option value="mostly">だいたい把握</option>
                <option value="some">一部だけ把握</option>
                <option value="unknown">ほぼ分からない</option>
              </select>
            </div>
          </div>
        </section>

        <section className="panel field form-section">
          <div className="form-section-head">
            <span className="step-badge">03</span>
            <div>
              <h2>困っていること</h2>
              <p className="hint">複数選択できます。結果の優先順位に反映します。</p>
            </div>
          </div>
          <div className="checks">
            {concernOptions.map((item) => (
              <label className="check" key={item}>
                <input type="checkbox" checked={concerns.includes(item)} onChange={() => toggleConcern(item)} />
                {item}
              </label>
            ))}
          </div>
        </section>

        <section className="panel field form-section">
          <div className="form-section-head">
            <span className="step-badge">04</span>
            <div>
              <h2>実家・家じまい</h2>
              <p className="hint">分からない場合は空欄でも進めます。</p>
            </div>
          </div>
          <label htmlFor="homeClearance">家じまい状況</label>
          <textarea className="textarea" id="homeClearance" name="homeClearance" placeholder="例: 空き家になりそう。鍵の場所は兄が把握。" />
          <p className="hint">写真アップロードは後続実装枠です。MVPではアプリ側の写真管理へ引き継ぎます。</p>
        </section>

        <section className="panel form-section">
          <div className="form-section-head">
            <span className="step-badge">05</span>
            <div>
              <h2>連絡先</h2>
              <p className="hint">発動サポートを使う場合だけ必要になります。</p>
            </div>
          </div>
          <div className="columns compact-columns">
            <div className="field">
              <label htmlFor="contactName">連絡先 任意</label>
              <input className="input" id="contactName" name="contactName" placeholder="お名前" />
            </div>
            <div className="field">
              <label htmlFor="contactEmail">メール 任意</label>
              <input className="input" id="contactEmail" name="contactEmail" type="email" placeholder="mail@example.com" />
            </div>
          </div>
          <label className="check consent-check">
            <input name="consentToContact" type="checkbox" />
            発動サポートや相談先整理のため、必要時に連絡を受けることに同意する
          </label>
          <label className="check consent-check">
            <input name="sensitiveInfoConsent" required type="checkbox" />
            親の入院・認知症・死亡などの情報が要配慮情報に該当し得ることを理解し、本人に説明できる場合は説明したうえで、家族の支援に必要な範囲で入力します
          </label>
          <p className="hint">
            暗証番号、パスワード、マイナンバー画像は入力しないでください。詳しくは
            <a href="/legal/privacy">プライバシーポリシー</a>
            を確認してください。
          </p>
        </section>

        <div className="submit-bar">
          <div>
            <strong>入力はあとから補えます。</strong>
            <p className="hint">まずは現時点の情報で結果を作成します。</p>
          </div>
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "整理結果を作成中" : "整理結果を見る"}
          </button>
        </div>
      </form>
    </>
  );
}
