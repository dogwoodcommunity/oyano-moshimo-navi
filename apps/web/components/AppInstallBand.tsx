import Link from "next/link";
import { getAppLinks } from "@/lib/appLinks";

/**
 * 記録を続ける場所はアプリ。Web側は、そこへ渡すところまでを担当する。
 */
export function AppInstallBand({ reason }: { reason: string }) {
  const links = getAppLinks();

  return (
    <section className="app-band">
      <div className="app-band-mark" aria-hidden="true">
        <img src="/brand/watch-bird-mark.svg" alt="" />
      </div>
      <div className="app-band-body">
        <p className="app-band-kicker">続けて使うなら</p>
        <h2>記録を残していくのはアプリです</h2>
        <p>{reason}</p>
        {links.available ? (
          <div className="app-band-actions">
            {links.ios ? <a className="button" href={links.ios}>iPhoneで入れる</a> : null}
            {links.android ? <a className="secondary" href={links.android}>Androidで入れる</a> : null}
          </div>
        ) : (
          <p className="app-band-note">
            アプリは準備中です。いまはこの画面のまま使えます。
            <Link href="/home">この端末で記録を始める</Link>
          </p>
        )}
      </div>
    </section>
  );
}
