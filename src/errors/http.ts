/**
 * @fileoverview Maps HTTP responses into typed AureonError instances.
 */

import {
  AureonConflictError,
  AureonError,
  AureonNotFoundError,
  AureonValidationError,
} from "./base.js";
import { defaultMessageForStatus } from "./codes.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;
  if (isRecord(body.error) && typeof body.error.message === "string") {
    return body.error.message;
  }
  return null;
}

export function errorFromHttpStatus(status: number, body: unknown): AureonError {
  const message = extractMessage(body) ?? defaultMessageForStatus(status);
  const details = isRecord(body) ? body : { body };

  if (status === 400) return new AureonValidationError(message, details);
  if (status === 404) return new AureonNotFoundError(message, details);
  if (status === 409) return new AureonConflictError(message, details);
  if (status === 401 || status === 403) {
    return new AureonError(message, "UNAUTHORIZED", status, details);
  }
  if (status === 429) {
    return new AureonError(message, "RATE_LIMITED", status, details);
  }
  if (status >= 500) {
    return new AureonError(message, "SERVER_ERROR", status, details);
  }
  return new AureonError(message, "UNEXPECTED_RESPONSE", status, details);
}

export function isAureonError(value: unknown): value is AureonError {
  return value instanceof AureonError;
}
