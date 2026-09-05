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

export {
  buildObjectivePortfolioFlow,
  parseFinancialIntent,
  resolveObjectiveFromIntent,
  type FinancialIntent,
  type ObjectivePortfolioFlow,
} from "./intent.js";

export {
  buildDriftRestoreFlow,
  buildDriftRestoreFlowFromSnapshot,
  inferDriftPhase,
  type DriftRestoreFlow,
  type DriftRestorePhase,
} from "./drift-restore.js";

export {
  buildReceiptVerificationFlow,
  inferProofTier,
  type ReceiptVerificationFlow,
  type ReceiptVerificationPhase,
  type ReceiptProofTier,
} from "./receipt-verification.js";

export {
  buildPortfolioWatchFlow,
  buildPortfolioWatchFlowFromSnapshot,
  buildPortfolioWatchBriefingLines,
  inferPortfolioWatchPhase,
  DEFAULT_PORTFOLIO_WATCH_BRIEF,
  type AgentHost,
  type PortfolioWatchFlow,
  type PortfolioWatchPhase,
} from "./portfolio-watch.js";

export {
  buildFullAureonLoopFlow,
  buildFullAureonLoopFlowFromSnapshot,
  inferFullAureonLoopPhase,
  DEFAULT_FULL_LOOP_BRIEF,
  type FullAureonLoopFlow,
  type FullAureonLoopPhase,
} from "./full-aureon-loop.js";

export {
  buildFinancialAuditTrail,
  formatAuditTrailLines,
  type AuditTrailGap,
  type AuditTrailGapCode,
  type AuditTrailReceiptRow,
  type FinancialAuditTrail,
} from "./audit-trail.js";
