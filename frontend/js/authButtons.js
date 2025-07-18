// public/js/authButtons.js
import { fetchWithAuth } from './authFetch.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginButton  = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  
  // If we’re on the login page, bail out immediately:
  if (window.location.pathname === '/login') return;

  function updateButtonVisibility(isAuthenticated) {
    loginButton.style.display  = isAuthenticated ? 'none'  : 'block';
    logoutButton.style.display = isAuthenticated ? 'block' : 'none';
  }

  async function fetchAuthStatus() {
    try {
      const res = await fetchWithAuth('/api/auth/status');
      if (res.ok) {
        const { isAuthenticated } = await res.json();
        updateButtonVisibility(!!isAuthenticated);
      } else {
        updateButtonVisibility(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      updateButtonVisibility(false);
    }
  }

  fetchAuthStatus();

  loginButton.addEventListener('click', () => {
    window.location.href = '/login';
  });

  logoutButton.addEventListener('click', async () => {
    try {
      const res = await fetchWithAuth('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        updateButtonVisibility(false);
        window.location.href = '/logout-confirmation';
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
});
