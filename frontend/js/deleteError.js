// deleteError.js
import { fetchWithAuth } from './authFetch.js';

document.addEventListener('DOMContentLoaded', () => {
  const pageSizeSelect    = document.getElementById('pageSize');
  const prevPageBtn       = document.getElementById('prevPage');
  const nextPageBtn       = document.getElementById('nextPage');
  const paginationInfo    = document.getElementById('paginationInfo');
  const container         = document.getElementById('errorMessagesContainer');
  const deleteButton      = document.getElementById('deleteSelectedError');
  const alertContainer    = document.getElementById('alertContainer');

  if (!container) {
    console.error('Error: Container for error messages not found');
    return;
  }

  // 1️⃣ Check auth status on load
  async function checkAuthentication() {
    try {
      const res = await fetchWithAuth('/api/auth/status');
      if (!res.ok) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Error checking authentication status:', err);
      window.location.href = '/login';
    }
  }
  checkAuthentication();

  // pagination state
  let currentPage = 1;
  let pageSize    = parseInt(pageSizeSelect.value, 10);
  let totalPages  = 1;

  // 2️⃣ Fetch & render
  async function fetchAndDisplayMessages() {
    console.log(`Fetching page ${currentPage} (limit ${pageSize})`);
    try {
      const res = await fetchWithAuth(
        `/api/mqtt/api/messages/errors?page=${currentPage}&limit=${pageSize}`
      );
      if (res.status === 404) {
        showAlert('No error messages found.', 'alert');
        displayErrorMessages([]);
        updatePaginationDisplay(0, 0, 1);
        updateButtonStates();
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.messages) || data.messages.length === 0) {
        showAlert('No error messages found.', 'alert');
        displayErrorMessages([]);
        updatePaginationDisplay(0, 0, 1);
        updateButtonStates();
        return;
      }
      // render table
      displayErrorMessages(data.messages);
      totalPages = data.totalPages;
      updatePaginationDisplay(data.totalItems, totalPages, currentPage);
      updateButtonStates();
    } catch (err) {
      console.error('Error fetching error messages:', err);
      showAlert(`Error fetching messages: ${err.message}`, 'error');
    }
  }

  function displayErrorMessages(messages) {
    container.innerHTML = '';
    for (const msg of messages) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${msg.message}</td>
        <td>${new Date(msg.receivedAt).toLocaleString()}</td>
        <td>
          <input type="checkbox" name="selectMessage" value="${msg._id}">
        </td>
      `;
      container.appendChild(row);
    }
  }

  function updatePaginationDisplay(totalItems, totalPages, currentPage) {
    paginationInfo.textContent =
      `Page ${currentPage} of ${totalPages} — Showing ` +
      `${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
  }

  function updateButtonStates() {
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  // pagination controls
  pageSizeSelect.addEventListener('change', () => {
    pageSize    = parseInt(pageSizeSelect.value, 10);
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

  // initial load
  fetchAndDisplayMessages();

  // 3️⃣ Delete selected
  if (deleteButton) {
    deleteButton.addEventListener('click', async e => {
      e.preventDefault();
      const checked = [
        ...document.querySelectorAll(
          '#errorMessagesContainer input[name="selectMessage"]:checked'
        )
      ];
      if (checked.length === 0) {
        showAlert('Please select at least one message to delete.', 'alert');
        smoothScrollToTop();
        return;
      }
      const ids = checked.map(c => c.value);
      try {
        const res = await fetchWithAuth('/api/mqtt/api/messages/errors', {
          method: 'DELETE',
          body: JSON.stringify({ ids })
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.message === 'Error messages deleted successfully') {
          showAlert('Selected messages deleted successfully.', 'success');
          smoothScrollToTop();
          setTimeout(() => fetchAndDisplayMessages(), 500);
          setTimeout(async () => {
            await fetchAndDisplayMessages();
            alertContainer.style.display = 'none';
          }, 500);
        } else {
          showAlert('Failed to delete messages.', 'alert');
          smoothScrollToTop();
        }
      } catch (err) {
        console.error('Error deleting messages:', err);
        showAlert(`Deletion error: ${err.message}`, 'error');
      }
    });
  } else {
    console.error("Delete button with ID 'deleteSelectedError' not found");
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function showAlert(message, type) {
    if (!alertContainer) {
      console.error('Alert container not found');
      return;
    }
    alertContainer.className = `callout ${type} show`;
    alertContainer.textContent = message;
    alertContainer.style.display = 'block';
    console.log('Alert:', message);
  }
});
