// ── Hybrid Form/Chat Widget ──

let chatMessages = [];

// ── FAQ Bank (no LLM required) ──
const FAQ_BANK = [
  { patterns: [/what.*(document|docs|paperwork|need to bring)/i], response: getFAQDocs },
  { patterns: [/how long|how fast|when.*fund|timeline|time.*(take|frame)/i], response: getFAQTimeline },
  { patterns: [/what.*hei|what.*home equity investment|explain.*hei/i], response: () => 'An HEI (Home Equity Investment) lets you access cash from your home equity with no monthly payments. Instead, you share a percentage of your home\'s future value with the investor. You repay when you sell, refinance, or at term end (typically 10-30 years).' },
  { patterns: [/what.*heloc|explain.*heloc/i], response: () => 'A HELOC is a revolving line of credit secured by your home. You have a draw period (usually 10 years) where you pay interest only, then a repayment period where you pay principal + interest. Rates are variable.' },
  { patterns: [/what.*home equity loan|explain.*home equity loan/i], response: () => 'A Home Equity Loan is a fixed-rate second mortgage. You get a lump sum and make equal monthly payments over the loan term. The rate is locked in, so your payment never changes.' },
  { patterns: [/what.*risk adjust|explain.*risk/i], response: () => `HEI providers apply a "risk adjustment" — they value your home below its appraised value (typically 80-90%). For a ${fmtD(state.homeValue)} home, they might calculate their share based on ${fmtD(state.homeValue * 0.85)}. This gives them a larger share of your future appreciation.` },
  { patterns: [/what.*dti|debt.to.income/i], response: () => `DTI (Debt-to-Income) ratio is your total monthly debt payments divided by gross monthly income. Yours is ${state.dtiRatio}%. Most lenders want DTI under 43% for HE Loans and HELOCs. HEI providers typically don't check DTI.` },
  { patterns: [/credit.*score.*need|minimum.*credit|what.*credit/i], response: () => `Credit requirements: HEI needs 500+, HE Loan needs 620+, HELOC needs 620+. Your score is ${state.creditScore}.` },
  { patterns: [/which.*best|which.*choose|recommend|what.*should/i], response: getRecommendation },
  { patterns: [/how.*qualify|do i qualify|am i eligible/i], response: getQualAnswer },
  { patterns: [/apprais|inspection/i], response: () => 'The appraisal is typically the longest phase (1-2 weeks). A licensed appraiser visits your property to confirm its value. Tip: Have your home clean and accessible. Some HELOCs may accept a drive-by appraisal or automated valuation, which is faster.' },
  { patterns: [/rescission|cooling.off/i], response: () => 'The rescission period is a mandatory 3 business day "cooling-off" period after you sign closing documents. During this time, you can cancel the loan with no penalty. Funds are released after this period ends.' },
  { patterns: [/can i (cancel|back out|change)/i], response: () => 'Yes — after signing, you have a 3 business day rescission period to cancel with no penalty. Before signing, you can walk away at any time.' },
  { patterns: [/next step|what now|continue/i], response: () => { nextStep(); return 'Moving to the next step!'; } },
  { patterns: [/go back|previous/i], response: () => { prevStep(); return 'Going back to the previous step.'; } },
  { patterns: [/help|what can you do/i], response: () => 'I can help you with:\n\n- Choosing a loan type ("which is best for me?")\n- Explaining terms ("what is DTI?")\n- Filling form fields ("my income is $85,000")\n- Checking qualification ("do I qualify?")\n- Timeline questions ("how long will this take?")\n- Navigating steps ("next step", "go back")' },
];

// ── Form-Fill Patterns ──
const FILL_PATTERNS = [
  { pattern: /(?:income|salary|make|earn).*?\$?([\d,]+)/i, field: 'annualIncome', parse: (m) => parseFloat(m[1].replace(/,/g, '')) },
  { pattern: /(?:credit|fico).*?(\d{3})/i, field: 'creditScore', parse: (m) => parseInt(m[1]), isCalcField: true },
  { pattern: /(?:home|house|property).*?worth.*?\$?([\d,]+)/i, field: 'homeValue', parse: (m) => parseFloat(m[1].replace(/,/g, '')), isCalcField: true },
  { pattern: /(?:owe|mortgage|balance).*?\$?([\d,]+)/i, field: 'mortgageBalance', parse: (m) => parseFloat(m[1].replace(/,/g, '')), isCalcField: true },
  { pattern: /(?:need|want|borrow).*?\$?([\d,]+)/i, field: 'cashNeeded', parse: (m) => parseFloat(m[1].replace(/,/g, '')), isCalcField: true },
  { pattern: /(?:pick|choose|select|go with)\s+(?:the\s+)?hei/i, action: () => { selectLoanType('hei'); return 'Selected HEI for you!'; } },
  { pattern: /(?:pick|choose|select|go with)\s+(?:the\s+)?(?:home equity loan|he loan|hel)/i, action: () => { selectLoanType('heq'); return 'Selected Home Equity Loan for you!'; } },
  { pattern: /(?:pick|choose|select|go with)\s+(?:the\s+)?heloc/i, action: () => { selectLoanType('heloc'); return 'Selected HELOC for you!'; } },
  { pattern: /(?:employed|w-?2|work for)/i, field: 'employmentStatus', value: 'employed', isFunnelField: true },
  { pattern: /self.?employ/i, field: 'employmentStatus', value: 'self_employed', isFunnelField: true },
  { pattern: /retire/i, field: 'employmentStatus', value: 'retired', isFunnelField: true },
  { pattern: /(?:single.?family|house)/i, field: 'propertyType', value: 'single_family', isFunnelField: true },
  { pattern: /condo/i, field: 'propertyType', value: 'condo', isFunnelField: true },
  { pattern: /townhouse/i, field: 'propertyType', value: 'townhouse', isFunnelField: true },
];

// ── Dynamic FAQ Responses ──
function getFAQDocs() {
  const type = funnelState.selectedLoanType || 'hei';
  const docs = {
    hei: 'For an HEI, have these ready:\n1. Current mortgage statement\n2. Homeowners insurance declaration\n3. Government-issued photo ID\n4. Property access for appraiser\n\nNo income documentation typically required!',
    heq: 'For a Home Equity Loan, you\'ll need:\n1. Current mortgage statement\n2. Proof of income (pay stubs, W-2s, tax returns)\n3. Homeowners insurance\n4. Government-issued photo ID\n5. Bank statements (2-3 months)\n6. Property access for appraiser',
    heloc: 'For a HELOC, prepare:\n1. Current mortgage statement\n2. Proof of income (pay stubs, W-2s)\n3. Homeowners insurance\n4. Government-issued photo ID\n5. Recent bank statements\n6. Property access (some accept drive-by appraisal)',
  };
  return docs[type];
}

function getFAQTimeline() {
  const type = funnelState.selectedLoanType || 'hei';
  const tl = TIMELINES[type];
  const totalMin = tl.phases.reduce((a, p) => a + p.minDays, 0);
  const totalMax = tl.phases.reduce((a, p) => a + p.maxDays, 0);
  return `For a ${tl.name}, expect ${Math.ceil(totalMin / 7)}-${Math.ceil(totalMax / 7)} weeks total:\n\n` +
    tl.phases.map(p => `- ${p.name}: ${p.minDays}-${p.maxDays} days`).join('\n') +
    '\n\nComplete the Speed Checklist on Step 4 to target the faster end!';
}

function getRecommendation() {
  const hei = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, state.timeHorizon);
  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const costs = { hei: hei.totalCost, heq: heq.totalCost };

  if (state.appreciationRate <= 3 && state.creditScore >= 500) {
    return `At ${state.appreciationRate}% appreciation, I'd lean toward **HEI** — it costs ${fmtD(costs.hei)} with $0/month. The low appreciation means you're not giving up much equity. Want me to select it?`;
  } else if (state.creditScore < 620) {
    return `With a ${state.creditScore} credit score, HEI is likely your best bet — it accepts scores as low as 500 and has no DTI requirement. Want me to select it?`;
  } else {
    return `At ${state.appreciationRate}% appreciation, the **Home Equity Loan** looks better at ${fmtD(costs.heq)} total with predictable ${fmtD(heq.monthlyPayment)}/month payments. Want me to select it?`;
  }
}

function getQualAnswer() {
  const qual = checkQualification(state.creditScore, state.dtiRatio, state.homeValue, state.mortgageBalance);
  const results = [
    { name: 'HEI', q: qual.hei.qualified },
    { name: 'Home Equity Loan', q: qual.heq.qualified },
    { name: 'HELOC', q: qual.heloc.qualified },
  ];
  const qualified = results.filter(r => r.q).map(r => r.name);
  const not = results.filter(r => !r.q).map(r => r.name);

  let msg = '';
  if (qualified.length === 3) {
    msg = 'Great news — you likely qualify for all three options!';
  } else if (qualified.length > 0) {
    msg = `You likely qualify for: **${qualified.join(', ')}**.`;
    if (not.length > 0) msg += ` You may not qualify for: ${not.join(', ')}.`;
  } else {
    msg = 'Based on your current profile, qualification may be difficult. Consider improving your credit score or reducing your DTI ratio.';
  }
  return msg;
}

// ── Chat Engine ──
function initChat() {
  chatMessages = [];
  renderChatMessages();

  // Welcome message
  const type = funnelState.selectedLoanType;
  const names = { hei: 'HEI', heq: 'Home Equity Loan', heloc: 'HELOC' };

  let welcome = `Hi! I'm your loan advisor assistant. I can help you choose a loan, fill out forms, explain terms, and guide you through the process.\n\nTry saying:\n- "Which loan is best for me?"\n- "My income is $85,000"\n- "What documents do I need?"`;

  if (type) {
    welcome = `Welcome back! You're looking at a **${names[type]}**. I can help you move through the process or answer any questions.\n\nTry: "Do I qualify?" or "How long will this take?"`;
  }

  addAssistantMessage(welcome);
}

function addUserMessage(text) {
  chatMessages.push({ role: 'user', text, time: new Date() });
  renderChatMessages();
}

function addAssistantMessage(text) {
  chatMessages.push({ role: 'assistant', text, time: new Date() });
  renderChatMessages();
}

function addSystemMessage(text) {
  chatMessages.push({ role: 'system', text, time: new Date() });
  renderChatMessages();
}

function handleChatInput() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addUserMessage(text);

  // Process the message
  const response = processMessage(text);
  if (response) {
    setTimeout(() => addAssistantMessage(response), 300);
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleChatInput();
  }
}

function processMessage(text) {
  // 1. Check form-fill patterns
  for (const fp of FILL_PATTERNS) {
    if (fp.action) {
      if (fp.pattern.test(text)) {
        return fp.action();
      }
    }
    const match = text.match(fp.pattern);
    if (match && fp.field) {
      const value = fp.parse ? fp.parse(match) : fp.value;

      if (fp.isCalcField) {
        state[fp.field] = value;
        syncAllInputs();
        update();
        return `Updated ${fp.field.replace(/([A-Z])/g, ' $1').toLowerCase()} to ${typeof value === 'number' ? fmtD(value) : value}. Calculator updated!`;
      } else if (fp.isFunnelField) {
        funnelState[fp.field] = value;
        saveFunnelState();
        renderFunnelStep();
        return `Set ${fp.field.replace(/([A-Z])/g, ' $1').toLowerCase()} to ${value.replace(/_/g, ' ')}. Form updated!`;
      } else if (fp.field === 'annualIncome') {
        funnelState.annualIncome = value;
        saveFunnelState();
        const incInput = document.getElementById('f-income');
        if (incInput) incInput.value = value;
        return `Set annual income to ${fmtD(value)}. Got it!`;
      }
    }
  }

  // 2. Check FAQ patterns
  for (const faq of FAQ_BANK) {
    for (const pattern of faq.patterns) {
      if (pattern.test(text)) {
        const resp = typeof faq.response === 'function' ? faq.response() : faq.response;
        return resp;
      }
    }
  }

  // 3. Fallback
  return 'I\'m not sure about that. Try asking:\n- "Which loan is best?"\n- "What documents do I need?"\n- "Do I qualify?"\n- "How long will it take?"\n- Or tell me to fill a field: "My income is $85,000"';
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  container.innerHTML = chatMessages.map(m => {
    if (m.role === 'system') {
      return `<div class="chat-msg system"><div class="chat-bubble system">${formatChatText(m.text)}</div></div>`;
    }
    return `<div class="chat-msg ${m.role}">
      <div class="chat-bubble ${m.role}">${formatChatText(m.text)}</div>
    </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function formatChatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  if (panel) panel.classList.toggle('collapsed');
}
