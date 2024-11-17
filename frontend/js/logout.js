// logout.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutLink = document.getElementById('logoutLink');

    if (logoutLink) {
        logoutLink.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default link behavior

            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include', // Ensure cookies are sent with the request
                });

                if (response.ok) {
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
