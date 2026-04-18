"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getMessages } from "@akyuu/shared-i18n";

import { useLocale } from "./locale-provider";

export function ObserveNav() {
  const locale = useLocale();
  const pathname = usePathname();
  const messages = getMessages(locale);
  const links = [
    { href: "/watches", label: messages.nav.watches },
    { href: "/topics", label: messages.nav.topics },
    { href: "/trends", label: messages.nav.trends }
  ];

  return (
    <nav className="subnav" aria-label={messages.nav.observe}>
      {links.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`subnav__link${isActive ? " subnav__link--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
