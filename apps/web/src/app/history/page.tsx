import Link from "next/link";

import { formatDate } from "@akyuu/shared-i18n";

import { fetchDigests } from "../../lib/api";
import { FeedbackActions } from "../../components/feedback-actions";
import { getRequestSettings } from "../../lib/request-settings";

type HistoryPageProps = {
  searchParams: Promise<{
    q?: string;
    digestType?: string;
  }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { locale, timezone, messages } = await getRequestSettings();
  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const digestType =
    resolvedSearchParams.digestType === "daily" ||
    resolvedSearchParams.digestType === "weekly" ||
    resolvedSearchParams.digestType === "monthly"
      ? resolvedSearchParams.digestType
      : "";
  const filters: {
    q?: string;
    digestType?: "daily" | "weekly" | "monthly";
  } = {};

  if (q) {
    filters.q = q;
  }

  if (digestType) {
    filters.digestType = digestType;
  }

  const data = await fetchDigests(filters);

  return (
    <section className="panel">
      <h1>{messages.history.title}</h1>
      <form className="form form--inline" method="get">
        <label>
          {messages.history.search}
          <input defaultValue={q} name="q" placeholder={messages.history.searchPlaceholder} />
        </label>
        <label>
          {messages.history.type}
          <select defaultValue={digestType} name="digestType">
            <option value="">{messages.common.all}</option>
            <option value="daily">{messages.enums.digestType.daily}</option>
            <option value="weekly">{messages.enums.digestType.weekly}</option>
            <option value="monthly">{messages.enums.digestType.monthly}</option>
          </select>
        </label>
        <button type="submit">{messages.common.apply}</button>
      </form>
      <div className="list">
        {data.digests.length > 0 ? (
          data.digests.map((digest) => (
            <article className="card" key={digest.id}>
              <h2>{digest.title}</h2>
              <p className="muted">
                {messages.enums.digestType[digest.digestType]} ·{" "}
                {formatDate(digest.windowStart, locale, { timeZone: timezone })} -{" "}
                {formatDate(digest.windowEnd, locale, { timeZone: timezone })}
              </p>
              <p>{digest.summary}</p>
              <FeedbackActions targetType="digest" targetId={digest.id} />
              <Link href={`/history/${digest.id}`}>{messages.common.openDigest}</Link>
            </article>
          ))
        ) : (
          <p className="muted">{messages.history.noHistory}</p>
        )}
      </div>
    </section>
  );
}
