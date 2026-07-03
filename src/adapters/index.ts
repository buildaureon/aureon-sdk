/**
 * @fileoverview Adapter exports.
 */

export {
  mergeHeaders,
  resolveFetch,
  userAgentHeader,
  type FetchLike,
} from "./fetch-adapter.js";
export {
  createConsoleLogger,
  silentLogger,
  type AureonLogger,
  type LogLevel,
} from "./logging-adapter.js";
