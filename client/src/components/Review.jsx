import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, Confidence } from "./ui.jsx";
import { axisProps, PALETTE } from "./charts.jsx";
import { labelOf } from "../../../shared/taxonomy.js";
import { naira, pct } from "../lib/format.js";

function Histogram({ ordered, threshold }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ lo: i / 10, label: `${i * 10}`, count: 0 }));
  for (const r of ordered) buckets[Math.min(9, Math.floor(r.categoryConfidence * 10))].count++;
  return (
    <ResponsiveContainer>
      <BarChart data={buckets} barCategoryGap="14%">
        <XAxis dataKey="label" {...axisProps} tickFormatter={(v) => `${v}%`} />
        <YAxis {...axisProps} width={28} allowDecimals={false} scale="sqrt" />
        <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.03)" }} content={({ active, payload }) => active && payload?.[0] ? (
          <div className="rounded-md border border-line-strong bg-panel-2 px-2.5 py-1.5 text-xs text-neutral-200">{payload[0].payload.count} at {payload[0].payload.label}–{Number(payload[0].payload.label) + 10}%</div>
        ) : null} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {buckets.map((b) => <Cell key={b.label} fill={b.lo + 0.1 <= threshold ? "#fab219" : PALETTE[0]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Review({ summary: s, ordered, threshold, setThreshold, onOverride, onSelect }) {
  const autoShare = ordered.length ? 1 - s.review.length / ordered.length : 0;
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Auto-accept threshold" sub="Answers below this confidence are held for a person to confirm." />
          <div className="px-5 pb-5 pt-4">
            <div className="font-mono text-4xl font-medium text-neutral-50 tabular">{pct(threshold)}</div>
            <input type="range" min={0.3} max={0.99} step={0.01} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="mt-4 w-full" aria-label="Confidence threshold" />
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
              <div className="bg-panel p-3.5">
                <div className="font-mono text-xl text-neutral-50 tabular">{pct(autoShare)}</div>
                <div className="text-xs text-muted">auto-accepted</div>
              </div>
              <div className="bg-panel p-3.5">
                <div className="font-mono text-xl text-neutral-50 tabular">{s.review.length}</div>
                <div className="text-xs text-muted">held for review</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">Moving the threshold is a policy change, not a new inference: nothing is re-sent to Jev. A lender might require 90%; a budgeting app might accept 60%.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Confidence distribution" sub="Transactions per confidence band (square-root scale)" />
          <div className="h-48 px-2 pb-3 pt-4"><Histogram ordered={ordered} threshold={threshold} /></div>
        </Card>
      </div>

      <Card className="lg:col-span-3">
        <CardHeader title="Held for review" right={`${s.review.length} item${s.review.length === 1 ? "" : "s"}`} />
        <div className="mt-4 divide-y divide-line border-t border-line">
          {s.review.length ? s.review.map((r) => {
            const top = Object.entries(r.categoryProbs).sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => onSelect(r)} className="min-w-0 text-left">
                    <div className="font-mono text-sm text-neutral-200 hover:text-white">{r.narration}</div>
                    <div className="mt-1 text-xs text-muted">{r.date} · {naira(r.amount, { sign: true })}</div>
                  </button>
                  <Confidence value={r.categoryConfidence} threshold={threshold} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {top.map(([k, p], i) => (
                    <button key={k} onClick={() => onOverride(r.id, k)} className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${i === 0 ? "bg-neutral-100 text-neutral-950 hover:bg-white" : "border border-line-strong text-neutral-300 hover:bg-white/[0.04]"}`}>
                      {labelOf(k)} <span className="font-mono opacity-60">{pct(p)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }) : <div className="px-5 py-12 text-center text-sm text-muted">Nothing below the threshold.</div>}
        </div>
      </Card>
    </div>
  );
}
