import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "親のもしもナビ v0.3",
  description: "親の状況が変わったら、家族が次にやることが分かる。"
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
              <Link href="/start">整理チェック</Link>
              <Link href="/support-pack">発動サポート</Link>
              <Link href="/providers">相談先</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </header>
          {children}
          <footer className="footer">
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
