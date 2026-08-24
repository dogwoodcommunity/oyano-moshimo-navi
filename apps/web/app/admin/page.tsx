import Link from "next/link";
import { AdminCases } from "@/components/AdminCases";
import { AdminLocalTools } from "@/components/AdminLocalTools";
import { AdminTokenControl } from "@/components/AdminTokenControl";

export default function AdminPage() {
  return (
    <main className="container">
      <section className="admin-hero">
        <p className="pill">Operations</p>
        <h1 className="page-title">Admin overview</h1>
        <p className="lead">利用状況、AI原価、スポンサー枠、発動サポートパック、環境設定を確認する運営専用の管理入口です。</p>
        <div className="actions">
          <Link className="secondary" href="/admin/funnel">funnel</Link>
          <Link className="secondary" href="/admin/cases">cases</Link>
          <Link className="secondary" href="/admin/support-packs">support packs</Link>
          <Link className="secondary" href="/admin/sponsor-applications">sponsor slots</Link>
          <Link className="secondary" href="/admin/regional-sponsors">regional metrics</Link>
          <Link className="secondary" href="/admin/ai-usage">AI usage</Link>
          <Link className="secondary" href="/admin/delete-requests">delete requests</Link>
          <Link className="secondary" href="/admin/providers">providers</Link>
          <Link className="secondary" href="/admin/env">env</Link>
        </div>
      </section>
      <section className="admin-stat-grid">
        <article className="admin-stat">
          <span>01</span>
          <strong>Case確認</strong>
          <p>QR入口から作成された診断caseと回答内容を確認します。</p>
        </article>
        <article className="admin-stat">
          <span>02</span>
          <strong>Support pack</strong>
          <p>Stripe連携後の依頼状態、連絡先、購入ステータスを追跡します。</p>
        </article>
        <article className="admin-stat">
          <span>03</span>
          <strong>Environment</strong>
          <p>Supabase、Stripe、通知Cronなどの本番設定漏れを確認します。</p>
        </article>
        <article className="admin-stat">
          <span>04</span>
          <strong>削除依頼</strong>
          <p>アプリ内から届いたアカウント削除依頼を確認します。</p>
        </article>
        <article className="admin-stat">
          <span>05</span>
          <strong>Sponsor slots</strong>
          <p>都道府県×分野で届いたスポンサー枠の申請を確認します。</p>
        </article>
        <article className="admin-stat">
          <span>06</span>
          <strong>Regional metrics</strong>
          <p>親の居住地ベースで、県×分野の利用者数・世帯数と営業用CSVを確認します。</p>
        </article>
        <article className="admin-stat">
          <span>07</span>
          <strong>AI usage</strong>
          <p>相談の回答回数、Family Plusの上限到達、AI APIの概算原価を確認します。</p>
        </article>
      </section>
      <AdminTokenControl />
      <AdminLocalTools />
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Recent cases</p>
            <h2>最近のcase</h2>
          </div>
          <Link className="secondary" href="/admin/cases">すべて見る</Link>
        </div>
        <AdminCases />
      </section>
    </main>
  );
}
