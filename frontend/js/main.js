
// frontend/js/main.js

  document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/messages/status/last')
     .then(response => response.json())
      .then(data => {
        console.log('Fetched Data:', data);  // Debugging line
        displayLastStatusMessage(data);  // Pass the message object to the display function
      })
      .catch(error => console.error('Error fetching status message:', error));
});

function displayLastStatusMessage(message) {
    console.log('Message to Display:', message);  // Check structure of `message` object

    const container = document.getElementById('statusMessagesContainer');
    container.innerHTML = ''; // Clear any existing content
    if (!container) {
        console.error('Container element not found');  
        return;
    }

    // Check if the properties exist in `message`
    const chipID = message.chipID || 'Unknown';
    const macAddress = message.macAddress || 'Unknown';
    const status = message.status || 'Unknown';
    const timestamp = message.timestamp || 'Unknown';

    // Display the message details
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
      <p><strong>Board ID:</strong> ${chipID} | <strong>MAC:</strong> ${macAddress}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Time:</strong> ${timestamp}</p>
    `;
    container.appendChild(messageDiv);
}

document.addEventListener('DOMContentLoaded', () => {
  fetchTemperatureMessages(25, 1); // Default page size of 25, starting at page 1
  fetchErrorMessages();
});

document.addEventListener('DOMContentLoaded', () => {
  let currentPage = 1;
  const pageSizeSelector = document.getElementById('pageSize');
  const prevPageButton = document.getElementById('prevPage');
  const nextPageButton = document.getElementById('nextPage');

  // Fetch and display messages based on current page and page size
  function fetchAndDisplayMessages() {
    const pageSize = parseInt(pageSizeSelector.value, 10);
    fetchTemperatureMessages(pageSize, currentPage);
  }

  // Event listener for page size change
  pageSizeSelector.addEventListener('change', () => {
    currentPage = 1; // Reset to the first page
    fetchAndDisplayMessages();
  });

  // Event listener for previous and next page buttons
  prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchAndDisplayMessages();
    }
  });

  nextPageButton.addEventListener('click', () => {
    currentPage++;
    fetchAndDisplayMessages();
  });

  // Initial fetch with default values
  fetchAndDisplayMessages();
});

function fetchTemperatureMessages(pageSize, page) {
  fetch(`/api/messages/temperature?limit=${pageSize}&page=${page}`)
    .then(response => response.json())
    .then(data => {
      displayTemperatureMessages(data.messages);
    })
    .catch(error => console.error('Error fetching temperature messages:', error));
}

function displayTemperatureMessages(messages) {
  const tableBody = document.getElementById('temperatureTable')?.querySelector('tbody');
  if (!tableBody) {
    console.error('Temperature table not found');
    return;
  }
  tableBody.innerHTML = ''; // Clear existing rows

  messages.forEach(message => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${message.chipID}</td>
      <td>${message.macAddress}</td>
      <td>${message.temperature}°C</td>
      <td>${new Date(message.timestamp).toLocaleDateString('en-GB')} ${new Date(message.timestamp).toLocaleTimeString('en-GB')}</td>
      <td></td>
      <td></td>
    `;
    tableBody.appendChild(row);
  });
}
function fetchErrorMessages() {
  fetch('/api/messages/error/today')  // Adjust this to your actual endpoint if different
    .then(response => response.json())
    .then(data => {
      console.log('Fetched Error Data:', data);  // Debugging line
      displayErrorMessages(data);
    })
    .catch(error => console.error('Error fetching error messages:', error));
}

function displayErrorMessages(messages) {
  const container = document.getElementById('errorTable').querySelector('tbody');
  if (!container) {
      console.error('Error Table tbody element not found');
      return;
  }

  container.innerHTML = ''; // Clear previous data

  messages.forEach(message => {
      const row = document.createElement('tr');
      row.innerHTML = `
          <td>${message.message}</td>
          <td>${new Date(message.receivedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
      `;
      container.appendChild(row);
  });
}