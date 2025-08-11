// /assets/js/resetPassword.js

// Password validation criteria (exactly as provided)
const passwordCriteria = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{12,}$/;

function qs(id) { return document.getElementById(id); }
function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

function getTokenFromQuery() {
  const url = new URL(window.location.href);
  return url.searchParams.get('token');
}

function setStatus(el, ok, msg = '') {
  el.textContent = msg;
  el.className = `callout ${ok ? 'success' : 'alert'}`;
  if (msg) show(el); else hide(el);
}

document.addEventListener('DOMContentLoaded', () => {
  const form              = qs('resetForm');
  const passInput         = qs('newPassword');
  const confirmInput      = qs('confirmPassword');
  const submitBtn         = qs('resetSubmit');
  const msg               = qs('resetMessage');
  const passHint          = qs('passwordHint');
  const confirmHint       = qs('confirmHint');
  const togglePass        = qs('togglePass');
  const toggleConfirm     = qs('toggleConfirm');

  // Ensure token exists
  const token = getTokenFromQuery();
  if (!token) {
    setStatus(msg, false, 'Missing or invalid reset token. Please use the link from your email.');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  // Live validation
  function validate() {
    const p = passInput.value;
    const c = confirmInput.value;

    let ok = true;

    // Password strength
    if (!passwordCriteria.test(p)) {
      passHint.textContent = 'Password must be 12+ chars, include upper & lower case, a number, and one of !@#$%^&*.';
      passHint.classList.add('is-invalid');
      ok = false;
    } else {
      passHint.textContent = '';
      passHint.classList.remove('is-invalid');
    }

    // Match check
    if (c.length && p !== c) {
      confirmHint.textContent = 'Passwords do not match.';
      confirmHint.classList.add('is-invalid');
      ok = false;
    } else {
      confirmHint.textContent = '';
      confirmHint.classList.remove('is-invalid');
    }

    submitBtn.disabled = !ok || p.length === 0 || c.length === 0;
    return ok;
  }

  passInput.addEventListener('input', validate);
  confirmInput.addEventListener('input', validate);

  // Show/hide toggles (optional)
  function wireToggle(btn, input) {
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const t = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', t);
      btn.textContent = t === 'password' ? 'Show' : 'Hide';
    });
  }
  wireToggle(togglePass, passInput);
  wireToggle(toggleConfirm, confirmInput);

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(msg);

    if (!validate()) return;

    submitBtn.disabled = true;
    submitBtn.classList.add('disabled');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // backend hashes the password – we only send plaintext over HTTPS
        body: JSON.stringify({ token, password: passInput.value })
      });

      if (res.ok) {
        setStatus(msg, true, 'Password updated successfully. Redirecting to login…');
        // Small delay so the user sees the success
        setTimeout(() => { window.location.href = '/login'; }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        const errText = data?.message || 'Failed to reset password. The link may be invalid or expired.';
        setStatus(msg, false, errText);
        submitBtn.disabled = false;
        submitBtn.classList.remove('disabled');
      }
    } catch (err) {
      setStatus(msg, false, 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.classList.remove('disabled');
    }
  });

  // initial button state
  validate();
});
