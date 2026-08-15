'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getDefaultAdminKey } from '@/lib/admin-api';
import {
  fetchNftRewardCollections,
  fetchNftRewardPayouts,
  fetchNftRewardPreviews,
  fetchNftRewardRunDetail,
  fetchNftRewardRuns,
  fetchNftRewardSummary,
} from '@/lib/nft-rewards-api';
import {
  formatInjWei,
  formatUtc,
  getBlockscoutTxUrl,
  getBudgetPercent,
  getWorkerState,
  type AdminNftRewardPayout,
  type AdminNftRewardPreview,
  type AdminNftRewardRun,
  type AdminNftRewardRunDetail,
  type AdminNftRewardSummary,
  type NftRewardPayoutState,
  type Paginated,
} from '@/lib/nft-rewards';
import styles from './page.module.css';

const ADMIN_KEY_STORAGE = 'inj-dashboard-admin-key';
const RUNS_LIMIT = 25;
const PREVIEWS_LIMIT = 25;
const PAYOUTS_LIMIT = 50;

const PAYOUT_STATES: NftRewardPayoutState[] = [
  'PENDING', 'RESERVED', 'SIGNED', 'BROADCAST_UNKNOWN',
  'BROADCAST', 'CONFIRMED', 'RETRY_WAIT',
];

function getPageCount(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / limit));
}

function getSafeError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/authoriz|forbidden|admin key|401|403/i.test(message)) {
    return 'Authorization failed. Check the admin key and connect again.';
  }
  return 'Unable to load NFT reward monitoring data. Check the backend configuration and try again.';
}

function StateBadge({ state }: { state: string | null | undefined }) {
  const label = state || '-';
  const className = state === 'CRITICAL' || state === 'BROADCAST_UNKNOWN' || state === 'FAILED'
    ? styles.badgeCritical
    : state === 'STALE' || state === 'FAILED_RETRYABLE' || state === 'RETRY_WAIT' || state === 'PARTIAL'
      ? styles.badgeWarning
      : state === 'HEALTHY' || state === 'PAID' || state === 'CONFIRMED' || state === 'COMPLETE'
        ? styles.badgeGood
        : state === 'DISABLED' || state === 'DRY_RUN'
          ? styles.badgeMuted
          : styles.badgeNeutral;
  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const lastPage = getPageCount(total, limit);
  return (
    <div className={styles.pagination}>
      <span>Page {page} of {lastPage} · {total} total</span>
      <div className={styles.actionRow}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}>
          Previous
        </button>
        <button type="button" onClick={() => onChange(Math.min(lastPage, page + 1))} disabled={page >= lastPage}>
          Next
        </button>
      </div>
    </div>
  );
}

function PayoutTransaction({ payout }: { payout: AdminNftRewardPayout }) {
  const explorerUrl = getBlockscoutTxUrl(payout.txHash) || payout.explorerUrl;
  if (!payout.txHash) return <>-</>;
  if (!explorerUrl) return <span className={styles.mono}>{payout.txHash}</span>;
  return (
    <a className={styles.mono} href={explorerUrl} target="_blank" rel="noreferrer">
      {payout.txHash}
    </a>
  );
}

export default function NftRewardsPage() {
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [activeAdminKey, setActiveAdminKey] = useState('');
  const [summary, setSummary] = useState<AdminNftRewardSummary | null>(null);
  const [collections, setCollections] = useState<Awaited<ReturnType<typeof fetchNftRewardCollections>>>([]);
  const [runs, setRuns] = useState<Paginated<AdminNftRewardRun> | null>(null);
  const [previews, setPreviews] = useState<Paginated<AdminNftRewardPreview> | null>(null);
  const [payouts, setPayouts] = useState<Paginated<AdminNftRewardPayout> | null>(null);
  const [runPage, setRunPage] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [rewardDate, setRewardDate] = useState('');
  const [payoutState, setPayoutState] = useState<NftRewardPayoutState | ''>('');
  const [walletQuery, setWalletQuery] = useState('');
  const [txQuery, setTxQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    rewardDate: '', state: '' as NftRewardPayoutState | '', walletAddress: '', txHash: '',
  });
  const [selectedRun, setSelectedRun] = useState<AdminNftRewardRunDetail | null>(null);
  const [selectedRunLoading, setSelectedRunLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (adminKey = activeAdminKey) => {
    if (!adminKey) {
      setError('Enter an admin key to load NFT reward monitoring data.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [summaryResult, collectionResult, previewResult, runResult, payoutResult] = await Promise.all([
        fetchNftRewardSummary(adminKey),
        fetchNftRewardCollections(adminKey),
        fetchNftRewardPreviews({ adminKey, page: previewPage, limit: PREVIEWS_LIMIT }),
        fetchNftRewardRuns({ adminKey, page: runPage, limit: RUNS_LIMIT }),
        fetchNftRewardPayouts({
          adminKey, page: payoutPage, limit: PAYOUTS_LIMIT,
          rewardDate: appliedFilters.rewardDate || undefined,
          state: appliedFilters.state || undefined,
          walletAddress: appliedFilters.walletAddress || undefined,
          txHash: appliedFilters.txHash || undefined,
        }),
      ]);
      setSummary(summaryResult);
      setCollections(collectionResult);
      setPreviews(previewResult);
      setRuns(runResult);
      setPayouts(payoutResult);
      setLastRefresh(new Date().toISOString());
    } catch (nextError) {
      setError(getSafeError(nextError));
    } finally {
      setLoading(false);
    }
  }, [activeAdminKey, appliedFilters, payoutPage, previewPage, runPage]);

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getDefaultAdminKey();
    setAdminKeyInput(stored);
    setActiveAdminKey(stored);
  }, []);

  useEffect(() => {
    if (activeAdminKey) void loadDashboard(activeAdminKey);
  }, [activeAdminKey, loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && activeAdminKey) {
        void loadDashboard(activeAdminKey);
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeAdminKey, loadDashboard]);

  const workerState = summary ? getWorkerState({
    worker: summary.worker,
    heartbeatStale: summary.heartbeatStale,
  }) : null;
  const budgetPercent = summary ? getBudgetPercent(summary.budget) : 0;
  const sortedCollections = useMemo(
    () => collections.slice().sort((left, right) => left.displayOrder - right.displayOrder),
    [collections],
  );

  function connectAdmin() {
    window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKeyInput);
    setActiveAdminKey(adminKeyInput);
    if (adminKeyInput === activeAdminKey) void loadDashboard(adminKeyInput);
  }

  function applyPayoutFilters() {
    setAppliedFilters({
      rewardDate,
      state: payoutState,
      walletAddress: walletQuery,
      txHash: txQuery,
    });
    setPayoutPage(1);
  }

  function clearPayoutFilters() {
    setRewardDate('');
    setPayoutState('');
    setWalletQuery('');
    setTxQuery('');
    setAppliedFilters({ rewardDate: '', state: '', walletAddress: '', txHash: '' });
    setPayoutPage(1);
  }

  async function showRunDetail(run: AdminNftRewardRun) {
    if (!activeAdminKey) return;
    setSelectedRunLoading(true);
    setError(null);
    try {
      const detail = await fetchNftRewardRunDetail({
        adminKey: activeAdminKey,
        runId: run.id,
        page: 1,
        limit: 50,
      });
      setSelectedRun(detail);
    } catch (nextError) {
      setError(getSafeError(nextError));
    } finally {
      setSelectedRunLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Operations</p>
            <h1>NFT Holder Daily INJ Rewards</h1>
            <p>Read-only worker health, snapshot coverage, payout, and backlog monitoring.</p>
          </div>
          <Link href="/" className={styles.backLink}>Back to Dashboard</Link>
        </header>

        <section className={styles.card} aria-labelledby="connection-heading">
          <div className={styles.sectionHeader}>
            <h2 id="connection-heading">Admin Connection</h2>
            <button type="button" onClick={() => void loadDashboard()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className={styles.connectionRow}>
            <label htmlFor="nft-rewards-admin-key">Admin key</label>
            <input
              id="nft-rewards-admin-key"
              type="password"
              value={adminKeyInput}
              placeholder="x-admin-key"
              onChange={(event) => setAdminKeyInput(event.target.value)}
            />
            <button type="button" className={styles.primaryButton} onClick={connectAdmin}>Connect</button>
            <span className={styles.muted}>Last refresh: {formatUtc(lastRefresh)}</span>
          </div>
        </section>

        {error ? <div role="alert" className={styles.error}>{error}</div> : null}

        {summary ? <>
          <section className={styles.metricGrid} aria-label="NFT reward summary">
            <article className={styles.card}>
              <h2>Worker Health</h2>
              <div className={styles.stateLine}><StateBadge state={workerState} /><span>{summary.worker?.leader ? 'Leader' : 'Follower / unavailable'}</span></div>
              <dl>
                <dt>Heartbeat</dt><dd>{formatUtc(summary.worker ? new Date(summary.worker.timestamp).toISOString() : null)}</dd>
                <dt>Instance</dt><dd className={styles.mono}>{summary.worker?.instanceId || '-'}</dd>
                <dt>Critical error</dt><dd>{summary.worker?.criticalErrorCode ? <><StateBadge state="CRITICAL" /> {summary.worker.criticalErrorCode}</> : '-'}</dd>
                <dt>Reward wallet</dt><dd className={styles.mono}>{summary.rewardAddress || summary.worker?.rewardAddress || '-'}</dd>
                <dt>Balance</dt><dd>{formatInjWei(summary.rewardBalanceWei)} INJ</dd>
              </dl>
            </article>
            <article className={styles.card}>
              <h2>Snapshot</h2>
              <dl>
                <dt>Reward date</dt><dd>{summary.today.rewardDate}</dd>
                <dt>Run status</dt><dd><StateBadge state={summary.today.status} /></dd>
                <dt>Late snapshot</dt><dd>{summary.today.lateSnapshot ? 'Yes' : 'No'}</dd>
                <dt>EVM block</dt><dd>{summary.today.evmBlockNumber || '-'}</dd>
                <dt>Block hash</dt><dd className={styles.mono}>{summary.today.evmBlockHash || '-'}</dd>
                <dt>Cosmos height</dt><dd>{summary.today.cosmosHeight || '-'}</dd>
                <dt>Snapshot time</dt><dd>{formatUtc(summary.today.snapshotStartedAt)}</dd>
              </dl>
            </article>
            <article className={styles.card}>
              <h2>Daily Budget</h2>
              <dl>
                <dt>Send date</dt><dd>{summary.budget.sendDate}</dd>
                <dt>Confirmed + reserved</dt><dd>{formatInjWei(summary.budget.confirmedWei)} + {formatInjWei(summary.budget.reservedWei)} INJ</dd>
                <dt>Daily cap</dt><dd>{formatInjWei(summary.budget.capWei)} INJ</dd>
              </dl>
              <div className={styles.progressLabel}><span>Budget used</span><strong>{budgetPercent}%</strong></div>
              <div className={styles.progressTrack} aria-label={`Budget used ${budgetPercent}%`}><span style={{ width: `${budgetPercent}%` }} /></div>
            </article>
            <article className={styles.card}>
              <h2>Backlog</h2>
              <dl>
                <dt>Pending principal</dt><dd>{formatInjWei(summary.backlog.pendingWei)} INJ</dd>
                <dt>Oldest pending date</dt><dd>{summary.backlog.oldestRewardDate || '-'}</dd>
                <dt>Backlog reward days</dt><dd>{summary.backlog.rewardDateCount}</dd>
                <dt>Registered wallets</dt><dd>{summary.today.registeredWalletCount}</dd>
                <dt>Observations / owned pairs</dt><dd>{summary.today.observationCount} / {summary.today.ownedObservationCount}</dd>
                <dt>Entitlements / payouts</dt><dd>{summary.today.entitlementCount} / {summary.today.payoutCount}</dd>
                <dt>Total liability</dt><dd>{formatInjWei(summary.today.totalLiabilityWei)} INJ</dd>
              </dl>
            </article>
          </section>
        </> : null}

        <section className={styles.card} aria-labelledby="collections-heading">
          <div className={styles.sectionHeader}>
            <div><h2 id="collections-heading">Collections</h2><p>Live configured rates. Exactly seven collection entries are required.</p></div>
            <span className={collections.length === 7 ? styles.goodText : styles.errorText}>{collections.length} / 7 configured</span>
          </div>
          {collections.length !== 0 && collections.length !== 7 ? <p className={styles.configurationError}>Configuration error: the API must return exactly seven reward collections.</p> : null}
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Name</th><th>Key</th><th>VM</th><th>Contract</th><th>Enabled</th><th>Rate</th></tr></thead>
              <tbody>{sortedCollections.length === 0 ? <tr><td colSpan={6} className={styles.empty}>No collection data loaded.</td></tr> : sortedCollections.map((collection) => <tr key={collection.key}>
                <td>{collection.displayName}</td><td className={styles.mono}>{collection.key}</td><td><StateBadge state={collection.vmType} /></td><td className={styles.mono}>{collection.contractAddress}</td><td>{collection.enabled ? 'Enabled' : 'Disabled'}</td><td>{formatInjWei(collection.rewardWei)} INJ/day</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="previews-heading">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="previews-heading">Eligibility Previews</h2>
              <p>Independent scans only. These records never create payouts or consume a reward date.</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Started</th><th>Status</th><th>Snapshot</th><th>Registered</th><th>Valid / invalid</th><th>Eligible wallets</th><th>Owned pairs</th><th>Projected reward</th><th>Daily cap</th><th>Collections</th><th>Error</th><th>Completed</th></tr></thead>
              <tbody>{previews?.items.length ? previews.items.map((preview) => <tr key={preview.id}>
                <td>{formatUtc(preview.startedAt)}</td>
                <td><StateBadge state={preview.status} /></td>
                <td>EVM {preview.evmBlockNumber || '-'}<br />Cosmos {preview.cosmosHeight || '-'}</td>
                <td>{preview.registeredWalletCount}</td>
                <td>{preview.validWalletCount} / {preview.invalidWalletCount}</td>
                <td>{preview.eligibleWalletCount}</td>
                <td>{preview.ownedObservationCount} / {preview.observationCount}<br /><span className={styles.muted}>{preview.errorObservationCount} errors</span></td>
                <td>{formatInjWei(preview.projectedLiabilityWei)} INJ</td>
                <td className={preview.exceedsDailyCap ? styles.errorText : styles.goodText}>{formatInjWei(preview.dailyCapWei)} INJ · {preview.exceedsDailyCap ? 'Exceeded' : 'Within cap'}</td>
                <td>{preview.collectionStats.map((collection) => <div key={collection.key}>{collection.displayName}: {collection.ownedWalletCount}{collection.errorCount ? ` (${collection.errorCount} errors)` : ''}</div>)}</td>
                <td>{preview.lastErrorCode || '-'}</td>
                <td>{formatUtc(preview.completedAt)}</td>
              </tr>) : <tr><td colSpan={12} className={styles.empty}>No eligibility previews loaded. Run pnpm nft-rewards:preview in the backend.</td></tr>}</tbody>
            </table>
          </div>
          {previews ? <Pagination page={previewPage} total={previews.total} limit={PREVIEWS_LIMIT} onChange={setPreviewPage} /> : null}
        </section>

        <section className={styles.card} aria-labelledby="runs-heading">
          <div className={styles.sectionHeader}><div><h2 id="runs-heading">Reward Runs</h2><p>Select a run to inspect its frozen snapshot detail.</p></div><span>{selectedRunLoading ? 'Loading detail…' : ''}</span></div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Date</th><th>Status</th><th>Snapshot</th><th>Late</th><th>Wallets</th><th>Owned pairs</th><th>Liability</th><th>Payouts</th><th>Error</th><th>Completed</th></tr></thead>
              <tbody>{runs?.items.length ? runs.items.map((run) => <tr key={run.id}>
                <td><button type="button" className={styles.linkButton} onClick={() => void showRunDetail(run)}>{run.rewardDate}</button></td><td><StateBadge state={run.status} /></td><td>{formatUtc(run.snapshotStartedAt)}</td><td>{run.lateSnapshot ? 'Yes' : 'No'}</td><td>{run.registeredWalletCount}</td><td>{run.ownedObservationCount}</td><td>{formatInjWei(run.totalLiabilityWei)} INJ</td><td>{run.payoutCount}</td><td>{run.lastErrorCode || '-'}</td><td>{formatUtc(run.completedAt)}</td>
              </tr>) : <tr><td colSpan={10} className={styles.empty}>No reward runs loaded.</td></tr>}</tbody>
            </table>
          </div>
          {runs ? <Pagination page={runPage} total={runs.total} limit={RUNS_LIMIT} onChange={setRunPage} /> : null}
        </section>

        {selectedRun ? <section className={styles.card} aria-labelledby="run-detail-heading">
          <div className={styles.sectionHeader}><div><h2 id="run-detail-heading">Run Detail</h2><p>{selectedRun.run.rewardDate} · <StateBadge state={selectedRun.run.status} /></p></div><button type="button" onClick={() => setSelectedRun(null)}>Close detail</button></div>
          <div className={styles.detailGrid}>
            <div><h3>Frozen collections</h3><ul>{selectedRun.collections.map((collection) => <li key={collection.key}>{collection.displayName}: {formatInjWei(collection.rewardWei)} INJ/day</li>)}</ul></div>
            <div><h3>Snapshot totals</h3><p>{selectedRun.observations.total} observations · {selectedRun.entitlements.total} entitlements · {selectedRun.payouts.total} payouts</p></div>
          </div>
        </section> : null}

        <section className={styles.card} aria-labelledby="payouts-heading">
          <div className={styles.sectionHeader}><div><h2 id="payouts-heading">Payouts</h2><p>Filter by reward date, state, wallet address, or transaction hash.</p></div></div>
          <div className={styles.filters}>
            <label>Reward date<input type="date" value={rewardDate} onChange={(event) => setRewardDate(event.target.value)} /></label>
            <label>State<select value={payoutState} onChange={(event) => setPayoutState(event.target.value as NftRewardPayoutState | '')}><option value="">All states</option>{PAYOUT_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
            <label>Wallet address<input value={walletQuery} onChange={(event) => setWalletQuery(event.target.value)} placeholder="0x…" /></label>
            <label>Transaction hash<input value={txQuery} onChange={(event) => setTxQuery(event.target.value)} placeholder="0x…" /></label>
            <div className={styles.filterButtons}><button type="button" className={styles.primaryButton} onClick={applyPayoutFilters}>Apply</button><button type="button" onClick={clearPayoutFilters}>Clear</button></div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Reward date</th><th>Wallet</th><th>Amount</th><th>State</th><th>Send date</th><th>Nonce</th><th>Transaction</th><th>Attempts</th><th>Error</th><th>Confirmed</th></tr></thead>
              <tbody>{payouts?.items.length ? payouts.items.map((payout) => <tr key={payout.id}>
                <td>{payout.rewardDate}</td><td className={styles.mono}>{payout.walletAddress}</td><td>{formatInjWei(payout.amountWei)} INJ</td><td><StateBadge state={payout.state} /></td><td>{payout.sendDate || '-'}</td><td>{payout.nonce || '-'}</td><td><PayoutTransaction payout={payout} /></td><td>{payout.attemptCount}</td><td>{payout.lastErrorCode ? <span className={payout.state === 'BROADCAST_UNKNOWN' ? styles.criticalText : ''}>{payout.lastErrorCode}</span> : '-'}</td><td>{formatUtc(payout.confirmedAt)}</td>
              </tr>) : <tr><td colSpan={10} className={styles.empty}>No payouts loaded.</td></tr>}</tbody>
            </table>
          </div>
          {payouts ? <Pagination page={payoutPage} total={payouts.total} limit={PAYOUTS_LIMIT} onChange={setPayoutPage} /> : null}
        </section>
      </div>
    </main>
  );
}
