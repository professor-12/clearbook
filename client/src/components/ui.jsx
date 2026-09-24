import clsx from "clsx";
import { labelOf } from "../../../shared/taxonomy.js";
import { pct } from "../lib/format.js";

export function Card({ className, children, ...rest }) {
  return <section className={clsx("panel", className)} {...rest}>{children}</section>;
}

export function CardHeader({ title, sub, right, className }) {
  return (
    <div className={clsx("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
        {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      </div>
      {right && <div className="shrink-0 text-xs text-muted">{right}</div>}
    </div>
  );
}

// Plain figure; only answers under the threshold get a (status) colour.
export function Confidence({ value, threshold = 0.7 }) {
  if (value == null) return null;
  const low = value < threshold;
  return (
    <span title={`Jev confidence ${pct(value)}`} className={clsx("inline-flex items-center gap-1.5 font-mono text-xs tabular", low ? "text-warn" : "text-muted")}>
      {low && <span className="size-1.5 rounded-full bg-warn" />}
      {pct(value)}
    </span>
  );
}

export function CategoryTag({ category, className }) {
  return <span className={clsx("text-sm text-neutral-300", className)}>{labelOf(category)}</span>;
}

// A Jev distribution: top option white, the rest grey.
export function ProbBars({ probs, labeler = labelOf, limit = 5, highlight }) {
  if (!probs) return null;
  const rows = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, limit);
  return (
    <div className="space-y-2.5">
      {rows.map(([k, p], i) => (
        <div key={k}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className={clsx("truncate", i === 0 ? "text-neutral-100" : "text-muted")}>
              {labeler(k)}
              {highlight === k && i !== 0 && <span className="ml-2 text-faint">← rules</span>}
            </span>
            <span className="font-mono text-muted tabular">{p < 0.005 ? "<1%" : pct(p)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06]">
            <div className={clsx("h-full rounded-full transition-all duration-500", i === 0 ? "bg-neutral-100" : "bg-neutral-600")} style={{ width: `${Math.max(p * 100, 1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <nav className="flex gap-6 overflow-x-auto border-b border-line scroll-thin">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "-mb-px flex shrink-0 items-center gap-2 border-b py-3 text-sm transition-colors",
            value === t.id ? "border-neutral-100 text-neutral-100" : "border-transparent text-muted hover:text-neutral-300",
          )}
        >
          {t.label}
          {t.badge > 0 && <span className="rounded bg-white/10 px-1.5 font-mono text-[11px] text-neutral-300 tabular">{t.badge}</span>}
        </button>
      ))}
    </nav>
  );
}

export function Button({ className, variant = "secondary", ...rest }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40",
        variant === "primary" ? "bg-neutral-100 text-neutral-950 hover:bg-white" : "border border-line-strong text-neutral-200 hover:bg-white/[0.04]",
        className,
      )}
      {...rest}
    />
  );
}

export function Empty({ children }) {
  return <div className="px-5 py-10 text-center text-sm text-muted">{children}</div>;
}
