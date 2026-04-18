import { ObserveNav } from "../../components/observe-nav";
import { WatchForm } from "../../components/watch-form";
import { fetchWatches } from "../../lib/api";

import { getRequestSettings } from "../../lib/request-settings";

export default async function WatchesPage() {
  const { messages } = await getRequestSettings();
  const data = await fetchWatches();

  return (
    <div className="grid">
      <ObserveNav />

      <div className="grid grid--two">
        <WatchForm />

        <section className="panel">
          <h2>{messages.watches.currentWatches}</h2>
          <div className="list">
            {data.watches.length > 0 ? (
              data.watches.map((watch) => (
                <article className="card" key={watch.id}>
                  <h3>{watch.name}</h3>
                  <p className="muted">
                    {messages.enums.watchType[watch.type]} · {messages.enums.watchStatus[watch.status]} · {messages.watches.priority(watch.priority)}
                  </p>
                  <pre className="markdown">{JSON.stringify(watch.config, null, 2)}</pre>
                </article>
              ))
            ) : (
              <p className="muted">{messages.watches.noWatches}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
