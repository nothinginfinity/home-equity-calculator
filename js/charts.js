// ── Phase 2: Chart Visualizations ──

let costOverTimeChart = null;
let sensitivityChart = null;
let monthlyPaymentChart = null;

const CHART_COLORS = {
  hei: { line: '#a78bfa', fill: 'rgba(167, 139, 250, 0.1)' },
  heq: { line: '#38bdf8', fill: 'rgba(56, 189, 248, 0.1)' },
  heloc: { line: '#fb923c', fill: 'rgba(251, 146, 60, 0.1)' },
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      labels: { color: '#8b8fa3', font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 16 },
    },
    tooltip: {
      backgroundColor: '#1a1d27',
      borderColor: '#2e3343',
      borderWidth: 1,
      titleColor: '#e4e6ed',
      bodyColor: '#8b8fa3',
      titleFont: { family: 'Inter', weight: '600' },
      bodyFont: { family: 'Inter' },
      padding: 12,
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(46, 51, 67, 0.5)' },
      ticks: { color: '#8b8fa3', font: { family: 'Inter', size: 11 } },
    },
    y: {
      grid: { color: 'rgba(46, 51, 67, 0.5)' },
      ticks: {
        color: '#8b8fa3',
        font: { family: 'Inter', size: 11 },
        callback: (v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v),
      },
    },
  },
};

// ── 1. Cost Over Time Line Chart ──
function updateCostOverTimeChart() {
  const ctx = document.getElementById('cost-over-time-chart');
  if (!ctx) return;

  const yearlyData = calcYearlyCosts({
    homeValue: state.homeValue,
    cashNeeded: state.cashNeeded,
    appreciationRate: state.appreciationRate,
    termYears: state.timeHorizon,
    heqRate: state.heqRate,
    helocRate: state.helocRate,
    helocCap: state.helocCap,
  });

  const labels = yearlyData.map(d => 'Year ' + d.year);
  const heiData = yearlyData.map(d => d.hei);
  const heqData = yearlyData.map(d => d.heq);
  const helocData = yearlyData.map(d => d.heloc);

  // Find breakeven year (where HEI crosses above cheapest traditional)
  let breakevenYear = null;
  for (let i = 0; i < yearlyData.length; i++) {
    const cheaperTraditional = Math.min(yearlyData[i].heq, yearlyData[i].heloc);
    if (yearlyData[i].hei > cheaperTraditional) {
      breakevenYear = i;
      break;
    }
  }

  const datasets = [
    {
      label: 'HEI (Sharing)',
      data: heiData,
      borderColor: CHART_COLORS.hei.line,
      backgroundColor: CHART_COLORS.hei.fill,
      fill: true,
      tension: 0.3,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
    },
    {
      label: 'Home Equity Loan',
      data: heqData,
      borderColor: CHART_COLORS.heq.line,
      backgroundColor: CHART_COLORS.heq.fill,
      fill: true,
      tension: 0.3,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
    },
    {
      label: 'HELOC',
      data: helocData,
      borderColor: CHART_COLORS.heloc.line,
      backgroundColor: CHART_COLORS.heloc.fill,
      fill: true,
      tension: 0.3,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
    },
  ];

  // Add breakeven annotation line
  const breakEvenPlugin = breakevenYear !== null ? {
    id: 'breakeven',
    afterDraw(chart) {
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const x = xScale.getPixelForValue(breakevenYear);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, yScale.top);
      ctx.lineTo(x, yScale.bottom);
      ctx.stroke();
      // Label
      ctx.fillStyle = '#f87171';
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('HEI Breakeven', x, yScale.top - 6);
      ctx.restore();
    }
  } : { id: 'breakeven-noop' };

  if (costOverTimeChart) {
    costOverTimeChart.data.labels = labels;
    costOverTimeChart.data.datasets[0].data = heiData;
    costOverTimeChart.data.datasets[1].data = heqData;
    costOverTimeChart.data.datasets[2].data = helocData;
    // Update breakeven plugin
    costOverTimeChart.options.plugins.breakeven = { year: breakevenYear };
    costOverTimeChart.update('none');
  } else {
    costOverTimeChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          title: {
            display: true,
            text: 'Total Cost Over Time',
            color: '#e4e6ed',
            font: { family: 'Inter', size: 14, weight: '600' },
            padding: { bottom: 16 },
          },
        },
      },
      plugins: [breakEvenPlugin],
    });
  }

  // Update breakeven indicator text
  const beEl = document.getElementById('breakeven-indicator');
  if (beEl) {
    if (breakevenYear !== null) {
      beEl.innerHTML = `<span style="color: var(--red);">HEI becomes more expensive than traditional options at <strong>Year ${breakevenYear + 1}</strong></span>`;
    } else {
      beEl.innerHTML = `<span style="color: var(--green);">HEI remains cheaper than traditional options for the full ${state.timeHorizon}-year term</span>`;
    }
  }
}

// ── 2. Appreciation Sensitivity Chart ──
function updateSensitivityChart() {
  const ctx = document.getElementById('sensitivity-chart');
  if (!ctx) return;

  const rates = [];
  const heiCosts = [];
  const heiEffRates = [];
  const heqLine = [];

  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);

  for (let r = 0; r <= 10; r += 0.5) {
    rates.push(r + '%');
    const hei = calcHEI(state.homeValue, state.cashNeeded, r, state.timeHorizon);
    heiCosts.push(hei.totalCost);
    heiEffRates.push(hei.effectiveRate);
    heqLine.push(heq.totalCost);
  }

  if (sensitivityChart) {
    sensitivityChart.data.labels = rates;
    sensitivityChart.data.datasets[0].data = heiCosts;
    sensitivityChart.data.datasets[1].data = heqLine;
    sensitivityChart.update('none');
  } else {
    sensitivityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: rates,
        datasets: [
          {
            label: 'HEI Total Cost',
            data: heiCosts,
            borderColor: CHART_COLORS.hei.line,
            backgroundColor: CHART_COLORS.hei.fill,
            fill: true,
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: 'Home Equity Loan (fixed)',
            data: heqLine,
            borderColor: CHART_COLORS.heq.line,
            borderDash: [8, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          ...CHART_DEFAULTS.scales,
          x: {
            ...CHART_DEFAULTS.scales.x,
            title: {
              display: true,
              text: 'Home Appreciation Rate',
              color: '#8b8fa3',
              font: { family: 'Inter', size: 12 },
            },
          },
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: {
              display: true,
              text: 'Total Cost',
              color: '#8b8fa3',
              font: { family: 'Inter', size: 12 },
            },
          },
        },
        plugins: {
          ...CHART_DEFAULTS.plugins,
          title: {
            display: true,
            text: 'HEI Cost Sensitivity to Home Appreciation',
            color: '#e4e6ed',
            font: { family: 'Inter', size: 14, weight: '600' },
            padding: { bottom: 16 },
          },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              title: (items) => `Appreciation: ${items[0].label}`,
              label: (ctx) => {
                const cost = '$' + ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 });
                if (ctx.datasetIndex === 0) {
                  const idx = ctx.dataIndex;
                  const effRate = heiEffRates[idx];
                  return `${ctx.dataset.label}: ${cost} (eff. rate: ${effRate.toFixed(1)}%)`;
                }
                return `${ctx.dataset.label}: ${cost}`;
              },
            },
          },
        },
      },
    });
  }

  // Update the sensitivity summary
  const summaryEl = document.getElementById('sensitivity-summary');
  if (summaryEl) {
    const scenarios = [2, 4, 6, 8].map(r => {
      const hei = calcHEI(state.homeValue, state.cashNeeded, r, state.timeHorizon);
      const diff = hei.totalCost - heq.totalCost;
      const cheaper = diff < 0 ? 'hei' : 'heq';
      return { rate: r, effRate: hei.effectiveRate, cost: hei.totalCost, diff, cheaper };
    });

    summaryEl.innerHTML = scenarios.map(s => {
      const diffStr = Math.abs(s.diff).toLocaleString('en-US', { maximumFractionDigits: 0 });
      const color = s.cheaper === 'hei' ? 'var(--green)' : 'var(--red)';
      const label = s.cheaper === 'hei' ? 'HEI saves' : 'HEI costs more';
      return `<div class="sens-row">
        <span class="sens-rate">${s.rate}%/yr</span>
        <span class="sens-eff">Eff. rate: ${s.effRate.toFixed(1)}%</span>
        <span class="sens-diff" style="color: ${color}">${label} $${diffStr}</span>
      </div>`;
    }).join('');
  }
}

// ── 3. Monthly Payment Bar Chart ──
function updateMonthlyPaymentChart() {
  const ctx = document.getElementById('monthly-payment-chart');
  if (!ctx) return;

  const heq = calcHomeEquityLoan(state.cashNeeded, state.heqRate, state.timeHorizon);
  const heloc = calcHELOC(state.cashNeeded, state.helocRate, state.helocCap, Math.min(state.timeHorizon, 10), Math.max(0, state.timeHorizon - 10));

  const data = {
    labels: ['HEI', 'Home Equity Loan', 'HELOC (Draw)', 'HELOC (Repay)'],
    datasets: [{
      data: [0, heq.monthlyPayment, heloc.monthlyPaymentDraw, heloc.monthlyPaymentRepay],
      backgroundColor: [
        CHART_COLORS.hei.line,
        CHART_COLORS.heq.line,
        CHART_COLORS.heloc.line,
        'rgba(251, 146, 60, 0.6)',
      ],
      borderColor: [
        CHART_COLORS.hei.line,
        CHART_COLORS.heq.line,
        CHART_COLORS.heloc.line,
        CHART_COLORS.heloc.line,
      ],
      borderWidth: 1,
      borderRadius: 6,
      barPercentage: 0.6,
    }],
  };

  if (monthlyPaymentChart) {
    monthlyPaymentChart.data.datasets[0].data = data.datasets[0].data;
    monthlyPaymentChart.update('none');
  } else {
    monthlyPaymentChart = new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: false },
          title: {
            display: true,
            text: 'Monthly Payment Comparison',
            color: '#e4e6ed',
            font: { family: 'Inter', size: 14, weight: '600' },
            padding: { bottom: 16 },
          },
          tooltip: {
            ...CHART_DEFAULTS.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                if (val === 0) return 'No monthly payment';
                return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' / month';
              },
            },
          },
        },
        scales: {
          ...CHART_DEFAULTS.scales,
          y: {
            ...CHART_DEFAULTS.scales.y,
            beginAtZero: true,
            title: {
              display: true,
              text: '$ / Month',
              color: '#8b8fa3',
              font: { family: 'Inter', size: 12 },
            },
          },
        },
      },
    });
  }
}

// ── Master Chart Update ──
function updateAllCharts() {
  updateCostOverTimeChart();
  updateSensitivityChart();
  updateMonthlyPaymentChart();
}
