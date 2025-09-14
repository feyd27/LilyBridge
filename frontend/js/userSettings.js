// /js/userSettings.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const alertCon = document.getElementById('alertContainer');
  const saveBtn = document.getElementById('saveBtn');

  if (!form || !alertCon) return;

  // Helpers
  const showAlert = (msg, type = 'success', ms = 3000) => {
    alertCon.className = `callout ${type}`;
    alertCon.textContent = msg;
    alertCon.style.display = 'block';
    if (ms) setTimeout(() => (alertCon.style.display = 'none'), ms);
  };
  const byName = (name) => form.elements[name];
  const sanitize = (v) => (typeof v === 'string' ? v.trim() : v);

  // TAG validator: letters & numbers only, up to 16 chars; empty allowed
  const isValidTagPrefix = (v) => /^[A-Za-z0-9]{0,16}$/.test(v);

  // Optional: block invalid chars as user types
  ['iotaTagPrefix', 'signumTagPrefix'].forEach((name) => {
    const el = byName(name);
    if (!el) return;
    el.addEventListener('input', () => {
      const cleaned = (el.value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
      if (el.value !== cleaned) el.value = cleaned;
    });
  });

  const getPayload = () => {
    const iotaNodeAddress = sanitize(byName('iotaNodeAddress')?.value || '');
    const signumNodeAddress = sanitize(byName('signumNodeAddress')?.value || '');
    const iotaTagPrefix = sanitize(byName('iotaTagPrefix')?.value || '');
    const signumTagPrefix = sanitize(byName('signumTagPrefix')?.value || '');

    return {
      // keep sending these; backend has defaults/fallbacks
      iotaNodeAddress: iotaNodeAddress || null,
      signumNodeAddress: signumNodeAddress || null,
      iotaTagPrefix: iotaTagPrefix || null,
      signumTagPrefix: signumTagPrefix || null
    };
  };

  const setDisabled = (on) => {
    if (saveBtn) saveBtn.disabled = on;
    Array.from(form.elements).forEach((el) => {
      if (el === saveBtn) return;
      if (el.dataset?.lock === 'true') return;
      el.disabled = on;
    });
  };

  // Dirty tracking
  let initialSnapshot = null;
  const snapshot = () => JSON.stringify(getPayload());
  const isDirty = () => snapshot() !== initialSnapshot;

  let dirtyTimer;
  form.addEventListener('input', () => {
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(() => {
      if (saveBtn) saveBtn.disabled = !isDirty();
    }, 150);
  });

  // Load
  async function loadSettings() {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch('/api/settings/me', { signal: controller.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || res.statusText);

      byName('iotaNodeAddress') && (byName('iotaNodeAddress').value = json.iotaNodeAddress || '');
      byName('signumNodeAddress') && (byName('signumNodeAddress').value = json.signumNodeAddress || '');
      byName('iotaTagPrefix') && (byName('iotaTagPrefix').value = json.iotaTagPrefix || '');
      byName('signumTagPrefix') && (byName('signumTagPrefix').value = json.signumTagPrefix || '');

      initialSnapshot = snapshot();
      if (saveBtn) saveBtn.disabled = true;
    } catch (err) {
      console.error('Failed to load settings', err);
      showAlert('Could not load settings.', 'alert');
    } finally {
      clearTimeout(t);
    }
  }

  // Save
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const iotaTagPrefix = sanitize(byName('iotaTagPrefix')?.value || '');
    const signumTagPrefix = sanitize(byName('signumTagPrefix')?.value || '');

    // Only tag validation (letters & numbers only)
    if (!isValidTagPrefix(iotaTagPrefix)) {
      showAlert('IOTA tag prefix may contain only letters and numbers (max 16).', 'alert');
      byName('iotaTagPrefix')?.focus();
      return;
    }
    if (!isValidTagPrefix(signumTagPrefix)) {
      showAlert('Signum tag prefix may contain only letters and numbers (max 16).', 'alert');
      byName('signumTagPrefix')?.focus();
      return;
    }

    const payload = getPayload();

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12012);

    try {
      setDisabled(true);
      if (saveBtn) saveBtn.textContent = 'Saving…';

      const res = await fetch('/api/settings/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || res.statusText);

      initialSnapshot = snapshot();
      showAlert('Settings saved!');
    } catch (err) {
      console.error('Save failed', err);
      showAlert(err.message?.length ? `Save failed: ${err.message}` : 'Save failed.', 'alert');
    } finally {
      clearTimeout(t);
      setDisabled(false);
      if (saveBtn) saveBtn.textContent = 'Save';
      if (saveBtn) saveBtn.disabled = !isDirty();
    }
  });

  loadSettings();
});
