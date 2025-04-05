document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');

    // Function to update button visibility
    function updateButtonVisibility(isAuthenticated) {
        console.log('Is authenticated', isAuthenticated);
        if (isAuthenticated) {
            loginButton.style.display = 'none';
            logoutButton.style.display = 'block';
        } else {
            loginButton.style.display = 'block';
            logoutButton.style.display = 'none';
        }
    }

    // Fetch initial authentication state from the server
  function fetchAuthStatus() {
    const token = localStorage.getItem('accessToken'); // Get token
    fetch('/api/auth/status', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '' // Add token if available
      }
    })
    .then(response => response.json())
    .then(data => {
      updateButtonVisibility(data.isAuthenticated);
    })
    .catch(error => console.error('Error checking authentication status:', error));
  }

  fetchAuthStatus(); // Call it initially

    // Handle login button click
    loginButton.addEventListener('click', () => {
        window.location.href = '/login';
    });

    // Handle logout button click
    logoutButton.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('/api/auth/logout', { 
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '', // Add it to the header
                    'Content-Type': 'application/json', // You might need this
                },
             });
            if (response.ok) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken'); 
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
