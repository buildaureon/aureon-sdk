/**
 * @fileoverview Portfolio snapshot types used by health evaluation and utility screens.
 */

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  category: "stable" | "stock_token" | "gas" | "other";
  quantity: number;
  markPriceUsd: number;
  notionalUsd: number;
  weight: number;
  updatedAt: string;
}

export interface PortfolioSnapshot {
  portfolioId: string;
  totalNotionalUsd: number;
  stableWeight: number;
  stockTokenWeight: number;
  gasWeight: number;
  positions: PortfolioPosition[];
  asOf: string;
}

/** Input row for replacing the capital book (no id, server assigns). */
export interface PortfolioPositionInput {
  symbol: string;
  name: string;
  category: PortfolioPosition["category"];
  quantity: number;
  markPriceUsd: number;
}

export function findPosition(
  snapshot: PortfolioSnapshot,
  symbol: string
): PortfolioPosition | undefined {
  const target = symbol.trim().toUpperCase();
  return snapshot.positions.find((p) => p.symbol.toUpperCase() === target);
}

export function sumNotionalByCategory(
  snapshot: PortfolioSnapshot,
  category: PortfolioPosition["category"]
): number {
  return snapshot.positions
    .filter((p) => p.category === category)
    .reduce((sum, p) => sum + p.notionalUsd, 0);
}

export function assertPortfolioSnapshot(value: PortfolioSnapshot): void {
  if (!value.portfolioId) throw new Error("portfolioId is required");
  if (!Array.isArray(value.positions)) throw new Error("positions must be an array");
  if (!Number.isFinite(value.totalNotionalUsd)) {
    throw new Error("totalNotionalUsd must be finite");
  }
}
