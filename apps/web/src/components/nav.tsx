import Link from "next/link";

import { getMessages } from "@akyuu/shared-i18n";
import type { SupportedLocale } from "@akyuu/shared-types";

import { LocaleSwitcher } from "./locale-switcher";

export function Nav(props: {
  locale: SupportedLocale;
}) {
  const messages = getMessages(props.locale);
  const links = [
    { href: "/today", label: messages.nav.today },
    { href: "/observe", label: messages.nav.observe },
    { href: "/history", label: messages.nav.history },
    { href: "/delivery", label: messages.nav.delivery },
    { href: "/ask", label: messages.nav.ask }
  ];

  return (
    <nav className="nav">
      <div className="nav__brand">{messages.nav.brand}</div>
      <div className="nav__links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
      <LocaleSwitcher currentLocale={props.locale} />
    </nav>
  );
}
