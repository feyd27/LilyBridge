// deleteError.js

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    const container = document.getElementById('errorMessagesContainer');
    const deleteButton = document.getElementById('deleteSelectedError');
    const alertContainer = document.getElementById('alertContainer');

    if (!container) {
        console.error('Error: Container for error messages not found');
        return;
    }

    // Initialize `currentPage` once at the top-level scope
    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;

    function fetchAndDisplayMessages() {
        console.log(`Fetching page ${currentPage} with page size ${pageSize}`);
        
        fetch(`/api/messages/errors?page=${currentPage}&limit=${pageSize}`)
            .then(response => response.json())
            .then(data => {
                displayErrorMessages(data.messages);
                totalPages = data.totalPages;
                updatePaginationDisplay(data.totalItems, totalPages, currentPage);
                updateButtonStates();
            })
            .catch(error => console.error('Error fetching error messages:', error));
    }

    function displayErrorMessages(messages) {
        container.innerHTML = '';
        messages.forEach(message => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${message.message}</td>
                <td>${new Date(message.receivedAt).toLocaleString()}</td>
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

    // Listen for page size changes and reset to first page
    pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1; // Reset to first page on page size change
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

        const checkedBoxes = Array.from(document.querySelectorAll('#errorMessagesContainer input[name="selectMessage"]:checked'));
        if (checkedBoxes.length === 0) {
            showAlert("Please select at least one message to delete.", "alert");
            smoothScrollToTop();
            return;
        }

        const ids = checkedBoxes.map(box => box.value);
        fetch('/api/messages/errors', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Error messages deleted successfully') {
                    showAlert("Selected messages deleted successfully.", "success");
                    smoothScrollToTop();
                    setTimeout(() => location.reload(), 2500);
                } else {
                    showAlert("Failed to delete messages", "alert");
                    smoothScrollToTop();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert("An error occurred while deleting messages.", "alert");
            });
    });
} else {
    console.error("Delete button with ID 'deleteSelectedError' not found");
}

// Smooth scroll to the top of the page
function smoothScrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}
function showAlert(message, type) {
    if (!alertContainer) {
        console.error('Alert container not found');
        return;
    }
    alertContainer.className = `callout ${type} show`;
    alertContainer.textContent = message;
    alertContainer.style.display = 'block';
    console.log('Alert displayed:', message);
}
});