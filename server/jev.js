// Minimal TypeSafe System One client: one POST per request, retries on 429/529,
// and a usage ledger so the UI can show what the run actually cost.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = process.env.JEV_MODEL || "jev-latest";
const PRICE_PER_TOKEN = 0.042 / 1_000_000; // input tokens only; output is free

function loadKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY.trim();
  const file = path.join(os.homedir(), ".config", "typesafe", "api_key");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  return null;
}

const API_KEY = loadKey();

export function hasKey() {
  return Boolean(API_KEY);
}

export class Ledger {
  constructor() {
    this.requests = 0;
    this.questions = 0;
    this.inputTokens = 0;
    this.latencies = [];
    this.model = null;
  }
  record(questionCount, usage, ms, model) {
    this.requests += 1;
    this.questions += questionCount;
    this.inputTokens += usage?.input_tokens ?? 0;
    this.latencies.push(ms);
    this.model = model ?? this.model;
  }
  summary() {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const pct = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
    return {
      model: this.model,
      requests: this.requests,
      questions: this.questions,
      inputTokens: this.inputTokens,
      costUsd: this.inputTokens * PRICE_PER_TOKEN,
      p50Ms: pct(0.5),
      p95Ms: pct(0.95),
      retries: this.retries ?? 0,
    };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function systemOne(state, questions, ledger, { retries = 4 } = {}) {
  if (!API_KEY) throw new Error("No TypeSafe API key. Set TYPESAFE_API_KEY or ~/.config/typesafe/api_key.");
  const body = JSON.stringify({ state, model: MODEL, questions });
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      // A stalled request is retried rather than holding up the whole statement.
      if (attempt < retries && (err.name === "TimeoutError" || err.name === "TypeError")) {
        ledger && (ledger.retries = (ledger.retries ?? 0) + 1);
        continue;
      }
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Math.min(8000, retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt);
      console.warn(`TypeSafe ${res.status}, retrying in ${wait}ms`);
      ledger && (ledger.retries = (ledger.retries ?? 0) + 1);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TypeSafe ${res.status}: ${text.slice(0, 500)}`);
    }
    const json = await res.json();
    ledger?.record(Object.keys(questions).length, json.usage, performance.now() - t0, json.model);
    return json.answers;
  }
}

// Run async tasks with bounded concurrency, yielding results as they finish.
export async function pool(items, limit, worker, onResult) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      const out = await worker(items[i], i);
      await onResult?.(out, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
