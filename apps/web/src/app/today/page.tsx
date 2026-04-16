import Link from "next/link";

import { fetchFeedback, fetchLatestDigest, fetchNotifications, fetchPreferenceProfile, fetchWatches } from "../../lib/api";
import { FeedbackActions } from "../../components/feedback-actions";
import { RunPipelineButton } from "../../components/run-pipeline-button";

export default async function TodayPage() {
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
        <p className="muted">GitHub Intel Agent</p>
        <h1>Today</h1>
        <p className="muted">Run the pipeline after adding at least one RepoWatch, TopicWatch, or TrendWatch.</p>
        <div className="feedback-actions">
          <RunPipelineButton
            disabled={!hasRunnableWatch}
            disabledReason={!hasRunnableWatch ? "Create at least one active watch before running the pipeline." : null}
          />
          <RunPipelineButton
            digestType="weekly"
            label="Run Weekly Digest"
            disabled={!hasRunnableWatch}
          />
          <RunPipelineButton
            digestType="monthly"
            label="Run Monthly Digest"
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
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <article className="card">
            <h3>Recommended Items</h3>
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
              <Link href="/ask">Continue with Ask</Link>
            </p>
          </article>

          <article className="card">
            <h3>Recent Feedback</h3>
            <ul>
              {feedback.feedback.length > 0 ? (
                feedback.feedback.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {item.feedbackType} on {item.targetType} · {item.createdAt}
                  </li>
                ))
              ) : (
                <li>No feedback yet.</li>
              )}
            </ul>
          </article>

          <article className="card">
            <h3>Recent Delivery</h3>
            <ul>
              {notifications.notifications.length > 0 ? (
                notifications.notifications.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    {item.channel} to {item.targetAddress} · {item.status}
                  </li>
                ))
              ) : (
                <li>No deliveries yet.</li>
              )}
            </ul>
            <p>
              <Link href="/delivery">Open Delivery</Link>
            </p>
          </article>

          <article className="card">
            <h3>Preference Profile</h3>
            {preferenceProfile.profile ? (
              <>
                <p className="muted">feedback {preferenceProfile.profile.profile.feedbackCount}</p>
                <ul>
                  {topItemTypeWeights.map(([key, value]) => (
                    <li key={key}>
                      item type {key} · {value}
                    </li>
                  ))}
                  {topRepoWeights.map(([key, value]) => (
                    <li key={key}>
                      repo {key} · {value}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">No preference profile yet.</p>
            )}
          </article>

          <article className="card">
            <h3>Rendered Markdown</h3>
            <div className="markdown">{digest.renderedMarkdown}</div>
          </article>
        </section>
      ) : (
        <section className="panel">
          <h2>No digest yet</h2>
          <p className="muted">Create watches, start the worker, then run the pipeline here.</p>
          <p>
            <Link href="/watches">Go to Watches</Link>
          </p>
        </section>
      )}
    </div>
  );
}
