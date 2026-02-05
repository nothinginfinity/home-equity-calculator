// ── Dashboard App Controller ──

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtD = (n) => "$" + fmt(n);
const fmtPct = (n) => n.toFixed(1) + "%";

// State
const state = {
  homeValue: 500000,
  mortgageBalance: 200000,
  cashNeeded: 75000,
  creditScore: 700,
  dtiRatio: 35,
  timeHorizon: 10,
  appreciationRate: 4,
  heqRate: 7.5,
  helocRate: 8.25,
  helocCap: 18.0,
};

// Bind sliders and inputs
function initInputs() {
  bindSlider("homeValue",        "#home-value",        "#home-value-display",        fmtD, 100000, 2000000, 10000);
  bindSlider("mortgageBalance",  "#mortgage-balance",  "#mortgage-balance-display",  fmtD, 0, 1500000, 5000);
  bindSlider("cashNeeded",       "#cash-needed",       "#cash-needed-display",       fmtD, 15000, 600000, 5000);
  bindSlider("appreciationRate", "#appreciation-rate", "#appreciation-rate-display",  (v) => v.toFixed(1) + "% / yr", 0, 10, 0.5);
  bindSlider("timeHorizon",      "#time-horizon",      "#time-horizon-display",      (v) => v + " years", 5, 30, 1);
  bindSlider("creditScore",      "#credit-score",      "#credit-score-display",      (v) => v.toString(), 400, 850, 10);
  bindSlider("dtiRatio",         "#dti-ratio",         "#dti-ratio-display",         (v) => v + "%", 0, 60, 1);

  // Rate inputs
  bindNumberInput("heqRate",   "#heq-rate");
  bindNumberInput("helocRate", "#heloc-rate");
  bindNumberInput("helocCap",  "#heloc-cap");

  // Load from localStorage if available
  const saved = localStorage.getItem("heCalcState");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
      syncAllInputs();
    } catch (_) {}
  }
}

function bindSlider(key, sliderSel, displaySel, formatter, min, max, step) {
  const slider = $(sliderSel);
  const display = $(displaySel);
  if (!slider) return;

  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = state[key];
  display.textContent = formatter(state[key]);

  slider.addEventListener("input", () => {
    state[key] = parseFloat(slider.value);
    display.textContent = formatter(state[key]);
    update();
  });
}

function bindNumberInput(key, sel) {
  const input = $(sel);
  if (!input) return;
  input.value = state[key];
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) {
      state[key] = v;
      update();
    }
  });
}

function syncAllInputs() {
  const setSlider = (sel, val) => {
    const el = $(sel);
    if (el) el.value = val;
  };
  setSlider("#home-value",        state.homeValue);
  setSlider("#mortgage-balance",  state.mortgageBalance);
  setSlider("#cash-needed",       state.cashNeeded);
  setSlider("#appreciation-rate", state.appreciationRate);
  setSlider("#time-horizon",      state.timeHorizon);
  setSlider("#credit-score",      state.creditScore);
  setSlider("#dti-ratio",         state.dtiRatio);

  $("#home-value-display").textContent        = fmtD(state.homeValue);
  $("#mortgage-balance-display").textContent   = fmtD(state.mortgageBalance);
  $("#cash-needed-display").textContent        = fmtD(state.cashNeeded);
  $("#appreciation-rate-display").textContent   = state.appreciationRate.toFixed(1) + "% / yr";
  $("#time-horizon-display").textContent        = state.timeHorizon + " years";
  $("#credit-score-display").textContent        = state.creditScore.toString();
  $("#dti-ratio-display").textContent           = state.dtiRatio + "%";

  const setNum = (sel, val) => { const el = $(sel); if (el) el.value = val; };
  setNum("#heq-rate",   state.heqRate);
  setNum("#heloc-rate",  state.helocRate);
  setNum("#heloc-cap",   state.helocCap);
}

// ── Main Update ──
function update() {
  // Save state
  localStorage.setItem("heCalcState", JSON.stringify(state));

  // Update home summary
  const equity = state.homeValue - state.mortgageBalance;
  const equityPct = (equity / state.homeValue) * 100;
  const ltv = 100 - equityPct;
  $("#equity-val").textContent = fmtD(equity);
  $("#equity-pct").textContent = fmtPct(equityPct);
  $("#ltv-val").textContent = fmtPct(ltv);

  // Run calculations
  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));

  // Find cheapest
  const costs = [
    { type: "hei", cost: hei.totalCost },
    { type: "heq", cost: heq.totalCost },
    { type: "heloc", cost: heloc.totalCost },
  ];
  costs.sort((a, b) => a.cost - b.cost);
  const cheapest = costs[0].type;
  const maxCost = Math.max(hei.totalCost, heq.totalCost, heloc.totalCost);

  // Update cards
  updateCard("hei", hei, cheapest, maxCost);
  updateCard("heq", heq, cheapest, maxCost);
  updateCard("heloc", heloc, cheapest, maxCost);

  // Update qualification
  const qual = checkQualification(state.creditScore, state.dtiRatio, state.homeValue, state.mortgageBalance);
  updateQualification(qual);

  // Update decision helper
  updateDecision(hei, heq, heloc, cheapest);

  // Update charts (Phase 2)
  if (typeof updateAllCharts === 'function') {
    updateAllCharts();
  }

  // Update provider comparison (Phase 3)
  if (typeof updateProviderSection === 'function') {
    updateProviderSection();
  }

  // Update intelligence (Phase 4)
  if (typeof updateIntelligence === 'function') {
    updateIntelligence();
  }
}

function updateCard(type, data, cheapest, maxCost) {
  const card = $(`.card.${type}`);
  card.classList.toggle("best", cheapest === type);

  card.querySelector(".big-number").textContent = fmtD(data.totalCost);

  const statsMap = {
    hei: () => ({
      "Monthly Payment": "$0",
      "Cash Received": fmtD(data.cashReceived),
      "Equity Shared": fmtPct(data.equitySharePct),
      "Future Home Value": fmtD(data.futureHomeValue),
      "Investor Gets": fmtD(data.investorPayout),
      "Effective Rate": fmtPct(data.effectiveRate),
      "Orig. Fee": fmtD(data.origCost),
    }),
    heq: () => ({
      "Monthly Payment": fmtD(data.monthlyPayment),
      "Cash Received": fmtD(data.cashReceived),
      "Interest Rate": fmtPct(data.interestRate),
      "Total Interest": fmtD(data.totalInterest),
      "Orig. Fee": fmtD(data.origCost),
      "Term": data.termYears + " years",
    }),
    heloc: () => ({
      "Draw Payment": fmtD(data.monthlyPaymentDraw) + " /mo",
      "Repay Payment": fmtD(data.monthlyPaymentRepay) + " /mo",
      "Cash Received": fmtD(data.cashReceived),
      "Initial Rate": fmtPct(data.initialRate),
      "Rate Cap": fmtPct(data.rateCap),
      "Total Interest": fmtD(data.totalInterest),
      "Orig. Fee": fmtD(data.origCost),
    }),
  };

  const stats = statsMap[type]();
  const statsEl = card.querySelector(".card-stats");
  statsEl.innerHTML = Object.entries(stats).map(([k, v]) =>
    `<div class="stat"><span class="label">${k}</span><span class="val">${v}</span></div>`
  ).join("");

  // Cost bar
  const pct = maxCost > 0 ? (data.totalCost / maxCost) * 100 : 0;
  card.querySelector(".cost-bar .fill").style.width = pct + "%";
}

function updateQualification(qual) {
  updateQualItem("hei", "HEI (Sharing)", qual.hei);
  updateQualItem("heq", "Home Equity Loan", qual.heq);
  updateQualItem("heloc", "HELOC", qual.heloc);
}

function updateQualItem(type, label, data) {
  const el = $(`.qual-item.${type}`);
  if (!el) return;

  const statusEl = el.querySelector(".qual-status");
  const reasonEl = el.querySelector(".qual-reason");

  if (data.qualified) {
    statusEl.textContent = `\u2705 ${label} — Qualified`;
    statusEl.className = "qual-status pass";
  } else {
    statusEl.textContent = `\u274C ${label} — Not Qualified`;
    statusEl.className = "qual-status fail";
  }

  reasonEl.innerHTML = data.reasons.map(r => {
    const icon = r.startsWith("Credit score below") || r.startsWith("DTI ratio too") || r.startsWith("Insufficient")
      ? "\u2022 " : "\u2022 ";
    return `<div>${icon}${r}</div>`;
  }).join("");
}

function updateDecision(hei, heq, heloc, cheapest) {
  const box = $(".decision-box p");
  const savings = {
    hei: heq.totalCost - hei.totalCost,
    heq: hei.totalCost - heq.totalCost,
    heloc: hei.totalCost - heloc.totalCost,
  };

  let msg = "";
  if (cheapest === "heq") {
    msg = `Based on your inputs, a <strong>Home Equity Loan</strong> is the cheapest option, `
      + `costing <strong>${fmtD(savings.heq)}</strong> less than the HEI over ${state.timeHorizon} years `
      + `at ${state.appreciationRate}% appreciation. However, the HEI requires <strong>$0/month</strong> `
      + `vs <strong>${fmtD(heq.monthlyPayment)}/month</strong>. `
      + `If cash flow is your priority and you expect low appreciation (<3%), the HEI may still win.`;
  } else if (cheapest === "heloc") {
    msg = `Based on your inputs, a <strong>HELOC</strong> is the cheapest option at <strong>${fmtD(heloc.totalCost)}</strong> total cost. `
      + `But remember: HELOC rates are variable and could rise to ${fmtPct(state.helocCap)}. `
      + `The Home Equity Loan at <strong>${fmtD(heq.totalCost)}</strong> offers predictable fixed payments of <strong>${fmtD(heq.monthlyPayment)}/month</strong>.`;
  } else {
    msg = `At <strong>${state.appreciationRate}% appreciation</strong>, the <strong>HEI is actually cheapest</strong> `
      + `at <strong>${fmtD(hei.totalCost)}</strong> — and requires no monthly payments. `
      + `But be cautious: if appreciation rises above ~${fmtPct(state.heqRate - 1)}, the HEI will cost more. `
      + `The HEI's cost is tied to your home's future value, making it a bet on slow growth.`;
  }
  box.innerHTML = msg;
}

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  initInputs();
  if (typeof initScenarios === 'function') initScenarios();
  update();
});
