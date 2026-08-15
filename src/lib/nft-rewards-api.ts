import type {
  AdminNftRewardCollection,
  AdminNftRewardPayout,
  AdminNftRewardRun,
  AdminNftRewardRunDetail,
  AdminNftRewardSummary,
  NftRewardPayoutState,
  Paginated,
} from './nft-rewards';

function getApiBaseUrl(): string {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '');
  const direct = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (backend) return `${backend}/api`;
  if (direct) return direct;
  throw new Error('NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_URL is required');
}

async function rewardRequest<T>(path: string, adminKey: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: { 'x-admin-key': adminKey },
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload === 'object' &&
      typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (payload === null || typeof payload !== 'object') {
    throw new Error('Invalid NFT reward API response');
  }
  if (JSON.stringify(payload).includes('signedRawTransaction')) {
    throw new Error('Unsafe NFT reward API response');
  }

  return payload as T;
}

function queryString(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && String(value).trim() !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fetchNftRewardSummary(adminKey: string): Promise<AdminNftRewardSummary> {
  return rewardRequest('/admin/nft-rewards/summary', adminKey);
}

export function fetchNftRewardCollections(adminKey: string): Promise<AdminNftRewardCollection[]> {
  return rewardRequest('/admin/nft-rewards/collections', adminKey);
}

export function fetchNftRewardRuns(input: {
  adminKey: string;
  page: number;
  limit: number;
}): Promise<Paginated<AdminNftRewardRun>> {
  return rewardRequest(
    `/admin/nft-rewards/runs${queryString({ page: input.page, limit: input.limit })}`,
    input.adminKey,
  );
}

export function fetchNftRewardRunDetail(input: {
  adminKey: string;
  runId: string;
  page: number;
  limit: number;
}): Promise<AdminNftRewardRunDetail> {
  return rewardRequest(
    `/admin/nft-rewards/runs/${encodeURIComponent(input.runId)}${queryString({ page: input.page, limit: input.limit })}`,
    input.adminKey,
  );
}

export function fetchNftRewardPayouts(input: {
  adminKey: string;
  page: number;
  limit: number;
  rewardDate?: string;
  state?: NftRewardPayoutState;
  walletAddress?: string;
  txHash?: string;
}): Promise<Paginated<AdminNftRewardPayout>> {
  return rewardRequest(
    `/admin/nft-rewards/payouts${queryString({
      page: input.page,
      limit: input.limit,
      rewardDate: input.rewardDate,
      state: input.state,
      walletAddress: input.walletAddress,
      txHash: input.txHash,
    })}`,
    input.adminKey,
  );
}
