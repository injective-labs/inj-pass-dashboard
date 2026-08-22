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
  /** Canonical internal id, matching the backend. Never rename. */
  id: 'points',
  /** Ticker shown next to amounts. */
  symbol: 'LAM',
  /** Full name, where a symbol would read too terse. */
  name: 'LAM',
} as const;
