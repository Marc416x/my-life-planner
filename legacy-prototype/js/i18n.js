/* ============================================================
   MyLifePlanner — i18n.js
   Internationalisation — translation dictionary lookup and language switching.
   ============================================================ */

function setLanguage(lang) {
  currentLang = lang;
  userData.locale = lang;
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (i18nDict[lang] && i18nDict[lang][key]) el.textContent = i18nDict[lang][key];
  });
  document.getElementById('lang-btn-en').style.opacity = lang === 'en' ? '1' : '0.55';
  document.getElementById('lang-btn-fr').style.opacity = lang === 'fr' ? '1' : '0.55';
  try { localStorage.setItem('mlp_locale', lang); } catch(e) {}
  showNotif(lang === 'fr' ? '🌐 Langue changée en Français' : '🌐 Language switched to English');
}
