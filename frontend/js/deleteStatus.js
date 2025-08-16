// /js/deleteStatus.js

document.addEventListener('DOMContentLoaded', () => {
  const pageSizeSelect = document.getElementById('pageSize');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const paginationInfo = document.getElementById('paginationInfo');
  const container = document.getElementById('statusMessagesContainer');
  const deleteButton = document.getElementById('deleteSelectedStatus');
  const alertContainer = document.getElementById('alertContainer');
  const selectedCount = document.getElementById('selectedCount');

  let currentPage = 1;
  let pageSize = parseInt(pageSizeSelect.value);
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

  function fetchAndDisplayMessages() {
    const token = localStorage.getItem('accessToken');
    fetch(`/api/mqtt/api/messages/status?page=${currentPage}&limit=${pageSize}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(response => response.json())
      .then(data => {
        displayStatusMessages(data.messages);
        totalPages = data.totalPages;
        updatePaginationDisplay(data.totalItems, totalPages, currentPage);
        updateButtonStates();
        updateDeleteButtonState();
      })
      .catch(error => console.error('Error fetching status messages:', error));
  }

  function displayStatusMessages(messages) {
    container.innerHTML = '';
    messages.forEach(message => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${message.chipID}</td>
        <td>${message.macAddress}</td>
        <td>${message.status}</td>
        <td>${message.timestamp}</td>
        <td><input type="checkbox" class="message-checkbox" data-id="${message._id}"></td>
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
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages} - Displaying ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
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

  deleteButton.addEventListener('click', async () => {
    smoothScrollToTop();
    if (selectedMessages.size === 0) return;

    const ids = Array.from(selectedMessages);
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch('/api/mqtt/api/messages/status', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ids })
      });
      const data = await response.json();
      if (data.message === 'Status messages deleted successfully') {
        showTimedAlert(alertContainer, "Selected messages deleted successfully.", "success");
        selectedMessages.clear();
      } else {
        showTimedAlert(alertContainer, "Failed to delete messages", "alert");
      }
    } catch (error) {
      console.error('Error:', error);
      showTimedAlert(alertContainer, "An error occurred while deleting messages.", "alert");
    }
  });

  pageSizeSelect.addEventListener('change', () => {
    pageSize = parseInt(pageSizeSelect.value);
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
