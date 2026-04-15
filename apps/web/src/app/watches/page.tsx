import { WatchForm } from "../../components/watch-form";
import { fetchWatches } from "../../lib/api";

export default async function WatchesPage() {
  const data = await fetchWatches();

  return (
    <div className="grid grid--two">
      <WatchForm />

      <section className="panel">
        <h2>Current Watches</h2>
        <div className="list">
          {data.watches.length > 0 ? (
            data.watches.map((watch) => (
              <article className="card" key={watch.id}>
                <h3>{watch.name}</h3>
                <p className="muted">
                  {watch.type} · priority {watch.priority}
                </p>
                <pre className="markdown">{JSON.stringify(watch.config, null, 2)}</pre>
              </article>
            ))
          ) : (
            <p className="muted">No watches yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
