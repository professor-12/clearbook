// The Express app. On Vercel, api/index.js exports it as a function;
// locally, server/index.js imports it, serves the built UI and listens on a port.
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import { hasKey, Ledger } from "./server/jev.js";
import { readCsv } from "./server/parse/csv.js";
import { readPdf, PdfPasswordError } from "./server/parse/pdf.js";
import { classifyTransactions, resolveEntities } from "./server/analyze.js";

const MAX_TXNS = 1000;
// Vercel caps request bodies at 4.5 MB; stay under it there.
const MAX_UPLOAD = process.env.VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024;
const ACCESS_CODE = process.env.ACCESS_CODE?.trim() || null;

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD } });
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, hasKey: hasKey(), needsCode: Boolean(ACCESS_CODE), maxUploadMb: MAX_UPLOAD / 1024 / 1024 }));

// Optional gate so a public deployment can't spend the TypeSafe key for anyone who finds the URL.
const sameCode = (given) => {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(ACCESS_CODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
app.use("/api", (req, res, next) => {
  if (!ACCESS_CODE || sameCode(req.get("x-access-code"))) return next();
  res.status(401).json({ error: "Access code required.", needsCode: true });
});

async function readStatement(buffer, filename, password) {
  const ledger = new Ledger();
  const isPdf = /\.pdf$/i.test(filename) || buffer.subarray(0, 5).toString() === "%PDF-";
  const parsed = isPdf ? await readPdf(buffer, password) : await readCsv(buffer.toString("utf8"), ledger);
  return { ...parsed, format: isPdf ? "pdf" : "csv", filename, parseUsage: ledger.summary() };
}

app.post("/api/parse", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: `File is larger than ${MAX_UPLOAD / 1024 / 1024} MB.` });
    if (err) return next(err);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    const out = await readStatement(req.file.buffer, req.file.originalname, req.body?.password);
    if (!out.transactions.length) return res.status(422).json({ error: "No transactions found. Is this a text-based statement (not a scanned image)?" });
    res.json(out);
  } catch (err) {
    // The password is only used for this parse; it is never logged or stored.
    if (err instanceof PdfPasswordError) return res.status(422).json({ error: err.message, needsPassword: true, reason: err.reason });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Streams NDJSON: one {type:"txn"} line per classified transaction as it lands,
// then {type:"entities"} for merged counterparties, then {type:"done"} with usage.
app.post("/api/analyze", async (req, res) => {
  const { transactions, holder } = req.body ?? {};
  if (!Array.isArray(transactions) || !transactions.length) return res.status(400).json({ error: "transactions[] required" });
  if (transactions.length > MAX_TXNS) return res.status(413).json({ error: `At most ${MAX_TXNS} transactions per run.` });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  const ledger = new Ledger();
  const t0 = performance.now();
  const results = [];
  try {
    await classifyTransactions(transactions, holder, ledger, (r) => { results.push(r); send({ type: "txn", result: r, usage: ledger.summary() }); });
    const entities = await resolveEntities(results, ledger);
    send({ type: "entities", ...entities });
    send({ type: "done", usage: ledger.summary(), wallMs: Math.round(performance.now() - t0) });
  } catch (err) {
    console.error(err);
    send({ type: "error", error: err.message });
  }
  res.end();
});

// Express would otherwise render its own HTML error page; keep API errors as JSON.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Server error" });
});

export default app;
