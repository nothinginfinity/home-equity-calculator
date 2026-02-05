// ── Phase 4: Decision Intelligence ──

// ── 1. Enhanced Recommendation Engine ──
function updateRecommendation() {
  const el = document.getElementById('recommendation-body');
  if (!el) return;

  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));
  const qual = checkQualification(state.creditScore, state.dtiRatio, state.homeValue, state.mortgageBalance);

  const products = [
    { key: 'hei', name: 'HEI', cost: hei.totalCost, monthly: 0, qualified: qual.hei.qualified },
    { key: 'heq', name: 'Home Equity Loan', cost: heq.totalCost, monthly: heq.monthlyPayment, qualified: qual.heq.qualified },
    { key: 'heloc', name: 'HELOC', cost: heloc.totalCost, monthly: heloc.monthlyPayment, qualified: qual.heloc.qualified },
  ];

  const qualified = products.filter(p => p.qualified);
  const cheapest = qualified.length > 0
    ? qualified.reduce((a, b) => a.cost < b.cost ? a : b)
    : products.reduce((a, b) => a.cost < b.cost ? a : b);

  // Build multi-factor analysis
  const factors = [];

  // Cost factor
  factors.push({
    icon: '$',
    label: 'Lowest Total Cost',
    winner: cheapest.name,
    detail: `${fmtD(cheapest.cost)} over ${state.timeHorizon} years`,
    color: 'var(--green)',
  });

  // Cash flow factor
  const lowestMonthly = products.reduce((a, b) => a.monthly < b.monthly ? a : b);
  factors.push({
    icon: '\u{1F4B0}',
    label: 'Best Cash Flow',
    winner: lowestMonthly.name,
    detail: lowestMonthly.monthly === 0 ? '$0/month — no payments until settlement' : `${fmtD(lowestMonthly.monthly)}/month`,
    color: 'var(--accent)',
  });

  // Risk factor
  const heiAt2 = calcHEI(state.homeValue, state.cashNeeded, 2, state.timeHorizon);
  const heiAt6 = calcHEI(state.homeValue, state.cashNeeded, 6, state.timeHorizon);
  const heiSwing = heiAt6.totalCost - heiAt2.totalCost;
  factors.push({
    icon: '\u{26A0}',
    label: 'Lowest Risk',
    winner: 'Home Equity Loan',
    detail: `Fixed cost. HEI swings ${fmtD(heiSwing)} between 2%-6% appreciation`,
    color: 'var(--yellow)',
  });

  // Qualification factor
  const easiest = qual.hei.qualified ? 'HEI' : (qual.heq.qualified ? 'Home Equity Loan' : 'HELOC');
  factors.push({
    icon: '\u{2705}',
    label: 'Easiest to Qualify',
    winner: easiest,
    detail: qual.hei.qualified ? 'HEI accepts 500+ credit, no DTI check' : 'Traditional loans need 620+ credit, DTI < 43%',
    color: 'var(--hei-color)',
  });

  // Build recommendation text
  let recommendation = '';
  if (state.appreciationRate <= 2.5 && qual.hei.qualified) {
    recommendation = `<strong>HEI looks favorable.</strong> At ${state.appreciationRate}% appreciation, the effective cost is low and you avoid monthly payments. Best if you need cash flow flexibility and expect modest home growth.`;
  } else if (state.appreciationRate >= 5) {
    recommendation = `<strong>Avoid HEI at ${state.appreciationRate}% appreciation.</strong> The shared equity would cost ${fmtD(hei.totalCost)} — significantly more than a fixed-rate loan (${fmtD(heq.totalCost)}). A Home Equity Loan gives predictable costs.`;
  } else if (!qual.heq.qualified && !qual.heloc.qualified && qual.hei.qualified) {
    recommendation = `<strong>HEI may be your best option.</strong> Your credit score (${state.creditScore}) or DTI (${state.dtiRatio}%) doesn't qualify for traditional loans. The HEI's flexible requirements could work — but understand the appreciation risk.`;
  } else if (heq.monthlyPayment > state.cashNeeded * 0.015) {
    recommendation = `<strong>Monthly payments are significant.</strong> The Home Equity Loan requires ${fmtD(heq.monthlyPayment)}/month. If that strains your budget, the HEI's $0 monthly payment is worth the tradeoff — if appreciation stays below ~${(state.heqRate - 1).toFixed(0)}%.`;
  } else {
    recommendation = `<strong>Home Equity Loan is the safest bet.</strong> At ${fmtD(heq.monthlyPayment)}/month with a fixed ${state.heqRate}% rate, you know exactly what you'll pay. Total cost: ${fmtD(heq.totalCost)} over ${state.timeHorizon} years.`;
  }

  el.innerHTML = `
    <div class="rec-factors">
      ${factors.map(f => `
        <div class="rec-factor">
          <div class="rec-factor-icon">${f.icon}</div>
          <div class="rec-factor-body">
            <div class="rec-factor-label">${f.label}</div>
            <div class="rec-factor-winner" style="color: ${f.color}">${f.winner}</div>
            <div class="rec-factor-detail">${f.detail}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="rec-summary">${recommendation}</div>
  `;
}

// ── 2. Scenario Builder ──
let scenarios = [];

function captureScenario() {
  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));

  scenarios.push({
    id: Date.now(),
    label: `Scenario ${scenarios.length + 1}`,
    inputs: { ...state },
    results: {
      hei: { totalCost: hei.totalCost, effectiveRate: hei.effectiveRate, monthly: 0 },
      heq: { totalCost: heq.totalCost, effectiveRate: heq.effectiveRate, monthly: heq.monthlyPayment },
      heloc: { totalCost: heloc.totalCost, effectiveRate: heloc.effectiveRate, monthly: heloc.monthlyPayment },
    },
    cheapest: [
      { k: 'hei', c: hei.totalCost }, { k: 'heq', c: heq.totalCost }, { k: 'heloc', c: heloc.totalCost }
    ].sort((a, b) => a.c - b.c)[0].k,
  });

  localStorage.setItem('heCalcScenarios', JSON.stringify(scenarios));
  renderScenarios();
}

function removeScenario(id) {
  scenarios = scenarios.filter(s => s.id !== id);
  localStorage.setItem('heCalcScenarios', JSON.stringify(scenarios));
  renderScenarios();
}

function loadScenario(id) {
  const s = scenarios.find(s => s.id === id);
  if (!s) return;
  Object.assign(state, s.inputs);
  syncAllInputs();
  update();
}

function clearScenarios() {
  scenarios = [];
  localStorage.removeItem('heCalcScenarios');
  renderScenarios();
}

function renderScenarios() {
  const el = document.getElementById('scenario-list');
  if (!el) return;

  if (scenarios.length === 0) {
    el.innerHTML = '<div class="scenario-empty">No scenarios saved yet. Click "Capture Snapshot" to save the current configuration.</div>';
    return;
  }

  const typeLabels = { hei: 'HEI', heq: 'HE Loan', heloc: 'HELOC' };
  const typeColors = { hei: 'var(--hei-color)', heq: 'var(--heq-color)', heloc: 'var(--heloc-color)' };

  el.innerHTML = `
    <div class="scenario-table">
      <div class="scenario-header-row">
        <div class="sc-cell sc-label">Scenario</div>
        <div class="sc-cell">Appr.</div>
        <div class="sc-cell">Cash</div>
        <div class="sc-cell">Term</div>
        <div class="sc-cell">HEI Cost</div>
        <div class="sc-cell">HE Loan</div>
        <div class="sc-cell">HELOC</div>
        <div class="sc-cell">Best</div>
        <div class="sc-cell sc-actions"></div>
      </div>
      ${scenarios.map((s, i) => `
        <div class="scenario-row">
          <div class="sc-cell sc-label">${s.label}</div>
          <div class="sc-cell">${s.inputs.appreciationRate}%</div>
          <div class="sc-cell">${fmtD(s.inputs.cashNeeded)}</div>
          <div class="sc-cell">${s.inputs.timeHorizon}yr</div>
          <div class="sc-cell">${fmtD(s.results.hei.totalCost)}</div>
          <div class="sc-cell">${fmtD(s.results.heq.totalCost)}</div>
          <div class="sc-cell">${fmtD(s.results.heloc.totalCost)}</div>
          <div class="sc-cell" style="color: ${typeColors[s.cheapest]}">${typeLabels[s.cheapest]}</div>
          <div class="sc-cell sc-actions">
            <button class="sc-btn load" onclick="loadScenario(${s.id})" title="Load this scenario">Load</button>
            <button class="sc-btn remove" onclick="removeScenario(${s.id})" title="Remove">&times;</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── 3. Cash Flow Analysis ──
function updateCashFlow() {
  const el = document.getElementById('cashflow-body');
  if (!el) return;

  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));
  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);

  const monthlyCosts = [
    { name: 'HEI', monthly: 0, annual: 0, overTerm: hei.totalCost, deferred: true },
    { name: 'Home Equity Loan', monthly: heq.monthlyPayment, annual: heq.monthlyPayment * 12, overTerm: heq.totalCost, deferred: false },
    { name: 'HELOC (Draw)', monthly: heloc.monthlyPaymentDraw, annual: heloc.monthlyPaymentDraw * 12, overTerm: heloc.totalCost, deferred: false },
  ];

  const maxMonthly = Math.max(...monthlyCosts.map(c => c.monthly));

  el.innerHTML = `
    <div class="cf-grid">
      ${monthlyCosts.map(c => {
        const barW = maxMonthly > 0 ? (c.monthly / maxMonthly) * 100 : 0;
        const barColor = c.name.startsWith('HEI') ? 'var(--hei-color)' : c.name.startsWith('Home') ? 'var(--heq-color)' : 'var(--heloc-color)';
        return `
          <div class="cf-row">
            <div class="cf-product">${c.name}</div>
            <div class="cf-bar-section">
              <div class="cf-bar-track">
                <div class="cf-bar-fill" style="width: ${barW}%; background: ${barColor}"></div>
              </div>
            </div>
            <div class="cf-numbers">
              <div class="cf-monthly">${c.deferred ? '<span class="cf-zero">$0/mo</span>' : fmtD(c.monthly) + '/mo'}</div>
              <div class="cf-annual">${c.deferred ? 'Deferred' : fmtD(c.annual) + '/yr'}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="cf-insight">
      ${heq.monthlyPayment > 0 ? `
        Choosing the HEI saves <strong>${fmtD(heq.monthlyPayment)}/month</strong> in cash flow
        (${fmtD(heq.monthlyPayment * 12)}/year) compared to the Home Equity Loan.
        Over ${state.timeHorizon} years, that's <strong>${fmtD(heq.monthlyPayment * state.timeHorizon * 12)}</strong> you keep in your pocket
        &mdash; but you'll owe <strong>${fmtD(hei.totalCost)}</strong> at settlement.
      ` : ''}
    </div>
  `;
}

// ── 4. Print/Export Summary ──
function exportSummary() {
  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));

  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const text = `
HOME EQUITY COMPARISON REPORT
Generated: ${now}
${'='.repeat(50)}

YOUR HOME
  Home Value:        ${fmtD(state.homeValue)}
  Mortgage Balance:  ${fmtD(state.mortgageBalance)}
  Available Equity:  ${fmtD(state.homeValue - state.mortgageBalance)} (${((1 - state.mortgageBalance / state.homeValue) * 100).toFixed(0)}%)
  Credit Score:      ${state.creditScore}
  DTI Ratio:         ${state.dtiRatio}%

SCENARIO
  Cash Needed:       ${fmtD(state.cashNeeded)}
  Time Horizon:      ${state.timeHorizon} years
  Appreciation Rate: ${state.appreciationRate}%/year

${'─'.repeat(50)}
COMPARISON RESULTS
${'─'.repeat(50)}

HEI (Home Equity Investment)
  Total Cost:        ${fmtD(hei.totalCost)}
  Monthly Payment:   $0 (deferred)
  Effective Rate:    ${hei.effectiveRate.toFixed(1)}%
  Equity Shared:     ${hei.equitySharePct.toFixed(1)}%
  Investor Payout:   ${fmtD(hei.investorPayout)}

Home Equity Loan
  Total Cost:        ${fmtD(heq.totalCost)}
  Monthly Payment:   ${fmtD(heq.monthlyPayment)}
  Interest Rate:     ${heq.interestRate}% (fixed)
  Total Interest:    ${fmtD(heq.totalInterest)}

HELOC
  Total Cost:        ${fmtD(heloc.totalCost)}
  Draw Payment:      ${fmtD(heloc.monthlyPaymentDraw)}/mo
  Repay Payment:     ${fmtD(heloc.monthlyPaymentRepay)}/mo
  Initial Rate:      ${heloc.initialRate}% (variable)
  Rate Cap:          ${heloc.rateCap}%
  Total Interest:    ${fmtD(heloc.totalInterest)}

${'─'.repeat(50)}
COST DIFFERENCE
  HEI vs HE Loan:   ${hei.totalCost > heq.totalCost ? '+' : ''}${fmtD(hei.totalCost - heq.totalCost)}
  HEI vs HELOC:     ${hei.totalCost > heloc.totalCost ? '+' : ''}${fmtD(hei.totalCost - heloc.totalCost)}
  HE Loan vs HELOC: ${heq.totalCost > heloc.totalCost ? '+' : ''}${fmtD(heq.totalCost - heloc.totalCost)}
${'='.repeat(50)}

${scenarios.length > 0 ? 'SAVED SCENARIOS\n' + scenarios.map((s, i) =>
  `  ${s.label}: ${s.inputs.appreciationRate}% appr, ${fmtD(s.inputs.cashNeeded)} cash, ${s.inputs.timeHorizon}yr → Best: ${s.cheapest.toUpperCase()}`
).join('\n') : ''}

Generated by Home Equity Calculator Dashboard
`.trim();

  // Create download
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `home-equity-comparison-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function printDashboard() {
  window.print();
}

// ── 5. Scenario Save/Load ──
function initScenarios() {
  const saved = localStorage.getItem('heCalcScenarios');
  if (saved) {
    try { scenarios = JSON.parse(saved); } catch (_) { scenarios = []; }
  }
  renderScenarios();
}

// ── Master Phase 4 Update ──
function updateIntelligence() {
  updateRecommendation();
  updateCashFlow();
}
