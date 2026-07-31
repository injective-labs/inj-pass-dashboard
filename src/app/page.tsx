'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  adjustUserBalance,
  fetchAdminDapps,
  fetchAllUsers,
  fetchUserAiWalletDetail,
  fetchUserAiWallets,
  fetchUserChancePurchases,
  fetchUserDetail,
  fetchUsers,
  getDefaultAdminKey,
  saveAdminDapp,
  saveAdminDappTabs,
  uploadAdminDappImage,
  type AdminAiWalletDetailResponse,
  type AdminAiWalletRow,
  type AdminDAppCategory,
  type AdminDAppPrimaryCategory,
  type AdminDAppRow,
  type AdminDAppTab,
  type AdminDAppToolId,
  type AdminToolDefinition,
  type AdminUserDetail,
  type AdminUserRow,
} from '@/lib/admin-api';
import { csvTimestamp, downloadCsv, type CsvValue } from '@/lib/csv';
import styles from './page.module.css';

const ADMIN_KEY_STORAGE = 'inj-dashboard-admin-key';
const PAGE_SIZE = 10;

type ModuleKey = 'users' | 'dapps';
type UserViewTab = 'overview' | 'wallets' | 'ninja' | 'transactions';

type DAppEditorState = {
  id?: string;
  name: string;
  description: string;
  categories: AdminDAppCategory[];
  primaryCategory?: AdminDAppPrimaryCategory;
  toolIds: AdminDAppToolId[];
  aiDriven: boolean;
  order: number;
  url: string;
  icon: string;
  featured: boolean;
  aiPrompt: string;
  aiPromptVersion: string;
  mentionPrompt: string;
  mentionLabel: string;
  mentionThemeKey: string;
};

const EMPTY_DAPP_FORM: DAppEditorState = {
  name: '',
  description: '',
  categories: [],
  primaryCategory: undefined,
  toolIds: [],
  aiDriven: false,
  order: 0,
  url: '',
  icon: '',
  featured: false,
  aiPrompt: '',
  aiPromptVersion: 'v1',
  mentionPrompt: '',
  mentionLabel: '',
  mentionThemeKey: '',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  const safeValue = Number(value);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(Number.isFinite(safeValue) ? safeValue : 0);
}

function getPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function normalizeTabId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isAiDrivenCategoryId(value?: string | null) {
  const normalized = normalizeTabId(String(value ?? ''));
  return normalized === 'ai' || normalized === 'ai-driven';
}

function isAiDrivenTab(tab: { id: string; label?: string }) {
  return isAiDrivenCategoryId(tab.id) || isAiDrivenCategoryId(tab.label);
}

function stripAiDrivenCategories(
  categories: AdminDAppCategory[],
  tabs: AdminDAppTab[],
) {
  const aiTabIds = new Set(
    tabs.filter((tab) => isAiDrivenTab(tab)).map((tab) => tab.id),
  );

  return categories.filter(
    (category) => !aiTabIds.has(category) && !isAiDrivenCategoryId(category),
  );
}

function resolveDappIcon(icon: string) {
  if (!icon) return '';
  if (icon.startsWith('/')) return icon;
  if (/\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(icon)) return icon;
  try {
    const parsed = icon.startsWith('http') ? new URL(icon) : new URL(`https://${icon}`);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=${icon}&sz=128`;
  }
}

function breadcrumbs(input: {
  module: ModuleKey;
  user: AdminUserRow | null;
  userTab: UserViewTab;
  walletAddress: string | null;
  dapp: AdminDAppRow | null;
}) {
  if (input.module === 'dapps') {
    return input.dapp ? ['DApps', input.dapp.name] : ['DApps'];
  }
  if (!input.user) return ['Users'];
  if (input.userTab === 'wallets' && input.walletAddress) {
    return ['Users', `#${input.user.id}`, 'AI Wallets', input.walletAddress];
  }
  if (input.userTab === 'wallets') {
    return ['Users', `#${input.user.id}`, 'AI Wallets'];
  }
  if (input.userTab === 'ninja') {
    return ['Users', `#${input.user.id}`, 'NINJA'];
  }
  if (input.userTab === 'transactions') {
    return ['Users', `#${input.user.id}`, 'Transactions'];
  }
  return ['Users', `#${input.user.id}`, 'Overview'];
}

export default function HomePage() {
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [activeAdminKey, setActiveAdminKey] = useState('');
  const [module, setModule] = useState<ModuleKey>('users');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [hasChanceFilter, setHasChanceFilter] = useState<'all' | 'buyers'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'ninjaBalance' | 'aiWalletCount'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userTab, setUserTab] = useState<UserViewTab>('overview');
  const [wallets, setWallets] = useState<AdminAiWalletRow[]>([]);
  const [walletsTotal, setWalletsTotal] = useState(0);
  const [walletPage, setWalletPage] = useState(1);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(null);
  const [walletDetail, setWalletDetail] = useState<AdminAiWalletDetailResponse | null>(null);
  const [chanceRows, setChanceRows] = useState<
    Awaited<ReturnType<typeof fetchUserChancePurchases>>['purchases']
  >([]);

  const [dapps, setDapps] = useState<AdminDAppRow[]>([]);
  const [dappTabs, setDappTabs] = useState<AdminDAppTab[]>([]);
  const [toolDefinitions, setToolDefinitions] = useState<AdminToolDefinition[]>([]);
  const [selectedDappId, setSelectedDappId] = useState<string | null>(null);
  const [dappModalOpen, setDappModalOpen] = useState(false);
  const [tabsModalOpen, setTabsModalOpen] = useState(false);
  const [tabDrafts, setTabDrafts] = useState<AdminDAppTab[]>([]);
  const [dappForm, setDappForm] = useState<DAppEditorState>(EMPTY_DAPP_FORM);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [balanceMode, setBalanceMode] = useState<'set' | 'increment'>('increment');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getDefaultAdminKey();
    setAdminKeyInput(stored);
    setActiveAdminKey(stored);
  }, []);

  useEffect(() => {
    if (!activeAdminKey) return;
    if (module === 'users') {
      void loadUsers(activeAdminKey, query, page, hasChanceFilter);
      return;
    }
    void loadDapps(activeAdminKey, query);
  }, [activeAdminKey, module, query, page, hasChanceFilter, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2200);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!selectedUser || !activeAdminKey) return;
    void loadUserDetail(selectedUser.id, activeAdminKey);
  }, [selectedUser, activeAdminKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedUser || userTab !== 'wallets' || !activeAdminKey) return;
    void loadUserWallets(selectedUser.id, activeAdminKey, walletPage);
  }, [selectedUser, userTab, activeAdminKey, walletPage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadUsers(
    adminKey = activeAdminKey,
    nextQuery = query,
    nextPage = page,
    chanceFilter = hasChanceFilter,
  ) {
    if (!adminKey) {
      setError('Please enter admin key first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers({
        adminKey,
        query: nextQuery,
        page: nextPage,
        limit: PAGE_SIZE,
        hasChancePurchase: chanceFilter === 'buyers' ? true : undefined,
        sortBy,
        sortDir,
      });
      setUsers(data.users);
      setTotalUsers(data.total);

      if (selectedUser) {
        const nextSelected = data.users.find((item) => item.id === selectedUser.id);
        if (nextSelected) setSelectedUser(nextSelected);
      }
    } catch (nextError) {
      setUsers([]);
      setTotalUsers(0);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserDetail(userId: number, adminKey: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchUserDetail(userId, adminKey);
      setUserDetail(detail);
      const chance = await fetchUserChancePurchases({
        adminKey,
        userId,
        page: 1,
        limit: 10,
      });
      setChanceRows(chance.purchases);
    } catch (nextError) {
      setUserDetail(null);
      setChanceRows([]);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load user detail');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadUserWallets(userId: number, adminKey: string, targetPage: number) {
    setDetailLoading(true);
    setError(null);
    try {
      const result = await fetchUserAiWallets({
        adminKey,
        userId,
        page: targetPage,
        limit: PAGE_SIZE,
      });
      setWallets(result.wallets);
      setWalletsTotal(result.total);
    } catch (nextError) {
      setWallets([]);
      setWalletsTotal(0);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load AI wallets');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadWalletDetail(walletAddress: string) {
    if (!selectedUser || !activeAdminKey) return;
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchUserAiWalletDetail({
        adminKey: activeAdminKey,
        userId: selectedUser.id,
        walletAddress,
        page: 1,
        limit: 20,
      });
      setSelectedWalletAddress(walletAddress);
      setWalletDetail(detail);
    } catch (nextError) {
      setWalletDetail(null);
      setSelectedWalletAddress(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load wallet detail');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadDapps(adminKey = activeAdminKey, nextQuery = query) {
    if (!adminKey) {
      setError('Please enter admin key first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminDapps({ adminKey, query: nextQuery });
      setDapps(data.dapps);
      setDappTabs(data.tabs.slice().sort((a, b) => a.order - b.order));
      setTabDrafts(data.tabs.slice().sort((a, b) => a.order - b.order));
      setToolDefinitions(data.tools);
    } catch (nextError) {
      setDapps([]);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load dapps');
    } finally {
      setLoading(false);
    }
  }

  async function exportUsersCsv() {
    if (!activeAdminKey) {
      setError('Please enter admin key first.');
      return;
    }
    setExporting(true);
    setExportProgress('');
    setError(null);
    try {
      const { users: allUsers } = await fetchAllUsers({
        adminKey: activeAdminKey,
        query,
        hasChancePurchase: hasChanceFilter === 'buyers' ? true : undefined,
        sortBy,
        sortDir,
        onProgress: (loaded, total) => setExportProgress(`${loaded} / ${total}`),
      });

      const rows: CsvValue[][] = [
        [
          'User ID',
          'Name',
          'Wallet Address',
          'Invite Code',
          'Invited By',
          'Credential',
          'NINJA Balance',
          'Chance Remaining',
          'AI Wallets',
          'AI Rounds',
          'Chance Buys',
          'Latest Chance At',
          'AI Requests',
          'AI Input Tokens',
          'AI Output Tokens',
          'AI Cost (NINJA)',
          'AI Last Used At',
          'Created At',
          'Updated At',
        ],
        ...allUsers.map((user) => [
          user.id,
          user.walletName ?? '',
          user.walletAddress ?? '',
          user.inviteCode,
          user.invitedBy ?? '',
          user.credentialId,
          user.ninjaBalance,
          user.chanceRemaining ?? 0,
          user.aiWalletCount ?? 0,
          user.aiRoundCount ?? 0,
          user.chancePurchaseCount ?? 0,
          user.latestChancePurchaseAt ?? '',
          user.aiUsage.totalRequests,
          user.aiUsage.totalInputTokens,
          user.aiUsage.totalOutputTokens,
          user.aiUsage.totalCostNinja,
          user.aiUsage.lastUsedAt ?? '',
          user.createdAt,
          user.updatedAt,
        ]),
      ];

      const scope = hasChanceFilter === 'buyers' ? 'chance-buyers' : 'all';
      downloadCsv(`inj-users-${scope}-${csvTimestamp()}.csv`, rows);
      setSuccess(`Exported ${allUsers.length} users.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to export users');
    } finally {
      setExporting(false);
      setExportProgress('');
    }
  }

  async function exportUserDetailCsv() {
    if (!selectedUser || !activeAdminKey) return;
    setExporting(true);
    setError(null);
    try {
      const userId = selectedUser.id;
      const detail =
        userDetail && userDetail.user.id === userId
          ? userDetail
          : await fetchUserDetail(userId, activeAdminKey);

      const [walletResult, chanceResult] = await Promise.all([
        fetchUserAiWallets({ adminKey: activeAdminKey, userId, page: 1, limit: 500 }),
        fetchUserChancePurchases({ adminKey: activeAdminKey, userId, page: 1, limit: 500 }),
      ]);

      const rows: CsvValue[][] = [
        ['Profile'],
        ['Field', 'Value'],
        ['User ID', detail.user.id],
        ['Wallet Name', detail.user.walletName ?? ''],
        ['Wallet Address', detail.user.walletAddress ?? ''],
        ['Credential', detail.user.credentialId],
        ['Invite Code', detail.user.inviteCode],
        ['Invited By', detail.user.invitedBy ?? ''],
        ['Passkey Counter', detail.user.passkeyCounter ?? 0],
        ['NINJA Balance', detail.user.ninjaBalance],
        ['Chance Remaining', detail.user.chanceRemaining ?? 0],
        ['Chance Cooldown Ends At', detail.user.chanceCooldownEndsAt ?? 0],
        ['Created At', detail.user.createdAt],
        ['Updated At', detail.user.updatedAt],
        [],
        ['AI Summary'],
        ['Field', 'Value'],
        ['Total Requests', detail.aiUsage.totalRequests],
        ['Total Input Tokens', detail.aiUsage.totalInputTokens],
        ['Total Output Tokens', detail.aiUsage.totalOutputTokens],
        ['Total Cost (NINJA)', detail.aiUsage.totalCostNinja],
        ['Last Used At', detail.aiUsage.lastUsedAt ?? ''],
        ['AI Wallets', detail.aiWalletSummary?.walletCount ?? 0],
        ['AI Rounds', detail.aiWalletSummary?.totalRounds ?? 0],
        [],
        [`AI Wallets (${walletResult.total})`],
        ['Wallet', 'Sessions', 'Rounds', 'First Active', 'Last Active'],
        ...walletResult.wallets.map((wallet) => [
          wallet.sandboxAddress,
          wallet.sessionCount,
          wallet.roundCount,
          wallet.firstActiveAt ?? '',
          wallet.lastActiveAt ?? '',
        ]),
        [],
        [`Chance Purchases (${chanceResult.total})`],
        ['ID', 'Product', 'Chance Amount', 'Balance After', 'Status', 'Tx Hash', 'Chain', 'Created At'],
        ...chanceResult.purchases.map((purchase) => [
          purchase.id,
          purchase.productId,
          purchase.chanceAmount,
          purchase.balanceAfter,
          purchase.status,
          purchase.txHash,
          purchase.chainId ?? '',
          purchase.createdAt,
        ]),
        [],
        [`AI Logs (${detail.aiLogs.length})`],
        ['ID', 'Model', 'Input Tokens', 'Output Tokens', 'Cost (NINJA)', 'Conversation', 'Created At'],
        ...detail.aiLogs.map((log) => [
          log.id,
          log.model,
          log.inputTokens,
          log.outputTokens,
          log.costNinja,
          log.conversationId ?? '',
          log.createdAt,
        ]),
        [],
        [`NINJA Transactions (${detail.transactions.length})`],
        ['ID', 'Type', 'Amount', 'Balance After', 'Metadata', 'Created At'],
        ...detail.transactions.map((tx) => [
          tx.id,
          tx.type,
          tx.amount,
          tx.balanceAfter,
          JSON.stringify(tx.metadata ?? {}),
          tx.createdAt,
        ]),
      ];

      downloadCsv(`inj-user-${userId}-${csvTimestamp()}.csv`, rows);
      setSuccess(`Exported user #${userId}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to export user detail');
    } finally {
      setExporting(false);
    }
  }

  function connectAdmin() {
    window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKeyInput);
    setActiveAdminKey(adminKeyInput);
    setPage(1);
    setSuccess('Admin key saved.');
  }

  function runSearch() {
    setQuery(queryInput.trim());
    setPage(1);
    setError(null);
  }

  function resetSearch() {
    setQueryInput('');
    setQuery('');
    setPage(1);
    setError(null);
  }

  function openUserDetail(user: AdminUserRow) {
    setSelectedUser(user);
    setUserTab('overview');
    setSelectedWalletAddress(null);
    setWalletDetail(null);
  }

  async function saveNinjaBalance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !activeAdminKey) return;
    const amount = Number(balanceAmount);
    if (!Number.isFinite(amount)) {
      setError('Please enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await adjustUserBalance({
        adminKey: activeAdminKey,
        userId: selectedUser.id,
        amount,
        mode: balanceMode,
        reason: balanceReason,
      });
      setSuccess(`Balance updated: ${result.delta >= 0 ? '+' : ''}${formatNumber(result.delta, 4)} NINJA`);
      setBalanceAmount('');
      setBalanceReason('');
      await loadUsers();
      await loadUserDetail(selectedUser.id, activeAdminKey);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to adjust balance');
    } finally {
      setSaving(false);
    }
  }

  function editDapp(row: AdminDAppRow) {
    const normalizedCategories = stripAiDrivenCategories(row.categories, dappTabs);
    setSelectedDappId(row.id);
    setDappForm({
      id: row.id,
      name: row.name,
      description: row.description,
      categories: normalizedCategories,
      primaryCategory: normalizedCategories.includes(row.primaryCategory ?? '')
        ? row.primaryCategory
        : undefined,
      toolIds: row.toolIds ?? [],
      aiDriven: Boolean(row.aiDriven),
      order: row.order,
      url: row.url,
      icon: row.icon,
      featured: Boolean(row.featured),
      aiPrompt: row.aiPrompt ?? '',
      aiPromptVersion: row.aiPromptVersion ?? 'v1',
      mentionPrompt: row.mentionPrompt ?? '',
      mentionLabel: row.mentionLabel ?? '',
      mentionThemeKey: row.mentionThemeKey ?? '',
    });
    setDappModalOpen(true);
  }

  function selectDapp(row: AdminDAppRow) {
    setSelectedDappId(row.id);
  }

  function openNewDappModal() {
    setSelectedDappId(null);
    const defaultCategory = dappTabs.find((tab) => !isAiDrivenTab(tab))?.id;
    setDappForm({
      ...EMPTY_DAPP_FORM,
      categories: defaultCategory ? [defaultCategory] : [],
    });
    setDappModalOpen(true);
  }

  async function saveDapp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdminKey) return;
    setSaving(true);
    setError(null);
    try {
      await saveAdminDapp({
        adminKey: activeAdminKey,
        id: dappForm.id,
        name: dappForm.name,
        description: dappForm.description,
        categories: stripAiDrivenCategories(dappForm.categories, dappTabs),
        primaryCategory: dappForm.primaryCategory,
        toolIds: dappForm.aiDriven ? dappForm.toolIds : [],
        aiDriven: dappForm.aiDriven,
        order: dappForm.order,
        url: dappForm.url,
        icon: dappForm.icon,
        featured: dappForm.featured,
        aiPrompt: dappForm.aiPrompt,
        aiPromptVersion: dappForm.aiPromptVersion,
        mentionPrompt: dappForm.mentionPrompt,
        mentionLabel: dappForm.mentionLabel,
        mentionThemeKey: dappForm.mentionThemeKey,
      });
      setSuccess(`DApp ${selectedDappId ? 'updated' : 'created'} successfully.`);
      setDappModalOpen(false);
      await loadDapps();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save dapp');
    } finally {
      setSaving(false);
    }
  }

  async function saveTabs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdminKey) return;
    const normalized = tabDrafts
      .map((tab, index) => ({
        ...tab,
        id: normalizeTabId(tab.id),
        label: tab.label.trim(),
        order: Number.isFinite(tab.order) ? tab.order : index,
      }))
      .filter((tab) => tab.id && tab.label)
      .sort((a, b) => a.order - b.order);

    setSaving(true);
    setError(null);
    try {
      const result = await saveAdminDappTabs({
        adminKey: activeAdminKey,
        tabs: normalized,
      });
      const sortedTabs = result.tabs.slice().sort((a, b) => a.order - b.order);
      setDappTabs(sortedTabs);
      setTabDrafts(sortedTabs);
      setTabsModalOpen(false);
      setSuccess('Tabs updated successfully.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save tabs');
    } finally {
      setSaving(false);
    }
  }

  async function uploadDappImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeAdminKey) return;

    setUploadingImage(true);
    setError(null);
    try {
      const result = await uploadAdminDappImage({ adminKey: activeAdminKey, file });
      setDappForm((prev) => ({ ...prev, icon: result.publicUrl }));
      setSuccess('Image uploaded successfully.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  const selectedDapp = selectedDappId
    ? dapps.find((item) => item.id === selectedDappId) ?? null
    : null;
  const pageCount = getPageCount(totalUsers, PAGE_SIZE);
  const walletPageCount = getPageCount(walletsTotal, PAGE_SIZE);
  const displayedChanceBuyers = users.filter(
    (item) => (item.chancePurchaseCount ?? 0) > 0,
  ).length;
  const displayedWallets = users.reduce(
    (sum, item) => sum + (item.aiWalletCount ?? 0),
    0,
  );
  const displayedRounds = users.reduce(
    (sum, item) => sum + (item.aiRoundCount ?? 0),
    0,
  );

  const userBreadCrumbs = breadcrumbs({
    module,
    user: selectedUser,
    userTab,
    walletAddress: selectedWalletAddress,
    dapp: selectedDapp,
  });
  const hasSelectedUser = Boolean(selectedUser);
  const usersPanelTitle = hasSelectedUser ? `User #${selectedUser?.id}` : 'Users';
  const usersPanelSubtitle = hasSelectedUser
    ? (selectedUser?.walletName || selectedUser?.walletAddress || '')
    : `Total ${totalUsers}`;
  const sortedUsers = useMemo(() => users, [users]);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <h1>INJ Admin</h1>
            <p>Control Center</p>
          </div>

          <div className={styles.sidebarSection}>
            <span className={styles.sidebarLabel}>Navigation</span>
            <button
              type="button"
              className={`${styles.sidebarNavItem} ${module === 'users' ? styles.sidebarNavItemActive : ''}`}
              onClick={() => {
                setModule('users');
                setSelectedDappId(null);
              }}
            >
              Users
            </button>
            <button
              type="button"
              className={`${styles.sidebarNavItem} ${module === 'dapps' ? styles.sidebarNavItemActive : ''}`}
              onClick={() => {
                setModule('dapps');
                setSelectedUser(null);
              }}
            >
              DApps
            </button>
            <Link href="/cats" className={styles.sidebarNavItem}>
              Cat NFT Metadata
            </Link>
          </div>

          <div className={styles.sidebarFooter}>
            <span className={styles.sidebarLabel}>Admin Key</span>
            <div className={styles.sidebarKeyRow}>
              <input
                className={styles.input}
                type="password"
                value={adminKeyInput}
                placeholder="Admin key"
                onChange={(event) => setAdminKeyInput(event.target.value)}
              />
              <button className={styles.primaryButton} onClick={connectAdmin} type="button">
                Connect
              </button>
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          <header className={styles.mainHeader}>
            <div>
              <h2>{module === 'users' ? 'User Operations' : 'DApp Operations'}</h2>
              <p>
                {module === 'users'
                  ? 'Inspect users, AI wallets, NINJA and chance activity'
                  : 'Manage dapps, tabs and AI-driven tool binding'}
              </p>
            </div>
            <section className={styles.breadcrumbWrap}>
              {userBreadCrumbs.map((item, index) => (
                <span key={`${item}-${index}`} className={styles.breadcrumbItem}>
                  {index > 0 ? <span className={styles.breadcrumbSep}>/</span> : null}
                  {item}
                </span>
              ))}
            </section>
          </header>

          {error ? <div className={styles.alertError}>{error}</div> : null}
          {success ? <div className={styles.alertSuccess}>{success}</div> : null}

          {module === 'users' ? (
            <>
              <section className={styles.kpiRow}>
                <article className={styles.kpiCard}>
                  <span>Total Users</span>
                  <strong>{formatNumber(totalUsers, 0)}</strong>
                </article>
                <article className={styles.kpiCard}>
                  <span>Chance Buyers (current page)</span>
                  <strong>{formatNumber(displayedChanceBuyers, 0)}</strong>
                </article>
                <article className={styles.kpiCard}>
                  <span>AI Wallets (current page)</span>
                  <strong>{formatNumber(displayedWallets, 0)}</strong>
                </article>
                <article className={styles.kpiCard}>
                  <span>AI Rounds (current page)</span>
                  <strong>{formatNumber(displayedRounds, 0)}</strong>
                </article>
              </section>
              <div className={styles.layoutSingle}>
              {!hasSelectedUser ? (
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Users</h2>
                    <p>Total {totalUsers}</p>
                  </div>
                  <div className={styles.segmented}>
                    <button
                      type="button"
                      className={`${styles.segmentedItem} ${hasChanceFilter === 'all' ? styles.segmentedItemActive : ''}`}
                      onClick={() => {
                        setHasChanceFilter('all');
                        setPage(1);
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`${styles.segmentedItem} ${hasChanceFilter === 'buyers' ? styles.segmentedItemActive : ''}`}
                      onClick={() => {
                        setHasChanceFilter('buyers');
                        setPage(1);
                      }}
                    >
                      Chance Buyers
                    </button>
                  </div>
                </div>

                <div className={styles.searchRow}>
                  <input
                    className={styles.input}
                    value={queryInput}
                    placeholder="Search user / wallet / invite / credential"
                    onChange={(event) => setQueryInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') runSearch();
                    }}
                  />
                  <button className={styles.secondaryButton} type="button" onClick={resetSearch}>
                    Reset
                  </button>
                    <button className={styles.primaryButton} type="button" onClick={runSearch}>
                      Search
                    </button>
                    <select
                      className={styles.select}
                      value={sortBy}
                      onChange={(event) => {
                        setSortBy(event.target.value as 'createdAt' | 'ninjaBalance' | 'aiWalletCount');
                        setPage(1);
                      }}
                    >
                      <option value="createdAt">Sort: Newest</option>
                      <option value="ninjaBalance">Sort: NINJA</option>
                      <option value="aiWalletCount">Sort: AI Wallets</option>
                    </select>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => {
                        setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                        setPage(1);
                      }}
                    >
                      {sortDir === 'desc' ? 'Desc' : 'Asc'}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={exporting}
                      title="Export every user matching the current search and filter"
                      onClick={() => void exportUsersCsv()}
                    >
                      {exporting
                        ? `Exporting${exportProgress ? ` ${exportProgress}` : ''}...`
                        : 'Export CSV'}
                    </button>
                  </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>User ID</th>
                        <th>Name</th>
                        <th>Wallet Address</th>
                        <th>Invite Code</th>
                        <th>Credential</th>
                        <th>NINJA</th>
                        <th>AI Wallets</th>
                        <th>AI Rounds</th>
                        <th>Chance Buys</th>
                        <th>Latest Chance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={11} className={styles.emptyCell}>Loading...</td></tr>
                      ) : users.length === 0 ? (
                        <tr><td colSpan={11} className={styles.emptyCell}>No users found.</td></tr>
                      ) : (
                        sortedUsers.map((user) => (
                          <tr key={user.id}>
                            <td>#{user.id}</td>
                            <td>{user.walletName || '-'}</td>
                            <td><span className={styles.fullValue}>{user.walletAddress || '-'}</span></td>
                            <td>{user.inviteCode || '-'}</td>
                            <td><span className={styles.fullValue}>{user.credentialId || '-'}</span></td>
                            <td>{formatNumber(user.ninjaBalance)}</td>
                            <td>{formatNumber(user.aiWalletCount ?? 0)}</td>
                            <td>{formatNumber(user.aiRoundCount ?? 0)}</td>
                            <td>{formatNumber(user.chancePurchaseCount ?? 0)}</td>
                            <td>{formatDate(user.latestChancePurchaseAt)}</td>
                            <td>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => openUserDetail(user)}
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.pagination}>
                  <span>{page} / {pageCount}</span>
                  <div className={styles.actionRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={page >= pageCount}
                      onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
              ) : null}
              {hasSelectedUser ? (
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>{usersPanelTitle}</h2>
                    <p>{usersPanelSubtitle || 'Select one user from table'}</p>
                  </div>
                  {hasSelectedUser ? (
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={exporting}
                        title="Export this user's profile, wallets, chance purchases, AI logs and transactions"
                        onClick={() => void exportUserDetailCsv()}
                      >
                        {exporting ? 'Exporting...' : 'Export CSV'}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                          setSelectedUser(null);
                          setSelectedWalletAddress(null);
                          setWalletDetail(null);
                          setUserTab('overview');
                        }}
                      >
                        Back to Users
                      </button>
                    </div>
                  ) : null}
                </div>

                {!selectedUser ? (
                  <div className={styles.emptyState}>Choose a user to view overview, AI wallets, NINJA, and transactions.</div>
                ) : detailLoading ? (
                  <div className={styles.emptyState}>Loading...</div>
                ) : (
                  <div className={styles.detailArea}>
                    <div className={styles.tabs}>
                      {(['overview', 'wallets', 'ninja', 'transactions'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          className={`${styles.tabButton} ${userTab === tab ? styles.tabButtonActive : ''}`}
                          onClick={() => {
                            setUserTab(tab);
                            setSelectedWalletAddress(null);
                            setWalletDetail(null);
                            if (tab === 'wallets') {
                              setWalletPage(1);
                              void loadUserWallets(selectedUser.id, activeAdminKey, 1);
                            }
                          }}
                        >
                          {tab === 'overview'
                            ? 'Overview'
                            : tab === 'wallets'
                              ? 'AI Wallets'
                              : tab === 'ninja'
                                ? 'NINJA'
                                : 'Transactions'}
                        </button>
                      ))}
                    </div>

                {userTab === 'overview' ? (
                  <div className={styles.grid2}>
                    <article className={styles.card}>
                      <h3>Profile</h3>
                      <p>
                        Credential:
                        {' '}
                        <span className={styles.fullValue}>{userDetail?.user.credentialId || '-'}</span>
                      </p>
                      <p>
                        Wallet:
                        {' '}
                        <span className={styles.fullValue}>{userDetail?.user.walletAddress || '-'}</span>
                      </p>
                      <p>Wallet Name: {userDetail?.user.walletName || '-'}</p>
                      <p>Passkey Counter: {formatNumber(userDetail?.user.passkeyCounter ?? 0)}</p>
                      <p>Invite Code: {userDetail?.user.inviteCode}</p>
                      <p>NINJA Balance: {formatNumber(userDetail?.user.ninjaBalance ?? 0)}</p>
                    </article>
                    <article className={styles.card}>
                      <h3>AI Summary</h3>
                      <p>Total Requests: {formatNumber(userDetail?.aiUsage.totalRequests ?? 0)}</p>
                      <p>Total Input: {formatNumber(userDetail?.aiUsage.totalInputTokens ?? 0)}</p>
                      <p>Total Output: {formatNumber(userDetail?.aiUsage.totalOutputTokens ?? 0)}</p>
                      <p>Total Cost: {formatNumber(userDetail?.aiUsage.totalCostNinja ?? 0, 4)} NINJA</p>
                      <p>AI Wallets: {formatNumber(userDetail?.aiWalletSummary?.walletCount ?? 0)}</p>
                      <p>AI Rounds: {formatNumber(userDetail?.aiWalletSummary?.totalRounds ?? 0)}</p>
                    </article>
                    <article className={styles.cardSpan}>
                      <h3>Recent Chance Purchases</h3>
                      {chanceRows.length === 0 ? (
                        <p className={styles.muted}>No chance purchases.</p>
                      ) : (
                        <div className={styles.list}>
                          {chanceRows.map((row) => (
                            <div key={row.id} className={styles.listItem}>
                              <span>{row.productId}</span>
                              <span>{row.chanceAmount} chance</span>
                              <span>{formatDate(row.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  </div>
                ) : null}

                {userTab === 'wallets' ? (
                  <div className={styles.grid2}>
                    <article className={styles.cardSpan}>
                      <div className={styles.cardHeader}>
                        <h3>AI Wallets ({walletsTotal})</h3>
                      </div>
                      {wallets.length === 0 ? (
                        <p className={styles.muted}>No sandbox wallets found.</p>
                      ) : (
                        <table className={styles.innerTable}>
                          <thead>
                            <tr>
                              <th>Wallet</th>
                              <th>Sessions</th>
                              <th>Rounds</th>
                              <th>First Active</th>
                              <th>Last Active</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {wallets.map((wallet) => (
                              <tr key={wallet.sandboxAddress}>
                                <td>
                                  <span className={styles.fullValue}>
                                    {wallet.sandboxAddress}
                                  </span>
                                </td>
                                <td>{wallet.sessionCount}</td>
                                <td>{wallet.roundCount}</td>
                                <td>{formatDate(wallet.firstActiveAt)}</td>
                                <td>{formatDate(wallet.lastActiveAt)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => void loadWalletDetail(wallet.sandboxAddress)}
                                  >
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className={styles.pagination}>
                        <span>{walletPage} / {walletPageCount}</span>
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={walletPage <= 1}
                            onClick={() => setWalletPage((prev) => Math.max(1, prev - 1))}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={walletPage >= walletPageCount}
                            onClick={() => setWalletPage((prev) => Math.min(walletPageCount, prev + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </article>

                    {walletDetail ? (
                      <article className={styles.cardSpan}>
                        <h3>Wallet Detail</h3>
                        <p>
                          Address:
                          {' '}
                          <span className={styles.fullValue}>
                            {walletDetail.wallet.sandboxAddress}
                          </span>
                        </p>
                        <p>Sessions: {walletDetail.wallet.sessionCount}</p>
                        <p>Rounds: {walletDetail.wallet.roundCount}</p>

                        <h4>Conversations</h4>
                        {walletDetail.conversations.items.length === 0 ? (
                          <p className={styles.muted}>No conversations.</p>
                        ) : (
                          <div className={styles.list}>
                            {walletDetail.conversations.items.map((item) => (
                              <div key={item.conversationId} className={styles.listItem}>
                                <span>{item.title || item.conversationId}</span>
                                <span>{item.roundCount} rounds</span>
                                <span>{formatDate(item.updatedAt)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <h4>Tool Summary</h4>
                        {walletDetail.toolSummary.length === 0 ? (
                          <p className={styles.muted}>No tool records.</p>
                        ) : (
                          <div className={styles.badges}>
                            {walletDetail.toolSummary.map((tool) => (
                              <span key={tool.toolId} className={styles.badge}>
                                {tool.toolId}: {tool.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ) : null}
                  </div>
                ) : null}

                {userTab === 'ninja' ? (
                  <div className={styles.grid2}>
                    <article className={styles.card}>
                      <h3>NINJA Balance</h3>
                      <p>Current: {formatNumber(userDetail?.user.ninjaBalance ?? 0)} NINJA</p>
                      <p>Chance Remaining: {formatNumber(userDetail?.user.chanceRemaining ?? 0)}</p>
                      <p>Chance Cooldown End: {formatNumber(userDetail?.user.chanceCooldownEndsAt ?? 0, 0)}</p>
                    </article>
                    <article className={styles.card}>
                      <h3>Adjust NINJA</h3>
                      <form className={styles.form} onSubmit={saveNinjaBalance}>
                        <label className={styles.field}>
                          <span>Mode</span>
                          <select
                            className={styles.select}
                            value={balanceMode}
                            onChange={(event) => setBalanceMode(event.target.value as 'set' | 'increment')}
                          >
                            <option value="increment">Increment</option>
                            <option value="set">Set</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Amount</span>
                          <input
                            className={styles.input}
                            value={balanceAmount}
                            onChange={(event) => setBalanceAmount(event.target.value)}
                            placeholder="100"
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Reason</span>
                          <input
                            className={styles.input}
                            value={balanceReason}
                            onChange={(event) => setBalanceReason(event.target.value)}
                            placeholder="ops adjustment"
                          />
                        </label>
                        <button className={styles.primaryButton} type="submit" disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </form>
                    </article>
                  </div>
                ) : null}

                {userTab === 'transactions' ? (
                  <div className={styles.grid2}>
                    <article className={styles.cardSpan}>
                      <h3>AI Logs</h3>
                      {userDetail?.aiLogs.length ? (
                        <div className={styles.list}>
                          {userDetail.aiLogs.map((log) => (
                            <div key={log.id} className={styles.listItem}>
                              <span>{log.model}</span>
                              <span>in {log.inputTokens} / out {log.outputTokens}</span>
                              <span>{formatDate(log.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.muted}>No AI logs.</p>
                      )}
                    </article>
                    <article className={styles.cardSpan}>
                      <h3>NINJA Transactions</h3>
                      {userDetail?.transactions.length ? (
                        <div className={styles.list}>
                          {userDetail.transactions.map((tx) => (
                            <div key={tx.id} className={styles.listItem}>
                              <span>{tx.type}</span>
                              <span>{formatNumber(tx.amount, 4)}</span>
                              <span>{formatDate(tx.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.muted}>No transactions.</p>
                      )}
                    </article>
                  </div>
                ) : null}
              </div>
            )}
              </section>
              ) : null}
            </div>
            </>
      ) : (
        <div className={styles.layoutSingle}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>DApps</h2>
                <p>Total {dapps.length}</p>
              </div>
              <div className={styles.actionRow}>
                <button className={styles.secondaryButton} type="button" onClick={() => setTabsModalOpen(true)}>
                  Manage Tabs
                </button>
                <button className={styles.primaryButton} type="button" onClick={openNewDappModal}>
                  New DApp
                </button>
              </div>
            </div>

            <div className={styles.searchRow}>
              <input
                className={styles.input}
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
                placeholder="Search dapp by name/description/url"
              />
              <button className={styles.secondaryButton} type="button" onClick={resetSearch}>Reset</button>
              <button className={styles.primaryButton} type="button" onClick={runSearch}>Search</button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>DApp</th>
                    <th>Category</th>
                    <th>AI Driven</th>
                    <th>Tools</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className={styles.emptyCell}>Loading...</td></tr>
                  ) : dapps.length === 0 ? (
                    <tr><td colSpan={6} className={styles.emptyCell}>No dapps found.</td></tr>
                  ) : (
                    dapps.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.userCell}>
                            <strong>
                              <img src={resolveDappIcon(row.icon)} alt="" width={18} height={18} />
                              {' '}
                              {row.name}
                            </strong>
                            <span>{row.description}</span>
                            <span className={styles.truncateText} title={row.url}>{row.url}</span>
                          </div>
                        </td>
                        <td>{row.primaryCategory || '-'}</td>
                        <td>{row.aiDriven ? 'Yes' : 'No'}</td>
                        <td>{row.toolIds?.length || 0}</td>
                        <td>{formatDate(row.updatedAt)}</td>
                        <td>
                          <div className={styles.actionRow}>
                            <button
                              className={styles.secondaryButton}
                              type="button"
                              onClick={() => selectDapp(row)}
                            >
                              Open
                            </button>
                            <button className={styles.secondaryButton} type="button" onClick={() => editDapp(row)}>
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {selectedDapp ? (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>DApp Detail</h2>
                <p>{selectedDapp.name}</p>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setSelectedDappId(null)}
              >
                Back to DApps
              </button>
            </div>

            <div className={styles.detailArea}>
              <div className={styles.grid2}>
                <article className={styles.card}>
                  <h3>Basic</h3>
                  <p>Name: {selectedDapp.name}</p>
                  <p>Primary: {selectedDapp.primaryCategory || '-'}</p>
                  <p>AI Driven: {selectedDapp.aiDriven ? 'Yes' : 'No'}</p>
                  <p>Featured: {selectedDapp.featured ? 'Yes' : 'No'}</p>
                  <p>Order: {selectedDapp.order}</p>
                </article>
                <article className={styles.card}>
                  <h3>AI + Tools</h3>
                  <p className={styles.truncateText} title={(selectedDapp.toolIds ?? []).join(', ') || '-'}>
                    Tools: {(selectedDapp.toolIds ?? []).join(', ') || '-'}
                  </p>
                  <p>Prompt Version: {selectedDapp.aiPromptVersion || '-'}</p>
                  <p className={styles.truncateText} title={selectedDapp.mentionLabel || selectedDapp.mentionPrompt || '-'}>
                    Mention: {selectedDapp.mentionLabel || selectedDapp.mentionPrompt || '-'}
                  </p>
                </article>
                <article className={styles.cardSpan}>
                  <h3>Prompt</h3>
                  <p className={styles.breakCell}>{selectedDapp.aiPrompt || '-'}</p>
                </article>
              </div>
            </div>
          </section>
          ) : null}
        </div>
      )}
        </main>
      </div>

      {dappModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setDappModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.panelHeader}>
              <h3>{selectedDappId ? 'Edit DApp' : 'Create DApp'}</h3>
              <button className={styles.secondaryButton} type="button" onClick={() => setDappModalOpen(false)}>
                Close
              </button>
            </div>
            <form className={styles.form} onSubmit={saveDapp}>
              <label className={styles.field}>
                <span>Name</span>
                <input className={styles.input} value={dappForm.name} onChange={(e) => setDappForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Description</span>
                <input className={styles.input} value={dappForm.description} onChange={(e) => setDappForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Order</span>
                <input className={styles.input} type="number" value={dappForm.order} onChange={(e) => setDappForm((p) => ({ ...p, order: Number(e.target.value || 0) }))} />
              </label>
              <label className={styles.field}>
                <span>URL</span>
                <input className={styles.input} value={dappForm.url} onChange={(e) => setDappForm((p) => ({ ...p, url: e.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Icon</span>
                <input className={styles.input} value={dappForm.icon} onChange={(e) => setDappForm((p) => ({ ...p, icon: e.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Upload image</span>
                <input className={styles.input} type="file" accept="image/*" onChange={(event) => void uploadDappImage(event)} />
              </label>
              <label className={styles.field}>
                <span>Categories</span>
                <div className={styles.checkboxGrid}>
                  {dappTabs.filter((tab) => !isAiDrivenTab(tab)).map((tab) => (
                    <label key={tab.id} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={dappForm.categories.includes(tab.id)}
                        onChange={(event) => {
                          setDappForm((prev) => ({
                            ...prev,
                            categories: event.target.checked
                              ? Array.from(new Set([...prev.categories, tab.id]))
                              : prev.categories.filter((item) => item !== tab.id),
                          }));
                        }}
                      />
                      <span>{tab.label}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label className={styles.field}>
                <span>Primary Category</span>
                <select
                  className={styles.select}
                  value={dappForm.primaryCategory ?? ''}
                  onChange={(event) =>
                    setDappForm((prev) => ({
                      ...prev,
                      primaryCategory: event.target.value ? event.target.value : undefined,
                    }))
                  }
                >
                  <option value="">Not set</option>
                  {dappForm.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={dappForm.aiDriven}
                  onChange={(event) =>
                    setDappForm((prev) => ({
                      ...prev,
                      aiDriven: event.target.checked,
                      toolIds: event.target.checked ? prev.toolIds : [],
                    }))
                  }
                />
                <span>AI Driven</span>
              </label>
              {dappForm.aiDriven ? (
                <label className={styles.field}>
                  <span>Tools</span>
                  <div className={styles.checkboxGrid}>
                    {toolDefinitions.map((tool) => (
                      <label key={tool.id} className={styles.checkboxItem}>
                        <input
                          type="checkbox"
                          checked={dappForm.toolIds.includes(tool.id)}
                          onChange={(event) =>
                            setDappForm((prev) => ({
                              ...prev,
                              toolIds: event.target.checked
                                ? Array.from(new Set([...prev.toolIds, tool.id]))
                                : prev.toolIds.filter((item) => item !== tool.id),
                            }))
                          }
                        />
                        <span>{tool.displayName}</span>
                      </label>
                    ))}
                  </div>
                </label>
              ) : null}
              <label className={styles.field}>
                <span>AI Prompt</span>
                <textarea className={styles.textarea} value={dappForm.aiPrompt} onChange={(e) => setDappForm((p) => ({ ...p, aiPrompt: e.target.value }))} />
              </label>
              <div className={styles.actionRow}>
                {uploadingImage ? <span className={styles.muted}>Uploading...</span> : <span />}
                <button className={styles.primaryButton} type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tabsModalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setTabsModalOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.panelHeader}>
              <h3>Manage DApp Tabs</h3>
              <button className={styles.secondaryButton} type="button" onClick={() => setTabsModalOpen(false)}>
                Close
              </button>
            </div>
            <form className={styles.form} onSubmit={saveTabs}>
              <div className={styles.list}>
                {tabDrafts.map((tab) => (
                  <div key={tab.id} className={styles.listItemForm}>
                    <input
                      className={styles.input}
                      value={tab.id}
                      onChange={(event) => setTabDrafts((prev) => prev.map((item) => item.id === tab.id ? { ...item, id: event.target.value } : item))}
                      placeholder="id"
                    />
                    <input
                      className={styles.input}
                      value={tab.label}
                      onChange={(event) => setTabDrafts((prev) => prev.map((item) => item.id === tab.id ? { ...item, label: event.target.value } : item))}
                      placeholder="label"
                    />
                    <input
                      className={styles.input}
                      type="number"
                      value={tab.order}
                      onChange={(event) => setTabDrafts((prev) => prev.map((item) => item.id === tab.id ? { ...item, order: Number(event.target.value || 0) } : item))}
                      placeholder="order"
                    />
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => setTabDrafts((prev) => prev.filter((item) => item.id !== tab.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setTabDrafts((prev) => [...prev, {
                    id: `tab-${Date.now()}`,
                    label: '',
                    order: prev.length,
                    enabled: true,
                  }])}
                >
                  + Add Tab
                </button>
                <button className={styles.primaryButton} type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Tabs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
