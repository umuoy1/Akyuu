import { notFound } from "next/navigation";

import { formatDate } from "@akyuu/shared-i18n";

import { fetchDigestById } from "../../../lib/api";
import { getRequestSettings } from "../../../lib/request-settings";

type DigestDetailPageProps = {
  params: Promise<{
    digestId: string;
  }>;
};

export default async function DigestDetailPage({ params }: DigestDetailPageProps) {
  const { locale, timezone, messages } = await getRequestSettings();
  const { digestId } = await params;
  const digest = await fetchDigestById(digestId);

  if (!digest) {
    notFound();
  }

  return (
    <section className="grid">
      <div className="hero">
        <p className="muted">{messages.enums.digestType[digest.digestType]}</p>
        <h1>{digest.title}</h1>
        <p className="muted">
          {formatDate(digest.windowStart, locale, { timeZone: timezone })} -{" "}
          {formatDate(digest.windowEnd, locale, { timeZone: timezone })}
        </p>
      </div>

      <article className="panel">
        <p>{digest.summary}</p>
        <div className="grid grid--two">
          {digest.sections.map((section) => (
            <article className="card" key={section.key}>
              <h2>{section.title}</h2>
              <ul>
                {section.bullets.map((bullet, index) => (
                  <li key={`${section.key}-${index}`}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
