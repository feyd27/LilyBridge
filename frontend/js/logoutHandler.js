document.addEventListener('click', async (event) => {
    console.log('aaaa');
    // Check if the clicked element matches the logout link
    const target = event.target.closest('a[href="/logout-confirmation"]');
    if (target) {
        event.preventDefault();
        console.log('Logout link clicked');
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
            });

            if (response.ok) {
                console.log('Logout successful, redirecting...');
                window.location.href = '/logout-confirmation';
            } else {
                console.error('Failed to log out');
            }
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }
});

