"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SENSITIVE_INFO_CONSENT_VERSION, STATUSES, type DiagnosisAnswers, type ParentStatus } from "@oyano/shared";
import { submitDiagnosis } from "@/lib/store";

const concernOptions = ["期限がある手続き", "家族の役割分担", "実家の片付け", "相続・名義変更", "相談先探し", "お金・保険の把握"];
const targetOptions: Array<{
  key: NonNullable<DiagnosisAnswers["targetRelationship"]>;
  label: string;
  note: string;
}> = [
  { key: "mother", label: "母", note: "お母さんのこと" },
  { key: "father", label: "父", note: "お父さんのこと" },
  { key: "mother_in_law", label: "義母", note: "配偶者のお母さん" },
  { key: "father_in_law", label: "義父", note: "配偶者のお父さん" },
  { key: "grandparent", label: "祖父母", note: "祖父・祖母のこと" },
  { key: "other", label: "その他", note: "叔父叔母など" }
];
const statusNotes: Partial<Record<ParentStatus, string>> = {
  hospitalized: "入院中・退院調整中",
  facility: "施設入所や介護の相談中",
  cognitive_decline: "認知症や判断力低下が心配",
  after_death: "亡くなった直後の手続き",
  inheritance: "相続や名義変更が心配",
  home_clearance: "実家の片付けを進めたい",
  preparing: "今のうちに備えたい"
};

export function DiagnosisForm() {
  const router = useRouter();
  const params = useSearchParams();
  const caseId = params.get("caseId") ?? crypto.randomUUID();
  const initialStatus = (params.get("status") ?? "preparing") as ParentStatus;
  const [selectedStatus, setSelectedStatus] = useState<ParentStatus>(initialStatus);
  const [targetRelationship, setTargetRelationship] = useState<NonNullable<DiagnosisAnswers["targetRelationship"]>>("mother");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const statusLabel = useMemo(() => STATUSES.find((item) => item.key === selectedStatus)?.label, [selectedStatus]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const answers: DiagnosisAnswers = {
      selectedStatus,
      targetRelationship,
      targetName: String(form.get("targetName") ?? ""),
      parentSituation: String(form.get("parentSituation") ?? ""),
      familyStructure: String(form.get("familyStructure") ?? ""),
      hasHome: String(form.get("hasHome") ?? "unknown") as DiagnosisAnswers["hasHome"],
      knowsAssets: String(form.get("knowsAssets") ?? "unknown") as DiagnosisAnswers["knowsAssets"],
      concerns,
      homeClearance: String(form.get("homeClearance") ?? ""),
      contactName: String(form.get("contactName") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      consentToContact: form.get("consentToContact") === "on",
      consentToSensitiveInfo: form.get("sensitiveInfoConsent") === "on",
      consentTextVersion: SENSITIVE_INFO_CONSENT_VERSION
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
          <p className="pill">3分で整理</p>
          <p className="lead">分かる範囲だけで大丈夫です。家族で話す順番と、期限のある手続きを短いリストにします。</p>
        </div>
        <div className="progress-rail" aria-label="整理チェックの流れ">
          <span className="progress-step active">1 状況を選ぶ</span>
          <span className="progress-step active">2 対象者を確認</span>
          <span className="progress-step active">3 分かる範囲で確認</span>
          <span className="progress-step">4 結果を見る</span>
        </div>
      </section>

      <form className="diagnosis-notebook" onSubmit={onSubmit}>
        <section className="diagnosis-sheet">
          <div className="form-section-head">
            <span className="step-badge">1</span>
            <div>
              <h2>誰のことを整理しますか？</h2>
              <p className="hint">まず対象者を選んでください。名前や呼び名は任意です。</p>
            </div>
          </div>

          <div className="target-choice-grid" role="radiogroup" aria-label="対象者">
            {targetOptions.map((item) => (
              <button
                aria-checked={targetRelationship === item.key}
                className={`target-choice-card ${targetRelationship === item.key ? "selected" : ""}`}
                key={item.key}
                onClick={() => setTargetRelationship(item.key)}
                role="radio"
                type="button"
              >
                <span className="target-avatar" aria-hidden="true">{item.label.slice(0, 1)}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="soft-memo-field">
            <label htmlFor="targetName">呼び名 任意</label>
            <input className="input" id="targetName" name="targetName" placeholder="例: 母、花子さん、おばあちゃん" />
          </div>
        </section>

        <section className="diagnosis-sheet">
          <div className="form-section-head">
            <span className="step-badge">2</span>
            <div>
              <h2>いま一番近い状況を選ぶ</h2>
              <p className="hint">あとから変更できます。迷ったら一番近いものを押してください。</p>
            </div>
          </div>

          <div className="status-choice-grid" role="radiogroup" aria-label="親の状況">
            {STATUSES.map((item) => (
              <button
                aria-checked={selectedStatus === item.key}
                className={`diagnosis-status-card ${selectedStatus === item.key ? "selected" : ""}`}
                key={item.key}
                onClick={() => setSelectedStatus(item.key)}
                role="radio"
                type="button"
              >
                <span>{item.label}</span>
                <small>{statusNotes[item.key] ?? "家族で確認したい"}</small>
              </button>
            ))}
          </div>

          <div className="soft-memo-field">
            <label htmlFor="parentSituation">いま分かっていること</label>
            <textarea className="textarea" id="parentSituation" name="parentSituation" placeholder="例: 入院中。退院後の生活場所を家族で相談している。" />
          </div>
        </section>

        <section className="diagnosis-sheet">
          <div className="form-section-head">
            <span className="step-badge">3</span>
            <div>
              <h2>家族で確認できていること</h2>
              <p className="hint">正確でなくても大丈夫です。今の把握状況だけ選びます。</p>
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

        <section className="diagnosis-sheet">
          <div className="form-section-head">
            <span className="step-badge">4</span>
            <div>
              <h2>気になっていること</h2>
              <p className="hint">複数選べます。結果の優先順位に反映します。</p>
            </div>
          </div>
          <div className="concern-grid">
            {concernOptions.map((item) => (
              <label className={`concern-card ${concerns.includes(item) ? "selected" : ""}`} key={item}>
                <input type="checkbox" checked={concerns.includes(item)} onChange={() => toggleConcern(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="diagnosis-sheet">
          <div className="form-section-head">
            <span className="step-badge">5</span>
            <div>
              <h2>実家や家じまいのメモ</h2>
              <p className="hint">分からない場合は空欄でも進めます。</p>
            </div>
          </div>
          <div className="soft-memo-field">
            <label htmlFor="homeClearance">メモ</label>
            <textarea className="textarea" id="homeClearance" name="homeClearance" placeholder="例: 空き家になりそう。鍵の場所は兄が把握。" />
          </div>
          <p className="hint">写真アップロードは後続実装枠です。MVPではアプリ側の写真管理へ引き継ぎます。</p>
        </section>

        <section className="diagnosis-sheet">
          <div className="form-section-head">
            <span className="step-badge">6</span>
            <div>
              <h2>必要なら連絡先を残す</h2>
              <p className="hint">結果を見るだけなら任意です。発動サポートを使う場合だけ必要になります。</p>
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
