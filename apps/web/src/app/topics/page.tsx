import { ObserveNav } from "../../components/observe-nav";
import { fetchTopics } from "../../lib/api";

import { getRequestSettings } from "../../lib/request-settings";

export default async function TopicsPage() {
  const { messages } = await getRequestSettings();
  const data = await fetchTopics();

  return (
    <section className="grid">
      <ObserveNav />

      <div className="hero">
        <p className="muted">{messages.topics.productLabel}</p>
        <h1>{messages.topics.title}</h1>
        <p className="muted">{messages.topics.intro}</p>
      </div>

      <div className="grid grid--two">
        {data.topics.length > 0 ? (
          data.topics.map((topic) => (
            <article className="panel" key={topic.id}>
              <h2>{topic.name}</h2>
              <p className="muted">{topic.description ?? messages.common.noDescription}</p>
              <p className="muted">
                {messages.topics.repoBindingsAndEvidences(topic.repoBindings.length, topic.evidenceCount)}
              </p>
              <div className="list">
                {topic.recentUpdates.length > 0 ? (
                  topic.recentUpdates.map((update) => (
                    <div className="card" key={update.id}>
                      <strong>{update.summary}</strong>
                      <ul>
                        {update.highlights.map((highlight, index) => (
                          <li key={`${update.id}-${index}`}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="muted">{messages.topics.noTopicUpdates}</p>
                )}
              </div>
            </article>
          ))
        ) : (
          <section className="panel">
            <h2>{messages.topics.noTopics}</h2>
            <p className="muted">{messages.topics.noTopicsHint}</p>
          </section>
        )}
      </div>
    </section>
  );
}
