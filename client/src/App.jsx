import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Landing, { Wordmark } from "./components/Landing.jsx";
import Overview from "./components/Overview.jsx";
import Parties from "./components/Parties.jsx";
import Charges from "./components/Charges.jsx";
import Transactions from "./components/Transactions.jsx";
import Review from "./components/Review.jsx";
import WhyJev from "./components/WhyJev.jsx";
import TxnDrawer from "./components/TxnDrawer.jsx";
import RunStats from "./components/RunStats.jsx";
import { Button, Tabs } from "./components/ui.jsx";
import { analyze, getAccessCode, health, loadSample, NeedsCodeError, NeedsPasswordError, parseFile, setAccessCode } from "./lib/api.js";
import { summarize } from "./lib/analysis.js";

export default function App() {
  const [server, setServer] = useState(null); // { hasKey, needsCode, maxUploadMb }
  const [statement, setStatement] = useState(null); // parsed statement + meta
  const [results, setResults] = useState([]);
  const [entities, setEntities] = useState({ groups: [], decisions: [], checked: 0 });
  const [usage, setUsage] = useState(null);
  const [wallMs, setWallMs] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | parsing | running | done
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(null); // { file, reason } for a password-protected PDF
  const [tab, setTab] = useState("overview");
  const [overrides, setOverrides] = useState({});
  const [threshold, setThreshold] = useState(0.7);
  const [selected, setSelected] = useState(null);
  const abort = useRef(null);

  useEffect(() => { health().then(setServer).catch(() => setServer(null)); }, []);

  async function run(parsed) {
    setStatement(parsed);
    setResults([]);
    setOverrides({});
    setEntities({ groups: [], decisions: [], checked: 0 });
    setUsage(null);
    setWallMs(null);
    setTab("overview");
    setStatus("running");
    abort.current?.abort();
    abort.current = new AbortController();
    const t0 = performance.now();
    try {
      await analyze({ transactions: parsed.transactions, holder: parsed.holder }, (ev) => {
        if (ev.type === "txn") { setResults((rs) => [...rs, ev.result]); setUsage(ev.usage); }
        else if (ev.type === "entities") setEntities(ev);
        else if (ev.type === "done") { setUsage(ev.usage); setWallMs(Math.round(performance.now() - t0)); }
        else if (ev.type === "error") throw new Error(ev.error);
      }, abort.current.signal);
      setStatus("done");
    } catch (e) {
      if (e.name !== "AbortError") { setError(e.message); setStatus("done"); }
    }
  }

  async function start(loader) {
    setError(null);
    setStatus("parsing");
    try {
      const parsed = await loader();
      setLocked(null);
      await run(parsed);
    } catch (e) {
      if (e instanceof NeedsPasswordError) {
        setStatus("idle");
        return;
      }
      if (e instanceof NeedsCodeError) setServer((s) => ({ ...s, needsCode: true }));
      setError(e instanceof NeedsCodeError ? (getAccessCode() ? "That access code isn't right." : "Enter the access code to continue.") : e.message);
      setStatus("idle");
      setStatement(null);
    }
  }

  const reset = () => { abort.current?.abort(); setStatement(null); setResults([]); setStatus("idle"); setError(null); };

  const ordered = useMemo(() => [...results].sort((a, b) => a.id - b.id), [results]);
  const summary = useMemo(() => summarize(ordered, { overrides, groups: entities.groups, threshold }), [ordered, overrides, entities.groups, threshold]);
  const override = (id, cat) => setOverrides((o) => ({ ...o, [id]: cat }));

  if (!statement || status === "parsing") {
    return (
      <Landing
        server={server}
        onAccessCode={setAccessCode}
        initialCode={getAccessCode()}
        busy={status === "parsing"}
        error={error}
        locked={locked}
        onUnlock={(password) => start(() => parseFile(locked.file, password).catch((e) => {
          if (e instanceof NeedsPasswordError) setLocked({ file: locked.file, reason: e.reason });
          throw e;
        }))}
        onCancelUnlock={() => setLocked(null)}
        onFile={(f) => start(() => parseFile(f).catch((e) => {
          if (e instanceof NeedsPasswordError) setLocked({ file: f, reason: e.reason });
          throw e;
        }))}
        onSample={(fmt) => start(() => loadSample(fmt))}
      />
    );
  }

  const total = statement.transactions.length;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "parties", label: "Beneficiaries" },
    { id: "charges", label: "Charges & taxes" },
    { id: "transactions", label: "Transactions" },
    { id: "review", label: "Review", badge: summary.review.length },
    { id: "why", label: "Why Jev" },
  ];
  const view = { ordered, arrivals: results, summary, statement, entities, overrides, threshold, onSelect: setSelected, onOverride: override, status };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex min-w-0 items-center gap-5">
          <Wordmark />
          <div className="hidden h-4 w-px bg-line-strong sm:block" />
          <div className="truncate text-sm text-muted">
            {statement.filename}<span className="text-faint"> · </span>{total} transactions{statement.holder ? <><span className="text-faint"> · </span>{statement.holder}</> : ""}
          </div>
        </div>
        <Button onClick={reset}>New statement</Button>
      </header>

      <RunStats done={results.length} total={total} usage={usage} wallMs={wallMs} status={status} error={error} />

      <div className="mt-8">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="mt-8">
          {tab === "overview" && <Overview {...view} />}
          {tab === "parties" && <Parties {...view} />}
          {tab === "charges" && <Charges {...view} />}
          {tab === "transactions" && <Transactions {...view} />}
          {tab === "review" && <Review {...view} setThreshold={setThreshold} />}
          {tab === "why" && <WhyJev {...view} usage={usage} wallMs={wallMs} />}
        </motion.div>
      </AnimatePresence>

      <TxnDrawer txn={selected} overrides={overrides} onOverride={override} onClose={() => setSelected(null)} threshold={threshold} />
    </div>
  );
}
