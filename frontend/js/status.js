document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');

    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;

    // Fetch and display messages
    function fetchAndDisplayMessages() {
        fetch(`/api/messages/status?page=${currentPage}&limit=${pageSize}`)
            .then(response => response.json())
            .then(data => {
                if (data.messages.length === 0) {
                    paginationInfo.textContent = "No messages to display.";
                    return;
                }
                displayStatusMessages(data.messages);
                totalPages = data.totalPages;
                updatePaginationDisplay(data.totalItems, totalPages, currentPage);
                updateButtonStates();
            })
            .catch(error => console.error('Error fetching status messages:', error));
    }

    // Display messages in the table
    function displayStatusMessages(messages) {
        const container = document.getElementById('statusMessagesTable');
        container.innerHTML = '';
        messages.forEach(message => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${message.chipID || 'N/A'}</td>
                <td>${message.macAddress || 'N/A'}</td>
                <td>${message.status || 'N/A'}</td>
                <td>${new Date(message.timestamp).toLocaleString('en-GB')}</td>
            `;
            container.appendChild(row);
        });
    }

    // Update pagination display info
    function updatePaginationDisplay(totalItems, totalPages, currentPage) {
        paginationInfo.textContent = `Page ${currentPage} of ${totalPages} - Displaying ${Math.min(pageSize, totalItems)} of ${totalItems} messages`;
    }

    // Enable/Disable buttons based on the current page
    function updateButtonStates() {
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    // Event listeners for page size and pagination controls
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

    // Initial data fetch
    fetchAndDisplayMessages();
});
