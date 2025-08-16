//js/iotaExplorerTable.js


const state = {
  confirmed: true,
  page: 1,
  limit: 25,
  totalPages: 1,
  totalItems: 0,
};

function showAlert(msg, type = "alert") {
  const el = document.getElementById("alertContainer");
  if (!el) return;
  el.className = `callout ${type}`;
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3000);
}

const fmtBool = (b) => (b ? "✅" : "❌");

function renderTable(items) {
  const tbody = document.getElementById("iotaTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  items.forEach((row) => {
    const tr = document.createElement("tr");
    const disabled = !row.explorerUrl ? "disabled" : "";
    tr.innerHTML = `
      <td>${row.index ?? ""}</td>
      <td>${Number(row.payloadSize ?? 0).toLocaleString()}</td>
      <td>${Number(row.readingCount ?? 0).toLocaleString()}</td>
      <td>${fmtBool(!!row.confirmed)}</td>
      <td class="text-center">
        <button class="button tiny ${disabled}" data-url="${row.explorerUrl || ""}" ${disabled}>
          View on the Tangle
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Wire explorer buttons
  tbody.querySelectorAll("button[data-url]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  });
}

function updatePaginationUI() {
  const info = document.getElementById("iotaPaginationInfo");
  const prev = document.getElementById("iotaPrevPage");
  const next = document.getElementById("iotaNextPage");

  if (info) info.textContent = `Page ${state.page} of ${state.totalPages} — limit ${state.limit}`;
  if (prev) prev.disabled = state.page <= 1;
  if (next) next.disabled = state.page >= state.totalPages;
}

async function fetchPage() {

  try {

    const res = await fetch(`/stats/iota/explorer-links?confirmed=${state.confirmed}&page=${state.page}&limit=${state.limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.totalItems = data.totalItems || 0;
    state.totalPages = data.totalPages || 1;
    state.page = data.currentPage || 1;
    state.limit = data.limit || state.limit;

    renderTable(Array.isArray(data.items) ? data.items : []);
    updatePaginationUI();
  } catch (err) {
    console.error("[IotaExplorer] fetchPage error:", err);
    showAlert("Failed to load IOTA explorer links.", "alert");
  }
}

function attachControls() {
  const pageSizeEl = document.getElementById("PageSize");
  const prev = document.getElementById("PrevPage");
  const next = document.getElementById("NextPage");

  if (pageSizeEl) {
    pageSizeEl.value = String(state.limit); // default 25
    pageSizeEl.addEventListener("change", () => {
      const v = parseInt(pageSizeEl.value, 10);
      state.limit = [25, 50, 100].includes(v) ? v : 25;
      state.page = 1;
      fetchPage();
    });
  }
  if (prev) {
    prev.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        fetchPage();
      }
    });
  }
  if (next) {
    next.addEventListener("click", () => {
      if (state.page < state.totalPages) {
        state.page += 1;
        fetchPage();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  attachControls();
  fetchPage(); // confirmed=true, page=1, limit=25
});
