/**
 * @fileoverview Phase 2 ObjectiveRegistry types.
 */

export type RegistryStatus = {
  enabled: boolean;
  chainId: number;
  contractAddress: string | null;
  explorerBase: string;
  network: string;
};

export type RegistryRef = {
  objectiveKey: string;
  contractAddress: string;
};

export type ObjectiveRegistryRecord = {
  objectiveId: string;
  objectiveKey: string;
  configHash: string;
  owner: string;
  status: "active" | "paused" | "cancelled";
  chainId: number;
  contractAddress: string;
  transactionHash: string;
  blockNumber: number | null;
  registeredAt: string;
  updatedAt: string;
  explorerUrl: string;
  verifiedOnChain: boolean;
};

export type PrepareRegistryResult = {
  chainId: number;
  contractAddress: string;
  explorerBase: string;
  objectiveId: string;
  objectiveKey: string;
  configHash: string;
  to: string;
  data: string;
  value: "0";
  functionName: "registerObjective";
};

export type ObjectiveRegistryLookup =
  | { registered: false; objectiveId: string }
  | { registered: true; record: ObjectiveRegistryRecord };
