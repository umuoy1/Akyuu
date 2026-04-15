import Link from "next/link";

import { fetchDigests } from "../../lib/api";
import { FeedbackActions } from "../../components/feedback-actions";

type HistoryPageProps = {
  searchParams: Promise<{
    q?: string;
    digestType?: string;
  }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
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
      <h1>History</h1>
      <form className="form form--inline" method="get">
        <label>
          Search
          <input defaultValue={q} name="q" placeholder="Digest title or summary" />
        </label>
        <label>
          Type
          <select defaultValue={digestType} name="digestType">
            <option value="">All</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>
      <div className="list">
        {data.digests.length > 0 ? (
          data.digests.map((digest) => (
            <article className="card" key={digest.id}>
              <h2>{digest.title}</h2>
              <p className="muted">
                {digest.digestType} ·{" "}
                {digest.windowStart} - {digest.windowEnd}
              </p>
              <p>{digest.summary}</p>
              <FeedbackActions targetType="digest" targetId={digest.id} />
              <Link href={`/history/${digest.id}`}>Open Digest</Link>
            </article>
          ))
        ) : (
          <p className="muted">No history yet.</p>
        )}
      </div>
    </section>
  );
}
