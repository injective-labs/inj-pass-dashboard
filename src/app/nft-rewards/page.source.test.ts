import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('NFT rewards operations page source', () => {
  const source = readFileSync('src/app/nft-rewards/page.tsx', 'utf8');

  it.each([
    'Worker Health', 'Snapshot', 'Daily Budget', 'Backlog',
    'Collections', 'Reward Runs', 'Payouts',
  ])('renders %s', (label) => expect(source).toContain(label));

  it('remains read-only and refreshes every 30 seconds', () => {
    expect(source).toContain('30_000');
    expect(source).not.toMatch(/method:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/);
    expect(source).not.toMatch(/>\s*(?:Retry|Cancel|Send)\s*</);
  });
});
