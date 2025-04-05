document.addEventListener('DOMContentLoaded', () => {
    function fetchStatusMessage() {
        fetch('/api/public/api/messages/status/last')
            .then(response => response.json())
            .then(data => {
                if (data && data.receivedAt) displayStatusMessage(data);
                else console.error('No status message received');
            })
            .catch(error => console.error('Error fetching status message:', error));
    }

    function displayStatusMessage(message) {
        const container = document.getElementById('lastStatusMessagesContainer');
        const timeSinceReceived = new Date() - new Date(message.receivedAt);

        const chipID = message.chipID || 'Unknown';
        const macAddress = message.macAddress || 'Unknown';
        const status = message.status || 'Unknown';
        const timestamp = message.timestamp || 'Unknown';
        container.innerHTML = `
            <p><strong>Board ID:</strong> ${chipID} | <strong>MAC:</strong> ${macAddress}</p>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
        `;

        if (timeSinceReceived > 60000) {
            container.classList.remove('primary');
            container.classList.add('alert');
        } else {
            container.classList.remove('alert');
            container.classList.add('primary');
        }
    }

    // Poll every 60 seconds
    setInterval(fetchStatusMessage, 60000);
    fetchStatusMessage();
});
