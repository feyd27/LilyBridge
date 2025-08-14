// temperature.js

import { fetchWithAuth } from "./authFetch.js";
document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    const container = document.querySelector('#temperatureMessagesContainer tbody');

    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;
    
    function formatTimestamp(ts) {
        const d = new Date(ts);
        // locale date, e.g. “8/4/2025” or “04.08.2025” depending on user locale
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
        const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
        fetchWithAuth(`/api/mqtt/api/messages/temperature?page=${currentPage}&limit=${pageSize}`, {
            headers: {
                'Authorization': `Bearer ${token}`  // Add Authorization header
            }
        })
            .then(response => response.json())
            .then(data => {
                displayTemperatureMessages(data.messages);
                totalPages = data.totalPages;
                updatePaginationDisplay(data.totalItems, totalPages, currentPage);
                updateButtonStates();
            })
            .catch(error => console.error('Error fetching temperature messages:', error));
    }

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
        `;
        container.appendChild(row);
    });
}
    function updatePaginationDisplay(totalItems, totalPages, currentPage) {
        paginationInfo.textContent = `Page ${currentPage} of ${totalPages} - Displaying ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
    }

    function updateButtonStates() {
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

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
