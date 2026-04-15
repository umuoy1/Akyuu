import { AskForm } from "../../components/ask-form";
import { fetchAskSessions } from "../../lib/api";

export default async function AskPage() {
  const data = await fetchAskSessions();

  return (
    <div className="grid grid--two">
      <AskForm />

      <section className="panel">
        <h1>Ask History</h1>
        <div className="list">
          {data.sessions.length > 0 ? (
            data.sessions.map((session) => (
              <article className="card" key={session.sessionId}>
                <h2>{session.question}</h2>
                <p className="muted">
                  {session.anchorType} · {session.createdAt}
                </p>
                <div className="markdown">{session.answerMarkdown}</div>
              </article>
            ))
          ) : (
            <p className="muted">No follow-up questions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
