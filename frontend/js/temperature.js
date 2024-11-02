// temperature.js

document.addEventListener('DOMContentLoaded', () => {

    const pageSizeSelect = document.getElementById('pageSize');
    if (!pageSizeSelect) {
        console.error("Element with id 'pageSize' not found.");
        return;
    }
    //const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');

    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;

    // Fetch messages and update the display
    function fetchAndDisplayMessages() {
        fetch(`/api/messages/temperature?page=${currentPage}&limit=${pageSize}`)
            .then(response => response.json())
            .then(data => {
                displayTemperatureMessages(data.messages);
                totalPages = data.totalPages;
                updatePaginationDisplay(data.totalItems, totalPages, currentPage);
                updateButtonStates();  // Update button states based on current page
            })
            .catch(error => console.error('Error fetching temperature messages:', error));
    }

    // Display messages in the table
    function displayTemperatureMessages(messages) {
        const container = document.querySelector('#temperatureMessagesContainer tbody');
        container.innerHTML = '';
        messages.forEach(message => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${message.chipID}</td>
                <td>${message.macAddress}</td>
                <td>${message.temperature}°C</td>
                <td>${new Date(message.timestamp).toLocaleString()}</td>
            `;
            container.appendChild(row);
        });
    }

    // Update pagination display information
    function updatePaginationDisplay(totalItems, totalPages, currentPage) {
        paginationInfo.textContent = `Page ${currentPage} of ${totalPages} - Displaying ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
    }

    // Update button states based on current page
    function updateButtonStates() {
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    // Event listener for page size change
    pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1; // Reset to first page when page size changes
        fetchAndDisplayMessages();
    });

    // Event listeners for pagination buttons
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

    // Initial fetch
    fetchAndDisplayMessages();
});
