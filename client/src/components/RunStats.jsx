import { usd } from "../lib/format.js";

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="mt-1 truncate font-mono text-sm text-neutral-100 tabular">{value}</div>
    </div>
  );
}

export default function RunStats({ done, total, usage, wallMs, status, error }) {
  const running = status === "running";
  const progress = total ? (running && done === total ? 0.98 : done / total) : 0;
  return (
    <div className="panel overflow-hidden">
      <div className="h-px w-full bg-line">
        <div className="h-px bg-neutral-100 transition-[width] duration-300" style={{ width: `${(running || done < total ? progress : 1) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 items-center gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-[1.8fr_repeat(5,1fr)]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <span className={`size-1.5 rounded-full ${error ? "bg-red-400" : running ? "animate-pulse bg-neutral-100" : "bg-neutral-500"}`} />
            {error ? "Run stopped" : running ? (done < total ? `Classifying ${done + 1} of ${total}` : "Matching beneficiary names") : `${total} transactions classified`}
          </div>
          <div className="mt-1 text-xs text-muted">{error ?? (running ? "Results appear as Jev answers" : "Figures are computed in code from Jev's answers")}</div>
        </div>
        <Stat label="Jev requests" value={usage?.requests ?? 0} />
        <Stat label="Questions" value={usage?.questions ?? 0} />
        <Stat label="Median latency" value={usage ? `${Math.round(usage.p50Ms)} ms` : "–"} />
        <Stat label="Cost" value={usage ? usd(usage.costUsd) : "–"} />
        <Stat label="Wall time" value={wallMs ? `${(wallMs / 1000).toFixed(1)} s` : running ? "…" : "–"} />
      </div>
    </div>
  );
}
