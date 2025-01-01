// frontend/js/authCheck.js

function checkAuthentication() {
    const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
    fetch('/api/auth/status', {
        headers: {
            'Authorization': `Bearer ${token}`  // Add Authorization header
        }
    })
      .then(response => {
        if (!response.ok) {
          window.location.href = '/login';
        }
      })
      .catch(error => {
        console.error('Error checking authentication status:', error);
        // Handle the error, e.g., show an error message or redirect to login
      });
  }
  
  document.addEventListener('DOMContentLoaded', checkAuthentication);