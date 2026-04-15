import crypto from "node:crypto";

export function hashPayload(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildSourceKey(sourceType: string, rawKey: string): string {
  return `${sourceType}:${rawKey}`;
}
