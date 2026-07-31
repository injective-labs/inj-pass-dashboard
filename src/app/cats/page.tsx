'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchCatAssetBatches,
  fetchCatMetadataItems,
  fetchCatMintRecords,
  getDefaultAdminKey,
  type AdminCatAssetBatch,
  type AdminCatMetadataItem,
  type AdminCatMintRecord,
} from '@/lib/admin-api';

const ADMIN_KEY_STORAGE = 'inj-dashboard-admin-key';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function CatMetadataManagerPage() {
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [adminKey, setAdminKey] = useState('');

  const [batches, setBatches] = useState<AdminCatAssetBatch[]>([]);
  const [metadataRows, setMetadataRows] = useState<AdminCatMetadataItem[]>([]);
  const [mintRows, setMintRows] = useState<AdminCatMintRecord[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_KEY_STORAGE) || getDefaultAdminKey();
    setAdminKeyInput(stored);
    setAdminKey(stored);
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    void loadAll(adminKey, selectedBatchId);
  }, [adminKey, selectedBatchId]);

  async function loadAll(key: string, batchId?: number) {
    setLoading(true);
    setError(null);
    try {
      const [batchRes, metadataRes, mintRes] = await Promise.all([
        fetchCatAssetBatches({ adminKey: key }),
        fetchCatMetadataItems({ adminKey: key, batchId, page: 1, limit: 100 }),
        fetchCatMintRecords({ adminKey: key, page: 1, limit: 100 }),
      ]);

      setBatches(batchRes.items || []);
      setMetadataRows(metadataRes.items || []);
      setMintRows(mintRes.items || []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load cat metadata page');
      setBatches([]);
      setMetadataRows([]);
      setMintRows([]);
    } finally {
      setLoading(false);
    }
  }

  function saveAdminKey() {
    window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKeyInput);
    setAdminKey(adminKeyInput);
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: 20 }}>
      <div style={{ display: 'grid', gap: 14, maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Cat NFT Metadata Manager</h1>
            <p style={{ margin: '6px 0 0', color: '#64748b' }}>
              Database-first metadata management and minted visibility
            </p>
          </div>
          <Link href="/" style={{ color: '#1d4ed8', fontWeight: 600 }}>
            Back to Dashboard
          </Link>
        </div>

        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 16, display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Admin Key</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={adminKeyInput}
              onChange={(event) => setAdminKeyInput(event.target.value)}
              placeholder="x-admin-key"
              style={{ flex: 1, minHeight: 40, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 12px' }}
            />
            <button
              onClick={saveAdminKey}
              style={{ minHeight: 40, padding: '0 14px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}
            >
              Connect
            </button>
          </div>
        </section>

        {error && (
          <div style={{ border: '1px solid #fecaca', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', padding: 12 }}>
            {error}
          </div>
        )}

        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Asset Batches</h2>
            <span style={{ fontSize: 12, color: '#64748b' }}>{loading ? 'Loading...' : `${batches.length} batches`}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedBatchId(undefined)}
              style={{ border: '1px solid #cbd5e1', borderRadius: 999, padding: '6px 12px', background: selectedBatchId ? '#fff' : '#eff6ff' }}
            >
              All
            </button>
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                style={{ border: '1px solid #cbd5e1', borderRadius: 999, padding: '6px 12px', background: selectedBatchId === batch.id ? '#eff6ff' : '#fff' }}
              >
                #{batch.id} {batch.name}
              </button>
            ))}
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Base URI</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>CID</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Items</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{batch.id}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{batch.name}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{batch.baseURI}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{batch.metadataCid}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{batch.totalItems}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{batch.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 16, display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Metadata Items</h2>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Batch</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Serial</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Minted</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Token</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Tx</th>
                </tr>
              </thead>
              <tbody>
                {metadataRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.batchId}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.serialNo}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.name}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.status}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.minted ? 'Yes' : 'No'}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.mintedTokenId || '-'}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{row.mintedTxHash || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 16, display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Minted Records</h2>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Token</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Owner</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Tx</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Metadata Item</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Source</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e2e8f0' }}>Minted At</th>
                </tr>
              </thead>
              <tbody>
                {mintRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>#{row.tokenId}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{row.ownerAddress}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{row.txHash}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.metadataItemId ?? '-'}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{row.source}</td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>{formatDate(row.mintedAt || row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
