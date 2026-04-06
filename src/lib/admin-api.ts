export type AdminUserRow = {
  id: number;
  credentialId: string;
  inviteCode: string;
  invitedBy: string | null;
  ninjaBalance: number;
  walletAddress: string | null;
  walletName: string | null;
  createdAt: string;
  updatedAt: string;
  aiUsage: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostNinja: number;
    lastUsedAt: string | null;
  };
};

export type AdminUserDetail = {
  user: {
    id: number;
    credentialId: string;
    inviteCode: string;
    invitedBy: string | null;
    ninjaBalance: number;
    walletAddress: string | null;
    walletName: string | null;
    createdAt: string;
    updatedAt: string;
  };
  aiUsage: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostNinja: number;
    lastUsedAt: string | null;
  };
  aiLogs: Array<{
    id: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costNinja: number;
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

export type AdminDAppCategory = string;

export type AdminDAppRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: AdminDAppCategory[];
  order: number;
  url: string;
  featured?: boolean;
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
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is required');
  }
  return baseUrl.replace(/\/$/, '');
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
    ninjaBalance: toFiniteNumber(row.ninjaBalance),
    walletAddress: (row.walletAddress as string | null) ?? null,
    walletName: (row.walletName as string | null) ?? null,
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
    aiUsage: {
      totalRequests: toFiniteNumber((row.aiUsage as { totalRequests?: unknown } | undefined)?.totalRequests),
      totalInputTokens: toFiniteNumber((row.aiUsage as { totalInputTokens?: unknown } | undefined)?.totalInputTokens),
      totalOutputTokens: toFiniteNumber((row.aiUsage as { totalOutputTokens?: unknown } | undefined)?.totalOutputTokens),
      totalCostNinja: toFiniteNumber((row.aiUsage as { totalCostNinja?: unknown } | undefined)?.totalCostNinja),
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
      ninjaBalance: toFiniteNumber(user.ninjaBalance),
      walletAddress: (user.walletAddress as string | null) ?? null,
      walletName: (user.walletName as string | null) ?? null,
      createdAt: String(user.createdAt ?? ''),
      updatedAt: String(user.updatedAt ?? ''),
    },
    aiUsage: {
      totalRequests: toFiniteNumber(aiUsage.totalRequests),
      totalInputTokens: toFiniteNumber(aiUsage.totalInputTokens),
      totalOutputTokens: toFiniteNumber(aiUsage.totalOutputTokens),
      totalCostNinja: toFiniteNumber(aiUsage.totalCostNinja),
      lastUsedAt: (aiUsage.lastUsedAt as string | null) ?? null,
    },
    aiLogs: aiLogs.map((log) => {
      const nextLog = log as Record<string, unknown>;
      return {
        id: toFiniteNumber(nextLog.id),
        model: String(nextLog.model ?? ''),
        inputTokens: toFiniteNumber(nextLog.inputTokens),
        outputTokens: toFiniteNumber(nextLog.outputTokens),
        costNinja: toFiniteNumber(nextLog.costNinja),
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
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

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
    `/admin/users/${input.userId}/ninja-balance`,
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

  return request<{ dapps: AdminDAppRow[]; tabs: AdminDAppTab[] }>(
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
  order: number;
  url: string;
  icon: string;
  featured?: boolean;
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
        order: input.order,
        url: input.url,
        icon: input.icon,
        featured: Boolean(input.featured),
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
