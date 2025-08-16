// /js/userSettings.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const alertCon = document.getElementById('alertContainer');
  const iotaInput = form.querySelector('input[name="iotaNodeAddress"]');
  const signumInput = form.querySelector('input[name="signumNodeAddress"]');
  const iotaTagPrefixIn = form.querySelector('input[name="iotaTagPrefix"]');
  const signumTagPrefixIn = form.querySelector('input[name="signumTagPrefix"]'); // ← new

  function showAlert(msg, type = 'success') {
    alertCon.className = `callout ${type}`;
    alertCon.textContent = msg;
    alertCon.style.display = 'block';
    setTimeout(() => alertCon.style.display = 'none', 3000);
  }

  // 1️⃣ Load saved settings (including tag prefix)
  async function loadSettings() {
    try {
      const res = await fetch('/api/settings/me');
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || res.statusText);

      form.elements['iotaNodeAddress'].value = json.iotaNodeAddress || '';
      form.elements['signumNodeAddress'].value = json.signumNodeAddress || '';
      form.elements['iotaTagPrefix'].value = json.iotaTagPrefix || '';  // ← new
      form.elements['signumTagPrefix'].value = json.signumTagPrefix || '';  // ← new
    } catch (err) {
      console.error('Failed to load settings', err);
      showAlert('Could not load settings', 'alert');
    }
  }

  // 2️⃣ Save updated settings (including tag prefix)
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      iotaNodeAddress: form.elements['iotaNodeAddress'].value || null,
      signumNodeAddress: form.elements['signumNodeAddress'].value || null,
      iotaTagPrefix: form.elements['iotaTagPrefix'].value || null,  // ← new
      signumTagPrefix: form.elements['signumTagPrefix'].value || null  // ← new
    };

    try {
      const res = await fetch('/api/settings/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
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

  loadSettings();
});
