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

const deleteRequestItem = { href: "/admin/delete-requests", label: "削除依頼" };
const deleteRequestSetupItem = { href: "/admin/delete-requests/setup", label: "本人確認設定" };

export function AdminNav() {
  const pathname = usePathname();
  const deletionSetup = pathname === deleteRequestSetupItem.href;
  const deletionOnly = pathname.startsWith(deleteRequestItem.href);
  const visibleItems = deletionSetup
    ? [deleteRequestSetupItem]
    : deletionOnly
      ? [deleteRequestItem]
      : items;
  const brandHref = deletionSetup ? deleteRequestSetupItem.href : deletionOnly ? deleteRequestItem.href : "/admin";

  return (
    <header className="admin-site-header">
      <div className="admin-site-header-inner">
        <Link className="admin-site-brand" href={brandHref}>
          <span aria-hidden="true">運営</span>
          <strong>親のもしもナビ 管理画面</strong>
        </Link>
        <nav className="admin-site-nav" aria-label="管理画面のメニュー">
          {visibleItems.map((item) => {
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
