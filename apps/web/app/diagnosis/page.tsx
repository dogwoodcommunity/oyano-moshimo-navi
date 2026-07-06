import { Suspense } from "react";
import { DiagnosisForm } from "./DiagnosisForm";

export default function DiagnosisPage() {
  return (
    <main className="container">
      <p className="eyebrow">状況整理チェック</p>
      <h1 className="page-title">家族で確認することを整理する</h1>
      <Suspense fallback={<p className="lead">入力フォームを読み込み中</p>}>
        <DiagnosisForm />
      </Suspense>
    </main>
  );
}
