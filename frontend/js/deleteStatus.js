document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');

    let currentPage = 1;
    let pageSize = pageSizeSelect ? parseInt(pageSizeSelect.value) : 25;
    let totalPages = 1;

    // Ensure pageSizeSelect is present before adding event listeners
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', () => {
            pageSize = parseInt(pageSizeSelect.value);
            currentPage = 1; // Reset to first page
            fetchAndDisplayMessages();
        });
    }
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
            
                const container = document.getElementById('statusMessagesTable');
                
                if (!container) {
                    console.error('Table body "statusMessagesTable" not found.');
                    return;
                }
    }

    // Display messages in the table with "Select" column
    function displayStatusMessages(messages) {
        const container = document.getElementById('statusMessagesTable');
        console.log('Container element: ', container);
        if (!container) {
            console.error('Table body "statusMessagesTable" not found.');
            return;
        }
        container.innerHTML = '';

        if (!messages || messages.length === 0) {
            console.warn('No status messages to display');
            container.innerHTML = '<tr><td colspan ="5">No status messages available.</td></tr>';
            return;
        }
        messages.forEach(message => {
            const row = document.createElement('tr');
            row.innerHTML = `
               
                <td>${message.chipID || 'N/A'}</td>
                <td>${message.macAddress || 'N/A'}</td>
                <td>${message.status || 'N/A'}</td>
                <td>${new Date(message.timestamp).toLocaleString('en-GB')}</td>
                 <td><input type="checkbox" name="selectMessage" value="${message._id}" >
                    <input type="hidden" value="${message._id}">
                </td>
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

    // Handle delete action for selected messages
    document.getElementById('deleteSelectedStatus').addEventListener('click', async (event) => {
        event.preventDefault(); // Prevent the default form submission

        const form = document.getElementById('statusForm');
        const checkedBoxes = Array.from(form.querySelectorAll('input[type="checkbox"]:checked'));

        if (checkedBoxes.length === 0) {
            alert("Please select at least one message to delete.");
            return;
        }

        const ids = checkedBoxes.map(box => box.nextElementSibling.value);

        // Perform a DELETE request with the selected IDs
        try {
            const response = await fetch('/api/messages/status', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids }),
            });

            if (response.ok) {
                alert("Selected messages deleted successfully.");
                fetchAndDisplayMessages(); // Refresh the table
            } else {
                const error = await response.json();
                console.error('Failed to delete messages:', error.message || 'Server error');
                alert('Failed to delete messages');
            }
        } catch (error) {
            console.error('Error deleting messages:', error);
            alert('Failed to delete messages');
        }
    });
});

    // // Event listeners for page size and pagination controls
    // pageSizeSelect.addEventListener('change', () => {
    //     pageSize = parseInt(pageSizeSelect.value);
    //     currentPage = 1;
    //     fetchAndDisplayMessages();
    // });

    // nextPageBtn.addEventListener('click', () => {
    //     if (currentPage < totalPages) {
    //         currentPage++;
    //         fetchAndDisplayMessages();
    //     }
    // });

    // prevPageBtn.addEventListener('click', () => {
    //     if (currentPage > 1) {
    //         currentPage--;
    //         fetchAndDisplayMessages();
    //     }
    // });

    // Initial data fetch
    fetchAndDisplayMessages();

document.getElementById('status-tab').addEventListener('click', () => {
    fetchAndDisplayMessages();
});