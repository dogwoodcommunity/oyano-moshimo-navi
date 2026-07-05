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
              <Link href="/start">診断</Link>
              <Link href="/support-pack">発動サポート</Link>
              <Link href="/providers">相談先</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
