export async function readResponseError(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | {
          message?: unknown;
          error?: unknown;
        }
      | null;

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }

  const text = await response.text().catch(() => "");
  return text.trim() || fallback;
}

export function getClientApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configured && configured !== "undefined") {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return "http://localhost:3001";
}
