// selectTemperature.js

import { fetchWithAuth } from "./authFetch.js";

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    const container = document.getElementById('temperatureMessagesContainer');
    const batchUploadCheckbox = document.getElementById('batchUpload');
    const uploadToIotaBtn = document.getElementById('uploadToIotaBtn');
    const batchStatus = document.getElementById('batchStatus');
    const selectedCount = document.getElementById('selectedCount');
    const alertContainer = document.getElementById('alertContainer');

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
        fetchWithAuth(`/api/mqtt/api/messages/temperature?page=${currentPage}&limit=${pageSize}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            displayTemperatureMessages(data.messages);
            totalPages = data.totalPages;
            updatePaginationDisplay(data.totalItems, totalPages, currentPage);
            updateButtonStates();
            updateUploadButtonState();
            updateSelectedCount();
        })
        .catch(error => console.error('Error fetching temperature messages:', error));
    }

    function displayTemperatureMessages(messages) {
        container.innerHTML = '';
        messages.forEach(message => {
            const row = document.createElement('tr');
            const isChecked = selectedMessages.has(message._id);

            row.innerHTML = `
                <td>${message.chipID}</td>
                <td>${message.macAddress}</td>
                <td>${message.temperature}°C</td>
                <td>${new Date(message.timestamp).toLocaleString()}</td>
                <td>
                    <input type="checkbox" class="message-checkbox" data-id="${message._id}" ${isChecked ? 'checked' : ''} ${batchUploadCheckbox.checked ? 'disabled' : ''}>
                </td>
            `;
            container.appendChild(row);
        });

        container.querySelectorAll('.message-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const messageId = e.target.dataset.id;
                if (e.target.checked) selectedMessages.add(messageId);
                else selectedMessages.delete(messageId);
                updateUploadButtonState();
                updateSelectedCount();
            });
        });
    }

    function updatePaginationDisplay(totalItems, totalPages, currentPage) {
        paginationInfo.textContent = `Page ${currentPage} of ${totalPages} - Displaying ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
    }

    function updateButtonStates() {
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    function updateUploadButtonState() {
        const mode = batchUploadCheckbox.checked ? 'batch' : 'selected';
        const hasSelection = selectedMessages.size > 0;
        uploadToIotaBtn.disabled = (mode === 'selected' && !hasSelection);
    }

    function updateSelectedCount() {
        selectedCount.textContent = `Selected: ${selectedMessages.size} message${selectedMessages.size !== 1 ? 's' : ''}`;
    }

    batchUploadCheckbox.addEventListener('change', () => {
        const allRowCheckboxes = container.querySelectorAll('.message-checkbox');
        if (batchUploadCheckbox.checked) {
            allRowCheckboxes.forEach(cb => cb.disabled = true);
            batchStatus.style.display = 'inline';
        } else {
            allRowCheckboxes.forEach(cb => cb.disabled = false);
            batchStatus.style.display = 'none';
        }
        updateUploadButtonState();
        updateSelectedCount();
    });

    uploadToIotaBtn.addEventListener('click', async () => {
        smoothScrollToTop();
        const mode = batchUploadCheckbox.checked ? 'batch' : 'selected';
        const messageIds = mode === 'selected' ? Array.from(selectedMessages) : [];

        if (mode === 'selected' && messageIds.length === 0) {
            showTimedAlert(alertContainer, 'Please select at least one message or enable batch upload.', 'alert');
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetchWithAuth('/api/upload/iota', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ mode, messageIds })
            });

            if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

            const result = await response.json();
            showTimedAlert(alertContainer, `Upload successful! Batches: ${result.batches.length}`, 'success');
            selectedMessages.clear();
        } catch (err) {
            console.error('Upload error:', err);
            showTimedAlert(alertContainer, 'Upload failed. Please try again.', 'alert');
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
