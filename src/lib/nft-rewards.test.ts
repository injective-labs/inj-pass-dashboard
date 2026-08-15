import { describe, expect, it } from 'vitest';
import {
  formatInjWei,
  getBlockscoutTxUrl,
  getBudgetPercent,
  getWorkerState,
} from './nft-rewards';

describe('NFT reward dashboard helpers', () => {
  it('formats wei without Number precision loss', () => {
    expect(formatInjWei('10000000000000000')).toBe('0.01');
    expect(formatInjWei('70000000000000000')).toBe('0.07');
    expect(formatInjWei('123456789012345678901')).toBe('123.456789012345678901');
  });

  it('computes budget percentage using bigint', () => {
    expect(getBudgetPercent({
      capWei: '1000000000000000000',
      reservedWei: '250000000000000000',
      confirmedWei: '500000000000000000',
    })).toBe(75);
  });

  it('distinguishes disabled, stale, healthy, and critical workers', () => {
    expect(getWorkerState({ worker: null, heartbeatStale: true })).toBe('STALE');
    expect(getWorkerState({ worker: { enabled: false }, heartbeatStale: false })).toBe('DISABLED');
    expect(getWorkerState({ worker: { enabled: true, criticalErrorCode: null }, heartbeatStale: false })).toBe('HEALTHY');
    expect(getWorkerState({ worker: { enabled: true, criticalErrorCode: 'UNKNOWN_NONCE_COLLISION' }, heartbeatStale: false })).toBe('CRITICAL');
  });

  it('creates only Injective Blockscout transaction links', () => {
    expect(getBlockscoutTxUrl(`0x${'ab'.repeat(32)}`))
      .toBe(`https://blockscout.injective.network/tx/0x${'ab'.repeat(32)}`);
    expect(getBlockscoutTxUrl('not-a-hash')).toBeNull();
  });
});
