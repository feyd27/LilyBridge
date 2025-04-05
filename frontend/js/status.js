document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const paginationInfo = document.getElementById('paginationInfo');

    function checkAuthentication() {
        const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
        // if (token) {
        //   console.log('Access token:', token);
        // } else {
        //   console.log('Access token not found.');
        // }
        fetch('/api/auth/status', {
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

    // Fetch and display messages
    function fetchAndDisplayMessages() {
        const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
        // if (token) {
        // console.log('Access token:', token);
        // } else {
        // console.log('Access token not found.');
        // }
        fetch(`/api/mqtt/api/messages/status?page=${currentPage}&limit=${pageSize}`, {
            headers: {
                'Authorization': `Bearer ${token}`  // Add Authorization header
            }
        })
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
                <td>${message.timestamp}</td>
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
