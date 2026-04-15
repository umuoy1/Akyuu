import Link from "next/link";

const links = [
  { href: "/today", label: "Today" },
  { href: "/watches", label: "Watches" },
  { href: "/topics", label: "Topics" },
  { href: "/trends", label: "Trends" },
  { href: "/history", label: "History" },
  { href: "/delivery", label: "Delivery" },
  { href: "/ask", label: "Ask" }
];

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav__brand">Akyuu</div>
      <div className="nav__links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
