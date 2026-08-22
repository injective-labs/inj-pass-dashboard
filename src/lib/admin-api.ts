export type AdminUserRow = {
  id: number;
  credentialId: string;
  inviteCode: string;
  invitedBy: string | null;
  pointsBalance: number;
  chanceRemaining?: number;
  chanceCooldownEndsAt?: number;
  walletAddress: string | null;
  walletName: string | null;
  createdAt: string;
  updatedAt: string;
  aiWalletCount?: number;
  aiRoundCount?: number;
  chancePurchaseCount?: number;
  latestChancePurchaseAt?: string | null;
  aiUsage: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostPoints: number;
    lastUsedAt: string | null;
  };
};

export type AdminUserDetail = {
  user: {
    id: number;
    credentialId: string;
    inviteCode: string;
    invitedBy: string | null;
    pointsBalance: number;
    chanceRemaining?: number;
    chanceCooldownEndsAt?: number;
    walletAddress: string | null;
    walletName: string | null;
    passkeyCounter?: number;
    createdAt: string;
    updatedAt: string;
  };
  aiUsage: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostPoints: number;
    lastUsedAt: string | null;
  };
  aiLogs: Array<{
    id: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costPoints: number;
    conversationId: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: number;
    type: string;
    amount: number;
    balanceAfter: number;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  chancePurchases?: Array<{
    id: number;
    txHash: string;
    productId: string;
    chanceAmount: number;
    status: string;
    createdAt: string;
  }>;
  aiWalletSummary?: {
    walletCount: number;
    totalRounds: number;
  };
};

export type AdminAiWalletRow = {
  sandboxAddress: string;
  sessionCount: number;
  roundCount: number;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
};

export type AdminAiWalletListResponse = {
  userId: number;
  walletAddress: string | null;
  total: number;
  page: number;
  limit: number;
  wallets: AdminAiWalletRow[];
};

export type AdminAiWalletDetailResponse = {
  userId: number;
  wallet: AdminAiWalletRow;
  conversations: {
    total: number;
    page: number;
    limit: number;
    items: Array<{
      conversationId: string;
      title: string | null;
      model: string | null;
      roundCount: number;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  };
  toolSummary: Array<{
    toolId: string;
    count: number;
  }>;
};

export type AdminChancePurchaseListResponse = {
  userId: number;
  total: number;
  page: number;
  limit: number;
  purchases: Array<{
    id: number;
    txHash: string;
    chainId: string | null;
    productId: string;
    chanceAmount: number;
    balanceAfter: number;
    status: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type AdminPasskeyCredentialRow = {
  id: number;
  credentialId: string;
  userId: string | null;
  walletAddress: string | null;
  walletName: string | null;
  counter: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * How the account was registered.
 *
 * `wallet_login` accounts are created by POST /wallet-auth/verify when no user
 * matches the signing address. That path is shared by the batch script
 * (scripts/generate-agent-wallets.ts) AND by real people connecting an external
 * wallet in the app, so this tells you the auth method — NOT whether the
 * account is a bot. Nothing in the schema records that today.
 */
export type AdminAccountType = 'passkey' | 'wallet_login';

export const ACCOUNT_TYPE_LABEL: Record<AdminAccountType, string> = {
  passkey: 'Passkey',
  wallet_login: 'Wallet Login',
};

export function getAccountType(credentialId?: string | null): AdminAccountType {
  return String(credentialId ?? '').startsWith('wallet:')
    ? 'wallet_login'
    : 'passkey';
}

/**
 * Heuristic only. generate-agent-wallets.ts names wallets
 * `${batchLabel}-001` with batchLabel defaulting to `agent-<epoch-ms>`.
 * The label is a CLI argument and a real user could pick the same name, so
 * treat a match as a hint to investigate, never as proof.
 */
const BATCH_WALLET_NAME = /^agent-\d{10,}-\d{3,}$/;

export function looksLikeBatchWallet(walletName?: string | null) {
  return BATCH_WALLET_NAME.test(String(walletName ?? '').trim());
}

/** Wallets tied to a user, tagged by who holds the private key. */
export type AdminWalletKind = 'main' | 'agent_sandbox';

export const WALLET_KIND_LABEL: Record<AdminWalletKind, string> = {
  main: 'Main (self-custody)',
  agent_sandbox: 'Agent Sandbox (backend-custodied)',
};

export type AdminDAppCategory = string;
export type AdminDAppPrimaryCategory = AdminDAppCategory;

export type AdminDAppToolId =
  | 'get_wallet_info'
  | 'get_balance'
  | 'get_swap_quote'
  | 'execute_swap'
  | 'send_token'
  | 'get_tx_history'
  | 'play_hash_mahjong'
  | 'play_hash_mahjong_multi';

export type AdminToolCategory =
  | 'read'
  | 'quote'
  | 'transact'
  | 'sign'
  | 'position'
  | 'game';

export type AdminToolRiskLevel = 'safe' | 'confirm_required' | 'destructive';

export type AdminToolStatus = 'active' | 'disabled' | 'deprecated';

export type AdminToolDefinition = {
  id: AdminDAppToolId;
  displayName: string;
  description: string;
  category: AdminToolCategory;
  riskLevel: AdminToolRiskLevel;
  status: AdminToolStatus;
};

export type AdminDAppRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: AdminDAppCategory[];
  primaryCategory?: AdminDAppPrimaryCategory;
  toolIds?: AdminDAppToolId[];
  aiDriven?: boolean;
  order: number;
  url: string;
  featured?: boolean;
  aiPrompt?: string;
  aiPromptVersion?: string;
  mentionPrompt?: string;
  mentionLabel?: string;
  mentionThemeKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminDAppTab = {
  id: AdminDAppCategory;
  label: string;
  order: number;
  enabled: boolean;
};

function getApiBaseUrl() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '');
  if (backendUrl) {
    return `${backendUrl}/api`;
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (baseUrl) {
    return baseUrl;
  }

  throw new Error('NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_URL is required');
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeUserRow(row: Record<string, unknown>): AdminUserRow {
  return {
    id: toFiniteNumber(row.id),
    credentialId: String(row.credentialId ?? ''),
    inviteCode: String(row.inviteCode ?? ''),
    invitedBy: (row.invitedBy as string | null) ?? null,
    pointsBalance: toFiniteNumber(row.pointsBalance),
    chanceRemaining: toFiniteNumber(row.chanceRemaining),
    chanceCooldownEndsAt: toFiniteNumber(row.chanceCooldownEndsAt),
    walletAddress: (row.walletAddress as string | null) ?? null,
    walletName: (row.walletName as string | null) ?? null,
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
    aiWalletCount: toFiniteNumber(row.aiWalletCount),
    aiRoundCount: toFiniteNumber(row.aiRoundCount),
    chancePurchaseCount: toFiniteNumber(row.chancePurchaseCount),
    latestChancePurchaseAt:
      (row.latestChancePurchaseAt as string | null) ?? null,
    aiUsage: {
      totalRequests: toFiniteNumber((row.aiUsage as { totalRequests?: unknown } | undefined)?.totalRequests),
      totalInputTokens: toFiniteNumber((row.aiUsage as { totalInputTokens?: unknown } | undefined)?.totalInputTokens),
      totalOutputTokens: toFiniteNumber((row.aiUsage as { totalOutputTokens?: unknown } | undefined)?.totalOutputTokens),
      totalCostPoints: toFiniteNumber((row.aiUsage as { totalCostPoints?: unknown } | undefined)?.totalCostPoints),
      lastUsedAt: (row.aiUsage as { lastUsedAt?: string | null } | undefined)?.lastUsedAt ?? null,
    },
  };
}

function normalizeUserDetail(payload: Record<string, unknown>): AdminUserDetail {
  const user = (payload.user as Record<string, unknown>) ?? {};
  const aiUsage = (payload.aiUsage as Record<string, unknown>) ?? {};
  const aiLogs = Array.isArray(payload.aiLogs) ? payload.aiLogs : [];
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];

  return {
    user: {
      id: toFiniteNumber(user.id),
      credentialId: String(user.credentialId ?? ''),
      inviteCode: String(user.inviteCode ?? ''),
      invitedBy: (user.invitedBy as string | null) ?? null,
      pointsBalance: toFiniteNumber(user.pointsBalance),
      chanceRemaining: toFiniteNumber(user.chanceRemaining),
      chanceCooldownEndsAt: toFiniteNumber(user.chanceCooldownEndsAt),
      walletAddress: (user.walletAddress as string | null) ?? null,
      walletName: (user.walletName as string | null) ?? null,
      passkeyCounter: toFiniteNumber(user.passkeyCounter),
      createdAt: String(user.createdAt ?? ''),
      updatedAt: String(user.updatedAt ?? ''),
    },
    aiUsage: {
      totalRequests: toFiniteNumber(aiUsage.totalRequests),
      totalInputTokens: toFiniteNumber(aiUsage.totalInputTokens),
      totalOutputTokens: toFiniteNumber(aiUsage.totalOutputTokens),
      totalCostPoints: toFiniteNumber(aiUsage.totalCostPoints),
      lastUsedAt: (aiUsage.lastUsedAt as string | null) ?? null,
    },
    aiLogs: aiLogs.map((log) => {
      const nextLog = log as Record<string, unknown>;
      return {
        id: toFiniteNumber(nextLog.id),
        model: String(nextLog.model ?? ''),
        inputTokens: toFiniteNumber(nextLog.inputTokens),
        outputTokens: toFiniteNumber(nextLog.outputTokens),
        costPoints: toFiniteNumber(nextLog.costPoints),
        conversationId: (nextLog.conversationId as string | null) ?? null,
        createdAt: String(nextLog.createdAt ?? ''),
      };
    }),
    transactions: transactions.map((tx) => {
      const nextTx = tx as Record<string, unknown>;
      return {
        id: toFiniteNumber(nextTx.id),
        type: String(nextTx.type ?? ''),
        amount: toFiniteNumber(nextTx.amount),
        balanceAfter: toFiniteNumber(nextTx.balanceAfter),
        metadata: (nextTx.metadata as Record<string, unknown>) ?? {},
        createdAt: String(nextTx.createdAt ?? ''),
      };
    }),
    chancePurchases: Array.isArray(payload.chancePurchases)
      ? payload.chancePurchases.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            id: toFiniteNumber(row.id),
            txHash: String(row.txHash ?? ''),
            productId: String(row.productId ?? ''),
            chanceAmount: toFiniteNumber(row.chanceAmount),
            status: String(row.status ?? ''),
            createdAt: String(row.createdAt ?? ''),
          };
        })
      : [],
    aiWalletSummary: payload.aiWalletSummary
      ? {
          walletCount: toFiniteNumber(
            (payload.aiWalletSummary as Record<string, unknown>).walletCount,
          ),
          totalRounds: toFiniteNumber(
            (payload.aiWalletSummary as Record<string, unknown>).totalRounds,
          ),
        }
      : {
          walletCount: 0,
          totalRounds: 0,
        },
  };
}

export function getDefaultAdminKey() {
  return process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? '';
}

async function request<T>(path: string, init: RequestInit = {}, adminKey: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function requestFormData<T>(path: string, init: RequestInit = {}, adminKey: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'x-admin-key': adminKey,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchUsers(params: {
  adminKey: string;
  query?: string;
  page?: number;
  limit?: number;
  hasChancePurchase?: boolean;
  sortBy?: 'createdAt' | 'pointsBalance' | 'aiWalletCount';
  sortDir?: 'asc' | 'desc';
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (typeof params.hasChancePurchase === 'boolean') {
    searchParams.set('hasChancePurchase', String(params.hasChancePurchase));
  }
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortDir) searchParams.set('sortDir', params.sortDir);

  const suffix = searchParams.toString();
  const response = await request<{
    users: AdminUserRow[];
    total: number;
    page: number;
    limit: number;
  }>(`/admin/users${suffix ? `?${suffix}` : ''}`, {}, params.adminKey);

  return {
    ...response,
    users: response.users.map((row) => normalizeUserRow(row as unknown as Record<string, unknown>)),
  };
}

/**
 * Pages through /admin/users until every matching row is collected.
 * Used by the CSV export, which must cover the whole result set and not just
 * the page currently rendered in the table.
 */
export async function fetchAllUsers(
  params: Omit<Parameters<typeof fetchUsers>[0], 'page' | 'limit'> & {
    pageSize?: number;
    maxRows?: number;
    onProgress?: (loaded: number, total: number) => void;
  },
) {
  const pageSize = params.pageSize ?? 200;
  const maxRows = params.maxRows ?? 50000;
  const rows: AdminUserRow[] = [];
  let page = 1;
  let total = 0;

  for (;;) {
    const response = await fetchUsers({ ...params, page, limit: pageSize });
    total = response.total;
    rows.push(...response.users);
    params.onProgress?.(rows.length, total);

    if (response.users.length < pageSize) break;
    if (rows.length >= total || rows.length >= maxRows) break;
    page += 1;
  }

  return { users: rows.slice(0, maxRows), total };
}

export async function fetchUserDetail(userId: number, adminKey: string) {
  const response = await request<Record<string, unknown>>(`/admin/users/${userId}`, {}, adminKey);
  return normalizeUserDetail(response);
}

export async function fetchPasskeyCredentials(params: {
  adminKey: string;
  query?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const suffix = searchParams.toString();
  return request<{
    credentials: AdminPasskeyCredentialRow[];
    total: number;
    page: number;
    limit: number;
  }>(`/admin/passkey-credentials${suffix ? `?${suffix}` : ''}`, {}, params.adminKey);
}

export async function fetchUserAiWallets(input: {
  adminKey: string;
  userId: number;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (input.page) searchParams.set('page', String(input.page));
  if (input.limit) searchParams.set('limit', String(input.limit));
  const suffix = searchParams.toString();

  return request<AdminAiWalletListResponse>(
    `/admin/users/${input.userId}/ai-wallets${suffix ? `?${suffix}` : ''}`,
    {},
    input.adminKey,
  );
}

export async function fetchUserAiWalletDetail(input: {
  adminKey: string;
  userId: number;
  walletAddress: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (input.page) searchParams.set('page', String(input.page));
  if (input.limit) searchParams.set('limit', String(input.limit));
  const suffix = searchParams.toString();

  return request<AdminAiWalletDetailResponse>(
    `/admin/users/${input.userId}/ai-wallets/${encodeURIComponent(input.walletAddress)}${suffix ? `?${suffix}` : ''}`,
    {},
    input.adminKey,
  );
}

export async function fetchUserChancePurchases(input: {
  adminKey: string;
  userId: number;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (input.page) searchParams.set('page', String(input.page));
  if (input.limit) searchParams.set('limit', String(input.limit));
  const suffix = searchParams.toString();

  return request<AdminChancePurchaseListResponse>(
    `/admin/users/${input.userId}/chance-purchases${suffix ? `?${suffix}` : ''}`,
    {},
    input.adminKey,
  );
}

export async function adjustUserBalance(input: {
  userId: number;
  amount: number;
  mode: 'set' | 'increment';
  reason?: string;
  adminKey: string;
}) {
  return request<{
    userId: number;
    previousBalance: number;
    currentBalance: number;
    delta: number;
    transactionId: number;
  }>(
    `/admin/users/${input.userId}/points-balance`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        amount: input.amount,
        mode: input.mode,
        reason: input.reason,
      }),
    },
    input.adminKey,
  );
}

export async function fetchAdminDapps(params: {
  adminKey: string;
  query?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  const suffix = searchParams.toString();

  return request<{
    dapps: AdminDAppRow[];
    tabs: AdminDAppTab[];
    tools: AdminToolDefinition[];
  }>(
    `/dapps/admin${suffix ? `?${suffix}` : ''}`,
    {},
    params.adminKey,
  );
}

export async function saveAdminDapp(input: {
  adminKey: string;
  id?: string;
  name: string;
  description: string;
  categories: AdminDAppCategory[];
  primaryCategory?: AdminDAppPrimaryCategory;
  toolIds?: AdminDAppToolId[];
  aiDriven?: boolean;
  order: number;
  url: string;
  icon: string;
  featured?: boolean;
  aiPrompt?: string;
  aiPromptVersion?: string;
  mentionPrompt?: string;
  mentionLabel?: string;
  mentionThemeKey?: string;
}) {
  const path = input.id ? `/dapps/admin/${input.id}` : '/dapps/admin';
  const method = input.id ? 'PUT' : 'POST';

  return request<AdminDAppRow>(
    path,
    {
      method,
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        categories: input.categories,
        primaryCategory: input.primaryCategory,
        toolIds: input.toolIds,
        aiDriven: Boolean(input.aiDriven),
        order: input.order,
        url: input.url,
        icon: input.icon,
        featured: Boolean(input.featured),
        aiPrompt: input.aiPrompt,
        aiPromptVersion: input.aiPromptVersion,
        mentionPrompt: input.mentionPrompt,
        mentionLabel: input.mentionLabel,
        mentionThemeKey: input.mentionThemeKey,
      }),
    },
    input.adminKey,
  );
}

export async function uploadAdminDappImage(input: {
  adminKey: string;
  file: File;
}) {
  const body = new FormData();
  body.append('file', input.file);

  return requestFormData<{ key: string; publicUrl: string }>(
    '/dapps/admin/upload-image',
    {
      method: 'POST',
      body,
    },
    input.adminKey,
  );
}

export async function saveAdminDappTabs(input: {
  adminKey: string;
  tabs: AdminDAppTab[];
}) {
  return request<{ tabs: AdminDAppTab[] }>(
    '/dapps/admin/tabs',
    {
      method: 'PUT',
      body: JSON.stringify({
        tabs: input.tabs,
      }),
    },
    input.adminKey,
  );
}

export type AdminCatAssetBatch = {
  id: number;
  name: string;
  metadataCid: string;
  imageCid: string | null;
  baseURI: string;
  totalItems: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminCatMetadataItem = {
  id: number;
  batchId: number;
  serialNo: number;
  name: string;
  description: string | null;
  image: string | null;
  status: string;
  minted: boolean;
  mintedTokenId: string | null;
  mintedTxHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCatMintRecord = {
  id: number;
  userId: number | null;
  ownerAddress: string;
  tokenId: string;
  txHash: string;
  contractAddress: string | null;
  metadataItemId: number | null;
  source: string;
  mintedAt: string | null;
  createdAt: string;
};

export async function fetchCatAssetBatches(input: { adminKey: string }) {
  return request<{ items: AdminCatAssetBatch[] }>(
    '/catnft/admin/batches',
    {},
    input.adminKey,
  );
}

export async function fetchCatMetadataItems(input: {
  adminKey: string;
  batchId?: number;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (input.batchId) searchParams.set('batchId', String(input.batchId));
  if (input.page) searchParams.set('page', String(input.page));
  if (input.limit) searchParams.set('limit', String(input.limit));

  const suffix = searchParams.toString();
  return request<{ items: AdminCatMetadataItem[]; total: number; page: number; limit: number }>(
    `/catnft/admin/metadata-items${suffix ? `?${suffix}` : ''}`,
    {},
    input.adminKey,
  );
}

export async function fetchCatMintRecords(input: {
  adminKey: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (input.page) searchParams.set('page', String(input.page));
  if (input.limit) searchParams.set('limit', String(input.limit));

  const suffix = searchParams.toString();
  return request<{ items: AdminCatMintRecord[]; total: number; page: number; limit: number }>(
    `/catnft/admin/mints${suffix ? `?${suffix}` : ''}`,
    {},
    input.adminKey,
  );
}
