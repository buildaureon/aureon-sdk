/**
 * @fileoverview Display helpers shared by utility apps and CLI output.
 */

import type { HealthState } from "../types/health.js";

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatWeight(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

export function healthTone(
  state: HealthState
): "positive" | "caution" | "critical" | "neutral" {
  switch (state) {
    case "healthy":
      return "positive";
    case "warning":
      return "caution";
    case "violation":
      return "critical";
    case "paused":
      return "neutral";
    default:
      return "neutral";
  }
}

export function formatSignedPercent(ratio: number): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatIsoTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
