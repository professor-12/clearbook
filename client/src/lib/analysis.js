// All aggregation happens here, in code, from Jev's stored answers. Changing the
// review threshold or overriding a category re-derives everything instantly; no
// inference is re-run.
import { OUTFLOW_CATEGORIES, INFLOW_CATEGORIES, CHARGE_TYPES, labelOf } from "../../../shared/taxonomy.js";

export const TRANSFER_SELF = new Set(["own_account", "own_account_in"]);
export const CHARGE_ORDER = ["vat", "emtl", "transfer_fee", "sms_alert", "maintenance", "other_fee"];

const normalize = (n) => n.toUpperCase().replace(/[^A-Z0-9 &]/g, " ").replace(/\s+/g, " ").trim();
const ACRONYMS = new Set("LTD MFB PLC RA RCCG DSTV GOTV FIRS LIRS IKEDC EKEDC AEDC MTN UBA GTB LAWMA FCMB NIG".split(" "));
// Title-case names, but keep acronyms and vowel-less tokens (e.g. "DSTV", "RCCG") upper-case.
const titleCase = (s) => s.split(" ").map((w) => (ACRONYMS.has(w) || !/[AEIOU]/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(" ");

export function categoryOf(r, overrides) {
  return overrides[r.id] ?? r.category;
}

export function chargeTypeOf(r, overrides) {
  if (categoryOf(r, overrides) !== "bank_charges") return null;
  return r.chargeType && r.chargeType !== "not_a_charge" ? r.chargeType : "other_fee";
}

export function buildAliasMap(results, groups) {
  const canonical = {};
  const counts = {};
  for (const r of results) if (r.counterparty) { const n = normalize(r.counterparty); counts[n] = (counts[n] ?? 0) + 1; }
  for (const g of groups ?? []) {
    const best = [...g].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || b.length - a.length)[0];
    for (const n of g) canonical[n] = { name: best, aliases: g };
  }
  return (raw) => {
    const n = normalize(raw);
    const c = canonical[n];
    return { key: c?.name ?? n, display: titleCase(c?.name ?? n), aliases: c?.aliases ?? [n] };
  };
}

const monthKey = (d) => d.slice(0, 7);
const monthLabel = (k) => new Date(k + "-01T00:00:00").toLocaleString("en-GB", { month: "short", year: "2-digit" });

export function summarize(results, { overrides = {}, groups = [], threshold = 0.7 } = {}) {
  const alias = buildAliasMap(results, groups);
  const totals = { in: 0, out: 0, selfIn: 0, selfOut: 0, charges: 0, inCount: 0, outCount: 0 };
  const byCatOut = {}, byCatIn = {}, byCharge = {}, parties = { in: {}, out: {} }, months = {};

  for (const r of results) {
    const cat = categoryOf(r, overrides);
    const amt = Math.abs(r.amount);
    const m = (months[monthKey(r.date)] ??= { key: monthKey(r.date), label: monthLabel(monthKey(r.date)), in: 0, out: 0, charges: {} });
    if (TRANSFER_SELF.has(cat)) {
      r.direction === "in" ? (totals.selfIn += amt) : (totals.selfOut += amt);
      continue; // own-account moves are neither income nor spending
    }
    const bucket = r.direction === "in" ? byCatIn : byCatOut;
    (bucket[cat] ??= { key: cat, label: labelOf(cat), total: 0, count: 0 });
    bucket[cat].total += amt;
    bucket[cat].count += 1;
    if (r.direction === "in") { totals.in += amt; totals.inCount++; m.in += amt; }
    else { totals.out += amt; totals.outCount++; m.out += amt; }

    const ct = chargeTypeOf(r, overrides);
    if (ct) {
      totals.charges += amt;
      (byCharge[ct] ??= { key: ct, label: CHARGE_TYPES[ct]?.label ?? ct, total: 0, count: 0 });
      byCharge[ct].total += amt;
      byCharge[ct].count += 1;
      m.charges[ct] = (m.charges[ct] ?? 0) + amt;
    }
    if (r.counterparty) {
      const a = alias(r.counterparty);
      const p = (parties[r.direction][a.key] ??= { key: a.key, name: a.display, aliases: a.aliases, total: 0, count: 0, categories: {} });
      p.total += amt;
      p.count += 1;
      p.categories[cat] = (p.categories[cat] ?? 0) + amt;
    }
  }

  const sortDesc = (o) => Object.values(o).sort((a, b) => b.total - a.total);
  const partyList = (o) => sortDesc(o).map((p) => ({ ...p, topCategory: Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0]?.[0] }));
  const review = results
    .filter((r) => overrides[r.id] == null && r.categoryConfidence < threshold)
    .sort((a, b) => a.categoryConfidence - b.categoryConfidence);

  const flags = {
    betting: byCatOut.betting_gaming ?? null,
    loansRepaid: byCatOut.loan_repayment ?? null,
    loansReceived: byCatIn.loan_disbursement ?? null,
    cash: byCatOut.cash_withdrawal ?? null,
  };

  return {
    totals,
    byCatOut: sortDesc(byCatOut),
    byCatIn: sortDesc(byCatIn),
    byCharge: CHARGE_ORDER.filter((k) => byCharge[k]).map((k) => byCharge[k]),
    partiesOut: partyList(parties.out),
    partiesIn: partyList(parties.in),
    months: Object.values(months).sort((a, b) => a.key.localeCompare(b.key)),
    review,
    flags,
  };
}

export function compareWithRules(results, labels) {
  const rows = results.map((r) => {
    const label = labels?.[r.id]?.narration === r.narration ? labels[r.id] : null;
    return { ...r, truth: label?.category ?? null };
  });
  const disagreements = rows.filter((r) => r.rulesCategory !== r.category);
  // Recurring narrations (monthly bills) differ only by date; show each once.
  const seen = new Set();
  const uniqueDisagreements = disagreements.filter((r) => {
    const k = r.narration.replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\b|\d+/gi, "");
    return !seen.has(k) && seen.add(k);
  });
  const judged = disagreements.filter((r) => r.truth);
  const scored = rows.filter((r) => r.truth);
  return {
    disagreements,
    uniqueDisagreements,
    disagreementWins: judged.length ? { n: judged.length, jev: judged.filter((r) => r.category === r.truth).length, rules: judged.filter((r) => r.rulesCategory === r.truth).length } : null,
    agreement: rows.length ? 1 - disagreements.length / rows.length : 0,
    accuracy: scored.length
      ? { n: scored.length, jev: scored.filter((r) => r.category === r.truth).length, rules: scored.filter((r) => r.rulesCategory === r.truth).length }
      : null,
  };
}

export const categoriesFor = (direction) => (direction === "in" ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES);

// Does Jev's confidence separate right answers from wrong ones? Needs labels.
export function calibration(results, labels, threshold) {
  const scored = results
    .map((r) => ({ r, truth: labels?.[r.id]?.narration === r.narration ? labels[r.id].category : null }))
    .filter((x) => x.truth);
  if (!scored.length) return null;
  const right = scored.filter((x) => x.r.category === x.truth);
  const wrong = scored.filter((x) => x.r.category !== x.truth);
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x.r.categoryConfidence, 0) / xs.length : null);
  return {
    n: scored.length,
    right: right.length,
    wrong: wrong.length,
    meanRight: mean(right),
    meanWrong: mean(wrong),
    wrongCaught: wrong.filter((x) => x.r.categoryConfidence < threshold).length,
    rightHeld: right.filter((x) => x.r.categoryConfidence < threshold).length,
    autoAccepted: scored.filter((x) => x.r.categoryConfidence >= threshold).length,
    autoAcceptedWrong: wrong.filter((x) => x.r.categoryConfidence >= threshold).length,
  };
}
