/* ============================================================
   MyLifePlanner — auth.js
   Auth & account routing — sign in/up, Google mock, account types (individual / institutional / admin), logout.
   ============================================================ */

// ===================================================================
// MVP ADDITIONS (per Lovable spec §7): Auth, AI Assistant, Study
// Groups, Notifications, Language, Data Export, GPA calc, Timezone
// ===================================================================

// ---------- 7.1 AUTH GATE (demo: local only, no backend) ----------
function onSignupAccountTypeChange() {
  var type = document.getElementById('auth-signup-accounttype').value;
  var row = document.getElementById('auth-signup-institution-row');
  var note = document.getElementById('auth-signup-accounttype-note');
  row.style.display = (type === 'individual') ? 'none' : 'block';
  var notes = {
    individual: "You'll land on your personal planner dashboard.",
    institutional_student: "You'll land on your planner dashboard, with a banner showing your enrolled institution.",
    institutional_admin: "You'll land directly on your Institution Dashboard — not the personal planner."
  };
  note.textContent = notes[type];
}
function showAuthView(view) {
  document.getElementById('auth-signup-view').style.display = view === 'signup' ? 'block' : 'none';
  document.getElementById('auth-signin-view').style.display = view === 'signin' ? 'block' : 'none';
}
function completeAuth(email, isNewUser) {
  userData.email = email || userData.email;
  userData.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; // §7.4
  document.getElementById('auth-gate').style.display = 'none';
  var saved = null;
  try { saved = localStorage.getItem('mlp_user_profile'); } catch(e) {}
  if (!isNewUser && saved) {
    try {
      var parsed = JSON.parse(saved);
      Object.assign(userData, parsed);
    } catch(e) {}
    document.getElementById('onboarding').style.display = 'none';
    launchApp();
  } else {
    document.getElementById('onboarding').style.display = 'flex';
  }
}
function mockSignUp() {
  var email = document.getElementById('auth-signup-email').value.trim();
  var pw = document.getElementById('auth-signup-password').value;
  if (!email || !pw) { showNotif('Please enter an email and password ⚠️'); return; }
  userData.accountType = document.getElementById('auth-signup-accounttype').value;
  userData.institutionName = document.getElementById('auth-signup-institution').value.trim() || 'Riverside School of Nursing';
  completeAuth(email, true);
}
function mockSignIn() {
  var email = document.getElementById('auth-signin-email').value.trim();
  var pw = document.getElementById('auth-signin-password').value;
  if (!email || !pw) { showNotif('Please enter your email and password ⚠️'); return; }
  completeAuth(email, false);
}
function mockGoogleAuth() {
  showNotif('🔵 Signed in with Google (demo)');
  if (!userData.accountType) userData.accountType = 'individual';
  completeAuth('nurse@gmail.com', false);
}
// ---------- Routes each account type to the right landing page right after login, with its own nav ----------
function showPageProgrammatic(id, navItemId) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var pageEl = document.getElementById('page-' + id);
  if (pageEl) pageEl.classList.add('active');
  if (navItemId) {
    var navEl = document.getElementById(navItemId);
    if (navEl) navEl.classList.add('active');
  }
  window.scrollTo(0, 0);
}
function applyAccountRouting() {
  var type = userData.accountType || 'individual';
  var sel = document.getElementById('account-type-select');
  if (sel) sel.value = type;
  setAccountType(type, true); // gates Settings screens + sidebar nav sections, silent on initial route
  var banner = document.getElementById('dashboard-institution-banner');
  if (banner) {
    banner.style.display = (type === 'institutional_student') ? 'flex' : 'none';
    var nameEl = document.getElementById('dashboard-institution-name');
    if (nameEl && userData.institutionName) nameEl.textContent = userData.institutionName;
  }
  if (type === 'institutional_admin') {
    showPageProgrammatic('institution', 'nav-item-institution');
  } else {
    showPageProgrammatic('dashboard', 'nav-item-dashboard');
  }
}
function logOutToLogin() {
  if (!confirm('Log out and return to the login screen?')) return;
  document.getElementById('app').style.display = 'none';
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('auth-gate').style.display = 'flex';
  showAuthView('signin');
}
// Persist a lightweight profile snapshot so "sign in" can restore it in this demo
function persistProfileSnapshot() {
  try { localStorage.setItem('mlp_user_profile', JSON.stringify(userData)); } catch(e) {}
}

// ---------- Account Type (demo toggle — gates entire nav + Settings screens per role) ----------
function setAccountType(type, silent) {
  var note = document.getElementById('account-type-note');
  var notes = {
    individual: "You're on an individual account — full control over your own peer groups and streak mode.",
    institutional_student: "Your school has enrolled you in an institutional cohort. Your admin can see your Course Grade and Practice Grade once you consent — you can still join peer groups on the side.",
    institutional_admin: "Admin accounts are 100% cohort-management — no personal planner, just the Institution Dashboard and administration tools."
  };
  if (note) note.textContent = notes[type] || '';
  // Completely separate sidebars: hide every role-scoped nav section, then reveal only this role's.
  document.querySelectorAll('.nav-for-individual, .nav-for-institutional_student, .nav-for-institutional_admin').forEach(function(el) {
    el.style.display = 'none';
  });
  document.querySelectorAll('.nav-for-' + type).forEach(function(el) {
    el.style.display = 'block';
  });
  // Show only the Settings sections relevant to this account type — separate screens, not one mixed list.
  document.querySelectorAll('.settings-for-individual, .settings-for-institutional_student, .settings-for-institutional_admin').forEach(function(el) {
    el.style.display = 'none';
  });
  document.querySelectorAll('.settings-for-' + type).forEach(function(el) {
    el.style.display = 'block';
  });
  var instNote = document.getElementById('sub-institution-note');
  if (instNote) instNote.style.display = (type === 'institutional_student') ? 'block' : 'none';
  if (!silent) showNotif('Account type set to preview: ' + type.replace('_', ' '));
}
