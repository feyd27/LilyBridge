// // deleteStatus.js

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    const container = document.getElementById('statusMessagesContainer');
    const deleteButton = document.getElementById('deleteSelectedStatus');
    const alertContainer = document.getElementById('alertContainer');

    if (!container) {
        console.error('Error: Container for status messages not found');
        return;
    }

    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;

    function fetchAndDisplayMessages() {
        console.log(`Fetching page ${currentPage} with page size ${pageSize}`);
        
        fetch(`/api/messages/status?page=${currentPage}&limit=${pageSize}`)
            .then(response => response.json())
            .then(data => {
                displayStatusMessages(data.messages);
                totalPages = data.totalPages;
                updatePaginationDisplay(data.totalItems, totalPages, currentPage);
                updateButtonStates();
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
                <td>${new Date(message.timestamp).toLocaleString()}</td>
                <td>
                    <input type="checkbox" name="selectMessage" value="${message._id}">
                    <input type="hidden" name="messageId" value="${message._id}">
                </td>
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
        currentPage = 1; // Reset to first page when page size changes
        fetchAndDisplayMessages();
    });

    // Event listeners for pagination buttons with debug logs
    nextPageBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent form submission if inside a form
        if (currentPage < totalPages) {
            currentPage++;
            console.log(`Next page clicked. New currentPage is ${currentPage}`);
            fetchAndDisplayMessages();
        }
    });

    prevPageBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent form submission if inside a form
        if (currentPage > 1) {
            currentPage--;
            console.log(`Previous page clicked. New currentPage is ${currentPage}`);
            fetchAndDisplayMessages();
        }
    });

    // Initial fetch
    fetchAndDisplayMessages();

    if (deleteButton) {
        deleteButton.addEventListener('click', (event) => {
            event.preventDefault();

            const checkedBoxes = Array.from(document.querySelectorAll('#statusMessagesContainer input[name="selectMessage"]:checked'));
            if (checkedBoxes.length === 0) {
                showAlert("Please select at least one message to delete.", "alert");
                setTimeout(() => location.reload(), 1500);
                return;
            }

            const ids = checkedBoxes.map(box => box.value);
            fetch('/api/messages/status', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Status messages deleted successfully') {
                        showAlert("Selected messages deleted successfully.", "success");
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        showAlert("Failed to delete messages", "alert");
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert("An error occurred while deleting messages.", "alert");
                });
        });
    } else {
        console.error("Delete button with ID 'deleteSelectedStatus' not found");
    }

    function showAlert(message, type) {
        if (!alertContainer) {
            console.error('Alert container not found');
            return;
        }
        alertContainer.className = `callout ${type}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        console.log('Alert displayed:', message);
    }
});
