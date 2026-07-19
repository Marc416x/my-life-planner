/* ============================================================
   MyLifePlanner — theme.js
   Theming — colour palettes plus Light / White / Dark colour-mode switching.
   ============================================================ */

function applyPalette(idx) {
  const p = PALETTES[idx] || PALETTES[0];
  const root = document.documentElement;
  root.style.setProperty('--p1', p.p1);
  root.style.setProperty('--p1-light', p.p1l);
  root.style.setProperty('--p1-dark', p.p1d);
  root.style.setProperty('--p2', p.p2);
  root.style.setProperty('--p2-light', p.p2l);
  root.style.setProperty('--p2-dark', p.p2d);
  root.style.setProperty('--p3', p.p3);
  root.style.setProperty('--p3-light', p.p3l);
  root.style.setProperty('--p4', p.p4);
  root.style.setProperty('--p4-light', p.p4l);
  root.style.setProperty('--p5', p.p5);
  root.style.setProperty('--bg-main', p.bg);
  root.style.setProperty('--bg-card', p.bgc);
  root.style.setProperty('--bg-sidebar', p.bgs);
  root.style.setProperty('--text-primary', p.tp);
  root.style.setProperty('--text-secondary', p.ts);
  root.style.setProperty('--text-muted', p.tm);
  root.style.setProperty('--border', p.border);
  root.style.setProperty('--border-strong', p.borderS);
  userData.palette = idx;
  // Update wave SVG colors dynamically
  updateWaveColors(p.p1);
}

function updateWaveColors(color) {
  const enc = encodeURIComponent(color).replace(/%23/g,'%23');
  // Sidebar streak mini background
  const streak = document.querySelector('.streak-mini');
  if (streak) { streak.style.background = 'var(--p3-light)'; }
}

function setGenderTheme(gender, btn) {
  document.body.classList.remove('theme-female','theme-male','theme-neutral');
  document.body.classList.add('theme-' + gender);
  userData.gender = gender;
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.style.background = 'none';
    b.style.borderColor = 'var(--border-strong)';
    b.style.color = 'var(--text-secondary)';
  });
  if (btn) {
    btn.style.background = 'var(--p1-light)';
    btn.style.borderColor = 'var(--p1)';
    btn.style.color = 'var(--p1-dark)';
  }
}

function buildProfilePaletteGrid() {
  const grid = document.getElementById('profile-palette-grid');
  if (!grid) return;
  grid.innerHTML = PALETTES.map((p,i) => `
    <div onclick="selectProfilePalette(${i},this)" style="border:2px solid ${userData.palette===i?p.p1:'rgba(0,0,0,0.1)'};border-radius:10px;padding:0.5rem;cursor:pointer;background:${p.bgc};transition:all 0.2s;">
      <div style="display:flex;gap:3px;margin-bottom:4px;">
        <div style="width:14px;height:14px;border-radius:50%;background:${p.p1};"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${p.p2};"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${p.p3};"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${p.p4};"></div>
      </div>
      <div style="font-size:0.62rem;color:${p.tp};font-weight:500;line-height:1.2;">${p.name}</div>
    </div>`).join('');
}

function selectProfilePalette(idx, el) {
  document.querySelectorAll('#profile-palette-grid > div').forEach(d => {
    d.style.borderColor = 'rgba(0,0,0,0.1)';
    d.style.transform = 'none';
  });
  el.style.borderColor = PALETTES[idx].p1;
  el.style.transform = 'scale(1.05)';
  applyPalette(idx);
  showNotif('Palette applied: ' + PALETTES[idx].name + ' 🎨');
}


function setMode(mode) {
  document.body.classList.remove('mode-light', 'mode-white', 'mode-dark');
  document.body.classList.add(mode);
  currentMode = mode;
  // Sync settings toggle labels
  updateModeButtons();
  // Re-apply palette so light/dark receive correct overrides
  applyPalette(userData.palette || 0);
  try { localStorage.setItem('mlp_colour_mode', mode); } catch(e) {}
}

function updateModeButtons() {
  MODES.forEach(function(m) {
    var el = document.getElementById('mode-btn-' + m);
    if (!el) return;
    el.style.borderColor = m === currentMode ? 'var(--p1)' : 'var(--border-strong)';
    el.style.background = m === currentMode ? 'var(--p1-light)' : 'none';
    el.style.color = m === currentMode ? 'var(--terracotta-dark)' : 'var(--text-secondary)';
  });
}
