import { AdminAiReports } from "@/components/AdminAiReports";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export const metadata = { title: "AI回答の通報確認 | 親のもしもナビ", robots: { index: false, follow: false } };

export default function AiReportsPage() {
  return <main className="container">
    <section className="admin-hero compact"><p className="pill">運営の安全性確認</p><h1 className="page-title">AI回答の通報確認</h1>
      <p className="lead">利用者が調査のための閲覧に同意して報告した回答を、1件ずつ確認します。登録済み管理者本人のログインと多要素認証が必要です。</p>
    </section>
    <AdminTokenControl authEndpoint="/api/admin/ai-reports/auth-status" redirectPath="/admin/ai-reports" roleLabel="通報確認の管理者"
      showEmergencyToken={false} enableMfaStepUp mfaSetupHref={null} protectedDataLabel="通報内容"
      mfaInstruction="通報の一覧・相談本文・対応状況を扱うには、登録済みの認証アプリで追加確認してください。" />
    <AdminAiReports />
  </main>;
}
