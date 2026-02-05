// ── Loan Selection Funnel ──

const TOTAL_STEPS = 5;
const STEP_NAMES = ['Choose Loan', 'Details', 'Qualify', 'Timeline', 'Apply'];

const funnelState = {
  active: false,
  currentStep: 1,
  selectedLoanType: null,
  propertyType: null,
  propertyUse: 'primary',
  employmentStatus: null,
  annualIncome: null,
  speedChecklist: {
    mortgageStatement: false,
    homeownersInsurance: false,
    validId: false,
    propertyAccess: false,
    titleClear: false,
  },
};

// Timeline data per loan type
const TIMELINES = {
  hei: {
    name: 'Home Equity Investment',
    phases: [
      { name: 'Application & Pre-approval', minDays: 1, maxDays: 3, desc: 'Automated valuation, initial offer in minutes' },
      { name: 'Appraisal & Inspection', minDays: 7, maxDays: 14, desc: 'Third-party appraisal to confirm home value' },
      { name: 'Underwriting & Final Offer', minDays: 7, maxDays: 14, desc: 'Title verification, lien check, final terms' },
      { name: 'Closing & Rescission', minDays: 3, maxDays: 5, desc: 'Mandatory 3-day federal cooling-off period' },
      { name: 'Disbursement', minDays: 1, maxDays: 3, desc: 'Wire transfer after rescission ends' },
    ],
  },
  heq: {
    name: 'Home Equity Loan',
    phases: [
      { name: 'Application', minDays: 1, maxDays: 3, desc: 'Submit with income/asset docs' },
      { name: 'Appraisal', minDays: 7, maxDays: 14, desc: 'Home appraisal to determine LTV' },
      { name: 'Underwriting', minDays: 7, maxDays: 14, desc: 'Income verification, credit check, title search' },
      { name: 'Closing', minDays: 3, maxDays: 7, desc: 'Sign docs, 3-day rescission period' },
    ],
  },
  heloc: {
    name: 'HELOC',
    phases: [
      { name: 'Application', minDays: 1, maxDays: 3, desc: 'Submit application online' },
      { name: 'Appraisal', minDays: 5, maxDays: 10, desc: 'May accept drive-by or AVM' },
      { name: 'Underwriting', minDays: 5, maxDays: 10, desc: 'Typically faster than fixed loans' },
      { name: 'Draw Setup', minDays: 2, maxDays: 5, desc: 'Set up credit line access' },
    ],
  },
};

function openFunnel(preselectedType) {
  funnelState.active = true;
  if (preselectedType) funnelState.selectedLoanType = preselectedType;

  // Load saved funnel state
  const saved = localStorage.getItem('heCalcFunnel');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(funnelState, parsed);
      funnelState.active = true;
    } catch (_) {}
  }

  document.getElementById('funnel-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderFunnelStep();
  if (typeof initChat === 'function') initChat();
}

function closeFunnel() {
  funnelState.active = false;
  document.getElementById('funnel-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function saveFunnelState() {
  localStorage.setItem('heCalcFunnel', JSON.stringify(funnelState));
}

function goToStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;
  funnelState.currentStep = step;
  saveFunnelState();
  renderFunnelStep();
}

function nextStep() {
  if (funnelState.currentStep === 1 && !funnelState.selectedLoanType) {
    if (typeof addSystemMessage === 'function') addSystemMessage('Please select a loan type first.');
    return;
  }
  goToStep(funnelState.currentStep + 1);
}

function prevStep() {
  goToStep(funnelState.currentStep - 1);
}

function selectLoanType(type) {
  funnelState.selectedLoanType = type;
  saveFunnelState();
  renderFunnelStep();

  const names = { hei: 'HEI', heq: 'Home Equity Loan', heloc: 'HELOC' };
  if (typeof addAssistantMessage === 'function') {
    const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
    const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
    const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));
    const costs = { hei: hei.totalCost, heq: heq.totalCost, heloc: heloc.totalCost };

    if (type === 'hei') {
      addAssistantMessage(`Great choice — HEI means $0 monthly payments. Your total cost at ${state.appreciationRate}% appreciation would be ${fmtD(costs.hei)}. The process typically takes 3-6 weeks. Let's get your details together.`);
    } else if (type === 'heq') {
      addAssistantMessage(`Home Equity Loan gives you fixed, predictable payments of ${fmtD(heq.monthlyPayment)}/month. Total cost: ${fmtD(costs.heq)}. Usually funded in 2-6 weeks. Let's check your eligibility.`);
    } else {
      addAssistantMessage(`HELOC gives you flexible access to funds. Initial payments start at ${fmtD(heloc.monthlyPaymentDraw)}/month. Total cost: ${fmtD(costs.heloc)}. Typically the fastest option at 2-4 weeks.`);
    }
  }
}

// ── Render Steps ──
function renderFunnelStep() {
  renderProgressBar();
  const content = document.getElementById('funnel-content');
  if (!content) return;

  const stepRenderers = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
  };

  const renderer = stepRenderers[funnelState.currentStep];
  if (renderer) {
    content.innerHTML = renderer();
    content.className = 'funnel-content step-' + funnelState.currentStep;
    bindStepEvents();
  }
}

function renderProgressBar() {
  const bar = document.getElementById('funnel-progress');
  if (!bar) return;

  bar.innerHTML = STEP_NAMES.map((name, i) => {
    const step = i + 1;
    const cls = step === funnelState.currentStep ? 'active' : step < funnelState.currentStep ? 'done' : '';
    return `<div class="progress-step ${cls}" onclick="${step <= funnelState.currentStep ? 'goToStep(' + step + ')' : ''}">
      <div class="step-dot">${step < funnelState.currentStep ? '\u2713' : step}</div>
      <div class="step-label">${name}</div>
    </div>`;
  }).join('<div class="step-line"></div>');
}

// ── Step 1: Choose Loan Type ──
function renderStep1() {
  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));

  const sel = funnelState.selectedLoanType;
  return `
    <h2>Which loan type is right for you?</h2>
    <p class="step-desc">Based on your calculator inputs, here's how each option looks:</p>
    <div class="loan-cards">
      <div class="loan-card ${sel === 'hei' ? 'selected' : ''}" onclick="selectLoanType('hei')">
        <div class="loan-card-badge" style="background: var(--hei-color)">HEI</div>
        <div class="loan-card-title">Home Equity Investment</div>
        <div class="loan-card-big">${fmtD(hei.totalCost)}</div>
        <div class="loan-card-sub">total cost over ${state.timeHorizon} years</div>
        <div class="loan-card-stats">
          <div><span>Monthly</span><strong>$0</strong></div>
          <div><span>Eff. Rate</span><strong>${hei.effectiveRate.toFixed(1)}%</strong></div>
          <div><span>Min Credit</span><strong>500</strong></div>
        </div>
        <div class="loan-card-best">Best if you need cash flow and expect low appreciation</div>
      </div>
      <div class="loan-card ${sel === 'heq' ? 'selected' : ''}" onclick="selectLoanType('heq')">
        <div class="loan-card-badge" style="background: var(--heq-color)">HE LOAN</div>
        <div class="loan-card-title">Home Equity Loan</div>
        <div class="loan-card-big">${fmtD(heq.totalCost)}</div>
        <div class="loan-card-sub">total cost over ${state.timeHorizon} years</div>
        <div class="loan-card-stats">
          <div><span>Monthly</span><strong>${fmtD(heq.monthlyPayment)}</strong></div>
          <div><span>Rate</span><strong>${state.heqRate}% fixed</strong></div>
          <div><span>Min Credit</span><strong>620</strong></div>
        </div>
        <div class="loan-card-best">Best for predictable fixed payments</div>
      </div>
      <div class="loan-card ${sel === 'heloc' ? 'selected' : ''}" onclick="selectLoanType('heloc')">
        <div class="loan-card-badge" style="background: var(--heloc-color)">HELOC</div>
        <div class="loan-card-title">Home Equity Line of Credit</div>
        <div class="loan-card-big">${fmtD(heloc.totalCost)}</div>
        <div class="loan-card-sub">total cost over ${state.timeHorizon} years</div>
        <div class="loan-card-stats">
          <div><span>Draw</span><strong>${fmtD(heloc.monthlyPaymentDraw)}/mo</strong></div>
          <div><span>Rate</span><strong>${state.helocRate}% var</strong></div>
          <div><span>Min Credit</span><strong>620</strong></div>
        </div>
        <div class="loan-card-best">Best for flexible access, fastest funding</div>
      </div>
    </div>
    <div class="step-nav">
      <button class="btn-secondary" onclick="closeFunnel()">Back to Calculator</button>
      <button class="btn-primary ${sel ? '' : 'disabled'}" onclick="nextStep()">Continue &rarr;</button>
    </div>
  `;
}

// ── Step 2: Property & Financial Details ──
function renderStep2() {
  const fs = funnelState;
  return `
    <h2>Property & Financial Details</h2>
    <p class="step-desc">We've pre-filled what we can from the calculator. Fill in the remaining details or ask the chat assistant for help.</p>
    <div class="form-grid">
      <div class="form-section">
        <h4>From Your Calculator</h4>
        <div class="form-row readonly">
          <label>Home Value</label>
          <div class="form-value">${fmtD(state.homeValue)}</div>
        </div>
        <div class="form-row readonly">
          <label>Mortgage Balance</label>
          <div class="form-value">${fmtD(state.mortgageBalance)}</div>
        </div>
        <div class="form-row readonly">
          <label>Cash Needed</label>
          <div class="form-value">${fmtD(state.cashNeeded)}</div>
        </div>
        <div class="form-row readonly">
          <label>Credit Score</label>
          <div class="form-value">${state.creditScore}</div>
        </div>
        <div class="form-row readonly">
          <label>DTI Ratio</label>
          <div class="form-value">${state.dtiRatio}%</div>
        </div>
      </div>
      <div class="form-section">
        <h4>Additional Details</h4>
        <div class="form-row">
          <label for="f-property-type">Property Type</label>
          <select id="f-property-type" onchange="updateFunnelField('propertyType', this.value)">
            <option value="" ${!fs.propertyType ? 'selected' : ''}>Select...</option>
            <option value="single_family" ${fs.propertyType === 'single_family' ? 'selected' : ''}>Single Family</option>
            <option value="condo" ${fs.propertyType === 'condo' ? 'selected' : ''}>Condo</option>
            <option value="townhouse" ${fs.propertyType === 'townhouse' ? 'selected' : ''}>Townhouse</option>
            <option value="multi_family" ${fs.propertyType === 'multi_family' ? 'selected' : ''}>Multi-Family</option>
          </select>
        </div>
        <div class="form-row">
          <label for="f-property-use">Property Use</label>
          <select id="f-property-use" onchange="updateFunnelField('propertyUse', this.value)">
            <option value="primary" ${fs.propertyUse === 'primary' ? 'selected' : ''}>Primary Residence</option>
            <option value="secondary" ${fs.propertyUse === 'secondary' ? 'selected' : ''}>Secondary/Vacation</option>
            <option value="investment" ${fs.propertyUse === 'investment' ? 'selected' : ''}>Investment Property</option>
          </select>
        </div>
        <div class="form-row">
          <label for="f-employment">Employment Status</label>
          <select id="f-employment" onchange="updateFunnelField('employmentStatus', this.value)">
            <option value="" ${!fs.employmentStatus ? 'selected' : ''}>Select...</option>
            <option value="employed" ${fs.employmentStatus === 'employed' ? 'selected' : ''}>Employed (W-2)</option>
            <option value="self_employed" ${fs.employmentStatus === 'self_employed' ? 'selected' : ''}>Self-Employed</option>
            <option value="retired" ${fs.employmentStatus === 'retired' ? 'selected' : ''}>Retired</option>
            <option value="other" ${fs.employmentStatus === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-row">
          <label for="f-income">Annual Income</label>
          <div class="input-with-prefix">
            <span class="prefix">$</span>
            <input type="number" id="f-income" value="${fs.annualIncome || ''}" placeholder="85,000"
                   oninput="updateFunnelField('annualIncome', parseFloat(this.value) || null)">
          </div>
        </div>
      </div>
    </div>
    <div class="step-nav">
      <button class="btn-secondary" onclick="prevStep()">&larr; Back</button>
      <button class="btn-primary" onclick="nextStep()">Check Qualification &rarr;</button>
    </div>
  `;
}

function updateFunnelField(field, value) {
  funnelState[field] = value;
  saveFunnelState();
  if (typeof addSystemMessage === 'function' && value) {
    const labels = {
      propertyType: 'Property type',
      propertyUse: 'Property use',
      employmentStatus: 'Employment',
      annualIncome: 'Annual income',
    };
    const display = field === 'annualIncome' ? fmtD(value) : value.replace(/_/g, ' ');
    addSystemMessage(`${labels[field]} updated to: ${display}`);
  }
}

// ── Step 3: Qualification ──
function renderStep3() {
  const qual = checkQualification(state.creditScore, state.dtiRatio, state.homeValue, state.mortgageBalance);
  const selected = funnelState.selectedLoanType;
  const qualData = qual[selected === 'heq' ? 'heq' : selected === 'heloc' ? 'heloc' : 'hei'];
  const names = { hei: 'HEI', heq: 'Home Equity Loan', heloc: 'HELOC' };

  // Check all three for alternatives
  const alternatives = Object.entries(qual)
    .filter(([k, v]) => k !== selected && v.qualified)
    .map(([k]) => names[k]);

  return `
    <h2>Pre-Qualification Check</h2>
    <p class="step-desc">Checking your eligibility for <strong>${names[selected]}</strong> based on your profile.</p>

    <div class="qual-result-box ${qualData.qualified ? 'pass' : 'fail'}">
      <div class="qual-result-icon">${qualData.qualified ? '\u2705' : '\u274C'}</div>
      <div class="qual-result-text">
        <div class="qual-result-title">${qualData.qualified ? 'You likely qualify!' : 'You may not qualify'}</div>
        <div class="qual-result-sub">${qualData.qualified
          ? `Based on your profile, you meet the requirements for a ${names[selected]}.`
          : `Your profile doesn't meet all requirements for a ${names[selected]}.`
        }</div>
      </div>
    </div>

    <div class="qual-criteria-list">
      ${qualData.reasons.map(r => {
        const pass = !r.startsWith('Credit score below') && !r.startsWith('DTI ratio too') && !r.startsWith('Insufficient');
        return `<div class="qual-criterion ${pass ? 'pass' : 'fail'}">
          <span class="crit-icon">${pass ? '\u2713' : '\u2717'}</span>
          <span class="crit-text">${r}</span>
        </div>`;
      }).join('')}
    </div>

    ${!qualData.qualified && alternatives.length > 0 ? `
      <div class="qual-alternatives">
        <h4>Alternative Options</h4>
        <p>Based on your profile, you may qualify for: <strong>${alternatives.join(', ')}</strong></p>
        ${alternatives.map(alt => {
          const key = Object.entries(names).find(([k, v]) => v === alt)?.[0];
          return key ? `<button class="btn-secondary" onclick="selectLoanType('${key}'); goToStep(1);">Switch to ${alt}</button>` : '';
        }).join(' ')}
      </div>
    ` : ''}

    <div class="step-nav">
      <button class="btn-secondary" onclick="prevStep()">&larr; Back</button>
      <button class="btn-primary" onclick="nextStep()">View Timeline &rarr;</button>
    </div>
  `;
}

// ── Step 4: Timeline ──
function renderStep4() {
  const tl = TIMELINES[funnelState.selectedLoanType];
  const sc = funnelState.speedChecklist;
  const checkedCount = Object.values(sc).filter(Boolean).length;
  const totalChecks = Object.keys(sc).length;
  const speedScore = Math.round((checkedCount / totalChecks) * 10);

  const totalMin = tl.phases.reduce((a, p) => a + p.minDays, 0);
  const totalMax = tl.phases.reduce((a, p) => a + p.maxDays, 0);
  // Speed reduces toward min
  const estimatedDays = Math.round(totalMax - (totalMax - totalMin) * (checkedCount / totalChecks));
  const estimatedWeeks = (estimatedDays / 7).toFixed(1);

  const fundingDate = new Date();
  fundingDate.setDate(fundingDate.getDate() + estimatedDays);
  const fundingStr = fundingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const maxPhaseDays = Math.max(...tl.phases.map(p => p.maxDays));

  return `
    <h2>Funding Timeline — ${tl.name}</h2>
    <p class="step-desc">Estimated <strong>${estimatedWeeks} weeks</strong> (~${estimatedDays} days) to funding. Target date: <strong>${fundingStr}</strong></p>

    <div class="timeline-header-stats">
      <div class="tl-stat">
        <div class="tl-stat-val">${estimatedWeeks} wk</div>
        <div class="tl-stat-label">Estimated</div>
      </div>
      <div class="tl-stat">
        <div class="tl-stat-val">${speedScore}/10</div>
        <div class="tl-stat-label">Speed Score</div>
      </div>
      <div class="tl-stat">
        <div class="tl-stat-val">${checkedCount}/${totalChecks}</div>
        <div class="tl-stat-label">Items Ready</div>
      </div>
    </div>

    <div class="timeline-phases">
      ${tl.phases.map((p, i) => {
        const barMin = (p.minDays / maxPhaseDays) * 100;
        const barMax = (p.maxDays / maxPhaseDays) * 100;
        return `
          <div class="tl-phase">
            <div class="tl-phase-num">${i + 1}</div>
            <div class="tl-phase-body">
              <div class="tl-phase-name">${p.name}</div>
              <div class="tl-phase-desc">${p.desc}</div>
              <div class="tl-phase-bar">
                <div class="tl-bar-range" style="width: ${barMax}%">
                  <div class="tl-bar-min" style="width: ${(p.minDays / p.maxDays) * 100}%"></div>
                </div>
                <span class="tl-bar-label">${p.minDays}-${p.maxDays} days</span>
              </div>
            </div>
          </div>
        `;
      }).join('<div class="tl-connector"></div>')}
    </div>

    <div class="speed-checklist">
      <h4>Speed Optimizer Checklist</h4>
      <p class="speed-tip">Complete all items to hit the fastest timeline. Each item checked reduces your estimated wait.</p>
      <div class="check-items">
        ${renderCheckItem('mortgageStatement', 'Mortgage statement ready to upload', sc.mortgageStatement)}
        ${renderCheckItem('homeownersInsurance', 'Homeowners insurance documentation', sc.homeownersInsurance)}
        ${renderCheckItem('validId', 'Valid government ID available', sc.validId)}
        ${renderCheckItem('propertyAccess', 'Property access scheduled for appraiser', sc.propertyAccess)}
        ${renderCheckItem('titleClear', 'Title clear of unresolved liens', sc.titleClear)}
      </div>
    </div>

    <div class="step-nav">
      <button class="btn-secondary" onclick="prevStep()">&larr; Back</button>
      <button class="btn-primary" onclick="nextStep()">Provider Match &rarr;</button>
    </div>
  `;
}

function renderCheckItem(key, label, checked) {
  return `<label class="check-item ${checked ? 'checked' : ''}">
    <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleCheckItem('${key}', this.checked)">
    <span class="check-box">${checked ? '\u2713' : ''}</span>
    <span class="check-label">${label}</span>
  </label>`;
}

function toggleCheckItem(key, val) {
  funnelState.speedChecklist[key] = val;
  saveFunnelState();
  renderFunnelStep();
  if (typeof addSystemMessage === 'function') {
    const checked = Object.values(funnelState.speedChecklist).filter(Boolean).length;
    const total = Object.keys(funnelState.speedChecklist).length;
    addSystemMessage(`Checklist: ${checked}/${total} items ready. ${checked === total ? 'All set — you\'re on the fastest track!' : ''}`);
  }
}

// ── Step 5: Provider Match & Apply ──
function renderStep5() {
  const type = funnelState.selectedLoanType;
  const names = { hei: 'HEI', heq: 'Home Equity Loan', heloc: 'HELOC' };

  const providers = {
    hei: HEI_PROVIDERS.map(p => {
      const term = Math.min(state.timeHorizon, p.maxTerm);
      const r = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, term, p.riskAdj, p.origFee);
      return { ...p, totalCost: r.totalCost, effectiveRate: r.effectiveRate, term };
    }).sort((a, b) => a.totalCost - b.totalCost),
    heq: [
      { name: 'SoFi', origFee: 0, note: 'No origination fees, $50K-$750K, fixed rates from ~7%', url: 'https://www.sofi.com/home-loans/home-equity-loan/', applyUrl: 'https://www.sofi.com/home-loans/home-equity-loan/' },
      { name: 'Figure', origFee: 0, note: 'Approve in 5 min, fund in 5 days, 100% online', url: 'https://www.figure.com/', applyUrl: 'https://www.figure.com/home-equity-line/' },
      { name: 'Local Bank/Credit Union', origFee: 1.0, note: 'Often best rates for members, in-person support', url: null, applyUrl: null },
      { name: 'Mortgage Broker', origFee: 1.5, note: 'Shops multiple lenders for your best rate', url: null, applyUrl: null },
    ],
    heloc: [
      { name: 'Figure', origFee: 0, note: '#1 non-bank HELOC lender, approve in 5 min, fund in 5 days', url: 'https://www.figure.com/', applyUrl: 'https://www.figure.com/home-equity-line/' },
      { name: 'SoFi', origFee: 0, note: 'Up to 90% LTV, $500K max, variable rates', url: 'https://www.sofi.com/home-loans/heloc/', applyUrl: 'https://www.sofi.com/home-loans/heloc/' },
      { name: 'Local Bank/Credit Union', origFee: 0.5, note: 'May waive fees for existing customers', url: null, applyUrl: null },
    ],
  };

  const list = providers[type] || [];
  const sc = funnelState.speedChecklist;
  const checkedCount = Object.values(sc).filter(Boolean).length;

  return `
    <h2>Provider Match — ${names[type]}</h2>
    <p class="step-desc">Based on your profile and selected loan type, here are your best options:</p>

    <div class="provider-match-cards">
      ${type === 'hei' ? list.map((p, i) => `
        <div class="pm-card ${i === 0 ? 'best' : ''}">
          ${i === 0 ? '<div class="pm-best-badge">Best Match</div>' : ''}
          <div class="pm-name">${p.name}</div>
          <div class="pm-cost">${fmtD(p.totalCost)}</div>
          <div class="pm-details">
            <span>Orig: ${p.origFee}%</span>
            <span>Risk Adj: ${p.riskAdj}%</span>
            <span>Term: ${p.term}yr</span>
            <span>Eff: ${p.effectiveRate.toFixed(1)}%</span>
          </div>
          <div class="pm-extras">
            <span>Min Credit: ${p.minCredit}</span>
            <span>Max: ${fmtD(p.maxFunding)}</span>
            <span>${p.states}</span>
          </div>
          <div class="pm-actions">
            <a href="${p.applyUrl}" target="_blank" rel="noopener" class="btn-primary btn-apply">Apply Now</a>
            <a href="${p.url}" target="_blank" rel="noopener" class="btn-secondary btn-learn">Learn More</a>
          </div>
        </div>
      `).join('') : list.map((p, i) => `
        <div class="pm-card ${i === 0 ? 'best' : ''}">
          ${i === 0 ? '<div class="pm-best-badge">Recommended</div>' : ''}
          <div class="pm-name">${p.name}</div>
          <div class="pm-details">
            <span>Orig Fee: ${p.origFee}%</span>
          </div>
          <div class="pm-note">${p.note}</div>
          ${p.applyUrl ? `
          <div class="pm-actions">
            <a href="${p.applyUrl}" target="_blank" rel="noopener" class="btn-primary btn-apply">Apply Now</a>
            <a href="${p.url}" target="_blank" rel="noopener" class="btn-secondary btn-learn">Learn More</a>
          </div>` : '<div class="pm-actions"><span class="pm-local-note">Contact your local institution</span></div>'}
        </div>
      `).join('')}
    </div>

    <div class="apply-summary">
      <h4>Your Application Summary</h4>
      <div class="summary-grid">
        <div><span class="sg-label">Loan Type</span><span class="sg-val">${names[type]}</span></div>
        <div><span class="sg-label">Home Value</span><span class="sg-val">${fmtD(state.homeValue)}</span></div>
        <div><span class="sg-label">Mortgage</span><span class="sg-val">${fmtD(state.mortgageBalance)}</span></div>
        <div><span class="sg-label">Cash Needed</span><span class="sg-val">${fmtD(state.cashNeeded)}</span></div>
        <div><span class="sg-label">Credit Score</span><span class="sg-val">${state.creditScore}</span></div>
        <div><span class="sg-label">DTI</span><span class="sg-val">${state.dtiRatio}%</span></div>
        ${funnelState.annualIncome ? `<div><span class="sg-label">Income</span><span class="sg-val">${fmtD(funnelState.annualIncome)}</span></div>` : ''}
        ${funnelState.propertyType ? `<div><span class="sg-label">Property</span><span class="sg-val">${funnelState.propertyType.replace(/_/g, ' ')}</span></div>` : ''}
        <div><span class="sg-label">Readiness</span><span class="sg-val">${checkedCount}/5 docs ready</span></div>
      </div>
    </div>

    <div class="step-nav">
      <button class="btn-secondary" onclick="prevStep()">&larr; Back</button>
      <button class="btn-primary" onclick="exportApplication()">Download Application Data</button>
    </div>
  `;
}

function exportApplication() {
  const names = { hei: 'HEI', heq: 'Home Equity Loan', heloc: 'HELOC' };
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const text = `
LOAN APPLICATION SUMMARY
Generated: ${now}
${'='.repeat(50)}

SELECTED LOAN TYPE: ${names[funnelState.selectedLoanType]}

PROPERTY DETAILS
  Home Value:        ${fmtD(state.homeValue)}
  Mortgage Balance:  ${fmtD(state.mortgageBalance)}
  Equity:            ${fmtD(state.homeValue - state.mortgageBalance)} (${((1 - state.mortgageBalance / state.homeValue) * 100).toFixed(0)}%)
  Property Type:     ${(funnelState.propertyType || 'Not specified').replace(/_/g, ' ')}
  Property Use:      ${funnelState.propertyUse || 'Not specified'}

APPLICANT PROFILE
  Credit Score:      ${state.creditScore}
  DTI Ratio:         ${state.dtiRatio}%
  Employment:        ${(funnelState.employmentStatus || 'Not specified').replace(/_/g, ' ')}
  Annual Income:     ${funnelState.annualIncome ? fmtD(funnelState.annualIncome) : 'Not specified'}

LOAN DETAILS
  Cash Requested:    ${fmtD(state.cashNeeded)}
  Time Horizon:      ${state.timeHorizon} years

DOCUMENTATION READINESS
  ${Object.entries(funnelState.speedChecklist).map(([k, v]) => {
    const labels = {
      mortgageStatement: 'Mortgage Statement',
      homeownersInsurance: 'Homeowners Insurance',
      validId: 'Valid ID',
      propertyAccess: 'Property Access',
      titleClear: 'Title Clear',
    };
    return `[${v ? 'X' : ' '}] ${labels[k]}`;
  }).join('\n  ')}

${'='.repeat(50)}
Generated by Home Equity Calculator Dashboard
`.trim();

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `loan-application-${funnelState.selectedLoanType}-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function bindStepEvents() {
  // Any post-render event binding if needed
}
