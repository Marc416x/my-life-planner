/* ============================================================
   MyLifePlanner — navigation.js
   Navigation & UI helpers — page switching, calendar tabs, mobile sidebar, toast notifications.
   ============================================================ */

// NAVIGATION
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
  if (window.innerWidth <= 767) closeSidebar();
  window.scrollTo(0, 0);
}

// CALENDAR TABS
function switchCalTab(tab, btn) {
  document.querySelectorAll('#page-calendar .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#page-calendar .tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('cal-' + tab).classList.add('active');
}

// NOTIFICATION
function showNotif(msg) {
  const n = document.getElementById('notification');
  document.getElementById('notif-text').textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 3000);
}

// ===== MOBILE SIDEBAR =====
function toggleSidebar() {
  const sb = document.getElementById('main-sidebar');
  const ov = document.getElementById('sidebar-overlay');
  const isOpen = sb.classList.contains('open');
  if (isOpen) { closeSidebar(); } else {
    sb.classList.add('open');
    ov.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebar() {
  const sb = document.getElementById('main-sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.remove('open');
  ov.classList.remove('active');
  document.body.style.overflow = '';
}

function showPageMobile(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  const navItem = document.querySelector(`.nav-item[onclick*="${id}"]`);
  if (navItem) navItem.classList.add('active');
}
