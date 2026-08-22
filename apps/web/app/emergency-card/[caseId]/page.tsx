"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { statusLabel } from "@oyano/shared";
import { getLocalCase } from "@/lib/store";

function field(label: string, value?: string) {
  return { label, value: value?.trim() || "未入力" };
}

export default function EmergencyCardPage() {
  const params = useParams<{ caseId: string }>();
  const caseRecord = useMemo(() => getLocalCase(params.caseId), [params.caseId]);

  if (!caseRecord) {
    return (
      <main className="container emergency-card-page">
        <section className="panel">
          <p className="pill">緊急カード</p>
          <h1 className="page-title">手帳が見つかりませんでした。</h1>
          <p className="lead">家族ボードに戻って、対象者の手帳からもう一度開いてください。</p>
          <Link className="button" href="/home">家族ボードへ戻る</Link>
        </section>
      </main>
    );
  }

  const profile = caseRecord.personProfile ?? {};
  const displayName = profile.displayName || profile.fullName || "この人";
  const rows = [
    field("呼び名", displayName),
    field("関係", profile.relationship),
    field("いまの状況", profile.careStatus || statusLabel(caseRecord.selectedStatus)),
    field("緊急連絡先", profile.emergencyContact || profile.keyContact),
    field("病院・施設", profile.hospitalOrFacility),
    field("薬・注意", profile.medicationNote),
    field("希望・配慮", profile.carePreference),
    field("家族構成・大事な人", profile.familyStructureNote || profile.importantPeopleNote)
  ];

  return (
    <main className="container emergency-card-page">
      <section className="panel emergency-card-actions">
        <p className="pill">無料で使える1枚</p>
        <h1 className="page-title">緊急カードを印刷する</h1>
        <p className="lead">
          急な入院や連絡時に、家族が同じ前提を持てる1枚です。
          銀行情報、暗証番号、重要書類の保管場所は載せません。
        </p>
        <div className="button-row">
          <button className="button" type="button" onClick={() => window.print()}>印刷する</button>
          <Link className="secondary" href="/home">家族ボードへ戻る</Link>
        </div>
      </section>

      <section className="emergency-print-card" aria-label={`${displayName}さんの緊急カード`}>
        <div className="emergency-print-head">
          <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
          <div>
            <p>親のもしもナビ</p>
            <h2>{displayName}さんの緊急カード</h2>
          </div>
        </div>

        <div className="emergency-print-grid">
          {rows.map((row) => (
            <div className="emergency-print-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>

        <p className="emergency-print-note">
          専門判断はこのカードで断定しません。医療・介護・法律・税務の判断は、主治医や専門家へ確認してください。
        </p>
      </section>
    </main>
  );
}
