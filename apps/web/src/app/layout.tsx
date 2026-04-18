import type { ReactNode } from "react";

import { Nav } from "../components/nav";
import { LocaleProvider } from "../components/locale-provider";
import { getRequestSettings } from "../lib/request-settings";

import "./globals.css";

export async function generateMetadata() {
  const { messages } = await getRequestSettings();

  return {
    title: "Akyuu",
    description: messages.metadata.description
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getRequestSettings();

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <div className="app-shell">
            <header className="app-header">
              <Nav locale={locale} />
            </header>
            <main className="app-main">
              <div className="page">{children}</div>
            </main>
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
