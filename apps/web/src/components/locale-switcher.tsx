"use client";

import { useState, useTransition } from "react";

import { getMessages } from "@akyuu/shared-i18n";
import type { SupportedLocale } from "@akyuu/shared-types";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";
import { useLocale } from "./locale-provider";

export function LocaleSwitcher(props: {
  currentLocale: SupportedLocale;
}) {
  const locale = useLocale();
  const messages = getMessages(locale);
  const [value, setValue] = useState<SupportedLocale>(props.currentLocale);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="nav__controls">
      <label className="nav__locale">
        <span className="sr-only">{messages.locale.label}</span>
        <select
          aria-label={messages.locale.label}
          disabled={isPending}
          value={value}
          onChange={(event) => {
            const nextLocale = event.target.value as SupportedLocale;
            setValue(nextLocale);

            startTransition(async () => {
              setError(null);
              try {
                const response = await fetch(`${getClientApiBaseUrl()}/api/v1/settings`, {
                  method: "PATCH",
                  headers: {
                    "content-type": "application/json"
                  },
                  body: JSON.stringify({
                    locale: nextLocale
                  })
                });

                if (!response.ok) {
                  setError(await readResponseError(response, messages.locale.updateFailed));
                  return;
                }

                window.location.reload();
              } catch {
                setError(messages.locale.updateFailed);
                setValue(props.currentLocale);
              }
            });
          }}
        >
          {Object.entries(messages.locale.options).map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {isPending ? <p className="status status--info">{messages.locale.updating}</p> : null}
      {error ? <p className="status status--error">{error}</p> : null}
    </div>
  );
}
