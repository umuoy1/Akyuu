import Link from "next/link";

import { fetchNotifications } from "../../lib/api";

export default async function DeliveryPage() {
  const data = await fetchNotifications();

  return (
    <section className="panel">
      <h1>Delivery</h1>
      <div className="list">
        {data.notifications.length > 0 ? (
          data.notifications.map((notification) => (
            <article className="card" key={notification.id}>
              <h2>{notification.contentTitle ?? "Digest Delivery"}</h2>
              <p className="muted">
                {notification.channel} · {notification.targetAddress} · {notification.status}
              </p>
              <p className="muted">
                attempts {notification.attemptCount} · created {notification.createdAt}
              </p>
              <p>
                <Link href={`/history/${notification.contentRefId}`}>Open Digest</Link>
              </p>
            </article>
          ))
        ) : (
          <p className="muted">No delivery records yet.</p>
        )}
      </div>
    </section>
  );
}
