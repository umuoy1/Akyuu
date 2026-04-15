import * as cheerio from "cheerio";

import { getEnv } from "@akyuu/shared-config";
import type { TrendingItem } from "@akyuu/shared-types";

function parseMetric(rawText: string): number | null {
  const digits = rawText.replace(/[^0-9]/g, "");
  if (!digits) {
    return null;
  }

  return Number.parseInt(digits, 10);
}

export async function fetchTrendingHtml(scope: string): Promise<string> {
  const env = getEnv();
  const suffix = scope === "global" ? "" : `/${scope}`;
  const response = await fetch(`${env.GITHUB_TRENDING_URL}${suffix}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch trending page: ${response.status}`);
  }

  return response.text();
}

export function parseTrendingHtml(html: string): TrendingItem[] {
  const $ = cheerio.load(html);
  const items: TrendingItem[] = [];

  $("article.Box-row").each((index, element) => {
    const repoHref = $(element).find("h2 a").attr("href");
    const repoFullName = repoHref?.replace(/^\//, "").replace(/\s+/g, "");

    if (!repoFullName) {
      return;
    }

    const description = $(element).find("p").text().trim() || null;
    const language = $(element).find('[itemprop="programmingLanguage"]').text().trim() || null;
    const starsTodayText = $(element).find("span.d-inline-block.float-sm-right").text().trim();

    items.push({
      rank: index + 1,
      repoFullName,
      description,
      language,
      starsToday: parseMetric(starsTodayText)
    });
  });

  return items;
}
