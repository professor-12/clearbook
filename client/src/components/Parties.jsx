import { Card, CardHeader, Empty } from "./ui.jsx";
import { IN_COLOR, OUT_COLOR } from "./charts.jsx";
import { labelOf } from "../../../shared/taxonomy.js";
import { naira, pct } from "../lib/format.js";

function PartyList({ rows, total, color, noun }) {
  if (!rows.length) return <Empty>No named counterparties yet.</Empty>;
  const max = rows[0].total;
  return (
    <div className="divide-y divide-line">
      {rows.slice(0, 15).map((p) => (
        <div key={p.key} className="px-5 py-3.5">
          <div className="flex items-baseline gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-neutral-100">{p.name}</span>
                {p.aliases.length > 1 && (
                  <span title={p.aliases.join(" · ")} className="shrink-0 rounded border border-line-strong px-1.5 py-px text-[11px] text-muted">
                    {p.aliases.length} spellings merged
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted">{labelOf(p.topCategory)} · {p.count} {noun}{p.count > 1 ? "s" : ""}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-neutral-100 tabular">{naira(p.total)}</div>
              <div className="font-mono text-[11px] text-faint tabular">{pct(p.total / total, 1)}</div>
            </div>
          </div>
          <div className="mt-2.5 h-1 rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full" style={{ width: `${(p.total / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Parties({ summary: s, entities }) {
  const decisions = [...(entities.decisions ?? [])].sort((a, b) => b.p - a.p);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Paid to" sub={`${s.partiesOut.length} beneficiaries`} />
          <div className="mt-3 pb-2"><PartyList rows={s.partiesOut} total={s.totals.out} color={OUT_COLOR} noun="payment" /></div>
        </Card>
        <Card>
          <CardHeader title="Received from" sub={`${s.partiesIn.length} sources`} />
          <div className="mt-3 pb-2"><PartyList rows={s.partiesIn} total={s.totals.in} color={IN_COLOR} noun="credit" /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Name matching" sub="Code proposes name pairs that share a word; Jev answers “same person or business?” for all of them in one request. Merged at 60% or above." right={`${entities.checked ?? 0} pairs checked`} />
        <div className="mt-4 overflow-x-auto border-t border-line scroll-thin">
          {decisions.length ? (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {decisions.map((d) => (
                  <tr key={d.a + d.b}>
                    <td className="px-5 py-3 text-neutral-200">{d.a}</td>
                    <td className="px-3 py-3 text-faint">vs</td>
                    <td className="px-3 py-3 text-neutral-200">{d.b}</td>
                    <td className="w-40 px-3 py-3">
                      <div className="h-1 rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${d.p >= 0.6 ? "bg-neutral-100" : "bg-neutral-600"}`} style={{ width: `${d.p * 100}%` }} /></div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-neutral-300 tabular">{pct(d.p)}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted">{d.p >= 0.6 ? "Merged" : "Kept apart"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No ambiguous name pairs in this statement.</Empty>}
        </div>
      </Card>
    </div>
  );
}
