import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Confidence, ProbBars } from "./ui.jsx";
import { categoryOf, categoriesFor } from "../lib/analysis.js";
import { CHARGE_TYPES, labelOf } from "../../../shared/taxonomy.js";
import { naira } from "../lib/format.js";

function Section({ title, right, children }) {
  return (
    <div className="border-t border-line py-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-100">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function TxnDrawer({ txn, overrides, onOverride, onClose, threshold }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <AnimatePresence>
      {txn && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-line-strong bg-panel px-6 pt-6 scroll-thin"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="label">{txn.date} · {txn.direction === "in" ? "Money in" : "Money out"}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-50">{naira(txn.amount, { sign: true })}</div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted hover:bg-white/5 hover:text-neutral-100"><X className="size-5" /></button>
            </div>
            <div className="mb-6 mt-4 rounded-md border border-line bg-ink p-3 font-mono text-sm text-neutral-200">{txn.narration}</div>

            <div>
              <Section title="Category" right={<Confidence value={txn.categoryConfidence} threshold={threshold} />}>
                <ProbBars probs={txn.categoryProbs} highlight={txn.rulesCategory} />
                <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                  Keyword rules: <span className="text-neutral-300">{labelOf(txn.rulesCategory)}</span>
                  <span className="ml-auto">{txn.rulesCategory === txn.category ? "Agrees with Jev" : "Disagrees with Jev"}</span>
                </div>
              </Section>

              {txn.counterpartyProbs && (
                <Section title="Counterparty" right={<Confidence value={txn.counterpartyConfidence} threshold={threshold} />}>
                  <ProbBars probs={txn.counterpartyProbs} labeler={(k) => (k === "NONE" ? "No named party" : k)} limit={4} />
                  <p className="mt-3 text-xs leading-relaxed text-faint">Code cuts the narration into candidate spans and Jev selects one, so the name is always verbatim from the statement.</p>
                </Section>
              )}

              {txn.chargeProbs && (
                <Section title="Bank charge type" right={<Confidence value={txn.chargeConfidence} threshold={threshold} />}>
                  <ProbBars probs={txn.chargeProbs} labeler={(k) => CHARGE_TYPES[k]?.label ?? k} limit={3} />
                  <p className="mt-3 text-xs leading-relaxed text-faint">Asked in the same request as the category; used only when the category is a bank charge.</p>
                </Section>
              )}

              <Section title="Override">
                <select
                  value={categoryOf(txn, overrides)}
                  onChange={(e) => onOverride(txn.id, e.target.value)}
                  className="w-full rounded-md border border-line-strong bg-panel px-3 py-2 text-sm text-neutral-100 focus:outline-none"
                >
                  {Object.entries(categoriesFor(txn.direction)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <p className="mt-2 text-xs text-faint">Totals update instantly; Jev is not called again.</p>
              </Section>

              <div className="border-t border-line py-5 font-mono text-xs text-faint">
                Answered in {txn.ms} ms · {Object.keys(txn.categoryProbs).length + (txn.counterpartyProbs ? Object.keys(txn.counterpartyProbs).length : 0) + (txn.chargeProbs ? Object.keys(txn.chargeProbs).length : 0)} options scored in one request
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
