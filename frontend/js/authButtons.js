document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');

    // Function to update button visibility
    function updateButtonVisibility(isAuthenticated) {
        if (isAuthenticated) {
            loginButton.style.display = 'none';
            logoutButton.style.display = 'block';
        } else {
            loginButton.style.display = 'block';
            logoutButton.style.display = 'none';
        }
    }

    // Fetch initial authentication state from the server
    fetch('/api/auth/status')
        .then(response => response.json())
        .then(data => {
            updateButtonVisibility(data.isAuthenticated);
        })
        .catch(error => console.error('Error checking authentication status:', error));

    // Handle login button click
    loginButton.addEventListener('click', () => {
        window.location.href = '/login';
    });

    // Handle logout button click
    logoutButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (response.ok) {
                // alert('You have been logged out.');
                updateButtonVisibility(false);
                window.location.href = '/logout-confirmation';
            } else {
                console.error('Logout failed');
            }
        } catch (error) {
            console.error('Error during logout:', error);
        }
    });
});
