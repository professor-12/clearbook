// The Jev pipeline. Code parses, sums and groups; Jev makes the judgments a
// person would make at a glance: what kind of transaction this is, who the other
// party is, whether it is a bank charge, and whether two names are the same party.
import { systemOne, pool } from "./jev.js";
import { OUTFLOW_CATEGORIES, INFLOW_CATEGORIES, CHARGE_TYPES } from "../shared/taxonomy.js";
import { rulesCategory, rulesChargeType } from "./rules.js";

const criteriaOf = (tax) => Object.fromEntries(Object.entries(tax).map(([k, v]) => [k, v.desc]));
const OUT_CRITERIA = criteriaOf(OUTFLOW_CATEGORIES);
const IN_CRITERIA = criteriaOf(INFLOW_CATEGORIES);
const CHARGE_CRITERIA = criteriaOf(CHARGE_TYPES);

const naira = (n) => "₦" + Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- Counterparty candidates: code proposes spans, Jev selects one ----------

const NOISE_WORDS = new Set(("NIP TRF TRANSFER TRANSFERS FROM TO FT MOB MOBILE USSD POS WEB PURCHASE PMT PAYMENT PAYMENTS VIA REF NO ACCT AC A/C " +
  "INWARD OUTWARD CREDIT DEBIT CR DR ONLINE APP INSTANT FOR OF THE AT BY ON IN TXN TRX NGN NG LAGOS LA NIGERIA").split(" "));
const BANKS = /^(GTB|GTBANK|ACCESS|ZENITH|UBA|FIRSTBANK|FIRST BANK|FBN|FCMB|FIDELITY|STANBIC|STERLING|UNION|WEMA|ECOBANK|POLARIS|KEYSTONE|OPAY|KUDA|PALMPAY|MONIEPOINT|MONIE POINT|PAYSTACK|FLUTTERWAVE|QUICKTELLER|INTERSWITCH|REMITA|PAGA|CARBON MFB|VFD|PROVIDUS)$/i;

function trimNoise(words) {
  let a = 0, b = words.length;
  while (a < b && (NOISE_WORDS.has(words[a].toUpperCase()) || /^\d+$/.test(words[a]))) a++;
  while (b > a && (NOISE_WORDS.has(words[b - 1].toUpperCase()) || /^\d+$/.test(words[b - 1]))) b--;
  return words.slice(a, b);
}

const MONTH_WORDS = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*$/i;
const junk = (w) => NOISE_WORDS.has(w.toUpperCase()) || MONTH_WORDS.test(w) || !/[A-Za-z]{2}/.test(w) || /\*{2}|\d{4,}/.test(w);

// Every contiguous span (up to 4 words) of every narration segment, so Jev can
// select "NETFLIX" out of "NETFLIX.COM SUBSCRIPTION CARD" rather than the whole thing.
export function counterpartyCandidates(narration) {
  const segments = narration
    .replace(/\b(TRANSFER|TRF|NIP)\s+(FROM|TO)\b/gi, "|")
    .replace(/\b(FROM|TO|VIA|FOR|BY)\b/gi, (m) => `|${m}|`)
    .split(/[|/\\@:*_]| - | – |\s{2,}/);
  const out = [];
  const add = (text) => {
    text = text.replace(/[.,;]+$/, "");
    if (text.replace(/[^A-Za-z]/g, "").length < 3 || BANKS.test(text)) return;
    if (!out.some((o) => o.toUpperCase() === text.toUpperCase())) out.push(text);
  };
  for (const seg of segments) {
    const words = trimNoise(seg.trim().split(/\s+/).filter(Boolean));
    for (let len = Math.min(4, words.length); len >= 1; len--)
      for (let i = 0; i + len <= words.length; i++) {
        const span = words.slice(i, i + len);
        if (!junk(span[0]) && !junk(span.at(-1))) add(span.join(" "));
      }
  }
  return out.slice(0, 40);
}

// ---- Per-transaction questions ---------------------------------------------

function questionsFor(txn, candidates) {
  const q = {
    category: {
      type: "choice",
      instructions: txn.direction === "out"
        ? "`transaction` is money leaving the bank account of `account_holder`. Which category best describes what the money was spent on or sent for, judging from `transaction.narration`?"
        : "`transaction` is money arriving in the bank account of `account_holder`. Which category best describes where the money came from, judging from `transaction.narration`?",
      criteria: txn.direction === "out" ? OUT_CRITERIA : IN_CRITERIA,
    },
  };
  if (candidates.length) {
    q.counterparty = {
      type: "choice",
      instructions: "Which option is exactly the name of the other party in `transaction.narration`: the person, business or brand the money was sent to or received from? Choose the option containing the full name and nothing else: no product words (airtime, token, subscription, wallet, deposit), branch locations, dates or reference codes. Never a bank or payment processor.",
      criteria: { ...Object.fromEntries(candidates.map((c) => [c, null])), NONE: "No person or business is named, e.g. a bank fee, levy, tax, interest or ATM withdrawal." },
    };
  }
  // Speculative: only consumed when the category says bank charge. Asked anyway,
  // because in the same request it costs a few tokens and no extra latency.
  if (txn.direction === "out") {
    q.charge_type = {
      type: "choice",
      instructions: "Is `transaction.narration` a fee, tax or levy charged by the bank? If so, which kind?",
      criteria: CHARGE_CRITERIA,
    };
  }
  return q;
}

const NO_COUNTERPARTY = new Set(["bank_charges", "interest", "cash_withdrawal", "cash_deposit"]);

export async function classifyTransactions(transactions, holder, ledger, onResult) {
  await pool(transactions, 8, async (txn) => {
    const candidates = counterpartyCandidates(txn.narration);
    const state = {
      account_holder: holder || "the account holder (name not given)",
      transaction: { date: txn.date, narration: txn.narration, direction: txn.direction === "out" ? "money out (debit)" : "money in (credit)", amount: naira(txn.amount) },
    };
    const t0 = performance.now();
    const a = await systemOne(state, questionsFor(txn, candidates), ledger);
    const cp = a.counterparty;
    return {
      ...txn,
      category: a.category.choice,
      categoryConfidence: a.category.confidence,
      categoryProbs: a.category.probabilities,
      // Policy, in code: fees, levies and interest have no counterparty worth grouping.
      counterparty: cp && cp.choice !== "NONE" && !NO_COUNTERPARTY.has(a.category.choice) ? cp.choice : null,
      counterpartyConfidence: cp?.confidence ?? null,
      counterpartyProbs: cp?.probabilities ?? null,
      chargeType: a.charge_type?.choice ?? null,
      chargeConfidence: a.charge_type?.confidence ?? null,
      chargeProbs: a.charge_type?.probabilities ?? null,
      rulesCategory: rulesCategory(txn),
      rulesChargeType: txn.direction === "out" ? rulesChargeType(txn) : null,
      ms: Math.round(performance.now() - t0),
    };
  }, onResult);
}

// ---- Entity resolution: are two spellings the same party? ------------------

const GENERIC = new Set("LTD LIMITED NIG NIGERIA ENTERPRISES ENTERPRISE VENTURES VENTURE STORES STORE GLOBAL SERVICES SERVICE CO COMPANY INTL INTERNATIONAL AND THE MRS MR MISS DR CHIEF ALHAJI PASTOR LEKKI IKEJA VI ABUJA LAGOS".split(" "));
const tokens = (name) => name.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
export const normalizeName = (name) => name.toUpperCase().replace(/[^A-Z0-9 &]/g, " ").replace(/\s+/g, " ").trim();

export async function resolveEntities(results, ledger) {
  const names = [...new Set(results.map((r) => r.counterparty).filter(Boolean).map(normalizeName))];
  const parent = Object.fromEntries(names.map((n) => [n, n]));
  const find = (n) => (parent[n] === n ? n : (parent[n] = find(parent[n])));

  // Identical once generic words (LTD, MRS, VENTURES...) are dropped: merge in code.
  // Otherwise code proposes plausible pairs (shared distinctive token) and Jev decides.
  const key = (n) => tokens(n).sort().join(" ");
  const pairs = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const ti = tokens(names[i]), tj = new Set(tokens(names[j]));
      if (key(names[i]) && key(names[i]) === key(names[j])) parent[find(names[i])] = find(names[j]);
      else if (ti.some((t) => tj.has(t))) pairs.push([i, j]);
    }

  const examples = Object.fromEntries(names.map((n) => [n, results.find((r) => r.counterparty && normalizeName(r.counterparty) === n)?.narration]));
  const state = { parties: names.map((n) => ({ name: n, example_narration: examples[n] })) };
  const decisions = [];
  for (let start = 0; pairs.length && start < pairs.length; start += 80) {
    const chunk = pairs.slice(start, start + 80);
    const questions = Object.fromEntries(chunk.map(([i, j], k) => [`p${k}`, {
      type: "noul",
      instructions: `Do \`parties[${i}].name\` and \`parties[${j}].name\` refer to the same person or the same business?`,
      criteria: {
        true: "Same party written differently: reordered names, an initial or middle name added or dropped, abbreviations, or different branches of one business.",
        false: "Different people or different businesses, even if they share a surname, first name or a word.",
      },
    }]));
    const a = await systemOne(state, questions, ledger);
    chunk.forEach(([i, j], k) => decisions.push({ a: names[i], b: names[j], p: a[`p${k}`].noul }));
  }
  for (const d of decisions) if (d.p >= 0.6) parent[find(d.a)] = find(d.b);

  const canonical = {};
  for (const n of names) (canonical[find(n)] ??= []).push(n);
  const groups = Object.values(canonical).filter((g) => g.length > 1);
  return { groups, decisions, checked: pairs.length };
}
