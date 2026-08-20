import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body"
});

const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-rounded"
});

export const metadata: Metadata = {
  title: {
    default: "親のもしもナビ",
    template: "%s | 親のもしもナビ"
  },
  description: "入院、介護、実家じまい、相続前の情報整理まで。親のもしもに備える家族向け準備ポータル。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000"),
  applicationName: "親のもしもナビ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "親のもしも"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/logo-mark.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/brand/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#276447"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${notoSansJp.variable} ${zenMaru.variable}`} lang="ja">
      <body>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href="/start">親のもしもナビ</Link>
            <nav className="navlinks" aria-label="main">
              <Link href="/start">親を登録</Link>
              <Link href="/home">家族ボード</Link>
              <Link href="/guides">読む</Link>
              <Link href="/safety">安心</Link>
            </nav>
          </header>
          {children}
          <footer className="footer">
            <Link href="/safety">安心設計</Link>
            <Link href="/legal/privacy">プライバシー</Link>
            <Link href="/legal/terms">利用規約</Link>
            <Link href="/legal/tokushoho">特商法</Link>
            <Link href="/legal/disclaimer">免責</Link>
            <Link href="/start">親を登録する</Link>
          </footer>
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
