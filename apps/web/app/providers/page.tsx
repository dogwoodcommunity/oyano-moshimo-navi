import type { Metadata } from "next";
import Link from "next/link";
import { ProviderDirectory } from "@/components/ProviderDirectory";
import { getPublicProviderListings } from "@/lib/providerDirectory";
import { providerDirectoryCatalog } from "@/lib/providerDirectoryCatalog";
import styles from "./page.module.css";

// Publication windows are evaluated per request, never frozen into a static build.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "地域の相談先を探す",
  description: "地域と必要なサービスを自分で選び、相談先を探せます。広告掲載と一般の掲載を分けて表示します。"
};

export default function ProvidersPage() {
  const listings = getPublicProviderListings(providerDirectoryCatalog, Date.now());
  return (
    <main className={`container ${styles.page}`}>
      <section className={styles.heading}>
        <p className="pill">地域の相談先</p>
        <h1>必要なときに、<br />相談できる場所を。</h1>
        <p>相談したい地域とサービスを選んでください。手帳やAI相談の内容を、事業者に渡すことはありません。</p>
        <Link href="/crisis" className={styles.urgent}>体調の急変など、急いで確認したい方はこちら</Link>
      </section>
      <aside className={styles.publicOptions} aria-labelledby="public-options-title">
        <h2 id="public-options-title">まずは公的な窓口に相談したい方へ</h2>
        <p>介護や暮らしの困りごとは、自治体の地域包括支援センターや高齢者相談窓口でも相談できます。広告の掲載状況に関係なく利用できます。</p>
        <a href="https://www.j-lis.go.jp/spd/map-search/cms_1069.html" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">自治体の公式サイトを探す（全国自治体マップ検索・別タブ）</a>
      </aside>
      <ProviderDirectory listings={listings} />
      <nav className={styles.backLinks} aria-label="相談先以外のページ">
        <Link href="/home">手帳に戻る</Link>
        <Link href="/guides">役立つ記事を読む</Link>
      </nav>
    </main>
  );
}
