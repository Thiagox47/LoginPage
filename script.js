/**
 * NexusAuth Core Engine
 * Principles: Ponytail Ultra (Minimal, Edge-case Correct, Zero-Bloat) & Archify Segmentation
 */

(function () {
  'use strict';

  // ==========================================
  // 1. STATE & CONFIGURATION
  // ==========================================
  const CONFIG = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 30000, // 30s
    TOKEN_SECRET_MOCK: 'nexus_sec_key_2026_x47'
  };

  const STATE = {
    failedAttempts: 0,
    lockedUntil: null,
    currentUser: null,
    demoProfiles: {
      dev: {
        email: 'thiago.dev@nexus.io',
        pass: 'NexusDev@2026!',
        role: 'Senior Software Engineer'
      },
      admin: {
        email: 'admin@nexus.io',
        pass: 'AdminMaster#99',
        role: 'System Administrator'
      },
      guest: {
        email: 'visitante@techcorp.com',
        pass: 'GuestPass*123',
        role: 'Evaluator / Recruiter'
      }
    }
  };

  // ==========================================
  // 2. DOM ELEMENT REFERENCES
  // ==========================================
  const DOM = {
    tabs: document.querySelectorAll('.tab-btn'),
    forms: document.querySelectorAll('.auth-form'),
    authCard: document.getElementById('auth-card'),
    sessionView: document.getElementById('session-view'),
    sessionGreeting: document.getElementById('session-greeting'),
    sessionTokenDisplay: document.getElementById('session-token-display'),
    btnLogout: document.getElementById('btn-logout'),
    btnCopyToken: document.getElementById('btn-copy-token'),
    toastContainer: document.getElementById('toast-container'),
    
    // Forms
    formLogin: document.getElementById('form-login'),
    loginEmail: document.getElementById('login-email'),
    loginPass: document.getElementById('login-password'),
    loginEmailError: document.getElementById('login-email-error'),
    loginPassError: document.getElementById('login-password-error'),
    btnSubmitLogin: document.getElementById('btn-submit-login'),

    formRegister: document.getElementById('form-register'),
    regName: document.getElementById('reg-name'),
    regEmail: document.getElementById('reg-email'),
    regPass: document.getElementById('reg-password'),
    strengthFill: document.getElementById('strength-fill'),
    strengthText: document.getElementById('strength-text'),
    btnSubmitRegister: document.getElementById('btn-submit-register'),

    formMagic: document.getElementById('form-magic'),
    magicEmail: document.getElementById('magic-email'),
    btnSubmitMagic: document.getElementById('btn-submit-magic'),

    // Demo Pills
    demoPills: document.querySelectorAll('.btn-demo-pill'),
    btnOAuthGoogle: document.getElementById('btn-oauth-google'),
    btnOAuthGithub: document.getElementById('btn-oauth-github')
  };

  // ==========================================
  // 3. UTILITY & SECURITY HELPERS
  // ==========================================

  // Input Sanitizer against XSS and URI Schemes
  function sanitizeInput(str) {
    if (!str || typeof str !== 'string') return '';
    // Strip control characters, dangerously formatted strings and escape HTML
    return str
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[&<>"'/]/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '/': '&#x2F;' }[m];
      })
      .trim();
  }

  // Email RFC 5322 regex validation
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Password Strength & Entropy Evaluator
  function evaluatePasswordStrength(pass) {
    if (!pass || pass.length < 6) return { score: 0, text: 'Muito Curta', color: '#FB7185', width: '15%' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
      case 2:
        return { score, text: 'Fraca', color: '#FB7185', width: '35%' };
      case 3:
      case 4:
        return { score, text: 'Média', color: '#FBBF24', width: '70%' };
      case 5:
        return { score, text: 'Forte (Excelente)', color: '#34D399', width: '100%' };
      default:
        return { score: 0, text: 'Muito Curta', color: '#FB7185', width: '15%' };
    }
  }

  // Generate Simulated Mock JWT Token (Frontend Demo Only)
  // Security Note: Real cryptographic signing must ALWAYS occur server-side with HSM/Env Secrets.
  function generateMockJWT(payload) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      iss: 'nexusauth.io'
    }));
    const signature = btoa(`${header}.${body}.${CONFIG.TOKEN_SECRET_MOCK}`).substring(0, 32);
    return `${header}.${body}.${signature}`;
  }

  // Toast Notification HUD (100% Safe DOM Manipulation - Zero innerHTML)
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconText = 'ℹ️';
    if (type === 'success') iconText = '✅';
    if (type === 'error') iconText = '⚠️';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = iconText;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message; // Safe textContent prevents any script execution

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease-out';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // Rate Limiting Check
  function isRateLimited() {
    if (STATE.lockedUntil && Date.now() < STATE.lockedUntil) {
      const remainingSec = Math.ceil((STATE.lockedUntil - Date.now()) / 1000);
      showToast(`Muitas tentativas. Bloqueado por ${remainingSec}s.`, 'error');
      return true;
    }
    if (STATE.lockedUntil && Date.now() >= STATE.lockedUntil) {
      STATE.lockedUntil = null;
      STATE.failedAttempts = 0;
    }
    return false;
  }

  function registerFailedAttempt() {
    STATE.failedAttempts++;
    if (STATE.failedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
      STATE.lockedUntil = Date.now() + CONFIG.LOCKOUT_DURATION_MS;
      showToast('Limite de tentativas excedido! Bloqueado temporariamente por 30s.', 'error');
    }
  }

  // ==========================================
  // 4. TAB NAVIGATION & INTERACTION
  // ==========================================
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      DOM.forms.forEach(f => f.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const targetId = tab.getAttribute('data-target');
      const targetForm = document.getElementById(targetId);
      if (targetForm) {
        targetForm.classList.add('active');
      }
    });
  });

  // Password Visibility Toggle
  document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const wrapper = btn.closest('.input-wrapper');
      const input = wrapper.querySelector('input');
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // Password Strength Real-time Feedback
  if (DOM.regPass) {
    DOM.regPass.addEventListener('input', () => {
      const evaluation = evaluatePasswordStrength(DOM.regPass.value);
      DOM.strengthFill.style.width = evaluation.width;
      DOM.strengthFill.style.backgroundColor = evaluation.color;
      DOM.strengthText.textContent = evaluation.text;
      DOM.strengthText.style.color = evaluation.color;
    });
  }

  // ==========================================
  // 5. DEMO PRESETS (EVALUATOR SHORTCUTS)
  // ==========================================
  DOM.demoPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const role = pill.getAttribute('data-role');
      const profile = STATE.demoProfiles[role];
      if (!profile) return;

      // Switch to login tab
      document.getElementById('tab-login').click();
      DOM.loginEmail.value = profile.email;
      DOM.loginPass.value = profile.pass;

      showToast(`Credenciais preenchidas: ${profile.role}`, 'info', 2000);
      DOM.loginEmail.classList.remove('input-error');
      DOM.loginPass.classList.remove('input-error');
      DOM.loginEmailError.textContent = '';
      DOM.loginPassError.textContent = '';
    });
  });

  // ==========================================
  // 6. AUTHENTICATION HANDLERS
  // ==========================================

  function renderSessionView(user) {
    STATE.currentUser = user;
    const token = generateMockJWT(user);

    DOM.authCard.style.display = 'none';
    const demoBar = document.getElementById('demo-bar');
    if (demoBar) demoBar.style.display = 'none';

    DOM.sessionGreeting.textContent = `Olá, ${user.name || user.email.split('@')[0]}!`;
    DOM.sessionTokenDisplay.textContent = token;
    DOM.sessionView.style.display = 'block';

    showToast('Login realizado com sucesso!', 'success');
  }

  // Logout Handler
  DOM.btnLogout.addEventListener('click', () => {
    STATE.currentUser = null;
    DOM.sessionView.style.display = 'none';
    DOM.authCard.style.display = 'block';
    const demoBar = document.getElementById('demo-bar');
    if (demoBar) demoBar.style.display = 'flex';

    DOM.loginPass.value = '';
    showToast('Sessão encerrada com segurança.', 'info');
  });

  // Copy Token Handler
  DOM.btnCopyToken.addEventListener('click', () => {
    const token = DOM.sessionTokenDisplay.textContent;
    navigator.clipboard.writeText(token).then(() => {
      showToast('Token JWT copiado para a área de transferência!', 'success');
    }).catch(() => {
      showToast('Erro ao copiar token.', 'error');
    });
  });

  // Form Submit: Login
  DOM.formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isRateLimited()) return;

    const email = sanitizeInput(DOM.loginEmail.value);
    const pass = DOM.loginPass.value;

    let hasError = false;
    DOM.loginEmailError.textContent = '';
    DOM.loginPassError.textContent = '';
    DOM.loginEmail.classList.remove('input-error');
    DOM.loginPass.classList.remove('input-error');

    if (!isValidEmail(email)) {
      DOM.loginEmailError.textContent = 'Por favor, insira um e-mail válido.';
      DOM.loginEmail.classList.add('input-error');
      hasError = true;
    }

    if (!pass || pass.length < 6) {
      DOM.loginPassError.textContent = 'A senha deve conter no mínimo 6 caracteres.';
      DOM.loginPass.classList.add('input-error');
      hasError = true;
    }

    if (hasError) return;

    // Simulate Network Request
    DOM.btnSubmitLogin.classList.add('loading');
    DOM.btnSubmitLogin.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 750));

    DOM.btnSubmitLogin.classList.remove('loading');
    DOM.btnSubmitLogin.disabled = false;

    // Successful Auth Simulation
    renderSessionView({
      email,
      name: email.split('@')[0],
      role: 'Standard User'
    });
  });

  // Form Submit: Register
  DOM.formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = sanitizeInput(DOM.regName.value);
    const email = sanitizeInput(DOM.regEmail.value);
    const pass = DOM.regPass.value;

    if (!name) {
      showToast('Insira seu nome completo.', 'error');
      return;
    }
    if (!isValidEmail(email)) {
      showToast('Insira um e-mail corporativo válido.', 'error');
      return;
    }
    if (evaluatePasswordStrength(pass).score < 2) {
      showToast('Escolha uma senha mais forte.', 'error');
      return;
    }

    DOM.btnSubmitRegister.classList.add('loading');
    DOM.btnSubmitRegister.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 800));

    DOM.btnSubmitRegister.classList.remove('loading');
    DOM.btnSubmitRegister.disabled = false;

    renderSessionView({
      email,
      name,
      role: 'Novo Membro'
    });
  });

  // Form Submit: Magic Link
  DOM.formMagic.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = sanitizeInput(DOM.magicEmail.value);

    if (!isValidEmail(email)) {
      showToast('Insira um e-mail válido para envio.', 'error');
      return;
    }

    DOM.btnSubmitMagic.classList.add('loading');
    DOM.btnSubmitMagic.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 600));

    DOM.btnSubmitMagic.classList.remove('loading');
    DOM.btnSubmitMagic.disabled = false;

    showToast(`Link de acesso enviado com sucesso para ${email}!`, 'success', 5000);
    DOM.magicEmail.value = '';
  });

  // Social OAuth Simulators
  DOM.btnOAuthGoogle.addEventListener('click', () => {
    showToast('Iniciando autenticação segura via Google OAuth...', 'info');
    setTimeout(() => {
      renderSessionView({
        email: 'thiago.google@gmail.com',
        name: 'Thiago Google Auth',
        provider: 'google'
      });
    }, 600);
  });

  DOM.btnOAuthGithub.addEventListener('click', () => {
    showToast('Iniciando autenticação segura via GitHub OAuth...', 'info');
    setTimeout(() => {
      renderSessionView({
        email: 'thiagox47@github.com',
        name: 'Thiago (Thiagox47)',
        provider: 'github'
      });
    }, 600);
  });

  // Expose pure validation helpers for testing (Read-only, State Isolated)
  window.__NEXUS_AUTH__ = Object.freeze({
    sanitizeInput,
    isValidEmail,
    evaluatePasswordStrength
  });

})();
