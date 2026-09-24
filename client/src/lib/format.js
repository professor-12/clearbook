export const naira = (n, { compact = false, sign = false } = {}) => {
  const abs = Math.abs(n);
  const body = compact && abs >= 1000
    ? new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: abs >= 1e6 ? 2 : 1 }).format(abs)
    : abs.toLocaleString("en-NG", { minimumFractionDigits: abs < 1000 && abs % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${sign ? (n < 0 ? "−" : "+") : n < 0 ? "−" : ""}₦${body}`;
};
export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const usd = (x) => (x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(3)}`);
export const shortDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
