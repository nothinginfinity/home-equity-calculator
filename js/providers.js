// ── Phase 3: HEI Provider Deep Dive ──

let currentSort = { col: 'totalCost', asc: true };

function updateProviderSection() {
  const tableBody = document.getElementById('provider-table-body');
  const riskVizEl = document.getElementById('risk-adj-viz');
  const feeBreakdownEl = document.getElementById('fee-breakdown');
  if (!tableBody) return;

  // Calculate per-provider results
  const results = HEI_PROVIDERS.map(p => {
    const termYears = Math.min(state.timeHorizon, p.maxTerm);
    const r = calcHEI(state.homeValue, state.cashNeeded, state.appreciationRate, termYears, p.riskAdj, p.origFee);
    return {
      name: p.name,
      origFee: p.origFee,
      riskAdj: p.riskAdj,
      term: termYears,
      adjustedValue: r.adjustedValue,
      equityShare: r.equitySharePct,
      investorPayout: r.investorPayout,
      origCost: r.origCost,
      totalCost: r.totalCost,
      effectiveRate: r.effectiveRate,
      futureValue: r.futureHomeValue,
    };
  });

  // Sort
  results.sort((a, b) => {
    const va = a[currentSort.col];
    const vb = b[currentSort.col];
    if (typeof va === 'string') return currentSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return currentSort.asc ? va - vb : vb - va;
  });

  const cheapest = Math.min(...results.map(r => r.totalCost));

  // Render table rows
  tableBody.innerHTML = results.map(r => {
    const isCheapest = r.totalCost === cheapest;
    const badge = isCheapest ? '<span class="provider-badge">BEST</span>' : '';
    return `<tr class="${isCheapest ? 'best-row' : ''}">
      <td class="provider-name-cell">${r.name} ${badge}</td>
      <td>${r.origFee}%</td>
      <td>${r.riskAdj}%</td>
      <td>${r.equityShare.toFixed(1)}%</td>
      <td>${r.term} yr</td>
      <td class="money">${fmtD(r.investorPayout)}</td>
      <td class="money">${fmtD(r.origCost)}</td>
      <td class="money total-cell">${fmtD(r.totalCost)}</td>
      <td>${r.effectiveRate.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  // Risk adjustment visual
  if (riskVizEl) {
    riskVizEl.innerHTML = results.map(r => {
      const actualPct = 100;
      const adjPct = r.riskAdj;
      const discount = state.homeValue - r.adjustedValue;
      return `<div class="risk-bar-row">
        <div class="risk-provider-name">${r.name}</div>
        <div class="risk-bars">
          <div class="risk-bar-track">
            <div class="risk-bar-actual" style="width: 100%">
              <span class="risk-bar-label">${fmtD(state.homeValue)}</span>
            </div>
            <div class="risk-bar-adjusted" style="width: ${adjPct}%">
              <span class="risk-bar-label">${fmtD(r.adjustedValue)}</span>
            </div>
          </div>
          <div class="risk-discount">-${fmtD(discount)} (${(100 - adjPct)}% haircut)</div>
        </div>
      </div>`;
    }).join('');
  }

  // Origination fee breakdown
  if (feeBreakdownEl) {
    const maxFee = Math.max(...results.map(r => r.origCost));
    feeBreakdownEl.innerHTML = results.map(r => {
      const barW = maxFee > 0 ? (r.origCost / maxFee) * 100 : 0;
      return `<div class="fee-row">
        <span class="fee-name">${r.name}</span>
        <div class="fee-bar-track">
          <div class="fee-bar-fill" style="width: ${barW}%"></div>
        </div>
        <span class="fee-rate">${r.origFee}%</span>
        <span class="fee-amount">${fmtD(r.origCost)}</span>
      </div>`;
    }).join('');
  }
}

function sortProviderTable(col) {
  if (currentSort.col === col) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.col = col;
    currentSort.asc = true;
  }
  // Update header arrows
  document.querySelectorAll('.sort-header').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === col) {
      th.classList.add(currentSort.asc ? 'sort-asc' : 'sort-desc');
    }
  });
  updateProviderSection();
}
