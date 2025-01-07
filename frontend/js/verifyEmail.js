// frontend/js/verifyEmail.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
  
    if (!token) {
      // Handle missing token (e.g., display an error message)
      console.error('Verification token is missing.');
      displayMessage('Error: Verification token is missing.', 'error'); 
      return;
    }
  
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    .then(response => response.json())
    .then(data => {
      if (response.ok) {
        // Verification successful
        showAlert(data.message || 'Account verified successfully!', 'success');
        // Redirect to login page after a delay
        setTimeout(() => {
          window.location.href = '/login'; 
        }, 6000); // Redirect after 3 seconds
      } else {
        // Verification failed
        showAlert(data.message || 'Verification failed.', 'error');
      }
    })
    .catch(error => {
      console.error('Error during verification:', error);
      showAlert('An error occurred during verification.', 'error');
    });
  });
  
