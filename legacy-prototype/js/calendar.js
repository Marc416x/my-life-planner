/* ============================================================
   MyLifePlanner — calendar.js
   Calendar & schedule — live clock, year/month/streak calendars, weekly schedule, day/week navigation.
   ============================================================ */

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function updateLiveClock() {
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name = userData.name || 'Nurse';
  const el = document.getElementById('dash-greeting');
  if (el) el.textContent = greeting + ', Nurse ' + name + '! 🌿';
  // Update day label if open
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekNum = getWeekNumber(now);
  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = dayNames[now.getDay()] + ', ' + monthNames[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + ' · Week ' + weekNum;
}

// YEAR CALENDAR
function buildYearCalendar() {
  const container = document.getElementById('year-calendar');
  if (!container) return;
  const now = new Date();
  const year = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let html = '';
  months.forEach((m, mi) => {
    const firstDay = new Date(year, mi, 1).getDay(); // 0=Sun
    const adjFirst = firstDay === 0 ? 6 : firstDay - 1; // Mon-based
    const daysInMo = new Date(year, mi + 1, 0).getDate();
    html += `<div class="mini-cal"><div class="mini-cal-header">${m}</div><div class="mini-cal-days">`;
    ['M','T','W','T','F','S','S'].forEach(d => { html += `<div class="mini-day-name">${d}</div>`; });
    for (let i = 0; i < adjFirst; i++) html += `<div class="mini-day"></div>`;
    for (let d = 1; d <= daysInMo; d++) {
      const isToday = mi === todayMonth && d === todayDate;
      html += `<div class="mini-day${isToday ? ' today' : ''}">${d}</div>`;
    }
    html += '</div></div>';
  });
  container.innerHTML = html;
}

// MONTHLY CALENDAR
function buildMonthlyCalendar() {
  const grid = document.getElementById('monthly-cal-grid');
  if (!grid) return;
  const title = document.getElementById('month-title');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  title.textContent = monthNames[currentMonth.getMonth()] + ' ' + currentMonth.getFullYear();
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const adj = firstDay === 0 ? 6 : firstDay - 1;
  const total = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const events = {7:[{cls:'evt-exam',txt:'Pharmacology Study'}], 9:[{cls:'evt-assign',txt:'Case Study Due'}], 12:[{cls:'evt-clinical',txt:'Clinical Ward'}], 19:[{cls:'evt-exam',txt:'Mid-Term Exam'}]};
  for (let i = 0; i < adj; i++) html += `<div class="cal-day" style="background:var(--bg-main);opacity:0.4;"></div>`;
  for (let d = 1; d <= total; d++) {
  const now = new Date();
  const isToday = currentMonth.getFullYear() === now.getFullYear() && currentMonth.getMonth() === now.getMonth() && d === now.getDate();
    const dateKey = currentMonth.getFullYear() + '-' + (currentMonth.getMonth()+1) + '-' + d;
    const stored = calendarTasks[dateKey] || [];
    const evs = [...(events[d] || []), ...stored];
    html += `<div class="cal-day${isToday ? ' today' : ''}" ondblclick="openDayModal(${d},${currentMonth.getMonth()},${currentMonth.getFullYear()})"><div class="cal-day-num">${d}</div>${evs.map(e => `<div class="cal-event ${e.cls || e.type}">${e.txt || e.text}</div>`).join('')}</div>`;
  }
  grid.innerHTML = html;
}

function changeMonth(dir) {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1);
  buildMonthlyCalendar();
}

// STREAK CALENDAR
function buildStreakCalendar() {
  const c = document.getElementById('streak-cal');
  if (!c) return;
  const now = new Date();
  const todayDate = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = ['M','T','W','T','F','S','S'];
  let html = days.map(d => `<div class="streak-day" style="background:var(--bg-main);border-color:var(--border);font-size:0.6rem;color:var(--text-muted);">${d}</div>`).join('');
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === todayDate;
    html += `<div class="streak-day${isToday ? ' today' : ''}">${i}</div>`;
  }
  c.innerHTML = html;
}

// SCHEDULE (editable)
function buildSchedule() {
  const body = document.getElementById('schedule-body');
  if (!body) return;
  const times = ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];
  const cols = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let html = times.map((t, ti) => `<tr><td class="time-col">${t}</td>${cols.map(col => {
    const blocks = scheduleBlocks.filter(b => b.day === col && b.start === t);
    return `<td style="position:relative;">${blocks.map(b => `<div class="schedule-event ${b.type}" style="top:3px;left:3px;right:3px;bottom:3px;overflow:hidden;font-size:0.65rem;">${b.subject}<br><span style="opacity:0.7;">${b.start}–${b.end}</span><button onclick="removeScheduleBlock('${b.subject.replace(/'/g,'')}','${col}')" style="position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.7);font-size:0.7rem;line-height:1;">✕</button></div>`).join('')}</td>`;
  }).join('')}</tr>`).join('');
  body.innerHTML = html;
}

function removeScheduleBlock(subject, day) {
  scheduleBlocks = scheduleBlocks.filter(b => !(b.subject.replace(/'/g,'') === subject && b.day === day));
  buildSchedule();
  showNotif('Schedule block removed');
}

// ========== SCHEDULE EDITABLE ==========
function addScheduleBlock() {
  const day = document.getElementById('sch-day').value;
  const start = document.getElementById('sch-start').value;
  const end = document.getElementById('sch-end').value;
  const subject = document.getElementById('sch-subject').value.trim();
  const type = document.getElementById('sch-type').value;
  if (!subject) { showNotif('Please enter a subject name'); return; }
  const fmt = t => { const [h,m]=t.split(':');const hr=parseInt(h);return (hr%12||12)+':'+(m||'00')+' '+(hr<12?'AM':'PM'); };
  scheduleBlocks.push({day, start:fmt(start), end:fmt(end), subject, type});
  document.getElementById('sch-subject').value = '';
  buildSchedule();
  showNotif('Schedule block added! 🗓️');
}

// ========== NAVIGATE DAYS ==========
function changeDay(dir) {
  currentDay = new Date(currentDay.getTime() + dir * 86400000);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const today = new Date();
  const isToday = currentDay.toDateString() === today.toDateString();
  document.getElementById('daily-day-name').textContent = dayNames[currentDay.getDay()];
  document.getElementById('daily-date-label').textContent = monthNames[currentDay.getMonth()] + ' ' + currentDay.getDate() + ', ' + currentDay.getFullYear() + (isToday ? ' · Today' : '');
}

// ========== NAVIGATE WEEKS ==========
function changeWeek(dir) {
  currentWeekOffset += dir;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const base = new Date(now);
  base.setDate(now.getDate() + mondayOffset + currentWeekOffset * 7);
  const end = new Date(base); end.setDate(end.getDate() + 6);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('weekly-range-label').textContent =
    'Week of ' + months[base.getMonth()] + ' ' + base.getDate() + ' – ' + months[end.getMonth()] + ' ' + end.getDate() + ', ' + end.getFullYear();
}
