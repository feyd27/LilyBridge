import { fetchWithAuth } from "./authFetch.js";
document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');

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
    let pageSize = parseInt(pageSizeSelect.value);
    let totalPages = 1;

    function fetchAndDisplayMessages() {
        const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
        fetchWithAuth(`/api/mqtt/api/messages/errors?page=${currentPage}&limit=${pageSize}`, {
            headers: {
                'Authorization': `Bearer ${token}`  // Add Authorization header
            }
        })
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
        const container = document.getElementById('errorMessagesTable');
        container.innerHTML = '';
        messages.forEach(message => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${message.message}</td>
                <td>${new Date(message.receivedAt).toLocaleString()}</td>
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
