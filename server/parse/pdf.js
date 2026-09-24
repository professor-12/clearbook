// Text-based PDF statements: rebuild visual lines from pdf.js text runs, locate
// the column header, then treat each dated line as a transaction. Amount columns
// are assigned by x-position; running balance repairs any ambiguous sign.
import { cleanHolder, parseAmount, parseDate, DATE_RE, reconcileWithBalance, finalizeRows } from "./common.js";

const HEADER_WORDS = {
  debit: /^(debit|debits|withdrawal|withdrawals|money out|dr|paid out)$/i,
  credit: /^(credit|credits|deposit|deposits|lodgement|money in|cr|paid in)$/i,
  amount: /^(amount|amt)$/i,
  balance: /^(balance|bal)$/i,
};
const NOISE = /page \d+|opening balance|closing balance|total|statement of account|brought forward|carried forward/i;

async function extractLines(buffer, password) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Load the worker explicitly: pdf.js checks globalThis.pdfjsWorker before importing
  // it by path, and a static specifier lets serverless file tracing bundle it.
  globalThis.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), password: password || undefined, useSystemFonts: true, isEvalSupported: false }).promise;
  } catch (err) {
    // Bank statements are often emailed as password-protected PDFs.
    if (err?.name === "PasswordException") {
      throw new PdfPasswordError(err.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "incorrect" : "required");
    }
    throw err;
  }
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const rows = [];
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) rows.push((row = { y, cells: [] }));
      row.cells.push({ x, w: it.width, text: it.str.trim() });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.cells.sort((a, b) => a.x - b.x);
      // pdf.js often splits a phrase into several runs; merge runs that touch.
      const merged = [];
      for (const c of r.cells) {
        const last = merged.at(-1);
        if (last && c.x - (last.x + last.w) < 2.5) { last.text += (c.x - (last.x + last.w) > 0.8 ? " " : "") + c.text; last.w = c.x + c.w - last.x; }
        else merged.push({ ...c });
      }
      lines.push({ page: p, cells: merged, text: merged.map((c) => c.text).join(" ") });
    }
  }
  return lines;
}

export class PdfPasswordError extends Error {
  constructor(reason) {
    super(reason === "incorrect" ? "That password didn't open the PDF." : "This PDF is password-protected.");
    this.reason = reason;
  }
}

export async function readPdf(buffer, password) {
  const lines = await extractLines(buffer, password);
  let columns = null;
  let holder = null;
  const parsed = [];

  for (const line of lines) {
    const holderMatch = line.text.match(/account\s*name\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{2,60})/i);
    if (holderMatch && !holder) holder = cleanHolder(holderMatch[1]);

    const headerCols = {};
    for (const c of line.cells) for (const [role, re] of Object.entries(HEADER_WORDS)) if (re.test(c.text)) headerCols[role] = c.x + c.w;
    if (Object.keys(headerCols).length >= 2) { columns = headerCols; continue; }

    const first = line.cells[0]?.text ?? "";
    const dateMatch = first.match(DATE_RE) || line.text.slice(0, 24).match(DATE_RE);
    const date = dateMatch ? parseDate(dateMatch[0]) : null;
    const money = line.cells.filter((c) => /\d\.\d{2}\)?(\s?(CR|DR))?$/i.test(c.text) && parseAmount(c.text) != null);

    if (date && money.length) {
      const words = line.cells.filter((c) => !money.includes(c) && !DATE_RE.test(c.text));
      const row = { date, narration: words.map((c) => c.text).join(" "), amount: null, balance: null };
      if (columns) {
        for (const c of money) {
          const right = c.x + c.w;
          const role = Object.entries(columns).sort((a, b) => Math.abs(a[1] - right) - Math.abs(b[1] - right))[0][0];
          const v = parseAmount(c.text);
          if (role === "debit") row.amount = -Math.abs(v);
          else if (role === "credit") row.amount = Math.abs(v);
          else if (role === "amount") row.amount = v;
          else row.balance = v;
        }
      } else {
        row.balance = money.length > 1 ? parseAmount(money.at(-1).text) : null;
        row.amount = parseAmount(money[0].text);
      }
      parsed.push(row);
    } else if (!date && !money.length && parsed.length && !NOISE.test(line.text) && line.text.length < 80) {
      // Wrapped narration continues on the next visual line.
      parsed.at(-1).narration += " " + line.text;
    }
  }

  return { transactions: finalizeRows(reconcileWithBalance(parsed)), holder, columns: columns ? Object.keys(columns) : [], columnsVia: "pdf-layout" };
}
