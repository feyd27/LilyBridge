
// frontend/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/messages/temperature')
      .then(response => response.json())
      .then(data => {
        console.log('Fetched Data:', data);  // Debugging line
        displayTemperatureMessages(data.messages);
      })
      .catch(error => console.error('Error fetching temperature messages:', error));
  });
  
  function displayTemperatureMessages(messages) {
    console.log('Messages to Display:', messages);  // Debugging line
     // Check if messages is an array
  if (!Array.isArray(messages)) {
    console.error('Expected an array, got:', messages);
    return;
  }
    const container = document.getElementById('temperatureMessagesContainer');
    container.innerHTML = ''; // Clear existing content before adding new data
    if (!container) {
        console.error('Container element not found');  // Debugging line
      }
    messages.forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message';
      messageDiv.innerHTML = `
        <p><strong>Board ID:</strong> ${message.chipID} | <strong>MAC:</strong> ${message.macAddress}</p>
        <p><strong>Temperature:</strong> ${message.temperature}°C</p>
        <p><strong>Time:</strong> ${new Date(message.timestamp).toLocaleString()}</p>
      `;
      container.appendChild(messageDiv);
    });
  };
