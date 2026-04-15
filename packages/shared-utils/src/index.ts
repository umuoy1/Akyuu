import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { DigestSectionSummary } from "@akyuu/shared-types";

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function formatDateForTimezone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export function getDayWindow(dateLabel: string, timeZone: string): {
  start: Date;
  end: Date;
} {
  const start = fromZonedTime(`${dateLabel}T00:00:00`, timeZone);
  const nextDay = formatInTimeZone(new Date(start.getTime() + 24 * 60 * 60 * 1000), timeZone, "yyyy-MM-dd");
  const end = fromZonedTime(`${nextDay}T00:00:00`, timeZone);

  return {
    start,
    end
  };
}

export function getWeekWindow(dateLabel: string, timeZone: string): {
  start: Date;
  end: Date;
} {
  const anchor = fromZonedTime(`${dateLabel}T00:00:00`, timeZone);
  const isoWeekday = Number(formatInTimeZone(anchor, timeZone, "i"));
  const startDateLabel = formatInTimeZone(
    new Date(anchor.getTime() - (isoWeekday - 1) * 24 * 60 * 60 * 1000),
    timeZone,
    "yyyy-MM-dd"
  );
  const endDateLabel = formatInTimeZone(
    new Date(anchor.getTime() + (8 - isoWeekday) * 24 * 60 * 60 * 1000),
    timeZone,
    "yyyy-MM-dd"
  );

  return {
    start: fromZonedTime(`${startDateLabel}T00:00:00`, timeZone),
    end: fromZonedTime(`${endDateLabel}T00:00:00`, timeZone)
  };
}

export function getMonthWindow(dateLabel: string, timeZone: string): {
  start: Date;
  end: Date;
} {
  const anchor = fromZonedTime(`${dateLabel}T00:00:00`, timeZone);
  const year = Number(formatInTimeZone(anchor, timeZone, "yyyy"));
  const month = Number(formatInTimeZone(anchor, timeZone, "MM"));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const startDateLabel = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const endDateLabel = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;

  return {
    start: fromZonedTime(`${startDateLabel}T00:00:00`, timeZone),
    end: fromZonedTime(`${endDateLabel}T00:00:00`, timeZone)
  };
}

export function buildMarkdownFromSections(
  title: string,
  summary: string,
  sections: DigestSectionSummary[]
): string {
  const parts = [`# ${title}`, "", summary];

  for (const section of sections) {
    parts.push("", `## ${section.title}`, "", ...section.bullets.map((bullet: string) => `- ${bullet}`));
  }

  return parts.join("\n");
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
