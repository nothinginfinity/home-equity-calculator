// ── Home Equity Calculator Engine ──

const HEI_PROVIDERS = [
  { name: "Hometap",  origFee: 3.5, riskAdj: 85, minTerm: 10, maxTerm: 10, url: "https://www.hometap.com/", applyUrl: "https://go.hometap.com/dashboard/overview", minCredit: 600, states: "16 states + DC", maxFunding: 600000 },
  { name: "Point",    origFee: 3.9, riskAdj: 80, minTerm: 30, maxTerm: 30, url: "https://point.com/hei", applyUrl: "https://point.com/hei", minCredit: 500, states: "Nationwide (select markets)", maxFunding: 600000 },
  { name: "Unlock",   origFee: 3.0, riskAdj: 82, minTerm: 10, maxTerm: 10, url: "https://www.unlock.com/", applyUrl: "https://www.unlock.com/how-it-works/", minCredit: 500, states: "Nationwide (select markets)", maxFunding: 500000 },
  { name: "Splitero", origFee: 4.0, riskAdj: 88, minTerm: 30, maxTerm: 30, url: "https://www.splitero.com/", applyUrl: "https://www.splitero.com/shared-equity", minCredit: 500, states: "Select states", maxFunding: 500000 },
  { name: "Aspire",   origFee: 3.5, riskAdj: 83, minTerm: 15, maxTerm: 15, url: "https://www.aspirehei.com/", applyUrl: "https://www.aspirehei.com/access-your-home-equity/", minCredit: 660, states: "12 states + DC", maxFunding: 250000 },
];

function calcHEI(homeValue, cashNeeded, appreciationRate, termYears, riskAdj = 85, origFee = 3.5) {
  const adjustedValue = homeValue * (riskAdj / 100);
  const equitySharePct = cashNeeded / adjustedValue;
  const futureValue = homeValue * Math.pow(1 + appreciationRate / 100, termYears);
  const investorPayout = futureValue * equitySharePct;
  const origCost = cashNeeded * (origFee / 100);
  const totalCost = investorPayout + origCost;
  const effectiveRate = (Math.pow(totalCost / cashNeeded, 1 / termYears) - 1) * 100;

  return {
    type: "HEI",
    cashReceived: cashNeeded,
    monthlyPayment: 0,
    adjustedValue,
    equitySharePct: equitySharePct * 100,
    futureHomeValue: futureValue,
    investorPayout,
    origCost,
    totalCost,
    effectiveRate,
    termYears,
  };
}

function calcHomeEquityLoan(cashNeeded, interestRate, termYears, origFee = 1.0) {
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = termYears * 12;
  let monthlyPayment;
  if (monthlyRate === 0) {
    monthlyPayment = cashNeeded / numPayments;
  } else {
    monthlyPayment = cashNeeded * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
                     / (Math.pow(1 + monthlyRate, numPayments) - 1);
  }
  const totalPayments = monthlyPayment * numPayments;
  const origCost = cashNeeded * (origFee / 100);
  const totalCost = totalPayments + origCost;
  const totalInterest = totalPayments - cashNeeded;

  return {
    type: "Home Equity Loan",
    cashReceived: cashNeeded,
    monthlyPayment,
    interestRate,
    totalPayments,
    totalInterest,
    origCost,
    totalCost,
    effectiveRate: interestRate,
    termYears,
  };
}

function calcHELOC(cashNeeded, initialRate, rateCap, drawYears, repayYears, annualRateIncrease = 0.25, origFee = 0.5) {
  const totalTerm = drawYears + repayYears;
  let totalPaid = 0;
  let rate = initialRate;
  const monthlyPayments = [];

  // Draw period: interest-only
  for (let year = 0; year < drawYears; year++) {
    const monthlyRate = rate / 100 / 12;
    for (let m = 0; m < 12; m++) {
      const payment = cashNeeded * monthlyRate;
      monthlyPayments.push(payment);
      totalPaid += payment;
    }
    rate = Math.min(rate + annualRateIncrease, rateCap);
  }

  // Repayment period: amortizing
  let balance = cashNeeded;
  const repayMonths = repayYears * 12;
  for (let year = 0; year < repayYears; year++) {
    const monthlyRate = rate / 100 / 12;
    const remainingMonths = repayMonths - (year * 12);
    for (let m = 0; m < 12 && balance > 0; m++) {
      const remaining = remainingMonths - m;
      let payment;
      if (monthlyRate === 0) {
        payment = balance / remaining;
      } else {
        payment = balance * (monthlyRate * Math.pow(1 + monthlyRate, remaining))
                  / (Math.pow(1 + monthlyRate, remaining) - 1);
      }
      payment = Math.min(payment, balance + balance * monthlyRate);
      const interestPart = balance * monthlyRate;
      const principalPart = payment - interestPart;
      balance -= principalPart;
      monthlyPayments.push(payment);
      totalPaid += payment;
    }
    rate = Math.min(rate + annualRateIncrease, rateCap);
  }

  const origCost = cashNeeded * (origFee / 100);
  const totalCost = totalPaid + origCost;
  const totalInterest = totalPaid - cashNeeded;
  const avgMonthly = monthlyPayments.length > 0
    ? monthlyPayments.reduce((a, b) => a + b, 0) / monthlyPayments.length
    : 0;

  return {
    type: "HELOC",
    cashReceived: cashNeeded,
    monthlyPayment: avgMonthly,
    monthlyPaymentDraw: monthlyPayments.length > 0 ? monthlyPayments[0] : 0,
    monthlyPaymentRepay: monthlyPayments.length > drawYears * 12 ? monthlyPayments[drawYears * 12] : 0,
    initialRate,
    rateCap,
    totalPayments: totalPaid,
    totalInterest,
    origCost,
    totalCost,
    effectiveRate: initialRate,
    termYears: totalTerm,
    drawYears,
    repayYears,
    monthlyPayments,
  };
}

function checkQualification(creditScore, dtiRatio, homeValue, mortgageBalance) {
  const ltv = ((mortgageBalance) / homeValue) * 100;
  const equity = 100 - ltv;

  return {
    hei: {
      qualified: creditScore >= 500 && equity >= 25,
      reasons: [
        creditScore >= 500 ? "Credit score meets minimum (500+)" : "Credit score below 500 minimum",
        equity >= 25 ? `Sufficient equity (${equity.toFixed(0)}% >= 25%)` : `Insufficient equity (${equity.toFixed(0)}% < 25%)`,
        "No DTI requirement",
      ],
    },
    heq: {
      qualified: creditScore >= 620 && dtiRatio <= 43 && equity >= 15,
      reasons: [
        creditScore >= 620 ? "Credit score meets minimum (620+)" : `Credit score below 620 (yours: ${creditScore})`,
        dtiRatio <= 43 ? `DTI ratio OK (${dtiRatio}% <= 43%)` : `DTI ratio too high (${dtiRatio}% > 43%)`,
        equity >= 15 ? `Sufficient equity (${equity.toFixed(0)}% >= 15%)` : `Insufficient equity (${equity.toFixed(0)}% < 15%)`,
      ],
    },
    heloc: {
      qualified: creditScore >= 620 && dtiRatio <= 43 && equity >= 15,
      reasons: [
        creditScore >= 620 ? "Credit score meets minimum (620+)" : `Credit score below 620 (yours: ${creditScore})`,
        dtiRatio <= 43 ? `DTI ratio OK (${dtiRatio}% <= 43%)` : `DTI ratio too high (${dtiRatio}% > 43%)`,
        equity >= 15 ? `Sufficient equity (${equity.toFixed(0)}% >= 15%)` : `Insufficient equity (${equity.toFixed(0)}% < 15%)`,
        "Note: Variable rate — payments may increase",
      ],
    },
  };
}

// Yearly cost accumulation for charting
function calcYearlyCosts(inputs) {
  const { homeValue, cashNeeded, appreciationRate, termYears, heqRate, helocRate, helocCap } = inputs;
  const years = [];

  for (let y = 1; y <= termYears; y++) {
    // HEI: cost only realized at settlement
    const hei = calcHEI(homeValue, cashNeeded, appreciationRate, y);
    // Home Equity Loan: cumulative payments
    const heq = calcHomeEquityLoan(cashNeeded, heqRate, termYears);
    const heqCumulative = heq.monthlyPayment * y * 12 + heq.origCost;
    // HELOC: cumulative payments
    const heloc = calcHELOC(cashNeeded, helocRate, helocCap, Math.min(y, 10), Math.max(0, y - 10));
    const helocCumulative = heloc.totalCost;

    years.push({
      year: y,
      hei: hei.totalCost,
      heq: Math.min(heqCumulative, heq.totalCost),
      heloc: helocCumulative,
    });
  }
  return years;
}
