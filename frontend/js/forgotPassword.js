// /assets/js/forgotPassword.js

// very forgiving email check (optional)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function qs(id)  { return document.getElementById(id); }
function show(el){ if (el) el.style.display = ''; }
function hide(el){ if (el) el.style.display = 'none'; }

function setCallout(msgEl, type, text) {
  if (!msgEl) return;
  msgEl.className = `callout ${type}`;
  msgEl.textContent = text;
  show(msgEl);
}

document.addEventListener('DOMContentLoaded', () => {
  const form         = qs('forgotForm');
  const input        = qs('username') || qs('email'); // support either id
  const submitBtn    = qs('forgotSubmit');
  const messageEl    = qs('forgotMessage');           // <div class="callout" id="forgotMessage"></div>
  const successPanel = qs('forgotSuccess');           // optional: <div id="forgotSuccess">...</div>

  // ensure clean state
  hide(messageEl);
  if (successPanel) hide(successPanel);

  if (!form || !input || !submitBtn) {
    console.error('[ForgotPassword] Missing DOM elements');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(messageEl);

    const username = (input.value || '').trim();

    // simple client validation
    if (!username) {
      setCallout(messageEl, 'alert', 'Please enter your email.');
      return;
    }
    if (!EMAIL_RE.test(username)) {
      // keep it gentle; backend accepts any username string
      setCallout(messageEl, 'alert', 'Please enter a valid email address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('disabled');

    try {
      const res = await fetch('/api/public/forgot-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username })
      });

      // The endpoint always returns 200 to avoid account enumeration
      if (res.ok) {
        // Hide the form and show success message
        hide(form);
        if (successPanel) {
          successPanel.innerHTML = `
            <h5>Check your email</h5>
            <p>If an account exists for <strong>${username}</strong>, we've sent password reset instructions.</p>
            <p>Please check your inbox and spam folder.</p>
          `;
          show(successPanel);
        } else {
          // fallback to callout if no dedicated panel exists
          setCallout(
            messageEl,
            'success',
            'If an account exists, we’ve sent password reset instructions. Please check your inbox and spam folder.'
          );
        }
      } else {
        // unexpected server error
        let msg = 'Something went wrong. Please try again.';
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch {}
        setCallout(messageEl, 'alert', msg);
        submitBtn.disabled = false;
        submitBtn.classList.remove('disabled');
      }
    } catch (err) {
      console.error('[ForgotPassword] Network error:', err);
      setCallout(messageEl, 'alert', 'Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.classList.remove('disabled');
    }
  });
});
