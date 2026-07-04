/**
 * @fileoverview Mutable bearer token holder for scripts and apps.
 */

/** Mutable bearer token holder for scripts and apps. */
export function createSessionTokenProvider(initialToken?: string | null) {
  let token = initialToken ?? null;
  return {
    getAccessToken: () => token,
    setToken: (next: string | null) => {
      token = next;
    },
    clear: () => {
      token = null;
    },
  };
}

export type SessionTokenProvider = ReturnType<typeof createSessionTokenProvider>;
