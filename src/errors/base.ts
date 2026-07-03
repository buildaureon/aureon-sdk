/**
 * @fileoverview Base and specialized error classes for the AUREON SDK.
 */

import { isRetryableCode, type AureonErrorCode } from "./codes.js";

export class AureonError extends Error {
  readonly code: AureonErrorCode;
  readonly status: number | null;
  readonly details: Record<string, unknown> | null;

  constructor(
    message: string,
    code: AureonErrorCode,
    status: number | null = null,
    details: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = "AureonError";
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get retryable(): boolean {
    return isRetryableCode(this.code);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export class AureonValidationError extends AureonError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "AureonValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AureonNotFoundError extends AureonError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super(message, "NOT_FOUND", 404, details);
    this.name = "AureonNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AureonConflictError extends AureonError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super(message, "CONFLICT", 409, details);
    this.name = "AureonConflictError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AureonNetworkError extends AureonError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super(message, "NETWORK_ERROR", null, details);
    this.name = "AureonNetworkError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AureonTimeoutError extends AureonError {
  constructor(message = "Request timed out", details: Record<string, unknown> | null = null) {
    super(message, "TIMEOUT", null, details);
    this.name = "AureonTimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
