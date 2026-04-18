import { cache } from "react";

import { getMessages, resolveSupportedLocale } from "@akyuu/shared-i18n";

import { fetchWorkspaceSettings } from "./api";

export const getRequestSettings = cache(async () => {
  const settings = await fetchWorkspaceSettings();
  const locale = resolveSupportedLocale(settings.locale);

  return {
    locale,
    timezone: settings.timezone,
    messages: getMessages(locale)
  };
});
