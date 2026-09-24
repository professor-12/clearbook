import { useState } from "react";
import { naira, pct } from "../lib/format.js";

// Colour lives in the charts only. Fixed order; past six series, fold into "Other".
export const PALETTE = ["#3987e5", "#199e70", "#d95926", "#c98500", "#d55181", "#9085e9"];
export const OTHER = "#3a3a3a";
export const IN_COLOR = "#199e70";
export const OUT_COLOR = "#3987e5";

export const axisProps = { tick: { fill: "#6f6f6f", fontSize: 11 }, axisLine: false, tickLine: false };
export const gridProps = { vertical: false, stroke: "#1f1f1f" };

export function ChartTooltip({ active, payload, label, format = naira }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line-strong bg-panel-2 px-3 py-2 text-xs shadow-2xl">
      {label != null && <div className="mb-1.5 text-neutral-400">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          <span className="text-neutral-400">{p.name}</span>
          <span className="ml-auto pl-5 font-mono tabular text-neutral-100">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Top five by value plus "Other", so the palette never exceeds six hues.
export function withOther(rows, limit = 5) {
  if (rows.length <= limit + 1) return { segs: rows.map((r, i) => ({ ...r, color: PALETTE[i] })), tail: [] };
  const head = rows.slice(0, limit).map((r, i) => ({ ...r, color: PALETTE[i] }));
  const tail = rows.slice(limit);
  const other = { key: "_other", label: `Other (${tail.length})`, total: tail.reduce((s, r) => s + r.total, 0), count: tail.reduce((s, r) => s + r.count, 0), color: OTHER };
  return { segs: [...head, other], tail };
}

function LegendRow({ color, label, share, total, muted, onClick, trailing }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 py-2.5 text-left text-sm ${onClick ? "" : "cursor-default"}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className={`flex-1 truncate ${muted ? "text-muted" : "text-neutral-300"}`}>{label}{trailing}</span>
      <span className="font-mono text-xs text-muted tabular">{pct(share)}</span>
      <span className={`w-28 text-right font-mono text-sm tabular ${muted ? "text-neutral-400" : "text-neutral-100"}`}>{naira(total)}</span>
    </button>
  );
}

// A single 100% bar with a legend underneath. The long tail folds into "Other",
// which expands in place so nothing is hidden.
export function CompositionBar({ rows, total }) {
  const [open, setOpen] = useState(false);
  const { segs, tail } = withOther(rows);
  if (!total) return <div className="h-2 rounded-full bg-white/5" />;
  return (
    <div>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {segs.map((s) => (
          <div key={s.key} title={`${s.label}: ${naira(s.total)}`} className="h-full transition-[width] duration-500" style={{ width: `${(s.total / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-5 divide-y divide-line">
        {segs.map((s) => s.key === "_other" ? (
          <div key={s.key}>
            <LegendRow color={s.color} label={s.label} share={s.total / total} total={s.total} onClick={() => setOpen((o) => !o)} trailing={<span className="ml-2 text-xs text-faint">{open ? "Hide" : "Show"}</span>} />
            {open && (
              <div className="mb-2 ml-5 divide-y divide-line border-l border-line pl-3">
                {tail.map((t) => <LegendRow key={t.key} color="transparent" label={t.label} share={t.total / total} total={t.total} muted />)}
              </div>
            )}
          </div>
        ) : (
          <LegendRow key={s.key} color={s.color} label={s.label} share={s.total / total} total={s.total} />
        ))}
      </div>
    </div>
  );
}
