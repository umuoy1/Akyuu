import { ObserveNav } from "../../components/observe-nav";
import { fetchTrends } from "../../lib/api";

import { getRequestSettings } from "../../lib/request-settings";

export default async function TrendsPage() {
  const { messages } = await getRequestSettings();
  const data = await fetchTrends();

  return (
    <section className="grid">
      <ObserveNav />

      <div className="hero">
        <p className="muted">{messages.trends.productLabel}</p>
        <h1>{messages.trends.title}</h1>
        <p className="muted">{messages.trends.intro}</p>
      </div>

      <div className="list">
        {data.trends.length > 0 ? (
          data.trends.map((trend) => (
            <article className="panel" key={trend.id}>
              <h2>
                {trend.source} · {trend.scope}
              </h2>
              <p className="muted">
                {messages.trends.compare(trend.snapshotDate, trend.comparedToDate)}
              </p>

              <div className="grid grid--two">
                <div className="card">
                  <h3>{messages.trends.highlights}</h3>
                  <ul>
                    {trend.highlights.length > 0 ? (
                      trend.highlights.map((highlight, index) => <li key={`${trend.id}-highlight-${index}`}>{highlight}</li>)
                    ) : (
                      <li>{messages.trends.noStructuralDiff}</li>
                    )}
                  </ul>
                </div>

                <div className="card">
                  <h3>{messages.trends.topSnapshotItems}</h3>
                  <ul>
                    {trend.items.slice(0, 5).map((item) => (
                      <li key={item.repoFullName}>
                        #{item.rank} {item.repoFullName}
                        {item.language ? ` · ${item.language}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))
        ) : (
          <section className="panel">
            <h2>{messages.trends.noTrendDiff}</h2>
            <p className="muted">{messages.trends.noTrendDiffHint}</p>
          </section>
        )}
      </div>
    </section>
  );
}
