import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "親のもしもナビ",
    template: "%s | 親のもしもナビ"
  },
  description: "入院、介護、実家じまい、相続前の情報整理まで。親のもしもに備える家族向け準備ポータル。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href="/">親のもしもナビ</Link>
            <nav className="navlinks" aria-label="main">
              <Link href="/guides">準備ガイド</Link>
              <Link href="/checklists">チェックリスト</Link>
              <Link href="/start">整理チェック</Link>
              <Link href="/safety">安心設計</Link>
              <Link href="/plans">料金</Link>
              <Link href="/support-pack">発動サポート</Link>
              <Link href="/providers">相談先</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </header>
          {children}
          <footer className="footer">
            <Link href="/safety">安心設計</Link>
            <Link href="/legal/privacy">プライバシー</Link>
            <Link href="/legal/terms">利用規約</Link>
            <Link href="/legal/tokushoho">特商法</Link>
            <Link href="/legal/disclaimer">免責</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
