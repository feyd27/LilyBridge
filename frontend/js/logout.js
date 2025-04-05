// logout.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutLink = document.getElementById('logoutLink');

    if (logoutLink) {
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default link behavior

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
                    // Redirect to logout confirmation page
                    window.location.href = '/logout-confirmation';
                } else {
                    console.error('Failed to log out.');
                    alert('Error logging out. Please try again.');
                }
            } catch (error) {
                console.error('Error during logout:', error);
            }
        });
    }
});
