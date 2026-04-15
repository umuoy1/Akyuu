import type { ReactNode } from "react";

import { Nav } from "../components/nav";

import "./globals.css";

export const metadata = {
  title: "Akyuu",
  description: "GitHub intelligence agent"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
