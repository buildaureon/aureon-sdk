/**
 * @fileoverview Lightweight Result helpers for advanced integrators.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await promise);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}
