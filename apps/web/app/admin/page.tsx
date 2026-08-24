import Link from "next/link";
import { AdminTokenControl } from "@/components/AdminTokenControl";

type AdminLink = {
  href: string;
  title: string;
  description: string;
  action: string;
  tone?: "primary" | "warning";
};

const reviewLinks: AdminLink[] = [
  {
    href: "/admin/monitor-feedback",
    title: "モニター回答",
    description: "7日間テストの回答、迷った画面、継続意向、月980円への支払意向を読みます。",
    action: "回答を見る",
    tone: "primary"
  },
  {
    href: "/admin/ai-usage",
    title: "AI相談の利用と原価",
    description: "回答回数、Family Plusの上限到達、AI APIの概算原価を確認します。",
    action: "利用状況を見る"
  },
  {
    href: "/admin/delete-requests",
    title: "削除依頼",
    description: "利用者から届いたアカウント・記録の削除依頼を確認します。",
    action: "依頼を見る",
    tone: "warning"
  }
];

const usageLinks: AdminLink[] = [
  {
    href: "/admin/funnel",
    title: "利用の流れ",
    description: "入口から手帳作成、記録、クラウド保存まで、どこで離脱しているかを見ます。",
    action: "利用の流れを見る"
  },
  {
    href: "/admin/cases",
    title: "登録されたケース",
    description: "利用者が作成したケースと回答内容を運営確認用に一覧します。",
    action: "ケースを見る"
  }
];

const businessLinks: AdminLink[] = [
  {
    href: "/admin/support-packs",
    title: "発動サポート依頼",
    description: "依頼状態、連絡先、購入ステータスを追跡します。",
    action: "依頼を確認する"
  },
  {
    href: "/admin/sponsor-applications",
    title: "スポンサー掲載申請",
    description: "地域と分野ごとに届いた掲載申請を確認します。",
    action: "申請を見る"
  },
  {
    href: "/admin/regional-sponsors",
    title: "地域別の利用状況",
    description: "親の居住地を基準に、利用者数・世帯数と営業用CSVを確認します。",
    action: "地域データを見る"
  }
];

const systemLinks: AdminLink[] = [
  {
    href: "/admin/env",
    title: "本番設定の確認",
    description: "Supabase、Stripe、通知など、本番環境の設定漏れを確認します。",
    action: "設定状況を見る"
  },
  {
    href: "/admin/providers",
    title: "相談先データ",
    description: "アプリ内で扱う相談先候補の登録内容を確認します。",
    action: "相談先を見る"
  }
];

function AdminSection({ title, description, links }: {
  title: string;
  description: string;
  links: AdminLink[];
}) {
  return (
    <section className="admin-dashboard-section">
      <div className="admin-dashboard-section-head">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="admin-dashboard-grid">
        {links.map((link) => (
          <article className={`admin-dashboard-card${link.tone ? ` is-${link.tone}` : ""}`} key={link.href}>
            <div>
              <h3>{link.title}</h3>
              <p>{link.description}</p>
            </div>
            <Link href={link.href}>{link.action}<span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AdminPage() {
  return (
    <main className="admin-container">
      <section className="admin-dashboard-hero">
        <div>
          <p className="admin-section-label">運営ダッシュボード</p>
          <h1>今日、確認することから始めます。</h1>
          <p>
            モニターの声、利用状況、売上・提携、システム設定を順番に確認できます。
            技術用語を覚える必要はありません。
          </p>
        </div>
        <Link className="admin-primary-link" href="/admin/monitor-feedback">
          モニター回答を見る
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <AdminTokenControl />

      <AdminSection
        title="いま確認する"
        description="モニターテストと運営上の重要な依頼を、最初に確認します。"
        links={reviewLinks}
      />
      <AdminSection
        title="利用状況"
        description="利用者がどこまで進み、どこで止まっているかを確認します。"
        links={usageLinks}
      />
      <AdminSection
        title="売上・提携"
        description="サポート依頼とスポンサー掲載に関する管理です。"
        links={businessLinks}
      />
      <AdminSection
        title="システム"
        description="普段は触りません。本番設定や相談先データを確認する時だけ開きます。"
        links={systemLinks}
      />
    </main>
  );
}
