import { formatDateTime } from "@akyuu/shared-i18n";

import { AskForm } from "../../components/ask-form";
import { fetchAskSessions } from "../../lib/api";
import { getRequestSettings } from "../../lib/request-settings";

export default async function AskPage() {
  const { locale, timezone, messages } = await getRequestSettings();
  const data = await fetchAskSessions();

  return (
    <div className="grid grid--two">
      <AskForm />

      <section className="panel">
        <h1>{messages.ask.historyTitle}</h1>
        <div className="list">
          {data.sessions.length > 0 ? (
            data.sessions.map((session) => (
              <article className="card" key={session.sessionId}>
                <h2>{session.question}</h2>
                <p className="muted">
                  {messages.enums.askAnchorType[session.anchorType]} ·{" "}
                  {formatDateTime(session.createdAt, locale, {
                    timeZone: timezone
                  })}
                </p>
                <div className="markdown">{session.answerMarkdown}</div>
              </article>
            ))
          ) : (
            <p className="muted">{messages.ask.noHistory}</p>
          )}
        </div>
      </section>
    </div>
  );
}
