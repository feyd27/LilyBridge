// frontend/js/authCheck.js
import { fetchWithAuth } from './authFetch.js';
function checkAuthentication() {
    const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
    if (token) {
      console.log('Access token:', 'exists');
    } else {
      console.log('Access token not found.');
    }
    fetchWithAuth('/api/auth/status', {
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