document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const alertContainer = document.getElementById('alertContainer');
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirmPassword');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

    function showAlert(message, type) {
        alertContainer.className = `callout ${type}`;
        alertContainer.textContent = message;
        alertContainer.style.display = 'block';
        alertContainer.classList.remove('fade-out'); // Reset the fade-out
    
        // Set a timeout to fade out after 3 seconds
        setTimeout(() => {
            alertContainer.classList.add('fade-out');
        }, 3000); // 3000 ms = 3 seconds
    }

    function hideAlert() {
        alertContainer.style.display = 'none';
    }

    // Toggle password visibility
    function toggleVisibility(field, toggleIcon) {
        if (field.type === 'password') {
            field.type = 'text';
            toggleIcon.classList.add('fa-eye-slash');
        } else {
            field.type = 'password';
            toggleIcon.classList.remove('fa-eye-slash');
        }
    }

    togglePassword.addEventListener('click', () => toggleVisibility(passwordField, togglePassword));
    toggleConfirmPassword.addEventListener('click', () => toggleVisibility(confirmPasswordField, toggleConfirmPassword));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        hideAlert();

        const rawUserName = form.username.value;
        const cleanUserName = DOMpurify.sanitize(rawUserName);

        if (rawUserName !== cleanUserName) {
            showAlert("Username contained invalid characters which were removed.", "warning");
            form.username.value = cleanUserName;
            return;
        }

        const password = passwordField.value;
        const confirmPassword = confirmPasswordField.value;

        // Password validation criteria
        const passwordCriteria = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{12,}$/;

        if (!passwordCriteria.test(password)) {
            showAlert("Password must be at least 12 characters long, contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.", "alert");
            return;
        }

        if (password !== confirmPassword) {
            showAlert("Passwords do not match. Please try again.", "alert");
            return;
        }

        // If validation passes, submit the form data via fetch
        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: cleanUserName, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'User registered successfully') {
                showAlert("Registration successful! Check your email to verify your account.", "success");
                setTimeout(() => {
                    window.location.href = '/login';
                }, 5000);  // Redirect after 5 seconds
            } else {
                showAlert(data.message || "Registration failed.", "alert");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert("An error occurred during registration.", "alert");
        });
    });
});
