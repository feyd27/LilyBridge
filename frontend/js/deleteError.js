// /js/deleteError.js
document.addEventListener('DOMContentLoaded', () => {
  const pageSizeSelect   = document.getElementById('pageSize');
  const prevPageBtn      = document.getElementById('prevPage');
  const nextPageBtn      = document.getElementById('nextPage');
  const paginationInfo   = document.getElementById('paginationInfo');
  const container        = document.getElementById('errorMessagesContainer'); // tbody
  const deleteButton     = document.getElementById('deleteSelectedError');
  const alertContainer   = document.getElementById('alertContainer');
  const selectedCount    = document.getElementById('selectedCount');

  // Optional: if you have a wrapper around the table & pagination, set its ID here to hide it in one shot.
  const uiWrapper = document.getElementById('errorsUI'); // e.g., a <section id="errorsUI">…

  let currentPage = 1;
  let pageSize    = parseInt(pageSizeSelect.value, 10);
  let totalPages  = 1;
  let selectedMessages = new Set();

  function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Original timed alert (used for deletes / generic errors) – reloads after 30s
  function showTimedAlert(container, message, type = 'success') {
    container.className = `callout ${type} show`;
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => {
      container.style.display = 'none';
      location.reload();
    }, 30000);
  }

  // NEW: simple alert without auto-reload (used for "No messages to display")
  function showAlert(container, message, type = 'alert') {
    container.className = `callout ${type} show`;
    container.textContent = message;
    container.style.display = 'block';
  }

  // Hide all UI except the alert
  function hideUIForNoMessages() {
    // Hide wrapper if present
    if (uiWrapper) uiWrapper.style.display = 'none';

    // Fallback: hide specific parts individually
    const table = container ? container.closest('table') : null;
    if (table) table.style.display = 'none';

    if (pageSizeSelect)  pageSizeSelect.style.display = 'none';
    if (prevPageBtn)     prevPageBtn.style.display = 'none';
    if (nextPageBtn)     nextPageBtn.style.display = 'none';
    if (paginationInfo)  paginationInfo.style.display = 'none';
    if (selectedCount)   selectedCount.style.display = 'none';
    if (deleteButton)    deleteButton.style.display = 'none';
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const datePart = d.toLocaleDateString();
    const timePart = d.toLocaleTimeString([], {
      hour12: false,
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return `${datePart} ${timePart}`;
  }

  async function fetchAndDisplayMessages() {
    try {
      const res = await fetch(`/api/mqtt/api/messages/errors?page=${currentPage}&limit=${pageSize}`);

      if (res.status === 404) {
        // No messages: hide all UI, show only the alert (no reload)
        container.innerHTML = '';
        hideUIForNoMessages();
        showAlert(alertContainer, 'No messages to display', 'alert');
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      displayErrorMessages(data.messages || []);

      // Ensure UI visible if there ARE messages (in case previous state hid it)
      if (uiWrapper) uiWrapper.style.display = '';
      const table = container ? container.closest('table') : null;
      if (table) table.style.display = '';
      if (pageSizeSelect)  pageSizeSelect.style.display = '';
      if (prevPageBtn)     prevPageBtn.style.display = '';
      if (nextPageBtn)     nextPageBtn.style.display = '';
      if (paginationInfo)  paginationInfo.style.display = '';
      if (selectedCount)   selectedCount.style.display = '';
      if (deleteButton)    deleteButton.style.display = '';

      totalPages = data.totalPages || Math.ceil((data.totalItems || 0) / pageSize);
      updatePaginationDisplay(data.totalItems || 0, totalPages, currentPage);
      updateButtonStates();
      updateDeleteButtonState();
    } catch (err) {
      console.error('Error fetching error messages:', err);
      showTimedAlert(alertContainer, `Error fetching messages: ${err.message}`, 'alert');
    }
  }

  function displayErrorMessages(messages) {
    container.innerHTML = '';
    messages.forEach(msg => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${msg.message}</td>
        <td>${formatTimestamp(msg.receivedAt)}</td>
        <td><input type="checkbox" class="message-checkbox" data-id="${msg._id}"></td>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.message-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', e => {
        const id = e.target.dataset.id;
        if (e.target.checked) selectedMessages.add(id);
        else selectedMessages.delete(id);
        updateDeleteButtonState();
      });
    });
    updateSelectedCount();
  }

  function updatePaginationDisplay(totalItems, totalPages, currentPage) {
    if (totalItems === 0) {
      paginationInfo.textContent = 'No messages';
    } else {
      paginationInfo.textContent =
        `Page ${currentPage} of ${totalPages} — Showing ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
    }
  }

  function updateButtonStates() {
    prevPageBtn.disabled = currentPage === 1 || totalPages === 0;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
  }

  function updateDeleteButtonState() {
    deleteButton.disabled = selectedMessages.size === 0;
    updateSelectedCount();
  }

  function updateSelectedCount() {
    selectedCount.textContent = `Selected: ${selectedMessages.size} message${selectedMessages.size !== 1 ? 's' : ''}`;
  }

  // Pagination events
  pageSizeSelect.addEventListener('change', () => {
    pageSize = parseInt(pageSizeSelect.value, 10);
    currentPage = 1;
    fetchAndDisplayMessages();
  });

  nextPageBtn.addEventListener('click', e => {
    e.preventDefault();
    if (currentPage < totalPages) {
      currentPage++;
      fetchAndDisplayMessages();
    }
  });

  prevPageBtn.addEventListener('click', e => {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      fetchAndDisplayMessages();
    }
  });

  deleteButton.addEventListener('click', async e => {
    e.preventDefault();
    smoothScrollToTop();
    if (selectedMessages.size === 0) return;

    const ids = Array.from(selectedMessages);
    try {
      const res = await fetch('/api/mqtt/api/messages/errors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.message === 'Error messages deleted successfully') {
        showTimedAlert(alertContainer, 'Selected messages deleted successfully.', 'success');
        selectedMessages.clear();
      } else {
        showTimedAlert(alertContainer, 'Failed to delete messages.', 'alert');
      }
    } catch (err) {
      console.error('Error deleting messages:', err);
      showTimedAlert(alertContainer, `Deletion error: ${err.message}`, 'alert');
    }
  });

  fetchAndDisplayMessages();
});
