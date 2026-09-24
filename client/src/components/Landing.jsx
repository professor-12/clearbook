import { useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "./ui.jsx";

const STEPS = [
  ["Parse", "Code reads the CSV or PDF. Amounts, dates and signs are exact, and the running balance checks every row."],
  ["Judge", "Jev answers typed questions per transaction: what kind it is, who the other party is, and whether it is a VAT, levy or fee."],
  ["Sum", "Totals, beneficiaries and charges are computed in code. Uncertain answers go to review instead of into the numbers."],
];

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-6 grid-cols-2 gap-[3px] rounded-[5px] bg-neutral-100 p-[5px]">
        <span className="rounded-[1px] bg-neutral-950" /><span className="rounded-[1px] bg-neutral-950/30" />
        <span className="rounded-[1px] bg-neutral-950/30" /><span className="rounded-[1px] bg-neutral-950" />
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-neutral-100">Clearbook</span>
    </div>
  );
}

export default function Landing({ onFile, onSample, busy, error, server, onAccessCode, initialCode, locked, onUnlock, onCancelUnlock }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [code, setCode] = useState(initialCode ?? "");
  const hasKey = server?.hasKey;

  const drop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      <header className="flex items-center justify-between py-6">
        <Wordmark />
        <a href="https://docs.typesafe.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-neutral-200">
          About Jev <ArrowUpRight className="size-3.5" />
        </a>
      </header>

      <div className="pt-16 sm:pt-24">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-neutral-50 sm:text-[56px] sm:leading-[1.05]">
          Understand a bank statement in seconds.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Every transaction categorised, every beneficiary identified, every naira of VAT, stamp duty and bank fees accounted for.
        </p>
      </div>

      {server?.needsCode && (
        <div className="mt-12 flex max-w-md items-end gap-2">
          <label className="flex-1">
            <span className="label">Access code</span>
            <input
              type="password"
              value={code}
              onChange={(e) => { setCode(e.target.value); onAccessCode(e.target.value); }}
              placeholder="Required on this deployment"
              className="mt-1.5 w-full rounded-md border border-line-strong bg-transparent px-3 py-2 text-sm text-neutral-100 placeholder:text-faint focus:border-neutral-500 focus:outline-none"
            />
          </label>
        </div>
      )}

      {locked ? (
        <UnlockPdf locked={locked} busy={busy} onUnlock={onUnlock} onCancel={onCancelUnlock} className={server?.needsCode ? "mt-4" : "mt-12"} />
      ) : (
      <div className={`${server?.needsCode ? "mt-4" : "mt-12"} grid gap-4 lg:grid-cols-[1fr_280px]`}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={drop}
          onClick={() => !busy && input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          className={clsx(
            "flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center transition-colors",
            drag ? "border-neutral-300 bg-white/[0.04]" : "border-line-strong hover:border-neutral-500",
          )}
        >
          <input ref={input} type="file" accept=".csv,.pdf,text/csv,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {busy && <Loader2 className="mb-3 size-5 animate-spin text-neutral-400" />}
          <div className="text-[15px] font-medium text-neutral-100">{busy ? "Reading statement…" : "Drop a statement, or click to browse"}</div>
          <div className="mt-1.5 text-sm text-muted">CSV or text-based PDF, up to {server?.maxUploadMb ?? 15} MB</div>
        </div>

        <div className="panel flex flex-col justify-between p-5">
          <div>
            <div className="text-sm font-medium text-neutral-100">No statement to hand?</div>
            <p className="mt-1 text-sm text-muted">Two months of a sample Lagos current account, 108 transactions.</p>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="primary" disabled={busy} onClick={() => onSample("csv")} className="flex-1 justify-center">Sample CSV</Button>
            <Button disabled={busy} onClick={() => onSample("pdf")} className="flex-1 justify-center">Sample PDF</Button>
          </div>
        </div>
      </div>
      )}

      {error && <div className="mt-4 rounded-md border border-red-500/30 px-4 py-3 text-sm text-red-300">{error}</div>}
      {hasKey === false && (
        <div className="mt-4 rounded-md border border-line-strong px-4 py-3 text-sm text-neutral-300">
          The server has no TypeSafe API key. Set <code className="font-mono">TYPESAFE_API_KEY</code> and restart.
        </div>
      )}
      <p className="mt-4 text-xs text-faint">Narrations are sent to TypeSafe's API for classification. Nothing is stored by this app.</p>

      <div className="mt-24 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {STEPS.map(([title, body], i) => (
          <div key={title} className="bg-ink p-6">
            <div className="font-mono text-xs text-faint">0{i + 1}</div>
            <div className="mt-3 text-sm font-medium text-neutral-100">{title}{i === 1 && <span className="ml-2 text-muted">· Jev</span>}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnlockPdf({ locked, busy, onUnlock, onCancel, className }) {
  const [password, setPassword] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (password) onUnlock(password);
  };
  return (
    <form onSubmit={submit} className={clsx("panel max-w-xl p-5", className)}>
      <div className="text-sm font-medium text-neutral-100">{locked.file.name} is password-protected</div>
      <p className="mt-1 text-sm text-muted">
        {locked.reason === "incorrect" ? "That password didn't work. Check the bank's email for the password format." : "Enter the password from the bank's email to open it. It is used for this upload only and is not stored."}
      </p>
      <div className="mt-4 flex gap-2">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="PDF password"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-transparent px-3 py-2 text-sm text-neutral-100 placeholder:text-faint focus:border-neutral-500 focus:outline-none"
        />
        <Button variant="primary" type="submit" disabled={busy || !password}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}</Button>
        <Button type="button" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}
