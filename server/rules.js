// A typical keyword/regex categoriser, the status quo Jev is compared against.
// First matching rule wins, which is how most statement analysers are built.
const OUT_RULES = [
  [/\bVAT\b|LEVY|STAMP DUTY|EMTL|SMS|COMMISSION|CHARGE|MAINTENANCE|\bFEE\b/, "bank_charges"],
  [/BET|SPORTY|1XBET|NAIRABET|LOTTO/, "betting_gaming"],
  [/LOAN|CARBON|FAIRMONEY|BRANCH|PALMCREDIT|RENMONEY|REPAYMENT/, "loan_repayment"],
  [/PIGGY|COWRY|RISEVEST|BAMBOO|SAVINGS|INVEST/, "savings_investment"],
  [/AIRTIME|DATA|VTU|MTN|AIRTEL|GLO|9MOBILE/, "airtime_data"],
  [/DSTV|GOTV|STARTIMES|IKEDC|EKEDC|AEDC|ELECTRIC|PREPAID|LAWMA|WATER/, "bills_utilities"],
  [/NETFLIX|SPOTIFY|APPLE|GOOGLE|SHOWMAX|SUBSCRIPTION/, "subscriptions"],
  [/UBER|BOLT|INDRIVE|FUEL|FILLING|PETROL|TOTAL ENERGIES|MOBIL|AIR PEACE|FLIGHT/, "transport"],
  [/CHOWDECK|GLOVO|RESTAURANT|KITCHEN|CHICKEN|DOMINO|KFC|EATERY|FOOD/, "food_dining"],
  [/SHOPRITE|SPAR|JUMIA|KONGA|SUPERMARKET|MART|STORE|MALL/, "groceries_shopping"],
  [/RENT|SERVICE CHARGE|ESTATE/, "rent_housing"],
  [/ATM|CASH ?OUT|WDL|WITHDRAWAL/, "cash_withdrawal"],
  [/FIRS|LIRS|REMITA|TAX/, "tax_government"],
  [/HOSPITAL|PHARMACY|CLINIC|SCHOOL|FEES|WAEC|JAMB/, "health_education"],
  [/TITHE|OFFERING|CHURCH|MOSQUE|DONATION|RCCG/, "giving"],
  [/TRF|TRANSFER|NIP/, "transfer_to_person"],
];
const IN_RULES = [
  [/SALARY|PAYROLL|WAGES/, "salary_income"],
  [/REVERSAL|REVERSED|REFUND|RVSL/, "refund_reversal"],
  [/LOAN|DISBURSE/, "loan_disbursement"],
  [/INTEREST/, "interest"],
  [/PIGGY|COWRY|RISEVEST|BAMBOO|DIVIDEND|WITHDRAW/, "investment_return"],
  [/CASH DEP|DEPOSIT/, "cash_deposit"],
  [/INVOICE|PAYMENT FOR|ORDER|SALES/, "business_income"],
  [/TRF|TRANSFER|NIP/, "transfer_from_person"],
];
const CHARGE_RULES = [
  [/\bVAT\b/, "vat"],
  [/LEVY|STAMP DUTY|EMTL/, "emtl"],
  [/SMS/, "sms_alert"],
  [/MAINTENANCE|COT/, "maintenance"],
  [/COMMISSION|TRANSFER CHARGE|NIP CHARGE/, "transfer_fee"],
];

export function rulesCategory(txn) {
  const text = txn.narration.toUpperCase();
  const rules = txn.direction === "in" ? IN_RULES : OUT_RULES;
  return rules.find(([re]) => re.test(text))?.[1] ?? (txn.direction === "in" ? "grant_other_in" : "other_out");
}

export function rulesChargeType(txn) {
  const text = txn.narration.toUpperCase();
  return CHARGE_RULES.find(([re]) => re.test(text))?.[1] ?? "not_a_charge";
}
