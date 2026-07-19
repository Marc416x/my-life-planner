/* ============================================================
   MyLifePlanner — app.js
   App bootstrap — runs last, after every other module. Initial UI build, saved settings, DOMContentLoaded hooks.
   ============================================================ */

// INIT
buildYearCalendar();


// Close sidebar on nav item click (mobile)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 767) closeSidebar();
    });
  });
});

// Handle window resize
window.addEventListener('resize', () => {
  if (window.innerWidth > 767) {
    closeSidebar();
    document.body.style.overflow = '';
  }
});

// Init on load
applyPremiumGates();

// Restore saved mode on load
(function() {
  try {
    var saved = localStorage.getItem('mlp_colour_mode');
    if (saved && MODES.indexOf(saved) !== -1) {
      setMode(saved);
    } else {
      setMode('mode-light');
    }
  } catch(e) { setMode('mode-light'); }
})();

document.addEventListener('DOMContentLoaded', function() {
  var sel = document.getElementById('account-type-select');
  if (sel) setAccountType(sel.value, true);
});
document.addEventListener('DOMContentLoaded', function() {
  renderOtherGroupsLeaderboard('other-groups-list');
});
// ---------- Boot: render new-feature widgets once the app has launched ----------
document.addEventListener('DOMContentLoaded', function() {
  renderNotifMatrix();
  var savedLocale = null;
  try { savedLocale = localStorage.getItem('mlp_locale'); } catch(e) {}
  setLanguage(savedLocale === 'fr' ? 'fr' : 'en');
});
// Recompute GPA whenever the Grades page is shown
var _origShowPage = window.showPage;
if (typeof _origShowPage === 'function') {
  window.showPage = function(id) {
    _origShowPage(id);
    if (id === 'grades') renderGPA();
  };
}
