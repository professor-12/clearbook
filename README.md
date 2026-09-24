# Clearbook: bank statements understood by Jev

Upload a bank statement (CSV or text-based PDF). Every transaction is categorised, every beneficiary identified and merged across spellings, and every naira of VAT, EMTL/stamp duty and bank fees is accounted for. It uses [Jev](https://docs.typesafe.ai), TypeSafe's System One model, instead of keyword rules or a generative LLM.

## Run it

```bash
npm install
npm run build          # builds the React app into public/
npm start              # Express on http://localhost:5174 serves the API and the UI
```

Development with hot reload: `npm run dev` (Vite on :5173, proxying `/api` to Express on :5174).

The TypeSafe key is read from `TYPESAFE_API_KEY` or `~/.config/typesafe/api_key`.

## Why Jev, and not keyword rules or a general-purpose LLM

Categorising a statement is thousands of small judgments, each with a fixed set of answers: which category, which name in the narration, which kind of fee. Jev is built for exactly that shape of question.

- **Keyword rules are too literal.** `BETTYS KITCHEN` matches "BET", `JOHN LEVY` matches "LEVY", an estate `SERVICE CHARGE` looks like a bank fee.
- **A generative LLM understands context, but it returns a single written answer.** Jev returns a probability for *every* option. That probability is what lets code auto-accept confident answers and route uncertain ones to a person. On the sample, the only wrong answer had 58% confidence and was held for review at the 70% threshold; 0 of 107 auto-accepted answers were wrong.
- **Names are selected, not generated.** Code cuts candidate spans from the narration and Jev picks one, so a beneficiary name can't be invented.
- **Cost and speed.** $0.042 per million input tokens (output free), with all questions for a transaction answered in parallel in one request. Measured: ≈ $0.007 and ≈ 0.4–0.5 s median per request for a 108-transaction statement. The "Why Jev" tab has a calculator for comparing against your LLM provider's prices.
- **Where an LLM is still the right tool:** writing summaries, answering open questions about an account, or a second opinion on items held for review.

| On the bundled 108-transaction labelled sample | Jev | Keyword rules |
|---|---|---|
| Category accuracy | **107 / 108** | 91 / 108 |
| Charge type (VAT / EMTL / fees / SMS / maintenance) | 38 / 38 | 38 / 38 |

Reproduce with `node scripts/eval-sample.js`. The sample is synthetic and deliberately includes narrations that fool string matching; measure on your own labelled statements before relying on the numbers. No LLM was benchmarked here.

## How it's built: code in control, Jev for judgment

| Step | Who | What |
|---|---|---|
| Parse | code | `server/parse/`: CSV header mapping (Jev picks columns only when headers are ambiguous) and PDF layout reconstruction via pdf.js. The running balance verifies every debit/credit sign. |
| Judge | **Jev** | `server/analyze.js`: one request per transaction with three questions. **category** is a Choice over direction-specific categories. **counterparty** is a Choice over spans that code cut from the narration, so names are selected, never generated. **charge_type** is a speculative Choice, used only if the category is a bank charge. |
| Resolve | **Jev** | Name pairs sharing a distinctive word become Noul questions ("same party?"), batched into one request. Exact matches after dropping `LTD`/`MRS` merge in code. |
| Sum | code | `client/src/lib/analysis.js`: totals, beneficiaries, charges, trends. No arithmetic inside the model. |
| Gate | code | Answers below a confidence threshold go to a review queue. The slider changes policy without re-running inference. |

The taxonomy (`shared/taxonomy.js`) is shared by the server (as Jev criteria) and the UI (as labels).

## Deploy to Vercel

The project follows Vercel's zero-config Express layout: `app.js` at the root exports the Express app (it becomes one Vercel Function), and `npm run build` writes the UI into `public/`, which Vercel serves from its CDN. `server/index.js` is only for running locally.

1. Push the repo to GitHub and import it at vercel.com/new (or run `npx vercel` in the project).
2. Add environment variables in the Vercel project settings:
   - `TYPESAFE_API_KEY`: required.
   - `ACCESS_CODE`: recommended. When set, every `/api` call needs this code (the UI asks for it once and remembers it in the browser), so strangers who find the URL can't spend your TypeSafe credits.
3. Deploy. No other configuration is needed; `vercel.json` only pins the build command.

Limits that apply on Vercel:
- Uploads are capped at 4 MB (Vercel's request body limit is 4.5 MB). Locally the cap is 15 MB.
- A run must finish within the function's max duration (300 s by default). A 108-transaction statement takes about 7–25 s.
- Statements pass through the function in memory and are sent to TypeSafe's API; nothing is written to disk or a database.

Password-protected PDFs (common for statements emailed by banks) are supported: the UI asks for the password, which is used for that one parse and never logged or stored.

## Stack

Express 5 · React 19 · Vite · Tailwind CSS 4 · Recharts · Motion · lucide-react · pdf.js

## Regenerate the sample

`npm run sample` writes `client/public/samples/sample-statement.{csv,pdf}` and `sample-labels.json`; they ship as static files and go through the normal upload path.
