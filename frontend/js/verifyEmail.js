document.addEventListener('DOMContentLoaded', () => {
    const messageContainer = document.getElementById('messageContainer');
    const successContent = document.getElementById('successContent');

    const displayMessage = (message, type) => {
        if (messageContainer) {
            messageContainer.className = `callout ${type}`;
            messageContainer.textContent = message;
            messageContainer.style.display = 'block';
        }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
  
    if (!token) {
        console.error('Verification token is missing.');
        displayMessage('Error: Verification token is missing or invalid. Please use the link from your email.', 'alert'); 
        return; // Stop execution
    }
  
    fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message) });
        }
        return response.json();
    })
    .then(data => {
        // On success, hide the message container and show the success content
        messageContainer.style.display = 'none';
        successContent.style.display = 'block';
        
        // Redirect to login page after a delay
        setTimeout(() => {
            window.location.href = '/login'; 
        }, 3000);
    })
    .catch(error => {
        console.error('Error during verification:', error);
        displayMessage(error.message || 'An error occurred during verification.', 'alert');
    });
});