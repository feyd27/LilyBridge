// /js/temperatureChart.js

let temperatureChartInstance = null;

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
            labels: data.labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: data.temperatures,
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
                    text: 'Last 50 Sensor Readings',
                    color: '#000',
                    font: { family: 'Helvetica', weight: 'bold' }
                },
                legend: {
                    labels: { color: '#000', font: { family: 'Helvetica', size: 12 } }
                },
                tooltip: {
                    bodyFont: { family: 'Helvetica', size: 14 },
                    titleFont: { family: 'Helvetica', size: 14 },
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
                        font: { family: 'Helvetica', size: 12 }
                    },
                    ticks: { color: '#000' }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: '#000',
                        font: { family: 'Helvetica', size: 12 }
                    },
                    ticks: { color: '#000' }
                }
            }
        }
    });
}

// Fetch the last 50 temperature messages and create a chart
document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/public/api/messages/temperature/last50')
        .then(response => response.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0)
                {
                    // Display "No saved messages" message
                    const chartCanvas = document.getElementById('temperatureChart');
                    const noDataMessage = document.createElement('p'); 
                    noDataMessage.textContent = "No saved messages for temperature reading";
                    noDataMessage.style.textAlign = 'center'; // Center the message
                    chartCanvas.parentNode.insertBefore(noDataMessage, chartCanvas); // Insert before the canvas
                    return; 
                  }

            const labels = data.map(message => message.timestamp ? new Date(message.timestamp).toLocaleString() : '');
            const temperatures = data.map(message => message.temperature || 0);

            const chartData = { labels, temperatures };
            createTemperatureChart(chartData);
        })
        .catch(error => console.error('Error fetching temperature messages:', error));
});
