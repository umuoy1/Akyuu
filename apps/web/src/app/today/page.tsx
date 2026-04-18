import Link from "next/link";

import { formatDateTime } from "@akyuu/shared-i18n";

import { fetchFeedback, fetchLatestDigest, fetchNotifications, fetchPreferenceProfile, fetchWatches } from "../../lib/api";
import { FeedbackActions } from "../../components/feedback-actions";
import { RunPipelineButton } from "../../components/run-pipeline-button";
import { getRequestSettings } from "../../lib/request-settings";

export default async function TodayPage() {
  const { locale, timezone, messages } = await getRequestSettings();
  const [digest, feedback, notifications, preferenceProfile, watches] = await Promise.all([
    fetchLatestDigest(),
    fetchFeedback(),
    fetchNotifications(),
    fetchPreferenceProfile(),
    fetchWatches()
  ]);
  const hasRunnableWatch = watches.watches.some((watch) => watch.status === "active");
  const topItemTypeWeights = preferenceProfile.profile
    ? Object.entries(preferenceProfile.profile.profile.itemTypeWeights)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
    : [];
  const topRepoWeights = preferenceProfile.profile
    ? Object.entries(preferenceProfile.profile.profile.repoWeights)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
    : [];

  return (
    <div className="grid">
      <section className="hero">
        <p className="muted">{messages.today.productLabel}</p>
        <h1>{messages.today.title}</h1>
        <p className="muted">{messages.today.intro}</p>
        <div className="feedback-actions">
          <RunPipelineButton
            disabled={!hasRunnableWatch}
            disabledReason={!hasRunnableWatch ? messages.today.disabledReason : null}
          />
          <RunPipelineButton
            digestType="weekly"
            label={messages.actions.runWeeklyDigest}
            disabled={!hasRunnableWatch}
          />
          <RunPipelineButton
            digestType="monthly"
            label={messages.actions.runMonthlyDigest}
            disabled={!hasRunnableWatch}
          />
        </div>
      </section>

      {digest ? (
        <section className="panel">
          <h2>{digest.title}</h2>
          <p className="muted">{digest.summary}</p>
          <div className="grid grid--two">
            {digest.sections.map((section) => (
              <article className="card" key={section.key}>
                <h3>{section.title}</h3>
                <ul>
                  {section.bullets.map((bullet, index) => (
                    <li key={`${section.key}-${index}`}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <article className="card">
            <h3>{messages.today.recommendedItems}</h3>
            <ul>
              {digest.recommendedItems.map((item) => (
                <li key={item.id}>
                  {item.href ? <a href={item.href}>{item.title}</a> : item.title} · {item.reason}
                  <FeedbackActions
                    targetType="recommended_item"
                    targetId={item.id}
                    metadata={{
                      itemType: item.itemType,
                      href: item.href,
                      title: item.title
                    }}
                  />
                </li>
              ))}
            </ul>
            <p>
              <Link href="/ask">{messages.today.continueWithAsk}</Link>
            </p>
          </article>

          <article className="card">
            <h3>{messages.today.recentFeedback}</h3>
            <ul>
              {feedback.feedback.length > 0 ? (
                feedback.feedback.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {messages.today.feedbackRecord(
                      messages.enums.feedbackType[item.feedbackType],
                      messages.enums.feedbackTargetType[item.targetType],
                      formatDateTime(item.createdAt, locale, {
                        timeZone: timezone
                      })
                    )}
                  </li>
                ))
              ) : (
                <li>{messages.today.noFeedback}</li>
              )}
            </ul>
          </article>

          <article className="card">
            <h3>{messages.today.recentDelivery}</h3>
            <ul>
              {notifications.notifications.length > 0 ? (
                notifications.notifications.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {messages.today.deliveryRecord(
                      messages.enums.notificationChannel[item.channel],
                      item.targetAddress,
                      messages.enums.notificationStatus[item.status]
                    )}
                  </li>
                ))
              ) : (
                <li>{messages.today.noDelivery}</li>
              )}
            </ul>
            <p>
              <Link href="/delivery">{messages.today.openDelivery}</Link>
            </p>
          </article>

          <article className="card">
            <h3>{messages.today.preferenceProfile}</h3>
            {preferenceProfile.profile ? (
              <>
                <p className="muted">{messages.today.feedbackCount(preferenceProfile.profile.profile.feedbackCount)}</p>
                <ul>
                  {topItemTypeWeights.map(([key, value]) => (
                    <li key={key}>
                      {messages.today.itemTypeWeight(
                        messages.enums.itemType[key as keyof typeof messages.enums.itemType] ?? key,
                        value
                      )}
                    </li>
                  ))}
                  {topRepoWeights.map(([key, value]) => (
                    <li key={key}>
                      {messages.today.repoWeight(key, value)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">{messages.today.noPreferenceProfile}</p>
            )}
          </article>

          <article className="card">
            <h3>{messages.today.renderedMarkdown}</h3>
            <div className="markdown">{digest.renderedMarkdown}</div>
          </article>
        </section>
      ) : (
        <section className="panel">
          <h2>{messages.today.noDigest}</h2>
          <p className="muted">{messages.today.noDigestHint}</p>
          <p>
            <Link href="/watches">{messages.today.goToWatches}</Link>
          </p>
        </section>
      )}
    </div>
  );
}
