import { fetchTrends } from "../../lib/api";

export default async function TrendsPage() {
  const data = await fetchTrends();

  return (
    <section className="grid">
      <div className="hero">
        <p className="muted">Trend Intelligence</p>
        <h1>Trends</h1>
        <p className="muted">Daily diff for trending snapshots with highlights, rank movement, and top repos.</p>
      </div>

      <div className="list">
        {data.trends.length > 0 ? (
          data.trends.map((trend) => (
            <article className="panel" key={trend.id}>
              <h2>
                {trend.source} · {trend.scope}
              </h2>
              <p className="muted">
                {trend.snapshotDate} vs {trend.comparedToDate}
              </p>

              <div className="grid grid--two">
                <div className="card">
                  <h3>Highlights</h3>
                  <ul>
                    {trend.highlights.length > 0 ? (
                      trend.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)
                    ) : (
                      <li>No structural diff yet.</li>
                    )}
                  </ul>
                </div>

                <div className="card">
                  <h3>Top Snapshot Items</h3>
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
            <h2>No trend diff yet</h2>
            <p className="muted">Create a TrendWatch and run the pipeline to populate trend snapshots.</p>
          </section>
        )}
      </div>
    </section>
  );
}
