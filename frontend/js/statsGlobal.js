// /frontend/js/statsGlobal.js
import { fetchWithAuth } from './authFetch.js';

const fmt3 = (n) => (Number.isFinite(+n) ? (+n).toFixed(2) : '0.00');

const PALETTES = {
  IOTA: {
    line: 'rgba(237, 255, 78, 1)',       // main line
    fill: 'rgba(248, 250, 142, 0.5)',   // soft fill
    avg: 'rgba(255, 199, 78, 0.97)',
    p50: 'rgba(255, 99, 78, 1)',
    p95: 'rgba(255, 78, 93, 0.86)'
  },
  SIGNUM: {
    line: 'rgba(40, 170, 0, 1)',
    fill: 'rgba(208, 255, 180, 0.73)',
    avg: 'rgba(226, 222, 11, 1)',
    p50: 'rgba(202, 236, 10, 0.92)',
    p95: 'rgba(224, 222, 83, 0.91)'
  }
};

function showAlert(msg, type = 'alert') {
  const el = document.getElementById('alertContainer');
  el.className = `callout ${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 3500);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = fmt3(value);
}

function constLine(val, len) {
  return Array.from({ length: len }, (_, i) => ({ x: i + 1, y: val }));
}
function toXY(arr) {
  return (Array.isArray(arr) ? arr : []).map((v, i) => ({ x: i + 1, y: +v || 0 }));
}

// NEW: styled chart (temperature-chart look & feel)
function buildStyledChart(canvasId, chainLabel, stats, palette) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const durations = Array.isArray(stats.durations) ? stats.durations : [];
  const N = durations.length || 1;

  const avg = +stats.avgTimeToConfirmMs || 0;
  const p50 = +stats.p50TimeToConfirmMs || 0;
  const p95 = +stats.p95TimeToConfirmMs || 0;

  const key = `__chart_${canvasId}`;
  if (window[key]) window[key].destroy();

  window[key] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: durations.map((_, i) => i + 1),
      datasets: [
        // Main series (solid, filled)
        {
          label: `${chainLabel} durations (ms)`,
          data: durations,
          borderWidth: 2,
          borderColor: palette.line,
          backgroundColor: palette.fill,
          fill: true,
          pointRadius: 0,
          tension: 0.12
        },
        // Avg / P50 / P95 (dashed, no fill)
        {
          label: `${chainLabel} Avg (${avg.toFixed(3)} ms)`,
          data: constLine(avg, N),
          borderColor: palette.avg,
          borderWidth: 1.5,
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false
        },
        {
          label: `${chainLabel} P50 (${p50.toFixed(3)} ms)`,
          data: constLine(p50, N),
          borderColor: palette.p50,
          borderWidth: 1.5,
          borderDash: [4, 6],
          pointRadius: 0,
          fill: false
        },
        {
          label: `${chainLabel} P95 (${p95.toFixed(3)} ms)`,
          data: constLine(p95, N),
          borderColor: palette.p95,
          borderWidth: 1.5,
          borderDash: [2, 6],
          pointRadius: 1,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `${chainLabel} — Upload duration (ms)`,
          color: '#ffffffff',
          font: { family: 'Helvetica', weight: 'bold' }
        },
        legend: {
          labels: { color: '#ffffffff', font: { family: 'Helvetica', size: 12 } }
        },
        tooltip: {
          bodyFont: { family: 'Helvetica', size: 14 },
          titleFont: { family: 'Helvetica', size: 14 },
          backgroundColor: 'rgba(68, 109, 255, 1)',
          bodyColor: '#fff',
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(3)}`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Upload # (sequence)',
            color: '#fcf8f8ff',
            font: { family: 'Helvetica', size: 12 }
          },
          ticks: { color: '#000' }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Milliseconds',
            color: '#000',
            font: { family: 'Helvetica', size: 12 }
          },
          ticks: { color: '#000' }
        }
      }
    }
  });
}

async function load() {
  try {
    const [iotaRes, signumRes] = await Promise.all([
      fetchWithAuth('/stats/iota/uploads'),
      fetchWithAuth('/stats/signum/uploads')
    ]);
    if (!iotaRes.ok || !signumRes.ok) throw new Error(`HTTP ${iotaRes.status}/${signumRes.status}`);

    const [iota, signum] = await Promise.all([iotaRes.json(), signumRes.json()]);
    

    // IOTA cards
    setText('iota-totalReadingsValue', iota.totalReadings);
    setText('iota-totalDataKBValue', iota.totalDataKB);
    setText('iota-avgReadingsPerUploadValue', iota.avgReadingsPerUpload);
    setText('iota-totalCostValue', iota.totalCost);
    setText('iota-avgCostPerReadingValue', iota.avgCostPerReading);
    setText('iota-pendingCountValue', iota.pendingCount);
    setText('iota-confirmedCountValue', iota.confirmedCount);

    // Signum cards
    setText('signum-totalReadingsValue', signum.totalReadings);
    setText('signum-totalDataKBValue', signum.totalDataKB);
    setText('signum-avgReadingsPerUploadValue', signum.avgReadingsPerUpload);
    setText('signum-totalCostValue', signum.totalCost);
    setText('signum-avgCostPerReadingValue', signum.avgCostPerReading);
    setText('signum-pendingCountValue', signum.pendingCount);
    setText('signum-confirmedCountValue', signum.confirmedCount);

    // Charts
    buildStyledChart('iotaChart', 'IOTA', iota, PALETTES.IOTA);
    buildStyledChart('signumChart', 'Signum', signum, PALETTES.SIGNUM);
  } catch (err) {
    console.error('[Global Stats Split] load error:', err);
    showAlert('Failed to load stats. Please try again.', 'alert');
  }
}

document.addEventListener('DOMContentLoaded', load);