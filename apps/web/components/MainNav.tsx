"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  isCrisis?: boolean;
  match: (pathname: string) => boolean;
};

const boardPaths = [
  "/home",
  "/consult",
  "/family",
  "/plans",
  "/emergency-card",
  "/checklists",
  "/install",
  "/support-pack"
];

function matchesAny(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const navItems: NavItem[] = [
  {
    href: "/home",
    label: "手帳",
    match: (pathname) => matchesAny(pathname, boardPaths)
  },
  {
    href: "/guides",
    label: "読む",
    match: (pathname) => pathname === "/guides" || pathname.startsWith("/guides/")
  },
  {
    href: "/crisis",
    label: "急なとき",
    isCrisis: true,
    match: (pathname) => pathname === "/crisis" || pathname.startsWith("/crisis/")
  }
];

export function MainNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="navlinks" aria-label="main">
      {navItems.map((item) => {
        const isActive = item.match(pathname);
        const className = [
          "nav-link",
          item.isCrisis ? "nav-crisis" : "",
          isActive ? "is-active" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={className}
            href={item.href}
            key={item.href}
          >
            <span>{item.label}</span>
            {isActive ? <span className="nav-current-label">表示中</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
