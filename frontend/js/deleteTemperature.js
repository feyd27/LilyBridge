import { fetchWithAuth } from './authFetch.js';

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    const container = document.getElementById('temperatureMessagesContainer');
    const deleteButton = document.getElementById('deleteSelectedTemperature');
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

    function formatTimestamp(ts) {
        const d = new Date(ts);
        // locale date (e.g. "8/4/2025" or "04.08.2025")
        const datePart = d.toLocaleDateString();
        // force 24-hour time with seconds
        const timePart = d.toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return `${datePart} ${timePart}`;
    }

    function fetchAndDisplayMessages() {
        const token = localStorage.getItem('accessToken');
        fetchWithAuth(`/api/mqtt/api/messages/temperature?page=${currentPage}&limit=${pageSize}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => response.json())
            .then(data => {
                displayTemperatureMessages(data.messages);
                totalPages = data.totalPages || Math.ceil(data.totalItems / pageSize);
                updatePaginationDisplay(data.totalItems, totalPages, currentPage);
                updateButtonStates();
                updateDeleteButtonState();
            })
            .catch(error => console.error('Error fetching temperature messages:', error));
    }

    // function displayTemperatureMessages(messages) {
    //     container.innerHTML = '';
    //     messages.forEach(message => {
    //         const row = document.createElement('tr');
    //         row.innerHTML = `
    //             <td>${message.chipID}</td>
    //             <td>${message.macAddress}</td>
    //             <td>${message.temperature}°C</td>
    //             <td>${formatTimestamp(message.timestamp)}</td>
    //             <td><input type="checkbox" class="message-checkbox" data-id="${message._id}"></td>
    //         `;
    //         container.appendChild(row);
    //     });

    //     container.querySelectorAll('.message-checkbox').forEach(checkbox => {
    //         checkbox.addEventListener('change', (e) => {
    //             const id = e.target.dataset.id;
    //             if (e.target.checked) selectedMessages.add(id);
    //             else selectedMessages.delete(id);
    //             updateDeleteButtonState();
    //         });
    //     });
    //     updateSelectedCount();
    // }

    function displayTemperatureMessages(messages) {
        container.innerHTML = '';
        messages.forEach(message => {
            const row = document.createElement('tr');

            // Check if temperature is a valid number, then format to 2 decimal places.
            // If not, display 'N/A'.
            const formattedTemp = typeof message.temperature === 'number'
                ? message.temperature.toFixed(2)
                : 'N/A';

            row.innerHTML = `
            <td>${message.chipID}</td>
            <td>${message.macAddress}</td>
            <td>${formattedTemp}°C</td>
            <td>${formatTimestamp(message.timestamp)}</td>
            <td><input type="checkbox" class="message-checkbox" data-id="${message._id}"></td>
        `;
            container.appendChild(row);
        });

        container.querySelectorAll('.message-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
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

    deleteButton.addEventListener('click', async (event) => {
        event.preventDefault();
        smoothScrollToTop();

        if (selectedMessages.size === 0) return;
        const ids = Array.from(selectedMessages);

        const token = localStorage.getItem('accessToken');
        try {
            const response = await fetchWithAuth('/api/mqtt/api/messages/temperature', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ids })
            });
            const data = await response.json();
            if (data.message === 'Temperature messages deleted successfully') {
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
        pageSize = parseInt(pageSizeSelect.value, 10);
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
