import { useState } from "react";
import { Card, CardHeader } from "./ui.jsx";
import { calibration, compareWithRules } from "../lib/analysis.js";
import { labelOf } from "../../../shared/taxonomy.js";
import { pct, usd } from "../lib/format.js";

const JEV_PRICE_PER_M = 0.042; // input tokens; output is free (docs.typesafe.ai/models)

// Each row is a property of the approach, with the evidence in this app.
const CONTRAST = [
  {
    topic: "What comes back",
    jev: "A probability for every category, e.g. Food & dining 98%, Shopping 1%. Always one of your options.",
    llm: "One generated answer. Any confidence it gives is text it wrote, not a measured probability over the options.",
  },
  {
    topic: "Knowing when to trust it",
    jev: "Threshold the probability: confident answers go straight into the totals, uncertain ones to the Review tab.",
    llm: "No reliable per-answer signal, so you either review everything or trust everything.",
  },
  {
    topic: "Beneficiary names",
    jev: "Selects one span cut from the narration, so the name is verbatim from the statement and cannot be invented.",
    llm: "Generates the name, so it can reformat, expand or invent one unless you add validation.",
  },
  {
    topic: "Cost at statement volume",
    jev: "Priced per input token only; output is free. See the measured cost for this statement.",
    llm: "Priced per input and output token, usually with a longer prompt to explain the format. Compare with the calculator below.",
  },
  {
    topic: "Speed",
    jev: "All questions for a transaction answered in parallel in one request; nothing is generated token by token.",
    llm: "Latency grows with the length of the generated answer.",
  },
  {
    topic: "Where the LLM is the better tool",
    jev: "Not for writing. Jev can't summarise a statement, explain a decision or reason across many steps.",
    llm: "Writing narrative summaries, answering open questions about the account, or a second opinion on items held for review.",
  },
];

const PIPELINE = [
  ["Parse", "code", "CSV/PDF to rows. Amounts, dates and signs are exact; the running balance verifies direction."],
  ["Judge", "Jev", "One request per transaction: category, counterparty (chosen from spans code cut from the narration) and charge type."],
  ["Resolve", "Jev", "Name pairs that share a word become yes/no questions (“same party?”) in a single request."],
  ["Sum", "code", "Totals, beneficiaries, VAT, levies and trends come from typed answers. No arithmetic in the model."],
  ["Gate", "code", "Answers under the confidence threshold go to a person. The threshold is policy you can change."],
];

function Stat({ label, value, sub }) {
  return (
    <div className="bg-panel px-5 py-5">
      <div className="label">{label}</div>
      <div className="mt-2 font-mono text-2xl text-neutral-50 tabular">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, step = 0.01 }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full rounded-md border border-line-strong bg-transparent px-3 py-2 font-mono text-sm text-neutral-100 tabular focus:border-neutral-500 focus:outline-none" />
    </label>
  );
}

function CostCalculator({ usage, count }) {
  const tokensPerTxn = usage && count ? Math.round(usage.inputTokens / count) : 1500;
  const [inPrice, setInPrice] = useState(1);
  const [outPrice, setOutPrice] = useState(5);
  const [promptTokens, setPromptTokens] = useState(tokensPerTxn);
  const [outTokens, setOutTokens] = useState(40);
  const volume = 1_000_000;
  const jev = (tokensPerTxn * volume * JEV_PRICE_PER_M) / 1e6;
  const llm = (volume * (promptTokens * inPrice + outTokens * outPrice)) / 1e6;
  return (
    <Card>
      <CardHeader title="Cost at scale" sub="Enter your LLM provider's prices. The Jev figure uses this run's measured tokens per transaction." />
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid grid-cols-2 gap-4">
          <NumberInput label="LLM input $ / 1M tokens" value={inPrice} onChange={setInPrice} />
          <NumberInput label="LLM output $ / 1M tokens" value={outPrice} onChange={setOutPrice} />
          <NumberInput label="LLM prompt tokens / txn" value={promptTokens} onChange={setPromptTokens} step={50} />
          <NumberInput label="LLM output tokens / txn" value={outTokens} onChange={setOutTokens} step={5} />
          <p className="col-span-2 text-xs text-faint">Prices shown are placeholders, not a quote for any provider. Prompt size defaults to Jev's measured {tokensPerTxn.toLocaleString()} tokens per transaction.</p>
        </div>
        <div className="grid gap-px self-start overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
          <Stat label="Jev · 1M transactions" value={`$${jev.toFixed(2)}`} sub={`${tokensPerTxn.toLocaleString()} tokens each at $${JEV_PRICE_PER_M}/1M`} />
          <Stat label="LLM · 1M transactions" value={`$${llm.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} sub={jev > 0 ? `${(llm / jev).toFixed(0)}× the Jev cost at these prices` : ""} />
        </div>
      </div>
    </Card>
  );
}

export default function WhyJev({ ordered, statement, usage, wallMs, onSelect, threshold }) {
  const cmp = compareWithRules(ordered, statement.labels);
  const cal = calibration(ordered, statement.labels, threshold);
  const per1k = usage && ordered.length ? (usage.costUsd / ordered.length) * 1000 : null;

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-50">Why Jev, not a general-purpose LLM</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Categorising a statement is thousands of small judgments, each with a fixed set of possible answers: which category, which name in the narration, which kind of fee. Jev is built for that shape of question. It returns a calibrated probability for every option, so code can do the maths and decide when a person should look. A generative LLM is built to write text, and this task doesn't need any written.
        </p>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Category accuracy" value={cmp.accuracy ? pct(cmp.accuracy.jev / cmp.accuracy.n, 1) : "–"} sub={cmp.accuracy ? `${cmp.accuracy.jev}/${cmp.accuracy.n} labelled · keyword rules ${pct(cmp.accuracy.rules / cmp.accuracy.n, 1)}` : "Upload the sample to score against labels"} />
        <Stat label="Cost, this statement" value={usage ? usd(usage.costUsd) : "–"} sub={per1k != null ? `${usd(per1k)} per 1,000 transactions` : ""} />
        <Stat label="Median request" value={usage ? `${Math.round(usage.p50Ms)} ms` : "–"} sub={usage ? `${usage.questions} questions in ${usage.requests} requests` : ""} />
        <Stat label="End-to-end" value={wallMs ? `${(wallMs / 1000).toFixed(1)} s` : "–"} sub={`${ordered.length} transactions, ${usage?.model ?? "jev"}`} />
      </div>

      {cal && (
        <Card>
          <CardHeader title="Its confidence is informative" sub="Measured against the sample's hand-assigned labels at the current review threshold." />
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            <div className="space-y-5">
              {[
                ["When Jev was right", cal.meanRight, cal.right, "#3987e5"],
                ["When Jev was wrong", cal.meanWrong, cal.wrong, "#fab219"],
              ].map(([label, mean, n, color]) => (
                <div key={label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-neutral-300">{label} <span className="text-faint">({n})</span></span>
                    <span className="font-mono text-neutral-100 tabular">{mean != null ? `${pct(mean)} avg confidence` : "–"}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${(mean ?? 0) * 100}%`, background: color }} /></div>
                </div>
              ))}
            </div>
            <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
              <Stat label="Wrong answers sent to review" value={`${cal.wrongCaught}/${cal.wrong}`} sub={`below the ${pct(threshold)} threshold`} />
              <Stat label="Auto-accepted answers wrong" value={`${cal.autoAcceptedWrong}/${cal.autoAccepted}`} sub={`${cal.rightHeld} correct answers held for review`} />
            </div>
          </div>
          <p className="px-5 pb-5 text-xs text-faint">This is one synthetic statement. Treat it as a demonstration of the mechanism, and measure on your own labelled data before choosing a threshold.</p>
        </Card>
      )}

      <Card>
        <CardHeader title="Jev compared with a generative LLM" sub="Properties of each approach, not a benchmark result." />
        <div className="mt-4 overflow-x-auto border-t border-line scroll-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-48 px-5 py-2.5 font-medium" />
                <th className="px-3 py-2.5 font-medium text-neutral-100">Jev</th>
                <th className="px-5 py-2.5 font-medium">General-purpose LLM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {CONTRAST.map((row) => (
                <tr key={row.topic}>
                  <td className="px-5 py-4 font-medium text-neutral-200">{row.topic}</td>
                  <td className="px-3 py-4 leading-relaxed text-neutral-300">{row.jev}</td>
                  <td className="px-5 py-4 leading-relaxed text-muted">{row.llm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CostCalculator usage={usage} count={ordered.length} />

      <Card>
        <CardHeader title="Where keyword rules break" sub="Transactions where Jev and a keyword rule engine disagree. Open one to see Jev's full distribution." right={`${cmp.uniqueDisagreements.length} distinct narrations`} />
        <div className="mt-4 overflow-x-auto border-t border-line scroll-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Narration</th>
                <th className="px-3 py-2.5 font-medium">Keyword rules</th>
                <th className="px-3 py-2.5 font-medium">Jev</th>
                <th className="px-5 py-2.5 text-right font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cmp.uniqueDisagreements.map((r) => {
                const tone = (ok) => (!r.truth ? "text-neutral-300" : ok ? "text-neutral-100" : "text-faint line-through");
                return (
                  <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-xs text-neutral-300">{r.narration}</td>
                    <td className={`px-3 py-3 ${tone(r.rulesCategory === r.truth)}`}>{labelOf(r.rulesCategory)}</td>
                    <td className={`px-3 py-3 ${tone(r.category === r.truth)}`}>{labelOf(r.category)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted tabular">{pct(r.categoryConfidence)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {cmp.disagreementWins && <p className="px-5 py-4 text-xs text-muted">Against the labels: Jev was right on {cmp.disagreementWins.jev} of {cmp.disagreementWins.n} disagreements, the rules on {cmp.disagreementWins.rules}. Struck-through answers are wrong.</p>}
      </Card>

      <Card>
        <CardHeader title="Architecture" sub="Code stays in control; Jev supplies the judgment." />
        <div className="mt-4 grid gap-px border-t border-line bg-line md:grid-cols-5">
          {PIPELINE.map(([title, who, body], i) => (
            <div key={title} className="bg-panel p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-neutral-100"><span className="mr-2 font-mono text-xs text-faint">0{i + 1}</span>{title}</span>
                <span className={`text-xs ${who === "Jev" ? "text-neutral-100" : "text-faint"}`}>{who}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
