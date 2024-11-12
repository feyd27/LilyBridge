document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const alertContainer = document.getElementById('alertContainer');
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirmPassword');

    function showAlert(message, type = 'alert') {
        alertContainer.className = `callout ${type}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
    }

    function hideAlert() {
        alertContainer.style.display = 'none';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        hideAlert();

        const password = passwordField.value;
        const confirmPassword = confirmPasswordField.value;

        if (password.length < 12) {
            showAlert("Password must be at least 12 characters long.", "alert");
            return;
        }

        if (password !== confirmPassword) {
            showAlert("Passwords do not match. Please try again.", "alert");
            return;
        }

        // If validation passes, allow the form to submit
        form.submit();
    });
});
