// One taxonomy, shared by the server (as Jev Choice criteria) and the UI (labels).
// Descriptions are written for Jev: concrete, Nigerian-banking specific, with
// boundary cases spelled out, because Jev reads criteria literally.

export const OUTFLOW_CATEGORIES = {
  transfer_to_person: { label: "Transfers to people", desc: "Money sent to an individual (family, friend, colleague, contact) by bank transfer, where no business or bill is named." },
  vendor_payment: { label: "Payments to businesses", desc: "Transfer or payment to a named business, vendor, supplier or service provider that is not better described by a more specific category below." },
  own_account: { label: "Own-account moves", desc: "Money moved to another account or wallet that belongs to `account_holder` themselves (e.g. to their own OPay, Kuda or savings account)." },
  bills_utilities: { label: "Bills & utilities", desc: "Electricity tokens or bills (IKEDC, EKEDC, AEDC, prepaid meter), water, waste (LAWMA), cable TV (DSTV, GOtv, Startimes), home internet." },
  airtime_data: { label: "Airtime & data", desc: "Mobile airtime recharge or data bundles (MTN, Airtel, Glo, 9mobile), VTU top-ups." },
  food_dining: { label: "Food & dining", desc: "Restaurants, eateries, bars, cafes, food delivery (Chowdeck, Glovo, Uber Eats, Chicken Republic)." },
  groceries_shopping: { label: "Shopping & groceries", desc: "Supermarkets, retail stores, markets, e-commerce (Shoprite, Spar, Jumia, Konga), clothing and household goods." },
  transport: { label: "Transport & fuel", desc: "Ride hailing (Uber, Bolt, inDrive rides), fuel stations, flights, buses, tolls, parking." },
  rent_housing: { label: "Rent & housing", desc: "Rent, service charge, estate dues, agent or caution fees paid by `account_holder`." },
  subscriptions: { label: "Subscriptions", desc: "Recurring digital services: Netflix, Spotify, Apple, Google, Showmax, software, gym memberships." },
  loan_repayment: { label: "Loan repayments", desc: "Repaying a loan or credit: loan apps (Carbon, FairMoney, Branch, Palmcredit, Renmoney), bank loan instalments, salary-advance repayments." },
  savings_investment: { label: "Savings & investments", desc: "Money put into savings or investment platforms (PiggyVest, Cowrywise, Risevest, Bamboo, fixed deposits, stocks)." },
  betting_gaming: { label: "Betting & gaming", desc: "Sports betting, lottery or gambling wallets (Bet9ja, SportyBet, BetKing, 1xBet, NairaBet)." },
  cash_withdrawal: { label: "Cash withdrawals", desc: "Cash taken out at an ATM or via a POS agent cash-out." },
  bank_charges: { label: "Bank charges & levies", desc: "Fees, taxes and levies charged by the bank itself: transfer commission, VAT on fees, Electronic Money Transfer Levy (EMTL) / stamp duty, SMS alert charges, card or account maintenance fees." },
  tax_government: { label: "Tax & government", desc: "Payments to government agencies: FIRS, LIRS, state IRS, Remita, customs, license or permit fees." },
  health_education: { label: "Health & education", desc: "Hospitals, pharmacies, HMOs, school fees, courses, exams (WAEC, JAMB)." },
  giving: { label: "Giving & donations", desc: "Tithes, offerings, church or mosque giving, charity donations, contributions to events." },
  other_out: { label: "Other spending", desc: "Money out that fits none of the categories above, or where the narration gives no clue." },
};

export const INFLOW_CATEGORIES = {
  salary_income: { label: "Salary & wages", desc: "Salary, wages, payroll, allowances or bonus paid by an employer to `account_holder`." },
  business_income: { label: "Business income", desc: "Payment from a customer or client for goods or services, invoices, sales proceeds, rent received from a tenant." },
  transfer_from_person: { label: "Transfers from people", desc: "Money received from an individual (family, friend, contact) with no sign it is salary or business revenue." },
  own_account_in: { label: "Own-account moves", desc: "Money coming in from another account or wallet that belongs to `account_holder` themselves." },
  loan_disbursement: { label: "Loans received", desc: "A loan or credit paid out to `account_holder` by a lender, loan app or bank." },
  refund_reversal: { label: "Refunds & reversals", desc: "A failed transaction being reversed, a merchant refund, or a chargeback returned to the account." },
  investment_return: { label: "Savings & investment withdrawals", desc: "Money withdrawn back from savings or investment platforms, dividends, matured deposits." },
  interest: { label: "Interest earned", desc: "Interest credited by the bank on the account balance." },
  cash_deposit: { label: "Cash deposits", desc: "Cash deposited over the counter, at an ATM or through a POS agent." },
  grant_other_in: { label: "Grants & other", desc: "Grants, government payments, tax refunds, prizes, or money in that fits none of the categories above." },
};

export const CHARGE_TYPES = {
  vat: { label: "VAT on fees", desc: "Value Added Tax (7.5%) charged on a bank fee or commission." },
  emtl: { label: "EMTL / stamp duty", desc: "Electronic Money Transfer Levy or stamp duty (usually ₦50) charged on a transfer received." },
  transfer_fee: { label: "Transfer fees", desc: "Commission or fee for sending a transfer (NIP, NEFT, USSD transfer charge)." },
  sms_alert: { label: "SMS alert charges", desc: "Charges for SMS transaction alerts or notifications." },
  maintenance: { label: "Maintenance fees", desc: "Card maintenance, account maintenance (COT) or card issuance fees." },
  other_fee: { label: "Other bank fees", desc: "Any other fee the bank charges that is not described above." },
  not_a_charge: { label: "Not a bank charge", desc: "This is not a fee, tax or levy charged by the bank; it is ordinary spending or a transfer." },
};

export const ALL_CATEGORIES = { ...OUTFLOW_CATEGORIES, ...INFLOW_CATEGORIES };
export const labelOf = (key) => ALL_CATEGORIES[key]?.label ?? CHARGE_TYPES[key]?.label ?? key;
