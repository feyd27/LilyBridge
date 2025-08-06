import { fetchWithAuth } from "./authFetch.js";

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect   = document.getElementById('pageSize');
    const prevPageBtn      = document.getElementById('prevPage');
    const nextPageBtn      = document.getElementById('nextPage');
    const paginationInfo   = document.getElementById('paginationInfo');
    const container        = document.getElementById('temperatureMessagesContainer');
    const uploadToIotaBtn  = document.getElementById('uploadToSignumBtn');
    const alertContainer   = document.getElementById('alertContainer');
    const selectedCount    = document.getElementById('selectedCount');

    let currentPage = 1;
    let pageSize    = parseInt(pageSizeSelect.value, 10);
    let totalPages  = 1;
    let selectedMessages = new Set();

    function smoothScrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showTimedAlert(message, type = 'success') {
        alertContainer.className = `callout ${type}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        setTimeout(() => alertContainer.style.display = 'none', 3000);
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

    function updateSelectedCount() {
        selectedCount.textContent = `Selected: ${selectedMessages.size}`;
    }

    function updateUploadButtonState() {
        uploadToSignumBtn.disabled = selectedMessages.size === 0;
    }

    function updatePaginationDisplay(totalItems, totalPages, currentPage) {
        paginationInfo.textContent =
            `Page ${currentPage} of ${totalPages} — Showing ${Math.min(pageSize, totalItems)} of ${totalItems}`;
    }

    function updateButtonStates() {
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    function displayTemperatureMessages(messages) {
        container.innerHTML = '';
        messages.forEach(msg => {
            const isChecked   = selectedMessages.has(msg._id) ? 'checked' : '';
            const uploadIcon  = msg.uploadedToSignum
                ? `<span style="color: green;">&#10004;</span>`
                : `<span style="color: red;">&#10060;</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${msg.chipID}</td>
                <td>${msg.macAddress}</td>
                <td>${msg.temperature}°C</td>
                <td>${formatTimestamp(msg.timestamp)}</td>
                <td>${uploadIcon}</td>
                <td>
                  <input
                    type="checkbox"
                    class="message-checkbox"
                    data-id="${msg._id}"
                    ${isChecked}
                  >
                </td>
            `;
            container.appendChild(row);
        });

        // wire up the checkboxes
        container.querySelectorAll('.message-checkbox').forEach(cb => {
            cb.addEventListener('change', e => {
                const id = e.target.dataset.id;
                if (e.target.checked) selectedMessages.add(id);
                else selectedMessages.delete(id);

                updateUploadButtonState();
                updateSelectedCount();
            });
        });

        // after redraw, make sure button + count are correct
        updateUploadButtonState();
        updateSelectedCount();
    }

    async function fetchAndDisplayMessages() {
        try {
            const res  = await fetchWithAuth(
                `/signum/temperature-extended?page=${currentPage}&limit=${pageSize}`
            );
            const data = await res.json();
            displayTemperatureMessages(data.messages);
            totalPages = data.totalPages;
            updatePaginationDisplay(data.totalItems, totalPages, currentPage);
            updateButtonStates();
        } catch (err) {
            console.error('Error fetching temperature messages:', err);
        }
    }

    uploadToSignumBtn.addEventListener('click', async () => {
        if (selectedMessages.size === 0) {
            showTimedAlert('Please select at least one message to upload.', 'alert');
            return;
        }
        try {
            const body = { messageIds: Array.from(selectedMessages) };
            const res  = await fetchWithAuth('/signum/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            smoothScrollToTop();
            showTimedAlert(`Upload successful! Block ID: ${json.blockId}`);
            selectedMessages.clear();
            fetchAndDisplayMessages();
        } catch (err) {
            console.error('Upload error:', err);
            showTimedAlert('Upload failed. Please try again.', 'alert');
        }
    });
    
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

    // initialize
    updateSelectedCount();
    fetchAndDisplayMessages();
});