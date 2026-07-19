/* ============================================================
   MyLifePlanner — premium-features.js
   Premium & study modules — premium gating, subscriptions, NCLEX tracker, pharmacology tracker & quiz.
   ============================================================ */

function togglePremium(on) {
  isPremium = on;
  applyPremiumGates();
  showNotif(on ? '✨ Premium unlocked! All features enabled.' : 'Premium disabled.');
}
function applyPremiumGates() {
  ['nclex-lock','drugs-lock','ai-lock','groups-lock'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = isPremium ? 'none' : 'flex';
  });
}
function openPremiumModal() { document.getElementById('premium-modal').style.display = 'flex'; }
function closePremiumModal() { document.getElementById('premium-modal').style.display = 'none'; }

function mockSubscribe(plan) {
  // Demo mode: simulates a successful Stripe Checkout without leaving the app.
  // Production: redirect to a real Stripe Checkout session, then confirm via webhook.
  subscriptionPlan = plan;
  isPremium = true;
  applyPremiumGates();
  document.getElementById('sub-status-free').style.display = 'none';
  document.getElementById('sub-status-premium').style.display = 'flex';
  document.getElementById('sub-plan-label').textContent = plan === 'yearly' ? 'Yearly' : 'Monthly';
  var renew = new Date();
  renew.setMonth(renew.getMonth() + (plan === 'yearly' ? 12 : 1));
  document.getElementById('sub-renew-date').textContent = renew.toLocaleDateString();
  showNotif('🎉 Premium unlocked — ' + (plan === 'yearly' ? 'Yearly' : 'Monthly') + ' plan active!');
}
function mockManageSubscription() {
  if (confirm("Cancel your Premium subscription? (demo mode — in production this opens the Stripe billing portal)")) {
    subscriptionPlan = null;
    isPremium = false;
    applyPremiumGates();
    document.getElementById('sub-status-free').style.display = 'flex';
    document.getElementById('sub-status-premium').style.display = 'none';
    showNotif('Subscription cancelled.');
  }
}

// ========== NCLEX OPT-IN ==========
function toggleNclexOpt(on) {
  var nav = document.getElementById('nav-nclex');
  if (nav) nav.style.display = on ? 'flex' : 'none';
  showNotif(on ? '🩺 NCLEX Tracker added to sidebar!' : 'NCLEX Tracker hidden.');
}

function logNclexSession() {
  var cat = document.getElementById('nclex-cat-select').value;
  var done = parseInt(document.getElementById('nclex-q-done').value);
  var correct = parseInt(document.getElementById('nclex-q-correct').value);
  var notes = document.getElementById('nclex-notes').value.trim();
  if (!done || isNaN(done) || isNaN(correct) || correct === undefined) { showNotif('Please fill in questions done and correct ⚠️'); return; }
  if (correct > done) { showNotif('Correct cannot exceed questions done ⚠️'); return; }
  var pct = Math.round((correct / done) * 100);
  var now = new Date();
  nclexSessions.push({ cat:cat, done:done, correct:correct, pct:pct, notes:notes, date:now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) });
  document.getElementById('nclex-q-done').value = '';
  document.getElementById('nclex-q-correct').value = '';
  document.getElementById('nclex-notes').value = '';
  renderNclexDashboard();
  showNotif('Session logged! ' + pct + '% — ' + nclexCatNames[cat] + ' 🩺');
}

function renderNclexDashboard() {
  var total = nclexSessions.length;
  var totalQ = nclexSessions.reduce(function(s,x){return s+x.done;},0);
  var avgScore = total ? Math.round(nclexSessions.reduce(function(s,x){return s+x.pct;},0)/total) : null;
  document.getElementById('nclex-total-sessions').textContent = total;
  document.getElementById('nclex-total-q').textContent = totalQ;
  document.getElementById('nclex-avg-score').textContent = avgScore !== null ? avgScore+'%' : '—';
  var readiness = avgScore === null ? '—' : avgScore >= 75 ? '✅ Pass' : avgScore >= 60 ? '🟡 Near' : '🔴 Needs Work';
  document.getElementById('nclex-readiness').textContent = readiness;
  var cats = ['safe','health','psycho','physio'];
  var bars = document.querySelectorAll('.nclex-bar-fill');
  var badges = document.querySelectorAll('.nclex-score-badge');
  cats.forEach(function(cat,i) {
    var sessions = nclexSessions.filter(function(s){return s.cat===cat;});
    var avg = sessions.length ? Math.round(sessions.reduce(function(s,x){return s+x.pct;},0)/sessions.length) : null;
    if (bars[i]) bars[i].style.width = (avg!==null?avg:0)+'%';
    if (badges[i]) badges[i].textContent = avg!==null ? avg+'%' : '—';
  });
  var list = document.getElementById('nclex-history-list');
  if (!nclexSessions.length) { list.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:1.5rem;font-family:\'Nunito\',sans-serif;font-style:italic;">No sessions yet. Start practicing! 🩺</div>'; return; }
  var colors = { safe:'var(--terracotta-dark)', health:'var(--olive-dark)', psycho:'#7A5A10', physio:'var(--forest)' };
  var bgs = { safe:'var(--terracotta-light)', health:'var(--olive-light)', psycho:'var(--ochre-light)', physio:'var(--forest-light)' };
  list.innerHTML = nclexSessions.slice().reverse().map(function(s) {
    return '<div class="nclex-session-row"><span style="background:'+bgs[s.cat]+';color:'+colors[s.cat]+';font-size:0.72rem;padding:2px 8px;border-radius:10px;font-weight:500;white-space:nowrap;">'+nclexCatNames[s.cat]+'</span><span style="flex:1;font-size:0.82rem;color:var(--text-secondary);">'+s.done+' Qs · '+s.correct+' correct</span><span style="font-family:\'Caveat\',cursive;font-size:1.1rem;font-weight:700;color:'+(s.pct>=75?'var(--forest)':s.pct>=60?'#7A5A10':'var(--terracotta)')+';">'+s.pct+'%</span><span style="font-size:0.7rem;color:var(--text-muted);">'+s.date+'</span>'+(s.notes?'<span title="'+s.notes+'" style="cursor:help;color:var(--text-muted);">📝</span>':'')+'</div>';
  }).join('');
}

function submitDailyDrugs() {
  var d1 = { name:document.getElementById('d1-name').value.trim(), cls:document.getElementById('d1-class').value.trim(), moa:document.getElementById('d1-moa').value.trim(), indications:document.getElementById('d1-indications').value.trim(), side:document.getElementById('d1-side').value.trim(), nursing:document.getElementById('d1-nursing').value.trim(), dose:document.getElementById('d1-dose').value.trim() };
  var d2 = { name:document.getElementById('d2-name').value.trim(), cls:document.getElementById('d2-class').value.trim(), moa:document.getElementById('d2-moa').value.trim(), indications:document.getElementById('d2-indications').value.trim(), side:document.getElementById('d2-side').value.trim(), nursing:document.getElementById('d2-nursing').value.trim(), dose:document.getElementById('d2-dose').value.trim() };
  if (!d1.name || !d2.name) { showNotif('Please enter a name for both drugs ⚠️'); return; }
  var today = new Date().toDateString();
  if (drugLog.find(function(e){return e.date===today;})) { showNotif("Already logged today's drugs! Come back tomorrow 🌿"); return; }
  drugLog.push({ date:today, drugs:[d1,d2] });
  drugStreakCount++;
  ['d1-name','d1-class','d1-moa','d1-indications','d1-side','d1-nursing','d1-dose','d2-name','d2-class','d2-moa','d2-indications','d2-side','d2-nursing','d2-dose'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  renderDrugDashboard();
  buildDrugQuiz();
  showNotif('🎉 Both drugs logged! Streak: '+drugStreakCount+' days. Quiz unlocked!');
}

function renderDrugDashboard() {
  var allDrugs = drugLog.reduce(function(a,e){return a.concat(e.drugs);},[]);
  var classes = allDrugs.map(function(d){return d.cls;}).filter(function(c,i,arr){return c && arr.indexOf(c)===i;});
  var today = new Date().toDateString();
  var todayEntry = drugLog.find(function(e){return e.date===today;});
  document.getElementById('drug-total').textContent = allDrugs.length;
  document.getElementById('drug-streak').textContent = drugStreakCount;
  document.getElementById('drug-today-count').textContent = (todayEntry?'2':'0')+'/2';
  document.getElementById('drug-classes').textContent = classes.length;
  if (drugLog.length > 1) document.getElementById('drug-quiz-section').style.display = 'block';
  var filterRow = document.getElementById('drug-filter-row');
  filterRow.innerHTML = '<button class="btn-add" style="padding:0.3rem 0.85rem;font-size:0.78rem;" onclick="filterDrugs(\'all\')">All</button>' +
    classes.map(function(c){return '<button class="btn-add" style="padding:0.3rem 0.85rem;font-size:0.78rem;" onclick="filterDrugs(\''+c+'\')">'+c+'</button>';}).join('');
  filterDrugs('all');
}

function filterDrugs(cls) {
  var allDrugs = drugLog.reduce(function(a,e){return a.concat(e.drugs);},[]);
  var filtered = cls==='all' ? allDrugs : allDrugs.filter(function(d){return d.cls===cls;});
  var list = document.getElementById('drug-history-list');
  if (!filtered.length) { list.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:1.5rem;font-family:\'Nunito\',sans-serif;font-style:italic;">No drugs logged yet. Start today! 💊</div>'; return; }
  list.innerHTML = filtered.map(function(d){
    return '<div class="drug-history-card"><div class="drug-name-badge">'+d.name+'</div>'+(d.cls?'<div class="drug-prop-row"><span class="prop-label">Class</span>'+d.cls+'</div>':'')+(d.moa?'<div class="drug-prop-row"><span class="prop-label">Mechanism</span>'+d.moa+'</div>':'')+(d.indications?'<div class="drug-prop-row"><span class="prop-label">Indications</span>'+d.indications+'</div>':'')+(d.side?'<div class="drug-prop-row"><span class="prop-label">Side Effects</span>'+d.side+'</div>':'')+(d.nursing?'<div class="drug-prop-row"><span class="prop-label">Nursing Notes</span>'+d.nursing+'</div>':'')+(d.dose?'<div class="drug-prop-row"><span class="prop-label">Dosage</span>'+d.dose+'</div>':'')+'</div>';
  }).join('');
}

function buildDrugQuiz() {
  if (drugLog.length < 2) return;
  var yesterday = drugLog[drugLog.length-2];
  var quizEl = document.getElementById('drug-quiz-content');
  quizEl.innerHTML = yesterday.drugs.map(function(d,i){
    return '<div class="quiz-drug-card"><div style="font-family:\'Caveat\',cursive;font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">Drug '+(i+1)+': <span style="color:var(--terracotta);">'+d.name+'</span></div><div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">Recall everything about this drug without looking.</div><button class="quiz-reveal-btn" onclick="revealDrugAnswer(this,'+i+')">Reveal Answer</button><div class="quiz-answer-box" id="quiz-answer-'+i+'">'+(d.cls?'<strong>Class:</strong> '+d.cls+'<br>':'')+(d.moa?'<strong>Mechanism:</strong> '+d.moa+'<br>':'')+(d.indications?'<strong>Indications:</strong> '+d.indications+'<br>':'')+(d.side?'<strong>Side Effects:</strong> '+d.side+'<br>':'')+(d.nursing?'<strong>Nursing Notes:</strong> '+d.nursing+'<br>':'')+(d.dose?'<strong>Dosage:</strong> '+d.dose:'')+'</div></div>';
  }).join('');
}

function revealDrugAnswer(btn, idx) {
  var box = document.getElementById('quiz-answer-'+idx);
  var show = box.style.display !== 'block';
  box.style.display = show ? 'block' : 'none';
  btn.textContent = show ? 'Hide Answer' : 'Reveal Answer';
}
