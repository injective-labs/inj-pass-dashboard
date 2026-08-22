/**
 * Display name for the spendable balance unit.
 *
 * The internal identifier is `points` everywhere — database columns, API
 * fields, protocol types. Only the name shown to a human lives here.
 *
 * This mirrors `inj-pass-frontend/src/config/currency.ts`. The two are separate
 * repos so the value cannot be shared; if the product name changes, update
 * both. Nothing else in this project should contain the brand string.
 */
export const CURRENCY = {
  /**
   * Decimals the ledger stores. Balances are tiny after the LAM -> xINJ
   * redenomination (a typical account holds ~0.0002), so admin views must not
   * fall back to two decimals or every balance reads as zero.
   */
  decimals: 6,
  /** Canonical internal id, matching the backend. Never rename. */
  id: 'points',
  /** Ticker shown next to amounts. */
  symbol: 'xINJ',
  /** Full name, where a symbol would read too terse. */
  name: 'xINJ',
} as const;

/** Format a points amount without dropping the small balances to zero. */
export function formatPoints(value: number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return '0';
  if (Math.abs(amount) >= 1000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const text = amount.toFixed(CURRENCY.decimals).replace(/\.?0+$/, '');
  if (Number(text) === 0) return `<0.${'0'.repeat(CURRENCY.decimals - 1)}1`;
  return text;
}
