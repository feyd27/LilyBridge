// /js/loginHandler.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const passwordField = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const alertContainer = document.getElementById('alertContainer');

    // Show or hide the password
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye-slash'); // Toggle the eye icon
        });
    }

    // Handle form submission for login
    if (form) {
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
                    // ** REFACTORED PART **
                    // 1. Show a success message on the current page.
                    showAlert('Login successful! Redirecting to the home page', 'success');

                    // 2. Wait 2 seconds, then redirect to the index page.
                    setTimeout(() => {
                        window.location.href = '/'; // Redirect to the index page
                    }, 2000); // 2000 milliseconds = 2 seconds

                } else {
                    // Show error alert
                    showAlert(data.message || "Login failed. Please try again.", "alert");
                }
            } catch (error) {
                console.error('Error during login:', error);
                showAlert("An error occurred during login. Please try again later.", "alert");
            }
        });
    }

    // Function to show alerts
    function showAlert(message, type) {
        if (alertContainer) {
            alertContainer.className = `callout ${type}`;
            alertContainer.textContent = message;
            alertContainer.style.display = 'block';
            alertContainer.style.borderRadius = '6px';
            alertContainer.classList.remove('fade-out'); // Reset the fade-out animation

            // Set a timeout to fade out after 3 seconds
            setTimeout(() => {
                alertContainer.classList.add('fade-out');
            }, 3000);
        }
    }
});