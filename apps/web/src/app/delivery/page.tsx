import Link from "next/link";

import { formatDateTime } from "@akyuu/shared-i18n";

import { fetchNotifications } from "../../lib/api";
import { getRequestSettings } from "../../lib/request-settings";

export default async function DeliveryPage() {
  const { locale, timezone, messages } = await getRequestSettings();
  const data = await fetchNotifications();

  return (
    <section className="panel">
      <h1>{messages.delivery.title}</h1>
      <div className="list">
        {data.notifications.length > 0 ? (
          data.notifications.map((notification) => (
            <article className="card" key={notification.id}>
              <h2>{notification.contentTitle ?? messages.delivery.fallbackDigestTitle}</h2>
              <p className="muted">
                {messages.delivery.deliveryMeta(
                  messages.enums.notificationChannel[notification.channel],
                  notification.targetAddress,
                  messages.enums.notificationStatus[notification.status]
                )}
              </p>
              <p className="muted">
                {messages.delivery.deliveryAttempts(
                  notification.attemptCount,
                  formatDateTime(notification.createdAt, locale, {
                    timeZone: timezone
                  })
                )}
              </p>
              <p>
                <Link href={`/history/${notification.contentRefId}`}>{messages.common.openDigest}</Link>
              </p>
            </article>
          ))
        ) : (
          <p className="muted">{messages.delivery.noDeliveryRecords}</p>
        )}
      </div>
    </section>
  );
}
