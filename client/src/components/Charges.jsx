import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, Confidence, Empty } from "./ui.jsx";
import { axisProps, gridProps, ChartTooltip, PALETTE } from "./charts.jsx";
import { CHARGE_ORDER, chargeTypeOf, categoryOf } from "../lib/analysis.js";
import { CHARGE_TYPES, labelOf } from "../../../shared/taxonomy.js";
import { naira, shortDate } from "../lib/format.js";

// Fixed colour per charge type, so colours never shift between statements.
const CHARGE_COLORS = Object.fromEntries(CHARGE_ORDER.map((k, i) => [k, PALETTE[i]]));

export default function Charges({ summary: s, ordered, overrides, onSelect, threshold }) {
  const charges = ordered.filter((r) => chargeTypeOf(r, overrides));
  const present = CHARGE_ORDER.filter((k) => s.byCharge.some((c) => c.key === k));
  const monthly = s.months.map((m) => ({ label: m.label, ...Object.fromEntries(present.map((k) => [k, m.charges[k] ?? 0])) }));
  const falseAlarms = ordered.filter((r) => r.rulesCategory === "bank_charges" && categoryOf(r, overrides) !== "bank_charges");
  const total = s.totals.charges;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Total deducted by the bank" />
          <div className="px-5 pt-3">
            <div className="text-4xl font-semibold tracking-tight text-neutral-50">{naira(total)}</div>
            <div className="mt-1 text-xs text-muted">{charges.length} deductions · {s.totals.out ? ((total / s.totals.out) * 100).toFixed(2) : 0}% of money out</div>
          </div>
          <div className="px-5 pb-3 pt-6">
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {s.byCharge.map((c) => <div key={c.key} style={{ width: `${(c.total / total) * 100}%`, background: CHARGE_COLORS[c.key] }} />)}
            </div>
            <div className="mt-4 divide-y divide-line">
              {s.byCharge.map((c) => (
                <div key={c.key} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="size-2 rounded-full" style={{ background: CHARGE_COLORS[c.key] }} />
                  <span className="flex-1 text-neutral-300">{c.label}</span>
                  <span className="font-mono text-xs text-muted tabular">{c.count}×</span>
                  <span className="w-24 text-right font-mono text-neutral-100 tabular">{naira(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="By month" sub="Stacked by charge type" />
          <div className="h-80 px-2 pb-4 pt-4">
            {present.length ? (
              <ResponsiveContainer>
                <BarChart data={monthly} barCategoryGap="38%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={56} tickFormatter={(v) => naira(v)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
                  {present.map((k, i) => (
                    <Bar key={k} dataKey={k} name={CHARGE_TYPES[k].label} stackId="c" fill={CHARGE_COLORS[k]} stroke="#111111" strokeWidth={2} radius={i === present.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={64} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty>No bank charges found yet.</Empty>}
          </div>
        </Card>
      </div>

      {falseAlarms.length > 0 && (
        <Card>
          <CardHeader title="Looked like charges, weren't" sub="A keyword rule would have counted these as bank charges. Jev classified them by what they are." />
          <div className="mt-4 divide-y divide-line border-t border-line">
            {falseAlarms.map((r) => (
              <button key={r.id} onClick={() => onSelect(r)} className="flex w-full items-center gap-4 px-5 py-3 text-left text-sm hover:bg-white/[0.02]">
                <span className="flex-1 truncate font-mono text-xs text-neutral-300">{r.narration}</span>
                <span className="text-muted">{labelOf(categoryOf(r, overrides))}</span>
                <span className="w-24 text-right font-mono text-neutral-200 tabular">{naira(r.amount)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="All deductions" />
        <div className="mt-4 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Narration</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 text-right font-medium">Confidence</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {charges.map((r) => {
                const ct = chargeTypeOf(r, overrides);
                return (
                  <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">{shortDate(r.date)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-neutral-300">{r.narration}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-neutral-300"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: CHARGE_COLORS[ct] }} />{CHARGE_TYPES[ct].label}</td>
                    <td className="px-3 py-2.5 text-right"><Confidence value={r.chargeConfidence} threshold={threshold} /></td>
                    <td className="px-5 py-2.5 text-right font-mono tabular text-neutral-100">{naira(r.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
