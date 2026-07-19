/* ============================================================
   MyLifePlanner — notifications.js
   Notification preferences — channel matrix, load/save prefs.
   ============================================================ */

function loadNotifPrefs() {
  try {
    var saved = localStorage.getItem('mlp_notif_prefs');
    notifPrefs = saved ? JSON.parse(saved) : {};
  } catch(e) { notifPrefs = {}; }
  notifTypes.forEach(function(t) {
    if (!notifPrefs[t.key]) notifPrefs[t.key] = { push: false, email: false, in_app: true };
  });
}
function saveNotifPrefs() {
  try { localStorage.setItem('mlp_notif_prefs', JSON.stringify(notifPrefs)); } catch(e) {}
}
function renderNotifMatrix() {
  var el = document.getElementById('notif-matrix');
  if (!el) return;
  loadNotifPrefs();
  el.innerHTML = notifTypes.map(function(t) {
    var p = notifPrefs[t.key];
    return '<div class="notif-type-row"><div class="notif-type-label">' + t.label + '</div><div class="notif-channels">' +
      ['push', 'email', 'in_app'].map(function(ch) {
        var checked = p[ch] ? 'checked' : '';
        var label = ch === 'push' ? 'Push' : ch === 'email' ? 'Email' : 'In-app';
        return '<label class="notif-channel-chip"><input type="checkbox" ' + checked + ' onchange="toggleNotifChannel(\'' + t.key + '\',\'' + ch + '\',this.checked)"> ' + label + '</label>';
      }).join('') + '</div></div>';
  }).join('');
}
function toggleNotifChannel(typeKey, channel, on) {
  notifPrefs[typeKey][channel] = on;
  saveNotifPrefs();
  if (channel === 'push' && on && 'Notification' in window) {
    Notification.requestPermission(); // real browser Push API call
  }
  showNotif('Notification preference saved ✅');
}
