import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNftRewardCollections,
  fetchNftRewardPayouts,
  fetchNftRewardRunDetail,
  fetchNftRewardRuns,
  fetchNftRewardSummary,
} from './nft-rewards-api';

const fetchMock = vi.fn();

describe('NFT reward API client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends the payout filters as a read-only admin request', async () => {
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'https://api.example/');
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 })));

    await fetchNftRewardPayouts({
      adminKey: 'secret', page: 2, limit: 50,
      rewardDate: '2026-08-15', state: 'RETRY_WAIT',
      walletAddress: '0xabc', txHash: '0xdef',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/admin/nft-rewards/payouts?page=2&limit=50&rewardDate=2026-08-15&state=RETRY_WAIT&walletAddress=0xabc&txHash=0xdef',
      expect.objectContaining({
        method: 'GET', cache: 'no-store',
        headers: expect.objectContaining({ 'x-admin-key': 'secret' }),
      }),
    );
  });

  it('uses all five read-only reward paths', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example/api');
    vi.stubGlobal('fetch', fetchMock.mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
    ));

    await fetchNftRewardSummary('secret');
    await fetchNftRewardCollections('secret');
    await fetchNftRewardRuns({ adminKey: 'secret', page: 1, limit: 25 });
    await fetchNftRewardRunDetail({ adminKey: 'secret', runId: 'run/id', page: 1, limit: 25 });
    await fetchNftRewardPayouts({ adminKey: 'secret', page: 1, limit: 50 });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example/api/admin/nft-rewards/summary',
      'https://api.example/api/admin/nft-rewards/collections',
      'https://api.example/api/admin/nft-rewards/runs?page=1&limit=25',
      'https://api.example/api/admin/nft-rewards/runs/run%2Fid?page=1&limit=25',
      'https://api.example/api/admin/nft-rewards/payouts?page=1&limit=50',
    ]);
  });

  it('propagates backend messages and rejects invalid or unsafe responses', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example/api');
    vi.stubGlobal('fetch', fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not authorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ signedRawTransaction: 'secret' }), { status: 200 })));

    await expect(fetchNftRewardSummary('secret')).rejects.toThrow('Not authorized');
    await expect(fetchNftRewardSummary('secret')).rejects.toThrow('Invalid NFT reward API response');
    await expect(fetchNftRewardSummary('secret')).rejects.toThrow('Unsafe NFT reward API response');
  });
});
