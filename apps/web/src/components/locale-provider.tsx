"use client";

import { createContext, useContext } from "react";

import type { SupportedLocale } from "@akyuu/shared-types";

const LocaleContext = createContext<SupportedLocale>("en-US");

export function LocaleProvider(props: {
  locale: SupportedLocale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={props.locale}>{props.children}</LocaleContext.Provider>;
}

export function useLocale(): SupportedLocale {
  return useContext(LocaleContext);
}
