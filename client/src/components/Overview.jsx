import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, CategoryTag, Confidence, Empty } from "./ui.jsx";
import { axisProps, gridProps, ChartTooltip, CompositionBar, IN_COLOR, OUT_COLOR } from "./charts.jsx";
import { naira, pct, shortDate } from "../lib/format.js";
import { categoryOf } from "../lib/analysis.js";

function Kpis({ s }) {
  const t = s.totals;
  const net = t.in - t.out;
  const cells = [
    ["Money in", naira(t.in, { compact: true }), `${t.inCount} credits`],
    ["Money out", naira(t.out, { compact: true }), `${t.outCount} debits`],
    ["Net flow", naira(net, { compact: true, sign: true }), t.in ? `${pct(Math.max(net, 0) / t.in)} of income retained` : "–"],
    ["Charges, VAT & levies", naira(t.charges), `${s.byCharge.reduce((n, c) => n + c.count, 0)} deductions`],
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {cells.map(([label, value, sub]) => (
        <div key={label} className="bg-panel px-5 py-5">
          <div className="label">{label}</div>
          <div className="mt-2 text-[28px] font-semibold tracking-tight text-neutral-50">{value}</div>
          <div className="mt-1 text-xs text-muted">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function balanceSeries(ordered) {
  const byDate = new Map();
  let running = 0;
  for (const r of ordered) {
    running += r.amount;
    byDate.set(r.date, r.balance ?? running);
  }
  return [...byDate].map(([date, balance]) => ({ date, label: shortDate(date), balance }));
}

function insightsFrom(s) {
  const out = [];
  const t = s.totals;
  const ch = Object.fromEntries(s.byCharge.map((c) => [c.key, c]));
  if (t.charges) out.push(<>Bank charges came to <b>{naira(t.charges)}</b>{ch.vat ? <>, of which <b>{naira(ch.vat.total)}</b> was VAT</> : ""}{ch.emtl ? <> and <b>{naira(ch.emtl.total)}</b> was the transfer levy on {ch.emtl.count} credits</> : ""}.</>);
  const sal = s.byCatIn.find((c) => c.key === "salary_income");
  if (sal && t.in) out.push(<>Salary is <b>{pct(sal.total / t.in)}</b> of money in.</>);
  if (s.partiesOut[0]) out.push(<>Largest beneficiary: <b>{s.partiesOut[0].name}</b>, {naira(s.partiesOut[0].total)} across {s.partiesOut[0].count} payment{s.partiesOut[0].count > 1 ? "s" : ""}.</>);
  if (s.flags.loansRepaid || s.flags.loansReceived) out.push(<><b>{naira(s.flags.loansReceived?.total ?? 0)}</b> borrowed and <b>{naira(s.flags.loansRepaid?.total ?? 0)}</b> repaid to lenders.</>);
  const sav = s.byCatOut.find((c) => c.key === "savings_investment");
  if (sav && t.in) out.push(<><b>{naira(sav.total)}</b> moved into savings and investments ({pct(sav.total / t.in, 1)} of income).</>);
  if (s.flags.betting) out.push({ warn: true, body: <><b>{naira(s.flags.betting.total)}</b> spent on betting across {s.flags.betting.count} transactions.</> });
  if (t.selfOut || t.selfIn) out.push(<>{naira(t.selfOut + t.selfIn)} moved between the holder's own accounts, excluded from income and spending.</>);
  return out.map((o) => (o?.body ? o : { body: o }));
}

export default function Overview({ summary: s, ordered, arrivals, overrides, onSelect, threshold }) {
  const insights = insightsFrom(s);
  const balance = balanceSeries(ordered);
  const recent = arrivals.slice(-6).reverse();

  return (
    <div className="space-y-6">
      <Kpis s={s} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Balance" sub="End-of-day balance across the statement period" />
          <div className="h-64 px-2 pb-3 pt-4">
            <ResponsiveContainer>
              <AreaChart data={balance} margin={{ left: 4, right: 12 }}>
                <defs>
                  <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={OUT_COLOR} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={OUT_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} minTickGap={40} />
                <YAxis {...axisProps} width={60} tickFormatter={(v) => naira(v, { compact: true })} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#3a3a3a" }} />
                <Area type="monotone" dataKey="balance" name="Balance" stroke={OUT_COLOR} strokeWidth={2} fill="url(#bal)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#111" }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Cash flow by month" />
          <div className="h-64 px-2 pb-3 pt-4">
            <ResponsiveContainer>
              <BarChart data={s.months} barGap={3} barCategoryGap="30%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={52} tickFormatter={(v) => naira(v, { compact: true })} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
                <Bar dataKey="in" name="Money in" fill={IN_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} />
                <Bar dataKey="out" name="Money out" fill={OUT_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 px-5 pb-5 text-xs text-muted">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: IN_COLOR }} />Money in</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: OUT_COLOR }} />Money out</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Spending" sub={`${naira(s.totals.out)} across ${s.byCatOut.length} categories`} />
          <div className="px-5 pb-3 pt-5">{s.byCatOut.length ? <CompositionBar rows={s.byCatOut} total={s.totals.out} /> : <Empty>Waiting for answers…</Empty>}</div>
        </Card>
        <Card>
          <CardHeader title="Income" sub={`${naira(s.totals.in)} across ${s.byCatIn.length} sources`} />
          <div className="px-5 pb-3 pt-5">{s.byCatIn.length ? <CompositionBar rows={s.byCatIn} total={s.totals.in} /> : <Empty>Waiting for answers…</Empty>}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Summary" />
          <ul className="divide-y divide-line px-5 pb-2 pt-3">
            {insights.length ? insights.map((i, k) => (
              <li key={k} className="flex gap-3 py-3 text-sm leading-relaxed text-neutral-400 [&_b]:font-medium [&_b]:text-neutral-100">
                <span className={`mt-2 size-1.5 shrink-0 rounded-full ${i.warn ? "bg-warn" : "bg-neutral-600"}`} />
                <span>{i.body}</span>
              </li>
            )) : <Empty>Appears as answers arrive.</Empty>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Latest answers" sub="Most recent Jev classifications" />
          <div className="divide-y divide-line px-5 pb-2 pt-3">
            {recent.map((r) => (
              <button key={r.id} onClick={() => onSelect(r)} className="flex w-full items-center gap-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-muted">{r.narration}</div>
                  <div className="mt-1 flex items-center gap-3"><CategoryTag category={categoryOf(r, overrides)} /><Confidence value={r.categoryConfidence} threshold={threshold} /></div>
                </div>
                <div className="shrink-0 font-mono text-sm text-neutral-200 tabular">{naira(r.amount, { sign: true })}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
