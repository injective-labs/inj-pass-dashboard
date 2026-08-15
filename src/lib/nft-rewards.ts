export type NftRewardRunStatus =
  | 'SCANNING'
  | 'FAILED_RETRYABLE'
  | 'READY_FOR_PAYOUT'
  | 'PARTIALLY_PAID'
  | 'PAID';

export type NftRewardPayoutState =
  | 'PENDING'
  | 'RESERVED'
  | 'SIGNED'
  | 'BROADCAST_UNKNOWN'
  | 'BROADCAST'
  | 'CONFIRMED'
  | 'RETRY_WAIT';

export type AdminNftRewardWorker = {
  timestamp: number;
  instanceId: string;
  healthy: boolean;
  leader: boolean;
  enabled: boolean;
  dryRun: boolean;
  rewardAddress: string | null;
  rewardBalanceWei: string;
  lastRunId: string | null;
  lastRewardDate: string | null;
  oldestPendingRewardDate: string | null;
  lastTransactionHash: string | null;
  criticalErrorCode: string | null;
};

export type AdminNftRewardSummary = {
  worker: AdminNftRewardWorker | null;
  heartbeatStale: boolean;
  rewardAddress: string | null;
  rewardBalanceWei: string;
  today: {
    rewardDate: string;
    runId: string | null;
    status: NftRewardRunStatus | null;
    snapshotStartedAt: string | null;
    lateSnapshot: boolean;
    evmBlockNumber: string | null;
    evmBlockHash: string | null;
    cosmosHeight: string | null;
    registeredWalletCount: number;
    observationCount: number;
    ownedObservationCount: number;
    entitlementCount: number;
    payoutCount: number;
    totalLiabilityWei: string;
  };
  budget: {
    sendDate: string;
    capWei: string;
    reservedWei: string;
    confirmedWei: string;
  };
  backlog: {
    pendingWei: string;
    oldestRewardDate: string | null;
    rewardDateCount: number;
  };
};

export type AdminNftRewardCollection = {
  key: string;
  displayName: string;
  vmType: 'EVM' | 'CW721';
  contractAddress: string;
  enabled: boolean;
  rewardWei: string;
  displayOrder: number;
};

export type NftRewardPreviewStatus =
  | 'RUNNING'
  | 'COMPLETE'
  | 'PARTIAL'
  | 'FAILED';

export type AdminNftRewardPreview = {
  id: string;
  status: NftRewardPreviewStatus;
  startedAt: string;
  completedAt: string | null;
  evmBlockNumber: string | null;
  evmBlockHash: string | null;
  cosmosHeight: string | null;
  registeredWalletCount: number;
  validWalletCount: number;
  invalidWalletCount: number;
  observationCount: number;
  ownedObservationCount: number;
  errorObservationCount: number;
  eligibleWalletCount: number;
  projectedLiabilityWei: string;
  dailyCapWei: string;
  exceedsDailyCap: boolean;
  collectionStats: Array<{
    key: string;
    displayName: string;
    vmType: 'EVM' | 'CW721';
    rewardWei: string;
    ownedWalletCount: number;
    errorCount: number;
  }>;
  lastErrorCode: string | null;
};

export type AdminNftRewardRun = AdminNftRewardSummary['today'] & {
  id: string;
  createdAt: string;
  completedAt: string | null;
  lastErrorCode: string | null;
};

export type AdminNftRewardPayout = {
  id: string;
  runId: string;
  rewardDate: string;
  walletAddress: string;
  amountWei: string;
  state: NftRewardPayoutState;
  sendDate: string | null;
  nonce: string | null;
  txHash: string | null;
  blockNumber: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  explorerUrl: string | null;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type AdminNftRewardObservation = {
  id: string;
  walletAddress: string;
  collectionKey: string;
  status: 'OWNED' | 'NOT_OWNED' | 'RETRYABLE_ERROR';
  attemptCount: number;
  lastErrorCode: string | null;
  checkedAt: string | null;
};

export type AdminNftRewardEntitlement = {
  id: string;
  rewardDate: string;
  walletAddress: string;
  collectionKey: string;
  rewardWei: string;
  createdAt: string;
};

export type AdminNftRewardRunDetail = {
  run: AdminNftRewardRun;
  collections: AdminNftRewardCollection[];
  observations: Paginated<AdminNftRewardObservation>;
  entitlements: Paginated<AdminNftRewardEntitlement>;
  payouts: Paginated<AdminNftRewardPayout>;
};

export type NftRewardWorkerState = 'CRITICAL' | 'STALE' | 'DISABLED' | 'DRY_RUN' | 'HEALTHY';

export function formatInjWei(value: string, maximumFractionDigits = 18): string {
  const wei = BigInt(value || '0');
  const zero = BigInt(0);
  const base = BigInt(10) ** BigInt(18);
  const sign = wei < zero ? '-' : '';
  const absolute = wei < zero ? -wei : wei;
  const whole = absolute / base;
  const digits = Math.max(0, Math.min(18, maximumFractionDigits));
  const fraction = (absolute % base)
    .toString()
    .padStart(18, '0')
    .slice(0, digits)
    .replace(/0+$/, '');

  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function formatUtc(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

export function getWorkerState(input: {
  worker: Pick<AdminNftRewardWorker, 'enabled' | 'criticalErrorCode'> & {
    dryRun?: boolean;
  } | null;
  heartbeatStale: boolean;
}): NftRewardWorkerState {
  if (input.worker?.criticalErrorCode) return 'CRITICAL';
  if (input.heartbeatStale) return 'STALE';
  if (!input.worker || !input.worker.enabled) return 'DISABLED';
  if (input.worker.dryRun) return 'DRY_RUN';
  return 'HEALTHY';
}

export function getBudgetPercent(budget: {
  capWei: string;
  reservedWei: string;
  confirmedWei: string;
}): number {
  const cap = BigInt(budget.capWei || '0');
  const zero = BigInt(0);
  if (cap <= zero) return 0;
  const used = BigInt(budget.reservedWei || '0') + BigInt(budget.confirmedWei || '0');
  return Math.min(100, Number((used * BigInt(10_000)) / cap) / 100);
}

export function getBlockscoutTxUrl(hash: string | null): string | null {
  return hash && /^0x[0-9a-fA-F]{64}$/.test(hash)
    ? `https://blockscout.injective.network/tx/${hash}`
    : null;
}
