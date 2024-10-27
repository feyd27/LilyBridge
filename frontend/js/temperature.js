// temperature.js

document.addEventListener('DOMContentLoaded', () => {
    const pageSizeSelect = document.getElementById('pageSize');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value);

    function fetchAndDisplayMessages() {
        fetch(`/api/messages/temperature?limit=${pageSize}&page=${currentPage}`)
            .then(response => response.json())
            .then(data => displayTemperatureMessages(data.messages))
            .catch(error => console.error('Error fetching messages:', error));
    }

    pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        fetchAndDisplayMessages();
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) currentPage--;
        fetchAndDisplayMessages();
    });

    nextPageBtn.addEventListener('click', () => {
        currentPage++;
        fetchAndDisplayMessages();
    });

    fetchAndDisplayMessages();
});

function displayTemperatureMessages(messages) {
    const container = document.querySelector('#temperatureMessagesContainer tbody');
    container.innerHTML = '';
    messages.forEach(message => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${message.chipID}</td>
            <td>${message.macAddress}</td>
            <td>${message.temperature}°C</td>
            <td>${new Date(message.timestamp).toLocaleString()}</td>
            
        `;
        container.appendChild(row);
    });
}
