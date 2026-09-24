// Runs the full pipeline on the bundled sample and reports accuracy vs labels,
// side by side with the keyword-rules baseline. Usage: node scripts/eval-sample.js
import fs from "node:fs";
import { readCsv } from "../server/parse/csv.js";
import { Ledger } from "../server/jev.js";
import { classifyTransactions, resolveEntities } from "../server/analyze.js";

const { transactions, holder } = await readCsv(fs.readFileSync("client/public/samples/sample-statement.csv", "utf8"));
const labels = JSON.parse(fs.readFileSync("client/public/samples/sample-labels.json", "utf8"));
const ledger = new Ledger();
const t0 = performance.now();
const results = [];
await classifyTransactions(transactions, holder, ledger, (r) => results.push(r));
results.sort((a, b) => a.id - b.id);
const entities = await resolveEntities(results, ledger);

let jev = 0, rules = 0, chJ = 0, chR = 0, chN = 0;
for (const r of results) {
  const l = labels[r.id];
  const ok = r.category === l.category, rok = r.rulesCategory === l.category;
  jev += ok; rules += rok;
  if (!ok) console.log(`JEV MISS  ${r.narration.padEnd(55)} jev=${r.category} (${r.categoryConfidence.toFixed(2)}) want=${l.category}`);
  if (l.chargeType) { chN++; chJ += r.chargeType === l.chargeType; chR += r.rulesChargeType === l.chargeType; }
}
for (const r of results) if (r.rulesCategory !== labels[r.id].category) console.log(`RULE MISS ${r.narration.padEnd(55)} rules=${r.rulesCategory}`);
console.log("\ncounterparties:", results.filter((r) => r.counterparty).slice(0, 60).map((r) => `${r.narration} => ${r.counterparty}`).join("\n"));
console.log("\nmerged groups:", JSON.stringify(entities.groups), "pairs checked:", entities.checked);
console.log(`\ncategory accuracy  jev ${jev}/${results.length}  rules ${rules}/${results.length}`);
console.log(`charge type        jev ${chJ}/${chN}  rules ${chR}/${chN}`);
console.log(ledger.summary(), `wall ${Math.round(performance.now() - t0)}ms`);
