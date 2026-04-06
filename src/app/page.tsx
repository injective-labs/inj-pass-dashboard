'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  adjustUserBalance,
  fetchAdminDapps,
  fetchPasskeyCredentials,
  fetchUserDetail,
  fetchUsers,
  getDefaultAdminKey,
  saveAdminDapp,
  saveAdminDappTabs,
  uploadAdminDappImage,
  type AdminDAppCategory,
  type AdminDAppRow,
  type AdminDAppTab,
  type AdminPasskeyCredentialRow,
  type AdminUserDetail,
  type AdminUserRow,
} from '@/lib/admin-api';
import styles from './page.module.css';

const ADMIN_KEY_STORAGE = 'inj-dashboard-admin-key';
const DEFAULT_PAGE_SIZE = 10;

type ModuleKey = 'users' | 'passkey-credentials' | 'dapps';
type UserSubview = 'list' | 'ai' | 'ninja';
type DAppEditorState = {
  id?: string;
  name: string;
  description: string;
  categories: AdminDAppCategory[];
  order: number;
  url: string;
  icon: string;
  featured: boolean;
};

const EMPTY_DAPP_FORM: DAppEditorState = {
  name: '',
  description: '',
  categories: [],
  order: 0,
  url: '',
  icon: '',
  featured: false,
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

export default function HomePage() {
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [activeAdminKey, setActiveAdminKey] = useState('');
  const [activeModule, setActiveModule] = useState<ModuleKey>('users');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [credentials, setCredentials] = useState<AdminPasskeyCredentialRow[]>([]);
  const [dapps, setDapps] = useState<AdminDAppRow[]>([]);
  const [focusedUser, setFocusedUser] = useState<AdminUserRow | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userSubview, setUserSubview] = useState<UserSubview>('list');
  const [usersLoading, setUsersLoading] = useState(false);
  const [dappsLoading, setDappsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDapp, setSavingDapp] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dappModalOpen, setDappModalOpen] = useState(false);
  const [tabsModalOpen, setTabsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCredentials, setTotalCredentials] = useState(0);
  const [balanceMode, setBalanceMode] = useState<'set' | 'increment'>('increment');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [dappForm, setDappForm] = useState<DAppEditorState>(EMPTY_DAPP_FORM);
  const [selectedDappId, setSelectedDappId] = useState<string | null>(null);
  const [dappTabs, setDappTabs] = useState<AdminDAppTab[]>([]);
  const [tabDrafts, setTabDrafts] = useState<AdminDAppTab[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getDefaultAdminKey();
    setAdminKeyInput(stored);
    setActiveAdminKey(stored);
  }, []);

  useEffect(() => {
    if (!activeAdminKey) return;
    if (activeModule === 'users') {
      void loadUsers(activeAdminKey, query, currentPage, pageSize);
      return;
    }
    if (activeModule === 'dapps') {
      void loadDapps(activeAdminKey, query);
      return;
    }
    void loadPasskeyCredentials(activeAdminKey, query, currentPage, pageSize);
    // Intentionally trigger reloads only on query/pagination/module/key changes.
    // Load helpers are stable enough for this controlled fetch effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAdminKey, activeModule, query, currentPage, pageSize]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!focusedUser || !activeAdminKey || userSubview === 'list') return;
    void loadUserDetail(focusedUser.id, activeAdminKey);
  }, [focusedUser, activeAdminKey, userSubview]);

  async function loadUsers(
    nextKey = activeAdminKey,
    nextQuery = query,
    nextPage = currentPage,
    nextPageSize = pageSize,
  ) {
    if (!nextKey) {
      setError('Please enter admin key first.');
      return;
    }

    setUsersLoading(true);
    setError(null);

    try {
      const data = await fetchUsers({
        adminKey: nextKey,
        query: nextQuery,
        page: nextPage,
        limit: nextPageSize,
      });

      setUsers(data.users);
      setTotalUsers(data.total);

      if (focusedUser) {
        const nextFocused = data.users.find((user) => user.id === focusedUser.id);
        if (nextFocused) {
          setFocusedUser(nextFocused);
        }
      }
    } catch (nextError) {
      setUsers([]);
      setTotalUsers(0);
      setFocusedUser(null);
      setUserDetail(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadUserDetail(userId: number, adminKey: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchUserDetail(userId, adminKey);
      setUserDetail(detail);
    } catch (nextError) {
      setUserDetail(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load user detail');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadPasskeyCredentials(
    nextKey = activeAdminKey,
    nextQuery = query,
    nextPage = currentPage,
    nextPageSize = pageSize,
  ) {
    if (!nextKey) {
      setError('Please enter admin key first.');
      return;
    }

    setUsersLoading(true);
    setError(null);

    try {
      const data = await fetchPasskeyCredentials({
        adminKey: nextKey,
        query: nextQuery,
        page: nextPage,
        limit: nextPageSize,
      });
      setCredentials(data.credentials);
      setTotalCredentials(data.total);
    } catch (nextError) {
      setCredentials([]);
      setTotalCredentials(0);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load passkey credentials');
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadDapps(nextKey = activeAdminKey, nextQuery = query) {
    if (!nextKey) {
      setError('Please enter admin key first.');
      return;
    }

    setDappsLoading(true);
    setError(null);

    try {
      const data = await fetchAdminDapps({
        adminKey: nextKey,
        query: nextQuery,
      });

      setDapps(data.dapps);
      const sortedTabs = data.tabs
        .slice()
        .sort((left, right) => left.order - right.order);
      setDappTabs(sortedTabs);
      setTabDrafts(sortedTabs);

      if (selectedDappId) {
        const selected = data.dapps.find((item) => item.id === selectedDappId);
        if (selected) {
          setDappForm({
            id: selected.id,
            name: selected.name,
            description: selected.description,
            categories: selected.categories,
            order: selected.order,
            url: selected.url,
            icon: selected.icon,
            featured: Boolean(selected.featured),
          });
        }
      }
    } catch (nextError) {
      setDapps([]);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load dapps');
    } finally {
      setDappsLoading(false);
    }
  }

  function handleConnect() {
    window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKeyInput);
    setSuccess('Admin key saved.');
    setCurrentPage(1);
    setActiveAdminKey(adminKeyInput);
  }

  function handleSearch() {
    setCurrentPage(1);
    if (activeModule === 'users') {
      setUserSubview('list');
    }
    setError(null);
    setQuery(queryInput.trim());
  }

  function handleResetSearch() {
    setQueryInput('');
    setQuery('');
    setCurrentPage(1);
    if (activeModule === 'users') {
      setUserSubview('list');
    }
    setError(null);
  }

  function handleModuleChange(module: ModuleKey) {
    setActiveModule(module);
    setCurrentPage(1);
    setQuery('');
    setQueryInput('');
    setError(null);
    setSuccess(null);
    if (module === 'users') {
      setUserSubview('list');
      return;
    }
    if (module === 'dapps') {
      setFocusedUser(null);
      setUserDetail(null);
      return;
    }
    setUserDetail(null);
  }

  function editDapp(dapp: AdminDAppRow) {
    setSelectedDappId(dapp.id);
    setDappForm({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      categories: dapp.categories,
      order: dapp.order,
      url: dapp.url,
      icon: dapp.icon,
      featured: Boolean(dapp.featured),
    });
    setDappModalOpen(true);
    setError(null);
    setSuccess(null);
  }

  function resetDappForm() {
    setSelectedDappId(null);
    setDappForm(EMPTY_DAPP_FORM);
    setError(null);
    setSuccess(null);
  }

  function openCreateDappModal() {
    resetDappForm();
    setDappForm((current) => ({
      ...current,
      categories: dappTabs[0]?.id ? [dappTabs[0].id] : [],
    }));
    setDappModalOpen(true);
  }

  function closeDappModal() {
    setDappModalOpen(false);
  }

  function openTabsModal() {
    setTabDrafts(dappTabs.slice().sort((left, right) => left.order - right.order));
    setTabsModalOpen(true);
  }

  function closeTabsModal() {
    setTabsModalOpen(false);
  }

  function addTabDraft() {
    setTabDrafts((current) => [
      ...current,
      {
        id: `tab-${Date.now()}`,
        label: '',
        order: current.length,
        enabled: true,
      },
    ]);
  }

  function removeTabDraft(tabId: string) {
    setTabDrafts((current) => current.filter((item) => item.id !== tabId));
  }

  async function openUserSubview(user: AdminUserRow, view: Exclude<UserSubview, 'list'>) {
    setFocusedUser(user);
    setUserSubview(view);
    setUserDetail(null);
    await loadUserDetail(user.id, activeAdminKey);
  }

  function backToUsers() {
    setUserSubview('list');
    setUserDetail(null);
  }

  async function handleBalanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!focusedUser || !activeAdminKey) return;

    const amount = Number(balanceAmount);
    if (!Number.isFinite(amount)) {
      setError('Please enter a valid NINJA amount.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await adjustUserBalance({
        adminKey: activeAdminKey,
        userId: focusedUser.id,
        amount,
        mode: balanceMode,
        reason: balanceReason,
      });
      setSuccess(`Balance updated: ${result.delta >= 0 ? '+' : ''}${formatNumber(result.delta, 4)} NINJA`);
      setBalanceAmount('');
      setBalanceReason('');
      await loadUsers();
      await loadUserDetail(focusedUser.id, activeAdminKey);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to update balance');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDappSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdminKey) {
      setError('Please enter admin key first.');
      return;
    }

    if (sortedDappTabs.length === 0) {
      setError('Create tabs first in Manage Tabs before saving a dapp.');
      return;
    }

    if (
      !dappForm.name.trim() ||
      !dappForm.url.trim() ||
      !dappForm.icon.trim() ||
      dappForm.categories.length === 0
    ) {
      setError('Name, at least one category, URL and icon are required.');
      return;
    }

    if (!Number.isFinite(dappForm.order)) {
      setError('Please enter a valid DApp order.');
      return;
    }

    setSavingDapp(true);
    setError(null);
    setSuccess(null);

    try {
      const saved = await saveAdminDapp({
        adminKey: activeAdminKey,
        id: dappForm.id,
        name: dappForm.name,
        description: dappForm.description,
        categories: dappForm.categories,
        order: dappForm.order,
        url: dappForm.url,
        icon: dappForm.icon,
        featured: dappForm.featured,
      });

      setSelectedDappId(saved.id);
      setDappForm({
        id: saved.id,
        name: saved.name,
        description: saved.description,
        categories: saved.categories,
        order: saved.order,
        url: saved.url,
        icon: saved.icon,
        featured: Boolean(saved.featured),
      });
      setSuccess(`DApp ${dappForm.id ? 'updated' : 'created'} successfully.`);
      await loadDapps(activeAdminKey, query);
      setDappModalOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save dapp');
    } finally {
      setSavingDapp(false);
    }
  }

  async function handleDappImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeAdminKey) return;

    setUploadingImage(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadAdminDappImage({
        adminKey: activeAdminKey,
        file,
      });

      setDappForm((current) => ({
        ...current,
        icon: result.publicUrl,
      }));
      setSuccess('Image uploaded successfully.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  async function handleTabsSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdminKey) {
      setError('Please enter admin key first.');
      return;
    }

    const normalizedTabs = tabDrafts
      .map((tab, index) => ({
        ...tab,
        id: normalizeTabId(tab.id),
        label: tab.label.trim(),
        order: Number.isFinite(tab.order) ? tab.order : index,
      }))
      .filter((tab) => tab.id && tab.label)
      .sort((left, right) => left.order - right.order);

    if (normalizedTabs.length === 0) {
      setError('Please keep at least one valid tab.');
      return;
    }

    const ids = normalizedTabs.map((tab) => tab.id);
    if (new Set(ids).size !== ids.length) {
      setError('Tab ids must be unique.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await saveAdminDappTabs({
        adminKey: activeAdminKey,
        tabs: normalizedTabs,
      });
      const sortedTabs = result.tabs.slice().sort((left, right) => left.order - right.order);
      setDappTabs(sortedTabs);
      setTabDrafts(sortedTabs);
      setSuccess('Tabs updated successfully.');
      setTabsModalOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save tabs');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = getPageCount(totalUsers, pageSize);
  const totalCredentialPages = getPageCount(totalCredentials, pageSize);
  const selectedDapp = selectedDappId ? dapps.find((item) => item.id === selectedDappId) ?? null : null;
  const sortedDappTabs = dappTabs.slice().sort((left, right) => left.order - right.order);
  const categoryLabelMap = useMemo(
    () =>
      Object.fromEntries(
        sortedDappTabs.map((tab) => [tab.id, tab.label]),
      ) as Record<string, string>,
    [sortedDappTabs],
  );

  const breadcrumb = useMemo(() => {
    if (activeModule === 'passkey-credentials') {
      return ['Passkey Credentials'];
    }
    if (activeModule === 'dapps') {
      return selectedDapp ? ['DApps', selectedDapp.name] : ['DApps'];
    }
    const items = ['Users'];
    if (focusedUser && userSubview !== 'list') {
      items.push(`#${focusedUser.id}`);
      items.push(userSubview === 'ai' ? 'AI Usage' : 'NINJA');
    }
    return items;
  }, [activeModule, focusedUser, selectedDapp, userSubview]);

  function renderUsersTable() {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Users</h2>
            <p>Total {totalUsers}</p>
          </div>
        </div>

        <div className={styles.searchBar}>
          <input
            className={styles.input}
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search by user id, invite code, credential or wallet"
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
          />
          <button className={styles.secondaryButton} type="button" onClick={handleResetSearch}>
            Reset
          </button>
          <button className={styles.primaryButton} type="button" onClick={handleSearch}>
            Search
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Wallet Address</th>
                <th>Invite Code</th>
                <th>Invited By</th>
                <th>NINJA</th>
                <th>AI Requests</th>
                <th>Last AI</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>No users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.userName}>#{user.id} {user.walletName || 'Unnamed User'}</div>
                        <div className={styles.userSub}>{user.credentialId}</div>
                      </div>
                    </td>
                    <td className={styles.fullAddress}>{user.walletAddress || '-'}</td>
                    <td>{user.inviteCode}</td>
                    <td>{user.invitedBy || '-'}</td>
                    <td>{formatNumber(user.ninjaBalance)}</td>
                    <td>{formatNumber(user.aiUsage.totalRequests)}</td>
                    <td>{formatDate(user.aiUsage.lastUsedAt)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={() => void openUserSubview(user, 'ai')}
                        >
                          AI Usage
                        </button>
                        <button
                          className={styles.primaryGhostButton}
                          type="button"
                          onClick={() => void openUserSubview(user, 'ninja')}
                        >
                          NINJA
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationBar}>
          <div className={styles.paginationMeta}>
            {totalUsers === 0 ? '0 results' : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalUsers)} / ${totalUsers}`}
          </div>
          <div className={styles.paginationControls}>
            <select
              className={styles.select}
              value={String(pageSize)}
              onChange={(event) => {
                setCurrentPage(1);
                setPageSize(Number(event.target.value));
              }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Prev
            </button>
            <span className={styles.pageIndicator}>
              {currentPage} / {totalPages}
            </span>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderAiUsage() {
    if (detailLoading) {
      return <div className={styles.panel}><div className={styles.emptyCell}>Loading...</div></div>;
    }

    if (!userDetail || !focusedUser) {
      return <div className={styles.panel}><div className={styles.emptyCell}>No user selected.</div></div>;
    }

    return (
      <div className={styles.stack}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>AI Usage for #{focusedUser.id}</h2>
              <p>{focusedUser.walletName || focusedUser.walletAddress || 'Unnamed User'}</p>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={backToUsers}>
              Back to Users
            </button>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}><span>Total Requests</span><strong>{formatNumber(userDetail.aiUsage.totalRequests)}</strong></div>
            <div className={styles.statCard}><span>Input Tokens</span><strong>{formatNumber(userDetail.aiUsage.totalInputTokens)}</strong></div>
            <div className={styles.statCard}><span>Output Tokens</span><strong>{formatNumber(userDetail.aiUsage.totalOutputTokens)}</strong></div>
            <div className={styles.statCard}><span>Total NINJA Cost</span><strong>{formatNumber(userDetail.aiUsage.totalCostNinja, 4)}</strong></div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Recent AI Logs</h2></div></div>
          {userDetail.aiLogs.length === 0 ? (
            <div className={styles.emptyCell}>No AI usage yet.</div>
          ) : (
            <div className={styles.list}>
              {userDetail.aiLogs.map((log) => (
                <article key={log.id} className={styles.listItem}>
                  <div>
                    <div className={styles.itemTitle}>{log.model}</div>
                    <div className={styles.itemSub}>{formatDate(log.createdAt)}</div>
                  </div>
                  <div className={styles.itemMeta}>
                    <span>In {formatNumber(log.inputTokens)}</span>
                    <span>Out {formatNumber(log.outputTokens)}</span>
                    <span>{formatNumber(log.costNinja, 4)} NINJA</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderPasskeyCredentialsTable() {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Passkey Credentials</h2>
            <p>Total {totalCredentials}</p>
          </div>
        </div>

        <div className={styles.searchBar}>
          <input
            className={styles.input}
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search by credential id, user id, wallet or wallet name"
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
          />
          <button className={styles.secondaryButton} type="button" onClick={handleResetSearch}>
            Reset
          </button>
          <button className={styles.primaryButton} type="button" onClick={handleSearch}>
            Search
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Credential ID</th>
                <th>User ID</th>
                <th>Wallet Name</th>
                <th>Wallet Address</th>
                <th>Counter</th>
                <th>Created At</th>
                <th>Updated At</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>Loading...</td>
                </tr>
              ) : credentials.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>No credentials found.</td>
                </tr>
              ) : (
                credentials.map((credential) => (
                  <tr key={credential.id}>
                    <td>{credential.id}</td>
                    <td className={styles.fullAddress}>{credential.credentialId}</td>
                    <td>{credential.userId || '-'}</td>
                    <td>{credential.walletName || '-'}</td>
                    <td className={styles.fullAddress}>{credential.walletAddress || '-'}</td>
                    <td>{credential.counter}</td>
                    <td>{formatDate(credential.createdAt)}</td>
                    <td>{formatDate(credential.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.paginationBar}>
          <div className={styles.paginationMeta}>
            {totalCredentials === 0 ? '0 results' : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalCredentials)} / ${totalCredentials}`}
          </div>
          <div className={styles.paginationControls}>
            <select
              className={styles.select}
              value={String(pageSize)}
              onChange={(event) => {
                setCurrentPage(1);
                setPageSize(Number(event.target.value));
              }}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Prev
            </button>
            <span className={styles.pageIndicator}>
              {currentPage} / {totalCredentialPages}
            </span>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={currentPage >= totalCredentialPages}
              onClick={() => setCurrentPage((page) => Math.min(totalCredentialPages, page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderNinja() {
    if (detailLoading) {
      return <div className={styles.panel}><div className={styles.emptyCell}>Loading...</div></div>;
    }

    if (!userDetail || !focusedUser) {
      return <div className={styles.panel}><div className={styles.emptyCell}>No user selected.</div></div>;
    }

    return (
      <div className={styles.stack}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>NINJA for #{focusedUser.id}</h2>
              <p>{focusedUser.walletName || focusedUser.walletAddress || 'Unnamed User'}</p>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={backToUsers}>
              Back to Users
            </button>
          </div>

          <div className={styles.detailGrid}>
            <div className={styles.detailItem}><span>User</span><strong>{focusedUser.walletName || `#${focusedUser.id}`}</strong></div>
            <div className={styles.detailItem}><span>Wallet</span><strong className={styles.fullAddress}>{focusedUser.walletAddress || '-'}</strong></div>
            <div className={styles.detailItem}><span>Current Balance</span><strong>{formatNumber(userDetail.user.ninjaBalance)}</strong></div>
            <div className={styles.detailItem}><span>Invite Code</span><strong>{focusedUser.inviteCode}</strong></div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Adjust NINJA Balance</h2></div></div>
          <form className={styles.form} onSubmit={handleBalanceSubmit}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Mode</span>
                <select className={styles.select} value={balanceMode} onChange={(event) => setBalanceMode(event.target.value as 'set' | 'increment')}>
                  <option value="increment">Increment</option>
                  <option value="set">Set Balance</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Amount</span>
                <input
                  className={styles.input}
                  value={balanceAmount}
                  onChange={(event) => setBalanceAmount(event.target.value)}
                  placeholder="Amount"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Reason</span>
              <input
                className={styles.input}
                value={balanceReason}
                onChange={(event) => setBalanceReason(event.target.value)}
                placeholder="Reason"
              />
            </label>
            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Recent Transactions</h2></div></div>
          {userDetail.transactions.length === 0 ? (
            <div className={styles.emptyCell}>No transactions yet.</div>
          ) : (
            <div className={styles.list}>
              {userDetail.transactions.map((tx) => (
                <article key={tx.id} className={styles.listItem}>
                  <div>
                    <div className={styles.itemTitle}>{tx.type}</div>
                    <div className={styles.itemSub}>{formatDate(tx.createdAt)}</div>
                  </div>
                  <div className={styles.itemMeta}>
                    <span>{formatNumber(tx.amount, 4)}</span>
                    <span>After {formatNumber(tx.balanceAfter)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderDappsManager() {
    return (
      <div className={styles.stack}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>DApps</h2>
              <p>Total {dapps.length}</p>
            </div>
            <div className={styles.actionGroup}>
              <button className={styles.secondaryButton} type="button" onClick={openTabsModal}>
                Manage Tabs
              </button>
              <button className={styles.secondaryButton} type="button" onClick={openCreateDappModal}>
                New DApp
              </button>
            </div>
          </div>

          <div className={styles.searchBar}>
            <input
              className={styles.input}
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search by name, description, URL or category"
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch();
              }}
            />
            <button className={styles.secondaryButton} type="button" onClick={handleResetSearch}>
              Reset
            </button>
            <button className={styles.primaryButton} type="button" onClick={handleSearch}>
              Search
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Order</th>
                  <th>Categories</th>
                  <th>Link</th>
                  <th>Icon</th>
                  <th>Featured</th>
                  <th>Updated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dappsLoading ? (
                  <tr>
                    <td colSpan={8} className={styles.emptyCell}>Loading...</td>
                  </tr>
                ) : dapps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.emptyCell}>No dapps found.</td>
                  </tr>
                ) : (
                  dapps.map((dapp) => (
                    <tr key={dapp.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.userName}>{dapp.name}</div>
                          <div className={styles.userSub}>{dapp.description}</div>
                        </div>
                      </td>
                      <td>{dapp.order}</td>
                      <td>
                        {(dapp.categories.length > 0 ? dapp.categories : ['-'])
                          .map((category) => categoryLabelMap[category] || category)
                          .join(', ')}
                      </td>
                      <td className={styles.fullAddress}>{dapp.url}</td>
                      <td>
                        <div className={styles.iconCell}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolveDappIcon(dapp.icon)} alt={dapp.name} className={styles.iconThumb} />
                          <div className={styles.userSub}>{dapp.icon}</div>
                        </div>
                      </td>
                      <td>{dapp.featured ? 'Yes' : 'No'}</td>
                      <td>{formatDate(dapp.updatedAt)}</td>
                      <td>
                        <div className={styles.actionGroup}>
                          <button className={styles.secondaryButton} type="button" onClick={() => editDapp(dapp)}>
                            Edit
                          </button>
                          <a
                            className={styles.linkButton}
                            href={dapp.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>INJ Admin Panel</h1>
          <p>Module-based admin dashboard</p>
        </div>
        <div className={styles.headerActions}>
          <input
            className={styles.input}
            type="password"
            value={adminKeyInput}
            onChange={(event) => setAdminKeyInput(event.target.value)}
            placeholder="Admin key"
          />
          <button className={styles.primaryButton} type="button" onClick={handleConnect}>
            Connect
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Modules</h2></div></div>
            <div className={styles.moduleList}>
              <div className={`${styles.moduleButton} ${styles.moduleButtonActive}`}>
                <button
                  type="button"
                  className={`${styles.moduleSwitch} ${activeModule === 'users' ? styles.moduleSwitchActive : ''}`}
                  onClick={() => handleModuleChange('users')}
                >
                  <span className={styles.moduleTitle}>Users</span>
                </button>
                <button
                  type="button"
                  className={`${styles.moduleSwitch} ${activeModule === 'passkey-credentials' ? styles.moduleSwitchActive : ''}`}
                  onClick={() => handleModuleChange('passkey-credentials')}
                >
                  <span className={styles.moduleTitle}>Passkey Credentials</span>
                </button>
                <button
                  type="button"
                  className={`${styles.moduleSwitch} ${activeModule === 'dapps' ? styles.moduleSwitchActive : ''}`}
                  onClick={() => handleModuleChange('dapps')}
                >
                  <span className={styles.moduleTitle}>DApps</span>
                </button>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Context</h2></div></div>
            <div className={styles.contextList}>
              <div className={styles.contextItem}>
                <span>Module</span>
                <strong>
                  {activeModule === 'users'
                    ? 'Users'
                    : activeModule === 'passkey-credentials'
                      ? 'Passkey Credentials'
                      : 'DApps'}
                </strong>
              </div>
              <div className={styles.contextItem}>
                <span>Page</span>
                <strong>{currentPage}</strong>
              </div>
              <div className={styles.contextItem}>
                <span>Page Size</span>
                <strong>{pageSize}</strong>
              </div>
              <div className={styles.contextItem}>
                <span>{activeModule === 'dapps' ? 'Selected DApp' : 'Focused User'}</span>
                {activeModule === 'users' && focusedUser ? (
                  <div className={styles.focusedUserBlock}>
                    <strong>#{focusedUser.id} {focusedUser.walletName || 'Unnamed User'}</strong>
                    <div className={styles.contextSub}>Invite Code: {focusedUser.inviteCode}</div>
                    <div className={styles.contextSub}>NINJA: {formatNumber(focusedUser.ninjaBalance)}</div>
                    <div className={styles.contextSub}>Wallet Address:</div>
                    <div className={styles.fullAddress}>{focusedUser.walletAddress || '-'}</div>
                  </div>
                ) : activeModule === 'passkey-credentials' ? (
                  <div className={styles.contextSub}>Viewing passkey credential records</div>
                ) : activeModule === 'dapps' && selectedDapp ? (
                  <div className={styles.focusedUserBlock}>
                    <strong>{selectedDapp.name}</strong>
                    <div className={styles.contextSub}>
                      Categories: {selectedDapp.categories.map((category) => categoryLabelMap[category] || category).join(', ') || '-'}
                    </div>
                    <div className={styles.contextSub}>Featured: {selectedDapp.featured ? 'Yes' : 'No'}</div>
                    <div className={styles.contextSub}>Link:</div>
                    <div className={styles.fullAddress}>{selectedDapp.url}</div>
                  </div>
                ) : activeModule === 'dapps' ? (
                  <div className={styles.contextSub}>Managing discover dapp content</div>
                ) : (
                  <div className={styles.contextSub}>None</div>
                )}
              </div>
            </div>
          </section>
        </aside>

        <main className={styles.content}>
          {error ? <div className={styles.alertError}>{error}</div> : null}
          {success ? <div className={styles.alertSuccess}>{success}</div> : null}

          <section className={styles.panel}>
            <div className={styles.breadcrumb}>
              {breadcrumb.map((item, index) => (
                <span key={`${item}-${index}`} className={styles.breadcrumbItem}>
                  {index > 0 ? <span className={styles.breadcrumbSep}>/</span> : null}
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </section>

          {activeModule === 'users' && userSubview === 'list' ? renderUsersTable() : null}
          {activeModule === 'users' && userSubview === 'ai' ? renderAiUsage() : null}
          {activeModule === 'users' && userSubview === 'ninja' ? renderNinja() : null}
          {activeModule === 'passkey-credentials' ? renderPasskeyCredentialsTable() : null}
          {activeModule === 'dapps' ? renderDappsManager() : null}
        </main>
      </div>

      {activeModule === 'dapps' && dappModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeDappModal}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{selectedDappId ? `Edit DApp #${selectedDappId}` : 'Create DApp'}</h2>
                <p>Manage the discover page listing stored in Redis.</p>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={closeDappModal}>
                Close
              </button>
            </div>

            <form className={styles.form} onSubmit={handleDappSave}>
              <div className={styles.modalBody}>
                {error ? <div className={styles.alertError}>{error}</div> : null}
                {success ? <div className={styles.alertSuccess}>{success}</div> : null}

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input
                      className={styles.input}
                      value={dappForm.name}
                      onChange={(event) => setDappForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="DApp name"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Categories</span>
                    {sortedDappTabs.length > 0 ? (
                      <div className={styles.categoryGrid}>
                        {sortedDappTabs.map((tab) => {
                          const checked = dappForm.categories.includes(tab.id);
                          return (
                            <label key={tab.id} className={styles.categoryOption}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setDappForm((current) => ({
                                    ...current,
                                    categories: event.target.checked
                                      ? Array.from(new Set([...current.categories, tab.id]))
                                      : current.categories.filter((item) => item !== tab.id),
                                  }))
                                }
                              />
                              <span>{tab.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : dappForm.categories.length > 0 ? (
                      <div className={styles.inlineMeta}>
                        Current categories: {dappForm.categories.join(', ')}
                      </div>
                    ) : (
                      <div className={styles.inlineMeta}>Create tabs first in Manage Tabs.</div>
                    )}
                  </label>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Order</span>
                    <input
                      className={styles.input}
                      type="number"
                      value={dappForm.order}
                      onChange={(event) =>
                        setDappForm((current) => ({
                          ...current,
                          order: Number(event.target.value || 0),
                        }))
                      }
                      placeholder="0"
                    />
                  </label>
                </div>

                <label className={styles.field}>
                  <span>Link</span>
                  <input
                    className={styles.input}
                    value={dappForm.url}
                    onChange={(event) => setDappForm((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://example.com"
                  />
                </label>

                <label className={styles.field}>
                  <span>Description</span>
                  <input
                    className={styles.input}
                    value={dappForm.description}
                    onChange={(event) => setDappForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Short description"
                  />
                </label>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Icon URL</span>
                    <input
                      className={styles.input}
                      value={dappForm.icon}
                      onChange={(event) => setDappForm((current) => ({ ...current, icon: event.target.value }))}
                      placeholder="https://... or /icon.png"
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Upload Image</span>
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleDappImageChange(event)}
                    />
                  </label>
                </div>

                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={dappForm.featured}
                    onChange={(event) => setDappForm((current) => ({ ...current, featured: event.target.checked }))}
                  />
                  <span>Featured</span>
                </label>

                {dappForm.icon ? (
                  <div className={styles.previewCard}>
                    <span>Icon Preview</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveDappIcon(dappForm.icon)} alt={dappForm.name || 'DApp icon preview'} className={styles.previewImage} />
                  </div>
                ) : null}
              </div>

              <div className={styles.modalActions}>
                {uploadingImage ? <span className={styles.inlineMeta}>Uploading image...</span> : <span />}
                <div className={styles.actionGroup}>
                  <button className={styles.secondaryButton} type="button" onClick={closeDappModal}>
                    Cancel
                  </button>
                  <button
                    className={styles.primaryButton}
                    type="submit"
                    disabled={savingDapp || uploadingImage || (!sortedDappTabs.length && dappForm.categories.length === 0)}
                  >
                    {savingDapp ? 'Saving...' : 'Save DApp'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeModule === 'dapps' && tabsModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeTabsModal}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Manage Tabs</h2>
                <p>These tabs are the category source used by every dapp.</p>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={closeTabsModal}>
                Close
              </button>
            </div>

            <form className={styles.form} onSubmit={handleTabsSave}>
              <div className={styles.modalBody}>
                {error ? <div className={styles.alertError}>{error}</div> : null}
                {success ? <div className={styles.alertSuccess}>{success}</div> : null}

                <div className={styles.tabsConfigList}>
                  {tabDrafts
                    .slice()
                    .sort((left, right) => left.order - right.order)
                    .map((tab, index) => (
                      <div key={tab.id} className={styles.tabConfigRow}>
                        <div className={styles.tabConfigMeta}>
                          <strong>{tab.id}</strong>
                          <span>DApp category tab</span>
                        </div>

                        <label className={styles.field}>
                          <span>ID</span>
                          <input
                            className={styles.input}
                            value={tab.id}
                            onChange={(event) =>
                              setTabDrafts((current) =>
                                current.map((item) =>
                                  item.id === tab.id ? { ...item, id: event.target.value } : item,
                                ),
                              )
                            }
                            placeholder="social"
                          />
                        </label>

                        <label className={styles.field}>
                          <span>Label</span>
                          <input
                            className={styles.input}
                            value={tab.label}
                            onChange={(event) =>
                              setTabDrafts((current) =>
                                current.map((item) =>
                                  item.id === tab.id ? { ...item, label: event.target.value } : item,
                                ),
                              )
                            }
                          />
                        </label>

                        <label className={styles.field}>
                          <span>Order</span>
                          <input
                            className={styles.input}
                            type="number"
                            value={tab.order}
                            onChange={(event) =>
                              setTabDrafts((current) =>
                                current.map((item) =>
                                  item.id === tab.id
                                    ? { ...item, order: Number(event.target.value || index) }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>

                        <label className={styles.checkboxField}>
                          <input
                            type="checkbox"
                            checked={tab.enabled}
                            onChange={(event) =>
                              setTabDrafts((current) =>
                                current.map((item) =>
                                  item.id === tab.id ? { ...item, enabled: event.target.checked } : item,
                                ),
                              )
                            }
                          />
                          <span>Enabled</span>
                        </label>

                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={() => removeTabDraft(tab.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>

                <button className={styles.addRowButton} type="button" onClick={addTabDraft}>
                  + Add Tab
                </button>
              </div>

              <div className={styles.modalActions}>
                <span className={styles.inlineMeta}>Saved to Redis as the dapp tab definition.</span>
                <div className={styles.actionGroup}>
                  <button className={styles.secondaryButton} type="button" onClick={closeTabsModal}>
                    Cancel
                  </button>
                  <button className={styles.primaryButton} type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Tabs'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
