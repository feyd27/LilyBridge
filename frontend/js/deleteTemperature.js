// deleteTemperature.js

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');
    const container = document.getElementById('temperatureMessagesContainer');
    const deleteButton = document.getElementById('deleteSelectedTemperature');
    const alertContainer = document.getElementById('alertContainer');

    if (!container) {
        console.error('Error: Container for temperature messages not found');
        return;
    }

    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;

    function fetchAndDisplayMessages() {
        fetch(`/api/messages/temperature?page=${currentPage}&limit=${pageSize}`)
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
            row.innerHTML = `
                <td>${message.chipID}</td>
                <td>${message.macAddress}</td>
                <td>${message.temperature}°C</td>
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

    if (deleteButton) {
        deleteButton.addEventListener('click', (event) => {
            event.preventDefault();

            const checkedBoxes = Array.from(document.querySelectorAll('#temperatureMessagesContainer input[name="selectMessage"]:checked'));
            if (checkedBoxes.length === 0) {
                showAlert("Please select at least one message to delete.", "alert");
                return;
            }

            const ids = checkedBoxes.map(box => box.value);
            fetch('/api/messages/temperature', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Temperature messages deleted successfully') {
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
        console.error("Delete button with ID 'deleteSelectedTemperature' not found");
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
