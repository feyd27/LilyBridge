
// frontend/js/main.js
// import { formatDate } from './utils.js';
// document.addEventListener('DOMContentLoaded', () => {
//     fetch('/api/messages/temperature')
//       .then(response => response.json())
//       .then(data => {
//         console.log('Fetched Data:', data);  // Debugging line
//         displayTemperatureMessages(data.messages);
//       })
//       .catch(error => console.error('Error fetching temperature messages:', error));
//   });
  
//   function displayTemperatureMessages(messages) {
//     console.log('Messages to Display:', messages);  // Debugging line
//      // Check if messages is an array
//   if (!Array.isArray(messages)) {
//     console.error('Expected an array, got:', messages);
//     return;
//   }
//     const container = document.getElementById('temperatureMessagesContainer');
//     container.innerHTML = ''; // Clear existing content before adding new data
//     if (!container) {
//         console.error('Container element not found');  // Debugging line
//       }
//     messages.forEach(message => {
//       const messageDiv = document.createElement('div');
//       messageDiv.className = 'message';
//      // const formattedTimestamp = formatDate(message.timestamp);
//       messageDiv.innerHTML = `
//         <p><strong>Board ID:</strong> ${message.chipID} | <strong>MAC:</strong> ${message.macAddress}</p>
//         <p><strong>Temperature:</strong> ${message.temperature}°C</p>
//         <p><strong>Time:</strong> ${new Date(message.timestamp).toLocaleString()}</p>
//       `;
//       container.appendChild(messageDiv);
//     });
//   };




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
// document.addEventListener('DOMContentLoaded', () => {
//   // Fetch and display temperature messages
//   fetch('/api/messages/temperature')
//     .then(response => response.json())
//     .then(data => {
//       console.log('Fetched Temperature Data:', data);  // Debugging line
//       displayTemperatureMessages(data.messages);
//     })
//     .catch(error => console.error('Error fetching temperature messages:', error));

//   // Fetch and display error messages
//   fetch('/api/messages/error/today')
//     .then(response => response.json())
//     .then(data => {
//       console.log('Fetched Error Data:', data);  // Debugging line
//       displayErrorMessages(data);
//     })
//     .catch(error => console.error('Error fetching error messages:', error));
// });

// // Function to display temperature messages
// function displayTemperatureMessages(messages) {
//   const container = document.getElementById('temperatureMessagesContainer');
//   container.innerHTML = ''; // Clear existing content before adding new data

//   messages.forEach(message => {
//     const messageDiv = document.createElement('div');
//     messageDiv.className = 'message';
//     messageDiv.innerHTML = `
//       <p><strong>Board ID:</strong> ${message.chipID} | <strong>MAC:</strong> ${message.macAddress}</p>
//       <p><strong>Temperature:</strong> ${message.temperature}°C</p>
//       <p><strong>Time:</strong> ${new Date(message.timestamp).toLocaleString()}</p>
//     `;
//     container.appendChild(messageDiv);
//   });
// }

// // Function to display error messages (no MAC address)
// function displayErrorMessages(messages) {
//   const container = document.getElementById('errorMessagesContainer');

//   if (!container) {
//     console.error('Error: Element with ID "errorMessagesContainer" not found.');
//     return;
//   }

//   container.innerHTML = ''; // Clear existing content before adding new data

//   messages.forEach(message => {
//     const messageDiv = document.createElement('div');
//     messageDiv.className = 'message';
//     const receivedAt = new Date(message.receivedAt).toLocaleString();
//     messageDiv.innerHTML = `
//       <p><strong>Error Message:</strong> ${message.message}</p>
//       <p><strong>Received At:</strong> ${receivedAt}</p>
//     `;
//     container.appendChild(messageDiv);
//   });
// }
document.addEventListener('DOMContentLoaded', () => {
  fetchTemperatureMessages(25, 1); // Default page size of 25, starting at page 1
  fetchErrorMessages();
});

// Fetch and display temperature messages with pagination
function fetchTemperatureMessages(pageSize, page) {
  fetch(`/api/messages/temperature?page=${page}&pageSize=${pageSize}`)
    .then(response => response.json())
    .then(data => {
      displayTemperatureMessages(data.messages);
      setupPaginationControls(data.totalPages, page, pageSize);
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

// Set up pagination controls for temperature messages
function setupPaginationControls(totalPages, currentPage, pageSize) {
  const paginationDiv = document.getElementById('temperaturePagination');
  paginationDiv.innerHTML = ''; // Clear previous controls

  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.value = currentPage;
  pageInput.min = 1;
  pageInput.max = totalPages;
  pageInput.addEventListener('change', () => fetchTemperatureMessages(pageSize, pageInput.value));
  
  const sizeInput = document.createElement('select');
  [25, 50, 100].forEach(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = `${size} rows`;
    if (size === pageSize) option.selected = true;
    sizeInput.appendChild(option);
  });
  sizeInput.addEventListener('change', () => fetchTemperatureMessages(sizeInput.value, currentPage));
  
  paginationDiv.appendChild(pageInput);
  paginationDiv.appendChild(sizeInput);
}

// Fetch and display error messages
function fetchErrorMessages() {
  fetch('/api/messages/error/today')
    .then(response => response.json())
    .then(data => {
      displayErrorMessages(data);
    })
    .catch(error => console.error('Error fetching error messages:', error));
}

function displayErrorMessages(messages) {
  const tableBody = document.getElementById('errorTable').querySelector('tbody');
  tableBody.innerHTML = ''; // Clear existing rows

  messages.forEach(message => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${message.message}</td>
      <td>${new Date(message.receivedAt).toLocaleDateString('en-GB')} ${new Date(message.receivedAt).toLocaleTimeString('en-GB')}</td>
    `;
    tableBody.appendChild(row);
  });
}
