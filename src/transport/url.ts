/**
 * @fileoverview URL helpers for the AUREON HTTP transport.
 */

import { AureonError } from "../errors/base.js";

export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function assertBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new AureonError(
      "baseUrl must be an absolute http(s) URL",
      "VALIDATION_ERROR",
      400,
      { baseUrl }
    );
  }
  return trimmed;
}

export function withQuery(
  path: string,
  query: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}
