/**
 * @fileoverview Formatting exports.
 */

export {
  formatIsoTime,
  formatSignedPercent,
  formatUsd,
  formatWeight,
  healthTone,
} from "./display.js";

export {
  buildAllocationComparison,
  detectPlanParadox,
  type AllocationComparisonRow,
  type PlanParadoxResult,
} from "./allocation.js";
