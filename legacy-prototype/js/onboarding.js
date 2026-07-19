/* ============================================================
   MyLifePlanner — onboarding.js
   Onboarding flow — welcome steps, gender/palette pickers, launching the app.
   ============================================================ */

// ONBOARDING
function nextStep(step) {
  document.getElementById('step-' + currentStep).classList.remove('active');
  document.getElementById('dot-' + currentStep).classList.remove('active');
  currentStep = step;
  document.getElementById('step-' + currentStep).classList.add('active');
  document.getElementById('dot-' + currentStep).classList.add('active');

  if (step === 3) {
    const name = document.getElementById('ob-firstname').value || 'Nursing Student';
    const year = document.getElementById('ob-year').value;
    const strategy = document.getElementById('ob-strategy').value;
    const reason = document.getElementById('ob-reason').value;
    userData.name = name;
    userData.year = year;
    document.getElementById('setup-summary').innerHTML =
      `👤 Name: <strong>${name}</strong><br>📚 ${year} Nursing Student<br>🎯 Strategy: ${strategy}<br>💡 Goal: ${reason}`;
  }
}

function selectGender(gender, el) {
  document.querySelectorAll('.gender-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  userData.gender = gender;
}

function selectPalette(idx, el) {
  document.querySelectorAll('.palette-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  userData.palette = idx;
  applyPalette(idx);
}

function launchApp() {
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const name = userData.name || 'Nurse';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-level').textContent = '🌱 Beginner';
  document.getElementById('sidebar-streak').textContent = '0';

  // Live date & time using browser locale (reflects device timezone)
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = greeting + ', Nurse ' + name + '! 🌿';

  // Format date with day name, full date and week number
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekNum = getWeekNumber(now);
  document.getElementById('dash-date').textContent =
    dayNames[now.getDay()] + ', ' + monthNames[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + ' · Week ' + weekNum;

  // Daily view label
  const dailyDayEl = document.getElementById('daily-day-name');
  const dailyDateEl = document.getElementById('daily-date-label');
  if (dailyDayEl) dailyDayEl.textContent = dayNames[now.getDay()];
  if (dailyDateEl) dailyDateEl.textContent = monthNames[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + ' · Today';

  // Weekly view label
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekLabelEl = document.getElementById('weekly-range-label');
  if (weekLabelEl) weekLabelEl.textContent = 'Week of ' + shortMonths[weekStart.getMonth()] + ' ' + weekStart.getDate() + ' – ' + shortMonths[weekEnd.getMonth()] + ' ' + weekEnd.getDate() + ', ' + weekEnd.getFullYear();

  document.getElementById('dash-year').textContent = userData.year.replace('Year ', '');
  applyPalette(userData.palette || 0);
  setGenderTheme(userData.gender || 'female', null);
  buildYearCalendar();
  buildMonthlyCalendar();
  buildStreakCalendar();
  buildSchedule();

  // Live clock tick on dashboard
  updateLiveClock();
  setInterval(updateLiveClock, 60000);

  applyAccountRouting();
}
