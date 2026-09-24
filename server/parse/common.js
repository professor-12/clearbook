// Deterministic parsing shared by the CSV and PDF readers. Numbers and dates are
// code's job, never Jev's.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "--") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (/\bDR\b/i.test(s)) sign = -1;
  s = s.replace(/\b(CR|DR|NGN)\b/gi, "").replace(/[₦$£€,\s]/g, "");
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return sign * Number(s);
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);
const year = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y));

// Nigerian statements default to day-first. Returns YYYY-MM-DD or null.
export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+/g, " ");
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,4})[A-Za-z]*[-/., ]+(\d{2,4})/))) {
    const mon = MONTHS[m[2].toLowerCase()];
    return mon ? iso(year(m[3]), mon, +m[1]) : null;
  }
  if ((m = s.match(/^([A-Za-z]{3,4})[A-Za-z]*[ .-]+(\d{1,2})(?:st|nd|rd|th)?,?[ .-]+(\d{2,4})/))) {
    const mon = MONTHS[m[1].toLowerCase()];
    return mon ? iso(year(m[3]), mon, +m[2]) : null;
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let [d, mo] = [+m[1], +m[2]];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    return iso(year(m[3]), mo, d);
  }
  return null;
}

export const DATE_RE = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/. ][A-Za-z]{3,9}[-/., ]+\d{2,4}|[A-Za-z]{3,9}[ .-]+\d{1,2}(?:st|nd|rd|th)?,?[ .-]+\d{4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;
export const AMOUNT_RE = /\(?-?[₦]?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?(?:\s?(?:CR|DR))?|\(?-?[₦]?\d+\.\d{2}\)?/g;

// Uses running balance to repair missing or unsigned amounts: if balance moved
// by exactly the amount, the direction is whatever the balance says.
export function reconcileWithBalance(rows) {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].balance, cur = rows[i].balance;
    if (prev == null || cur == null) continue;
    const delta = Math.round((cur - prev) * 100) / 100;
    if (rows[i].amount == null) rows[i].amount = delta;
    else if (Math.abs(Math.abs(rows[i].amount) - Math.abs(delta)) < 0.01) rows[i].amount = delta;
  }
  return rows;
}

export function finalizeRows(rows) {
  return rows
    .filter((r) => r.narration && r.amount != null && r.amount !== 0)
    .map((r, i) => ({
      id: i,
      date: r.date,
      narration: r.narration.replace(/\s+/g, " ").trim(),
      amount: Math.round(r.amount * 100) / 100,
      balance: r.balance ?? null,
      direction: r.amount > 0 ? "in" : "out",
    }));
}

// "TOLU BAKARE Account No 0123" -> "TOLU BAKARE"
export const cleanHolder = (s) => s.split(/\s{2,}|\s+(?:account|acct|a\/c|period|number|no\b|bvn|currency)/i)[0].trim();
