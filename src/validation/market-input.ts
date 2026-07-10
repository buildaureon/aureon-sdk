/**
 * @fileoverview Validation for controlled market event inputs.
 */

import { AureonValidationError } from "../errors/base.js";
import type { ApplyMarketEventInput } from "../types/market.js";
import { normalizeSymbol } from "../types/market.js";

export function normalizeApplyMarketEventInput(
  input: ApplyMarketEventInput
): ApplyMarketEventInput {
  const symbol = normalizeSymbol(input.symbol ?? "");
  if (!symbol) throw new AureonValidationError("symbol is required");
  if (!Number.isFinite(input.priceChangeRatio)) {
    throw new AureonValidationError("priceChangeRatio must be a finite number");
  }
  if (input.priceChangeRatio <= -0.95) {
    throw new AureonValidationError(
      "priceChangeRatio is too extreme for preview runtime"
    );
  }
  return {
    ...input,
    symbol,
    autoRestore: input.autoRestore !== false,
    name: input.name?.trim() || undefined,
    description: input.description?.trim() || undefined,
  };
}
