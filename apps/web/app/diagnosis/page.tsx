import { Suspense } from "react";
import { DiagnosisForm } from "./DiagnosisForm";

export default function DiagnosisPage() {
  return (
    <main className="container">
      <h1 className="page-title">5分診断</h1>
      <Suspense fallback={<p className="lead">診断フォームを読み込み中</p>}>
        <DiagnosisForm />
      </Suspense>
    </main>
  );
}
