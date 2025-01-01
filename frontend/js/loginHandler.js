document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const passwordField = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const alertContainer = document.getElementById('alertContainer');
    document.addEventListener('DOMContentLoaded', () => {
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                window.location.href = '/login'; // Redirect to login page
            });
        }
    });



    // Show or hide the password
    togglePassword.addEventListener('click', () => {
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye-slash'); // Toggle the eye icon
    });

    // Handle form submission for login
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const username = form.querySelector('input[name="username"]').value;
        const password = form.querySelector('input[name="password"]').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Store tokens in local storage 
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                // Redirect to login confirmation page
                window.location.href = 'login-confirmation';
            } else {
                // Show error alert
                showAlert(data.message || "Login failed. Please try again.", "alert");
            }
        } catch (error) {
            console.error('Error during login:', error);
            showAlert("An error occurred during login. Please try again later.", "alert");
        }
    });

    // Function to show alerts
    function showAlert(message, type) {
        alertContainer.className = `callout ${type}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        alertContainer.classList.remove('fade-out'); // Reset the fade-out animation

        // Set a timeout to fade out after 3 seconds
        setTimeout(() => {
            alertContainer.classList.add('fade-out');
        }, 1000); // 3000 ms = 3 seconds
    }
});
