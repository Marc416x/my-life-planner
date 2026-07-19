/* ============================================================
   MyLifePlanner — planner.js
   Planner — profile, day modal, daily tasks, weekly goals, reflection, career goals, book libraries.
   ============================================================ */

// ========== PROFILE ==========
function openProfile() {
  const m = document.getElementById('profile-modal');
  m.style.display = 'flex';
  document.getElementById('prof-name').value = userData.name || '';
  document.getElementById('prof-year').value = userData.year || 'Year 1';
  document.getElementById('prof-daily-goal').value = profileData.dailyGoal;
  document.getElementById('prof-weekly-goal').value = profileData.weeklyGoal;
  document.getElementById('prof-sleep-goal').value = profileData.sleepGoal;
  document.getElementById('prof-water-goal').value = profileData.waterGoal;
  buildProfilePaletteGrid();
  // Highlight current gender theme button
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.style.background = 'none';
    b.style.borderColor = 'var(--border-strong)';
    b.style.color = 'var(--text-secondary)';
  });
}

function closeProfile() {
  document.getElementById('profile-modal').style.display = 'none';
}

function saveProfile() {
  const name = document.getElementById('prof-name').value || userData.name;
  userData.name = name;
  userData.year = document.getElementById('prof-year').value;
  profileData.dailyGoal = parseFloat(document.getElementById('prof-daily-goal').value) || 3;
  profileData.weeklyGoal = parseFloat(document.getElementById('prof-weekly-goal').value) || 21;
  profileData.sleepGoal = parseFloat(document.getElementById('prof-sleep-goal').value) || 8;
  profileData.waterGoal = parseInt(document.getElementById('prof-water-goal').value) || 8;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('dash-year').textContent = userData.year.replace('Year ','');
  const h = new Date().getHours();
  const greeting = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  document.getElementById('dash-greeting').textContent = greeting + ', Nurse ' + name + '! 🌿';
  closeProfile();
  showNotif('Profile saved successfully! ✅');
}

function openDayModal(day, month, year) {
  currentDayModal = {day, month, year};
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('day-modal-title').textContent = 'Tasks — ' + months[month] + ' ' + day;
  const m = document.getElementById('day-modal');
  m.style.display = 'flex';
  renderDayModalTasks();
}

function closeDayModal() {
  document.getElementById('day-modal').style.display = 'none';
}

function renderDayModalTasks() {
  if (!currentDayModal) return;
  const key = currentDayModal.year + '-' + (currentDayModal.month+1) + '-' + currentDayModal.day;
  const tasks = calendarTasks[key] || [];
  const list = document.getElementById('day-tasks-list');
  if (tasks.length === 0) { list.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:0.5rem;">No tasks for this day yet</div>'; return; }
  list.innerHTML = tasks.map((t,i) => `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--border);font-size:0.82rem;"><span class="cal-event ${t.type}" style="flex:1;overflow:visible;white-space:normal;">${t.time ? t.time+' — ':''} ${t.text}</span><button onclick="removeDayTask(${i})" style="background:none;border:none;cursor:pointer;color:var(--terracotta);font-size:0.85rem;">✕</button></div>`).join('');
}

function saveDayTask() {
  if (!currentDayModal) return;
  const text = document.getElementById('day-task-input').value.trim();
  const time = document.getElementById('day-task-time').value;
  const type = document.getElementById('day-task-type').value;
  if (!text) return;
  const key = currentDayModal.year + '-' + (currentDayModal.month+1) + '-' + currentDayModal.day;
  if (!calendarTasks[key]) calendarTasks[key] = [];
  calendarTasks[key].push({text, type, time});
  document.getElementById('day-task-input').value = '';
  document.getElementById('day-task-time').value = '';
  renderDayModalTasks();
  buildMonthlyCalendar();
  showNotif('Task added to calendar! 📅');
}

function removeDayTask(idx) {
  if (!currentDayModal) return;
  const key = currentDayModal.year + '-' + (currentDayModal.month+1) + '-' + currentDayModal.day;
  calendarTasks[key].splice(idx, 1);
  renderDayModalTasks();
  buildMonthlyCalendar();
}

// ========== DAILY TASKS ==========
function addDailyTask() {
  const inp = document.getElementById('daily-task-inp');
  const text = inp.value.trim();
  if (!text) return;
  dailyTasks.push({text, done: false});
  inp.value = '';
  renderDailyTasks();
  showNotif('Task added! ✅');
}

function renderDailyTasks() {
  const ul = document.getElementById('daily-tasks-ul');
  const empty = document.getElementById('daily-tasks-empty');
  if (!ul) return;
  empty.style.display = dailyTasks.length ? 'none' : 'block';
  ul.innerHTML = dailyTasks.map((t,i) => `
    <li style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--border);">
      <div class="task-check${t.done?' done':''}" onclick="toggleDailyTask(${i})" style="width:16px;height:16px;border-radius:50%;border:2px solid var(--border-strong);flex-shrink:0;cursor:pointer;background:${t.done?'var(--olive)':'none'};border-color:${t.done?'var(--olive)':'var(--border-strong)'};transition:all 0.2s;"></div>
      <span style="flex:1;font-size:0.84rem;color:var(--text-secondary);${t.done?'text-decoration:line-through;opacity:0.6;':''}">${t.text}</span>
      <button onclick="removeDailyTask(${i})" style="background:none;border:none;cursor:pointer;color:var(--terracotta);font-size:0.82rem;">✕</button>
    </li>`).join('');
}

function toggleDailyTask(i) { dailyTasks[i].done = !dailyTasks[i].done; renderDailyTasks(); }
function removeDailyTask(i) { dailyTasks.splice(i,1); renderDailyTasks(); }

// ========== WEEKLY GOALS ==========
function addWeeklyGoal() {
  const inp = document.getElementById('weekly-goal-inp');
  const text = inp.value.trim();
  if (!text) return;
  weeklyGoals.push({text, done: false});
  inp.value = '';
  renderWeeklyGoals();
  showNotif('Weekly goal added! 🎯');
}

function renderWeeklyGoals() {
  const ul = document.getElementById('weekly-goals-ul');
  const empty = document.getElementById('weekly-goals-empty');
  if (!ul) return;
  empty.style.display = weeklyGoals.length ? 'none' : 'block';
  ul.innerHTML = weeklyGoals.map((g,i) => `
    <li style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid var(--border);">
      <div onclick="toggleWeeklyGoal(${i})" style="width:14px;height:14px;border-radius:3px;border:2px solid var(--border-strong);flex-shrink:0;cursor:pointer;background:${g.done?'var(--olive)':'none'};border-color:${g.done?'var(--olive)':'var(--border-strong)'};"></div>
      <span style="flex:1;font-size:0.82rem;color:var(--text-secondary);${g.done?'text-decoration:line-through;opacity:0.5;':''}">${g.text}</span>
      <button onclick="removeWeeklyGoal(${i})" style="background:none;border:none;cursor:pointer;color:var(--terracotta);font-size:0.78rem;">✕</button>
    </li>`).join('');
}

function toggleWeeklyGoal(i) { weeklyGoals[i].done = !weeklyGoals[i].done; renderWeeklyGoals(); }
function removeWeeklyGoal(i) { weeklyGoals.splice(i,1); renderWeeklyGoals(); }

// ========== WEEKLY REFLECTION SAVE ==========
function saveReflection() {
  const txt = document.getElementById('weekly-reflection-txt');
  if (txt && txt.value.trim()) {
    document.getElementById('reflection-saved').style.display = 'block';
    setTimeout(() => { document.getElementById('reflection-saved').style.display = 'none'; }, 2500);
    showNotif('Weekly reflection saved! 📝');
  }
}

// ========== CAREER GOALS ==========
function addCareerGoal() {
  const text = document.getElementById('career-goal-input').value.trim();
  const year = document.getElementById('career-year-input').value;
  const status = document.getElementById('career-status-input').value;
  if (!text) return;
  careerGoalCounter++;
  const id = 'cg' + careerGoalCounter;
  const dotClass = status === 'done' ? 'done' : status === 'future' ? 'future' : '';
  const list = document.getElementById('career-goals-list');
  const div = document.createElement('div');
  div.className = 'milestone-item';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="milestone-dot ${dotClass}"></div>
    <div style="flex:1;">
      <div style="font-size:0.88rem;font-weight:500;">${text}</div>
      ${year ? `<div style="font-size:0.72rem;color:var(--text-muted);">${year}</div>` : ''}
    </div>
    <button onclick="deleteCareerGoal('${id}')" style="background:none;border:none;cursor:pointer;font-size:0.72rem;color:var(--terracotta);padding:2px 6px;">✕</button>`;
  list.appendChild(div);
  document.getElementById('career-goal-input').value = '';
  document.getElementById('career-year-input').value = '';
  showNotif('Career goal added! 🌟');
}

function deleteCareerGoal(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
  showNotif('Goal removed');
}

function editCareerGoal(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  const textEl = el.querySelector('div[style*="font-weight"]');
  if (!textEl) return;
  const current = textEl.textContent;
  const newText = prompt('Edit goal:', current);
  if (newText && newText.trim()) { textEl.textContent = newText.trim(); showNotif('Goal updated! ✅'); }
}

// ========== MONTHLY BOOKS ==========
function addMonthlyBook() {
  const title = document.getElementById('monthly-book-title').value.trim();
  const author = document.getElementById('monthly-book-author').value.trim();
  const status = document.getElementById('monthly-book-status').value;
  if (!title) return;
  monthlyBooks.push({title, author, status});
  document.getElementById('monthly-book-title').value = '';
  document.getElementById('monthly-book-author').value = '';
  renderMonthlyBooks();
  showNotif('Book added to reading list! 📚');
}

function renderMonthlyBooks() {
  const list = document.getElementById('monthly-books-list');
  const empty = document.getElementById('monthly-books-empty');
  const count = document.getElementById('monthly-books-count');
  if (!list) return;
  count.textContent = monthlyBooks.length + ' book' + (monthlyBooks.length !== 1 ? 's' : '');
  empty.style.display = monthlyBooks.length ? 'none' : 'block';
  const statusLabel = {
    'to-read': {icon:'📖', bg:'var(--ochre-light)', color:'#7A5A10'},
    'reading': {icon:'📑', bg:'rgba(107,124,74,0.15)', color:'var(--olive-dark)'},
    'done': {icon:'✅', bg:'var(--forest-light)', color:'var(--forest)'}
  };
  list.innerHTML = monthlyBooks.map((b,i) => {
    const s = statusLabel[b.status] || statusLabel['to-read'];
    return `<div style="display:flex;align-items:center;gap:0.65rem;padding:0.5rem 0.75rem;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);">
      <span style="font-size:1rem;">${s.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.85rem;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.title}</div>
        ${b.author ? `<div style="font-size:0.72rem;color:var(--text-muted);">${b.author}</div>` : ''}
      </div>
      <select onchange="changeBookStatus(${i},this.value)" style="font-size:0.72rem;padding:2px 4px;border:1px solid var(--border-strong);border-radius:4px;background:${s.bg};color:${s.color};">
        <option value="to-read"${b.status==='to-read'?' selected':''}>📖 To Read</option>
        <option value="reading"${b.status==='reading'?' selected':''}>📑 Reading</option>
        <option value="done"${b.status==='done'?' selected':''}>✅ Done</option>
      </select>
      <button onclick="removeMonthlyBook(${i})" style="background:none;border:none;cursor:pointer;color:var(--terracotta);font-size:0.82rem;">✕</button>
    </div>`;
  }).join('');
}

function changeBookStatus(i, status) { monthlyBooks[i].status = status; renderMonthlyBooks(); }
function removeMonthlyBook(i) { monthlyBooks.splice(i,1); renderMonthlyBooks(); showNotif('Book removed'); }

// ========== ACADEMIC BOOKS ==========
function addAcadBook() {
  const title = document.getElementById('acad-book-title').value.trim();
  const author = document.getElementById('acad-book-author').value.trim();
  const course = document.getElementById('acad-book-course').value;
  const status = document.getElementById('acad-book-status').value;
  if (!title) return;
  acadBooks.push({title, author, course, status});
  document.getElementById('acad-book-title').value = '';
  document.getElementById('acad-book-author').value = '';
  renderAcadBooks();
  showNotif('Book added to academic library! 📚');
}

function renderAcadBooks() {
  const grid = document.getElementById('acad-books-grid');
  const empty = document.getElementById('acad-books-empty');
  if (!grid) return;
  empty.style.display = acadBooks.length ? 'none' : 'block';
  grid.innerHTML = acadBooks.map((b,i) => {
    const s = statusColors[b.status] || statusColors.required;
    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;border-top:3px solid ${s.color};">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.5rem;">
        <div style="font-size:1.2rem;">${s.icon}</div>
        <button onclick="removeAcadBook(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.82rem;">✕</button>
      </div>
      <div style="font-size:0.88rem;font-weight:600;color:var(--text-primary);margin-bottom:2px;">${b.title}</div>
      ${b.author ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.4rem;">by ${b.author}</div>` : ''}
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem;">
        <span style="font-size:0.62rem;padding:2px 7px;border-radius:10px;background:var(--olive-light);color:var(--olive-dark);">${b.course}</span>
        <span style="font-size:0.62rem;padding:2px 7px;border-radius:10px;background:${s.bg};color:${s.color};">${b.status}</span>
      </div>
      <select onchange="changeAcadStatus(${i},this.value)" style="margin-top:0.5rem;width:100%;font-size:0.75rem;padding:3px 6px;border:1px solid var(--border-strong);border-radius:4px;background:var(--bg-main);color:var(--text-primary);">
        <option value="required"${b.status==='required'?' selected':''}>📌 Required</option>
        <option value="recommended"${b.status==='recommended'?' selected':''}>⭐ Recommended</option>
        <option value="reading"${b.status==='reading'?' selected':''}>📑 Currently Reading</option>
        <option value="done"${b.status==='done'?' selected':''}>✅ Completed</option>
      </select>
    </div>`;
  }).join('');
}

function changeAcadStatus(i, status) { acadBooks[i].status = status; renderAcadBooks(); }
function removeAcadBook(i) { acadBooks.splice(i,1); renderAcadBooks(); showNotif('Book removed'); }
