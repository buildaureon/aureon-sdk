/**
 * @fileoverview Stable machine-readable error codes for @aureon/sdk.
 */

export type AureonErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "ABORTED";

export const RETRYABLE_CODES: readonly AureonErrorCode[] = [
  "NETWORK_ERROR",
  "TIMEOUT",
  "RATE_LIMITED",
  "SERVER_ERROR",
] as const;

export function isRetryableCode(code: AureonErrorCode): boolean {
  return (RETRYABLE_CODES as readonly string[]).includes(code);
}

export function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "The request failed validation";
    case 401:
      return "Authentication is required";
    case 403:
      return "Access is forbidden for this resource";
    case 404:
      return "The requested resource was not found";
    case 409:
      return "The request conflicts with the current resource state";
    case 429:
      return "Rate limit exceeded";
    default:
      if (status >= 500) return "The server encountered an error";
      return `Unexpected HTTP status ${status}`;
  }
}
