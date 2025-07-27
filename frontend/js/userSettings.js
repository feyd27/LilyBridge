import { fetchWithAuth } from './authFetch.js';

document.addEventListener('DOMContentLoaded', () => {
  const form  = document.getElementById('settingsForm');
  const alert = document.getElementById('alertContainer');
  const iotaInput   = form.querySelector('input[name="iotaAddress"]');
  const signumInput = form.querySelector('input[name="signumAddress"]');

  function showAlert(msg, type = 'success') {
    alert.className = `callout ${type}`;
    alert.textContent = msg;
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 3000);
  }

  // 1️⃣ Load only IOTA & Signum
  async function load() {
    try {
      const res  = await fetchWithAuth('/api/settings/me');
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);

      form.elements['iotaAddress'].value   = json.iotaAddress   || '';
      form.elements['signumAddress'].value = json.signumAddress || '';
    } catch (err) {
      console.error('Failed to load settings', err);
      showAlert('Could not load settings', 'alert');
    }
  }

  // 2️⃣ PATCH only the two fields
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      iotaAddress:   form.elements['iotaAddress'].value   || null,
      signumAddress: form.elements['signumAddress'].value || null
    };

    try {
      const res = await fetchWithAuth('/api/settings/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);
      showAlert('Settings saved!');
    } catch (err) {
      console.error('Save failed', err);
      showAlert('Save failed', 'alert');
    }
  });

  load();
});
