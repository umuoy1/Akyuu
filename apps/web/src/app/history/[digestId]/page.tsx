import { notFound } from "next/navigation";

import { fetchDigestById } from "../../../lib/api";

type DigestDetailPageProps = {
  params: Promise<{
    digestId: string;
  }>;
};

export default async function DigestDetailPage({ params }: DigestDetailPageProps) {
  const { digestId } = await params;
  const digest = await fetchDigestById(digestId);

  if (!digest) {
    notFound();
  }

  return (
    <section className="grid">
      <div className="hero">
        <p className="muted">{digest.digestType}</p>
        <h1>{digest.title}</h1>
        <p className="muted">
          {digest.windowStart} - {digest.windowEnd}
        </p>
      </div>

      <article className="panel">
        <p>{digest.summary}</p>
        <div className="grid grid--two">
          {digest.sections.map((section) => (
            <article className="card" key={section.key}>
              <h2>{section.title}</h2>
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
