/**
 * ISO 4217 currencies that have no decimal subdivision.
 * Invoices in these currencies should be displayed as whole numbers
 * (e.g. "1,234,567 VND"), while all others default to 2 decimal places
 * (e.g. "€1,234.56").
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);
