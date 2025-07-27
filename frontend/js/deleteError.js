import { fetchWithAuth } from './authFetch.js';

document.addEventListener('DOMContentLoaded', () => {
  const pageSizeSelect = document.getElementById('pageSize');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const paginationInfo = document.getElementById('paginationInfo');
  const container = document.getElementById('errorMessagesContainer');
  const deleteButton = document.getElementById('deleteSelectedError');
  const alertContainer = document.getElementById('alertContainer');
  const selectedCount = document.getElementById('selectedCount');

  let currentPage = 1;
  let pageSize = parseInt(pageSizeSelect.value, 10);
  let totalPages = 1;
  let selectedMessages = new Set();

  function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showTimedAlert(container, message, type = 'success') {
    container.className = `callout ${type} show`;
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => {
      container.style.display = 'none';
      location.reload();
    }, 3000);
  }

  async function fetchAndDisplayMessages() {
    try {
      const res = await fetchWithAuth(`/api/mqtt/api/messages/errors?page=${currentPage}&limit=${pageSize}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      displayErrorMessages(data.messages || []);
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
        <td>${new Date(msg.receivedAt).toLocaleString()}</td>
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
    paginationInfo.textContent =
      `Page ${currentPage} of ${totalPages} — Showing ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
  }

  function updateButtonStates() {
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
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
      const res = await fetchWithAuth('/api/mqtt/api/messages/errors', {
        method: 'DELETE',
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
