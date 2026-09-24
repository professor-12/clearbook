// Generates a realistic two-month Nigerian bank statement (CSV + PDF) plus
// hand-assigned labels, so the demo can report accuracy honestly on known data.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "client", "public", "samples");
fs.mkdirSync(OUT, { recursive: true });

const HOLDER = "TOLU BAKARE";
// [day, narration, amount (+in / -out), category, isNipTransfer]
const month = (m, label) => [
  [1, `NIP TRF FROM ADEBAYO OLUWASEUN T/ACCESS/rent contrib ${label}`, 150000, "transfer_from_person"],
  [2, "IKEDC PREPAID TOKEN MTR 04512345", -25000, "bills_utilities"],
  [2, "MTN VTU AIRTIME 08031234567", -5000, "airtime_data"],
  [3, "NIP TRANSFER TO BAKARE FOLASADE/ZENITH/upkeep mummy", -60000, "transfer_to_person", true],
  [4, "POS PURCHASE @ SHOPRITE LEKKI LA LANG", -42300, "groceries_shopping"],
  [5, "BOLT.EU/O/2608 RIDE LAGOS", -3450, "transport"],
  [5, "RCCG TITHE/FLUTTERWAVE", -85000, "giving"],
  [6, "POS PURCHASE @ BETTYS KITCHEN IKEJA", -8500, "food_dining"],
  [7, "DATA BUNDLE AIRTEL 20GB MONTHLY", -10000, "airtime_data"],
  [8, "NETFLIX.COM SUBSCRIPTION CARD 5399****1182", -6500, "subscriptions"],
  [9, "CARBON LOAN REPAYMENT DD 000231", -45000, "loan_repayment"],
  [10, "UBER *EATS PENDING LAGOS", -9800, "food_dining"],
  [11, "TOTAL ENERGIES LEKKI FUEL POS", -30000, "transport"],
  [12, "SPORTYBET WALLET FUNDING/PAYSTACK", -5000, "betting_gaming"],
  [13, "TRF TO SELF/TOLU BAKARE/OPAY", -100000, "own_account", true],
  [14, "WEB PURCHASE CHOWDECK/PAYSTACK", -6200, "food_dining"],
  [15, "PIGGYVEST AUTOSAVE", -20000, "savings_investment"],
  [16, "ATM WDL @ FIRSTBANK ALLEN AVENUE", -20000, "cash_withdrawal"],
  [17, "UBER *TRIP HELP.UBER.COM", -4100, "transport"],
  [18, "DSTV COMPACT RENEWAL/QUICKTELLER", -15700, "bills_utilities"],
  [19, "SPOTIFY P1F9A2 STOCKHOLM", -1900, "subscriptions"],
  [22, "BET9JA ONLINE DEPOSIT", -10000, "betting_gaming"],
  [25, `SALARY ${label} 2026 NATIVE BRANDS LTD/NIP`, 850000, "salary_income"],
  [27, "PAYMENT TO ADEWALE GAS & PLUMBING SERVICES", -12000, "vendor_payment", true],
];

const august = [
  ...month(8, "AUG"),
  [6, "NIP TRF TO JOHN LEVY/GTB/football kit", -15000, "transfer_to_person", true],
  [7, "REVERSAL: FAILED NIP TRF TO JOHN LEVY", 15000, "refund_reversal"],
  [9, "TRF FROM BRIGHTPATH MEDIA LTD/INV-0042 design retainer", 250000, "business_income"],
  [11, "TRF TO CHIOMA OKAFOR/UBA/asoebi for wedding", -35000, "transfer_to_person", true],
  [14, "FAIRMONEY MFB/LOAN DISBURSEMENT", 100000, "loan_disbursement"],
  [20, "ADEBAYO SMS VENTURES/flyer printing", -18000, "vendor_payment", true],
  [21, "JUMIA ONLINE/PAYSTACK order JM2291", -23999, "groceries_shopping"],
  [23, "LAWMA WASTE BILL Q3", -4500, "bills_utilities"],
  [24, "ESTATE SERVICE CHARGE Q3 - PARKVIEW RA", -45000, "rent_housing", true],
  [26, "LIRS PAYE REMITA 3302", -15000, "tax_government"],
  [28, "CASH DEPOSIT - IKOYI BRANCH", 40000, "cash_deposit"],
  [31, "INTEREST CREDIT JUL-AUG", 312.45, "interest"],
];

const september = [
  ...month(9, "SEP").map(([d, n, a, c, t]) =>
    n.startsWith("NIP TRF FROM ADEBAYO") ? [d, "TRANSFER FROM OLUWASEUN ADEBAYO/KUDA/rent", a, c, t]
    : n.startsWith("NIP TRANSFER TO BAKARE") ? [d, "TRF TO MRS FOLASADE BAKARE/upkeep", a, c, t]
    : [d, n, a, c, t]),
  [3, "SCHOOL FEES - GREENFIELD ACADEMY/1ST TERM", -180000, "health_education", true],
  [6, "BRIGHTPATH MEDIA/INV-0051", 250000, "business_income"],
  [8, "NIP FROM KEMI ADEYEMI/rent - flat 2 tenant", 400000, "business_income"],
  [10, "DATA ANALYTICS COURSE - UDEMY", -14500, "health_education"],
  [12, "VAT REFUND FIRS/REMITA", 38000, "grant_other_in"],
  [15, "PIGGYVEST WITHDRAWAL TO BANK", 50000, "investment_return"],
  [16, "REDDINGTON HOSPITAL CONSULTATION", -25000, "health_education"],
  [19, "TRF FROM TOLU BAKARE/OPAY/move back", 30000, "own_account_in"],
  [20, "SALARY ADVANCE REPAYMENT - NATIVE BRANDS", -50000, "loan_repayment"],
  [24, "POS CASH OUT AGENT MOSES OGBA", -10000, "cash_withdrawal"],
];

function withCharges(events, y, m) {
  const rows = [];
  for (const [d, narration, amount, category, nip] of events.sort((a, b) => a[0] - b[0])) {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    rows.push({ date, narration, amount, category });
    if (nip) {
      const fee = -amount <= 5000 ? 10.75 : -amount <= 50000 ? 26.88 : 53.75;
      rows.push({ date, narration: "COMMISSION ON NIP TRANSFER", amount: -fee, category: "bank_charges", chargeType: "transfer_fee" });
      rows.push({ date, narration: "VAT ON NIP TRANSFER COMMISSION", amount: -Math.round(fee * 7.5) / 100, category: "bank_charges", chargeType: "vat" });
    }
    if (amount >= 10000 && category !== "own_account_in")
      rows.push({ date, narration: d % 2 ? "ELECTRONIC MONEY TRANSFER LEVY" : "EMTL CHARGE ON CREDIT TXN", amount: -50, category: "bank_charges", chargeType: "emtl" });
  }
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${last}`;
  rows.push({ date: end, narration: `SMS ALERT CHARGES ${m === 8 ? "AUG" : "SEP"} 2026`, amount: -196, category: "bank_charges", chargeType: "sms_alert" });
  if (m === 9) {
    rows.push({ date: end, narration: "CARD MAINTENANCE FEE Q3", amount: -150, category: "bank_charges", chargeType: "maintenance" });
    rows.push({ date: end, narration: "VAT ON CARD MAINTENANCE FEE", amount: -11.25, category: "bank_charges", chargeType: "vat" });
  }
  return rows;
}

const rows = [...withCharges(august, 2026, 8), ...withCharges(september, 2026, 9)];
let balance = 420000;
for (const r of rows) { balance = Math.round((balance + r.amount) * 100) / 100; r.balance = balance; }

const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (iso) => { const [y, m, dd] = iso.split("-"); return `${dd}-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]}-${y}`; };
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

const csv = [
  `Account Name:,${HOLDER}`,
  "Account Number:,0123456789",
  "Period:,01-Aug-2026 to 30-Sep-2026",
  "",
  "Trans Date,Reference,Narration,Debit,Credit,Balance",
  ...rows.map((r, i) => [d(r.date), `REF${(740210 + i * 37).toString()}`, q(r.narration), r.amount < 0 ? q(fmt(-r.amount)) : "", r.amount > 0 ? q(fmt(r.amount)) : "", q(fmt(r.balance))].join(",")),
].join("\n");
fs.writeFileSync(path.join(OUT, "sample-statement.csv"), csv + "\n");
fs.writeFileSync(path.join(OUT, "sample-labels.json"), JSON.stringify(rows.map(({ narration, category, chargeType }) => ({ narration, category, chargeType: chargeType ?? null })), null, 1));

// ---- PDF version -------------------------------------------------------------
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const COLS = { date: 40, narr: 110, debit: 400, credit: 470, balance: 555 };
let page, y;
const newPage = () => {
  page = pdf.addPage([595, 842]);
  y = 800;
  page.drawText("STATEMENT OF ACCOUNT", { x: 40, y, size: 14, font: bold });
  y -= 18;
  page.drawText(`Account Name: ${HOLDER}    Account No: 0123456789    Period: 01-Aug-2026 to 30-Sep-2026`, { x: 40, y, size: 8, font });
  y -= 24;
  const right = (t, x) => page.drawText(t, { x: x - bold.widthOfTextAtSize(t, 8), y, size: 8, font: bold });
  page.drawText("Date", { x: COLS.date, y, size: 8, font: bold });
  page.drawText("Narration", { x: COLS.narr, y, size: 8, font: bold });
  right("Debit", COLS.debit); right("Credit", COLS.credit); right("Balance", COLS.balance);
  y -= 6;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  y -= 12;
};
newPage();
for (const r of rows) {
  if (y < 60) newPage();
  const right = (t, x) => page.drawText(t, { x: x - font.widthOfTextAtSize(t, 8), y, size: 8, font });
  page.drawText(d(r.date), { x: COLS.date, y, size: 8, font });
  // Wrap long narrations onto a second line, like real bank PDFs do.
  const words = r.narration.split(" ");
  let line1 = "";
  while (words.length && font.widthOfTextAtSize(line1 + " " + words[0], 8) < 230) line1 = (line1 + " " + words.shift()).trim();
  page.drawText(line1, { x: COLS.narr, y, size: 8, font });
  if (r.amount < 0) right(fmt(-r.amount), COLS.debit); else right(fmt(r.amount), COLS.credit);
  right(fmt(r.balance), COLS.balance);
  y -= 12;
  if (words.length) { page.drawText(words.join(" "), { x: COLS.narr, y, size: 8, font }); y -= 12; }
}
fs.writeFileSync(path.join(OUT, "sample-statement.pdf"), await pdf.save());
console.log(`Wrote ${rows.length} transactions to samples/ (closing balance ${fmt(balance)})`);
