// /assets/js/statsGlobal.js
import { fetchWithAuth } from './authFetch.js';

/* -------------------- chart palettes -------------------- */
const PALETTES = {
  IOTA: {
    line: 'rgba(237, 255, 78, 1)',       // main line
    fill: 'rgba(248, 250, 142, 0.5)',   // soft fill
    avg:  'rgba(255, 199, 78, 0.97)',
    p50:  'rgba(255, 99, 78, 1)',
    p95:  'rgba(255, 78, 93, 0.86)'
  },
  SIGNUM: {
    line: 'rgba(40, 170, 0, 1)',
    fill: 'rgba(208, 255, 180, 0.73)',
    avg:  'rgba(226, 222, 11, 1)',
    p50:  'rgba(202, 236, 10, 0.92)',
    p95:  'rgba(224, 222, 83, 0.91)'
  }
};

/* -------------------- formatting helpers -------------------- */
const fmt = (n, d = 3) =>
  Number(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });

const fmt0 = (n) => fmt(n, 0);
const fmt3 = (n) => fmt(n, 3);
const fmt6 = (n) => fmt(n, 6);

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showAlert(msg, type = 'alert') {
  const el = document.getElementById('alertContainer');
  if (!el) return;
  el.className = `callout ${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 3500);
}

/* -------------------- cards rendering -------------------- */
function renderCards(prefix, stats) {
  // 0-decimal fields
  setText(`${prefix}-totalReadingsValue`,   fmt0(stats.totalReadings));
  setText(`${prefix}-pendingCountValue`,    fmt0(stats.pendingCount));
  setText(`${prefix}-confirmedCountValue`,  fmt0(stats.confirmedCount));

  // 6-decimal
  setText(`${prefix}-avgCostPerReadingValue`, fmt6(stats.avgCostPerReading));

  // 3-decimal defaults
  setText(`${prefix}-totalDataKBValue`,         fmt3(stats.totalDataKB));
  setText(`${prefix}-avgReadingsPerUploadValue`,fmt3(stats.avgReadingsPerUpload));
  setText(`${prefix}-totalCostValue`,           fmt3(stats.totalCost));
  setText(`${prefix}-avgTimeToConfirmMsValue`,  fmt3(stats.avgTimeToConfirmMs));
  setText(`${prefix}-p50TimeToConfirmMsValue`,  fmt3(stats.p50TimeToConfirmMs));
  setText(`${prefix}-p95TimeToConfirmMsValue`,  fmt3(stats.p95TimeToConfirmMs));
}

/* -------------------- charts -------------------- */
let iotaChartInstance = null;
let signumChartInstance = null;

function makeOverlaySeries(len, value, label, color, dash = [6, 4]) {
  if (!Number.isFinite(value) || value <= 0 || len === 0) return null;
  return {
    label,
    data: Array(len).fill(Number(value)),
    borderColor: color,
    borderWidth: 2,
    borderDash: dash,
    fill: false,
    pointRadius: 0,
    tension: 0
  };
}

function makeLineConfig({ labels, mainSeries, overlays, title, yLabel }) {
  // overlays: array of optional datasets (filter nulls)
  const datasets = [
    {
      label: yLabel,
      data: mainSeries.data,
      borderWidth: 2,
      borderColor: mainSeries.borderColor,
      backgroundColor: mainSeries.backgroundColor,
      fill: true,
      tension: 0.25,
      pointRadius: 0
    },
    ...overlays.filter(Boolean)
  ];

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title,
          color: '#000',
          font: { family: 'Helvetica', weight: 'bold' }
        },
        legend: {
          labels: { color: '#000', font: { family: 'Helvetica', size: 12 } }
        },
        tooltip: {
          bodyFont:   { family: 'Helvetica', size: 14 },
          titleFont:  { family: 'Helvetica', size: 14 },
          backgroundColor: 'rgba(68, 110, 255, 0.8)',
          bodyColor:  '#fff'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Upload # (most recent first)',
            color: '#000',
            font: { family: 'Helvetica', size: 12 }
          },
          ticks: { color: '#000' }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: yLabel,
            color: '#000',
            font: { family: 'Helvetica', size: 12 }
          },
          ticks: { color: '#000' }
        }
      }
    }
  };
}

function drawIotaChart(iotaData) {
  const canvas = document.getElementById('iotaChart');
  if (!canvas || !window.Chart) return;

  const durations = (Array.isArray(iotaData?.durations) ? iotaData.durations : [])
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const labels    = durations.map((_, idx) => idx + 1);

  if (iotaChartInstance) iotaChartInstance.destroy();

  const overlays = [
    makeOverlaySeries(labels.length, iotaData?.avgTimeToConfirmMs, 'Avg', PALETTES.IOTA.avg, [6, 4]),
    makeOverlaySeries(labels.length, iotaData?.p50TimeToConfirmMs, 'P50', PALETTES.IOTA.p50, [4, 4]),
    makeOverlaySeries(labels.length, iotaData?.p95TimeToConfirmMs, 'P95', PALETTES.IOTA.p95, [2, 4])
  ];

  const cfg = makeLineConfig({
    labels,
    mainSeries: {
      data: durations,
      borderColor: PALETTES.IOTA.line,
      backgroundColor: PALETTES.IOTA.fill
    },
    overlays,
    title: 'IOTA — Upload Duration (ms)',
    yLabel: 'Duration (ms)'
  });

  iotaChartInstance = new Chart(canvas.getContext('2d'), cfg);
}

function drawSignumChart(sigData) {
  const canvas = document.getElementById('signumChart');
  if (!canvas || !window.Chart) return;

  const durations = (Array.isArray(sigData?.durations) ? sigData.durations : [])
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const labels    = durations.map((_, idx) => idx + 1);

  if (signumChartInstance) signumChartInstance.destroy();

  const overlays = [
    makeOverlaySeries(labels.length, sigData?.avgTimeToConfirmMs, 'Avg', PALETTES.SIGNUM.avg, [6, 4]),
    makeOverlaySeries(labels.length, sigData?.p50TimeToConfirmMs, 'P50', PALETTES.SIGNUM.p50, [4, 4]),
    makeOverlaySeries(labels.length, sigData?.p95TimeToConfirmMs, 'P95', PALETTES.SIGNUM.p95, [2, 4])
  ];

  const cfg = makeLineConfig({
    labels,
    mainSeries: {
      data: durations,
      borderColor: PALETTES.SIGNUM.line,
      backgroundColor: PALETTES.SIGNUM.fill
    },
    overlays,
    title: 'Signum — Confirmation Time (ms)',
    yLabel: 'Time to Confirm (ms)'
  });

  signumChartInstance = new Chart(canvas.getContext('2d'), cfg);
}

/* -------------------- fetch helpers -------------------- */
async function fetchJson(url) {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/* -------------------- boot -------------------- */
async function load() {
  try {
    const [iotaData, signumData] = await Promise.all([
      fetchJson('/stats/iota/uploads'),
      fetchJson('/stats/signum/uploads')
    ]);

    renderCards('iota', iotaData);
    renderCards('signum', signumData);

    drawIotaChart(iotaData);
    drawSignumChart(signumData);
  } catch (err) {
    console.error('[Global Stats Split] load error:', err);
    showAlert('Failed to load stats. Please refresh.', 'alert');
  }
}

document.addEventListener('DOMContentLoaded', load);
