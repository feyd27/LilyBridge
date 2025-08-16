// logout.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');

    if (logoutButton) {
        logoutButton.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default link behavior

            try {
                // The browser will automatically send the HttpOnly cookies with this request.
                // No headers or tokens are needed from the client-side script.
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                });

                if (response.ok) {
                    // The server has successfully cleared the cookies.
                    // Now we can redirect the user.
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