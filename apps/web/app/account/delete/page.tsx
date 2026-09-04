import type { Metadata } from "next";
import { AccountDeleteRequest } from "@/components/AccountDeleteRequest";

export const metadata: Metadata = {
  title: "アカウント・データの削除",
  description: "親のもしもナビのクラウドアカウント、家族データ、この端末の手帳を削除するための手続きです。"
};

export default function AccountDeletePage() {
  return (
    <main className="container account-delete-page">
      <section className="legal-hero">
        <p className="pill">アカウントとデータ</p>
        <h1 className="page-title">削除する内容を分けて確認できます。</h1>
        <p className="lead">
          クラウドに保存した家族データの削除依頼と、このブラウザだけに残っている手帳の削除は別の操作です。
          間違って消さないよう、一つずつ確認して進めます。
        </p>
      </section>
      <AccountDeleteRequest />
    </main>
  );
}
