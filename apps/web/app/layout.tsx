import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const criticalCss = `
  *,*::before,*::after{box-sizing:border-box}
  html{background:#faf7ee;color:#33424a}
  body{margin:0;background:#faf7ee;color:#33424a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;letter-spacing:0}
  a{color:inherit;text-decoration:none}
  button,input,select,textarea{font:inherit}
  .shell{min-height:100vh}
  .nav{align-items:center;background:rgba(246,247,241,.96);border-bottom:1px solid rgba(217,226,220,.82);display:flex;gap:16px;justify-content:space-between;min-height:66px;padding:14px 24px;position:sticky;top:0;z-index:20}
  .brand{align-items:center;display:inline-flex;font-weight:900;gap:10px}
  .brand::before{background:#0f6b45;border-radius:8px;content:"";display:inline-block;height:30px;width:30px}
  .navlinks{color:#6f7974;display:flex;flex-wrap:wrap;font-size:15px;font-weight:800;gap:18px}
  .entry-screen{display:grid;gap:22px;margin:0 auto;max-width:760px;padding:28px 24px 64px}
  .shell:has(.entry-screen) .nav{justify-content:center}
  .shell:has(.entry-screen) .navlinks{display:none}
  .title-card{display:grid;justify-items:center}
  .title-card .card{align-items:center;background:#fff;border:1px solid rgba(217,226,220,.9);border-radius:22px;box-shadow:0 18px 48px rgba(28,48,39,.1);display:flex;gap:14px;padding:16px 18px}
  .title-lockup{align-items:center;display:flex;gap:12px}
  .watch-bird-mark{display:block;height:64px;max-width:64px;width:64px}
  .title-card strong{display:block;font-size:20px;font-weight:900;line-height:1.3}
  .title-card small,.title-card span:last-child{color:#6f7974;font-size:12px;font-weight:800}
  .entry-intro-card,.entry-how-card,.entry-plus-card{background:rgba(255,255,255,.94);border:1px solid rgba(217,226,220,.95);border-radius:22px;box-shadow:0 18px 48px rgba(28,48,39,.1);padding:24px}
  .entry-date,.pill{color:#0f6b45;font-size:13px;font-weight:900;margin:0 0 10px}
  .entry-intro-card h1{color:#10221a;font-size:clamp(32px,8vw,52px);line-height:1.18;margin:0 0 18px}
  .entry-intro-card p:not(.entry-date),.entry-plus-card p,.entry-how-card span{color:#5f6d66;font-size:16px;font-weight:700;line-height:1.8}
  .entry-main-button{align-items:center;background:linear-gradient(180deg,#18754e,#0d4f34);border-radius:16px;color:#fff;display:grid;font-size:22px;font-weight:900;gap:4px;margin-top:20px;min-height:76px;padding:16px 18px;text-align:center}
  .entry-main-button span{color:rgba(255,255,255,.88);font-size:13px}
  .entry-how-card h2,.entry-plus-card h2{font-size:24px;line-height:1.35;margin:0 0 14px}
  .entry-how-card ol{display:grid;gap:12px;margin:0;padding:0;list-style:none}
  .entry-how-card li{background:#f5f8f3;border-radius:14px;display:grid;gap:4px;padding:14px}
  .entry-how-card strong{font-size:17px}
  .entry-board-link,.secondary{align-items:center;background:#fff;border:1.5px solid rgba(39,100,71,.32);border-radius:999px;color:#0f6b45;display:inline-flex;font-weight:900;justify-content:center;min-height:48px;padding:12px 18px}
  .footer{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:28px 24px;color:#6f7974;font-size:13px;font-weight:800}
  @media(max-width:640px){.nav{padding:12px 20px}.entry-screen{padding:22px 22px 58px}.title-card .card{justify-content:flex-start;width:100%}.watch-bird-mark{height:54px;max-width:54px;width:54px}.entry-intro-card,.entry-how-card,.entry-plus-card{border-radius:18px;padding:22px}.entry-main-button{font-size:21px}}
`;

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
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      </head>
      <body>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href="/">親のもしもナビ</Link>
            <nav className="navlinks" aria-label="main">
              <Link href="/">はじめる</Link>
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
            <Link href="/start">1人目を登録する</Link>
          </footer>
        </div>
        <PwaRegister />
      </body>
    </html>
  );
}
