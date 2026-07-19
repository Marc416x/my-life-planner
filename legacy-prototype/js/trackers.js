/* ============================================================
   MyLifePlanner — trackers.js
   Trackers — study timer, mood, sleep/water/burnout, clinical hours, goals & custom counters.
   ============================================================ */

// TASK TOGGLE
function toggleTask(el) {
  el.classList.toggle('done');
  showNotif(el.classList.contains('done') ? '✅ Task completed!' : 'Task marked as pending');
}

// MOOD
function selectMood(btn, mood) {
  btn.closest('.mood-options, .card, .tracker-card').querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const display = document.getElementById('mood-display');
  if (display) display.textContent = 'Current mood: ' + mood;
}

// TIMER
function setMethod(mins, btn) {
  selectedMethod = mins;
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (!timerRunning) { timerSeconds = mins * 60; updateTimerDisplay(); }
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  if (timerSeconds === 0) timerSeconds = selectedMethod * 60;
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
    const mins = Math.floor(timerSeconds / 60);
    const pct = Math.min((mins / selectedMethod) * 100, 100);
    const bar = document.getElementById('today-study-bar');
    if (bar) bar.style.width = pct + '%';
    document.getElementById('today-study').textContent = mins + 'm';
  }, 1000);
  showNotif('Study session started! 🔥 Focus mode activated');
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  showNotif('Session paused ⏸');
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  const mins = Math.floor(timerSeconds / 60);
  showNotif('Session complete! ' + mins + ' minutes studied 🎉');
  timerSeconds = 0;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const h = Math.floor(timerSeconds / 3600);
  const m = Math.floor((timerSeconds % 3600) / 60);
  const s = timerSeconds % 60;
  document.getElementById('timer-display').textContent =
    String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

// ADJUSTERS
function adjustSleep(delta) {
  sleepVal = Math.max(0, Math.min(12, sleepVal + delta));
  document.getElementById('sleep-val').textContent = sleepVal;
  document.getElementById('sleep-bar').style.width = (sleepVal / 10 * 100) + '%';
}

function adjustWater(delta) {
  waterVal = Math.max(0, Math.min(15, waterVal + delta));
  document.getElementById('water-val').textContent = waterVal;
  document.getElementById('water-bar').style.width = (waterVal / 8 * 100) + '%';
}

function updateBurnout(input) {
  document.getElementById('stress-val').textContent = input.value + '/10';
}

// ========== TRACKER ADJUSTERS ==========
function adjustClinical(d) {
  clinicalVal = Math.max(0, clinicalVal + d);
  document.getElementById('clinical-val').textContent = clinicalVal;
  updateClinicalBar();
}

function updateClinicalBar() {
  const goal = parseInt(document.getElementById('clinical-goal').value) || 50;
  const pct = Math.min((clinicalVal / goal) * 100, 100);
  document.getElementById('clinical-bar').style.width = Math.round(pct) + '%';
}

function adjustGoals(d) {
  goalsDone = Math.max(0, goalsDone + d);
  document.getElementById('goals-done').textContent = goalsDone;
  updateGoalsBar();
}

function updateGoalsBar() {
  const total = parseInt(document.getElementById('goals-total-input').value) || 3;
  document.getElementById('goals-total').textContent = total;
  const pct = total > 0 ? Math.min((goalsDone / total) * 100, 100) : 0;
  document.getElementById('goals-bar').style.width = Math.round(pct) + '%';
}

function adjustCustom(d) {
  customTrackerVal = Math.max(0, customTrackerVal + d);
  document.getElementById('custom-val').textContent = customTrackerVal;
}
