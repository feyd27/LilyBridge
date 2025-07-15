// deleteTemperature.js
import { fetchWithAuth } from './authFetch.js';
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
        
    function checkAuthentication() {
        const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
            fetchWithAuth('/api/auth/status', {
                headers: {
                    'Authorization': `Bearer ${token}`  // Add Authorization header
                }
            })
              .then(response => {
                if (!response.ok) {
                  window.location.href = '/login';
                }
              })
              .catch(error => {
                console.error('Error checking authentication status:', error);
                // Handle the error, e.g., show an error message or redirect to login
              });
          }
    checkAuthentication();


    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value, 10);
    let totalPages = 1;

    function fetchAndDisplayMessages() {
        console.log(`Fetching page ${currentPage} with page size ${pageSize}`);
        const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
        fetchWithAuth(`/api/mqtt/api/messages/temperature?page=${currentPage}&limit=${pageSize}`, {
            headers: {
                'Authorization': `Bearer ${token}`  // Add Authorization header
            }
        })
            .then(response => response.json())
            .then(data => {
                console.log(`Data received for page ${currentPage}:`, data);
                displayTemperatureMessages(data.messages);
                totalPages = data.totalPages || Math.ceil(data.totalItems / pageSize);
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

    // Change page size and reload data
    pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value, 10);
        currentPage = 1; // Reset to first page on page size change
        console.log(`Page size changed to ${pageSize}. Resetting to page 1.`);
        fetchAndDisplayMessages();
    });

    // Navigate to next page
    nextPageBtn.addEventListener('click', () => {
        event.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            console.log(`Navigating to next page: ${currentPage}`);
            fetchAndDisplayMessages();
        }
    });

    // Navigate to previous page
    prevPageBtn.addEventListener('click', () => {
        event.preventDefault(); 
        if (currentPage > 1) {
            currentPage--;
            console.log(`Navigating to previous page: ${currentPage}`);
            fetchAndDisplayMessages();
        }
    });

    // Initial data fetch
    fetchAndDisplayMessages();

    // Handle deletion
    if (deleteButton) {
        deleteButton.addEventListener('click', (event) => {
            event.preventDefault();

            const checkedBoxes = Array.from(document.querySelectorAll('#temperatureMessagesContainer input[name="selectMessage"]:checked'));
            if (checkedBoxes.length === 0) {
                showAlert("Please select at least one message to delete.", "alert");
                smoothScrollToTop();
                return;
            }

            const ids = checkedBoxes.map(box => box.value);
            console.log(`Deleting selected messages with IDs: ${ids}`);
            const token = localStorage.getItem('accessToken');
            fetchWithAuth('/api/mqtt/api/messages/temperature', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({ ids })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Temperature messages deleted successfully') {
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
        console.error("Delete button with ID 'deleteSelectedTemperature' not found");
    }
    // Smooth scroll to the top of the page
function smoothScrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}
    // Show alerts in the UI
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
