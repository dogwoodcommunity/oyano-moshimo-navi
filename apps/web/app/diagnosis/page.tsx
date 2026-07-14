import { Suspense } from "react";
import { DiagnosisForm } from "./DiagnosisForm";

export default function DiagnosisPage() {
  return (
    <main className="container">
      <p className="eyebrow">家族の整理ノート</p>
      <h1 className="page-title">いま必要なことを、順番に整理します</h1>
      <Suspense fallback={<p className="lead">整理ノートを読み込み中</p>}>
        <DiagnosisForm />
      </Suspense>
    </main>
  );
}
