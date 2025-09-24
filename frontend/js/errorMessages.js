// /js/errorMessages.js
document.addEventListener('DOMContentLoaded', () => {
  const pageSizeSelect = document.getElementById('pageSize');
  const prevPageBtn    = document.getElementById('prevPage');
  const nextPageBtn    = document.getElementById('nextPage');
  const paginationInfo = document.getElementById('paginationInfo');
  const rowsContainer  = document.getElementById('errorMessagesTable'); // tbody
  const paginationCtrls= document.getElementById('paginationControls');
  const tableEl        = rowsContainer ? rowsContainer.closest('table') : null;

  // Use an existing alert container if present, otherwise create one above the table
  let alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alertContainer';
    alertContainer.style.display = 'none';
    if (tableEl && tableEl.parentNode) {
      tableEl.parentNode.insertBefore(alertContainer, tableEl);
    } else {
      document.body.prepend(alertContainer);
    }
  }

  let currentPage = 1;
  let pageSize    = parseInt(pageSizeSelect.value, 10);
  let totalPages  = 1;

  const showAlert = (msg, type = 'alert') => {
    alertContainer.className = `callout ${type}`;
    alertContainer.textContent = msg;
    alertContainer.style.display = 'block';
  };

  const hideAlert = () => { alertContainer.style.display = 'none'; };

  const hideListUI = () => {
    if (tableEl) tableEl.style.display = 'none';
    if (paginationCtrls) paginationCtrls.style.display = 'none';
  };

  const showListUI = () => {
    if (tableEl) tableEl.style.display = '';
    if (paginationCtrls) paginationCtrls.style.display = '';
  };

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const datePart = d.toLocaleDateString();
    const timePart = d.toLocaleTimeString([], {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return `${datePart} ${timePart}`;
  }

  async function fetchAndDisplayMessages() {
    try {
      const res = await fetch(`/api/mqtt/api/messages/errors?page=${currentPage}&limit=${pageSize}`);

      // Explicit 404 => no messages
      if (res.status === 404) {
        if (rowsContainer) rowsContainer.innerHTML = '';
        hideListUI();
        showAlert('No messages to display', 'alert');
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Defensive: treat empty arrays as "no messages", even if 200
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      if (msgs.length === 0) {
        if (rowsContainer) rowsContainer.innerHTML = '';
        hideListUI();
        showAlert('No messages to display', 'alert');
        return;
      }

      // We have messages
      hideAlert();
      showListUI();
      displayErrorMessages(msgs);

      totalPages = data.totalPages || Math.ceil((data.totalItems || 0) / pageSize);
      updatePaginationDisplay(data.totalItems || msgs.length, totalPages, currentPage);
      updateButtonStates();
    } catch (err) {
      console.error('Error fetching error messages:', err);
      // On real errors keep UI visible (so users can retry), but show an alert
      showAlert(`Error fetching messages: ${err.message}`, 'alert');
    }
  }

  function displayErrorMessages(messages) {
    if (!rowsContainer) return;
    rowsContainer.innerHTML = '';
    messages.forEach(msg => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${msg.message}</td>
        <td>${formatTimestamp(msg.receivedAt)}</td>
      `;
      rowsContainer.appendChild(row);
    });
  }

  function updatePaginationDisplay(totalItems, totalPages, currentPage) {
    if (!paginationInfo) return;
    paginationInfo.textContent =
      `Page ${currentPage} of ${totalPages} - Displaying ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
  }

  function updateButtonStates() {
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
  }

  pageSizeSelect.addEventListener('change', () => {
    pageSize    = parseInt(pageSizeSelect.value, 10);
    currentPage = 1;
    fetchAndDisplayMessages();
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      fetchAndDisplayMessages();
    }
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchAndDisplayMessages();
    }
  });

  fetchAndDisplayMessages();
});
