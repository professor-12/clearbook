import { cleanHolder, parseAmount, parseDate, reconcileWithBalance, finalizeRows } from "./common.js";
import { systemOne } from "../jev.js";

export function parseCsvText(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\t" || c === ";") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some(Boolean));
}

// Header keywords seen across Nigerian bank exports (GTB, Access, Zenith, Kuda, Opay, Moniepoint...).
const ROLE_PATTERNS = {
  date: /^(trans(action)?\.?\s*)?date|^txn date|^posted|^value date|^date/i,
  narration: /narration|description|details|remarks?|particulars|memo|reference|beneficiary|purpose/i,
  debit: /debit|withdrawal|money out|dr\b|paid out|outflow/i,
  credit: /credit|deposit|lodgement|money in|cr\b|paid in|inflow/i,
  amount: /^amount|^amt|transaction amount/i,
  balance: /balance|bal\b/i,
};
const ROLES = ["date", "narration", "debit", "credit", "amount", "balance"];

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const hits = rows[i].filter((c) => Object.values(ROLE_PATTERNS).some((re) => re.test(c))).length;
    if (hits >= 3) return i;
  }
  return 0;
}

function holderFromPreamble(rows, headerIdx) {
  for (const r of rows.slice(0, headerIdx)) {
    const line = r.join(" ");
    const m = line.match(/account\s*name\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{2,60})/i);
    if (m) return cleanHolder(m[1]);
  }
  return null;
}

// Heuristics first; if a column's role is unclear, ask Jev to pick from the
// header names given a few sample values (select, don't generate).
async function mapColumns(header, samples, ledger) {
  const mapping = {};
  const used = new Set();
  for (const role of ROLES) {
    // A "Reference" column is usually an ID; prefer a real description column when both exist.
    const strong = role === "narration" ? header.findIndex((h, i) => !used.has(i) && /narration|description|details|remarks?/i.test(h)) : -1;
    const idx = strong >= 0 ? strong : header.findIndex((h, i) => !used.has(i) && ROLE_PATTERNS[role].test(h));
    if (idx >= 0) { mapping[role] = idx; used.add(idx); }
  }
  const hasMoney = mapping.amount != null || mapping.debit != null || mapping.credit != null;
  if (mapping.date != null && mapping.narration != null && hasMoney) return { mapping, via: "headers" };

  const columns = header.map((h, i) => ({ header: h || `column ${i + 1}`, examples: samples.map((r) => r[i]).filter(Boolean).slice(0, 3) }));
  const options = Object.fromEntries(columns.map((c, i) => [`col_${i}`, `\`columns[${i}]\` (${c.header})`]));
  const none = { none: "No column plays this role" };
  const ask = (text) => ({ type: "choice", instructions: text, criteria: { ...options, ...none } });
  const answers = await systemOne({ columns }, {
    date: ask("Which column in `columns` holds the transaction date?"),
    narration: ask("Which column in `columns` holds the free-text transaction description or narration?"),
    debit: ask("Which column in `columns` holds money leaving the account (debits / withdrawals)?"),
    credit: ask("Which column in `columns` holds money entering the account (credits / deposits)?"),
    amount: ask("Which column in `columns` holds a single signed transaction amount (not split into debit and credit)?"),
    balance: ask("Which column in `columns` holds the running account balance?"),
  }, ledger);
  for (const role of ROLES) {
    if (mapping[role] != null) continue;
    const a = answers[role];
    if (a.choice !== "none" && a.confidence >= 0.5) mapping[role] = Number(a.choice.slice(4));
  }
  return { mapping, via: "jev" };
}

export async function readCsv(text, ledger) {
  const rows = parseCsvText(text);
  const headerIdx = findHeaderRow(rows);
  const header = rows[headerIdx] ?? [];
  const body = rows.slice(headerIdx + 1);
  const { mapping, via } = await mapColumns(header, body.slice(0, 3), ledger);
  const get = (r, role) => (mapping[role] != null ? r[mapping[role]] : undefined);

  const parsed = body.map((r) => {
    let amount = null;
    const debit = parseAmount(get(r, "debit"));
    const credit = parseAmount(get(r, "credit"));
    if (debit) amount = -Math.abs(debit);
    else if (credit) amount = Math.abs(credit);
    else amount = parseAmount(get(r, "amount"));
    return { date: parseDate(get(r, "date")), narration: get(r, "narration") ?? "", amount, balance: parseAmount(get(r, "balance")) };
  }).filter((r) => r.date);

  const transactions = finalizeRows(reconcileWithBalance(parsed));
  return {
    transactions,
    holder: holderFromPreamble(rows, headerIdx),
    columns: Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, header[v]])),
    columnsVia: via,
  };
}
