import { useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { Card, Confidence, Empty } from "./ui.jsx";
import { categoryOf } from "../lib/analysis.js";
import { labelOf } from "../../../shared/taxonomy.js";
import { naira, shortDate } from "../lib/format.js";

export default function Transactions({ ordered, overrides, onSelect, threshold }) {
  const [q, setQ] = useState("");
  const [dir, setDir] = useState("all");
  const [cat, setCat] = useState("all");

  const cats = useMemo(() => [...new Set(ordered.map((r) => categoryOf(r, overrides)))].sort((a, b) => labelOf(a).localeCompare(labelOf(b))), [ordered, overrides]);
  const rows = ordered.filter((r) =>
    (dir === "all" || r.direction === dir) &&
    (cat === "all" || categoryOf(r, overrides) === cat) &&
    (!q || `${r.narration} ${r.counterparty ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search narration or beneficiary" className="w-full rounded-md border border-line-strong bg-transparent py-2 pl-9 pr-3 text-sm text-neutral-100 placeholder:text-faint focus:border-neutral-500 focus:outline-none" />
        </div>
        <div className="flex rounded-md border border-line-strong p-0.5 text-sm">
          {[["all", "All"], ["in", "In"], ["out", "Out"]].map(([k, l]) => (
            <button key={k} onClick={() => setDir(k)} className={clsx("rounded px-3 py-1.5", dir === k ? "bg-white/10 text-neutral-100" : "text-muted hover:text-neutral-300")}>{l}</button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-md border border-line-strong bg-panel px-3 py-2 text-sm text-neutral-200 focus:outline-none">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
        </select>
        <span className="ml-auto font-mono text-xs text-faint tabular">{rows.length}/{ordered.length}</span>
      </div>
      {rows.length ? (
        <div className="max-h-[70vh] overflow-auto scroll-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Narration</th>
                <th className="px-3 py-2.5 font-medium">Beneficiary</th>
                <th className="px-3 py-2.5 font-medium">Category</th>
                <th className="px-3 py-2.5 text-right font-medium">Confidence</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted">{shortDate(r.date)}</td>
                  <td className="max-w-80 truncate px-3 py-2.5 font-mono text-xs text-neutral-400" title={r.narration}>{r.narration}</td>
                  <td className="max-w-48 truncate px-3 py-2.5 text-neutral-200">{r.counterparty ?? <span className="text-faint">–</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-neutral-300">
                    {labelOf(categoryOf(r, overrides))}
                    {overrides[r.id] && <span className="ml-2 text-xs text-faint">edited</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Confidence value={r.categoryConfidence} threshold={threshold} /></td>
                  <td className={clsx("whitespace-nowrap px-5 py-2.5 text-right font-mono tabular", r.direction === "in" ? "text-neutral-50" : "text-neutral-400")}>{naira(r.amount, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No transactions match.</Empty>}
    </Card>
  );
}
