import { fetchWithAuth } from './authFetch.js';

document.addEventListener('DOMContentLoaded', () => {
  const form  = document.getElementById('settingsForm');
  const alert = document.getElementById('settingsAlert');

  // Helper to show messages
  function showAlert(msg, type='success') {
    alert.className = `callout ${type}`;
    alert.textContent = msg;
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 3000);
  }

  // 1) Load current settings
  async function load() {
    try {
      const res  = await fetchWithAuth('/api/settings/me');
      const json = await res.json();
      if (!res.ok) throw new Error(json.message||res.statusText);

      // fill in the form
      form.elements['mqttBroker.address'].value   = json.mqttBroker?.address   || '';
      form.elements['mqttBroker.username'].value  = json.mqttBroker?.username  || '';
      form.elements['mqttBroker.password'].value  = json.mqttBroker?.password  || '';
      form.elements['mqttBroker.isPrivate'].checked = json.mqttBroker?.isPrivate||false;
      form.elements['iotaAddress'].value          = json.iotaAddress           || '';
      form.elements['signumAddress'].value        = json.signumAddress         || '';
    } catch (err) {
      console.error('Failed to load settings', err);
      showAlert('Could not load settings', 'alert');
    }
  }

  // 2) On submit, PATCH only changed fields
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      mqttBroker: {
        address:  form.elements['mqttBroker.address'].value,
        username: form.elements['mqttBroker.username'].value || null,
        password: form.elements['mqttBroker.password'].value || null,
        isPrivate: form.elements['mqttBroker.isPrivate'].checked
      },
      iotaAddress:    form.elements['iotaAddress'].value   || null,
      signumAddress:  form.elements['signumAddress'].value || null
    };
    try {
      const res = await fetchWithAuth('/api/settings/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message||res.statusText);
      showAlert('Settings saved!');
    } catch (err) {
      console.error('Save failed', err);
      showAlert('Save failed', 'alert');
    }
  });

  load();
});
