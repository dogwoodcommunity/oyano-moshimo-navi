import { DeleteOperatorMfaSetup } from "@/components/DeleteOperatorMfaSetup";

export default function DeleteOperatorMfaSetupPage() {
  return (
    <main className="container">
      <section className="admin-hero compact">
        <p className="admin-setup-kicker">本人確認設定</p>
        <h1 className="page-title">削除担当者の本人確認設定</h1>
        <p className="lead">
          利用者から届いた完全削除申請を安全に扱うため、個別メールと認証アプリの2段階で本人確認します。
          QRコードや6桁の数字は、運営者にも送らないでください。
        </p>
      </section>
      <DeleteOperatorMfaSetup />
    </main>
  );
}
