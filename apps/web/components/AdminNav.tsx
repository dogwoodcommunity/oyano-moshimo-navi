"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "管理トップ" },
  { href: "/admin/monitor-feedback", label: "モニター回答" },
  { href: "/admin/ai-usage", label: "AI利用・原価" },
  { href: "/admin/support-packs", label: "サポート依頼" },
  { href: "/admin/sponsor-applications", label: "スポンサー申請" },
  { href: "/admin/env", label: "本番設定" }
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="admin-site-header">
      <div className="admin-site-header-inner">
        <Link className="admin-site-brand" href="/admin">
          <span aria-hidden="true">運営</span>
          <strong>親のもしもナビ 管理画面</strong>
        </Link>
        <nav className="admin-site-nav" aria-label="管理画面のメニュー">
          {items.map((item) => {
            const active = item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link className={active ? "is-active" : ""} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
