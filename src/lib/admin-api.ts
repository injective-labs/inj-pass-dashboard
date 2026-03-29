export type AdminUserRow = {
  id: number;
  credentialId: string;
  inviteCode: string;
  invitedBy: string | null;
  ninjiaBalance: number;
  walletAddress: string | null;
  walletName: string | null;
  createdAt: string;
  updatedAt: string;
  aiUsage: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostNinjia: number;
    lastUsedAt: string | null;
  };
};

export type AdminUserDetail = {
  user: {
    id: number;
    credentialId: string;
    inviteCode: string;
    invitedBy: string | null;
    ninjiaBalance: number;
    walletAddress: string | null;
    walletName: string | null;
    createdAt: string;
    updatedAt: string;
  };
  aiUsage: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostNinjia: number;
    lastUsedAt: string | null;
  };
  aiLogs: Array<{
    id: number;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costNinjia: number;
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
  return request<{
    users: AdminUserRow[];
    total: number;
    page: number;
    limit: number;
  }>(`/admin/users${suffix ? `?${suffix}` : ''}`, {}, params.adminKey);
}

export async function fetchUserDetail(userId: number, adminKey: string) {
  return request<AdminUserDetail>(`/admin/users/${userId}`, {}, adminKey);
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
