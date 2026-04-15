import { fetchTopics } from "../../lib/api";

export default async function TopicsPage() {
  const data = await fetchTopics();

  return (
    <section className="grid">
      <div className="hero">
        <p className="muted">TopicWatch</p>
        <h1>Topics</h1>
        <p className="muted">Rules aggregate cross-repo signals into topic-level summaries.</p>
      </div>

      <div className="grid grid--two">
        {data.topics.length > 0 ? (
          data.topics.map((topic) => (
            <article className="panel" key={topic.id}>
              <h2>{topic.name}</h2>
              <p className="muted">{topic.description ?? "No description."}</p>
              <p className="muted">
                {topic.repoBindings.length} repo bindings · {topic.evidenceCount} evidences
              </p>
              <div className="list">
                {topic.recentUpdates.length > 0 ? (
                  topic.recentUpdates.map((update) => (
                    <div className="card" key={update.id}>
                      <strong>{update.summary}</strong>
                      <ul>
                        {update.highlights.map((highlight) => (
                          <li key={highlight}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="muted">No topic updates yet. Run the pipeline after adding repo bindings.</p>
                )}
              </div>
            </article>
          ))
        ) : (
          <section className="panel">
            <h2>No topics yet</h2>
            <p className="muted">Create a TopicWatch from Watches to start aggregating cross-repo signals.</p>
          </section>
        )}
      </div>
    </section>
  );
}
