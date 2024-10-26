let temperatureChartInstance = null;  // To keep track of the chart instance

// Function to create the temperature chart
function createTemperatureChart(data) {
    const ctx = document.getElementById('temperatureChart').getContext('2d');

    // Destroy the existing chart if it exists
    if (temperatureChartInstance !== null) {
        temperatureChartInstance.destroy();
    }

    // Create a new chart
    temperatureChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels, // Time labels or X-axis data
            datasets: [{
                label: 'Temperature (°C)',
                data: data.temperatures, // Y-axis temperature data
                borderWidth: 2,
                borderColor: 'rgba(78, 97, 255, 1)',
                backgroundColor: 'rgba(250, 236, 142, 0.5)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Last 50 messages',
                color: '#000',
                font: {
                  family: 'Helvetica',
                  weight: 'bold'
                }
              },
              legend: {
                labels: {
                  color: '#000',
                  font: {
                    family: 'Helvetica',
                    size: 12
                  }
                }
              },
              tooltip: {
                bodyFont: {
                  family: 'Helvetica',
                  size: 14
                },
                titleFont: {
                  family: 'Helvetica',
                  size: 14
                },
                backgroundColor: 'rgba(68, 110, 255, 0.8)',
                bodyColor: '#fff'
              }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#000',
                        font: {
                          family: 'Helvetica',
                          size: 12
                        },
                    },
                    ticks: {
                      color: '#000',
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: '#000',
                        font: {
                          family: 'Helvetica',
                          size: 12
                        },
                    },
                    ticks: {
                      color: '#000',
                    }
                }
            }
        } // options end
    });
}

// Fetch the last 50 temperature messages and create a chart
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/messages/temperature/last50')
        .then(response => response.json())
        .then(data => {
            // Debugging: Log the entire response
            console.log('Fetched Data:', data);

            // Check if data is an array and has elements
            if (!Array.isArray(data) || data.length === 0) {
                console.error('No valid messages data found:', data);
                return;
            }

            // Extract temperature data and timestamps
            const labels = data.map(message => {
                // Check if timestamp exists, otherwise default to empty
                return message.timestamp ? new Date(message.timestamp).toLocaleString() : '';
            });
            const temperatures = data.map(message => message.temperature || 0); // Default to 0 if temperature is missing

            // Ensure there are valid labels and temperature points
            if (labels.length === 0 || temperatures.length === 0) {
                console.error('No valid labels or temperature data:', { labels, temperatures });
                return;
            }

            // Create chart data object
            const chartData = {
                labels: labels,
                temperatures: temperatures
            };

            // Create the temperature chart
            createTemperatureChart(chartData);
        })
        .catch(error => console.error('Error fetching temperature messages:', error));
});

document.addEventListener('DOMContentLoaded', () => {
  // Function to fetch and display the last status message
  function fetchStatusMessage() {
    fetch('/api/messages/status/last')
      .then(response => response.json())
      .then(data => {
        // Check if data has the status message
        if (data && data.receivedAt) {
          displayStatusMessage(data);
        } else {
          console.error('No status message received');
        }
      })
      .catch(error => console.error('Error fetching status message:', error));
  }

  // Function to display the status message
  function displayStatusMessage(message) {
    const container = document.getElementById('statusMessagesContainer');
    const timeSinceReceived = new Date() - new Date(message.receivedAt); // Calculate elapsed time

    const chipID = message.chipID || 'Unknown';
    const macAddress = message.macAddress || 'Unknown';
    const status = message.status || 'Unknown';
    const timestamp = message.timestamp || 'Unknown';

    // Display the message details
    container.innerHTML = `
      <p><strong>Board ID:</strong> ${chipID} | <strong>MAC:</strong> ${macAddress}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Time:</strong> ${timestamp}</p>
    `;

    // Check if the time elapsed is more than 60 seconds (60000 milliseconds)
    if (timeSinceReceived > 60000) {
      container.classList.remove('primary');
      container.classList.add('alert');
    } else {
      container.classList.remove('alert');
      container.classList.add('primary');
    }
  }

  // Poll the backend every 60 seconds to get the latest status message
  setInterval(fetchStatusMessage, 60000);

  // Fetch the status message when the page first loads
  fetchStatusMessage();
});


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